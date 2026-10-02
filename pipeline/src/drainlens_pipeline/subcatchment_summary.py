"""What is recorded inside a drainage area: pits, pipe length, low areas, coverage.

AC 6.1.3 asks a drainage area to summarise itself -- the recorded area, how
many stormwater pits the council has in it, how much mapped drainpipe, and
whether any supported low area falls inside -- and then asks for the sentence
that makes those numbers honest: **they reflect City of Melbourne data coverage
only**.

That sentence is not a disclaimer tacked on. A subcatchment is a Melbourne
Water area and does not stop at the council boundary: *Yarra River (Mouth to
Merri)* runs far past it, and the pits counted inside it are the pits inside
*the part of it this project has data for*. A count presented without that is a
claim about the whole area made from part of it.

So every summary carries `coverage`: the share of the area's own recorded
square kilometres that lies inside the build extent, computed by clipping the
boundary to the extent and comparing. An area wholly inside reads 1.0 and its
counts are complete for the council's record; one reading 0.21 has four fifths
of itself outside, and the screen can say so.

**Pipe length is clipped, not counted.** AC 6.1.3 says only the portion of each
mapped pipe inside the subcatchment counts, which is the difference between a
pipe that happens to start in an area and a pipe that is in it. Each segment is
cut at the boundary and only the inside pieces are summed.

**The geometry is the service's, not the drawn one**, for the reason
`address_catchments.py` records: the 5 m drawing tolerance moves 287 addresses,
and it would move pits and pipe metres the same way.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

from .address_catchments import boxes_of, inside
from .geo import Extent

Point = tuple[float, float]
Ring = Sequence[Point]


@dataclass(frozen=True)
class Summary:
    """One area's recorded contents, within the data this project has."""

    number: str
    pits: int
    pipe_length_m: float
    low_areas: int
    #: Share of the area's recorded square kilometres inside the build extent,
    #: 0 to 1, or None where the record carries no area to compare against.
    coverage: float | None


def ring_area(ring: Ring) -> float:
    """Twice the signed area, by the shoelace formula, halved.

    Signed on purpose: GeoJSON writes an outer ring anticlockwise and a hole
    clockwise, so summing signed areas subtracts the holes without anything
    having to know which ring is which.
    """
    total = 0.0
    count = len(ring)
    for index in range(count):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % count]
        total += x1 * y2 - x2 * y1
    return total / 2.0


def polygon_area(rings: Sequence[Ring]) -> float:
    """The area the rings enclose, holes removed, always positive."""
    return abs(sum(ring_area(ring) for ring in rings))


def clip_to_box(ring: Ring, box: tuple[float, float, float, float]) -> list[Point]:
    """Sutherland-Hodgman against an axis-aligned rectangle.

    Only ever used against the build extent, which is why a general polygon
    clipper is not here: the extent is a rectangle, and four half-plane passes
    are the whole algorithm.
    """
    min_e, min_n, max_e, max_n = box
    edges = (
        (lambda p: p[0] >= min_e, lambda a, b: cut(a, b, 0, min_e)),
        (lambda p: p[0] <= max_e, lambda a, b: cut(a, b, 0, max_e)),
        (lambda p: p[1] >= min_n, lambda a, b: cut(a, b, 1, min_n)),
        (lambda p: p[1] <= max_n, lambda a, b: cut(a, b, 1, max_n)),
    )
    polygon = list(ring)
    for keep, crossing in edges:
        if not polygon:
            return []
        clipped: list[Point] = []
        for index, point in enumerate(polygon):
            previous = polygon[index - 1]
            if keep(point):
                if not keep(previous):
                    clipped.append(crossing(previous, point))
                clipped.append(point)
            elif keep(previous):
                clipped.append(crossing(previous, point))
        polygon = clipped
    return polygon


def cut(a: Point, b: Point, axis: int, at: float) -> Point:
    """Where the segment crosses a line of constant easting or northing."""
    other = 1 - axis
    span = b[axis] - a[axis]
    share = 0.0 if span == 0 else (at - a[axis]) / span
    value = a[other] + (b[other] - a[other]) * share
    return (at, value) if axis == 0 else (value, at)


def coverage_of(rings: Sequence[Ring], extent: Extent, recorded_sq_km: float | None) -> float | None:
    """How much of the area's own recorded size is inside the extent.

    Measured against the *record's* square kilometres rather than against the
    boundary's own computed area, because the record is what the screen shows
    beside it. The two differ by the thickness of a published boundary, and a
    share of 1.04 would be this project telling a reader it has more of an area
    than the area has.

    **The rings are in the extent's own frame**, metres from its south-west
    corner, as everything else here is: the pits, the pipes and the low areas
    all arrive that way, and the boundaries are shifted to match before any of
    this is called. Clipping against the extent's MGA corners instead produced
    a coverage of 0.0 for all thirty-five areas — every boundary fell outside a
    box eight kilometres away, and a share of nothing is exactly what a real
    area outside the extent would read.
    """
    if recorded_sq_km is None or recorded_sq_km <= 0:
        return None
    box = (0.0, 0.0, extent.width_m, extent.height_m)
    inside_sq_m = abs(sum(ring_area(clip_to_box(ring, box)) for ring in rings))
    return min(1.0, inside_sq_m / (recorded_sq_km * 1_000_000.0))


def length_inside(path: Sequence[Point], rings: Sequence[Ring]) -> float:
    """The length of a polyline that lies inside the rings, in metres.

    Each segment is split wherever it crosses the boundary and each piece is
    kept or dropped on its own midpoint. A segment entirely inside keeps its
    whole length; one that leaves halfway keeps half. AC 6.1.3 asks for exactly
    this: the portion of each mapped pipe within the subcatchment.
    """
    total = 0.0
    for index in range(len(path) - 1):
        a, b = path[index], path[index + 1]
        cuts = sorted(crossings(a, b, rings))
        marks = [0.0, *cuts, 1.0]
        for first, last in zip(marks, marks[1:]):
            if last <= first:
                continue
            middle = (first + last) / 2.0
            point = (a[0] + (b[0] - a[0]) * middle, a[1] + (b[1] - a[1]) * middle)
            if inside(point[0], point[1], rings):
                total += math.dist(a, b) * (last - first)
    return total


def crossings(a: Point, b: Point, rings: Sequence[Ring]) -> list[float]:
    """Where along `a`→`b` the boundary is crossed, as fractions in (0, 1)."""
    out: list[float] = []
    dx, dy = b[0] - a[0], b[1] - a[1]
    for ring in rings:
        count = len(ring)
        for index in range(count):
            c, d = ring[index], ring[(index + 1) % count]
            ex, ey = d[0] - c[0], d[1] - c[1]
            denominator = dx * ey - dy * ex
            if denominator == 0:
                continue
            t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / denominator
            u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / denominator
            if 0.0 < t < 1.0 and 0.0 <= u <= 1.0:
                out.append(t)
    return out


def centroid(ring: Ring) -> Point:
    """A ring's centroid, or its first vertex for a degenerate one."""
    area = ring_area(ring)
    if area == 0:
        return tuple(ring[0])  # type: ignore[return-value]
    cx = cy = 0.0
    count = len(ring)
    for index in range(count):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % count]
        step = x1 * y2 - x2 * y1
        cx += (x1 + x2) * step
        cy += (y1 + y2) * step
    return (cx / (6.0 * area), cy / (6.0 * area))


#: The side of one cell of the boundary-edge index, in metres.
#:
#: The council's 17,242 pipes against 35 unsimplified boundaries is 600,000
#: pipe-and-area pairs, and testing each segment against every ring edge is an
#: afternoon. Almost every pipe is wholly inside one area and crosses no
#: boundary at all, which this index is for: a pipe with no boundary edge near
#: it keeps its whole length, measured once, and only the pipes that actually
#: meet a boundary are cut.
CELL_M = 250.0


def edge_index(areas: Sequence[tuple[str, Sequence[Ring]]]) -> dict[tuple[int, int], list[int]]:
    """Which areas have a boundary edge in each cell of the extent."""
    cells: dict[tuple[int, int], set[int]] = {}
    for at, (_number, rings) in enumerate(areas):
        for ring in rings:
            count = len(ring)
            for index in range(count):
                (x1, y1), (x2, y2) = ring[index], ring[(index + 1) % count]
                for cell in cells_between(x1, y1, x2, y2):
                    cells.setdefault(cell, set()).add(at)
    return {cell: sorted(found) for cell, found in cells.items()}


def cells_between(x1: float, y1: float, x2: float, y2: float) -> Iterable[tuple[int, int]]:
    """Every index cell the segment's bounding box touches."""
    for cx in range(int(min(x1, x2) // CELL_M), int(max(x1, x2) // CELL_M) + 1):
        for cy in range(int(min(y1, y2) // CELL_M), int(max(y1, y2) // CELL_M) + 1):
            yield (cx, cy)


def areas_near(path: Sequence[Point], cells: Mapping[tuple[int, int], list[int]]) -> set[int]:
    """The areas whose boundary runs near this path."""
    near: set[int] = set()
    for index in range(len(path) - 1):
        (x1, y1), (x2, y2) = path[index], path[index + 1]
        for cell in cells_between(x1, y1, x2, y2):
            near.update(cells.get(cell, ()))
    return near


def path_length(path: Sequence[Point]) -> float:
    return sum(math.dist(path[index], path[index + 1]) for index in range(len(path) - 1))


def summarise(
    areas: Sequence[tuple[str, Sequence[Ring]]],
    recorded_sq_km: Mapping[str, float | None],
    pits: Iterable[Point],
    pipes: Iterable[Sequence[Point]],
    low_areas: Iterable[Ring],
    extent: Extent,
) -> list[Summary]:
    """Every area's contents, in one pass over each layer."""
    boxes = boxes_of([(number, rings) for number, rings in areas])
    counts = {number: 0 for number, _ in areas}
    metres = {number: 0.0 for number, _ in areas}
    hollows = {number: 0 for number, _ in areas}

    def holding(x: float, y: float) -> str | None:
        for (number, rings), box in zip(areas, boxes):
            if box[0] <= x <= box[2] and box[1] <= y <= box[3] and inside(x, y, rings):
                return number
        return None

    for x, y in pits:
        number = holding(x, y)
        if number is not None:
            counts[number] += 1

    cells = edge_index(areas)
    for path in pipes:
        if len(path) < 2:
            continue
        near = areas_near(path, cells)
        if not near:
            # No boundary runs near this pipe, so it is wholly inside whichever
            # area holds it, or outside them all. One containment test and the
            # whole length, which is the case for most of the council's pipes.
            number = holding(path[0][0], path[0][1])
            if number is not None:
                metres[number] += path_length(path)
            continue
        for at in near:
            number, rings = areas[at]
            metres[number] += length_inside(path, rings)

    for ring in low_areas:
        x, y = centroid(ring)
        number = holding(x, y)
        if number is not None:
            hollows[number] += 1

    return [
        Summary(
            number=number,
            pits=counts[number],
            pipe_length_m=round(metres[number], 1),
            low_areas=hollows[number],
            coverage=coverage_of(rings, extent, recorded_sq_km.get(number)),
        )
        for number, rings in areas
    ]


def paths_of(layer: Sequence[Mapping[str, Any]]) -> list[list[Point]]:
    """The map artefact's line features as plain vertex lists."""
    return [[(float(x), float(y)) for x, y in feature.get("c", [])] for feature in layer]


def points_of(layer: Sequence[Mapping[str, Any]]) -> list[Point]:
    return [(float(feature["c"][0]), float(feature["c"][1])) for feature in layer if "c" in feature]


def rings_of_layer(layer: Sequence[Mapping[str, Any]]) -> list[list[Point]]:
    """Each polygon feature's outer ring, which is what a low area is."""
    out: list[list[Point]] = []
    for feature in layer:
        rings = feature.get("c") or []
        if rings and rings[0]:
            out.append([(float(x), float(y)) for x, y in rings[0]])
    return out


def merge(artefact: dict[str, Any], summaries: Sequence[Summary]) -> dict[str, Any]:
    """The published artefact with each area's summary added to it.

    Merged into the file the screen already reads rather than published beside
    it: the card shows the name, the record date and these counts together, and
    two files that have to be joined are two files that can disagree.
    """
    by_number = {summary.number: summary for summary in summaries}
    for area in artefact["areas"]:
        summary = by_number.get(area["number"])
        if summary is None:
            continue
        area["summary"] = {
            "pits": summary.pits,
            "pipeLengthM": summary.pipe_length_m,
            "lowAreas": summary.low_areas,
            # Four places, not three: the areas that only grazed the extent sit
            # below a thousandth of themselves, and rounding those to 0.0 said
            # we hold none of an area we hold a little of.
            **({} if summary.coverage is None else {"coverage": round(summary.coverage, 4)}),
        }
    artefact["counts"] = {
        **artefact.get("counts", {}),
        "pits": sum(summary.pits for summary in summaries),
        "pipeLengthM": round(sum(summary.pipe_length_m for summary in summaries), 1),
        "lowAreas": sum(summary.low_areas for summary in summaries),
    }
    artefact["coverage"] = (
        "Pit counts, pipe lengths and low areas are from City of Melbourne data and cover only "
        "the part of each drainage area this project holds data for. Each area's coverage share "
        "says how much of its own recorded size that is."
    )
    return artefact


def main(argv: list[str] | None = None) -> int:  # pragma: no cover - thin CLI
    import argparse
    import json
    import sys
    from pathlib import Path

    from .geo import EXTENTS, resolve_extent
    from .subcatchments import fetch
    from .address_catchments import areas_of

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.subcatchment_summary",
        description="Add the recorded pits, pipe length and low areas to each drainage area.",
    )
    parser.add_argument("--subcatchments", type=Path, required=True)
    parser.add_argument("--map", dest="map_path", type=Path, required=True)
    parser.add_argument("--derived", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--extent", choices=sorted(EXTENTS))
    parser.add_argument("--bounds", nargs=4, type=float, metavar=("MIN_E", "MIN_N", "MAX_E", "MAX_N"))
    args = parser.parse_args(argv)
    extent = resolve_extent(args.extent, args.bounds)

    def log(message: str) -> None:
        print(message, file=sys.stderr)

    artefact = json.loads(args.subcatchments.read_text(encoding="utf-8"))
    carto = json.loads(args.map_path.read_text(encoding="utf-8"))
    derived = json.loads(args.derived.read_text(encoding="utf-8"))

    log(f"Fetching subcatchment geometry for {extent.name}")
    fetched = areas_of(fetch(extent))
    # Into the map's own frame: the pits, pipes and low areas are all metres
    # from the extent's corner, and the service answers in MGA.
    areas = [
        (number, [[(x - extent.min_e, y - extent.min_n) for x, y in ring] for ring in rings])
        for number, rings in fetched
    ]
    recorded = {area["number"]: area.get("areaSqKm") for area in artefact["areas"]}

    pits = points_of(carto["layers"].get("pit", []))
    pipes = paths_of(carto["layers"].get("pipe", []))
    hollows = rings_of_layer(derived["layers"].get("low-point", []))
    log(f"  {len(pits)} pit(s), {len(pipes)} pipe(s), {len(hollows)} low area(s) to place")

    summaries = summarise(areas, recorded, pits, pipes, hollows, extent)
    merged = merge(artefact, summaries)

    placed = sum(summary.pits for summary in summaries)
    log(
        f"  placed {placed} of {len(pits)} pits, "
        f"{round(sum(s.pipe_length_m for s in summaries) / 1000.0, 1)} km of pipe, "
        f"{sum(s.low_areas for s in summaries)} of {len(hollows)} low areas"
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(merged, separators=(",", ":")), encoding="utf-8")
    log(f"  written to {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
