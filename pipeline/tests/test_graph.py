"""Tests for the drainage graph builder.

Every fixture below is a shape the real City of Melbourne data actually
contains — a self-loop, a cycle, a fan-out, a dangling reference — rather than a
shape invented to exercise a branch.
"""

from __future__ import annotations

import json

import pytest

from drainlens_pipeline.classification import (
    classify_object_type,
    is_probable_inlet,
)
from drainlens_pipeline.graph import build, to_artefact


def pit(asset, object_type="Junction", lat=-37.8, lon=144.96):
    return {
        "asset_number": asset,
        "object_type_lupvalue": object_type,
        "lat": lat,
        "lon": lon,
    }


def pipe(ref, up, down, diameter=300, **extra):
    record = {"ref": ref, "upstr_pit": up, "dnstr_pit": down, "diameter": diameter}
    record.update(extra)
    return record


class TestClassification:
    @pytest.mark.parametrize(
        "object_type,expected",
        [
            ("Grated OFK", "inlet"),
            ("Grated Kerbside", "inlet"),
            ("Side Entry", "inlet"),
            ("Junction", "network-internal"),
            ("Submerged", "network-internal"),
            ("Lane Type", "unclear"),
            ("Other", "unclear"),
            ("Not Known", "unknown"),
            ("", "unknown"),
            ("   ", "unknown"),
            (None, "unknown"),
        ],
    )
    def test_known_types(self, object_type, expected):
        assert classify_object_type(object_type) == expected

    def test_an_unrecognised_type_is_unknown_not_absorbed(self):
        # A type appearing in a future data release must surface as unknown and
        # be counted, never be quietly folded into an existing class.
        assert classify_object_type("Grated Something New") == "unknown"

    def test_only_inlets_are_offered_as_entry_points(self):
        assert is_probable_inlet("Grated Kerbside") is True
        assert is_probable_inlet("Junction") is False
        assert is_probable_inlet("Lane Type") is False


class TestBuild:
    def test_builds_a_simple_chain(self):
        g = build(
            [pipe("p1", "a", "b"), pipe("p2", "b", "c")],
            [pit("a", "Grated OFK"), pit("b"), pit("c")],
        )
        assert g.stats.edges_total == 2
        assert g.stats.edges_fully_resolved == 2
        assert g.downstream["a"] == [0]
        assert g.downstream["b"] == [1]
        assert "c" not in g.downstream
        assert g.stats.back_edges == 0

    def test_excludes_self_loops_and_counts_them(self):
        g = build([pipe("p1", "a", "a"), pipe("p2", "a", "b")], [pit("a"), pit("b")])
        assert g.stats.self_loops_excluded == 1
        assert g.stats.edges_total == 1

    def test_keeps_a_pipe_leading_to_a_pit_absent_from_the_dataset(self):
        # 1,622 real pipes name a downstream pit that is not in the pit export.
        # The pipe exists and a trace can reach it; where it leads is unknown.
        # Dropping it would make the network look as though the pipe were not
        # there at all, which is the opposite of what AC 1.2.d asks for.
        g = build([pipe("p1", "a", "ghost")], [pit("a")])
        assert g.stats.edges_total == 1
        assert g.stats.edges_to_unknown_pit == 1
        assert g.stats.edges_fully_resolved == 0
        assert g.edges[0].downstream is None
        assert g.downstream["a"] == [0]
        assert g.unresolved_endpoints == ["p1"]

    def test_drops_a_pipe_no_trace_could_ever_reach(self):
        # Upstream pit absent: nothing can arrive at this pipe, so it is not an
        # edge. Counted separately from the downstream case, which is reachable.
        g = build([pipe("p1", "ghost", "b")], [pit("b")])
        assert g.stats.edges_total == 0
        assert g.stats.upstream_unresolved == 1
        assert g.unresolved_endpoints == ["p1"]

    def test_flags_a_pipe_missing_an_endpoint_entirely(self):
        g = build([pipe("p1", "a", None)], [pit("a")])
        assert g.unresolved_endpoints == ["p1"]
        assert g.stats.endpoints_unrecorded == 1

    def test_ignores_a_pipe_with_no_reference(self):
        g = build([pipe(None, "a", "b")], [pit("a"), pit("b")])
        assert g.stats.edges_total == 0
        assert g.unresolved_endpoints == []

    def test_ignores_a_pit_with_no_asset_number(self):
        g = build([], [pit(None), pit("a")])
        assert set(g.nodes) == {"a"}

    def test_normalises_integer_identifiers_to_strings(self):
        # The source publishes identifiers as integers; everything downstream
        # joins on strings.
        g = build([pipe(1473265, 1472761, 1472763)], [pit(1472761), pit(1472763)])
        assert g.stats.edges_total == 1
        assert g.edges[0].upstream == "1472761"
        assert g.edges[0].pipe_ref == "1473265"

    def test_records_a_fan_out_as_several_downstream_paths(self):
        # 62.5% of real traces meet a branching node. Multiple downstream paths
        # are the normal case and must never collapse to one.
        g = build(
            [pipe("p1", "a", "b"), pipe("p2", "a", "c"), pipe("p3", "a", "d")],
            [pit("a"), pit("b"), pit("c"), pit("d")],
        )
        assert len(g.downstream["a"]) == 3

    def test_detects_a_cycle_and_records_the_back_edge(self):
        g = build(
            [pipe("p1", "a", "b"), pipe("p2", "b", "c"), pipe("p3", "c", "a")],
            [pit("a"), pit("b"), pit("c")],
        )
        assert g.stats.back_edges == 1
        assert g.stats.nodes_in_cycles == 2

    def test_terminates_on_a_cycle_that_is_only_reachable_from_outside(self):
        g = build(
            [
                pipe("p0", "entry", "a"),
                pipe("p1", "a", "b"),
                pipe("p2", "b", "a"),
            ],
            [pit("entry"), pit("a"), pit("b")],
        )
        assert g.stats.back_edges == 1


class TestNominalSize:
    def test_uses_the_diameter_of_a_circular_pipe(self):
        g = build([pipe("p1", "a", "b", diameter=450)], [pit("a"), pit("b")])
        assert g.edges[0].nominal_size_mm == 450

    def test_uses_the_smaller_dimension_of_a_box_culvert(self):
        # The smaller dimension is the one that constrains a step-down.
        g = build(
            [pipe("p1", "a", "b", diameter=None, width_mm=900, height_mm=600)],
            [pit("a"), pit("b")],
        )
        assert g.edges[0].nominal_size_mm == 600

    def test_leaves_size_unknown_when_the_source_records_none(self):
        g = build(
            [pipe("p1", "a", "b", diameter=None)],
            [pit("a"), pit("b")],
        )
        assert g.edges[0].nominal_size_mm is None
        assert g.edges[0].narrowing is False

    def test_treats_a_zero_diameter_as_unrecorded(self):
        g = build([pipe("p1", "a", "b", diameter=0)], [pit("a"), pit("b")])
        assert g.edges[0].nominal_size_mm is None


class TestNarrowing:
    def test_marks_a_pipe_narrower_than_the_one_immediately_upstream(self):
        g = build(
            [pipe("wide", "a", "b", diameter=600), pipe("narrow", "b", "c", diameter=300)],
            [pit("a"), pit("b"), pit("c")],
        )
        by_ref = {e.pipe_ref: e for e in g.edges}
        assert by_ref["narrow"].narrowing is True
        assert by_ref["wide"].narrowing is False
        assert g.stats.narrowing_edges == 1

    def test_does_not_mark_a_pipe_that_widens(self):
        g = build(
            [pipe("small", "a", "b", diameter=300), pipe("big", "b", "c", diameter=600)],
            [pit("a"), pit("b"), pit("c")],
        )
        assert g.stats.narrowing_edges == 0

    def test_marks_a_narrowing_against_any_one_of_several_upstream_pipes(self):
        g = build(
            [
                pipe("in1", "a", "j", diameter=300),
                pipe("in2", "b", "j", diameter=750),
                pipe("out", "j", "c", diameter=450),
            ],
            [pit("a"), pit("b"), pit("j"), pit("c")],
        )
        by_ref = {e.pipe_ref: e for e in g.edges}
        assert by_ref["out"].narrowing is True

    def test_an_unknown_upstream_size_cannot_create_a_narrowing(self):
        g = build(
            [
                pipe("unknown", "a", "b", diameter=None),
                pipe("known", "b", "c", diameter=300),
            ],
            [pit("a"), pit("b"), pit("c")],
        )
        by_ref = {e.pipe_ref: e for e in g.edges}
        assert by_ref["known"].narrowing is False


class TestOperator:
    def test_keeps_a_named_operator(self):
        g = build(
            [pipe("p1", "a", "b", operator="City of Melbourne")],
            [pit("a"), pit("b")],
        )
        assert g.edges[0].operator == "City of Melbourne"

    @pytest.mark.parametrize("value", [None, "", "   ", 4])
    def test_treats_an_unusable_operator_as_absent(self, value):
        # 5.4% of pipes carry the string "4" or null. The interface must be able
        # to say the operator is not recorded, which means it must arrive here
        # as None rather than as noise.
        g = build([pipe("p1", "a", "b", operator=value)], [pit("a"), pit("b")])
        assert g.edges[0].operator is None


class TestArtefact:
    def test_serialises_to_a_json_round_trip(self):
        g = build(
            [pipe("p1", "a", "b"), pipe("p2", "b", "c")],
            [pit("a", "Grated OFK"), pit("b"), pit("c")],
        )
        artefact = to_artefact(g, "com-drainage@2023-02-26", generated_at="2026-08-27T00:00:00+00:00")
        restored = json.loads(json.dumps(artefact))

        assert restored["dataVersionId"] == "com-drainage@2023-02-26"
        assert restored["generatedAt"] == "2026-08-27T00:00:00+00:00"
        assert [n["assetNumber"] for n in restored["nodes"]] == ["a", "b", "c"]
        assert restored["nodes"][0]["inletClass"] == "inlet"
        assert restored["edges"][0] == {
            "pipeRef": "p1",
            "u": 0,
            "d": 1,
            "sizeMm": 300,
            "operator": None,
            "narrowing": False,
        }
        assert restored["downstream"] == [[0], [1], []]
        assert restored["stats"]["edgesTotal"] == 2

    def test_records_back_edges_as_node_indices(self):
        g = build(
            [pipe("p1", "a", "b"), pipe("p2", "b", "a")],
            [pit("a"), pit("b")],
        )
        artefact = to_artefact(g, "v1")
        assert artefact["backEdges"] == [[1, 0]]

    def test_serialises_an_unknown_destination_as_null(self):
        g = build([pipe("p1", "a", "ghost")], [pit("a")])
        artefact = to_artefact(g, "v1")
        assert artefact["edges"][0]["d"] is None
        assert artefact["stats"]["edgesToUnknownPit"] == 1

    def test_an_edge_with_no_destination_cannot_close_a_cycle(self):
        g = build(
            [pipe("p1", "a", "ghost"), pipe("p2", "a", "b"), pipe("p3", "b", "a")],
            [pit("a"), pit("b")],
        )
        assert g.stats.back_edges == 1

    def test_stamps_a_generation_time_when_none_is_supplied(self):
        artefact = to_artefact(build([], []), "v1")
        assert artefact["generatedAt"].endswith("+00:00")

    def test_counts_every_inlet_class_including_the_empty_ones(self):
        g = build(
            [],
            [pit("a", "Grated OFK"), pit("b", "Junction"), pit("c", "Lane Type"), pit("d", None)],
        )
        counts = to_artefact(g, "v1")["stats"]["inletClassCounts"]
        assert counts == {"inlet": 1, "network-internal": 1, "unclear": 1, "unknown": 1}
