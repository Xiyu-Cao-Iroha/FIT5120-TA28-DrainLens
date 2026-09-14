"""Where a low area is deep enough to warn about, as points the map can mark.

The industry mentor asked for a warning sign on *especially* deep low areas:
tap it, read that water collects there easily and not to park there when heavy
rain is coming. The low-area outlines in `derived.json` carry no depth, so the
depth comes from the terrain build that found them — each hollow's spill level
from `depressions.json`, and the ground under the `depression-cells` labels.

**One point per qualifying hollow, at its lowest cell on a street**, in the
extent's own frame. The first version put the sign at the hollow's deepest
cell wherever that was, and a live test on 15 September showed what that
means: zoomed into Carlton around 10 Lygon Street, one screen held 22 signs,
most of them in courtyards, backyards, the ground between buildings and cells
beside a footprint. "Don't park your car here" is advice about a street, and a
sign in the middle of a block is advice nobody can take. So a sign now stands
only where the sentence fits:

- **inside a street's road corridor** from the council's road layer in
  `map.json` (`STREET_TYPES`). A corridor runs from property boundary to
  property boundary, so it already holds the footpath and the nature strip; no
  distance is allowed beyond it, because a buffer of even two metres reaches
  over the boundary into front yards and forecourts. Tried at 2 m and 5 m, a
  buffer added 23 and 42 council signs, every one of them off the street;
- **not under a building footprint** (`barriers.npy`), which removes arcades
  and buildings over a corridor;
- **deep where the sign is**: the depth is the spill level minus that street
  cell, not minus the hollow's floor. A hollow three metres deep in a courtyard
  that only laps the kerb by a few centimetres is not a deep spot on the street;
- **one per `WARN_SPACING_M`**, deepest first, so a run of hollows along one
  street reads as one warning rather than a row of them.

Measured on the terrain builds of 13 September, with the worst view found by
sliding a 1080 × 775 pixel map over every mark (`busiest_view`) — 864 × 620 m at
1.25 px/m, where the signs first appear, and 360 × 258 m at 3 px/m, where the
full map opens:

==================================  ==========  =======  ===========  ==========
rule                                Kensington  council  1.25 px/m    3 px/m
==================================  ==========  =======  ===========  ==========
deepest cell anywhere (before)              11      764           59          20
on a street, not a building                  2      186           47          15
... and one per 150 m                        2       91           13           4
==================================  ==========  =======  ===========  ==========

(The two view columns are the council's; Kensington's worst view holds both of
its signs at 1.25 px/m and one at 3.) None of Kensington's 11 old signs was on
a street; of the council's 764, 650 were not and 46 were on a building. A
1.25 px/m view centred on 10 Lygon Street, Carlton goes from 22 signs to 5, and
the 3 px/m view from 1 to 0. Kensington's nearest sign to 46 Gatehouse Drive,
the guide's address, is now 182 m away (18 m east, 181 m north); it was 185 m.

The street rule alone is not enough: the council's worst view still held 47
signs, in the Hoddle Grid, where the lanes between towers hold many small deep
hollows. Raising the thresholds instead was measured and does less for the
density while costing more signs everywhere else: 2 m and 250 m² together
leave 72 signs and still 22 and 6 in the worst views, 1.5 m leaves 115 and 34
and 10, and requiring 50 m² of the hollow to be street leaves 135 and 35 and
10. Spacing addresses density directly, and it only removes a sign within
150 m of a deeper one — the blue outline stays on the map either way.

Written as its own small artefact rather than into `derived.json`, because the
council copy of that file is loaded into the database and served by the API,
which only serves the four artefacts it knows. This one is a static file the
site fetches for itself, named by extent:

    python -m drainlens_pipeline.low_area_warnings --terrain ../data/terrain \\
        --out ../apps/web/public/data/warnings/kensington.json
    python -m drainlens_pipeline.low_area_warnings --terrain ../data/terrain-council \\
        --extent city-of-melbourne --map ../apps/api/data/city-of-melbourne/map.json \\
        --out ../apps/web/public/data/warnings/city-of-melbourne.json
"""

from __future__ import annotations

import numpy as np

from .derived import MIN_DRAWN_DEPRESSION_M2
from .geo import Extent
from .hydrology import MIN_DEPRESSION_DEPTH_M

#: Shallowest spot that gets a warning, in metres below its hollow's spill level.
#:
#: **Chosen from the distribution of the drawn low areas**, the hollows of at
#: least `MIN_DRAWN_DEPRESSION_M2` that the map already outlines. Measured on
#: the terrain builds of 13 September (Kensington's 273 drawn, the council's
#: 12,791), by the depth of the whole hollow:
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
#: (`MIN_DEPRESSION_DEPTH_M`), so a spot at the threshold is still half a
#: metre deep if both its rim and its floor are wrong by the whole error in the
#: direction that flatters it. Kept at 1 m when the signs moved to the street,
#: measured against the spot under the sign rather than the hollow's floor.
#: 0.75 m would give Kensington 6 signs instead of 2, but it is the council's
#: 90th percentile, not an especially deep spot, and it takes the council from
#: 91 signs to 125 and its worst views from 13 and 4 to 15 and 4.
WARN_MIN_DEPTH_M = 1.0

#: Smallest hollow that gets a warning, in square metres.
#:
#: The sentence is about parking, so a hollow has to be somewhere a car could
#: be: 100 m² is ten metres square, a handful of spaces. Below it sit shafts
#: rather than hollows — up to 9.0 m deep in under 50 m². Raising it to 250 m²
#: was measured once the signs were on streets and spaced: 83 council signs
#: instead of 91, and the same worst views, 13 and 4.
WARN_MIN_AREA_M2 = 100.0

#: Closest two signs may stand, in metres. The deeper one keeps its sign.
#:
#: 150 m is under the long side of a Hoddle Grid block. At 3 px/m, where the
#: full map opens, it is 450 pixels, and it brings the council's worst
#: street-level view from 15 signs to 4 and its worst 1.25 px/m view from 47 to
#: 13. Measured either side, as (signs, worst at 1.25, worst at 3):
#:
#: =======  ============
#: spacing  council
#: =======  ============
#: 100 m    120, 23, 7
#: 150 m     91, 13, 4
#: 200 m     81, 10, 3
#: 250 m     72,  7, 3
#: =======  ============
#:
#: 100 m leaves seven at street level, more than a handful. Past 150 m the
#: street-level view gains one sign at most, and what the wider spacing buys is
#: fewer signs on the zoomed-out view by hiding deep street spots up to 250 m
#: from a deeper one — a whole block with a hollow the sign no longer points at.
WARN_SPACING_M = 150.0

#: Road-corridor classes a car is driven and parked in.
#:
#: From the `str_type` of the council's road-corridors dataset. Left out: the
#: freeways and CityLink, where nobody parks; rail and tram reserves, river
#: corridors, leases and reserves, and Parks Victoria land, which are corridors
#: in the dataset but not streets; and the one `Undetermined`. `Private` is in:
#: those are the named private lanes and places a car does use, mapped as
#: corridors, not the inside of a block. Leaving them out would take the
#: council from 91 signs to 85.
STREET_TYPES = (
    "Arterial",
    "Council Major",
    "Council Minor",
    "Port Roads",
    "Private",
    "Proposed Public",
    "Road Safety Act",
)


class WarningError(Exception):
    pass


def street_mask(
    roads: list[dict], rows: int, cols: int, cell_size_m: float = 1.0, types: tuple[str, ...] = STREET_TYPES
) -> np.ndarray:
    """The cells whose centre lies in a street's corridor, north-up.

    Even-odd over **all the rings of one corridor together**, then OR-ed across
    corridors. A corridor's later rings are holes — a traffic island, a
    reserve in the middle of an intersection, 1,832 m² inside Elliott Avenue —
    and filling each ring on its own, as `terrain_marks.road_mask` does for the
    spot heights, would count the island as street.

    Scanlines rather than a point-in-polygon test per cell: that test took 85 s
    over the council's 4,177 corridors, and a sign file is rebuilt more often
    than the terrain.
    """
    mask = np.zeros((rows, cols), dtype=bool)
    wanted = set(types)
    for road in roads:
        if road.get("str_type") not in wanted:
            continue
        rings = [np.asarray(ring, dtype=np.float64) for ring in road.get("c", []) if len(ring) >= 3]
        if not rings:
            continue
        starts = np.vstack(rings)
        ends = np.vstack([np.roll(ring, -1, axis=0) for ring in rings])
        ax, ay, bx, by = starts[:, 0], starts[:, 1], ends[:, 0], ends[:, 1]

        # The rows whose centre, (rows - r - 0.5) cells north, is inside the box.
        r0 = max(int(np.ceil(rows - 0.5 - ay.max() / cell_size_m)), 0)
        r1 = min(int(np.floor(rows - 0.5 - ay.min() / cell_size_m)), rows - 1)
        if r0 > r1:
            continue
        y = (rows - np.arange(r0, r1 + 1) - 0.5)[:, None] * cell_size_m
        straddles = (ay > y) != (by > y)
        with np.errstate(invalid="ignore", divide="ignore"):
            crossing = np.where(straddles, (bx - ax) * (y - ay) / (by - ay) + ax, np.inf)
        crossing.sort(axis=1)
        for offset, count in enumerate(straddles.sum(axis=1)):
            xs = crossing[offset, :count]
            # A centre is inside when an odd number of crossings lie east of
            # it: between the first and second crossing, the third and fourth.
            left = np.clip(np.ceil(xs[0::2] / cell_size_m - 0.5), 0, cols).astype(int)
            right = np.clip(np.ceil(xs[1::2] / cell_size_m - 0.5), 0, cols).astype(int)
            for c0, c1 in zip(left, right):
                mask[r0 + offset, c0:c1] = True
    return mask


def deepest_cells(
    labels: np.ndarray, elevation: np.ndarray, count: int, within: np.ndarray | None = None
) -> tuple[np.ndarray, np.ndarray]:
    """The lowest elevation in each hollow, and the flat index of the cell holding it.

    Indexed by depression id, `0..count-1`, the order `depressions.json` is
    written in. Ties go to the first cell in row-major order, so the same
    surface always puts the mark on the same cell.

    With `within`, only the cells it marks are considered, and a hollow with
    none of them comes back as NaN at index -1 rather than as an error: most
    hollows never touch a street.

    One sort over the labelled cells rather than a pass per hollow: the council
    has 21,313 of them over 76.5 million cells.
    """
    if labels.shape != elevation.shape:
        raise WarningError(
            f"the depression labels are {labels.shape} but the surface is {elevation.shape}"
        )
    if within is not None and within.shape != labels.shape:
        raise WarningError(f"the depression labels are {labels.shape} but the street mask is {within.shape}")
    flat = labels.ravel()
    chosen = flat >= 0
    if within is not None:
        chosen &= within.ravel()
    cells = np.flatnonzero(chosen)
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
    if within is None and (at < 0).any():
        missing = int(np.flatnonzero(at < 0)[0])
        raise WarningError(f"depression {missing} has no cells in the label raster")
    return lowest, at


def space_out(points: list[dict], spacing_m: float) -> list[dict]:
    """Keep the deepest sign in any `spacing_m`, and every sign that is not near a deeper one.

    Greedy, deepest first; equal depths keep the order given, so the same
    candidates always keep the same signs. The kept signs come back in the
    order they were given.
    """
    order = sorted(range(len(points)), key=lambda i: -points[i]["depthM"])
    kept: list[int] = []
    for i in order:
        x, y = points[i]["c"]
        if all((x - points[k]["c"][0]) ** 2 + (y - points[k]["c"][1]) ** 2 >= spacing_m**2 for k in kept):
            kept.append(i)
    return [points[i] for i in sorted(kept)]


def busiest_view(points: list[dict], width_m: float, height_m: float) -> int:
    """The most signs any one `width_m` × `height_m` view can hold.

    A view holding the most can always be slid until a sign is on its western
    edge, so only those edges are tried; for each, a sorted sweep up the
    northings finds the fullest band. Edges count as inside, the way
    `warningsInView` counts a sign on the edge of the canvas.
    """
    if not points:
        return 0
    xy = np.array([p["c"] for p in points], dtype=np.float64)
    best = 0
    for west in np.unique(xy[:, 0]):
        norths = np.sort(xy[(xy[:, 0] >= west) & (xy[:, 0] <= west + width_m), 1])
        if norths.size <= best:
            continue
        held = np.searchsorted(norths, norths + height_m, side="right") - np.arange(norths.size)
        best = max(best, int(held.max()))
    return best


def warning_points(
    extent: Extent,
    cell_size_m: float,
    *,
    labels: np.ndarray,
    elevation: np.ndarray,
    depressions: list[dict],
    streets: np.ndarray,
    buildings: np.ndarray,
    min_depth_m: float = WARN_MIN_DEPTH_M,
    min_area_m2: float = WARN_MIN_AREA_M2,
    spacing_m: float = WARN_SPACING_M,
) -> list[dict]:
    """The lowest street cell of every hollow deep and large enough, spaced out.

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
    if buildings.shape != labels.shape:
        raise WarningError(f"the depression labels are {labels.shape} but the building mask is {buildings.shape}")

    lowest, at = deepest_cells(labels, elevation, len(depressions), within=streets & ~buildings)
    rows, cols = labels.shape
    points = []
    for index, row in enumerate(depressions):
        if at[index] < 0:
            continue
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
    return space_out(points, spacing_m)


def build(
    extent: Extent,
    cell_size_m: float,
    *,
    labels: np.ndarray,
    elevation: np.ndarray,
    depressions: list[dict],
    roads: list[dict],
    buildings: np.ndarray,
) -> dict:
    """The artefact the site loads, for one extent."""
    rows, cols = labels.shape
    if abs(cols * cell_size_m - extent.width_m) > 1e-6 or abs(rows * cell_size_m - extent.height_m) > 1e-6:
        raise WarningError(
            f"the grid is {cols} x {rows} cells and {extent.name} is "
            f"{extent.width_m:.0f} x {extent.height_m:.0f} m; this terrain is not that extent's"
        )
    streets = street_mask(roads, rows, cols, cell_size_m)
    points = warning_points(
        extent,
        cell_size_m,
        labels=labels,
        elevation=elevation,
        depressions=depressions,
        streets=streets,
        buildings=buildings,
    )
    drawn = sum(1 for d in depressions if d["cellCount"] * cell_size_m**2 >= MIN_DRAWN_DEPRESSION_M2)
    return {
        "artefact": "low-area-warnings",
        "version": 1,
        "extent": {"name": extent.name, "width_m": extent.width_m, "height_m": extent.height_m},
        "coordinates": (
            "Metres east and north of the extent's south-west corner, to a decimetre — "
            "the same frame as the map geometry and the derived layers. Each point is the "
            "centre of the lowest cell of its hollow that is inside a street's road corridor "
            "and not under a building."
        ),
        "basis": "derived",
        "note": (
            "Calculated from a filtered photogrammetric surface, not recorded. Depth is a "
            "hollow's spill level minus the ground at the sign, which is how deep it is there "
            "when full, not how deep water has been seen there."
        ),
        "settings": {
            "min_depth_m": WARN_MIN_DEPTH_M,
            "min_area_m2": WARN_MIN_AREA_M2,
            "spacing_m": WARN_SPACING_M,
            "street_types": list(STREET_TYPES),
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
        description="Mark the lowest street spot of each especially deep low area.",
    )
    parser.add_argument("--terrain", type=Path, default=Path("../data/terrain"))
    parser.add_argument("--map", type=Path, default=Path("../apps/web/public/data/map.json"))
    parser.add_argument("--out", type=Path, default=Path("../apps/web/public/data/warnings/kensington.json"))
    parser.add_argument(
        "--extent",
        choices=sorted(EXTENTS),
        help="a published extent; defaults to the Iteration 1 demonstration extent",
    )
    args = parser.parse_args(argv)

    extent = resolve_extent(args.extent)
    geometry = json.loads(args.map.read_text(encoding="utf-8"))
    frame = geometry.get("extent", {})
    if frame.get("min_e") != extent.min_e or frame.get("min_n") != extent.min_n:
        # The corridors are in local metres from their own corner; another
        # extent's would mask streets a kilometre and a half from these.
        print(f"low_area_warnings: {args.map} is not in {extent.name}'s frame", file=sys.stderr)
        return 1
    buildings_path = args.terrain / "barriers.npy"
    if not buildings_path.exists():
        print(f"low_area_warnings: {buildings_path} is missing, so a sign could land on a building", file=sys.stderr)
        return 1
    try:
        artefact = build(
            extent,
            1.0,
            labels=np.load(args.terrain / "depression-cells.npz")["labels"],
            # Memory-mapped: the council surface is 306 MB and only the cells in
            # a hollow are read.
            elevation=np.load(args.terrain / "ground-surface.npy", mmap_mode="r"),
            depressions=json.loads((args.terrain / "depressions.json").read_text(encoding="utf-8")),
            roads=geometry.get("layers", {}).get("road", []),
            buildings=np.load(buildings_path),
        )
    except WarningError as error:
        print(f"low_area_warnings: {error}", file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")) + "\n", encoding="utf-8")
    counts = artefact["counts"]
    points = artefact["points"]
    print(
        f"{extent.name}: {counts['warnings']} warnings from {counts['drawn']} drawn of "
        f"{counts['hollows']} hollows, written to {args.out}; the busiest 1080 x 775 px view holds "
        f"{busiest_view(points, 1080 / 1.25, 775 / 1.25)} at 1.25 px/m and "
        f"{busiest_view(points, 1080 / 3, 775 / 3)} at 3 px/m",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
