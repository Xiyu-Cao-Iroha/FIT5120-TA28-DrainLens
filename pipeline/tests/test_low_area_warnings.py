"""Tests for the warning points on especially deep low areas.

Against hollows dug into a flat surface, so the depth, the area and the
deepest cell of each are known before anything is measured. What a resident
acts on here is *where the sign is*, so the frame of the point is pinned as
closely as its depth.
"""

from __future__ import annotations

import json

import numpy as np
import pytest

from drainlens_pipeline import low_area_warnings as lw
from drainlens_pipeline.geo import Extent
from drainlens_pipeline.hydrology import cell_labels, find_depressions

SIZE = 40
EXTENT = Extent("test", 0.0, 0.0, float(SIZE), float(SIZE))


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
        surface = dug()
        labels, table = terrain(surface)
        points = lw.warning_points(EXTENT, 1.0, labels=labels, elevation=surface, depressions=table)
        assert points == [{"c": [11.5, 29.5], "depthM": 1.4, "areaM2": 144}]

    def test_the_point_is_in_the_map_frame_north_up(self):
        # Row 10 of 40 is ten cells below the northern edge: its centre is
        # 29.5 m north of the south-west corner, not 10.5 m.
        surface = dug()
        labels, table = terrain(surface)
        [point] = lw.warning_points(EXTENT, 1.0, labels=labels, elevation=surface, depressions=table)
        east, north = point["c"]
        assert (east, north) == (11 + 0.5, SIZE - 1 - 10 + 0.5)

    def test_the_thresholds_move_the_answer(self):
        surface = dug()
        labels, table = terrain(surface)
        deeper = lw.warning_points(
            EXTENT, 1.0, labels=labels, elevation=surface, depressions=table, min_depth_m=1.5
        )
        assert deeper == []
        smaller = lw.warning_points(
            EXTENT, 1.0, labels=labels, elevation=surface, depressions=table, min_area_m2=25.0
        )
        assert sorted(p["depthM"] for p in smaller) == [1.4, 2.0]

    def test_a_hollow_the_map_does_not_draw_cannot_be_marked(self):
        surface = dug()
        labels, table = terrain(surface)
        with pytest.raises(lw.WarningError, match="not drawn"):
            lw.warning_points(
                EXTENT, 1.0, labels=labels, elevation=surface, depressions=table, min_area_m2=10.0
            )

    def test_refuses_a_table_out_of_order(self):
        surface = dug()
        labels, table = terrain(surface)
        with pytest.raises(lw.WarningError, match="by position"):
            lw.warning_points(
                EXTENT, 1.0, labels=labels, elevation=surface, depressions=list(reversed(table))
            )

    def test_the_shipped_thresholds_are_above_the_ground_accuracy(self):
        assert lw.WARN_MIN_DEPTH_M >= 4 * lw.MIN_DEPRESSION_DEPTH_M
        assert lw.WARN_MIN_AREA_M2 >= lw.MIN_DRAWN_DEPRESSION_M2


class TestBuild:
    def test_the_artefact_says_what_it_is(self):
        surface = dug()
        labels, table = terrain(surface)
        artefact = lw.build(EXTENT, 1.0, labels=labels, elevation=surface, depressions=table)
        assert artefact["artefact"] == "low-area-warnings" and artefact["basis"] == "derived"
        assert artefact["extent"] == {"name": "test", "width_m": 40.0, "height_m": 40.0}
        assert artefact["counts"] == {"hollows": 3, "drawn": 3, "warnings": 1}
        assert artefact["settings"]["min_depth_m"] == lw.WARN_MIN_DEPTH_M
        assert "not recorded" in artefact["note"]

    def test_refuses_a_terrain_from_another_extent(self):
        # The points are only right in the frame of the grid they came from.
        surface = dug()
        labels, table = terrain(surface)
        with pytest.raises(lw.WarningError, match="not that extent"):
            lw.build(Extent("other", 0.0, 0.0, 1000.0, 1000.0), 1.0, labels=labels, elevation=surface, depressions=table)


def test_main_writes_the_artefact(tmp_path, capsys):
    surface = dug()
    labels, table = terrain(surface)
    folder = tmp_path / "terrain"
    folder.mkdir()
    np.save(folder / "ground-surface.npy", surface.astype(np.float32))
    np.savez_compressed(folder / "depression-cells.npz", labels=labels)
    (folder / "depressions.json").write_text(json.dumps(table), encoding="utf-8")
    out = tmp_path / "out" / "warnings.json"

    # A 40 m grid is not Kensington: refused, and nothing written.
    assert lw.main(["--terrain", str(folder), "--out", str(out)]) == 1
    assert not out.exists()
    assert "not that extent" in capsys.readouterr().err

    # The same build over a grid the size of the demonstration extent, with
    # the table written by hand: flooding a million cells is not what is
    # under test here.
    big = np.full((1000, 1000), 10.0, dtype=np.float32)
    big[100:112, 100:112] = 8.5
    labels = np.full((1000, 1000), -1, dtype=np.int16)
    labels[100:112, 100:112] = 0
    np.save(folder / "ground-surface.npy", big)
    np.savez_compressed(folder / "depression-cells.npz", labels=labels)
    (folder / "depressions.json").write_text(
        json.dumps([{"id": 0, "cellCount": 144, "capacityM3": 216.0, "spillElevationM": 10.0, "spillCell": 0}]),
        encoding="utf-8",
    )
    assert lw.main(["--terrain", str(folder), "--out", str(out)]) == 0
    written = json.loads(out.read_text(encoding="utf-8"))
    assert written["extent"]["name"] == "kensington"
    assert written["points"] == [{"c": [100.5, 899.5], "depthM": 1.5, "areaM2": 144}]
    assert "1 warnings" in capsys.readouterr().err
