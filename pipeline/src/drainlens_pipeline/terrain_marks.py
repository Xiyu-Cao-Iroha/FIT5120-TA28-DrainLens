"""Contours and spot heights for the map's Terrain layer.

Terrain V1.1 (the terrain handover, §2.4 and §2.5). The colour ramp says which
ground is higher; these say by how much, in words and lines a reader can check.

**Spot heights are not decoration.** The ramp's green-to-yellow-to-orange path
runs along the axis red-green colour vision separates worst, and a hillshade
has no up or down in it. A number on the map is how somebody who cannot tell
those colours apart reads which way is higher, so the layer draws them by
default.

**Both are fixed, not fitted to a view.** Contours are at whole metres AHD.
Spot-height candidates sit on a fixed 80 m grid with stable ids, and the browser
chooses among them by their priority within screen cells — it never re-selects
points from the distribution of whatever is in view, so a label does not jump
when the map moves.

Contours
    Marching squares over the raw ground, lightly smoothed first (Gaussian,
    sigma 2 m). The surface is quoted at about 25 cm; contouring it unsmoothed
    at 1 m draws that noise as rings around every kerb. Lines under 25 m are
    dropped for the same reason, and each is simplified to 0.5 m. There are no
    0.25 m contours: that interval is the data's own error.

Spot heights
    For each 80 m square, three candidates — the low, middle and high third of
    the usable ground in it. Usable means not a building, not a road, and at
    least 35% measured in the surrounding 15 m (`COVERAGE_MIN_MEASURED`, not a
    new number), eroded by 5 x 5 cells so a point never sits on an edge. Within a
    third, the candidate is the cell with the most measured ground around it;
    slope is not penalised. Heights are rounded to 0.5 m and shown with ≈. A
    third whose rounded height repeats another in the same square is dropped.

    A stricter gate was tried in the handover — 0.50 coverage with a 9 x 9
    erosion — and left a sloping window with 4% usable cells and no point at
    all. What had stopped it was the coverage threshold, not slope.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from scipy import ndimage

from .derived import simplify

CONTOUR_INTERVAL_M = 1.0
CONTOUR_MAJOR_EVERY_M = 5.0
CONTOUR_SMOOTHING_SIGMA_M = 2.0
CONTOUR_MIN_LENGTH_M = 25.0
CONTOUR_SIMPLIFY_M = 0.5

SPOT_TILE_M = 80
SPOT_COVERAGE_WINDOW_M = 15
SPOT_MIN_MEASURED = 0.35
SPOT_EROSION_CELLS = 5
SPOT_ROUNDING_M = 0.5
TIERS = ("a", "b", "c")


class TerrainMarksError(RuntimeError):
    pass


# --- contours ---------------------------------------------------------------

# For each marching-squares case, the pairs of cell edges a segment joins.
# Corners are bit 3 top-left, 2 top-right, 1 bottom-right, 0 bottom-left;
# edges are 0 top, 1 right, 2 bottom, 3 left. The two saddles (5 and 10) are
# split the same way every time, which is a choice and not a measurement — at a
# metre interval on a smoothed surface they are rare and a metre across.
_SEGMENTS: dict[int, tuple[tuple[int, int], ...]] = {
    1: ((3, 2),), 2: ((2, 1),), 3: ((3, 1),), 4: ((0, 1),), 5: ((3, 0), (2, 1)),
    6: ((0, 2),), 7: ((3, 0),), 8: ((3, 0),), 9: ((0, 2),), 10: ((3, 2), (0, 1)),
    11: ((0, 1),), 12: ((3, 1),), 13: ((2, 1),), 14: ((3, 2),),
}


def contour_level(values: np.ndarray, level: float) -> list[list[tuple[float, float]]]:
    """Every line at one level, in local metres (east, north), cell centres at half-metres.

    Segments are joined by the edge they share, so a contour comes out as one
    polyline rather than a pile of two-point pieces; a line that closes on
    itself repeats its first point.
    """
    rows, cols = values.shape
    above = values >= level
    case = (
        above[:-1, :-1].astype(np.int8) * 8
        + above[:-1, 1:].astype(np.int8) * 4
        + above[1:, 1:].astype(np.int8) * 2
        + above[1:, :-1].astype(np.int8)
    )
    cell_rows, cell_cols = np.nonzero((case != 0) & (case != 15))
    height = rows  # north of row 0's centre is `rows - 0.5`

    def edge_key(r: int, c: int, edge: int) -> tuple[int, int, int]:
        # Horizontal edges between (r, c) and (r, c + 1); vertical between (r, c) and (r + 1, c).
        if edge == 0:
            return (0, r, c)
        if edge == 2:
            return (0, r + 1, c)
        if edge == 3:
            return (1, r, c)
        return (1, r, c + 1)

    def edge_point(key: tuple[int, int, int]) -> tuple[float, float]:
        kind, r, c = key
        if kind == 0:
            a, b = float(values[r, c]), float(values[r, c + 1])
            t = 0.5 if a == b else (level - a) / (b - a)
            return (c + 0.5 + t, height - (r + 0.5))
        a, b = float(values[r, c]), float(values[r + 1, c])
        t = 0.5 if a == b else (level - a) / (b - a)
        return (c + 0.5, height - (r + 0.5 + t))

    neighbours: dict[tuple[int, int, int], list[tuple[int, int, int]]] = {}
    for r, c in zip(cell_rows.tolist(), cell_cols.tolist()):
        for first, second in _SEGMENTS[int(case[r, c])]:
            a, b = edge_key(r, c, first), edge_key(r, c, second)
            neighbours.setdefault(a, []).append(b)
            neighbours.setdefault(b, []).append(a)

    lines: list[list[tuple[float, float]]] = []
    unvisited = set(neighbours)

    def walk(start: tuple[int, int, int]) -> list[tuple[int, int, int]]:
        path = [start]
        unvisited.discard(start)
        previous, current = None, start
        while True:
            onward = [n for n in neighbours[current] if n != previous and (n in unvisited or n == start)]
            if not onward:
                return path
            following = onward[0]
            if following == start:
                path.append(start)
                return path
            path.append(following)
            unvisited.discard(following)
            previous, current = current, following

    # Open lines first, from their ends, so none is walked from its middle.
    for key in [k for k, v in neighbours.items() if len(v) == 1]:
        if key in unvisited:
            lines.append([edge_point(k) for k in walk(key)])
    while unvisited:
        lines.append([edge_point(k) for k in walk(next(iter(unvisited)))])
    return lines


def _length(line: list[tuple[float, float]]) -> float:
    return sum(math.dist(a, b) for a, b in zip(line, line[1:]))


def contours(ground: np.ndarray) -> list[dict]:
    """Every contour worth drawing: smoothed, at whole metres, long enough, simplified."""
    smooth = ndimage.gaussian_filter(ground.astype(np.float64), sigma=CONTOUR_SMOOTHING_SIGMA_M, mode="nearest")
    low = math.ceil(float(smooth.min()) / CONTOUR_INTERVAL_M) * CONTOUR_INTERVAL_M
    high = math.floor(float(smooth.max()) / CONTOUR_INTERVAL_M) * CONTOUR_INTERVAL_M
    features: list[dict] = []
    level = low
    while level <= high + 1e-9:
        for line in contour_level(smooth, level):
            if _length(line) < CONTOUR_MIN_LENGTH_M:
                continue
            simple = simplify(line, CONTOUR_SIMPLIFY_M)
            features.append(
                {
                    "m": round(level, 2),
                    "major": abs(level / CONTOUR_MAJOR_EVERY_M - round(level / CONTOUR_MAJOR_EVERY_M)) < 1e-9,
                    "c": [[round(e, 1), round(n, 1)] for e, n in simple],
                }
            )
        level += CONTOUR_INTERVAL_M
    return features


# --- spot heights -----------------------------------------------------------


def road_mask(roads: list[dict], rows: int, cols: int) -> np.ndarray:
    """Road corridors, even-odd, from map geometry already in local metres."""
    mask = np.zeros((rows, cols), dtype=bool)
    ys = rows - (np.arange(rows) + 0.5)
    xs = np.arange(cols) + 0.5
    for road in roads:
        for ring in road.get("c", []):
            points = np.asarray(ring, dtype=np.float64)
            if len(points) < 3:
                continue
            c0 = max(int(np.floor(points[:, 0].min())), 0)
            c1 = min(int(np.ceil(points[:, 0].max())), cols - 1)
            r0 = max(int(np.floor(rows - points[:, 1].max())), 0)
            r1 = min(int(np.ceil(rows - points[:, 1].min())), rows - 1)
            if c0 > c1 or r0 > r1:
                continue
            xx, yy = np.meshgrid(xs[c0 : c1 + 1], ys[r0 : r1 + 1])
            inside = np.zeros(xx.shape, dtype=bool)
            closed = np.vstack([points, points[:1]])
            for (ax, ay), (bx, by) in zip(closed[:-1], closed[1:]):
                if ay == by:
                    continue
                with np.errstate(invalid="ignore", divide="ignore"):
                    boundary = (bx - ax) * (yy - ay) / (by - ay) + ax
                inside ^= ((ay > yy) != (by > yy)) & (xx < boundary)
            mask[r0 : r1 + 1, c0 : c1 + 1] |= inside
    return mask


def spot_heights(
    ground: np.ndarray,
    measured: np.ndarray,
    buildings: np.ndarray,
    roads: np.ndarray,
    *,
    origin: tuple[int, int] = (0, 0),
    grid_rows: int | None = None,
    squares: list[tuple[int, int]] | None = None,
) -> list[dict]:
    """Up to three candidates per 80 m square, with stable ids and a priority.

    The arrays may be one block of a larger grid: `origin` is the block's
    (row, column) in that grid, `grid_rows` the grid's height (for northing),
    and `squares` the (tx, ty) squares of the grid to answer for. Ids and
    coordinates are the whole grid's, so a square gets the same id whichever
    block it was computed in.
    """
    if not (ground.shape == measured.shape == buildings.shape == roads.shape):
        raise TerrainMarksError("the ground, measured, building and road grids are not the same shape")
    rows, cols = ground.shape
    row0, col0 = origin
    total_rows = rows if grid_rows is None else grid_rows
    coverage = ndimage.uniform_filter(measured.astype(np.float64), size=SPOT_COVERAGE_WINDOW_M, mode="nearest")
    usable = ~buildings & ~roads & (coverage >= SPOT_MIN_MEASURED)
    usable = ndimage.binary_erosion(usable, structure=np.ones((SPOT_EROSION_CELLS, SPOT_EROSION_CELLS), dtype=bool))

    if squares is None:
        squares = [
            (tx, ty)
            for ty in range(math.ceil(rows / SPOT_TILE_M))
            for tx in range(math.ceil(cols / SPOT_TILE_M))
        ]

    points: list[dict] = []
    for tx, ty in squares:
        r0, c0 = ty * SPOT_TILE_M - row0, tx * SPOT_TILE_M - col0
        lo_r, lo_c = max(r0, 0), max(c0, 0)
        block = usable[lo_r : r0 + SPOT_TILE_M, lo_c : c0 + SPOT_TILE_M]
        cell_r, cell_c = np.nonzero(block)
        if cell_r.size < 3:
            continue
        cell_r, cell_c = cell_r + lo_r, cell_c + lo_c
        heights = ground[cell_r, cell_c].astype(np.float64)
        priority = coverage[cell_r, cell_c]
        first, second = np.percentile(heights, [100 / 3, 200 / 3])
        bands = (heights <= first, (heights > first) & (heights <= second), heights > second)
        taken: set[float] = set()
        for tier, band in zip(TIERS, bands):
            index = np.nonzero(band)[0]
            if index.size == 0:
                continue
            median = float(np.median(heights[index]))
            # Most measured first; then nearest the band's middle height; then north-west.
            order = np.lexsort((cell_c[index], cell_r[index], np.abs(heights[index] - median), -priority[index]))
            best = index[order[0]]
            rounded = round(float(heights[best]) / SPOT_ROUNDING_M) * SPOT_ROUNDING_M
            if rounded in taken:
                continue
            taken.add(rounded)
            row, col = int(row0 + cell_r[best]), int(col0 + cell_c[best])
            points.append(
                {
                    "id": f"sp-{tx:03d}-{ty:03d}-{tier}",
                    "tier": tier,
                    "e": col + 0.5,
                    "n": total_rows - (row + 0.5),
                    "heightM": rounded,
                    "priority": round(float(priority[best]), 3),
                }
            )
    return points


# --- writing ----------------------------------------------------------------


def write(out_dir: Path, *, ground: np.ndarray, measured: np.ndarray, buildings: np.ndarray, roads: np.ndarray, extent: dict) -> tuple[dict, dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    lines = contours(ground)
    spots = spot_heights(ground, measured, buildings, roads)
    contour_artefact = {
        "artefact": "terrain-contours",
        "version": 1,
        "basis": "derived",
        "note": (
            "Contours of the estimated ground surface at whole metres AHD, drawn from a lightly "
            "smoothed surface. They show ground shape, not water depth."
        ),
        "extent": extent,
        "coordinates": "Metres east and north of the extent's south-west corner.",
        "settings": {
            "intervalM": CONTOUR_INTERVAL_M,
            "majorEveryM": CONTOUR_MAJOR_EVERY_M,
            "smoothingSigmaM": CONTOUR_SMOOTHING_SIGMA_M,
            "minLengthM": CONTOUR_MIN_LENGTH_M,
            "simplifyM": CONTOUR_SIMPLIFY_M,
        },
        "lines": lines,
    }
    spot_artefact = {
        "artefact": "spot-heights",
        "version": 1,
        "basis": "derived",
        "note": (
            "Fixed candidates with stable ids, tiers a/b/c for the low, middle and high third of "
            "each square's usable ground. The map chooses by priority within screen cells and "
            "resolves collisions on screen only; it never re-selects by what is in view."
        ),
        "extent": extent,
        "coordinates": "Metres east and north of the extent's south-west corner.",
        "settings": {
            "tileM": SPOT_TILE_M,
            "coverageWindowM": SPOT_COVERAGE_WINDOW_M,
            "minMeasuredCoverage": SPOT_MIN_MEASURED,
            "erosionCells": SPOT_EROSION_CELLS,
            "roundingM": SPOT_ROUNDING_M,
        },
        "points": spots,
    }
    for name, artefact in (("terrain-contours.json", contour_artefact), ("spot-heights.json", spot_artefact)):
        (out_dir / name).write_bytes((json.dumps(artefact, separators=(",", ":")) + "\n").encode("utf-8"))
    return contour_artefact, spot_artefact


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.terrain_marks",
        description="Write the contours and spot-height candidates the Terrain layer draws.",
    )
    parser.add_argument("--terrain", type=Path, default=Path("../data/terrain"))
    parser.add_argument("--map", type=Path, default=Path("../apps/web/public/data/map.json"))
    parser.add_argument("--out", type=Path, default=Path("../apps/web/public/data/terrain"))
    args = parser.parse_args(argv)

    manifest = json.loads((args.terrain / "terrain.json").read_text(encoding="utf-8"))
    box = manifest["extent"]
    extent = {
        "name": box["name"],
        "min_e": box["min_e"],
        "min_n": box["min_n"],
        "width_m": box["max_e"] - box["min_e"],
        "height_m": box["max_n"] - box["min_n"],
    }
    ground = np.load(args.terrain / "ground-surface.npy")
    measured = np.load(args.terrain / "ground-observed.npy")
    buildings_path = args.terrain / "barriers.npy"
    buildings = np.load(buildings_path) if buildings_path.exists() else np.zeros(ground.shape, dtype=bool)
    geometry = json.loads(args.map.read_text(encoding="utf-8"))
    if geometry.get("extent", {}).get("min_e") != extent["min_e"] or geometry.get("extent", {}).get("min_n") != extent["min_n"]:
        print("the map geometry is not in the terrain's frame, so its roads would be masked in the wrong place", file=sys.stderr)
        return 1
    roads = road_mask(geometry.get("layers", {}).get("road", []), *ground.shape)

    try:
        lines, spots = write(args.out, ground=ground, measured=measured, buildings=buildings, roads=roads, extent=extent)
    except TerrainMarksError as error:
        print(str(error), file=sys.stderr)
        return 1

    majors = sum(1 for line in lines["lines"] if line["major"])
    tiles = len({p["id"][:10] for p in spots["points"]})
    print(f"wrote {args.out}")
    print(f"  contours       {len(lines['lines']):>6,} lines, {majors:,} of them major")
    print(f"  spot heights   {len(spots['points']):>6,} candidates over {tiles:,} squares")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
