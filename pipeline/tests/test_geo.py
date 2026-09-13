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
    CITY_OF_MELBOURNE,
    DEMONSTRATION_EXTENT,
    EXTENTS,
    RESERVE_ADDRESS,
    TILE_SIZE_M,
    Extent,
    tile_bounds,
    tile_name,
    tile_of,
    resolve_extent,
    from_mga55,
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


class TestInverseProjection:
    """The inverse is solved numerically on the forward projection, so the round
    trip is the test: it inherits whatever agreement the forward one has, and
    the forward one matches the published eastings and northings across all
    63,721 address records to within a millimetre."""

    def test_it_round_trips_across_greater_melbourne(self):
        import random

        random.seed(1)
        worst = 0.0
        for _ in range(500):
            easting = random.uniform(310_000, 330_000)
            northing = random.uniform(5_805_000, 5_825_000)
            back = to_mga55(*from_mga55(easting, northing))
            worst = max(worst, abs(back[0] - easting), abs(back[1] - northing))
        assert worst < 1e-3, f"worst round-trip error {worst * 1000:.4f} mm"

    def test_the_demonstration_extent_lands_in_kensington(self):
        latitude, longitude = from_mga55(DEMONSTRATION_EXTENT.min_e, DEMONSTRATION_EXTENT.min_n)
        assert -37.81 < latitude < -37.78
        assert 144.90 < longitude < 144.94


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


class TestTheCouncilWideExtent:
    """Everywhere the City of Melbourne publishes a drainage record.

    The figures are asserted rather than described because they were measured
    from ``data/graph/drainage-graph.json`` -- 21,113 pits, all of them with a
    position -- and that file is a build product nobody reruns by accident. A
    number in a comment drifts; a number in a test fails.
    """

    def test_it_covers_every_pit_the_council_publishes(self):
        # The measured span is 7,971 m east-west and 8,237 m north-south, from
        # 315,193 / 5,808,872 to 323,164 / 5,817,109. The extent has to hold
        # that with room, and this is the assertion that says so.
        assert CITY_OF_MELBOURNE.contains(315_193, 5_808_872)
        assert CITY_OF_MELBOURNE.contains(323_164, 5_817_109)

    def test_it_sits_on_the_point_clouds_own_tile_grid(self):
        # Rounded outward to 500 m because a future terrain build has to line
        # up with those tiles; an extent that straddles them makes every tile
        # a partial one.
        for value in (
            CITY_OF_MELBOURNE.min_e,
            CITY_OF_MELBOURNE.min_n,
            CITY_OF_MELBOURNE.max_e,
            CITY_OF_MELBOURNE.max_n,
        ):
            assert value % TILE_SIZE_M == 0

    def test_it_is_eight_and_a_half_by_nine_kilometres(self):
        assert (CITY_OF_MELBOURNE.width_m, CITY_OF_MELBOURNE.height_m) == (8500.0, 9000.0)
        assert CITY_OF_MELBOURNE.width_m * CITY_OF_MELBOURNE.height_m / 1e6 == 76.5

    def test_it_swallows_the_demonstration_extent_whole(self):
        # Kensington has to stay addressable inside it, because the terrain and
        # everything derived from it are staying at that extent for now.
        assert CITY_OF_MELBOURNE.contains(DEMONSTRATION_EXTENT.min_e, DEMONSTRATION_EXTENT.min_n)
        assert CITY_OF_MELBOURNE.contains(
            DEMONSTRATION_EXTENT.max_e - 1, DEMONSTRATION_EXTENT.max_n - 1
        )

    def test_it_touches_more_tiles_than_the_archive_holds(self):
        # 306 against the archive's 215. The box is bigger than the data: only
        # 56 of its 72 square kilometres contain a pit at all -- the Yarra, the
        # parks, and land the council does not drain. A terrain build over this
        # extent will not find a tile for every square it covers, and that is a
        # fact about the city rather than a missing download.
        assert len(CITY_OF_MELBOURNE.tile_names()) == 306


class TestResolvingAnExtentByName:
    def test_it_finds_each_published_extent(self):
        assert resolve_extent("kensington") is DEMONSTRATION_EXTENT
        assert resolve_extent("city-of-melbourne") is CITY_OF_MELBOURNE

    def test_it_defaults_to_the_demonstration_extent(self):
        assert resolve_extent(None) is DEMONSTRATION_EXTENT

    def test_a_name_beats_raw_bounds(self):
        # A published name is a claim the artefacts have to agree on; four
        # numbers on a command line are a one-off.
        assert resolve_extent("kensington", [0, 0, 10, 10]) is DEMONSTRATION_EXTENT

    def test_it_takes_raw_bounds_for_a_one_off(self):
        extent = resolve_extent(None, [1000, 2000, 1500, 2500])
        assert (extent.name, extent.width_m, extent.height_m) == ("custom", 500, 500)

    def test_it_refuses_an_unknown_name_rather_than_falling_back(self):
        # A build that quietly produced Kensington when it was asked for the
        # council is a build whose output nobody can tell apart from the right
        # one.
        with pytest.raises(SystemExit, match="unknown extent"):
            resolve_extent("nowhere")

    def test_it_refuses_bounds_that_are_not_four_numbers(self):
        with pytest.raises(SystemExit, match="four numbers"):
            resolve_extent(None, [1, 2, 3])

    def test_every_registered_extent_is_keyed_by_its_own_name(self):
        # The failure this catches: an extent added to the registry under a
        # different key from its `name`, so the API serves `/api/map/foo` and
        # the artefact inside says it is `bar`.
        for key, extent in EXTENTS.items():
            assert key == extent.name


class TestTheCentralCity:
    def test_it_sits_on_the_tile_grid(self):
        from drainlens_pipeline.geo import MELBOURNE_CBD

        for value in (MELBOURNE_CBD.min_e, MELBOURNE_CBD.min_n, MELBOURNE_CBD.max_e, MELBOURNE_CBD.max_n):
            assert value % TILE_SIZE_M == 0

    def test_it_reaches_every_corner_of_the_hoddle_grid(self):
        # Measured from the council's street centrelines. The 2 x 2 km guess
        # made before measuring missed the Flinders Street edge.
        from drainlens_pipeline.geo import MELBOURNE_CBD

        for easting, northing in (
            (319_126.0, 5_812_723.0),  # Spencer / La Trobe
            (319_772.0, 5_811_968.0),  # Spencer / Flinders
            (321_728.0, 5_812_741.0),  # Spring / Flinders
            (321_379.0, 5_813_602.0),  # Spring / La Trobe
        ):
            assert MELBOURNE_CBD.contains(easting, northing)

    def test_it_is_thirty_tiles_inside_the_council_and_clear_of_kensington(self):
        from drainlens_pipeline.geo import MELBOURNE_CBD

        assert len(MELBOURNE_CBD.tile_names()) == 30
        assert resolve_extent("melbourne-cbd") is MELBOURNE_CBD
        assert CITY_OF_MELBOURNE.contains(MELBOURNE_CBD.min_e, MELBOURNE_CBD.min_n)
        assert CITY_OF_MELBOURNE.contains(MELBOURNE_CBD.max_e - 1, MELBOURNE_CBD.max_n - 1)
        assert not MELBOURNE_CBD.contains(DEMONSTRATION_EXTENT.min_e, DEMONSTRATION_EXTENT.min_n)
