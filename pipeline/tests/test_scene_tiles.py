"""Cutting the council terrain into tiles the browser stitches into windows.

The fixture is the point-cloud tile grid at a 50 m cell, so a 500 m tile is
ten cells and a whole test extent fits in a few hundred numbers: every tile
edge, depression table and drain window can be checked by eye.
"""

from __future__ import annotations

import gzip
import json

import numpy as np
import pytest

from drainlens_pipeline import scene_tiles as st
from drainlens_pipeline.geo import Extent
from drainlens_pipeline.scene import SceneError

# Three tiles by two: tx 7..9, ty 15..16. Tile (7, 15) is Kensington's south-west.
EXTENT = Extent("test", 316_500.0, 5_814_500.0, 318_000.0, 5_815_500.0)
GRID = st.TileGrid(EXTENT, cell_size_m=50.0)
ROWS, COLS = GRID.rows, GRID.cols  # 20 x 30


def arrays(**over):
    base = {
        "elevation": np.full((ROWS, COLS), 5.0),
        "direction": np.zeros((ROWS, COLS), dtype=np.int8),
        "labels": np.full((ROWS, COLS), -1, dtype=np.int16),
        "rim_depth_cm": np.zeros((ROWS, COLS), dtype=np.int16),
        "observed": np.ones((ROWS, COLS), dtype=bool),
        "valid": None,
        "depressions": [],
        "drains": [],
    }
    base.update(over)
    return base


def unzip(path, dtype):
    return np.frombuffer(gzip.decompress(path.read_bytes()), dtype=dtype)


class TestTheTileGrid:
    def test_a_tile_is_ten_cells_at_fifty_metres(self):
        assert (GRID.rows, GRID.cols, GRID.tile_cells) == (20, 30, 10)

    def test_the_north_west_cell_of_each_tile(self):
        # North-up: the northern row of tiles starts at row 0.
        assert GRID.origin_of(7, 16) == (0, 0)
        assert GRID.origin_of(7, 15) == (10, 0)
        assert GRID.origin_of(9, 15) == (10, 20)

    def test_a_cell_knows_its_tile(self):
        assert GRID.tile_of_cell(0, 0) == (7, 16)
        assert GRID.tile_of_cell(19, 29) == (9, 15)


class TestChoosingAWindow:
    everything = {(tx, ty) for tx in range(6, 11) for ty in range(14, 18)}

    def test_prefers_the_window_that_puts_the_drain_in_its_middle(self):
        # 316,800 E is 300 m into tile 7; 5,815,100 N is 100 m into tile 16.
        # The window with this point in its central quadrant starts at (7, 15).
        assert st.window_for(316_800, 5_815_100, self.everything) == (7, 15)
        assert st.window_for(316_600, 5_815_400, self.everything) == (6, 16)

    def test_falls_back_to_another_window_of_four(self):
        without = self.everything - {(6, 16)}
        chosen = st.window_for(316_600, 5_815_400, without)
        assert chosen is not None and chosen != (6, 16)
        tx, ty = chosen
        assert all((tx + i, ty + j) in without for i in (0, 1) for j in (0, 1))

    def test_has_no_window_beside_a_missing_tile_on_every_side(self):
        alone = {(7, 16)}
        assert st.window_for(316_800, 5_815_100, alone) is None


class TestPacking:
    def test_writes_each_tile_and_skips_a_missing_one(self, tmp_path):
        valid = np.ones((ROWS, COLS), dtype=bool)
        valid[0:10, 20:30] = False  # tile (9, 16) not in the archive
        index = st.pack(tmp_path, GRID, **arrays(valid=valid))
        names = sorted(t["tile"] for t in index["tiles"])
        assert names == ["Tile_+007_+015", "Tile_+007_+016", "Tile_+008_+015", "Tile_+008_+016", "Tile_+009_+015"]
        assert not (tmp_path / "Tile_+009_+016").exists()

    def test_refuses_a_tile_that_is_only_partly_measured(self, tmp_path):
        valid = np.ones((ROWS, COLS), dtype=bool)
        valid[0:5, 20:30] = False
        with pytest.raises(SceneError, match="off the tile grid"):
            st.pack(tmp_path, GRID, **arrays(valid=valid))

    def test_stores_each_tile_in_its_own_north_up_block(self, tmp_path):
        elevation = np.arange(ROWS * COLS, dtype=np.float64).reshape(ROWS, COLS) / 100
        st.pack(tmp_path, GRID, **arrays(elevation=elevation))
        centimetres = unzip(tmp_path / "Tile_+008_+015" / "elevation.bin.gz", "<i2").reshape(10, 10)
        assert np.array_equal(centimetres, np.round(elevation[10:20, 10:20] * 100).astype(np.int16))

    def test_the_same_arrays_pack_to_the_same_bytes(self, tmp_path):
        # A rebuild that changes nothing should change nothing in git.
        st.pack(tmp_path / "a", GRID, **arrays())
        st.pack(tmp_path / "b", GRID, **arrays())
        assert (tmp_path / "a" / "Tile_+007_+015" / "flow.bin.gz").read_bytes() == (
            tmp_path / "b" / "Tile_+007_+015" / "flow.bin.gz"
        ).read_bytes()

    def test_lists_every_depression_that_touches_a_tile_in_council_cells(self, tmp_path):
        labels = np.full((ROWS, COLS), -1, dtype=np.int16)
        labels[9:11, 5] = 3  # straddles the edge between (7, 16) and (7, 15)
        depressions = [{"id": 3, "cellCount": 2, "capacityM3": 1.5, "spillElevationM": 4.0, "spillCell": 8 * COLS + 5}]
        st.pack(tmp_path, GRID, **arrays(labels=labels, depressions=depressions))
        for name in ("Tile_+007_+016", "Tile_+007_+015"):
            table = json.loads((tmp_path / name / "tile.json").read_text())["depressions"]
            assert table == [{"id": 3, "cellCount": 2, "capacityM3": 1.5, "spillElevationM": 4.0, "spill": [8, 5]}]
        assert json.loads((tmp_path / "Tile_+008_+015" / "tile.json").read_text())["depressions"] == []

    def test_gives_each_inlet_a_window_and_leaves_others_out(self, tmp_path):
        drains = [
            {"assetNumber": "inlet-middle", "row": 10, "col": 10, "isInlet": True},
            {"assetNumber": "not-an-inlet", "row": 10, "col": 11, "isInlet": False},
        ]
        index = st.pack(tmp_path, GRID, **arrays(drains=drains))
        assert list(index["windows"]) == ["inlet-middle"]
        tx, ty = index["windows"]["inlet-middle"]
        assert all(f"Tile_+{tx + i:03d}_+{ty + j:03d}" in {t["tile"] for t in index["tiles"]} for i in (0, 1) for j in (0, 1))
        tile = json.loads((tmp_path / "Tile_+008_+015" / "tile.json").read_text())
        assert {d["assetNumber"] for d in tile["drains"]} == {"inlet-middle", "not-an-inlet"}
        assert tile["drains"][0]["cell"] == [10, 10]

    def test_an_inlet_beside_missing_tiles_gets_no_window(self, tmp_path):
        valid = np.zeros((ROWS, COLS), dtype=bool)
        valid[0:10, 0:10] = True  # only (7, 16)
        drains = [{"assetNumber": "alone", "row": 5, "col": 5, "isInlet": True}]
        index = st.pack(tmp_path, GRID, **arrays(valid=valid, drains=drains))
        assert index["windows"] == {}
        assert index["inletsWithoutWindow"] == ["alone"]

    def test_refuses_arrays_of_the_wrong_shape(self, tmp_path):
        with pytest.raises(SceneError, match="flow direction"):
            st.pack(tmp_path, GRID, **arrays(direction=np.zeros((3, 3), dtype=np.int8)))


class TestDrainsOnTheGrid:
    def test_places_pits_north_up_and_classifies_inlets(self):
        pits = [
            {"c": [75.0, 975.0], "asset_number": 1, "asset_description": "Side Entry Pit"},
            {"c": [75.0, 25.0], "asset_number": 2, "asset_description": "Junction Pit"},
            {"c": [99999.0, 25.0], "asset_number": 3, "asset_description": "Grated Pit"},
        ]
        drains = st.drains_on_grid(pits, GRID, None)
        assert drains == [
            {"assetNumber": "1", "row": 0, "col": 1, "isInlet": True},
            {"assetNumber": "2", "row": 19, "col": 1, "isInlet": False},
        ]


class TestTheCommand:
    """`main`, end to end, on the 50 m test grid instead of the council's metre."""

    def terrain(self, tmp_path, *, break_flow: bool = False):
        from drainlens_pipeline.hydrology import cell_labels, condition, d8, find_depressions

        row, col = np.mgrid[0:ROWS, 0:COLS]
        raw = 10.0 - 0.05 * col + 0.0 * row
        raw[8:12, 12:16] -= 1.0  # a hollow in the middle
        terrain = tmp_path / "terrain"
        terrain.mkdir()
        np.save(terrain / "ground-surface.npy", raw.astype(np.float32))
        direction = d8(condition(raw.astype(np.float32).astype(np.float64)))
        if break_flow:
            direction = direction.copy()
            direction[0, 0] = 4 if direction[0, 0] != 4 else 0
        np.save(terrain / "flow-direction.npy", direction)
        found = find_depressions(raw.astype(np.float32).astype(np.float64), 50.0)
        np.savez_compressed(terrain / "depression-cells.npz", labels=cell_labels(found, ROWS, COLS))
        (terrain / "depressions.json").write_text(json.dumps([d.as_json() for d in found]))
        np.save(terrain / "ground-observed.npy", np.ones((ROWS, COLS), dtype=bool))
        pits = [
            {"c": [725.0, 475.0], "asset_number": 1, "asset_description": "Side Entry Pit"},
            {"c": [775.0, 475.0], "asset_number": 2, "asset_description": "Junction Pit"},
        ]
        map_file = tmp_path / "map.json"
        map_file.write_text(json.dumps({"layers": {"pit": pits}}))
        return terrain, map_file

    def run(self, tmp_path, monkeypatch, terrain, map_file):
        monkeypatch.setattr(st, "CITY_OF_MELBOURNE", EXTENT)
        monkeypatch.setattr(st, "TileGrid", lambda extent: GRID)
        out = tmp_path / "tiles"
        code = st.main(["--terrain", str(terrain), "--map", str(map_file), "--out", str(out)])
        return code, out

    def test_writes_the_tiles_and_an_index_with_the_inlet_in_it(self, tmp_path, monkeypatch, capsys):
        terrain, map_file = self.terrain(tmp_path)
        code, out = self.run(tmp_path, monkeypatch, terrain, map_file)
        assert code == 0
        index = json.loads((out / "index.json").read_text())
        assert len(index["tiles"]) == 6
        assert list(index["windows"]) == ["1"]
        assert "1 inlets with a window" in capsys.readouterr().err

    def test_refuses_a_surface_that_does_not_reproduce_the_flow_directions(self, tmp_path, monkeypatch):
        # The pack ships the conditioned surface beside the flow field; if they
        # disagree the engine orders by one and routes by the other.
        terrain, map_file = self.terrain(tmp_path, break_flow=True)
        with pytest.raises(SceneError, match="does not reproduce"):
            self.run(tmp_path, monkeypatch, terrain, map_file)
