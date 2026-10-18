"""Which drainage area each address is in, decided here rather than in a browser.

AC 6.1.1 asks for the subcatchment containing the address, and AC 6.1.5 forbids
the two ways of getting it nearly right: substituting the nearest area when
none contains the address, and choosing between two that do without a rule.
Both are easy to do by accident in a browser testing a point against drawn
boundaries, and the boundaries the browser has are drawn ones.

**The 5 m drawing tolerance costs 287 addresses.** Measured over all 62,397 in
the index, deciding membership from the published rings instead of the
service's own geometry puts 287 of them (0.46%) in a different area, leaves 8
in none and 43 in two -- the ones within a few metres of a boundary, which is
exactly where a reader would look to check. So the question is answered once,
here, against the geometry as fetched, and the answer is published.

**Keyed by street rather than by position.** The address index is grouped by
street and this artefact mirrors it, but a list aligned by index would be a
silent trap: an index rebuilt from a new release can reorder its groups, and
every address would then be told about somebody else's drainage area with
nothing out of place to see. The key is the index's own `"Street|Suburb"`, and
each entry carries the number of addresses it covers so a mismatch is a
failure rather than an offset -- `tools/data/check-subcatchments.mjs` checks
both.

**One value where a street is wholly in one area**, a list where it is not.
851 of the council's 999 streets are wholly in one, 123 cross two, 23 cross
three and 2 cross four, which is what makes the file small enough to ship
beside the index.

**`-1` is an address in no recorded area**, and there is exactly one in the
council. It is published as what it is, so the screen can say a drainage area
could not be identified rather than quietly inherit a neighbour's.
"""

from __future__ import annotations

import json
from typing import Any, Mapping, Sequence

from .geo import Extent
from .subcatchments import SOURCE, SubcatchmentError, rings_of

#: What `-1` means wherever it appears in this artefact.
NO_AREA = -1


def boxes_of(areas: Sequence[tuple[str, Sequence[Sequence[tuple[float, float]]]]]):
    """A bounding box per area, so most points are rejected by four comparisons."""
    out = []
    for _, rings in areas:
        xs = [x for ring in rings for x, _ in ring]
        ys = [y for ring in rings for _, y in ring]
        out.append((min(xs), min(ys), max(xs), max(ys)))
    return out


def inside(x: float, y: float, rings: Sequence[Sequence[tuple[float, float]]]) -> bool:
    """Even-odd ray casting over every ring, so a hole excludes the point.

    GeoJSON polygons carry their holes as further rings, and the even-odd rule
    is what makes a point inside a hole land outside the area. A
    containment test that only looked at outer rings would place an address in
    an area the record cuts out of it.
    """
    hit = False
    for ring in rings:
        crossings = False
        count = len(ring)
        for index in range(count):
            x1, y1 = ring[index]
            x2, y2 = ring[(index + 1) % count]
            if (y1 > y) != (y2 > y):
                at = (x2 - x1) * (y - y1) / (y2 - y1) + x1
                if x < at:
                    crossings = not crossings
        if crossings:
            hit = not hit
    return hit


def areas_of(features: Sequence[Mapping[str, Any]]) -> list[tuple[str, list[list[tuple[float, float]]]]]:
    """The fetched features as (number, rings) in MGA metres, unsimplified."""
    areas = []
    for feature in features:
        properties = feature.get("properties") or {}
        number = properties.get("SUB_CATCHMENT_NBR")
        if number is None:
            raise SubcatchmentError("an area has no number, and the assignment is published by number")
        areas.append((str(number).strip(), rings_of(feature.get("geometry") or {})))
    areas.sort(key=lambda area: area[0])
    return areas


def assign(
    easting: float,
    northing: float,
    areas: Sequence[tuple[str, Sequence[Sequence[tuple[float, float]]]]],
    boxes: Sequence[tuple[float, float, float, float]],
) -> list[int]:
    """Every area containing this point, as indices into `areas`.

    Returns a list rather than a match, because *how many* is the finding: none
    is AC 6.1.5's unmatched address and more than one is its ambiguous one, and
    a function that returned the first would answer both with a number.
    """
    found = []
    for index, ((_, rings), box) in enumerate(zip(areas, boxes)):
        if easting < box[0] or easting > box[2] or northing < box[1] or northing > box[3]:
            continue
        if inside(easting, northing, rings):
            found.append(index)
    return found


def build(
    index: Mapping[str, Any],
    features: Sequence[Mapping[str, Any]],
    extent: Extent,
) -> dict[str, Any]:
    """The published lookup: street by street, in the index's own order."""
    areas = areas_of(features)
    boxes = boxes_of(areas)
    origin_e = float(index["extent"]["min_e"])
    origin_n = float(index["extent"]["min_n"])
    streets: dict[str, dict[str, Any]] = {}
    matched = unmatched = ambiguous = whole = split = 0

    for key, group in zip(index["on"], index["at"]):
        found: list[int] = []
        for _number, east, north in group:
            hits = assign(east + origin_e, north + origin_n, areas, boxes)
            if not hits:
                unmatched += 1
                found.append(NO_AREA)
                continue
            if len(hits) > 1:
                # AC 6.1.5: no rule has been approved for choosing between two
                # recorded areas, so the artefact must not invent one. The
                # council's index has none of these, and if a rebuilt boundary
                # layer produces one this stops rather than picks.
                raise SubcatchmentError(
                    f"an address on {key} is inside {len(hits)} recorded areas "
                    f"({', '.join(areas[at][0] for at in hits)}); AC 6.1.5 has no rule for choosing"
                )
            matched += 1
            found.append(hits[0])

        distinct = set(found)
        if len(distinct) == 1:
            whole += 1
            streets[key] = {"n": len(found), "a": found[0]}
        else:
            split += 1
            streets[key] = {"n": len(found), "a": found}

    return {
        "artefact": "address-catchments",
        "version": 1,
        "note": (
            "Which recorded drainage area each address in the index is inside, worked out "
            "against Melbourne Water's own boundary geometry rather than the simplified "
            "boundaries published for drawing. -1 is an address no recorded area contains."
        ),
        "extent": {"name": extent.name, "min_e": origin_e, "min_n": origin_n},
        "source": dict(SOURCE),
        "numbers": [number for number, _ in areas],
        "counts": {
            "addresses": matched + unmatched,
            "matched": matched,
            "unmatched": unmatched,
            "ambiguous": ambiguous,
            "streets": len(streets),
            "wholeStreets": whole,
            "splitStreets": split,
            "areasUsed": len({at for entry in streets.values() for at in ([entry["a"]] if isinstance(entry["a"], int) else entry["a"]) if at != NO_AREA}),
        },
        "streets": streets,
    }


def main(argv: list[str] | None = None) -> int:  # pragma: no cover - thin CLI
    import argparse
    import sys
    from pathlib import Path

    from .geo import EXTENTS, resolve_extent
    from .subcatchments import fetch

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.address_catchments",
        description="Work out which drainage area each address is in.",
    )
    parser.add_argument(
        "--addresses", type=Path, default=Path("../apps/web/public/data/addresses.json")
    )
    parser.add_argument("--out", type=Path, default=Path("../data/map/address-catchments.json"))
    parser.add_argument("--extent", choices=sorted(EXTENTS))
    parser.add_argument(
        "--bounds", nargs=4, type=float, metavar=("MIN_E", "MIN_N", "MAX_E", "MAX_N")
    )
    args = parser.parse_args(argv)
    extent = resolve_extent(args.extent, args.bounds)

    def log(message: str) -> None:
        print(message, file=sys.stderr)

    index = json.loads(args.addresses.read_text(encoding="utf-8"))
    log(f"Fetching subcatchments for {extent.name}")
    features = fetch(extent)
    log(f"  {len(features)} area(s); assigning {sum(len(group) for group in index['at'])} addresses")
    artefact = build(index, features, extent)

    counts = artefact["counts"]
    log(
        f"  matched {counts['matched']}, unmatched {counts['unmatched']}, "
        f"in {counts['areasUsed']} area(s); {counts['wholeStreets']} street(s) wholly in one, "
        f"{counts['splitStreets']} split"
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")
    log(f"  written to {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
