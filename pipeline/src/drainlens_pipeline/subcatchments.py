"""Which drainage area an address is in, and what receives its water.

Epic 6 asks a question the product has never been able to answer: the street
outside a house belongs to a drainage area, that area drains somewhere, and
until now nothing in this repository knew either fact. Melbourne Water
publishes the areas -- 3,409 subcatchments over its operating region -- and
this module takes the ones that reach the build extent.

**Fetched from the feature service, not from a downloaded file.** The portal
offers the whole layer as a 23 MB GeoJSON and as an ArcGIS feature service that
answers a bounding box. The service is what this asks: 35 features and 292 KB
for the City of Melbourne, against 23 MB for the country around it, and the
same reason `network.py` asks the council's portal for a box rather than for
Victoria. A dataset that arrives as a file in somebody's downloads folder is a
dataset nobody can rebuild.

**No projection step, which is new here.** Every other layer arrives in
longitude and latitude and is projected by `geo.to_mga55`. This service accepts
and returns MGA Zone 55 directly (`inSR` and `outSR` 28355), so the coordinates
need only the extent's corner subtracted. The projection that does not happen
is the projection that cannot be wrong.

**The boundary is published whole.** AC 6.1.1 asks for the complete
subcatchment boundary, so nothing is clipped to the extent: an area that runs
ten kilometres north of the map keeps its northern edge, and the map draws what
fits. A clipped boundary would read as an area that stops at the edge of our
data, which is a claim about drainage that the data does not make.

**Simplified for drawing, and that is all it is for.** The rings are reduced
with the same Douglas-Peucker used for the flood areas. At the published five
metres a drawn edge can sit a few metres from the recorded one, which is
invisible at the scale a street map draws it and is *not* good enough to decide
which area a house is in. Measured over all 62,397 addresses, against the
geometry the service returned:

=======================  ===========  =============  ================
 tested against           unmatched    in two areas   disagreements
=======================  ===========  =============  ================
 the service's geometry             1              0  --
 these published rings              8             43  287 (0.46%)
=======================  ===========  =============  ================

So which area an address is in is decided in the pipeline against the service's
own geometry, and never in the browser against these rings. 287 houses on the
wrong side of a line is what the drawing tolerance costs, and it is a cost only
if something reads the drawing as the record.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Mapping, Sequence

from .area_points import simplify
from .geo import Extent

#: Who publishes the areas, for the provenance line the screen shows.
SOURCE = {
    "dataset": "Catchments - Waterways and Drains Subcatchments",
    "publisher": "Melbourne Water Corporation",
    "licence": "CC BY 4.0",
    "dataset_id": "catchments-waterways-and-drains-subcatchments",
    "portal": "https://discover.data.vic.gov.au/dataset/catchments-waterways-and-drains-subcatchments",
}

#: The feature service the portal lists beside the file downloads.
SERVICE = (
    "https://services5.arcgis.com/ZSYwjtv8RKVhkXIL/arcgis/rest/services/"
    "Catchments_of_all_Waterways_and_Drains/FeatureServer/1/query"
)

#: MGA Zone 55, which this service both takes and returns.
SPATIAL_REFERENCE = 28355

#: Padding on the fetched box, in metres.
#:
#: An address at the very edge of the extent sits in an area whose boundary may
#: cross it, and the fetch has to carry that area. The same 150 m `network.py`
#: pads its own fetch by, for the same reason.
FETCH_PADDING_M = 150.0

#: How far a drawn edge may sit from the recorded one, in metres.
#:
#: Five rather than the flood map's twenty-five: these boundaries are drawn over
#: a street map where a reader can see which side of a line a house is on, and
#: twenty-five metres is half a block. It is still a drawing tolerance and not a
#: survey: which area an address is in is decided against the unsimplified
#: geometry, in the pipeline.
SIMPLIFY_M = 5.0

#: The fields kept from the published record, and why each one is needed.
#:
#: - `SUB_CATCHMENT_NBR`, `SUB_CATCHMENT_NAME` — identify and name the area (AC 6.1.1).
#: - `MAJOR_CATCHMENT_NAME`, `PRIMARY_CATCHMENT_NAME`, `RIVER_BASIN_CATCHMENT_NAME`
#:   — the wider names, which AC 6.1.1 puts under *More information*.
#: - `AREA_SQ_KM` — the recorded area (AC 6.1.3), taken from the record rather
#:   than computed from the ring, which would be this project's number.
#: - `DATE_LAST_UPDATED` — *This drainage-area record was last updated in …*
#:   (AC 6.1.4), which is per record and not the portal's metadata date.
#: - `DATE_CAPTURED` — when the boundary was first recorded, kept because the
#:   criterion forbids presenting either date as a survey date and a reader
#:   comparing the two is the only way to see they are different things.
KEEP = (
    "SUB_CATCHMENT_NBR",
    "SUB_CATCHMENT_NAME",
    "MAJOR_CATCHMENT_NBR",
    "MAJOR_CATCHMENT_NAME",
    "PRIMARY_CATCHMENT_NAME",
    "RIVER_BASIN_CATCHMENT_NAME",
    "AREA_SQ_KM",
    "DATE_CAPTURED",
    "DATE_LAST_UPDATED",
)


class SubcatchmentError(Exception):
    """The published layer is not what this module knows how to read."""


@dataclass(frozen=True)
class Subcatchment:
    """One published area, in the extent's own metre frame."""

    number: str
    name: str
    major_number: str | None
    major_name: str | None
    primary_name: str | None
    basin_name: str | None
    area_sq_km: float | None
    captured: str | None
    last_updated: str | None
    #: One list of vertices per ring, outer ring first, open (no repeated end).
    rings: tuple[tuple[tuple[float, float], ...], ...]

    @property
    def vertices(self) -> int:
        return sum(len(ring) for ring in self.rings)


def query_url(extent: Extent, padding_m: float = FETCH_PADDING_M) -> str:
    """The service request for everything that reaches this extent."""
    envelope = ",".join(
        str(value)
        for value in (
            extent.min_e - padding_m,
            extent.min_n - padding_m,
            extent.max_e + padding_m,
            extent.max_n + padding_m,
        )
    )
    query = urllib.parse.urlencode(
        {
            "where": "1=1",
            "geometry": envelope,
            "geometryType": "esriGeometryEnvelope",
            "inSR": SPATIAL_REFERENCE,
            "outSR": SPATIAL_REFERENCE,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": ",".join(KEEP),
            "f": "geojson",
        }
    )
    return f"{SERVICE}?{query}"


def read(url: str, timeout: float = 120.0) -> Mapping[str, Any]:
    with urllib.request.urlopen(url, timeout=timeout) as response:  # noqa: S310 - fixed https host
        return json.loads(response.read().decode("utf-8"))


def features_of(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """The features, with the service's own failure modes named.

    ArcGIS answers a refused query with HTTP 200 and an `error` object, and
    caps a large answer by setting `exceededTransferLimit` and returning the
    first page. Both look like a shorter list of areas, which is exactly what a
    reader of the map could not tell from a real one.
    """
    if "error" in payload:
        message = payload["error"].get("message", "no message")
        raise SubcatchmentError(f"the feature service refused the query: {message}")
    if payload.get("exceededTransferLimit") or payload.get("properties", {}).get("exceededTransferLimit"):
        raise SubcatchmentError(
            "the feature service capped the answer, so some areas are missing; "
            "fetch in smaller boxes rather than publishing a partial layer"
        )
    features = payload.get("features")
    if not isinstance(features, list) or not features:
        raise SubcatchmentError("the feature service returned no areas for this extent")
    return features


def rings_of(geometry: Mapping[str, Any]) -> list[list[tuple[float, float]]]:
    """Every ring of a polygon or multipolygon, in the service's own metres."""
    kind = geometry.get("type")
    if kind == "Polygon":
        polygons: Iterable[Any] = [geometry.get("coordinates") or []]
    elif kind == "MultiPolygon":
        polygons = geometry.get("coordinates") or []
    else:
        raise SubcatchmentError(f"an area is a {kind}, which is not a polygon")
    return [[(float(x), float(y)) for x, y in ring] for polygon in polygons for ring in polygon]


def into_extent(
    rings: Sequence[Sequence[tuple[float, float]]],
    extent: Extent,
    tolerance: float = SIMPLIFY_M,
) -> tuple[tuple[tuple[float, float], ...], ...]:
    """Rings in metres from the extent's south-west corner, simplified and open.

    Coordinates outside the extent are kept and go negative or past the width:
    the boundary is published whole, and the map clips what it draws.
    """
    out = []
    for ring in rings:
        local = [(x - extent.min_e, y - extent.min_n) for x, y in ring]
        simple = simplify(local, tolerance)
        if len(simple) > 1 and simple[0] == simple[-1]:
            simple = simple[:-1]
        if len(simple) >= 3:
            out.append(tuple(simple))
    return tuple(out)


def text(value: Any) -> str | None:
    """A published field as a string, with blanks read as absent."""
    if value is None:
        return None
    written = str(value).strip()
    return written or None


def convert(
    features: Sequence[Mapping[str, Any]],
    extent: Extent,
    tolerance: float = SIMPLIFY_M,
) -> list[Subcatchment]:
    """The service's features as areas in this extent's frame."""
    areas: list[Subcatchment] = []
    for feature in features:
        properties = feature.get("properties") or {}
        number = text(properties.get("SUB_CATCHMENT_NBR"))
        name = text(properties.get("SUB_CATCHMENT_NAME"))
        if number is None or name is None:
            raise SubcatchmentError("an area has no number or no name, and both identify it on screen")
        rings = into_extent(rings_of(feature.get("geometry") or {}), extent, tolerance)
        if not rings:
            # Everything the service returned reaches the extent, so an area
            # with no ring left at this tolerance is a defect rather than a
            # speck of river bank: it would be an area a reader could be in and
            # the map could not draw.
            raise SubcatchmentError(f"area {number} has no ring left at {tolerance} m")
        area = properties.get("AREA_SQ_KM")
        areas.append(
            Subcatchment(
                number=number,
                name=name,
                major_number=text(properties.get("MAJOR_CATCHMENT_NBR")),
                major_name=text(properties.get("MAJOR_CATCHMENT_NAME")),
                primary_name=text(properties.get("PRIMARY_CATCHMENT_NAME")),
                basin_name=text(properties.get("RIVER_BASIN_CATCHMENT_NAME")),
                area_sq_km=float(area) if area is not None else None,
                captured=day_of(properties.get("DATE_CAPTURED")),
                last_updated=day_of(properties.get("DATE_LAST_UPDATED")),
                rings=rings,
            )
        )
    areas.sort(key=lambda area: area.number)
    return areas


def day_of(value: Any) -> str | None:
    """A published date as `YYYY-MM-DD`.

    The service sends epoch milliseconds and the CSV export writes
    `11/20/2013 12:00:00 AM`; both are read, and anything else is kept as it
    was written rather than guessed at. AC 6.1.4 shows the year to a reader, so
    a date silently read as the wrong one is a wrong year on the card.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        from datetime import datetime, timezone

        return datetime.fromtimestamp(float(value) / 1000.0, tz=timezone.utc).date().isoformat()
    written = str(value).strip()
    if not written:
        return None
    head = written.split(" ")[0]
    if "/" in head:
        month, day, year = (head.split("/") + ["", "", ""])[:3]
        if year.isdigit() and month.isdigit() and day.isdigit():
            return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    return written


def build(
    extent: Extent,
    features: Sequence[Mapping[str, Any]],
    tolerance: float = SIMPLIFY_M,
) -> dict[str, Any]:
    """The published artefact: the areas that reach this extent, whole."""
    areas = convert(features, extent, tolerance)
    return {
        "artefact": "subcatchments",
        "version": 1,
        "note": (
            "Drainage subcatchments recorded by Melbourne Water. Boundaries are published "
            "whole, in metres from this extent's south-west corner, and are simplified for "
            "drawing. The boundary does not show a flood extent, an individual pipe "
            "connection or who owns an asset."
        ),
        "extent": {
            "name": extent.name,
            "min_e": extent.min_e,
            "min_n": extent.min_n,
            "width_m": extent.width_m,
            "height_m": extent.height_m,
        },
        "source": dict(SOURCE),
        "settings": {"simplified_m": tolerance, "padding_m": FETCH_PADDING_M},
        "counts": {
            "areas": len(areas),
            "vertices": sum(area.vertices for area in areas),
        },
        "areas": [
            {
                "number": area.number,
                "name": area.name,
                **({} if area.major_number is None else {"majorNumber": area.major_number}),
                **({} if area.major_name is None else {"majorName": area.major_name}),
                **({} if area.primary_name is None else {"primaryName": area.primary_name}),
                **({} if area.basin_name is None else {"basinName": area.basin_name}),
                **({} if area.area_sq_km is None else {"areaSqKm": area.area_sq_km}),
                **({} if area.captured is None else {"captured": area.captured}),
                **({} if area.last_updated is None else {"lastUpdated": area.last_updated}),
                "rings": [[[round(x, 1), round(y, 1)] for x, y in ring] for ring in area.rings],
            }
            for area in areas
        ],
    }


def fetch(
    extent: Extent,
    padding_m: float = FETCH_PADDING_M,
    get: Callable[[str], Mapping[str, Any]] = read,
) -> list[Mapping[str, Any]]:
    """Everything the service holds that reaches this extent."""
    return features_of(get(query_url(extent, padding_m)))


def main(argv: list[str] | None = None) -> int:  # pragma: no cover - thin CLI
    import argparse
    import sys
    from pathlib import Path

    from .geo import EXTENTS, resolve_extent

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.subcatchments",
        description="Fetch the Melbourne Water subcatchments that reach the extent.",
    )
    parser.add_argument("--out", type=Path, default=Path("../data/map/subcatchments.json"))
    parser.add_argument("--extent", choices=sorted(EXTENTS))
    parser.add_argument(
        "--bounds",
        nargs=4,
        type=float,
        metavar=("MIN_E", "MIN_N", "MAX_E", "MAX_N"),
    )
    parser.add_argument("--simplify", type=float, default=SIMPLIFY_M, help="drawing tolerance in metres")
    args = parser.parse_args(argv)
    extent = resolve_extent(args.extent, args.bounds)

    def log(message: str) -> None:
        print(message, file=sys.stderr)

    log(f"Fetching subcatchments for {extent.name}")
    features = fetch(extent)
    artefact = build(extent, features, args.simplify)
    log(f"  {artefact['counts']['areas']} area(s), {artefact['counts']['vertices']} vertices")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")
    log(f"  written to {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
