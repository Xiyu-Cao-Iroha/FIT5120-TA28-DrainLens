"""Tests for the projection, the tile grid and the demonstration extent.

The projection fixtures are real City of Melbourne address records, which
publish latitude and longitude *and* easting and northing for the same point.
That makes them ground truth rather than a value copied out of our own code —
the whole dataset agrees to within a millimetre.
"""

from __future__ import annotations

import pytest

from drainlens_pipeline.geo import (
    DEMONSTRATION_ADDRESS,
    DEMONSTRATION_EXTENT,
    RESERVE_ADDRESS,
    TILE_SIZE_M,
    Extent,
    tile_bounds,
    tile_name,
    tile_of,
    to_mga55,
)

# latitude, longitude, published easting, published northing, address
PUBLISHED = [
    (-37.83099036, 144.90012391, 315203.83243153, 5810859.17870568, "180 Lorimer Street"),
    (-37.79111191, 144.94225714, 318814.627, 5815366.90498077, "1 Alfred Street"),
    (-37.81287311, 144.95656041, 320126.98192851, 5812979.78676242, "515 Little Lonsdale Street"),
    (-37.81107209, 144.96712216, 321052.42517029, 5813199.92491117, "239 Russell Street"),
]


class TestProjection:
    @pytest.mark.parametrize("lat,lon,east,north,label", PUBLISHED)
    def test_agrees_with_the_published_coordinates(self, lat, lon, east, north, label):
        e, n = to_mga55(lat, lon)
        assert e == pytest.approx(east, abs=0.01), label
        assert n == pytest.approx(north, abs=0.01), label

    def test_places_melbourne_inside_zone_55(self):
        # The zone runs 144E to 150E with its central meridian at 147E, so
        # Melbourne sits west of centre and its easting is below the false one.
        e, n = to_mga55(-37.8136, 144.9631)
        assert 300_000 < e < 500_000
        assert 5_800_000 < n < 5_830_000

    def test_easting_grows_eastward_and_northing_grows_northward(self):
        e0, n0 = to_mga55(-37.82, 144.95)
        e1, _ = to_mga55(-37.82, 144.96)
        _, n1 = to_mga55(-37.81, 144.95)
        assert e1 > e0
        assert n1 > n0


class TestTileGrid:
    def test_locates_the_tile_that_fixed_the_grid(self):
        # Tile_+007_+003 reports X 316,500-317,000 and Y 5,808,500-5,809,000.
        assert tile_of(316500.0, 5808500.0) == (7, 3)
        assert tile_of(316999.9, 5808999.9) == (7, 3)
        assert tile_bounds(7, 3) == (316500.0, 5808500.0, 317000.0, 5809000.0)

    def test_names_a_tile_the_way_the_archive_does(self):
        assert tile_name(7, 15) == "Tile_+007_+015"
        assert tile_name(16, 8) == "Tile_+016_+008"

    def test_boundaries_belong_to_the_tile_above_and_right(self):
        # Half-open, so a point on a shared edge lands in exactly one tile.
        assert tile_of(317000.0, 5808500.0) == (8, 3)
        assert tile_of(316500.0, 5809000.0) == (7, 4)

    def test_handles_a_point_below_the_grid_origin(self):
        # floor(), not int(), or a point west of the origin would round toward
        # zero and land in the wrong tile.
        assert tile_of(312999.0, 5806999.0) == (-1, -1)


class TestExtent:
    def test_the_demonstration_extent_is_one_square_kilometre(self):
        e = DEMONSTRATION_EXTENT
        assert e.width_m == 1000.0
        assert e.height_m == 1000.0
        assert e.width_m / TILE_SIZE_M == 2

    def test_it_covers_exactly_the_four_tiles_that_were_profiled(self):
        assert DEMONSTRATION_EXTENT.tile_names() == [
            "Tile_+007_+015",
            "Tile_+008_+015",
            "Tile_+007_+016",
            "Tile_+008_+016",
        ]

    def test_the_demonstration_address_is_inside_it(self):
        # 46 Gatehouse Drive, from the address export.
        assert DEMONSTRATION_EXTENT.contains(316_953.0, 5_814_900.0)

    def test_the_persona_s_old_suburb_is_outside_it(self):
        # Lilydale, roughly. Recorded because D1b turned on exactly this: no
        # council out there publishes drainage data.
        assert not DEMONSTRATION_EXTENT.contains_lat_lon(-37.7565, 145.3480)

    def test_the_cbd_is_outside_it(self):
        assert not DEMONSTRATION_EXTENT.contains_lat_lon(-37.8136, 144.9631)

    def test_upper_edges_are_exclusive_so_extents_do_not_overlap(self):
        e = DEMONSTRATION_EXTENT
        assert e.contains(e.min_e, e.min_n)
        assert not e.contains(e.max_e, e.min_n)
        assert not e.contains(e.min_e, e.max_n)

    def test_an_extent_smaller_than_a_tile_still_names_the_tile(self):
        small = Extent("half", 316500.0, 5814500.0, 316750.0, 5814750.0)
        assert small.tile_names() == ["Tile_+007_+015"]

    def test_refuses_an_extent_with_no_area(self):
        with pytest.raises(ValueError, match="no area"):
            Extent("flat", 1.0, 2.0, 1.0, 5.0)
        with pytest.raises(ValueError, match="no area"):
            Extent("inverted", 10.0, 2.0, 1.0, 5.0)

    def test_names_the_addresses_the_demonstration_uses(self):
        assert "Gatehouse" in DEMONSTRATION_ADDRESS
        assert "Kensington" in DEMONSTRATION_ADDRESS
        assert "Kensington" in RESERVE_ADDRESS
