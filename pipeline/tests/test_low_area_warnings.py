"""Tests for the warning points on especially deep low areas.

Against hollows dug into a flat surface, so the depth, the area and the
deepest cell of each are known before anything is measured. What a resident
acts on here is *where the sign is*, so the frame of the point is pinned as
closely as its depth — and, since the live test of 15 September found signs in
courtyards, so is the rule that keeps a sign on a street.
"""

from __future__ import annotations

import json

import numpy as np
import pytest

from drainlens_pipeline import low_area_warnings as lw
from drainlens_pipeline.geo import Extent
from drainlens_pipeline.hydrology import cell_labels, find_depressions
from drainlens_pipeline.terrain_marks import road_mask

SIZE = 40
EXTENT = Extent("test", 0.0, 0.0, float(SIZE), float(SIZE))
EVERYWHERE = np.ones((SIZE, SIZE), dtype=bool)
NOWHERE = np.zeros((SIZE, SIZE), dtype=bool)


def dug() -> np.ndarray:
    """Three hollows in a flat 10 m surface.

    - A: 144 m², floor 9.0 m, one cell at 8.6 m — deep enough and big enough.
    - B: 144 m², floor 9.6 m — big enough, 0.4 m deep.
    - C: 49 m², floor 8.0 m — 2 m deep, too small to park in.
    """
    surface = np.full((SIZE, SIZE), 10.0)
    surface[5:17, 5:17] = 9.0
    surface[10, 11] = 8.6
    surface[25:37, 5:17] = 9.6
    surface[25:32, 25:32] = 8.0
    return surface


def terrain(surface: np.ndarray) -> tuple[np.ndarray, list[dict]]:
    found = find_depressions(surface, 1.0)
    return cell_labels(found, *surface.shape), [d.as_json() for d in found]


def box(west: float, south: float, east: float, north: float) -> list[list[float]]:
    return [[west, south], [east, south], [east, north], [west, north], [west, south]]


def corridor(*rings: list[list[float]], kind: str = "Council Minor") -> dict:
    return {"g": "polygon", "c": list(rings), "str_type": kind, "seg_descr": "test"}


#: A street along the eastern edge of hollow A: columns 15 and 16, rows 5 to
#: 16. Cell centres are half a metre in, so the box's edges sit between cells.
STREET_A = corridor(box(14.6, 23.0, 17.0, 35.0))


def points(surface: np.ndarray, **kw) -> list[dict]:
    labels, table = terrain(surface)
    args = {"streets": EVERYWHERE, "buildings": NOWHERE, "spacing_m": 0.0}
    args.update(kw)
    return lw.warning_points(EXTENT, 1.0, labels=labels, elevation=surface, depressions=table, **args)


class TestStreetMask:
    def test_a_cell_is_street_when_its_centre_is_in_the_corridor(self):
        mask = lw.street_mask([STREET_A], SIZE, SIZE)
        expected = np.zeros((SIZE, SIZE), dtype=bool)
        expected[5:17, 15:17] = True
        assert np.array_equal(mask, expected)

    def test_agrees_with_the_spot_height_mask_on_single_rings(self):
        # The terrain marks already rasterise the same corridors; for a corridor
        # without holes the two must not disagree about a single cell.
        roads = [STREET_A, corridor([[2.2, 1.0], [30.7, 4.4], [12.0, 19.9], [2.2, 1.0]])]
        assert np.array_equal(lw.street_mask(roads, SIZE, SIZE), road_mask(roads, SIZE, SIZE))

    def test_a_hole_in_a_corridor_is_not_street(self):
        # A traffic island: filling each ring on its own would call it road.
        mask = lw.street_mask([corridor(box(0, 0, 20, 20), box(5, 5, 15, 15))], SIZE, SIZE)
        assert mask[39 - 10, 10] == np.False_
        assert mask[39 - 2, 2] == np.True_
        assert int(mask.sum()) == 400 - 100

    def test_only_the_classes_a_car_is_parked_in(self):
        roads = [corridor(box(0, 0, 10, 10), kind="Rail/Tram"), corridor(box(20, 20, 30, 30), kind="Freeway")]
        assert not lw.street_mask(roads, SIZE, SIZE).any()
        assert "Freeway" not in lw.STREET_TYPES and "Council Minor" in lw.STREET_TYPES

    def test_clips_to_the_grid_and_skips_what_is_not_in_it(self):
        roads = [
            corridor(box(-5, -5, 3, 3)),
            corridor(box(0, 100, 10, 110)),
            corridor([[1, 1], [2, 2]]),
            {"str_type": "Council Major"},
        ]
        mask = lw.street_mask(roads, SIZE, SIZE)
        assert int(mask.sum()) == 9
        assert mask[37:40, 0:3].all()

    def test_a_coarser_grid(self):
        mask = lw.street_mask([corridor(box(0, 0, 4, 4))], 10, 10, cell_size_m=2.0)
        assert int(mask.sum()) == 4 and mask[8:10, 0:2].all()


class TestDeepestCells:
    def test_the_lowest_cell_of_each_hollow(self):
        surface = dug()
        labels, table = terrain(surface)
        lowest, at = lw.deepest_cells(labels, surface, len(table))
        a, b, c = int(labels[10, 11]), int(labels[30, 10]), int(labels[28, 28])
        assert lowest[[a, b, c]] == pytest.approx([8.6, 9.6, 8.0])
        assert divmod(int(at[a]), SIZE) == (10, 11)

    def test_a_tie_goes_to_the_first_cell_in_row_order(self):
        # The same surface must always put the sign on the same cell.
        surface = dug()
        surface[10, 11] = 9.0
        labels, table = terrain(surface)
        _, at = lw.deepest_cells(labels, surface, len(table))
        assert divmod(int(at[int(labels[10, 11])]), SIZE) == (5, 5)

    def test_within_a_mask_and_none_for_a_hollow_outside_it(self):
        surface = dug()
        labels, table = terrain(surface)
        streets = lw.street_mask([STREET_A], SIZE, SIZE)
        lowest, at = lw.deepest_cells(labels, surface, len(table), within=streets)
        a, b = int(labels[10, 11]), int(labels[30, 10])
        assert lowest[a] == pytest.approx(9.0) and divmod(int(at[a]), SIZE) == (5, 15)
        assert np.isnan(lowest[b]) and at[b] == -1

    def test_refuses_a_mask_of_another_shape(self):
        surface = dug()
        labels, table = terrain(surface)
        with pytest.raises(lw.WarningError, match="street mask"):
            lw.deepest_cells(labels, surface, len(table), within=np.ones((3, 3), dtype=bool))

    def test_refuses_labels_and_a_surface_of_different_shapes(self):
        labels, table = terrain(dug())
        with pytest.raises(lw.WarningError, match="labels are"):
            lw.deepest_cells(labels, np.zeros((3, 3)), len(table))

    def test_refuses_labels_naming_a_hollow_the_table_does_not_have(self):
        surface = dug()
        labels, table = terrain(surface)
        with pytest.raises(lw.WarningError, match="the table has"):
            lw.deepest_cells(labels, surface, len(table) - 1)

    def test_refuses_a_table_row_with_no_cells(self):
        surface = dug()
        labels, table = terrain(surface)
        with pytest.raises(lw.WarningError, match="no cells"):
            lw.deepest_cells(labels, surface, len(table) + 1)

    def test_no_hollows_at_all(self):
        lowest, at = lw.deepest_cells(np.full((4, 4), -1), np.zeros((4, 4)), 0)
        assert lowest.size == 0 and at.size == 0


class TestWarningPoints:
    def test_only_the_deep_and_large_hollow_is_marked(self):
        assert points(dug()) == [{"c": [11.5, 29.5], "depthM": 1.4, "areaM2": 144}]

    def test_the_point_is_in_the_map_frame_north_up(self):
        # Row 10 of 40 is ten cells below the northern edge: its centre is
        # 29.5 m north of the south-west corner, not 10.5 m.
        [point] = points(dug())
        east, north = point["c"]
        assert (east, north) == (11 + 0.5, SIZE - 1 - 10 + 0.5)

    def test_the_sign_moves_to_the_street_and_its_depth_is_measured_there(self):
        # Hollow A's floor is in the middle of its block; the sign goes to the
        # lowest cell of it inside the corridor, 1.2 m down, not 1.4.
        surface = dug()
        surface[12, 16] = 8.8
        streets = lw.street_mask([STREET_A], SIZE, SIZE)
        assert points(surface, streets=streets) == [{"c": [16.5, 27.5], "depthM": 1.2, "areaM2": 144}]

    def test_a_hollow_deep_only_away_from_the_street_gets_no_sign(self):
        # Hollow A's street cells raised to half a metre below its rim: the
        # hollow is still 1.4 m deep inside the block, and gets no sign.
        surface = dug()
        surface[5:17, 15:17] = 9.5
        streets = lw.street_mask([STREET_A], SIZE, SIZE)
        assert points(surface, streets=streets) == []

    def test_no_sign_on_a_building(self):
        surface = dug()
        surface[12, 16] = 8.8
        streets = lw.street_mask([STREET_A], SIZE, SIZE)
        buildings = NOWHERE.copy()
        buildings[12, 16] = True
        [point] = points(surface, streets=streets, buildings=buildings)
        assert point["c"] != [16.5, 27.5] and point["depthM"] == pytest.approx(1.0)

    def test_no_street_no_signs(self):
        assert points(dug(), streets=NOWHERE) == []

    def test_refuses_a_building_mask_of_another_shape(self):
        with pytest.raises(lw.WarningError, match="building mask"):
            points(dug(), buildings=np.zeros((3, 3), dtype=bool))

    def test_the_thresholds_move_the_answer(self):
        assert points(dug(), min_depth_m=1.5) == []
        assert sorted(p["depthM"] for p in points(dug(), min_area_m2=25.0)) == [1.4, 2.0]

    def test_the_spacing_keeps_the_deeper_of_two_close_signs(self):
        # The signs on A and C are 20.5 m apart.
        assert [p["depthM"] for p in points(dug(), min_area_m2=25.0, spacing_m=30.0)] == [2.0]
        assert len(points(dug(), min_area_m2=25.0, spacing_m=20.0)) == 2

    def test_a_hollow_the_map_does_not_draw_cannot_be_marked(self):
        with pytest.raises(lw.WarningError, match="not drawn"):
            points(dug(), min_area_m2=10.0)

    def test_refuses_a_table_out_of_order(self):
        surface = dug()
        labels, table = terrain(surface)
        with pytest.raises(lw.WarningError, match="by position"):
            lw.warning_points(
                EXTENT,
                1.0,
                labels=labels,
                elevation=surface,
                depressions=list(reversed(table)),
                streets=EVERYWHERE,
                buildings=NOWHERE,
            )

    def test_the_shipped_thresholds_are_above_the_ground_accuracy(self):
        assert lw.WARN_MIN_DEPTH_M >= 4 * lw.MIN_DEPRESSION_DEPTH_M
        assert lw.WARN_MIN_AREA_M2 >= lw.MIN_DRAWN_DEPRESSION_M2
        assert lw.WARN_SPACING_M > 0


class TestSpaceOut:
    def sign(self, x: float, y: float, depth: float) -> dict:
        return {"c": [x, y], "depthM": depth, "areaM2": 100}

    def test_deepest_first_and_the_order_given_back(self):
        signs = [self.sign(0, 0, 1.0), self.sign(100, 0, 3.0), self.sign(200, 0, 2.0), self.sign(500, 0, 1.0)]
        kept = lw.space_out(signs, 150.0)
        assert kept == [signs[1], signs[3]]

    def test_exactly_the_spacing_apart_both_stay(self):
        signs = [self.sign(0, 0, 1.0), self.sign(90, 120, 1.0)]
        assert lw.space_out(signs, 150.0) == signs

    def test_an_equal_depth_keeps_the_first(self):
        signs = [self.sign(0, 0, 1.0), self.sign(10, 0, 1.0)]
        assert lw.space_out(signs, 150.0) == [signs[0]]


class TestBusiestView:
    def test_counts_the_fullest_window(self):
        signs = [{"c": c} for c in ([0, 0], [10, 10], [99, 49], [150, 0], [300, 300])]
        assert lw.busiest_view(signs, 100, 50) == 3
        assert lw.busiest_view(signs, 150, 50) == 4
        assert lw.busiest_view(signs, 10, 10) == 2  # edges count as inside
        assert lw.busiest_view(signs, 9, 9) == 1

    def test_no_signs(self):
        assert lw.busiest_view([], 864, 620) == 0


class TestBuild:
    def test_the_artefact_says_what_it_is(self):
        surface = dug()
        surface[12, 16] = 8.8
        labels, table = terrain(surface)
        artefact = lw.build(
            EXTENT, 1.0, labels=labels, elevation=surface, depressions=table, roads=[STREET_A], buildings=NOWHERE
        )
        assert artefact["artefact"] == "low-area-warnings" and artefact["basis"] == "derived"
        assert artefact["extent"] == {"name": "test", "width_m": 40.0, "height_m": 40.0}
        assert artefact["counts"] == {"hollows": 3, "drawn": 3, "warnings": 1}
        assert artefact["points"] == [{"c": [16.5, 27.5], "depthM": 1.2, "areaM2": 144}]
        assert artefact["settings"]["min_depth_m"] == lw.WARN_MIN_DEPTH_M
        assert artefact["settings"]["spacing_m"] == lw.WARN_SPACING_M
        assert artefact["settings"]["street_types"] == list(lw.STREET_TYPES)
        assert "road corridor" in artefact["coordinates"]
        assert "not recorded" in artefact["note"]

    def test_refuses_a_terrain_from_another_extent(self):
        # The points are only right in the frame of the grid they came from.
        surface = dug()
        labels, table = terrain(surface)
        with pytest.raises(lw.WarningError, match="not that extent"):
            lw.build(
                Extent("other", 0.0, 0.0, 1000.0, 1000.0),
                1.0,
                labels=labels,
                elevation=surface,
                depressions=table,
                roads=[],
                buildings=NOWHERE,
            )


def test_main_writes_the_artefact(tmp_path, capsys):
    surface = dug()
    labels, table = terrain(surface)
    folder = tmp_path / "terrain"
    folder.mkdir()
    np.save(folder / "ground-surface.npy", surface.astype(np.float32))
    np.savez_compressed(folder / "depression-cells.npz", labels=labels)
    (folder / "depressions.json").write_text(json.dumps(table), encoding="utf-8")
    out = tmp_path / "out" / "warnings.json"
    geometry = tmp_path / "map.json"
    frame = {"name": "kensington", "min_e": 316500.0, "min_n": 5814500.0, "width_m": 1000.0, "height_m": 1000.0}
    street = corridor(box(99.0, 887.0, 113.0, 901.0))
    geometry.write_text(json.dumps({"extent": frame, "layers": {"road": [street]}}), encoding="utf-8")
    run = ["--terrain", str(folder), "--map", str(geometry), "--out", str(out)]

    # Another extent's map geometry: refused before anything is read.
    elsewhere = tmp_path / "elsewhere.json"
    elsewhere.write_text(json.dumps({"extent": {**frame, "min_e": 315000.0}}), encoding="utf-8")
    assert lw.main(["--terrain", str(folder), "--map", str(elsewhere), "--out", str(out)]) == 1
    assert "frame" in capsys.readouterr().err

    # No building mask: refused, since a sign could then stand on a roof.
    assert lw.main(run) == 1
    assert "barriers.npy is missing" in capsys.readouterr().err

    # A 40 m grid is not Kensington: refused, and nothing written.
    np.save(folder / "barriers.npy", NOWHERE)
    assert lw.main(run) == 1
    assert not out.exists()
    assert "not that extent" in capsys.readouterr().err

    # The same build over a grid the size of the demonstration extent, with
    # the table written by hand: flooding a million cells is not what is
    # under test here. The street covers the whole hollow, and a building its
    # lowest cell.
    big = np.full((1000, 1000), 10.0, dtype=np.float32)
    big[100:112, 100:112] = 8.5
    big[100, 100] = 8.0
    labels = np.full((1000, 1000), -1, dtype=np.int16)
    labels[100:112, 100:112] = 0
    buildings = np.zeros((1000, 1000), dtype=bool)
    buildings[100, 100] = True
    np.save(folder / "ground-surface.npy", big)
    np.save(folder / "barriers.npy", buildings)
    np.savez_compressed(folder / "depression-cells.npz", labels=labels)
    (folder / "depressions.json").write_text(
        json.dumps([{"id": 0, "cellCount": 144, "capacityM3": 216.0, "spillElevationM": 10.0, "spillCell": 0}]),
        encoding="utf-8",
    )
    assert lw.main(run) == 0
    written = json.loads(out.read_text(encoding="utf-8"))
    assert written["extent"]["name"] == "kensington"
    assert written["points"] == [{"c": [101.5, 899.5], "depthM": 1.5, "areaM2": 144}]
    err = capsys.readouterr().err
    assert "1 warnings" in err and "holds 1 at 1.25 px/m" in err
