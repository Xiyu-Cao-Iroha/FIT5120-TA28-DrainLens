"""Projection, the point-cloud tile grid, and the demonstration extent.

Everything here is stated as data rather than left in someone's head, because
three workstreams need the same answer to "which tiles?" and "is this address
inside?" and they must not each derive it.

The source data is published in MGA Zone 55 (GDA94), which is UTM zone 55 on
GRS80. The forward projection below agrees with the eastings and northings
published alongside latitude and longitude in the City of Melbourne address
dataset to within a millimetre, across all 63,721 records.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Final, Iterator

# --- GDA94 / MGA Zone 55 -------------------------------------------------
_A: Final = 6378137.0
_F: Final = 1 / 298.257222101
_K0: Final = 0.9996
_E2: Final = _F * (2 - _F)
_EP2: Final = _E2 / (1 - _E2)
_LON0: Final = math.radians(147.0)
_FALSE_EASTING: Final = 500000.0
_FALSE_NORTHING: Final = 10000000.0

EPSG_MGA55: Final = 28355


def to_mga55(latitude: float, longitude: float) -> tuple[float, float]:
    """Project geographic coordinates to MGA Zone 55 easting and northing."""
    lat, lon = math.radians(latitude), math.radians(longitude)
    n = _A / math.sqrt(1 - _E2 * math.sin(lat) ** 2)
    t = math.tan(lat) ** 2
    c = _EP2 * math.cos(lat) ** 2
    a = math.cos(lat) * (lon - _LON0)
    m = _A * (
        (1 - _E2 / 4 - 3 * _E2**2 / 64 - 5 * _E2**3 / 256) * lat
        - (3 * _E2 / 8 + 3 * _E2**2 / 32 + 45 * _E2**3 / 1024) * math.sin(2 * lat)
        + (15 * _E2**2 / 256 + 45 * _E2**3 / 1024) * math.sin(4 * lat)
        - (35 * _E2**3 / 3072) * math.sin(6 * lat)
    )
    easting = _FALSE_EASTING + _K0 * n * (
        a + (1 - t + c) * a**3 / 6 + (5 - 18 * t + t**2 + 72 * c - 58 * _EP2) * a**5 / 120
    )
    northing = _FALSE_NORTHING + _K0 * (
        m
        + n
        * math.tan(lat)
        * (
            a**2 / 2
            + (5 - t + 9 * c + 4 * c**2) * a**4 / 24
            + (61 - 58 * t + t**2 + 600 * c - 330 * _EP2) * a**6 / 720
        )
    )
    return easting, northing


# --- the point-cloud tile grid -------------------------------------------
#: Fixed by reading the header of Tile_+007_+003, which reports
#: X 316,500–317,000 and Y 5,808,500–5,809,000.
TILE_ORIGIN_E: Final = 313000.0
TILE_ORIGIN_N: Final = 5807000.0
TILE_SIZE_M: Final = 500.0


def tile_of(easting: float, northing: float) -> tuple[int, int]:
    """The tile a point falls in, as the indices used in the archive names."""
    return (
        math.floor((easting - TILE_ORIGIN_E) / TILE_SIZE_M),
        math.floor((northing - TILE_ORIGIN_N) / TILE_SIZE_M),
    )


def tile_name(tx: int, ty: int) -> str:
    """Archive member name for a tile, e.g. `Tile_+007_+015`."""
    return f"Tile_{tx:+04d}_{ty:+04d}"


def tile_bounds(tx: int, ty: int) -> tuple[float, float, float, float]:
    """Easting and northing bounds of a tile, as (min_e, min_n, max_e, max_n)."""
    e = TILE_ORIGIN_E + tx * TILE_SIZE_M
    n = TILE_ORIGIN_N + ty * TILE_SIZE_M
    return e, n, e + TILE_SIZE_M, n + TILE_SIZE_M


@dataclass(frozen=True)
class Extent:
    """A rectangular build extent in MGA Zone 55."""

    name: str
    min_e: float
    min_n: float
    max_e: float
    max_n: float

    def __post_init__(self) -> None:
        if self.max_e <= self.min_e or self.max_n <= self.min_n:
            raise ValueError(f"extent {self.name!r} has no area")

    @property
    def width_m(self) -> float:
        return self.max_e - self.min_e

    @property
    def height_m(self) -> float:
        return self.max_n - self.min_n

    def contains(self, easting: float, northing: float) -> bool:
        """Half-open on the upper edges, so adjacent extents do not overlap."""
        return self.min_e <= easting < self.max_e and self.min_n <= northing < self.max_n

    def contains_lat_lon(self, latitude: float, longitude: float) -> bool:
        return self.contains(*to_mga55(latitude, longitude))

    def tiles(self) -> Iterator[tuple[int, int]]:
        """Every tile the extent touches, west to east then south to north."""
        tx0, ty0 = tile_of(self.min_e, self.min_n)
        tx1, ty1 = tile_of(self.max_e - 1e-6, self.max_n - 1e-6)
        for ty in range(ty0, ty1 + 1):
            for tx in range(tx0, tx1 + 1):
                yield tx, ty

    def tile_names(self) -> list[str]:
        return [tile_name(tx, ty) for tx, ty in self.tiles()]


#: The Iteration 1 demonstration extent.
#:
#: Chosen by measurement rather than by eye — see docs/DEMO-EXTENT.md. Kensington
#: rather than the CBD because the point cloud is photogrammetric: in the CBD the
#: median height above the floor of a 10 m cell is 12–17 m and only 11–17% of
#: cells are open ground, so its terrain is mostly inferred. Kensington is
#: low-rise, its western tiles sit at 0.6–7.4 m AHD, and its ground is measured.
DEMONSTRATION_EXTENT: Final = Extent(
    name="kensington",
    min_e=316500.0,
    min_n=5814500.0,
    max_e=317500.0,
    max_n=5815500.0,
)

#: The address the demonstration opens on. 62 inlet-type pits within 150 m, the
#: nearest 24 m away, and a downstream trace that runs 22 hops before it ends.
DEMONSTRATION_ADDRESS: Final = "46 Gatehouse Drive, Kensington"

#: Used if the primary address disappoints on the real terrain: 71 inlets within
#: 150 m, the nearest 3 m away, an 18-hop trace.
RESERVE_ADDRESS: Final = "13 Neale Street, Kensington"
