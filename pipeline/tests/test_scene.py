"""The Kensington scene pack, and the pieces the council tiles reuse from it.

Untested until 13 September because nothing imported it: coverage only counts
modules a test loads, so a pack every comparison on the site depended on sat
outside the gate at 19%. `scene_tiles` reuses its quantisation, snapping and
inlet rule, which is what brought it into the count.
"""

from __future__ import annotations

import json

import numpy as np
import pytest

from drainlens_pipeline import scene as sc


class TestQuantisingElevation:
    def test_stores_centimetres_in_an_int16(self):
        stored = sc.quantise_elevation(np.array([[1.234, -3.29], [29.84, 0.0]]))
        assert stored.dtype == np.int16
        assert stored.tolist() == [[123, -329], [2984, 0]]

    def test_refuses_relief_that_does_not_fit(self):
        with pytest.raises(sc.SceneError, match="do not fit centimetres"):
            sc.quantise_elevation(np.array([[0.0, 400.0]]))


class TestSnappingOntoTheFlowPath:
    def test_moves_a_drain_to_the_busiest_cell_within_reach(self):
        accumulation = np.zeros((7, 7))
        accumulation[3, 5] = 50  # two cells east of the centre
        accumulation[3, 3] = 1
        assert sc.snap_to_flow(3 * 7 + 3, accumulation, radius_m=3, cell_size_m=1) == 3 * 7 + 5

    def test_does_not_reach_past_the_radius(self):
        accumulation = np.zeros((9, 9))
        accumulation[4, 8] = 99  # four cells away
        accumulation[4, 4] = 1
        assert sc.snap_to_flow(4 * 9 + 4, accumulation, radius_m=3, cell_size_m=1) == 4 * 9 + 4

    def test_stays_put_when_the_radius_is_under_a_cell(self):
        accumulation = np.arange(25, dtype=float).reshape(5, 5)
        assert sc.snap_to_flow(12, accumulation, radius_m=0.4, cell_size_m=1) == 12

    def test_clips_the_search_at_the_grid_edge(self):
        accumulation = np.zeros((5, 5))
        accumulation[0, 0] = 9
        assert sc.snap_to_flow(1 * 5 + 1, accumulation, radius_m=3, cell_size_m=1) == 0


class TestDrainsFrom:
    PITS = [
        {"c": [0.5, 9.5], "asset_number": 11, "asset_description": "Side Entry Pit"},
        {"c": [5.5, 0.5], "asset_number": 12, "asset_description": "Grated Pit"},
        {"c": [2.5, 2.5], "asset_number": 13, "asset_description": "Junction Pit"},
        {"c": [50.0, 2.5], "asset_number": 14, "asset_description": "Side Entry Pit"},
        {"c": [1.0], "asset_number": 15},
        {"asset_number": 16},
    ]

    def test_places_each_pit_north_up_and_drops_what_is_off_the_grid(self):
        drains = sc.drains_from(self.PITS, 10, 10, 1.0)
        assert drains == [
            {"assetNumber": "11", "cell": 0 * 10 + 0, "isInlet": True},
            {"assetNumber": "12", "cell": 9 * 10 + 5, "isInlet": True},
            {"assetNumber": "13", "cell": 7 * 10 + 2, "isInlet": False},
        ]

    def test_snaps_onto_the_flow_path_when_given_one(self):
        accumulation = np.zeros((10, 10))
        accumulation[7, 4] = 30
        drains = sc.drains_from(self.PITS[2:3], 10, 10, 1.0, accumulation)
        assert drains[0]["cell"] == 7 * 10 + 4


class TestWritingTheScene:
    def arrays(self, rows=4, cols=4):
        return {
            "elevation": np.full((rows, cols), 2.5),
            "direction": np.full((rows, cols), -1, dtype=np.int8),
            "depression_labels": np.full((rows, cols), -1, dtype=np.int16),
            "observed": np.eye(rows, cols, dtype=bool),
            "rim_depth": np.zeros((rows, cols), dtype=np.int16),
        }

    def test_writes_every_array_and_a_header_naming_them(self, tmp_path):
        header = sc.write(
            tmp_path,
            **self.arrays(),
            depressions=[{"id": 0}],
            drains=[{"assetNumber": "1", "cell": 5, "isInlet": True}],
            cell_size_m=1.0,
            extent={"name": "t", "min_e": 0, "min_n": 0, "width_m": 4, "height_m": 4},
        )
        for name in ("elevation.bin", "flow.bin", "depressions.bin", "coverage.bin", "measured.bin", "rim-depth.bin"):
            assert (tmp_path / name).exists(), name
        assert np.frombuffer((tmp_path / "elevation.bin").read_bytes(), dtype=np.int16).tolist() == [250] * 16
        # Coverage is the whole grid; measured is the observed mask. Conflating
        # them made every scenario report terrain_unavailable.
        assert np.unpackbits(np.frombuffer((tmp_path / "coverage.bin").read_bytes(), dtype=np.uint8))[:16].all()
        assert json.loads((tmp_path / "scene.json").read_text()) == header
        assert header["grid"] == {"rows": 4, "cols": 4, "cellSizeM": 1.0, "origin": "north-west"}
        assert set(header["arrays"]) == {"elevation", "flow", "depressions", "coverage", "rim-depth", "measured"}

    def test_refuses_grids_that_disagree(self, tmp_path):
        arrays = self.arrays()
        arrays["direction"] = np.zeros((3, 3), dtype=np.int8)
        with pytest.raises(sc.SceneError, match="flow direction"):
            sc.write(tmp_path, **arrays, depressions=[], drains=[], cell_size_m=1.0, extent={})
