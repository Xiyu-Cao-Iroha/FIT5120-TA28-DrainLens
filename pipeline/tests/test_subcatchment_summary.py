"""What a drainage area contains, and the sentence that makes the numbers honest.

A subcatchment does not stop at the council boundary, so a pit count inside one
is a count of the part this project has data for. The coverage share is what
says so, and the test that matters most here is the one where it is less than
one.
"""

from __future__ import annotations

import math

from drainlens_pipeline import subcatchment_summary as ss
from drainlens_pipeline.geo import Extent

EXTENT = Extent(name="test", min_e=0.0, min_n=0.0, max_e=1_000.0, max_n=1_000.0)

#: A 100 m square at the origin, anticlockwise.
SQUARE = [(0.0, 0.0), (100.0, 0.0), (100.0, 100.0), (0.0, 100.0)]


def ring(e: float, n: float, side: float) -> list[tuple[float, float]]:
    return [(e, n), (e + side, n), (e + side, n + side), (e, n + side)]


class TestArea:
    def test_a_square_is_its_side_squared(self):
        assert abs(ss.polygon_area([SQUARE]) - 10_000.0) < 1e-6

    def test_a_hole_is_taken_out(self):
        # GeoJSON writes a hole the other way round, and the signed areas
        # subtract without anything having to know which ring is which.
        hole = list(reversed(ring(40.0, 40.0, 20.0)))
        assert abs(ss.polygon_area([SQUARE, hole]) - (10_000.0 - 400.0)) < 1e-6


class TestClipping:
    def test_a_shape_wholly_inside_is_unchanged_in_area(self):
        assert abs(ss.ring_area(ss.clip_to_box(SQUARE, (0, 0, 1_000, 1_000))) - 10_000.0) < 1e-6

    def test_half_a_shape_outside_keeps_half(self):
        half = ss.clip_to_box(ring(-50.0, 0.0, 100.0), (0, 0, 1_000, 1_000))
        assert abs(abs(ss.ring_area(half)) - 5_000.0) < 1e-6

    def test_a_shape_wholly_outside_keeps_nothing(self):
        assert ss.clip_to_box(ring(2_000.0, 2_000.0, 100.0), (0, 0, 1_000, 1_000)) == []


class TestCoverage:
    def test_an_area_wholly_inside_reads_one(self):
        # 10,000 m² is 0.01 km².
        assert ss.coverage_of([SQUARE], EXTENT, 0.01) == 1.0

    def test_an_area_half_outside_reads_a_half(self):
        share = ss.coverage_of([ring(-50.0, 0.0, 100.0)], EXTENT, 0.01)
        assert share is not None and abs(share - 0.5) < 1e-6

    def test_it_is_measured_in_the_extent_s_own_frame(self):
        # The bug this test exists for: the boundaries arrive as metres from
        # the extent's corner and were clipped against its MGA corners, which
        # put every one of the council's 35 areas outside the box and read 0.0
        # — a share indistinguishable from a real area outside the extent.
        council = Extent(name="c", min_e=315_000.0, min_n=5_808_500.0, max_e=323_500.0, max_n=5_817_500.0)
        assert ss.coverage_of([ring(100.0, 100.0, 100.0)], council, 0.01) == 1.0

    def test_a_record_without_an_area_has_no_share(self):
        assert ss.coverage_of([SQUARE], EXTENT, None) is None

    def test_it_never_claims_more_of_an_area_than_the_area_has(self):
        # The computed ring and the record differ by the thickness of a
        # published boundary; 1.04 would be this project telling a reader it
        # holds more of an area than exists.
        assert ss.coverage_of([SQUARE], EXTENT, 0.005) == 1.0


class TestPipeLength:
    def test_a_pipe_wholly_inside_keeps_its_length(self):
        assert abs(ss.length_inside([(10.0, 10.0), (10.0, 60.0)], [SQUARE]) - 50.0) < 1e-6

    def test_a_pipe_wholly_outside_contributes_nothing(self):
        assert ss.length_inside([(500.0, 500.0), (500.0, 560.0)], [SQUARE]) == 0.0

    def test_a_pipe_crossing_the_boundary_keeps_only_the_part_inside(self):
        # AC 6.1.3: only the portion of each mapped pipe within the area.
        assert abs(ss.length_inside([(50.0, 50.0), (50.0, 150.0)], [SQUARE]) - 50.0) < 1e-6

    def test_a_pipe_that_leaves_and_returns_keeps_both_pieces(self):
        path = [(50.0, 50.0), (50.0, 150.0), (60.0, 150.0), (60.0, 50.0)]
        # 50 m out, 10 m across outside, 50 m back in.
        assert abs(ss.length_inside(path, [SQUARE]) - 100.0) < 1e-6

    def test_a_pipe_through_a_hole_does_not_count_the_hole(self):
        hole = list(reversed(ring(40.0, 0.0, 20.0)))
        # Straight up the middle: 100 m of square, 20 m of which is the hole.
        assert abs(ss.length_inside([(50.0, 0.0), (50.0, 100.0)], [SQUARE, hole]) - 80.0) < 1e-6


class TestSummarise:
    def areas(self):
        return [("4400", [SQUARE]), ("4401", [ring(200.0, 0.0, 100.0)])]

    def test_pits_are_counted_in_the_area_that_holds_them(self):
        summaries = ss.summarise(
            self.areas(), {}, [(10.0, 10.0), (20.0, 20.0), (210.0, 10.0), (900.0, 900.0)], [], [], EXTENT
        )
        assert [(s.number, s.pits) for s in summaries] == [("4400", 2), ("4401", 1)]

    def test_a_pipe_far_from_any_boundary_is_measured_once_and_whole(self):
        # The fast path: no boundary edge near it, so one containment test and
        # the whole length rather than a cut against every ring.
        summaries = ss.summarise(self.areas(), {}, [], [[(10.0, 10.0), (10.0, 30.0)]], [], EXTENT)
        assert abs(summaries[0].pipe_length_m - 20.0) < 1e-6

    def test_a_pipe_across_a_boundary_is_split_between_the_areas_it_runs_in(self):
        summaries = ss.summarise(self.areas(), {}, [], [[(50.0, 50.0), (250.0, 50.0)]], [], EXTENT)
        assert abs(summaries[0].pipe_length_m - 50.0) < 1e-6
        assert abs(summaries[1].pipe_length_m - 50.0) < 1e-6

    def test_low_areas_are_placed_by_their_middle(self):
        summaries = ss.summarise(self.areas(), {}, [], [], [ring(10.0, 10.0, 20.0), ring(500.0, 500.0, 20.0)], EXTENT)
        assert [(s.number, s.low_areas) for s in summaries] == [("4400", 1), ("4401", 0)]

    def test_the_coverage_share_comes_from_the_record(self):
        [first, _] = ss.summarise(self.areas(), {"4400": 0.01}, [], [], [], EXTENT)
        assert first.coverage == 1.0


class TestMerge:
    def test_each_area_gains_its_summary_and_the_totals_are_summed(self):
        artefact = {"areas": [{"number": "4400"}, {"number": "4401"}], "counts": {"areas": 2}}
        merged = ss.merge(
            artefact,
            [ss.Summary("4400", 10, 120.5, 3, 0.5), ss.Summary("4401", 4, 60.0, 1, None)],
        )
        assert merged["areas"][0]["summary"] == {"pits": 10, "pipeLengthM": 120.5, "lowAreas": 3, "coverage": 0.5}
        # No share where the record has no area: absent rather than null.
        assert "coverage" not in merged["areas"][1]["summary"]
        assert merged["counts"]["pits"] == 14 and merged["counts"]["pipeLengthM"] == 180.5
        assert "City of Melbourne data" in merged["coverage"]

    def test_an_area_the_summary_does_not_cover_is_left_alone(self):
        artefact = {"areas": [{"number": "9999"}], "counts": {}}
        merged = ss.merge(artefact, [ss.Summary("4400", 1, 1.0, 0, None)])
        assert "summary" not in merged["areas"][0]


class TestCentroid:
    def test_a_square_s_middle_is_its_middle(self):
        x, y = ss.centroid(SQUARE)
        assert math.isclose(x, 50.0) and math.isclose(y, 50.0)
