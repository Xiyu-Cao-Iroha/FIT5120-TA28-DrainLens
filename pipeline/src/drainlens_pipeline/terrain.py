"""Build the ground-surface artefact for an extent.

Reads the LAS tiles covering the extent, filters them to ground, and writes the
surface with a manifest describing how it was made and what is wrong with it.

The manifest is not documentation. §5.5 of the architecture requires every
value the interface shows to carry a basis, and the basis for anything derived
from terrain is this file. A surface published without it cannot be displayed,
because there would be nothing truthful to say about where it came from.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np

from .geo import DEMONSTRATION_EXTENT, Extent
from .ground import (
    DEFAULT_MAX_WINDOW_M,
    DEFAULT_SLOPE_THRESHOLD,
    GroundSurface,
    build_ground_surface,
)
from .las import read_file

CELL_SIZE_M = 1.0
# The filter owns these. The build only records which values it used, so the
# manifest and the code cannot disagree about how a surface was made.
MAX_WINDOW_M = DEFAULT_MAX_WINDOW_M
SLOPE_THRESHOLD = DEFAULT_SLOPE_THRESHOLD

#: The source, as the City of Melbourne publishes it.
SOURCE = {
    "dataset": "City of Melbourne 3D Point Cloud 2018",
    "publisher": "City of Melbourne Open Data Portal",
    "licence": "CC BY 4.0",
    "crs": "EPSG:28355 (MGA Zone 55)",
    "vertical_datum": "AHD",
}

#: Wording the interface may use, and the limitation it must carry with it.
#: D2 established the cloud is photogrammetric — every point comes from imagery
#: matched between overlapping photographs, so where a camera cannot see the
#: ground there is no ground point to keep, only an absence.
DERIVATION_NOTE = (
    "Ground surface derived from the City of Melbourne 2018 photogrammetric point cloud "
    "by morphological filtering. This is not a LiDAR terrain model: the source is imagery, "
    "so ground beneath dense tree canopy was never observed and is interpolated from the "
    "nearest measured ground. Streets and open ground, which is where this model routes "
    "water, are observed directly."
)


@dataclass(frozen=True)
class TerrainBuild:
    surface: GroundSurface
    extent: Extent
    tiles: list[str]
    point_count: int
    seconds: float

    def manifest(self) -> dict:
        rows, cols = self.surface.shape
        elevation = self.surface.elevation
        return {
            "artefact": "ground-surface",
            "version": 1,
            "extent": {
                "name": self.extent.name,
                "min_e": self.extent.min_e,
                "min_n": self.extent.min_n,
                "max_e": self.extent.max_e,
                "max_n": self.extent.max_n,
            },
            "grid": {"rows": rows, "cols": cols, "cell_size_m": CELL_SIZE_M, "origin": "north-west"},
            "source": SOURCE,
            "tiles": self.tiles,
            "points_read": self.point_count,
            "filter": {
                "method": "simple morphological filter (Pingel, Clarke and McBride, 2013)",
                "implementation": "drainlens_pipeline.ground",
                "max_window_m": MAX_WINDOW_M,
                "slope_threshold": SLOPE_THRESHOLD,
            },
            "coverage": {
                "measured_fraction": round(1.0 - self.surface.filled_fraction, 4),
                "interpolated_fraction": round(self.surface.filled_fraction, 4),
            },
            "elevation_m": {
                "min": round(float(elevation.min()), 3),
                "max": round(float(elevation.max()), 3),
                "mean": round(float(elevation.mean()), 3),
            },
            "derivation_note": DERIVATION_NOTE,
            "build_seconds": round(self.seconds, 1),
        }


def load_tiles(
    tile_dir: Path, extent: Extent, log: Callable[[str], None] = lambda _: None
) -> tuple[np.ndarray, list[str]]:
    """Read every tile covering the extent, as one array of points."""
    names = extent.tile_names()
    missing = [n for n in names if not (tile_dir / f"{n}.las").exists()]
    if missing:
        raise FileNotFoundError(
            f"{tile_dir} is missing {', '.join(missing)}. Run `python -m drainlens_pipeline.fetch_tiles` first."
        )

    chunks = []
    for name in names:
        header, xyz = read_file(tile_dir / f"{name}.las")
        log(f"  {name}  {header.point_count:>9,} points  Z {header.min_z:.2f}..{header.max_z:.2f}")
        chunks.append(xyz)
    return np.concatenate(chunks), names


def build(
    tile_dir: Path, extent: Extent = DEMONSTRATION_EXTENT, log: Callable[[str], None] = lambda _: None
) -> TerrainBuild:
    started = time.perf_counter()
    log(f"Reading tiles for {extent.name} ({extent.width_m:.0f} x {extent.height_m:.0f} m)")
    points, names = load_tiles(tile_dir, extent, log)
    log(f"  {len(points):,} points in total")

    log(f"Filtering to ground at {CELL_SIZE_M:.0f} m, window {MAX_WINDOW_M:.0f} m, slope {SLOPE_THRESHOLD:.0%}")
    surface = build_ground_surface(
        points,
        extent.min_e,
        extent.min_n,
        extent.max_e,
        extent.max_n,
        cell_size_m=CELL_SIZE_M,
        max_window_m=MAX_WINDOW_M,
        slope_threshold=SLOPE_THRESHOLD,
    )
    return TerrainBuild(surface, extent, names, len(points), time.perf_counter() - started)


def write(result: TerrainBuild, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    np.save(out_dir / "ground-surface.npy", result.surface.elevation.astype(np.float32))
    np.save(out_dir / "ground-observed.npy", result.surface.observed)
    (out_dir / "terrain.json").write_text(
        json.dumps(result.manifest(), indent=2) + "\n", encoding="utf-8"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.terrain",
        description="Build the ground-surface artefact from the point-cloud tiles.",
    )
    parser.add_argument("--tiles", type=Path, default=Path("../data/pointcloud"))
    parser.add_argument("--out", type=Path, default=Path("../data/terrain"))
    parser.add_argument(
        "--extent",
        nargs=4,
        type=float,
        metavar=("MIN_E", "MIN_N", "MAX_E", "MAX_N"),
        help="MGA55 bounds; defaults to the Iteration 1 demonstration extent",
    )
    args = parser.parse_args(argv)

    extent = Extent("custom", *args.extent) if args.extent else DEMONSTRATION_EXTENT

    def log(message: str) -> None:
        print(message, file=sys.stderr)

    result = build(args.tiles, extent, log=log)
    write(result, args.out)

    surface = result.surface
    log("")
    log(f"  grid            {surface.shape[0]} x {surface.shape[1]} cells")
    log(f"  elevation       {surface.elevation.min():.2f} to {surface.elevation.max():.2f} m AHD")
    log(f"  measured        {1 - surface.filled_fraction:.1%} of cells")
    log(f"  interpolated    {surface.filled_fraction:.1%} — buildings, canopy, and gaps")
    log(f"  built in        {result.seconds:.1f} s")
    log(f"  written to      {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
