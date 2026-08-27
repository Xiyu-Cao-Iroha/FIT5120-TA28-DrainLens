"""Tests for filling, depressions, conditioning and routing.

Each surface here has an answer worked out by hand, and the assertions carry
the arithmetic. A depression's capacity is the one number the scenario engine
cannot sanity-check for itself — it is handed a volume and believes it — so the
volumes are pinned against sums anyone can redo on paper.
"""

from __future__ import annotations

import numpy as np
import pytest

from drainlens_pipeline.hydrology import (
    BARRIER_RAISE_M,
    CONDITIONING_EPSILON_M,
    D8_OFFSETS,
    LEAVES_WINDOW,
    Depression,
    HydrologyError,
    cell_labels,
    condition,
    d8,
    fill,
    find_depressions,
)

CELL = 1.0


def plane(rows: int, cols: int, *, base: float = 10.0, fall: float = 0.0) -> np.ndarray:
    _, col = np.mgrid[0:rows, 0:cols]
    return base - fall * col.astype(np.float64)


def bowl(rows: int = 9, cols: int = 9, *, depth: float = 1.0, rim: float = 10.0) -> np.ndarray:
    """A flat plain with one square hollow cut into the middle."""
    surface = np.full((rows, cols), rim)
    surface[3:6, 3:6] = rim - depth
    return surface


class TestFill:
    def test_a_plane_is_already_full(self):
        surface = plane(9, 9, fall=0.05)
        assert np.allclose(fill(surface), surface)

    def test_a_hollow_fills_to_its_rim_and_no_higher(self):
        surface = bowl(depth=1.0, rim=10.0)
        filled = fill(surface)
        assert np.allclose(filled[3:6, 3:6], 10.0), "the hollow reaches the rim"
        assert np.allclose(filled[0, :], 10.0), "and nothing above the rim moves"

    def test_filled_is_never_below_the_original(self):
        rough = 10.0 + np.random.default_rng(3).normal(0, 0.5, (20, 20))
        assert (fill(rough) >= rough - 1e-9).all()

    def test_a_hollow_open_to_the_edge_does_not_fill(self):
        # A notch cut through to the boundary is a valley, not a basin. Filling
        # it would invent storage where water simply runs out.
        surface = np.full((9, 9), 10.0)
        surface[4, 0:6] = 9.0
        assert np.allclose(fill(surface), surface)

    def test_epsilon_leaves_a_basin_sloping_towards_its_outlet(self):
        surface = bowl(depth=1.0)
        flat = fill(surface)
        ramped = fill(surface, epsilon_m=CONDITIONING_EPSILON_M)
        assert len(np.unique(np.round(flat[3:6, 3:6], 9))) == 1, "without epsilon the basin is level"
        assert len(np.unique(np.round(ramped[3:6, 3:6], 9))) > 1, "with epsilon it is not"
        assert (ramped >= flat - 1e-12).all()
        assert ramped.max() - flat.max() < 1e-3, "and the nudge stays sub-millimetre"

    def test_rejects_a_grid_with_no_interior(self):
        with pytest.raises(HydrologyError, match="too small"):
            fill(np.zeros((2, 9)))

    def test_rejects_a_surface_that_is_not_a_grid(self):
        with pytest.raises(HydrologyError, match="2-D"):
            fill(np.zeros(9))


class TestFindDepressions:
    def test_finds_one_hollow_and_measures_what_it_holds(self):
        # 3 x 3 cells, 1 m deep, 1 m cells: 9 cubic metres, exactly.
        found = find_depressions(bowl(depth=1.0), CELL)
        assert len(found) == 1
        assert found[0].capacity_m3 == pytest.approx(9.0)
        assert found[0].spill_elevation_m == pytest.approx(10.0)
        assert len(found[0].cells) == 9

    def test_capacity_scales_with_cell_area_not_cell_count(self):
        # The same nine cells at 2 m: 9 x 4 m2 x 1 m = 36 cubic metres.
        found = find_depressions(bowl(depth=1.0), 2.0)
        assert found[0].capacity_m3 == pytest.approx(36.0)

    def test_a_stepped_hollow_is_measured_by_depth_not_by_footprint(self):
        surface = np.full((11, 11), 10.0)
        surface[3:8, 3:8] = 9.5  # 25 cells, 0.5 m down
        surface[5:6, 5:6] = 9.0  # one of them a further 0.5 m
        found = find_depressions(surface, CELL)
        assert len(found) == 1
        assert found[0].capacity_m3 == pytest.approx(25 * 0.5 + 1 * 0.5)

    def test_two_separate_hollows_stay_separate(self):
        surface = np.full((13, 13), 10.0)
        surface[2:5, 2:5] = 9.0
        surface[8:11, 8:11] = 9.0
        assert len(find_depressions(surface, CELL)) == 2

    def test_a_hollow_shallower_than_the_noise_floor_is_not_storage(self):
        # 5 cm is the median hollow on the real surface, and it is the
        # measurement's own noise rather than a place water collects.
        assert find_depressions(bowl(depth=0.05), CELL) == []
        assert len(find_depressions(bowl(depth=0.05), CELL, min_depth_m=0.01)) == 1

    def test_the_threshold_is_on_depth_not_on_volume(self):
        # A wide shallow sheet holds a lot and is still below the error bar on
        # the surface that found it. A narrow deep one holds little and is real.
        wide = np.full((21, 21), 10.0)
        wide[2:19, 2:19] = 9.9  # 289 cells x 0.1 m = 28.9 m3, but only 10 cm deep
        assert find_depressions(wide, CELL) == []

        narrow = np.full((9, 9), 10.0)
        narrow[4:5, 4:5] = 9.0  # one cell, 1 m deep, 1 m3
        assert len(find_depressions(narrow, CELL)) == 1

    def test_a_hollow_reaching_the_edge_is_a_valley_not_a_basin(self):
        # It drains off the grid, so it never fills, so there is nothing to
        # store. This is why `find_depressions` can never emit LEAVES_WINDOW as
        # a spill: a depression that touches the boundary is not a depression.
        surface = np.full((9, 9), 10.0)
        surface[0:3, 0:3] = 9.0
        assert find_depressions(surface, CELL) == []

    def test_a_hollow_spills_through_the_lowest_gap_in_its_rim(self):
        # A basin with one channel out to the edge fills only to the channel,
        # and the outlet is the channel's mouth rather than any other rim cell.
        surface = np.full((11, 11), 10.0)
        surface[4:7, 4:7] = 9.0
        surface[5, 7:11] = 9.5  # a gutter running east to the boundary

        found = find_depressions(surface, CELL)
        assert len(found) == 1
        assert found[0].spill_elevation_m == pytest.approx(9.5), "it fills to the gutter, not the rim"
        assert found[0].capacity_m3 == pytest.approx(9 * 0.5)
        assert found[0].spill_cell == 5 * 11 + 7, "and overflows into the mouth of the gutter"

    def test_a_saddle_below_the_surrounding_plain_ponds_with_the_basin(self):
        # A dip in the rim is not an outlet if it is itself below the ground
        # around it — water stands over the saddle too, and the pair fill as
        # one hollow to the true rim height.
        surface = np.full((9, 9), 10.0)
        surface[3:6, 3:6] = 9.0
        surface[6, 4] = 9.6
        found = find_depressions(surface, CELL)
        assert len(found) == 1
        assert found[0].spill_elevation_m == pytest.approx(10.0)
        assert len(found[0].cells) == 10, "the nine basin cells plus the saddle"
        assert found[0].capacity_m3 == pytest.approx(9 * 1.0 + 1 * 0.4)

    def test_a_flat_plain_has_no_depressions(self):
        assert find_depressions(plane(9, 9, fall=0.05), CELL) == []

    def test_rejects_a_non_positive_cell_size(self):
        with pytest.raises(HydrologyError, match="positive"):
            find_depressions(bowl(), 0.0)

    def test_the_json_form_carries_the_engine_field_names(self):
        record = find_depressions(bowl(depth=1.0), CELL)[0].as_json()
        assert set(record) == {"id", "cellCount", "capacityM3", "spillElevationM", "spillCell"}
        assert record["capacityM3"] == pytest.approx(9.0)
        assert record["cellCount"] == 9

    def test_the_table_does_not_carry_the_cell_list(self):
        # 486 hollows over the demonstration extent hold 129,683 cells. Writing
        # those as JSON indices cost two megabytes to say what one byte per
        # cell says in the companion raster, and the browser would have had to
        # rebuild the raster from them anyway.
        assert "cells" not in find_depressions(bowl(depth=1.0), CELL)[0].as_json()


class TestCellLabels:
    def test_each_cell_carries_its_depression_id_and_minus_one_elsewhere(self):
        surface = np.full((13, 13), 10.0)
        surface[2:5, 2:5] = 9.0
        surface[8:11, 8:11] = 9.0
        found = find_depressions(surface, CELL)
        labels = cell_labels(found, 13, 13)

        assert labels.shape == (13, 13)
        assert labels.dtype == np.int16
        assert set(np.unique(labels)) == {-1, 0, 1}
        assert (labels[2:5, 2:5] == labels[2, 2]).all()
        assert labels[0, 0] == -1

    def test_it_round_trips_with_the_cell_lists_it_replaces(self):
        # The raster has to say exactly what the dropped lists said, or the
        # packing has quietly lost membership.
        surface = 10.0 + np.random.default_rng(5).normal(0, 0.6, (40, 40))
        found = find_depressions(surface, CELL)
        assert len(found) > 1, "the fixture needs several hollows to be worth checking"

        labels = cell_labels(found, 40, 40).ravel()
        for depression in found:
            assert (labels[depression.cells] == depression.id).all()
        assert int((labels >= 0).sum()) == sum(len(d.cells) for d in found)

    def test_no_depressions_gives_an_empty_field(self):
        labels = cell_labels([], 5, 5)
        assert (labels == -1).all()

    def test_refuses_an_id_too_wide_for_the_raster(self):
        wide = Depression(
            id=40_000, cells=np.array([0]), capacity_m3=1.0, spill_elevation_m=1.0, spill_cell=1
        )
        with pytest.raises(HydrologyError, match="does not fit"):
            cell_labels([wide], 5, 5)


class TestCondition:
    def test_a_building_becomes_a_ridge_water_runs_around(self):
        barriers = np.zeros((11, 11), dtype=bool)
        barriers[4:7, 4:7] = True
        conditioned = condition(plane(11, 11, fall=0.02), barriers)
        assert (conditioned[4:7, 4:7] > 100.0).all(), "the footprint stands well above the street"
        assert conditioned[0, 0] < 20.0, "and the street beside it does not move"

    def test_no_street_cell_drains_into_a_building(self):
        # Barrier cells route among themselves — they are above everything and
        # nothing reaches them — so the claim is about the street: water on the
        # ground never takes a shortcut through a building.
        barriers = np.zeros((11, 11), dtype=bool)
        barriers[4:7, 4:7] = True
        directions = d8(condition(plane(11, 11, fall=0.02), barriers))

        rows, cols = directions.shape
        for row in range(rows):
            for col in range(cols):
                code = directions[row, col]
                if code == LEAVES_WINDOW or barriers[row, col]:
                    continue
                dc, dr = D8_OFFSETS[code]
                assert 0 <= row + dr < rows and 0 <= col + dc < cols
                assert not barriers[row + dr, col + dc], (
                    f"street cell ({row}, {col}) drains into the building"
                )

    def test_conditioning_fills_so_every_street_cell_has_somewhere_to_go(self):
        surface = bowl(depth=1.0)
        directions = d8(condition(surface))
        interior = directions[1:-1, 1:-1]
        assert (interior != LEAVES_WINDOW).all(), "no interior cell is a dead end"

    def test_rejects_a_barrier_mask_of_the_wrong_shape(self):
        with pytest.raises(HydrologyError, match="barrier mask"):
            condition(plane(9, 9), np.zeros((4, 4), dtype=bool))

    def test_the_barrier_raise_is_far_above_any_real_relief(self):
        # Kensington spans about 33 m. A raise inside that range would let a
        # building sit lower than a hilltop and quietly accept water from it.
        assert BARRIER_RAISE_M > 33.0


class TestD8:
    def test_water_runs_down_a_slope_in_the_slope_direction(self):
        # Columns increase eastward and `plane` falls with the column, so this
        # surface drops to the east and every cell points E, which is code 0.
        directions = d8(condition(plane(9, 9, fall=0.05)))
        assert (directions[1:-1, 1:-1] == 0).all()

    def test_a_diagonal_fall_takes_the_diagonal_code(self):
        # Falling with both column and row: east and south, so south-east,
        # code 1. Rows increase southward — pinned in test_d8_contract.
        row, col = np.mgrid[0:9, 0:9]
        surface = 20.0 - 0.05 * col - 0.05 * row
        directions = d8(condition(surface.astype(np.float64)))
        assert directions[4, 4] == 1, "east plus south is steepest to the south-east"

    def test_a_cell_with_nowhere_lower_leaves_the_window(self):
        assert (d8(np.full((9, 9), 10.0)) == LEAVES_WINDOW).all()

    def test_every_code_is_a_valid_direction_or_the_sentinel(self):
        directions = d8(condition(bowl(depth=1.0)))
        assert set(np.unique(directions)) <= set(range(8)) | {LEAVES_WINDOW}

    def test_ties_go_to_the_lowest_code_so_a_run_is_reproducible(self):
        # A cell one metre above eight equal neighbours: every direction is an
        # equal drop by slope except that diagonals are longer, so the cardinal
        # codes win, and among those the lowest is E.
        surface = np.full((9, 9), 9.0)
        surface[4, 4] = 10.0
        assert d8(surface)[4, 4] == 0
        assert d8(surface)[4, 4] == d8(surface)[4, 4]

    def test_every_cell_points_strictly_downhill_so_no_path_can_cycle(self):
        # The invariant the whole engine rests on. If one cell points level or
        # uphill, a trace can loop, and the guard in the engine turns that into
        # a runtime failure on a real address rather than a build failure here.
        # Checked over every cell of the field, not a sample.
        rough = 10.0 + np.random.default_rng(11).normal(0, 0.4, (60, 60))
        rough[20:30, 20:30] -= 2.0  # a basin, so the fill has real work to do
        conditioned = condition(rough)
        directions = d8(conditioned)

        rows, cols = directions.shape
        for code, (dc, dr) in enumerate(D8_OFFSETS):
            here = directions == code
            if not here.any():
                continue
            r, c = np.nonzero(here)
            assert ((r + dr >= 0) & (r + dr < rows) & (c + dc >= 0) & (c + dc < cols)).all()
            drop = conditioned[r, c] - conditioned[r + dr, c + dc]
            assert (drop > 0).all(), f"code {code} has a cell pointing level or uphill"

    def test_the_steepest_neighbour_wins_over_the_nearest(self):
        surface = np.full((9, 9), 10.0)
        surface[4, 5] = 9.9  # east, 0.1 m down over 1 m  -> slope 0.100
        surface[5, 5] = 9.5  # south-east, 0.5 m down over 1.414 m -> slope 0.354
        assert d8(surface)[4, 4] == 1
