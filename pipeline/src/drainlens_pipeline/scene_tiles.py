"""The scenario engine's terrain for the whole council, in 500 m tiles.

`scene.py` packs one square kilometre, Kensington, and the browser loads all of
it. The council's measured ground is 211 point-cloud tiles and about fifty
square kilometres; packed the same way that is 380 MB, which no browser should
be asked for. So it is cut on the point cloud's own 500 m grid, and the browser
fetches the **four tiles around the drain somebody chose** and stitches them
into a one-kilometre window — the same window size every measurement of this
model was made on.

**The tiles are cut from one council-wide build, not built separately.** The
flow directions, the conditioned surface and the depressions all come from the
terrain run over the whole extent, so the ground either side of a tile edge is
the same ground in both tiles. What the window does change is where water
stops being followed: at its edge, water leaves, as it always did at
Kensington's.

Each tile directory holds the arrays the engine needs, gzipped, plus a
`tile.json` with the depressions and drains inside it in **council grid**
coordinates. `index.json` says which tiles exist and, for every inlet, which
window it is calculated in — or that it has none. That list is also what the
map uses to mark which drains support a scenario before anybody chooses one.

    python -m drainlens_pipeline.scene_tiles --terrain ../data/terrain-council \\
        --map ../apps/api/data/city-of-melbourne/map.json \\
        --out ../apps/web/public/data/scene-tiles
"""

from __future__ import annotations

import gzip
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .geo import CITY_OF_MELBOURNE, TILE_ORIGIN_E, TILE_ORIGIN_N, TILE_SIZE_M, Extent, tile_name
from .scene import DRAIN_SNAP_M, ELEVATION_SCALE, NO_DEPRESSION, SceneError, quantise_elevation, snap_to_flow

#: Tiles along each side of a calculation window. Two 500 m tiles: one kilometre.
WINDOW_TILES = 2

#: Written into `index.json` so the browser can refuse a pack it does not understand.
VERSION = 1


@dataclass(frozen=True)
class TileGrid:
    """Where the 500 m tiles sit on an extent's cell grid, north-up."""

    extent: Extent
    cell_size_m: float = 1.0

    @property
    def rows(self) -> int:
        return int(round(self.extent.height_m / self.cell_size_m))

    @property
    def cols(self) -> int:
        return int(round(self.extent.width_m / self.cell_size_m))

    @property
    def tile_cells(self) -> int:
        return int(round(TILE_SIZE_M / self.cell_size_m))

    def origin_of(self, tx: int, ty: int) -> tuple[int, int]:
        """The tile's north-west cell, as (row, col) on the extent grid."""
        col = int(round((TILE_ORIGIN_E + tx * TILE_SIZE_M - self.extent.min_e) / self.cell_size_m))
        top_n = TILE_ORIGIN_N + (ty + 1) * TILE_SIZE_M
        row = int(round((self.extent.max_n - top_n) / self.cell_size_m))
        return row, col

    def tile_of_cell(self, row: int, col: int) -> tuple[int, int]:
        easting = self.extent.min_e + (col + 0.5) * self.cell_size_m
        northing = self.extent.max_n - (row + 0.5) * self.cell_size_m
        return (
            int(np.floor((easting - TILE_ORIGIN_E) / TILE_SIZE_M)),
            int(np.floor((northing - TILE_ORIGIN_N) / TILE_SIZE_M)),
        )


def window_for(
    easting: float, northing: float, present: set[tuple[int, int]]
) -> tuple[int, int] | None:
    """The south-west tile of the window a point is calculated in, or None.

    Preferred: the window whose **central quadrant** holds the point, so there
    is at least 250 m of ground on every side of the drain before water leaves
    the calculation. Otherwise any other window of four present tiles that
    contains it, nearest-centred first. None when no window of four exists —
    a drain beside a tile the archive does not have.
    """
    fx = (easting - TILE_ORIGIN_E) / TILE_SIZE_M
    fy = (northing - TILE_ORIGIN_N) / TILE_SIZE_M
    candidates = []
    for dx in (0, -1):
        for dy in (0, -1):
            tx, ty = int(np.floor(fx)) + dx, int(np.floor(fy)) + dy
            centre_x, centre_y = tx + WINDOW_TILES / 2, ty + WINDOW_TILES / 2
            candidates.append((abs(fx - centre_x) + abs(fy - centre_y), tx, ty))
    for _, tx, ty in sorted(candidates):
        if all((tx + i, ty + j) in present for i in range(WINDOW_TILES) for j in range(WINDOW_TILES)):
            return tx, ty
    return None


def _gz(array: np.ndarray) -> bytes:
    # mtime fixed so the same array always gives the same bytes: a rebuild that
    # changes nothing should change nothing in git.
    return gzip.compress(np.ascontiguousarray(array).tobytes(), compresslevel=9, mtime=0)


def pack(
    out_dir: Path,
    grid: TileGrid,
    *,
    elevation: np.ndarray,
    direction: np.ndarray,
    labels: np.ndarray,
    rim_depth_cm: np.ndarray,
    observed: np.ndarray,
    valid: np.ndarray | None,
    depressions: list[dict],
    drains: list[dict],
    log=lambda _: None,
) -> dict:
    """Write every present tile and the index. Returns the index."""
    shape = (grid.rows, grid.cols)
    for name, array in (
        ("elevation", elevation),
        ("flow direction", direction),
        ("depression labels", labels),
        ("rim depth", rim_depth_cm),
        ("observed", observed),
    ):
        if array.shape != shape:
            raise SceneError(f"the {name} grid is {array.shape}, not {shape}")
    if len(depressions) > np.iinfo(np.int16).max:
        raise SceneError(f"{len(depressions)} depressions do not fit the int16 label raster")

    quantised = quantise_elevation(elevation)
    by_id = {d["id"]: d for d in depressions}
    size = grid.tile_cells

    tiles: list[dict] = []
    present: set[tuple[int, int]] = set()
    for tx, ty in grid.extent.tiles():
        row0, col0 = grid.origin_of(tx, ty)
        if row0 < 0 or col0 < 0 or row0 + size > grid.rows or col0 + size > grid.cols:
            continue
        block = (slice(row0, row0 + size), slice(col0, col0 + size))
        if valid is not None and not valid[block].all():
            # Either wholly a tile the archive has or wholly one it does not;
            # a partial tile would mean the extent is off the tile grid.
            if valid[block].any():
                raise SceneError(f"{tile_name(tx, ty)} is partly measured, so the extent is off the tile grid")
            continue
        present.add((tx, ty))

        name = tile_name(tx, ty)
        directory = out_dir / name
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "elevation.bin.gz").write_bytes(_gz(quantised[block].astype("<i2")))
        (directory / "flow.bin.gz").write_bytes(_gz(direction[block].astype(np.int8)))
        (directory / "depressions.bin.gz").write_bytes(_gz(labels[block].astype("<i2")))
        (directory / "rim-depth.bin.gz").write_bytes(_gz(rim_depth_cm[block].astype("<i2")))
        (directory / "measured.bin.gz").write_bytes(_gz(np.packbits(observed[block])))

        ids = np.unique(labels[block])
        ids = ids[ids != NO_DEPRESSION]
        table = []
        for depression_id in ids.tolist():
            entry = by_id[int(depression_id)]
            spill_row, spill_col = divmod(int(entry["spillCell"]), grid.cols)
            table.append(
                {
                    "id": int(depression_id),
                    "cellCount": int(entry["cellCount"]),
                    "capacityM3": entry["capacityM3"],
                    "spillElevationM": entry["spillElevationM"],
                    "spill": [spill_row, spill_col],
                }
            )
        inside = [
            d
            for d in drains
            if row0 <= d["row"] < row0 + size and col0 <= d["col"] < col0 + size
        ]
        (directory / "tile.json").write_text(
            json.dumps(
                {
                    "tile": name,
                    "origin": [row0, col0],
                    "depressions": table,
                    "drains": [
                        {"assetNumber": d["assetNumber"], "cell": [d["row"], d["col"]], "isInlet": d["isInlet"]}
                        for d in inside
                    ],
                },
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )
        tiles.append({"tile": name, "tx": tx, "ty": ty, "origin": [row0, col0]})

    windows: dict[str, list[int]] = {}
    without: list[str] = []
    for drain in drains:
        if not drain["isInlet"]:
            continue
        easting = grid.extent.min_e + (drain["col"] + 0.5) * grid.cell_size_m
        northing = grid.extent.max_n - (drain["row"] + 0.5) * grid.cell_size_m
        chosen = window_for(easting, northing, present)
        if chosen is None:
            without.append(drain["assetNumber"])
            continue
        windows[drain["assetNumber"]] = [chosen[0], chosen[1]]
    log(f"  {len(tiles)} tiles, {len(windows):,} inlets with a window, {len(without):,} without")

    index = {
        "artefact": "scene-tiles",
        "version": VERSION,
        "extent": {
            "name": grid.extent.name,
            "min_e": grid.extent.min_e,
            "min_n": grid.extent.min_n,
            "width_m": grid.extent.width_m,
            "height_m": grid.extent.height_m,
        },
        "grid": {"rows": grid.rows, "cols": grid.cols, "cellSizeM": grid.cell_size_m, "origin": "north-west"},
        "tileGrid": {"originE": TILE_ORIGIN_E, "originN": TILE_ORIGIN_N, "sizeM": TILE_SIZE_M, "cells": size},
        "window": {"tiles": WINDOW_TILES},
        "arrays": {
            "elevation": {"file": "elevation.bin.gz", "type": "int16", "unit": "centimetres", "scale": ELEVATION_SCALE},
            "flow": {"file": "flow.bin.gz", "type": "int8"},
            "depressions": {"file": "depressions.bin.gz", "type": "int16"},
            "rim-depth": {"file": "rim-depth.bin.gz", "type": "int16", "unit": "centimetres", "scale": ELEVATION_SCALE},
            "measured": {"file": "measured.bin.gz", "type": "bitmask"},
        },
        "tiles": tiles,
        "windows": windows,
        # Inlets with no window of four measured tiles. Listed rather than left
        # out, so "no ground to calculate over" and "not an inlet" stay two
        # different answers -- AC 3.1.4.b asks for the reason, not a refusal.
        "inletsWithoutWindow": sorted(without),
        "note": (
            "Cut from one council-wide terrain build. Elevation is the conditioned surface, "
            "because the flow field belongs to it; rim depth is measured on the raw surface. "
            "Depression and drain cells in tile.json are council grid (row, col). A window is "
            "two tiles by two, and an inlet listed in `windows` is calculated in the window "
            "whose south-west tile is given. An inlet not listed has no window of four measured "
            "tiles around it, and no scenario is calculated for it."
        ),
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.json").write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
    return index


def drains_on_grid(pits: list[dict], grid: TileGrid, accumulation: np.ndarray | None) -> list[dict]:
    """Every pit on the extent grid, snapped onto its flow path, with (row, col)."""
    found = []
    for pit in pits:
        position = pit.get("c")
        if not position or len(position) != 2:
            continue
        col = int(position[0] // grid.cell_size_m)
        row = grid.rows - 1 - int(position[1] // grid.cell_size_m)
        if not (0 <= row < grid.rows and 0 <= col < grid.cols):
            continue
        cell = row * grid.cols + col
        if accumulation is not None:
            cell = snap_to_flow(cell, accumulation, DRAIN_SNAP_M, grid.cell_size_m)
        description = str(pit.get("asset_description") or "").lower()
        found.append(
            {
                "assetNumber": str(pit.get("asset_number") or ""),
                "row": cell // grid.cols,
                "col": cell % grid.cols,
                # The rule `scene.py` states, so the two packs agree on what an inlet is.
                "isInlet": "entry" in description or "grated" in description,
            }
        )
    return found


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys
    import time

    from .derived import flow_accumulation
    from .hydrology import condition, d8, fill

    parser = argparse.ArgumentParser(prog="python -m drainlens_pipeline.scene_tiles", description=__doc__.splitlines()[0])
    parser.add_argument("--terrain", type=Path, default=Path("../data/terrain-council"))
    parser.add_argument("--map", type=Path, default=Path("../apps/api/data/city-of-melbourne/map.json"))
    parser.add_argument("--out", type=Path, default=Path("../apps/web/public/data/scene-tiles"))
    args = parser.parse_args(argv)

    def log(message: str) -> None:
        print(message, file=sys.stderr, flush=True)

    started = time.perf_counter()
    grid = TileGrid(CITY_OF_MELBOURNE)
    raw = np.load(args.terrain / "ground-surface.npy").astype(np.float64)
    valid_path = args.terrain / "ground-valid.npy"
    valid = np.load(valid_path) if valid_path.exists() else None
    barriers_path = args.terrain / "barriers.npy"
    barriers = np.load(barriers_path) if barriers_path.exists() else None
    direction = np.load(args.terrain / "flow-direction.npy")

    log("Conditioning the council surface")
    elevation = condition(raw, barriers, valid=valid)
    if not np.array_equal(d8(elevation, valid=valid), direction):
        # The pack ships this surface beside that flow field. If they disagree,
        # the engine orders cells by one and routes by the other, and water
        # goes missing -- 71.6% of it, the one time it happened.
        raise SceneError("the conditioned surface does not reproduce the terrain build's flow directions")

    log("Measuring rim depth on the raw surface")
    labels = np.load(args.terrain / "depression-cells.npz")["labels"]
    inside = labels >= 0
    rim = np.zeros(raw.shape, dtype=np.int16)
    rim[inside] = np.round((fill(raw, valid=valid)[inside] - raw[inside]) * ELEVATION_SCALE).astype(np.int16)

    log("Accumulating flow to snap drains onto it")
    accumulation = flow_accumulation(direction, elevation)
    pits = json.loads(args.map.read_text(encoding="utf-8")).get("layers", {}).get("pit", [])
    drains = drains_on_grid(pits, grid, accumulation)
    log(f"  {len(drains):,} drains, {sum(d['isInlet'] for d in drains):,} inlets")

    pack(
        args.out,
        grid,
        elevation=elevation,
        direction=direction,
        labels=labels.astype(np.int16),
        rim_depth_cm=rim,
        observed=np.load(args.terrain / "ground-observed.npy"),
        valid=valid,
        depressions=json.loads((args.terrain / "depressions.json").read_text(encoding="utf-8")),
        drains=drains,
        log=log,
    )
    total = sum(p.stat().st_size for p in args.out.rglob("*") if p.is_file())
    log(f"  written to {args.out}: {total / 1e6:.1f} MB in {time.perf_counter() - started:.0f} s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
