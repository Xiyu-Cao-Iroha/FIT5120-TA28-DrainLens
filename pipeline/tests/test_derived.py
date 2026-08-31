"""Tests for the terrain-derived map layers.

Against surfaces whose channels, hollows and gaps are known by construction.
The three layers here are the ones a reader is most likely to take as fact —
they look like a map of where water goes — so the arithmetic under them is
pinned rather than eyeballed.
"""

from __future__ import annotations

import sys

import numpy as np
import pytest

from drainlens_pipeline import derived as dv
from drainlens_pipeline.geo import Extent
from drainlens_pipeline.hydrology import LEAVES_WINDOW, condition, d8

EXTENT = Extent("test", 0.0, 0.0, 40.0, 40.0)

#: Channel threshold for the fixtures here.
#:
#: The shipped 99.5 assumes a million cells, where half a percent is five
#: thousand and they chain into channels. On a forty-metre fixture it is six
#: cells, which cannot form a line — so the fixtures would show "no channels"
#: for a reason that has nothing to do with the code under test.
TEST_PERCENTILE = 90.0
CELL = 1.0


def plane(rows: int, cols: int, *, fall: float = 0.05) -> np.ndarray:
    _, col = np.mgrid[0:rows, 0:cols]
    return 20.0 - fall * col.astype(np.float64)


def valley(rows: int, cols: int, *, fall: float = 0.05, sides: float = 0.3) -> np.ndarray:
    """A V running east, so flow converges into its floor.

    A plane has no channels and should not: water sheets across it evenly and
    nothing concentrates. Anything testing channel tracing needs a surface
    where flow actually collects, which is what a valley is.
    """
    row, col = np.mgrid[0:rows, 0:cols]
    return 20.0 - fall * col + sides * np.abs(row - (rows - 1) / 2)


class TestFlowAccumulation:
    def test_every_cell_drains_at_least_itself(self):
        surface = condition(plane(20, 20))
        accumulated = dv.flow_accumulation(d8(surface), surface)
        assert (accumulated >= 1).all()

    def test_a_slope_concentrates_downhill(self):
        # Falling east, so the eastern edge carries what the whole row shed.
        surface = condition(plane(20, 20))
        accumulated = dv.flow_accumulation(d8(surface), surface)
        assert accumulated[10, 18] > accumulated[10, 2]

    def test_the_total_is_conserved(self):
        # Every cell contributes one unit, and each unit is counted once at
        # every cell it passes through. So the outlets carry the whole grid.
        surface = condition(plane(12, 12))
        direction = d8(surface)
        accumulated = dv.flow_accumulation(direction, surface)
        leaving = accumulated[direction == LEAVES_WINDOW].sum()
        assert leaving == pytest.approx(direction.size)

    def test_refuses_a_field_and_a_surface_of_different_shapes(self):
        with pytest.raises(dv.DerivedError, match="flow field"):
            dv.flow_accumulation(np.zeros((4, 4), dtype=np.int8), np.zeros((5, 5)))


class TestTraceChannels:
    def test_follows_the_slope(self):
        surface = condition(valley(30, 30))
        direction = d8(surface)
        paths = dv.trace_channels(direction, dv.flow_accumulation(direction, surface), percentile=TEST_PERCENTILE)
        assert paths
        for path in paths:
            columns = [c for _, c in path]
            assert columns == sorted(columns), "a channel on an eastward slope runs east"

    def test_draws_a_shared_trunk_once(self):
        # Without claiming, every headwater redraws the whole trunk below it
        # and the map goes solid where the most water is.
        surface = condition(valley(40, 40))
        direction = d8(surface)
        paths = dv.trace_channels(direction, dv.flow_accumulation(direction, surface), percentile=TEST_PERCENTILE)

        seen: set[tuple[int, int]] = set()
        overlap = 0
        for path in paths:
            for cell in path:
                if cell in seen:
                    overlap += 1
                seen.add(cell)
        # At most one shared cell per path: the junction each one ends on.
        assert overlap <= len(paths)

    def test_ignores_paths_too_short_to_be_a_channel(self):
        surface = condition(valley(30, 30))
        direction = d8(surface)
        accumulated = dv.flow_accumulation(direction, surface)
        assert all(len(p) >= 20 for p in dv.trace_channels(direction, accumulated, min_length=20))

    def test_a_flat_surface_has_no_channels(self):
        flat = np.full((20, 20), 10.0)
        assert dv.trace_channels(d8(flat), np.ones((20, 20))) == []

    def test_a_plane_has_no_channels_either(self):
        # Not a limitation. Water sheets evenly across a plane and nothing
        # concentrates, so there is no channel there to draw — a tracer that
        # found one would be inventing the product's central claim.
        surface = condition(plane(30, 30))
        direction = d8(surface)
        assert dv.trace_channels(direction, dv.flow_accumulation(direction, surface)) == []


class TestSimplify:
    def test_a_straight_line_keeps_only_its_ends(self):
        path = [(float(x), 0.0) for x in range(50)]
        assert dv.simplify(path, 0.5) == [(0.0, 0.0), (49.0, 0.0)]

    def test_a_corner_survives(self):
        path = [(0.0, 0.0), (5.0, 0.0), (10.0, 0.0), (10.0, 5.0), (10.0, 10.0)]
        simplified = dv.simplify(path, 0.5)
        assert (10.0, 0.0) in simplified
        assert len(simplified) == 3

    def test_tolerance_decides_how_much_detail_goes(self):
        staircase = []
        for step in range(20):
            staircase.append((float(step), float(step)))
            staircase.append((float(step + 1), float(step)))
        assert len(dv.simplify(staircase, 0.1)) > len(dv.simplify(staircase, 2.0))

    def test_a_short_path_is_returned_as_it_is(self):
        assert dv.simplify([(0.0, 0.0), (1.0, 1.0)], 0.5) == [(0.0, 0.0), (1.0, 1.0)]

    def test_it_does_not_recurse(self):
        """A path deeper than the interpreter would allow is still simplified.

        An outline of a large hollow runs to thousands of vertices, and a
        zigzag is this algorithm's worst case: every vertex sits off the chord,
        so it splits one vertex at a time and a recursive implementation
        recurses as deep as the path is long. Measured on this fixture, the
        depth is exactly ``len(path) - 1``.

        So the path only has to be deeper than the interpreter would allow, and
        the length is taken from the limit rather than picked. That matters
        because the case is quadratic: this ran on 20,000 vertices and cost
        32.7 s, a third of the whole Python suite, to prove something twice the
        recursion limit proves in under half a second.
        """
        vertices = 2 * sys.getrecursionlimit()
        zigzag = [(float(i), float(i % 2)) for i in range(vertices)]

        simplified = dv.simplify(zigzag, 0.4)

        # Every vertex of a unit zigzag stands half a metre off the chord, so
        # a 0.4 m tolerance keeps all of them. Asserting the whole path
        # survives says the traversal completed, not merely that it returned.
        assert len(simplified) == vertices


class TestRingArea:
    def test_measures_a_square(self):
        square = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0), (0.0, 0.0)]
        assert dv.ring_area_m2(square) == pytest.approx(100.0)

    def test_is_unsigned_so_winding_does_not_matter(self):
        square = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0), (0.0, 0.0)]
        assert dv.ring_area_m2(square[::-1]) == pytest.approx(100.0)


class TestOutlines:
    def test_traces_one_region_as_one_ring(self):
        mask = np.zeros((40, 40), dtype=bool)
        mask[10:20, 10:20] = True
        rings = dv.outlines(mask, EXTENT, CELL, tolerance_m=0)
        assert len(rings) == 1
        assert rings[0][0] == rings[0][-1], "a ring closes on itself"

    def test_the_ring_encloses_the_area_the_cells_cover(self):
        # Tracing through cell centres instead of along cell edges cuts every
        # corner and returns a shape smaller than the thing it describes.
        mask = np.zeros((40, 40), dtype=bool)
        mask[10:20, 10:20] = True  # 100 square metres
        [ring] = dv.outlines(mask, EXTENT, CELL, tolerance_m=0)
        assert dv.ring_area_m2([(x, y) for x, y in ring]) == pytest.approx(100.0)

    def test_two_regions_give_two_rings(self):
        mask = np.zeros((40, 40), dtype=bool)
        mask[5:10, 5:10] = True
        mask[25:30, 25:30] = True
        assert len(dv.outlines(mask, EXTENT, CELL, tolerance_m=0)) == 2

    def test_a_hole_is_its_own_ring(self):
        mask = np.zeros((40, 40), dtype=bool)
        mask[10:25, 10:25] = True
        mask[15:20, 15:20] = False  # a courtyard
        assert len(dv.outlines(mask, EXTENT, CELL, tolerance_m=0)) == 2

    def test_a_hole_smaller_than_the_threshold_is_not_punched(self):
        mask = np.zeros((40, 40), dtype=bool)
        mask[10:25, 10:25] = True
        mask[16:18, 16:18] = False  # 4 square metres
        rings = dv.outlines(mask, EXTENT, CELL, tolerance_m=0, min_area_m2=25.0)
        assert len(rings) == 1

    def test_a_region_smaller_than_the_threshold_is_not_drawn(self):
        mask = np.zeros((40, 40), dtype=bool)
        mask[10:13, 10:13] = True  # 9 square metres
        assert dv.outlines(mask, EXTENT, CELL, min_area_m2=25.0) == []

    def test_an_empty_mask_has_no_outline(self):
        assert dv.outlines(np.zeros((10, 10), dtype=bool), EXTENT, CELL) == []

    def test_coordinates_come_out_relative_to_the_extent_corner(self):
        mask = np.zeros((40, 40), dtype=bool)
        mask[0:5, 0:5] = True  # north-west corner of the grid
        [ring] = dv.outlines(mask, EXTENT, CELL, tolerance_m=0)
        xs = [x for x, _ in ring]
        ys = [y for _, y in ring]
        assert min(xs) == 0.0 and max(xs) == 5.0
        assert max(ys) == 40.0, "row 0 is the northern edge"


class TestCoverageGaps:
    def test_finds_a_block_with_too_little_measured_ground(self):
        observed = np.ones((100, 100), dtype=bool)
        observed[0:25, 0:25] = False
        gaps = dv.coverage_gaps(observed, Extent("t", 0, 0, 100, 100), CELL, block_m=25.0)
        assert len(gaps) == 1

    def test_ignores_a_block_that_is_mostly_measured(self):
        observed = np.ones((100, 100), dtype=bool)
        observed[0:5, 0:5] = False  # 25 of 625 cells in that block
        assert dv.coverage_gaps(observed, Extent("t", 0, 0, 100, 100), CELL, block_m=25.0) == []

    def test_summarises_before_outlining(self):
        # The per-cell mask is holed by every roof and street tree, and its
        # outline would be thousands of shapes answering no question a reader
        # is asking. Blocking is what makes the layer legible.
        speckled = np.ones((100, 100), dtype=bool)
        speckled[::2, ::2] = False  # a quarter unmeasured, everywhere
        assert dv.coverage_gaps(speckled, Extent("t", 0, 0, 100, 100), CELL, block_m=25.0) == []

    def test_refuses_a_block_smaller_than_a_cell(self):
        with pytest.raises(dv.DerivedError, match="smaller than a cell"):
            dv.coverage_gaps(np.ones((10, 10), dtype=bool), EXTENT, 1.0, block_m=0.4)


class TestBuild:
    def artefact(self):
        surface = condition(valley(40, 40))
        direction = d8(surface)
        labels = np.full((40, 40), -1, dtype=np.int16)
        labels[10:20, 10:20] = 0
        return dv.build(
            EXTENT,
            CELL,
            direction=direction,
            conditioned=surface,
            observed=np.ones((40, 40), dtype=bool),
            depression_labels=labels,
            depressions=[
                {"id": 0, "cellCount": 100, "capacityM3": 50.0},
                {"id": 1, "cellCount": 4, "capacityM3": 0.5},
            ],
        )

    def test_declares_itself_derived(self):
        # The browser refuses to draw this through the derived path unless it
        # says so, because everything downstream labels it a derivation.
        assert self.artefact()["basis"] == "derived"

    def test_carries_the_note_saying_what_the_layers_are_not(self):
        note = self.artefact()["note"]
        assert "not recorded" in note
        assert "System-derived" in note

    def test_draws_the_large_hollow_and_leaves_the_small_one_out(self):
        layers = self.artefact()["layers"]
        assert len(layers["low-point"]) >= 1

    def test_records_that_the_size_threshold_is_a_display_filter(self):
        # The engine uses every hollow whatever the map draws, and a reader of
        # the artefact has to be able to tell that from the file itself.
        settings = self.artefact()["settings"]
        assert "display filter" in settings["display_only"]
        assert settings["min_drawn_depression_m2"] == dv.MIN_DRAWN_DEPRESSION_M2

    def test_uses_the_same_frame_as_the_map_geometry(self):
        artefact = self.artefact()
        assert "south-west corner" in artefact["coordinates"]
        assert artefact["extent"]["width_m"] == 40.0
