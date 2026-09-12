"""Where each statistical area is, so the flood map can draw it.

Epic 4 needs a position per area. Everything else this pipeline publishes is
already in metres east and north of its extent's south-west corner, and the
browser draws all of it with one affine transform and no map library; this
keeps that true for Greater Melbourne rather than introducing a second way of
placing things on a canvas.

**A point per area rather than a boundary, which was a decision and not an
omission.** Drawing the areas as marks at their centres avoids fetching,
reprojecting and simplifying 281 polygons, and avoids shipping them to every
visitor. What it costs is that a mark is not a shape: the colour belongs to the
whole area and the map has to say so, because a soft mark reads as *worst here,
fading outwards* and the data says nothing of the kind.

**The source is MapInfo Interchange rather than the shapefile.** MIF is text,
it is 35 MB against 48, and parsing it needs nothing this project does not
already have — a shapefile would have added a dependency to read a file we
throw away after taking 281 points out of it. The polygons are not published:
they stay in `/data`, which is git-ignored, so deciding later to draw real
boundaries costs the work but not the download.

**A centroid is not always inside its own area.** Two of the 281 — Abbotsford
and Strathmore, both cut into a crescent by a river bend — have an area
centroid in a neighbouring suburb. `point_on_surface` is the fallback, and
`place` asserts every published point is inside the ring it belongs to. A label
in the wrong area is the kind of error that looks like a map working.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Iterable, Iterator, Mapping, Sequence

from .geo import to_mga55

#: The boundaries.
SOURCE = {
    "dataset": "Australian Statistical Geography Standard (ASGS) 2011, Volume 1, SA2 boundaries",
    "publisher": "Australian Bureau of Statistics",
    "licence": "CC BY 2.5 AU",
    "dataset_id": "1270.0.55.001",
}

#: As the MID file writes it, in `GCCSA_NAME_2011`.
SCOPE = "Greater Melbourne"

#: The column positions in the MID file, which the MIF header declares.
CODE, NAME, GCCSA = 0, 2, 8

#: Rounded outward to a kilometre so the extent is a readable number and a
#: point never sits exactly on an edge.
EXTENT_ROUNDING_M = 1000


class AreaPointsError(RuntimeError):
    """The boundaries do not support the positions they would be used for."""


@dataclass(frozen=True)
class Placed:
    """One area, and the point the map draws it at."""

    code: str
    name: str
    easting: float
    northing: float


def read_attributes(text: str, *, scope: str = SCOPE) -> list[tuple[int, list[str]]]:
    """The MID rows in scope, with the position each holds in the file.

    The position is what pairs a row with its geometry: MID and MIF are two
    files in one order, and nothing inside either says which feature a row
    belongs to. Carrying the index rather than assuming the pairing is what
    makes the assertion in `place` possible.
    """
    rows = [
        (index, line.split(","))
        for index, line in enumerate(text.splitlines())
        if line.strip()
    ]
    scoped = [(index, parts) for index, parts in rows if len(parts) > GCCSA and parts[GCCSA] == scope]
    if not scoped:
        raise AreaPointsError(
            f"no area in the attribute file belongs to {scope!r}; it must match "
            f"GCCSA_NAME_2011 exactly (read {len(rows)} rows)"
        )
    return scoped


def read_regions(lines: Iterable[str]) -> Iterator[list[list[tuple[float, float]]]]:
    """Each feature's rings, in file order, from the MIF's geometry section.

    A feature is `REGION n` followed by n rings, each a count and that many
    `longitude latitude` pairs. Anything else that can appear where a feature
    does — a line, a point, `NONE` — yields no rings rather than being skipped,
    because skipping it would shift every feature after it onto the wrong
    attribute row.
    """
    it = iter(lines)
    for line in it:
        if line.strip().upper() == "DATA":
            break
    else:
        raise AreaPointsError("the geometry file has no DATA section")

    for line in it:
        token = line.strip()
        if not token:
            continue
        upper = token.upper()
        if upper.startswith("REGION"):
            parts = int(token.split()[1])
            feature: list[list[tuple[float, float]]] = []
            for _ in range(parts):
                count = int(next(it).strip())
                ring = []
                for _ in range(count):
                    lon, lat = next(it).split()
                    ring.append((float(lon), float(lat)))
                feature.append(ring)
            yield feature
        elif upper.split()[0] in {"PLINE", "LINE", "POINT", "NONE", "MULTIPOINT"}:
            yield []


def ring_area(ring: Sequence[tuple[float, float]]) -> float:
    """Twice the signed area, halved. Degrees squared, which is only ever compared."""
    total = 0.0
    for index in range(len(ring)):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % len(ring)]
        total += x1 * y2 - x2 * y1
    return total / 2


def centroid(ring: Sequence[tuple[float, float]]) -> tuple[float, float]:
    """The area centroid, or the mean vertex where the ring encloses nothing."""
    area = ring_area(ring)
    if abs(area) < 1e-12:
        return (
            sum(p[0] for p in ring) / len(ring),
            sum(p[1] for p in ring) / len(ring),
        )
    cx = cy = 0.0
    for index in range(len(ring)):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % len(ring)]
        cross = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    return cx / (6 * area), cy / (6 * area)


def inside(point: tuple[float, float], ring: Sequence[tuple[float, float]]) -> bool:
    """Ray casting, the same rule `map/hit.ts` uses on the other side."""
    x, y = point
    hit = False
    for index in range(len(ring)):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % len(ring)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def point_on_surface(ring: Sequence[tuple[float, float]]) -> tuple[float, float]:
    """A point inside a ring whose centroid is not, near the middle of it.

    The line through the centroid's latitude crosses the boundary an even
    number of times; the widest gap between consecutive crossings is interior,
    and its midpoint is as far from an edge as this method gets. It is
    `ST_PointOnSurface`'s approach, and it is chosen over a true pole of
    inaccessibility because two areas need it and neither is close.
    """
    _, cy = centroid(ring)
    crossings: list[float] = []
    for index in range(len(ring)):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % len(ring)]
        if (y1 > cy) != (y2 > cy):
            crossings.append(x1 + (x2 - x1) * (cy - y1) / (y2 - y1))
    crossings.sort()
    best, widest = None, -1.0
    for index in range(0, len(crossings) - 1, 2):
        width = crossings[index + 1] - crossings[index]
        if width > widest:
            widest, best = width, (crossings[index] + crossings[index + 1]) / 2
    if best is None:
        raise AreaPointsError("a ring that no horizontal line crosses twice is not a polygon")
    return best, cy


def place(
    attributes: Sequence[tuple[int, Sequence[str]]],
    geometry: Sequence[Sequence[Sequence[tuple[float, float]]]],
) -> list[Placed]:
    """One point per area, each asserted to be inside the area it names.

    The largest ring rather than all of them: three Greater Melbourne areas are
    more than one piece, and a point averaged across an island and a mainland
    would be in the water between them.
    """
    placed: list[Placed] = []
    for index, parts in attributes:
        name = parts[NAME]
        if index >= len(geometry):
            raise AreaPointsError(
                f"{name!r} is attribute row {index} and the geometry file holds "
                f"{len(geometry)} features: the two files are not the same release"
            )
        feature = geometry[index]
        if not feature:
            raise AreaPointsError(f"{name!r} has no boundary, so it cannot be placed")

        ring = max(feature, key=lambda r: abs(ring_area(r)))
        point = centroid(ring)
        if not inside(point, ring):
            point = point_on_surface(ring)
        if not inside(point, ring):
            raise AreaPointsError(
                f"no interior point was found for {name!r}; drawing it would put its "
                "name and its colour in a different area"
            )
        easting, northing = to_mga55(point[1], point[0])
        placed.append(Placed(parts[CODE], name, easting, northing))
    return placed


def build(placed: Sequence[Placed], *, scope: str = SCOPE) -> dict:
    """The artefact, in the frame every other one here uses.

    Metres east and north of the extent's own south-west corner, so the browser
    draws this with the same affine transform as the drainage map and carries
    no projection at run time.
    """
    if not placed:
        raise AreaPointsError("no areas were placed")

    min_e = math.floor(min(p.easting for p in placed) / EXTENT_ROUNDING_M) * EXTENT_ROUNDING_M
    min_n = math.floor(min(p.northing for p in placed) / EXTENT_ROUNDING_M) * EXTENT_ROUNDING_M
    width = math.ceil((max(p.easting for p in placed) - min_e) / EXTENT_ROUNDING_M) * EXTENT_ROUNDING_M
    height = math.ceil((max(p.northing for p in placed) - min_n) / EXTENT_ROUNDING_M) * EXTENT_ROUNDING_M

    return {
        "artefact": "sa2-points",
        "version": 1,
        "basis": "derived",
        "note": (
            "One point per statistical area, inside the area it names, in metres east "
            "and north of the extent's south-west corner. Calculated by DrainLens from "
            "ABS boundaries; it is where an area is drawn, not where flooding was "
            "recorded, and the value shown beside it belongs to the whole area."
        ),
        "source": dict(SOURCE),
        "scope": scope,
        "extent": {
            "name": "greater-melbourne",
            "min_e": min_e,
            "min_n": min_n,
            "width_m": width,
            "height_m": height,
            "crs": "EPSG:28355",
        },
        "counts": {"areas": len(placed)},
        "areas": [
            {
                "code": p.code,
                "name": p.name,
                # Whole metres. A statistical area is kilometres across and a
                # centimetre of precision here would be four more characters
                # per area claiming something the method does not support.
                "e": round(p.easting - min_e),
                "n": round(p.northing - min_n),
            }
            for p in placed
        ],
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys
    from pathlib import Path

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.area_points",
        description="Place each statistical area for the flood map.",
    )
    parser.add_argument("--mid", type=Path, required=True, help="SA2_2011_AUST.mid")
    parser.add_argument("--mif", type=Path, required=True, help="SA2_2011_AUST.mif")
    parser.add_argument(
        "--out", type=Path, default=Path("../apps/web/public/data/sa2-points.json")
    )
    args = parser.parse_args(argv)

    try:
        attributes = read_attributes(args.mid.read_text(encoding="utf-8-sig"))
        with args.mif.open(encoding="utf-8", errors="replace") as handle:
            geometry = list(read_regions(handle))
        artefact = build(place(attributes, geometry))
    except AreaPointsError as error:
        print(str(error), file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")

    extent = artefact["extent"]
    counts = artefact["counts"]
    assert isinstance(extent, dict) and isinstance(counts, dict)
    print(f"wrote {args.out}  ({args.out.stat().st_size / 1024:.1f} KB)")
    print(f"  areas placed   {counts['areas']:>7,}")
    print(f"  extent         {extent['width_m'] / 1000:.0f} by {extent['height_m'] / 1000:.0f} km")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
