"""Tests for the map-geometry artefact.

No network: every fetch runs through an injected opener returning payloads
shaped like the portal's, so the projection, the clipping and the per-dataset
query differences are all exercised against known answers.
"""

from __future__ import annotations

import json

import pytest

from drainlens_pipeline import network as nw
from drainlens_pipeline.geo import Extent, from_mga55

EXTENT = Extent("test", 316_500.0, 5_814_500.0, 316_600.0, 5_814_600.0)


def at(east_m: float, north_m: float) -> list[float]:
    """A GeoJSON longitude/latitude pair for a point given in local metres."""
    latitude, longitude = from_mga55(EXTENT.min_e + east_m, EXTENT.min_n + north_m)
    return [longitude, latitude]


def payload(*features: dict) -> bytes:
    return json.dumps({"features": list(features)}).encode()


def point(east_m: float, north_m: float, **properties) -> dict:
    return {
        "geometry": {"type": "Point", "coordinates": at(east_m, north_m)},
        "properties": properties,
    }


def line(points: list[tuple[float, float]], **properties) -> dict:
    return {
        "geometry": {"type": "LineString", "coordinates": [at(e, n) for e, n in points]},
        "properties": properties,
    }


class TestQueryShape:
    def test_a_dataset_with_a_geo_point_uses_in_bbox(self):
        clause = nw.PIPES.where((-37.80, 144.91, -37.79, 144.93))
        assert clause.startswith("in_bbox(geo_point_2d,")

    def test_the_pits_dataset_is_asked_by_bare_columns_instead(self):
        # It carries `lat` and `lon` rather than a geo point, and rejects
        # `in_bbox` with a 400. Recorded here so the next layer added does not
        # rediscover it.
        clause = nw.PITS.where((-37.80, 144.91, -37.79, 144.93))
        assert "in_bbox" not in clause
        assert "lat > -37.8" in clause and "lon < 144.93" in clause

    def test_the_fetch_bounds_reach_past_the_extent(self):
        south, west, north, east = nw.bounds_for(EXTENT, 150.0)
        inner_south, inner_west = from_mga55(EXTENT.min_e, EXTENT.min_n)
        inner_north, inner_east = from_mga55(EXTENT.max_e, EXTENT.max_n)
        assert south < inner_south and west < inner_west
        assert north > inner_north and east > inner_east

    def test_every_layer_names_a_licence_and_a_vintage(self):
        for dataset in nw.LAYERS:
            assert dataset.licence == "CC BY 4.0"
            assert dataset.modified, f"{dataset.id} has no recorded modification date"


class TestConvert:
    def test_a_point_lands_where_its_coordinates_say(self):
        [feature] = nw.convert([point(25.0, 60.0)], nw.PITS, EXTENT)
        assert feature.geometry == "point"
        assert feature.coordinates == pytest.approx([25.0, 60.0], abs=0.15)

    def test_coordinates_are_local_metres_not_degrees(self):
        # Four digits instead of fifteen, and no projection left for the
        # browser to get wrong.
        [feature] = nw.convert([point(25.0, 60.0)], nw.PITS, EXTENT)
        assert all(0 <= value <= 100 for value in feature.coordinates)

    def test_longitude_and_latitude_are_not_swapped(self):
        # Reversed, the whole layer lands in the Southern Ocean and the only
        # symptom is an empty map.
        [feature] = nw.convert([point(50.0, 50.0)], nw.PITS, EXTENT)
        assert feature.coordinates == pytest.approx([50.0, 50.0], abs=0.15)

    def test_only_the_named_properties_survive(self):
        [feature] = nw.convert(
            [point(25.0, 60.0, asset_number=42, grate_width=600, secret="drop me")],
            nw.PITS,
            EXTENT,
        )
        assert feature.properties == {"asset_number": 42}

    def test_a_property_that_is_absent_is_not_invented(self):
        [feature] = nw.convert([point(25.0, 60.0)], nw.PITS, EXTENT)
        assert feature.properties == {}

    def test_a_line_keeps_its_vertices_in_order(self):
        [feature] = nw.convert(
            [line([(10.0, 10.0), (20.0, 30.0), (40.0, 50.0)], ref=7)], nw.PIPES, EXTENT
        )
        assert feature.geometry == "line"
        assert len(feature.coordinates) == 3
        assert feature.coordinates[0] == pytest.approx([10.0, 10.0], abs=0.15)
        assert feature.coordinates[-1] == pytest.approx([40.0, 50.0], abs=0.15)
        assert feature.properties == {"ref": 7}

    def test_a_multilinestring_becomes_one_feature_per_line(self):
        geometry = {
            "type": "MultiLineString",
            "coordinates": [
                [at(10.0, 10.0), at(20.0, 20.0)],
                [at(60.0, 60.0), at(70.0, 70.0)],
            ],
        }
        assert len(nw.convert([{"geometry": geometry, "properties": {}}], nw.PIPES, EXTENT)) == 2

    def test_a_polygon_ring_is_closed(self):
        ring = [at(10.0, 10.0), at(40.0, 10.0), at(40.0, 40.0), at(10.0, 40.0)]
        geometry = {"type": "Polygon", "coordinates": [ring]}
        [feature] = nw.convert([{"geometry": geometry, "properties": {}}], nw.ROADS, EXTENT)
        assert feature.geometry == "polygon"
        assert feature.coordinates[0][0] == feature.coordinates[0][-1]

    def test_something_wholly_outside_the_extent_is_not_shipped(self):
        far = [[144.5, -38.5], [144.6, -38.5]]
        geometry = {"type": "LineString", "coordinates": far}
        assert nw.convert([{"geometry": geometry, "properties": {}}], nw.PIPES, EXTENT) == []
        assert nw.convert([{"geometry": {"type": "Point", "coordinates": far[0]}, "properties": {}}], nw.PITS, EXTENT) == []

    def test_a_pipe_crossing_the_boundary_survives(self):
        # It still runs through the extent, so the map has to draw it. This is
        # why the fetch reaches past the boundary in the first place.
        crossing = nw.convert([line([(-80.0, 50.0), (50.0, 50.0)])], nw.PIPES, EXTENT)
        assert len(crossing) == 1
        assert len(crossing[0].coordinates) >= 2

    def test_geometry_it_does_not_understand_is_skipped_rather_than_guessed(self):
        assert nw.convert([{"geometry": None, "properties": {}}], nw.PITS, EXTENT) == []
        assert nw.convert([{"properties": {}}], nw.PITS, EXTENT) == []
        assert (
            nw.convert(
                [{"geometry": {"type": "GeometryCollection", "geometries": []}, "properties": {}}],
                nw.PITS,
                EXTENT,
            )
            == []
        )

    def test_a_line_of_one_vertex_is_not_a_line(self):
        geometry = {"type": "LineString", "coordinates": [at(10.0, 10.0)]}
        assert nw.convert([{"geometry": geometry, "properties": {}}], nw.PIPES, EXTENT) == []


class TestBuild:
    def opener(self, by_dataset: dict[str, bytes]):
        def read(url: str) -> bytes:
            for dataset_id, response in by_dataset.items():
                if f"/{dataset_id}/" in url:
                    return response
            raise AssertionError(f"unexpected request: {url}")

        return read

    def test_collects_every_layer_under_its_own_key(self):
        artefact = nw.build(
            EXTENT,
            opener=self.opener(
                {
                    nw.ROADS.id: payload(),
                    nw.PIPES.id: payload(line([(10.0, 10.0), (20.0, 20.0)], ref=1)),
                    nw.PITS.id: payload(point(30.0, 30.0, asset_number=9)),
                    nw.STREET_NAMES.id: payload(),
                }
            ),
        )
        assert set(artefact["layers"]) == {"road", "pipe", "pit", "street-name"}
        assert len(artefact["layers"]["pipe"]) == 1
        assert artefact["layers"]["pit"][0]["asset_number"] == 9

    def test_records_the_licence_and_vintage_of_each_source(self):
        empty = {dataset.id: payload() for dataset in nw.LAYERS}
        sources = nw.build(EXTENT, opener=self.opener(empty))["sources"]
        assert {source["layer"] for source in sources} == {"road", "pipe", "pit", "street-name"}
        for source in sources:
            assert source["licence"] == "CC BY 4.0"
            assert source["publisher"].startswith("City of Melbourne")
            assert source["last_modified"]

    def test_says_what_its_coordinates_mean(self):
        empty = {dataset.id: payload() for dataset in nw.LAYERS}
        artefact = nw.build(EXTENT, opener=self.opener(empty))
        assert "south-west corner" in artefact["coordinates"]
        assert "no projection runs in the browser" in artefact["coordinates"]
        assert artefact["extent"]["width_m"] == 100.0

    def test_asks_each_dataset_the_way_that_dataset_accepts(self):
        seen: list[str] = []

        def read(url: str) -> bytes:
            seen.append(url)
            return payload()

        nw.build(EXTENT, opener=read)
        pits = next(url for url in seen if f"/{nw.PITS.id}/" in url)
        pipes = next(url for url in seen if f"/{nw.PIPES.id}/" in url)
        assert "in_bbox" not in pits
        assert "in_bbox" in pipes
