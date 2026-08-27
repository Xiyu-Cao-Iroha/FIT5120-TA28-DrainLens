"""Tests for footprint fetching and rasterising.

No network. The fetch is driven through an injected opener so the parsing,
projection and rasterising are all exercised against payloads shaped like the
real ones but written here, where the expected answer is known.
"""

from __future__ import annotations

import json

import numpy as np
import pytest

from drainlens_pipeline import footprints as fp
from drainlens_pipeline.geo import Extent, from_mga55, to_mga55

# A 100 m square with its south-west corner on a round MGA coordinate, so grid
# indices are easy to reason about: cell (row, col) covers a whole metre.
EXTENT = Extent("test", 316_500.0, 5_814_500.0, 316_600.0, 5_814_600.0)
CELL = 1.0


def square(min_e: float, min_n: float, size: float) -> list[list[float]]:
    """A closed ring in GeoJSON order — longitude first, latitude second."""
    corners = [
        (min_e, min_n),
        (min_e + size, min_n),
        (min_e + size, min_n + size),
        (min_e, min_n + size),
        (min_e, min_n),
    ]
    return [[lon, lat] for lat, lon in (from_mga55(e, n) for e, n in corners)]


def feature(rings: list, *, base: float = 10.0, structure_base: float = 10.0, height: float = 6.0) -> dict:
    return {
        "geometry": {"type": "Polygon", "coordinates": rings},
        "properties": {
            "footprint_min_elevation": base,
            "structure_min_elevation": structure_base,
            "footprint_extrusion": height,
        },
    }


class TestParse:
    def test_projects_a_ring_back_to_where_it_came_from(self):
        parsed = fp.parse([feature([square(316_520.0, 5_814_520.0, 20.0)])])
        assert len(parsed) == 1
        ring = parsed[0].rings[0]
        assert ring[:, 0].min() == pytest.approx(316_520.0, abs=1e-3)
        assert ring[:, 1].max() == pytest.approx(5_814_540.0, abs=1e-3)

    def test_longitude_and_latitude_are_not_swapped(self):
        # Reversed, this lands in the Southern Ocean about 8,000 km away, and
        # the only symptom would be an empty barrier mask.
        parsed = fp.parse([feature([square(316_520.0, 5_814_520.0, 20.0)])])
        easting, northing = parsed[0].rings[0][0]
        assert 316_000 < easting < 318_000
        assert 5_814_000 < northing < 5_816_000

    def test_a_multipolygon_becomes_several_footprints(self):
        geometry = {
            "type": "MultiPolygon",
            "coordinates": [
                [square(316_510.0, 5_814_510.0, 10.0)],
                [square(316_550.0, 5_814_550.0, 10.0)],
            ],
        }
        parsed = fp.parse([{"geometry": geometry, "properties": {}}])
        assert len(parsed) == 2

    def test_a_tier_starting_at_the_structure_base_stands_on_the_ground(self):
        parsed = fp.parse([feature([square(316_510.0, 5_814_510.0, 10.0)], base=10.0, structure_base=10.0)])
        assert parsed[0].on_the_ground

    def test_a_tier_starting_well_above_it_is_an_overhang(self):
        parsed = fp.parse([feature([square(316_510.0, 5_814_510.0, 10.0)], base=16.0, structure_base=10.0)])
        assert not parsed[0].on_the_ground

    def test_half_a_metre_of_rounding_still_counts_as_the_ground(self):
        # The published base elevations come in half-metre steps.
        parsed = fp.parse([feature([square(316_510.0, 5_814_510.0, 10.0)], base=10.5, structure_base=10.0)])
        assert parsed[0].on_the_ground

    def test_a_footprint_with_no_elevations_is_assumed_to_be_on_the_ground(self):
        parsed = fp.parse([{"geometry": {"type": "Polygon", "coordinates": [square(316_510.0, 5_814_510.0, 10.0)]}, "properties": {}}])
        assert parsed[0].on_the_ground

    def test_features_without_usable_geometry_are_skipped(self):
        assert fp.parse([{"geometry": None, "properties": {}}]) == []
        assert fp.parse([{"geometry": {"type": "Point", "coordinates": [1, 2]}, "properties": {}}]) == []


class TestBarrierMask:
    def test_a_square_building_covers_the_cells_it_sits_on(self):
        parsed = fp.parse([feature([square(316_520.0, 5_814_520.0, 10.0)])])
        mask = fp.barrier_mask(parsed, EXTENT, CELL)

        # Rows count from the north, so northing 5,814,520–530 is rows 70–79.
        assert mask.sum() == pytest.approx(100, abs=4), "a 10 m square is about 100 square metres"
        assert mask[70:80, 20:30].all()
        assert not mask[0:60, :].any(), "and nothing north of it"

    def test_the_footprint_lands_where_the_coordinates_say(self):
        parsed = fp.parse([feature([square(316_580.0, 5_814_505.0, 10.0)])])
        rows, cols = np.nonzero(fp.barrier_mask(parsed, EXTENT, CELL))
        assert cols.min() >= 79 and cols.max() <= 90, "eastings 580–590 are the eastern edge"
        assert rows.min() >= 84, "northings 505–515 are near the southern edge"

    def test_a_courtyard_is_open_to_the_sky(self):
        outline = square(316_520.0, 5_814_520.0, 30.0)
        hole = square(316_530.0, 5_814_530.0, 10.0)
        parsed = fp.parse([{"geometry": {"type": "Polygon", "coordinates": [outline, hole]}, "properties": {}}])
        mask = fp.barrier_mask(parsed, EXTENT, CELL)
        assert mask[60:63, 22:25].all(), "the built part is a barrier"
        assert not mask[65:69, 32:36].any(), "the courtyard is not"

    def test_an_overhang_is_excluded_by_default_and_included_on_request(self):
        parsed = fp.parse([feature([square(316_520.0, 5_814_520.0, 10.0)], base=16.0, structure_base=10.0)])
        assert not fp.barrier_mask(parsed, EXTENT, CELL).any()
        assert fp.barrier_mask(parsed, EXTENT, CELL, ground_only=False).any()

    def test_a_building_outside_the_extent_contributes_nothing(self):
        parsed = fp.parse([feature([square(320_000.0, 5_820_000.0, 10.0)])])
        assert not fp.barrier_mask(parsed, EXTENT, CELL).any()

    def test_a_building_straddling_the_boundary_is_clipped_not_dropped(self):
        # It still dams water on the inside, so the part within the extent has
        # to survive. This is why the fetch reaches past the extent at all.
        parsed = fp.parse([feature([square(316_490.0, 5_814_540.0, 20.0)])])
        mask = fp.barrier_mask(parsed, EXTENT, CELL)
        assert mask.any()
        assert mask[:, 0:10].any(), "the half inside the extent is a barrier"

    def test_a_degenerate_ring_is_ignored(self):
        parsed = fp.parse([{"geometry": {"type": "Polygon", "coordinates": [[[144.92, -37.79], [144.92, -37.79]]]}, "properties": {}}])
        assert not fp.barrier_mask(parsed, EXTENT, CELL).any()

    def test_the_grid_matches_the_extent_and_cell_size(self):
        assert fp.barrier_mask([], EXTENT, CELL).shape == (100, 100)
        assert fp.barrier_mask([], EXTENT, 2.0).shape == (50, 50)

    def test_rejects_an_extent_smaller_than_a_cell(self):
        tiny = Extent("tiny", 0.0, 0.0, 0.4, 0.4)
        with pytest.raises(fp.FootprintError, match="smaller than one cell"):
            fp.barrier_mask([], tiny, CELL)


class TestFetch:
    def test_asks_for_a_box_that_reaches_past_the_extent(self):
        seen: list[str] = []

        def opener(url: str) -> bytes:
            seen.append(url)
            return json.dumps({"features": []}).encode()

        fp.fetch(EXTENT, padding_m=100.0, opener=opener)
        assert len(seen) == 1

        south, west, north, east = fp._bbox_for(EXTENT, 100.0)
        inner_south, inner_west = from_mga55(EXTENT.min_e, EXTENT.min_n)
        assert south < inner_south and west < inner_west, "the box reaches south-west of the extent"
        assert "in_bbox" in seen[0] and fp.DATASET in seen[0]

    def test_parses_what_comes_back(self):
        payload = json.dumps(
            {"features": [feature([square(316_520.0, 5_814_520.0, 10.0)])]}
        ).encode()
        parsed = fp.fetch(EXTENT, opener=lambda _: payload)
        assert len(parsed) == 1
        assert parsed[0].height_m == 6.0

    def test_an_empty_answer_is_not_an_error(self):
        assert fp.fetch(EXTENT, opener=lambda _: b'{"features": []}') == []


class TestSourceRecord:
    def test_names_the_dataset_and_its_licence(self):
        assert fp.SOURCE["licence"] == "CC BY 4.0"
        assert fp.SOURCE["dataset_id"] == fp.DATASET
        assert fp.SOURCE["publisher"].startswith("City of Melbourne")

    def test_the_module_says_why_the_object_mask_is_not_a_substitute(self):
        # Half of what the ground filter removes is not a building. Anyone
        # reaching for the cheaper mask needs to meet that fact first.
        assert "canopy" in (fp.__doc__ or "")
        assert "not a substitute" in (fp.__doc__ or "")
