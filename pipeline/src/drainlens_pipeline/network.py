"""Map geometry for the browser: pits, pipes, roads and street labels.

The graph artefact carries topology and nothing else — which pit feeds which —
because that is what a trace needs. A map needs the other half: where the
things are. This module fetches that and writes it in the form the renderer
consumes.

Coordinates come out as **metres east and north of the extent's south-west
corner**, rounded to a decimetre, not as latitude and longitude. Three reasons,
in order of how much they matter:

* The browser then needs no projection at all. The extent is a north-up square
  of one-metre cells, so a coordinate is a pixel once you multiply by the zoom.
  A projection in the client is a second place for the map and the model to
  disagree about where something is.
* A decimetre is already finer than the sources justify, and the numbers are
  four digits instead of fifteen.
* Anything outside the extent is clipped at build time rather than shipped and
  hidden, so the payload is only what can appear.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Callable, Iterable, Sequence

from .geo import Extent, from_mga55, to_mga55

BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"

#: Padding on the fetch bounds, in metres. A pipe with one end just outside the
#: extent still runs through it, and a street label anchored just outside still
#: belongs to a street inside.
FETCH_PADDING_M = 150.0


@dataclass(frozen=True)
class Dataset:
    """One published dataset and how to ask it for a bounding box.

    The portal is not consistent about this. Most datasets carry a
    `geo_point_2d` that `in_bbox` understands; the stormwater pits carry bare
    `lat` and `lon` columns instead and reject `in_bbox` with a 400. The
    difference is recorded here rather than discovered again by whoever adds
    the next layer.
    """

    id: str
    kind: str
    licence: str = "CC BY 4.0"
    modified: str = ""
    bbox_field: str | None = "geo_point_2d"
    lat_lon_fields: tuple[str, str] | None = None
    keep: tuple[str, ...] = ()

    def where(self, bounds: tuple[float, float, float, float]) -> str:
        south, west, north, east = bounds
        if self.lat_lon_fields is not None:
            lat, lon = self.lat_lon_fields
            return (
                f"{lat} > {south} and {lat} < {north} and {lon} > {west} and {lon} < {east}"
            )
        return f"in_bbox({self.bbox_field}, {south}, {west}, {north}, {east})"


PITS = Dataset(
    id="stormwater-pits",
    kind="pit",
    modified="2023-02-26",
    bbox_field=None,
    lat_lon_fields=("lat", "lon"),
    keep=("asset_number", "asset_description", "object_type_lupvalue"),
)

PIPES = Dataset(
    id="drainpipes",
    kind="pipe",
    modified="2023-02-26",
    keep=("ref", "upstr_pit", "dnstr_pit", "diameter", "material"),
)

ROADS = Dataset(
    id="road-corridors",
    kind="road",
    modified="2021-09-30",
    keep=("str_type", "seg_descr"),
)

STREET_NAMES = Dataset(
    id="street-names",
    kind="street-name",
    modified="2021-09-30",
    keep=("name", "maplabel"),
)

LAYERS: tuple[Dataset, ...] = (ROADS, PIPES, PITS, STREET_NAMES)


class NetworkError(Exception):
    pass


@dataclass
class Feature:
    kind: str
    geometry: str
    """`point`, `line` or `polygon`."""
    coordinates: list
    """Local metres: a pair, a list of pairs, or a list of rings."""
    properties: dict = field(default_factory=dict)


def bounds_for(extent: Extent, padding_m: float) -> tuple[float, float, float, float]:
    south, west = from_mga55(extent.min_e - padding_m, extent.min_n - padding_m)
    north, east = from_mga55(extent.max_e + padding_m, extent.max_n + padding_m)
    return south, west, north, east


def _opener(timeout: float) -> Callable[[str], bytes]:
    def read(url: str) -> bytes:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.read()

    return read


def fetch_layer(
    dataset: Dataset,
    extent: Extent,
    *,
    padding_m: float = FETCH_PADDING_M,
    opener: Callable[[str], bytes] | None = None,
    timeout: float = 300.0,
) -> list[Feature]:
    """One layer, clipped to the extent and in local metres."""
    where = urllib.parse.quote(dataset.where(bounds_for(extent, padding_m)))
    url = f"{BASE}/{dataset.id}/exports/geojson?where={where}"
    read = opener or _opener(timeout)
    payload = json.loads(read(url))
    return convert(payload.get("features", []), dataset, extent)


def convert(features: Iterable[dict], dataset: Dataset, extent: Extent) -> list[Feature]:
    """GeoJSON in degrees to features in local metres, clipped to the extent."""
    out: list[Feature] = []
    for source in features:
        properties = {
            key: source.get("properties", {}).get(key)
            for key in dataset.keep
            if source.get("properties", {}).get(key) is not None
        }
        geometry = source.get("geometry") or {}
        kind = geometry.get("type")
        coordinates = geometry.get("coordinates")

        if kind == "Point" and coordinates is not None:
            point = _local(coordinates, extent)
            if _inside(point, extent):
                out.append(Feature(dataset.kind, "point", point, properties))

        elif kind in ("LineString", "MultiLineString") and coordinates is not None:
            lines = [coordinates] if kind == "LineString" else coordinates
            for line in lines:
                path = _clip([_local(p, extent) for p in line], extent)
                if len(path) >= 2:
                    out.append(Feature(dataset.kind, "line", path, properties))

        elif kind in ("Polygon", "MultiPolygon") and coordinates is not None:
            polygons = [coordinates] if kind == "Polygon" else coordinates
            for rings in polygons:
                kept = [
                    _clip([_local(p, extent) for p in ring], extent, closed=True)
                    for ring in rings
                ]
                if kept and len(kept[0]) >= 3:
                    out.append(
                        Feature(dataset.kind, "polygon", [r for r in kept if len(r) >= 3], properties)
                    )
    return out


def _local(point: Sequence[float], extent: Extent) -> list[float]:
    # GeoJSON is longitude first; `to_mga55` takes latitude first, and swapping
    # them puts the whole layer in the Southern Ocean.
    easting, northing = to_mga55(point[1], point[0])
    return [round(easting - extent.min_e, 1), round(northing - extent.min_n, 1)]


def _inside(point: Sequence[float], extent: Extent, slack_m: float = 0.0) -> bool:
    return (
        -slack_m <= point[0] <= extent.width_m + slack_m
        and -slack_m <= point[1] <= extent.height_m + slack_m
    )


def _clip(path: list[list[float]], extent: Extent, *, closed: bool = False) -> list[list[float]]:
    """Keep a path if any of it is inside, and trim what is far outside.

    Not a true clip. A vertex survives when it is near the extent **or sits
    next to one that is**, which is what keeps a segment that crosses the
    boundary whole. Dropping the far endpoint of such a segment leaves a
    one-vertex path, and a one-vertex path is not a line — a pipe running into
    the extent from outside would vanish from the map entirely rather than be
    drawn up to the edge.

    The renderer clips at its viewport anyway, so a little overshoot costs
    nothing and a clipping library costs a dependency.
    """
    margin = 25.0
    if not any(_inside(point, extent) for point in path):
        return []

    near = [_inside(point, extent, margin) for point in path]
    kept = [
        point
        for index, point in enumerate(path)
        if near[index]
        or (index > 0 and near[index - 1])
        or (index + 1 < len(path) and near[index + 1])
    ]
    if closed and kept and kept[0] != kept[-1]:
        kept.append(kept[0])
    return kept


def build(
    extent: Extent,
    layers: Sequence[Dataset] = LAYERS,
    *,
    opener: Callable[[str], bytes] | None = None,
    log: Callable[[str], None] = lambda _: None,
) -> dict:
    """Every map layer for the extent, as one artefact."""
    collected: dict[str, list[Feature]] = {}
    sources: list[dict] = []
    for dataset in layers:
        features = fetch_layer(dataset, extent, opener=opener)
        collected[dataset.kind] = features
        sources.append(
            {
                "layer": dataset.kind,
                "dataset_id": dataset.id,
                "publisher": "City of Melbourne Open Data Portal",
                "licence": dataset.licence,
                "last_modified": dataset.modified,
                "features": len(features),
            }
        )
        log(f"  {dataset.kind:<12} {len(features):>5} features from {dataset.id}")

    return {
        "artefact": "map-geometry",
        "version": 1,
        "extent": {
            "name": extent.name,
            "min_e": extent.min_e,
            "min_n": extent.min_n,
            "width_m": extent.width_m,
            "height_m": extent.height_m,
        },
        "coordinates": (
            "Metres east and north of the extent's south-west corner, to a decimetre. "
            "Not latitude and longitude: the renderer works in the extent's own frame, "
            "so no projection runs in the browser."
        ),
        "crs": "EPSG:28355 (MGA Zone 55), origin shifted to the extent corner",
        "sources": sources,
        "layers": {
            kind: [
                {"g": feature.geometry, "c": feature.coordinates, **feature.properties}
                for feature in features
            ]
            for kind, features in collected.items()
        },
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys
    from pathlib import Path

    from .geo import DEMONSTRATION_EXTENT

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.network",
        description="Fetch pit, pipe, road and street-name geometry for the extent.",
    )
    parser.add_argument("--out", type=Path, default=Path("../data/map/map.json"))
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

    log(f"Fetching map geometry for {extent.name}")
    artefact = build(extent, log=log)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    # Compact: this file is served to a browser, and indentation is a third of
    # its size for nothing a reader of the map will ever see.
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")
    log(f"  written to {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
