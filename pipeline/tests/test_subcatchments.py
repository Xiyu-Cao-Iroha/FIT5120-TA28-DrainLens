"""The subcatchment layer: what is asked for, and what is published.

The service answers in the frame this project already uses, which removes the
projection step every other layer needs and with it the mistake that step can
make. What it does not remove is the two failures an ArcGIS query returns with
HTTP 200 -- a refused query and a capped answer -- and both look from here like
a shorter list of areas.
"""

from __future__ import annotations

import pytest

from drainlens_pipeline import subcatchments as sc
from drainlens_pipeline.geo import Extent

EXTENT = Extent(name="test", min_e=315_000.0, min_n=5_808_500.0, max_e=315_500.0, max_n=5_809_000.0)


def polygon(*rings: list[tuple[float, float]], **properties) -> dict:
    return {
        "geometry": {"type": "Polygon", "coordinates": [[[x, y] for x, y in ring] for ring in rings]},
        "properties": {"SUB_CATCHMENT_NBR": "4400", "SUB_CATCHMENT_NAME": "TEST DRAIN", **properties},
    }


def square(e: float, n: float, side: float) -> list[tuple[float, float]]:
    return [(e, n), (e + side, n), (e + side, n + side), (e, n + side), (e, n)]


class TestWhatIsAskedFor:
    def test_the_box_is_the_extent_plus_padding(self):
        url = sc.query_url(EXTENT, padding_m=100.0)
        assert "geometry=314900.0%2C5808400.0%2C315600.0%2C5809100.0" in url

    def test_both_sides_of_the_request_are_mga_zone_55(self):
        # The one layer that needs no projection, because the service speaks
        # the frame the rest of the pipeline already works in.
        url = sc.query_url(EXTENT)
        assert "inSR=28355" in url and "outSR=28355" in url

    def test_every_kept_field_is_asked_for_by_name(self):
        url = sc.query_url(EXTENT)
        for field in sc.KEEP:
            assert field in url

    def test_the_area_and_its_dates_are_among_them(self):
        # AC 6.1.3 shows the recorded area and AC 6.1.4 the record's own date.
        assert "AREA_SQ_KM" in sc.KEEP
        assert "DATE_LAST_UPDATED" in sc.KEEP and "DATE_CAPTURED" in sc.KEEP


class TestTheTwoFailuresThatLookLikeSuccess:
    def test_a_refused_query_is_not_an_empty_map(self):
        with pytest.raises(sc.SubcatchmentError, match="refused"):
            sc.features_of({"error": {"message": "Invalid geometry"}})

    def test_a_capped_answer_is_refused_rather_than_published_short(self):
        # ArcGIS returns the first page and a flag. Publishing it would drop
        # areas silently, and a missing area is an address with no drainage
        # area that the data says it has.
        with pytest.raises(sc.SubcatchmentError, match="capped"):
            sc.features_of({"features": [polygon(square(0, 0, 10))], "exceededTransferLimit": True})

    def test_no_areas_at_all_is_an_error_too(self):
        with pytest.raises(sc.SubcatchmentError, match="no areas"):
            sc.features_of({"features": []})


class TestGeometry:
    def test_a_multipolygon_keeps_every_ring(self):
        geometry = {
            "type": "MultiPolygon",
            "coordinates": [[[[0, 0], [10, 0], [10, 10], [0, 0]]], [[[20, 20], [30, 20], [30, 30], [20, 20]]]],
        }
        assert len(sc.rings_of(geometry)) == 2

    def test_a_line_is_not_an_area(self):
        with pytest.raises(sc.SubcatchmentError, match="not a polygon"):
            sc.rings_of({"type": "LineString", "coordinates": [[0, 0], [1, 1]]})

    def test_coordinates_become_metres_from_the_extent_corner(self):
        [ring] = sc.into_extent([square(EXTENT.min_e + 100, EXTENT.min_n + 200, 50)], EXTENT)
        assert (100.0, 200.0) in ring

    def test_a_boundary_outside_the_extent_is_kept_whole(self):
        # AC 6.1.1 asks for the complete boundary. An area reaching two
        # kilometres north keeps its northern edge, past the extent's height.
        [ring] = sc.into_extent([square(EXTENT.min_e, EXTENT.min_n - 400, 2_000)], EXTENT)
        assert min(y for _, y in ring) == -400.0
        assert max(y for _, y in ring) > EXTENT.height_m

    def test_the_repeated_closing_vertex_is_dropped(self):
        [ring] = sc.into_extent([square(EXTENT.min_e, EXTENT.min_n, 100)], EXTENT)
        assert len(ring) == 4
        assert ring[0] != ring[-1]

    def test_a_ring_that_simplifies_to_nothing_is_dropped(self):
        sliver = [(EXTENT.min_e, EXTENT.min_n), (EXTENT.min_e + 1, EXTENT.min_n), (EXTENT.min_e + 2, EXTENT.min_n)]
        assert sc.into_extent([sliver], EXTENT, tolerance=5.0) == ()


class TestDates:
    def test_epoch_milliseconds_become_a_day(self):
        # What the feature service sends.
        assert sc.day_of(1384905600000) == "2013-11-20"

    def test_the_csv_export_s_american_order_is_read_as_written(self):
        assert sc.day_of("11/20/2013 12:00:00 AM") == "2013-11-20"

    def test_anything_else_is_kept_rather_than_guessed_at(self):
        # A year shown on the card from a date read wrongly is a wrong year
        # nobody can see is wrong.
        assert sc.day_of("2013-11-20") == "2013-11-20"
        assert sc.day_of("") is None
        assert sc.day_of(None) is None


class TestConvert:
    def test_an_area_without_a_number_or_a_name_is_refused(self):
        feature = polygon(square(EXTENT.min_e, EXTENT.min_n, 100))
        feature["properties"]["SUB_CATCHMENT_NAME"] = "  "
        with pytest.raises(sc.SubcatchmentError, match="no number or no name"):
            sc.convert([feature], EXTENT)

    def test_areas_come_back_in_number_order(self):
        far = polygon(square(EXTENT.min_e, EXTENT.min_n, 100), SUB_CATCHMENT_NBR="4900")
        near = polygon(square(EXTENT.min_e, EXTENT.min_n, 100), SUB_CATCHMENT_NBR="4100")
        assert [area.number for area in sc.convert([far, near], EXTENT)] == ["4100", "4900"]

    def test_the_wider_names_and_the_dates_survive(self):
        feature = polygon(
            square(EXTENT.min_e, EXTENT.min_n, 100),
            MAJOR_CATCHMENT_NAME="YARRA RIVER",
            PRIMARY_CATCHMENT_NAME="YARRA RIVER",
            RIVER_BASIN_CATCHMENT_NAME="Yarra",
            AREA_SQ_KM=0.92,
            DATE_LAST_UPDATED="11/20/2013 12:00:00 AM",
        )
        [area] = sc.convert([feature], EXTENT)
        assert area.major_name == "YARRA RIVER"
        assert area.basin_name == "Yarra"
        assert area.area_sq_km == 0.92
        assert area.last_updated == "2013-11-20"

    def test_the_recorded_area_is_taken_and_not_computed(self):
        # A 100 m square is 0.01 km², and the record says 0.92. The record is
        # what AC 6.1.3 shows: a number this project worked out from a
        # simplified ring would be its own figure wearing Melbourne Water's.
        feature = polygon(square(EXTENT.min_e, EXTENT.min_n, 100), AREA_SQ_KM=0.92)
        [area] = sc.convert([feature], EXTENT)
        assert area.area_sq_km == 0.92


class TestArtefact:
    def test_it_says_what_it_is_and_what_it_is_not(self):
        artefact = sc.build(EXTENT, [polygon(square(EXTENT.min_e, EXTENT.min_n, 100))])
        assert artefact["artefact"] == "subcatchments"
        assert "flood extent" in artefact["note"]
        assert artefact["source"]["publisher"] == "Melbourne Water Corporation"

    def test_it_records_the_tolerance_it_was_drawn_at(self):
        artefact = sc.build(EXTENT, [polygon(square(EXTENT.min_e, EXTENT.min_n, 100))], tolerance=2.0)
        assert artefact["settings"]["simplified_m"] == 2.0

    def test_it_counts_what_it_carries(self):
        artefact = sc.build(
            EXTENT,
            [
                polygon(square(EXTENT.min_e, EXTENT.min_n, 100)),
                polygon(square(EXTENT.min_e, EXTENT.min_n, 200), SUB_CATCHMENT_NBR="4401"),
            ],
        )
        assert artefact["counts"]["areas"] == 2
        assert artefact["counts"]["vertices"] == 8

    def test_an_absent_field_is_absent_rather_than_null(self):
        artefact = sc.build(EXTENT, [polygon(square(EXTENT.min_e, EXTENT.min_n, 100))])
        [area] = artefact["areas"]
        assert "areaSqKm" not in area and "lastUpdated" not in area

    def test_the_fetch_asks_the_service_once_and_reads_its_features(self):
        asked: list[str] = []

        def get(url: str) -> dict:
            asked.append(url)
            return {"features": [polygon(square(EXTENT.min_e, EXTENT.min_n, 100))]}

        features = sc.fetch(EXTENT, get=get)
        assert len(asked) == 1 and len(features) == 1
