"""The Terrain layer for the whole City of Melbourne, as 500 m tiles and one overview.

Terrain V1.1 (`terrain_display.py`, `terrain_marks.py`) was built for Kensington's
square kilometre and shipped as whole arrays: the raw ground, the building mask
and the hillshade, 3 MB, coloured in the browser. The council is 211 measured
500 m tiles — sixty times the area — and the same arrays would be about 90 MB.

**So the colouring moves to the build, and the tiles ship as images.** Each tile
is two WebP images at a metre per pixel:

- `colour.webp` — the fixed AHD ramp, with buildings in their neutral grey;
- `shade.webp` — the hillshade as a multiply factor in [0.81, 1.00], white on
  buildings so the multiply leaves them alone;

and a `marks.json` with the tile's contours and spot-height candidates. The
browser still draws them in V1.1's order — colour, roads over it, shade
multiplied over both — so nothing about the layer's rules changes, only where
the arithmetic happens. About 50 KB a tile, 10 MB for the council.

**Lossy, and said so.** WebP at quality 85 moves a colour by a few units and
softens a building's edge by a pixel. The ramp's nodes are 26° of hue apart at
the metre steps a reader compares; the compression error is an order smaller.

**An overview for when the whole council is in view.** At that scale a hundred
tiles would be on screen and none of them legible. One pair of images at 4 m a
pixel covers the extent; the browser uses it below half a pixel per metre and
under any tile still loading. The overview is its own level of detail with its
own fixed parameters — a hillshade of a 4 m surface at the 1 m exaggeration is
nearly flat — as the handover asks: one resolution, smoothing and exaggeration
per level, never a stretch fitted to a view.

**Seams.** Every tile is computed on a block with a margin of the ground around
it, so a gradient, a smoothed coverage or a contour at a tile edge sees the same
ground its neighbour sees. The hillshade stretch is one pair of percentiles for
the whole council, not one per tile, or two neighbours would be shaded
differently. Where the neighbour is a tile the archive does not have, the
margin is filled from the nearest measured ground and nothing is drawn there.
"""

from __future__ import annotations

import io
import json
import math
from pathlib import Path

import numpy as np
from scipy import ndimage

from .derived import simplify
from .geo import TILE_ORIGIN_E, TILE_ORIGIN_N, TILE_SIZE_M, tile_name
from .terrain_display import (
    AZIMUTH_WEIGHTS,
    STRETCH_PERCENTILES,
    VERTICAL_EXAGGERATION,
    coverage_amplitude,
    hillshade,
)
from .terrain_marks import (
    CONTOUR_INTERVAL_M,
    CONTOUR_MAJOR_EVERY_M,
    CONTOUR_MIN_LENGTH_M,
    CONTOUR_SIMPLIFY_M,
    CONTOUR_SMOOTHING_SIGMA_M,
    SPOT_TILE_M,
    contour_level,
    road_mask,
    spot_heights,
)

#: The ramp, as in `apps/web/src/map/terrain.ts`. Both are asserted against the
#: colour card's nodes, so neither can drift from the other without a failure.
RAMP: tuple[tuple[float, str], ...] = (
    (0.0, "#d7e4d4"),
    (1.0, "#d1e3bf"),
    (2.0, "#d9dda0"),
    (3.0, "#e9d180"),
    (4.0, "#f7c265"),
    (5.0, "#feb958"),
    (10.0, "#f6ac68"),
    (20.0, "#ed965f"),
    (40.0, "#e08159"),
)
BUILDING_RGB = (206, 204, 200)

WEBP_QUALITY = 85
#: Cells of ground around each tile, enough for the hillshade's gradient, the
#: 25 m coverage window and its sigma-6 smoothing, the contour smoothing, and a
#: whole spot-height square.
MARGIN = 100

OVERVIEW_CELL_M = 4
OVERVIEW_EXAGGERATION = 8.0
#: The overview's coverage window and smoothing, in its own 4 m cells.
OVERVIEW_COVERAGE_CELLS = 7
OVERVIEW_COVERAGE_SIGMA = 1.5


class TerrainTilesError(RuntimeError):
    pass


# --- colour -----------------------------------------------------------------


def _hex(value: str) -> np.ndarray:
    return np.array([int(value[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)


def _to_linear(c: np.ndarray) -> np.ndarray:
    v = c / 255.0
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def _from_linear(v: np.ndarray) -> np.ndarray:
    c = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.clip(v, 0, None) ** (1 / 2.4) - 0.055)
    return np.round(np.clip(c, 0, 1) * 255)


def to_oklab(rgb: np.ndarray) -> np.ndarray:
    lr, lg, lb = (_to_linear(rgb[..., i]) for i in range(3))
    l_ = np.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
    m_ = np.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
    s_ = np.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
    return np.stack(
        [
            0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
        ],
        axis=-1,
    )


def from_oklab(lab: np.ndarray) -> np.ndarray:
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    return np.stack(
        [
            _from_linear(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
            _from_linear(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
            _from_linear(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
        ],
        axis=-1,
    )


_NODE_M = np.array([m for m, _ in RAMP])
_NODE_LAB = to_oklab(np.stack([_hex(h) for _, h in RAMP]))


def ramp_colour(metres: np.ndarray) -> np.ndarray:
    """RGB bytes for heights in metres AHD, interpolated in OKLab and clamped at 0 and 40 m."""
    heights = np.nan_to_num(np.asarray(metres, dtype=np.float64), nan=0.0)
    lab = np.stack([np.interp(heights, _NODE_M, _NODE_LAB[:, k]) for k in range(3)], axis=-1)
    return from_oklab(lab).astype(np.uint8)


def shade_grey(stretched: np.ndarray, buildings: np.ndarray) -> np.ndarray:
    """The multiply factor `0.5 + 0.5 × (0.62 + 0.38 × hs)` as a grey byte; white on buildings."""
    grey = np.round(255 * (0.5 + 0.5 * (0.62 + 0.38 * np.clip(stretched, 0, 1))))
    return np.where(buildings, 255, grey).astype(np.uint8)


def webp(array: np.ndarray, *, mode: str) -> bytes:
    from PIL import Image

    buffer = io.BytesIO()
    Image.fromarray(array, mode).save(buffer, "WEBP", quality=WEBP_QUALITY, method=6)
    return buffer.getvalue()


# --- geometry helpers -------------------------------------------------------


def fill_invalid(values: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Every invalid cell takes the value of its nearest valid one."""
    if valid.all() or not valid.any():
        return values
    _, (rows, cols) = ndimage.distance_transform_edt(~valid, return_indices=True)
    return values[rows, cols]


def clip_polyline(line: list[tuple[float, float]], box: tuple[float, float, float, float]) -> list[list[tuple[float, float]]]:
    """The parts of a polyline inside an axis-aligned box (min e, min n, max e, max n)."""
    e0, n0, e1, n1 = box
    pieces: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for (ax, ay), (bx, by) in zip(line, line[1:]):
        # Liang-Barsky.
        dx, dy = bx - ax, by - ay
        t0, t1 = 0.0, 1.0
        keep = True
        for p, q in ((-dx, ax - e0), (dx, e1 - ax), (-dy, ay - n0), (dy, n1 - ay)):
            if p == 0:
                if q < 0:
                    keep = False
                    break
                continue
            r = q / p
            if p < 0:
                t0 = max(t0, r)
            else:
                t1 = min(t1, r)
            if t0 > t1:
                keep = False
                break
        if not keep:
            if len(current) > 1:
                pieces.append(current)
            current = []
            continue
        start = (ax + t0 * dx, ay + t0 * dy)
        end = (ax + t1 * dx, ay + t1 * dy)
        if not current or current[-1] != start:
            if len(current) > 1:
                pieces.append(current)
            current = [start]
        current.append(end)
        if t1 < 1.0:
            pieces.append(current)
            current = []
    if len(current) > 1:
        pieces.append(current)
    return pieces


#: Contour vertices are stored in half-metres. A contour is simplified to 0.5 m
#: already, so this is the precision it has.
CONTOUR_UNIT_M = 0.5


def encode_line(line: list[tuple[float, float]]) -> list[int]:
    """Half-metre integers: the first vertex, then each as the step from the last.

    The council's contours were 18.7 MB as coordinate pairs in JSON, most of it
    digits repeating from one vertex to the next. Rounded before differencing,
    so the steps add back up to the rounded positions exactly. A vertex that
    rounds onto the one before it is dropped.
    """
    flat: list[int] = []
    last: tuple[int, int] | None = None
    for e, n in line:
        here = (int(round(e / CONTOUR_UNIT_M)), int(round(n / CONTOUR_UNIT_M)))
        if here == last:
            continue
        if last is None:
            flat += [here[0], here[1]]
        else:
            flat += [here[0] - last[0], here[1] - last[1]]
        last = here
    return flat


def _length(line: list[tuple[float, float]]) -> float:
    return sum(math.dist(a, b) for a, b in zip(line, line[1:]))


# --- one tile ---------------------------------------------------------------


def tile_contours(block: np.ndarray, *, block_origin: tuple[int, int], grid_rows: int, inner: tuple[float, float, float, float]) -> list[dict]:
    """Contours of one tile, drawn on its block and clipped to it, in grid-local metres."""
    smooth = ndimage.gaussian_filter(block.astype(np.float64), sigma=CONTOUR_SMOOTHING_SIGMA_M, mode="nearest")
    rows, cols = block.shape
    row0, col0 = block_origin
    # `contour_level` reports north as `rows - (row + 0.5)` within the block.
    to_grid_n = grid_rows - row0 - rows
    low = math.ceil(float(smooth.min()) / CONTOUR_INTERVAL_M) * CONTOUR_INTERVAL_M
    high = math.floor(float(smooth.max()) / CONTOUR_INTERVAL_M) * CONTOUR_INTERVAL_M
    features: list[dict] = []
    level = low
    while level <= high + 1e-9:
        for line in contour_level(smooth, level):
            closed = line[0] == line[-1]
            # A closed ring is wholly inside the block, so its length is its
            # length. An open line leaves the block and may be longer than it
            # looks here; it is kept, so no line is cut short at a seam.
            if closed and _length(line) < CONTOUR_MIN_LENGTH_M:
                continue
            placed = [(e + col0, n + to_grid_n) for e, n in simplify(line, CONTOUR_SIMPLIFY_M)]
            for piece in clip_polyline(placed, inner):
                encoded = encode_line(piece)
                if len(encoded) < 4:
                    continue
                features.append(
                    {
                        "m": round(level, 2),
                        "major": abs(level / CONTOUR_MAJOR_EVERY_M - round(level / CONTOUR_MAJOR_EVERY_M)) < 1e-9,
                        "d": encoded,
                    }
                )
        level += CONTOUR_INTERVAL_M
    return features


def build(
    out_dir: Path,
    *,
    ground: np.ndarray,
    measured: np.ndarray,
    buildings: np.ndarray,
    valid: np.ndarray,
    roads: np.ndarray,
    extent: dict,
    tiles: list[tuple[int, int]],
    source: dict,
    log=lambda message: None,
) -> dict:
    grid_rows, grid_cols = ground.shape
    size = int(round(TILE_SIZE_M))
    min_e, min_n = extent["min_e"], extent["min_n"]

    def block_of(tx: int, ty: int):
        col = int(round(TILE_ORIGIN_E + tx * TILE_SIZE_M - min_e))
        top = int(round(grid_rows - (TILE_ORIGIN_N + (ty + 1) * TILE_SIZE_M - min_n)))
        r0, c0 = max(top - MARGIN, 0), max(col - MARGIN, 0)
        r1, c1 = min(top + size + MARGIN, grid_rows), min(col + size + MARGIN, grid_cols)
        return (top, col), (r0, r1, c0, c1)

    def prepared(r0, r1, c0, c1):
        ok = np.asarray(valid[r0:r1, c0:c1])
        g = fill_invalid(np.asarray(ground[r0:r1, c0:c1], dtype=np.float64), ok)
        m = np.asarray(measured[r0:r1, c0:c1]) & ok
        return g, m, np.asarray(buildings[r0:r1, c0:c1]), ok

    # Pass one: the council's hillshade stretch, from every tile's open ground.
    bins = np.linspace(0.0, 1.0, 4001)
    histogram = np.zeros(bins.size - 1, dtype=np.int64)
    for tx, ty in tiles:
        (top, col), (r0, r1, c0, c1) = block_of(tx, ty)
        g, _, bld, ok = prepared(r0, r1, c0, c1)
        raw = hillshade(g)[top - r0 : top - r0 + size, col - c0 : col - c0 + size]
        open_ground = ~bld[top - r0 : top - r0 + size, col - c0 : col - c0 + size] & ok[top - r0 : top - r0 + size, col - c0 : col - c0 + size]
        histogram += np.histogram(raw[open_ground], bins=bins)[0]
    cumulative = np.cumsum(histogram) / max(histogram.sum(), 1)
    low = float(bins[np.searchsorted(cumulative, STRETCH_PERCENTILES[0] / 100)])
    high = float(bins[np.searchsorted(cumulative, STRETCH_PERCENTILES[1] / 100) + 1])
    log(f"  hillshade stretch over the council: {low:.4f} to {high:.4f}")

    out_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    total_bytes = 0
    for index, (tx, ty) in enumerate(tiles):
        name = tile_name(tx, ty)
        (top, col), (r0, r1, c0, c1) = block_of(tx, ty)
        g, m, bld, ok = prepared(r0, r1, c0, c1)
        inner = (slice(top - r0, top - r0 + size), slice(col - c0, col - c0 + size))

        raw = hillshade(g)
        stretched = np.clip((raw - low) / (high - low), 0.0, 1.0)
        attenuated = 0.5 + (stretched - 0.5) * coverage_amplitude(m)
        colour = ramp_colour(g[inner])
        colour[bld[inner]] = BUILDING_RGB
        grey = shade_grey(attenuated[inner], bld[inner])

        e_left = col + 0.0
        n_bottom = float(grid_rows - top - size)
        box = (e_left, n_bottom, e_left + size, n_bottom + size)
        lines = tile_contours(g, block_origin=(r0, c0), grid_rows=grid_rows, inner=box)

        squares = [
            (sx, sy)
            for sy in range(top // SPOT_TILE_M, math.ceil((top + size) / SPOT_TILE_M))
            for sx in range(col // SPOT_TILE_M, math.ceil((col + size) / SPOT_TILE_M))
            if top <= sy * SPOT_TILE_M < top + size and col <= sx * SPOT_TILE_M < col + size
        ]
        usable_roads = np.asarray(roads[r0:r1, c0:c1]) | ~ok
        spots = spot_heights(g, m, bld, usable_roads, origin=(r0, c0), grid_rows=grid_rows, squares=squares)

        folder = out_dir / name
        folder.mkdir(exist_ok=True)
        files = {
            "colour.webp": webp(colour, mode="RGB"),
            "shade.webp": webp(grey, mode="L"),
            "marks.json": (json.dumps({"unitM": CONTOUR_UNIT_M, "contours": lines, "spots": spots}, separators=(",", ":")) + "\n").encode("utf-8"),
        }
        for file_name, data in files.items():
            (folder / file_name).write_bytes(data)
            total_bytes += len(data)
        entries.append({"tile": name, "tx": tx, "ty": ty, "e": e_left, "n": n_bottom, "contours": len(lines), "spots": len(spots)})
        if (index + 1) % 20 == 0:
            log(f"  {index + 1:>4} of {len(tiles)} tiles, {total_bytes / 1e6:.1f} MB")

    overview = write_overview(out_dir, ground=ground, measured=measured, buildings=buildings, valid=valid)
    total_bytes += overview.pop("bytes")

    index_artefact = {
        "artefact": "terrain-tiles",
        "version": 1,
        "basis": "derived",
        "note": (
            "The Terrain layer, pre-coloured: per 500 m tile a colour image on the fixed AHD ramp, a "
            "hillshade multiply image, and the tile's contours and spot-height candidates; and one 4 m "
            "overview of the whole extent. Estimated from filtered aerial photography, about 25 cm "
            "vertically, interpolated under roofs and canopy. Nothing is drawn where the archive has no tile."
        ),
        "source": source,
        "extent": extent,
        "coordinates": "Metres east and north of the extent's south-west corner.",
        "tileGrid": {"originE": TILE_ORIGIN_E, "originN": TILE_ORIGIN_N, "sizeM": TILE_SIZE_M, "cellM": 1},
        "tiles": entries,
        "overview": overview,
        "settings": {
            "ramp": [[m, h] for m, h in RAMP],
            "buildingRgb": list(BUILDING_RGB),
            "webpQuality": WEBP_QUALITY,
            "verticalExaggeration": VERTICAL_EXAGGERATION,
            "azimuthWeights": [[a, w] for a, w in AZIMUTH_WEIGHTS],
            "stretch": [round(low, 4), round(high, 4)],
            "marginCells": MARGIN,
        },
        "bytes": total_bytes,
    }
    (out_dir / "index.json").write_bytes((json.dumps(index_artefact, indent=1) + "\n").encode("utf-8"))
    return index_artefact


def write_overview(out_dir: Path, *, ground: np.ndarray, measured: np.ndarray, buildings: np.ndarray, valid: np.ndarray) -> dict:
    """One 4 m image pair for the whole extent, transparent where nothing was measured."""
    k = OVERVIEW_CELL_M
    rows, cols = ground.shape[0] // k, ground.shape[1] // k

    def blocks(array: np.ndarray, dtype) -> np.ndarray:
        out = np.zeros((rows, cols), dtype=np.float64)
        for r in range(rows):
            strip = np.asarray(array[r * k : (r + 1) * k, : cols * k], dtype=dtype)
            out[r] = strip.reshape(k, cols, k).sum(axis=(0, 2))
        return out

    ok = blocks(valid, np.float64)
    # Summed row by row: the council ground is 306 MB as float32 and not held twice.
    total = np.zeros((rows, cols), dtype=np.float64)
    for r in range(rows):
        g = np.asarray(ground[r * k : (r + 1) * k, : cols * k], dtype=np.float64)
        v = np.asarray(valid[r * k : (r + 1) * k, : cols * k])
        total[r] = np.where(v, g, 0.0).reshape(k, cols, k).sum(axis=(0, 2))
    covered = ok >= (k * k) / 2
    mean = np.where(ok > 0, total / np.maximum(ok, 1), 0.0)
    mean = fill_invalid(mean, ok > 0)

    built = blocks(buildings, np.float64) >= (k * k) / 2
    measured_share = blocks(measured, np.float64) / (k * k)

    raw = hillshade(mean, cell_m=float(k), exaggeration=OVERVIEW_EXAGGERATION)
    open_ground = covered & ~built
    low, high = (float(v) for v in np.percentile(raw[open_ground], STRETCH_PERCENTILES))
    stretched = np.clip((raw - low) / (high - low if high > low else 1.0), 0, 1)
    share = ndimage.uniform_filter(measured_share, size=OVERVIEW_COVERAGE_CELLS, mode="nearest")
    share = ndimage.gaussian_filter(share, sigma=OVERVIEW_COVERAGE_SIGMA, mode="nearest")
    amplitude = 0.4 + 0.6 * np.clip((share - 0.35) / 0.35, 0, 1)
    attenuated = 0.5 + (stretched - 0.5) * amplitude

    colour = np.zeros((rows, cols, 4), dtype=np.uint8)
    colour[..., :3] = ramp_colour(mean)
    colour[built, :3] = BUILDING_RGB
    colour[..., 3] = np.where(covered, 255, 0)
    grey = shade_grey(attenuated, built)
    shade = np.zeros((rows, cols, 2), dtype=np.uint8)
    shade[..., 0] = np.where(covered, grey, 255)
    shade[..., 1] = np.where(covered, 255, 0)

    data = {"overview-colour.webp": webp(colour, mode="RGBA"), "overview-shade.webp": webp(shade, mode="LA")}
    for name, payload in data.items():
        (out_dir / name).write_bytes(payload)
    return {
        "colour": "overview-colour.webp",
        "shade": "overview-shade.webp",
        "cellM": k,
        "width": cols,
        "height": rows,
        "verticalExaggeration": OVERVIEW_EXAGGERATION,
        "stretch": [round(low, 4), round(high, 4)],
        "bytes": sum(len(v) for v in data.values()),
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys
    import time

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.terrain_tiles",
        description="Write the Terrain layer as pre-coloured 500 m tiles and an overview.",
    )
    parser.add_argument("--terrain", type=Path, default=Path("../data/terrain-council"))
    parser.add_argument("--map", type=Path, default=Path("../apps/api/data/city-of-melbourne/map.json"))
    parser.add_argument("--out", type=Path, default=Path("../apps/web/public/data/terrain-tiles"))
    args = parser.parse_args(argv)

    def log(message: str) -> None:
        print(message, file=sys.stderr)

    started = time.time()
    manifest = json.loads((args.terrain / "terrain.json").read_text(encoding="utf-8"))
    box = manifest["extent"]
    extent = {
        "name": box["name"],
        "min_e": box["min_e"],
        "min_n": box["min_n"],
        "width_m": box["max_e"] - box["min_e"],
        "height_m": box["max_n"] - box["min_n"],
    }
    ground = np.load(args.terrain / "ground-surface.npy", mmap_mode="r")
    measured = np.load(args.terrain / "ground-observed.npy", mmap_mode="r")
    buildings_path = args.terrain / "barriers.npy"
    buildings = np.load(buildings_path, mmap_mode="r") if buildings_path.exists() else np.zeros(ground.shape, dtype=bool)
    valid_path = args.terrain / "ground-valid.npy"
    valid = np.load(valid_path, mmap_mode="r") if valid_path.exists() else np.ones(ground.shape, dtype=bool)

    geometry = json.loads(args.map.read_text(encoding="utf-8"))
    if geometry.get("extent", {}).get("min_e") != extent["min_e"] or geometry.get("extent", {}).get("min_n") != extent["min_n"]:
        print("the map geometry is not in the terrain's frame, so its roads would be masked in the wrong place", file=sys.stderr)
        return 1
    log("masking roads")
    roads = road_mask(geometry.get("layers", {}).get("road", []), *ground.shape)

    tiles = []
    for name in manifest["tiles"]:
        tx, ty = (int(part) for part in name.removeprefix("Tile_").split("_"))
        tiles.append((tx, ty))
    tiles.sort(key=lambda t: (t[1], t[0]))
    log(f"building {len(tiles)} tiles for {extent['name']}")

    try:
        index = build(
            args.out,
            ground=ground,
            measured=measured,
            buildings=buildings,
            valid=valid,
            roads=roads,
            extent=extent,
            tiles=tiles,
            source=manifest.get("source", {}),
            log=log,
        )
    except TerrainTilesError as error:
        print(str(error), file=sys.stderr)
        return 1

    contours = sum(t["contours"] for t in index["tiles"])
    spots = sum(t["spots"] for t in index["tiles"])
    print(f"wrote {args.out}  ({index['bytes'] / 1e6:.1f} MB, {time.time() - started:.0f} s)")
    print(f"  tiles          {len(index['tiles']):>7,}")
    print(f"  contour pieces {contours:>7,}")
    print(f"  spot heights   {spots:>7,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
