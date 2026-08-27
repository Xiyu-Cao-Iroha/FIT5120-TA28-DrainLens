"""Tests for the ground filter, against surfaces whose answer is known.

The failure mode that matters is not "the filter leaves a building standing".
That one is obvious in any rendering. The dangerous one is a filter that
removes buildings *and* shaves the terrain, because the output still looks like
a ground surface, the scenario engine still runs on it, and every slope it
reports is wrong. Most of what follows tests the second thing.
"""

from __future__ import annotations

import numpy as np
import pytest

from drainlens_pipeline.ground import (
    GroundError,
    build_ground_surface,
    fill_holes,
    minimum_surface,
    object_mask,
)

CELL = 1.0


def points_from(surface: np.ndarray, min_e: float = 0.0, min_n: float = 0.0) -> np.ndarray:
    """One point per cell, at the cell centre, at that cell's elevation."""
    rows, cols = surface.shape
    row, col = np.mgrid[0:rows, 0:cols]
    e = min_e + (col + 0.5) * CELL
    n = min_n + (rows - 1 - row + 0.5) * CELL
    return np.column_stack([e.ravel(), n.ravel(), surface.ravel()])


def plane(rows: int, cols: int, *, base: float = 10.0, fall: float = 0.0) -> np.ndarray:
    """A surface falling `fall` metres per metre towards the east."""
    _, col = np.mgrid[0:rows, 0:cols]
    return base - fall * col * CELL


class TestMinimumSurface:
    def test_keeps_the_lowest_point_in_each_cell(self):
        points = np.array(
            [
                [0.5, 0.5, 12.0],
                [0.5, 0.5, 3.0],  # same cell, lower
                [0.5, 0.5, 7.0],
                [1.5, 0.5, 5.0],
            ]
        )
        surface, observed = minimum_surface(points, 0, 0, 2, 1, CELL)
        assert surface.tolist() == [[3.0, 5.0]]
        assert observed.all()

    def test_row_zero_is_the_northern_edge(self):
        points = np.array([[0.5, 9.5, 1.0], [0.5, 0.5, 2.0]])
        surface, _ = minimum_surface(points, 0, 0, 1, 10, CELL)
        assert surface[0, 0] == 1.0, "the northernmost point belongs in row 0"
        assert surface[-1, 0] == 2.0

    def test_points_outside_the_extent_are_dropped(self):
        points = np.array([[0.5, 0.5, 5.0], [50.0, 0.5, -99.0]])
        surface, observed = minimum_surface(points, 0, 0, 2, 1, CELL)
        assert surface[0, 0] == 5.0
        assert not observed[0, 1], "the far point must not land in a neighbouring cell"

    def test_a_cell_no_point_reached_is_marked_unobserved(self):
        points = np.array([[0.5, 0.5, 5.0]])
        _, observed = minimum_surface(points, 0, 0, 3, 1, CELL)
        assert observed.tolist() == [[True, False, False]]

    def test_rejects_a_non_positive_cell_size(self):
        with pytest.raises(GroundError, match="positive"):
            minimum_surface(np.zeros((1, 3)), 0, 0, 1, 1, 0.0)

    def test_rejects_an_extent_smaller_than_a_cell(self):
        with pytest.raises(GroundError, match="smaller than one cell"):
            minimum_surface(np.zeros((1, 3)), 0, 0, 0.4, 0.4, CELL)


class TestFillHoles:
    def test_an_empty_cell_takes_the_nearest_measured_value(self):
        surface = np.array([[5.0, np.inf, 9.0]])
        observed = np.array([[True, False, True]])
        assert fill_holes(surface, observed)[0, 1] in (5.0, 9.0)

    def test_a_fully_observed_surface_is_returned_unchanged(self):
        surface = np.array([[1.0, 2.0]])
        filled = fill_holes(surface, np.ones((1, 2), bool))
        assert filled.tolist() == surface.tolist()
        assert filled is not surface, "the caller must not be handed the input to mutate"

    def test_refuses_a_surface_with_nothing_measured(self):
        with pytest.raises(GroundError, match="no cell"):
            fill_holes(np.full((2, 2), np.inf), np.zeros((2, 2), bool))


class TestObjectMask:
    def test_a_flat_surface_holds_nothing_up(self):
        assert not object_mask(plane(30, 30), CELL).any()

    def test_a_constant_slope_is_terrain_not_an_object(self):
        # 10% — steeper than most Melbourne streets, and well inside the 15%
        # threshold at every window size. A filter that flags this would
        # "correct" the very gradient the scenario model routes water down.
        assert not object_mask(plane(30, 30, fall=0.10), CELL).any()

    def test_a_building_is_flagged(self):
        surface = plane(40, 40)
        surface[12:24, 12:24] += 6.0  # 12 m square, 6 m tall
        flagged = object_mask(surface, CELL)
        assert flagged[12:24, 12:24].all(), "every cell of the building must be flagged"
        assert not flagged[0:8, 0:8].any(), "ground well away from it must not be"

    def test_a_tree_sized_spike_is_flagged(self):
        surface = plane(30, 30)
        surface[14:17, 14:17] += 8.0
        assert object_mask(surface, CELL)[14:17, 14:17].all()

    def test_a_broad_hill_survives(self):
        # 100 m across, 4 m high: a 4% average gradient. Real terrain, and the
        # kind a fixed-window filter destroys.
        rows = cols = 100
        y, x = np.mgrid[0:rows, 0:cols]
        r = np.hypot(x - 50, y - 50)
        surface = 10.0 + 4.0 * np.clip(1 - r / 50, 0, None)
        assert not object_mask(surface, CELL).any()

    def test_a_wider_window_catches_a_wider_building(self):
        surface = plane(80, 80)
        surface[20:60, 20:60] += 5.0  # 40 m across
        narrow = object_mask(surface, CELL, max_window_m=6.0)
        wide = object_mask(surface, CELL, max_window_m=48.0)
        assert not narrow[35:45, 35:45].any(), "a 6 m window cannot see into a 40 m roof"
        assert wide[35:45, 35:45].all()

    def test_rejects_a_slope_threshold_outside_zero_to_one(self):
        with pytest.raises(GroundError, match="fraction"):
            object_mask(plane(5, 5), CELL, slope_threshold=1.5)


class TestBuildGroundSurface:
    def test_the_ground_under_a_building_comes_from_the_ground_around_it(self):
        surface = plane(40, 40, base=10.0)
        surface[14:26, 14:26] += 7.0
        result = build_ground_surface(points_from(surface), 0, 0, 40, 40)

        under = result.elevation[14:26, 14:26]
        assert np.allclose(under, 10.0), "the roof must not survive as ground"
        assert not result.observed[14:26, 14:26].any(), "and it must be reported as interpolated"

    def test_a_slope_is_reproduced_not_flattened(self):
        surface = plane(40, 40, base=20.0, fall=0.03)
        result = build_ground_surface(points_from(surface), 0, 0, 40, 40)
        assert np.allclose(result.elevation, surface, atol=1e-6)
        assert result.filled_fraction == 0.0

    def test_a_building_on_a_slope_leaves_the_slope_behind(self):
        # The case that decides whether the surface is usable: the scenario
        # engine needs the gradient *under* the buildings, because that is
        # where the street between them runs.
        surface = plane(60, 60, base=25.0, fall=0.02)
        surface[20:32, 20:32] += 8.0
        result = build_ground_surface(points_from(surface), 0, 0, 60, 60)

        recovered = result.elevation[20:32, 20:32]
        expected = plane(60, 60, base=25.0, fall=0.02)[20:32, 20:32]
        assert np.abs(recovered - expected).max() < 0.35, (
            "nearest-neighbour fill should land within a few centimetres of the "
            "true slope at a 2% gradient"
        )

    def test_filled_fraction_counts_what_was_not_measured(self):
        surface = plane(20, 20)
        points = points_from(surface)
        points = points[: len(points) // 2]  # leave the southern half unmeasured
        result = build_ground_surface(points, 0, 0, 20, 20)
        assert result.filled_fraction == pytest.approx(0.5, abs=0.01)

    def test_elevation_at_reads_the_cell_containing_the_coordinate(self):
        surface = plane(10, 10, base=5.0, fall=0.1)
        result = build_ground_surface(points_from(surface, 316_500, 5_814_500), 316_500, 5_814_500, 316_510, 5_814_510)
        assert result.elevation_at(316_500.5, 5_814_509.5) == pytest.approx(5.0)
        assert result.elevation_at(316_509.5, 5_814_509.5) == pytest.approx(4.1)

    def test_elevation_at_refuses_a_coordinate_outside_the_surface(self):
        result = build_ground_surface(points_from(plane(5, 5)), 0, 0, 5, 5)
        with pytest.raises(GroundError, match="outside"):
            result.elevation_at(500.0, 500.0)

    def test_shape_follows_the_extent_and_cell_size(self):
        result = build_ground_surface(points_from(plane(20, 20)), 0, 0, 20, 20, cell_size_m=2.0)
        assert result.shape == (10, 10)

    def test_a_threshold_that_rejects_the_ground_itself_is_an_error_not_a_surface(self):
        # Rough ground and a threshold far too tight: the filter throws away
        # all but the local minima, and what is left is interpolation between
        # scattered cells. Better to stop than to publish it.
        rough = 10.0 + np.random.default_rng(7).normal(0, 1.0, (40, 40))
        with pytest.raises(GroundError, match="measured ground cell"):
            build_ground_surface(points_from(rough), 0, 0, 40, 40, slope_threshold=0.001)

    def test_a_steep_street_survives_at_the_working_threshold(self):
        # 20% is steeper than anything in the demonstration extent, and the
        # filter leaves every cell of it measured.
        result = build_ground_surface(points_from(plane(40, 40, fall=0.2)), 0, 0, 40, 40)
        assert result.filled_fraction == 0.0

    def test_the_edge_effect_is_confined_to_the_uphill_band(self):
        # Opening is exact on an *infinite* plane; on a truncated one the
        # structuring element will not fit past the uphill edge, so a band
        # there is shaved however tight the threshold. This pins where that
        # band is — the outer max_window_m / 2 — so it cannot quietly spread
        # inwards, and so a future buffered build knows what to crop.
        result = build_ground_surface(
            points_from(plane(40, 40, fall=0.2)), 0, 0, 40, 40,
            max_window_m=18.0, slope_threshold=0.001,
        )
        band = 9  # max_window_m / 2, in cells
        assert not result.observed[:, :band].all(), "the uphill edge is where it bites"
        assert result.observed[:, band:].all(), "and it must not reach the interior"

    def test_the_measured_fraction_floor_is_the_callers_to_set(self):
        surface = plane(20, 20)
        points = points_from(surface)[:20]  # 5% of cells measured
        build_ground_surface(points, 0, 0, 20, 20, min_measured_fraction=0.05)
        with pytest.raises(GroundError, match="10.0% this build accepts"):
            build_ground_surface(points, 0, 0, 20, 20, min_measured_fraction=0.10)
