"""Where a low area is deep enough to warn about, as points the map can mark.

The industry mentor asked for a warning sign on *especially* deep low areas:
tap it, read that water collects there easily and not to park there when heavy
rain is coming. The low-area outlines in `derived.json` carry no depth, so the
depth comes from the terrain build that found them — each hollow's spill level
from `depressions.json`, and its floor from the raw ground surface under the
`depression-cells` labels. Depth is the spill level minus the lowest cell: how
much water the hollow holds at its deepest point before it overflows.

**One point per qualifying hollow, at its deepest cell**, in the extent's own
frame. The browser draws the sign there, so the mark sits where the water would
be deepest rather than at the middle of an outline that may be L-shaped.

Written as its own small artefact rather than into `derived.json`, because the
council copy of that file is loaded into the database and served by the API,
which only serves the four artefacts it knows. This one is a static file the
site fetches for itself, named by extent:

    python -m drainlens_pipeline.low_area_warnings --terrain ../data/terrain \\
        --out ../apps/web/public/data/warnings/kensington.json
    python -m drainlens_pipeline.low_area_warnings --terrain ../data/terrain-council \\
        --extent city-of-melbourne --out ../apps/web/public/data/warnings/city-of-melbourne.json
"""

from __future__ import annotations

import numpy as np

from .derived import MIN_DRAWN_DEPRESSION_M2
from .geo import Extent
from .hydrology import MIN_DEPRESSION_DEPTH_M

#: Shallowest hollow that gets a warning, in metres below its spill level.
#:
#: **Chosen from the distribution of the drawn low areas**, the hollows of at
#: least `MIN_DRAWN_DEPRESSION_M2` that the map already outlines. Measured on
#: the terrain builds of 13 September (Kensington's 273 drawn, the council's
#: 12,791):
#:
#: ============  ==========  ==========
#: depth         Kensington  council
#: ============  ==========  ==========
#: median          0.35 m      0.35 m
#: 90th pct        0.67 m      0.80 m
#: 95th pct        0.91 m      1.37 m
#: 99th pct        1.72 m      3.99 m
#: >= 0.75 m      21 (7.7%)  1,400 (10.9%)
#: >= 1.00 m      11 (4.0%)    953 (7.5%)
#: >= 1.50 m       4 (1.5%)    560 (4.4%)
#: ============  ==========  ==========
#:
#: One metre is four times the 25 cm accuracy the point cloud is quoted at
#: (`MIN_DEPRESSION_DEPTH_M`), so a hollow at the threshold is still half a
#: metre deep if both its rim and its floor are wrong by the whole error in the
#: direction that flatters it. It is Kensington's top 4% and about the
#: council's top 6%: the council's tail is longer because it holds the cuttings,
#: docks and underpasses a residential square kilometre does not. 0.75 m marked
#: one drawn hollow in nine over the council, which is a texture rather than a
#: warning; 1.5 m left Kensington with four, the nearest 319 m from the guide's
#: address.
WARN_MIN_DEPTH_M = 1.0

#: Smallest hollow that gets a warning, in square metres.
#:
#: The sentence is about parking, so a hollow has to be somewhere a car could
#: be: 100 m² is ten metres square, a handful of spaces. Below it sit 189 of
#: the council's deep hollows, some of them shafts rather than hollows — up to
#: 9.0 m deep in under 50 m², which is not a place anyone parks. It takes the
#: council from 953 warnings to 764 and removes none in Kensington, whose deep
#: hollows are all larger than this.
WARN_MIN_AREA_M2 = 100.0


class WarningError(Exception):
    pass


def deepest_cells(
    labels: np.ndarray, elevation: np.ndarray, count: int
) -> tuple[np.ndarray, np.ndarray]:
    """The lowest elevation in each hollow, and the flat index of the cell holding it.

    Indexed by depression id, `0..count-1`, the order `depressions.json` is
    written in. Ties go to the first cell in row-major order, so the same
    surface always puts the mark on the same cell.

    One sort over the labelled cells rather than a pass per hollow: the council
    has 21,313 of them over 76.5 million cells.
    """
    if labels.shape != elevation.shape:
        raise WarningError(
            f"the depression labels are {labels.shape} but the surface is {elevation.shape}"
        )
    flat = labels.ravel()
    cells = np.flatnonzero(flat >= 0)
    ids = flat[cells].astype(np.int64)
    if ids.size and int(ids.max()) >= count:
        raise WarningError(
            f"the labels name depression {int(ids.max())} and the table has {count}"
        )
    heights = np.asarray(elevation).ravel()[cells].astype(np.float64)

    order = np.lexsort((cells, heights, ids))
    sorted_ids = ids[order]
    first = np.r_[0, np.flatnonzero(np.diff(sorted_ids)) + 1] if sorted_ids.size else np.array([], dtype=np.int64)

    lowest = np.full(count, np.nan)
    at = np.full(count, -1, dtype=np.int64)
    lowest[sorted_ids[first]] = heights[order][first]
    at[sorted_ids[first]] = cells[order][first]
    if (at < 0).any():
        missing = int(np.flatnonzero(at < 0)[0])
        raise WarningError(f"depression {missing} has no cells in the label raster")
    return lowest, at


def warning_points(
    extent: Extent,
    cell_size_m: float,
    *,
    labels: np.ndarray,
    elevation: np.ndarray,
    depressions: list[dict],
    min_depth_m: float = WARN_MIN_DEPTH_M,
    min_area_m2: float = WARN_MIN_AREA_M2,
) -> list[dict]:
    """The deepest cell of every hollow deep and large enough, in the extent's frame.

    Only hollows the map draws can qualify. A warning on a hollow with no
    outline around it would be a sign pointing at nothing the map explains.
    """
    for index, row in enumerate(depressions):
        if row.get("id") != index:
            raise WarningError(
                f"depressions.json row {index} has id {row.get('id')}; the labels index the table by position"
            )
    if min_area_m2 < MIN_DRAWN_DEPRESSION_M2:
        raise WarningError(
            f"a {min_area_m2} m² hollow is not drawn at all (the map starts at {MIN_DRAWN_DEPRESSION_M2} m²)"
        )

    lowest, at = deepest_cells(labels, elevation, len(depressions))
    rows, cols = labels.shape
    points = []
    for index, row in enumerate(depressions):
        area = row["cellCount"] * cell_size_m**2
        depth = row["spillElevationM"] - lowest[index]
        if area < min_area_m2 or depth < min_depth_m:
            continue
        r, c = divmod(int(at[index]), cols)
        points.append(
            {
                "c": [round((c + 0.5) * cell_size_m, 1), round((rows - 1 - r + 0.5) * cell_size_m, 1)],
                "depthM": round(float(depth), 2),
                "areaM2": round(float(area)),
            }
        )
    return points


def build(
    extent: Extent,
    cell_size_m: float,
    *,
    labels: np.ndarray,
    elevation: np.ndarray,
    depressions: list[dict],
) -> dict:
    """The artefact the site loads, for one extent."""
    rows, cols = labels.shape
    if abs(cols * cell_size_m - extent.width_m) > 1e-6 or abs(rows * cell_size_m - extent.height_m) > 1e-6:
        raise WarningError(
            f"the grid is {cols} x {rows} cells and {extent.name} is "
            f"{extent.width_m:.0f} x {extent.height_m:.0f} m; this terrain is not that extent's"
        )
    points = warning_points(
        extent, cell_size_m, labels=labels, elevation=elevation, depressions=depressions
    )
    drawn = sum(1 for d in depressions if d["cellCount"] * cell_size_m**2 >= MIN_DRAWN_DEPRESSION_M2)
    return {
        "artefact": "low-area-warnings",
        "version": 1,
        "extent": {"name": extent.name, "width_m": extent.width_m, "height_m": extent.height_m},
        "coordinates": (
            "Metres east and north of the extent's south-west corner, to a decimetre — "
            "the same frame as the map geometry and the derived layers. Each point is the "
            "centre of the deepest cell of its hollow."
        ),
        "basis": "derived",
        "note": (
            "Calculated from a filtered photogrammetric surface, not recorded. Depth is a "
            "hollow's spill level minus its lowest cell, which is how deep it is when full, "
            "not how deep water has been seen there."
        ),
        "settings": {
            "min_depth_m": WARN_MIN_DEPTH_M,
            "min_area_m2": WARN_MIN_AREA_M2,
            "min_drawn_depression_m2": MIN_DRAWN_DEPRESSION_M2,
            "min_depression_depth_m": MIN_DEPRESSION_DEPTH_M,
        },
        "counts": {"hollows": len(depressions), "drawn": drawn, "warnings": len(points)},
        "points": points,
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import json
    import sys
    from pathlib import Path

    from .geo import EXTENTS, resolve_extent

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.low_area_warnings",
        description="Mark the deepest point of each especially deep low area.",
    )
    parser.add_argument("--terrain", type=Path, default=Path("../data/terrain"))
    parser.add_argument("--out", type=Path, default=Path("../apps/web/public/data/warnings/kensington.json"))
    parser.add_argument(
        "--extent",
        choices=sorted(EXTENTS),
        help="a published extent; defaults to the Iteration 1 demonstration extent",
    )
    args = parser.parse_args(argv)

    extent = resolve_extent(args.extent)
    try:
        artefact = build(
            extent,
            1.0,
            labels=np.load(args.terrain / "depression-cells.npz")["labels"],
            # Memory-mapped: the council surface is 306 MB and only the cells in
            # a hollow are read.
            elevation=np.load(args.terrain / "ground-surface.npy", mmap_mode="r"),
            depressions=json.loads((args.terrain / "depressions.json").read_text(encoding="utf-8")),
        )
    except WarningError as error:
        print(f"low_area_warnings: {error}", file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")) + "\n", encoding="utf-8")
    counts = artefact["counts"]
    print(
        f"{extent.name}: {counts['warnings']} warnings from {counts['drawn']} drawn of "
        f"{counts['hollows']} hollows, written to {args.out}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
