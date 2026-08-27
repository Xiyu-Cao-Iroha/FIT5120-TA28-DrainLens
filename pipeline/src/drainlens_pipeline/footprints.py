"""Building footprints, as no-flow barriers for the routing surface.

Water runs between buildings, not through them. The conditioned surface needs
to know where they are, and the only honest source for that is the published
footprint dataset.

**The ground filter's object mask is not a substitute.** It marks everything
standing on the ground, which includes tree canopy — and water flows under
trees. Using it as a barrier set would wall off every tree-lined street in the
demonstration extent, which is most of them.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Callable, Iterable

import numpy as np

from .geo import Extent, from_mga55, to_mga55

DATASET = "2020-building-footprints"
EXPORT_URL = (
    f"https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/{DATASET}/exports/geojson"
)

SOURCE = {
    "dataset": "2020 Building Footprints",
    "publisher": "City of Melbourne Open Data Portal",
    "licence": "CC BY 4.0",
    "dataset_id": DATASET,
    "last_modified": "2023-02-26",
}

#: How far a footprint's base may sit above its structure's base and still count
#: as standing on the ground.
#:
#: The dataset models a building as tiers, and an upper tier is a separate
#: footprint with its own base elevation. A tier that starts several metres up
#: is an overhang: it shades the footpath, it does not dam it. Treating one as
#: a barrier would block a street that water really does run down.
#:
#: Half a metre absorbs the dataset's own rounding — base elevations come in
#: half-metre steps — without admitting a first floor.
GROUND_TIER_TOLERANCE_M = 0.5

#: Padding on the fetch bounds, in metres. A building straddling the boundary
#: still dams water inside it, so the query has to reach past the extent.
FETCH_PADDING_M = 100.0


class FootprintError(Exception):
    pass


@dataclass(frozen=True)
class Footprint:
    """One footprint ring, already projected to MGA Zone 55."""

    rings: list[np.ndarray]
    """Each ring is an (n, 2) array of easting and northing. Ring 0 is the
    outline; any others are holes."""

    base_elevation_m: float | None
    height_m: float | None
    on_the_ground: bool


def _bbox_for(extent: Extent, padding_m: float) -> tuple[float, float, float, float]:
    south, west = from_mga55(extent.min_e - padding_m, extent.min_n - padding_m)
    north, east = from_mga55(extent.max_e + padding_m, extent.max_n + padding_m)
    return south, west, north, east


def fetch(
    extent: Extent,
    *,
    padding_m: float = FETCH_PADDING_M,
    opener: Callable[[str], bytes] | None = None,
    timeout: float = 300.0,
) -> list[Footprint]:
    """Every footprint touching the extent, projected into MGA Zone 55."""
    south, west, north, east = _bbox_for(extent, padding_m)
    where = urllib.parse.quote(f"in_bbox(geo_point_2d, {south}, {west}, {north}, {east})")
    url = f"{EXPORT_URL}?where={where}"

    if opener is None:

        def opener(target: str) -> bytes:
            with urllib.request.urlopen(target, timeout=timeout) as response:
                return response.read()

    payload = json.loads(opener(url))
    return parse(payload.get("features", []))


def parse(features: Iterable[dict]) -> list[Footprint]:
    """Turn GeoJSON features into projected footprints."""
    found: list[Footprint] = []
    for feature in features:
        geometry = feature.get("geometry") or {}
        properties = feature.get("properties") or {}
        polygons = _polygons_of(geometry)
        if not polygons:
            continue

        base = properties.get("footprint_min_elevation")
        structure_base = properties.get("structure_min_elevation")
        if base is None or structure_base is None:
            # Nothing says it is lifted, so it is treated as standing on the
            # ground. A barrier that should not be there blocks one building's
            # worth of street; a missing one lets water through a wall.
            on_the_ground = True
        else:
            on_the_ground = base - structure_base <= GROUND_TIER_TOLERANCE_M

        for rings in polygons:
            found.append(
                Footprint(
                    rings=[_project(ring) for ring in rings],
                    base_elevation_m=base,
                    height_m=properties.get("footprint_extrusion"),
                    on_the_ground=on_the_ground,
                )
            )
    return found


def _polygons_of(geometry: dict) -> list[list[list]]:
    kind = geometry.get("type")
    if kind == "Polygon":
        return [geometry["coordinates"]]
    if kind == "MultiPolygon":
        return list(geometry["coordinates"])
    return []


def _project(ring: list) -> np.ndarray:
    # GeoJSON is longitude then latitude; `to_mga55` takes latitude first, and
    # swapping them lands the extent in the Southern Ocean.
    return np.array([to_mga55(point[1], point[0]) for point in ring], dtype=np.float64)


def barrier_mask(
    footprints: Iterable[Footprint],
    extent: Extent,
    cell_size_m: float,
    *,
    ground_only: bool = True,
) -> np.ndarray:
    """Rasterise footprints onto the terrain grid, north-up.

    A cell is a barrier when its centre falls inside a footprint. Centres
    rather than any-overlap: a building whose wall clips the corner of a cell
    does not dam the whole square metre.
    """
    cols = int(round((extent.max_e - extent.min_e) / cell_size_m))
    rows = int(round((extent.max_n - extent.min_n) / cell_size_m))
    if rows < 1 or cols < 1:
        raise FootprintError("the extent is smaller than one cell")

    mask = np.zeros((rows, cols), dtype=bool)
    for footprint in footprints:
        if ground_only and not footprint.on_the_ground:
            continue
        inside = None
        for index, ring in enumerate(footprint.rings):
            filled = _rasterise_ring(ring, extent, cell_size_m, rows, cols)
            if filled is None:
                break
            if index == 0:
                inside = filled
            elif inside is not None:
                inside &= ~filled  # a hole: a courtyard is open to the sky
        if inside is not None:
            mask |= inside
    return mask


def _rasterise_ring(
    ring: np.ndarray, extent: Extent, cell_size_m: float, rows: int, cols: int
) -> np.ndarray | None:
    """Even-odd fill of one ring, evaluated only over its own bounding box."""
    if len(ring) < 3:
        return None

    col_lo = int(np.floor((ring[:, 0].min() - extent.min_e) / cell_size_m))
    col_hi = int(np.ceil((ring[:, 0].max() - extent.min_e) / cell_size_m))
    row_lo = rows - 1 - int(np.ceil((ring[:, 1].max() - extent.min_n) / cell_size_m))
    row_hi = rows - 1 - int(np.floor((ring[:, 1].min() - extent.min_n) / cell_size_m))

    col_lo, col_hi = max(col_lo, 0), min(col_hi, cols - 1)
    row_lo, row_hi = max(row_lo, 0), min(row_hi, rows - 1)
    if col_lo > col_hi or row_lo > row_hi:
        return None  # entirely outside the extent

    columns = np.arange(col_lo, col_hi + 1)
    grid_rows = np.arange(row_lo, row_hi + 1)
    x = extent.min_e + (columns + 0.5) * cell_size_m
    y = extent.min_n + (rows - 1 - grid_rows + 0.5) * cell_size_m
    xx, yy = np.meshgrid(x, y)

    crossings = np.zeros(xx.shape, dtype=bool)
    x0, y0 = ring[:-1, 0], ring[:-1, 1]
    x1, y1 = ring[1:, 0], ring[1:, 1]
    for ax, ay, bx, by in zip(x0, y0, x1, y1):
        if ay == by:
            continue
        straddles = (ay > yy) != (by > yy)
        with np.errstate(invalid="ignore", divide="ignore"):
            boundary = (bx - ax) * (yy - ay) / (by - ay) + ax
        crossings ^= straddles & (xx < boundary)

    filled = np.zeros((rows, cols), dtype=bool)
    filled[row_lo : row_hi + 1, col_lo : col_hi + 1] = crossings
    return filled
