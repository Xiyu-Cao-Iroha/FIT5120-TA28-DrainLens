"""Tests for the extent-scoped trace artefact.

The distinction this module exists for is the one worth testing hardest: a
pipe leaving the extent and a pipe the council never finished recording look
identical in `map.json` and must never be reported as the same thing.
"""

from __future__ import annotations

import json

import pytest

from drainlens_pipeline.trace import (
    TERMINATIONS,
    TraceError,
    back_edge_set,
    build,
    index_graph,
    main,
)


def map_artefact(*assets):
    return {"layers": {"pit": [{"asset_number": a} for a in assets]}}


def graph(nodes, edges, back_edges=()):
    """`nodes` are asset numbers; `edges` are (pipe_ref, u_index, d_index_or_None)."""
    return {
        "artefactVersion": 1,
        "dataVersionId": "test-version",
        "nodes": [{"assetNumber": a} for a in nodes],
        "edges": [{"pipeRef": ref, "u": u, "d": d} for ref, u, d in edges],
        "backEdges": [list(pair) for pair in back_edges],
    }


class TestIndexing:
    def test_edges_are_grouped_by_their_upstream_pit(self):
        indexed = index_graph(graph(["A", "B", "C"], [("p1", 0, 1), ("p2", 0, 2)]))
        assert indexed["A"] == [("p1", "B"), ("p2", "C")]

    def test_an_unrecorded_destination_survives_indexing(self):
        # Dropping it here would turn the council's gap into no pipe at all,
        # which is a different and untrue statement about the record.
        indexed = index_graph(graph(["A"], [("p1", 0, None)]))
        assert indexed["A"] == [("p1", None)]

    def test_asset_numbers_are_strings_whichever_type_the_source_used(self):
        # The pit export gives ints and the graph gives strings. A join on the
        # raw values silently matches nothing.
        indexed = index_graph(graph([1139951], [("p1", 0, None)]))
        assert "1139951" in indexed

    def test_a_graph_without_nodes_is_refused(self):
        with pytest.raises(TraceError):
            index_graph({"edges": []})

    def test_back_edges_are_returned_as_asset_pairs(self):
        assert back_edge_set(graph(["A", "B"], [], [(0, 1)])) == {("A", "B")}


class TestTerminations:
    def test_a_link_inside_the_extent_carries_its_destination(self):
        artefact = build(map_artefact("A", "B"), graph(["A", "B"], [("p1", 0, 1)]))
        assert artefact["links"]["A"] == [{"pipe": "p1", "to": "B"}]

    def test_a_pit_with_no_pipe_gets_no_links_and_is_counted(self):
        artefact = build(map_artefact("A"), graph(["A"], []))
        assert artefact["links"]["A"] == []
        assert artefact["counts"]["no-recorded-connection"] == 1

    def test_an_unrecorded_destination_is_not_a_pipe_that_leaves(self):
        artefact = build(map_artefact("A"), graph(["A"], [("p1", 0, None)]))
        assert artefact["links"]["A"] == [{"pipe": "p1", "ends": "unrecorded-destination"}]

    def test_a_destination_outside_the_extent_is_not_an_unrecorded_one(self):
        # The whole reason the module exists. Both look like "no pit here" in
        # the map artefact; only the council graph separates them.
        artefact = build(map_artefact("A"), graph(["A", "B"], [("p1", 0, 1)]))
        assert artefact["links"]["A"] == [{"pipe": "p1", "ends": "leaves-mapped-area"}]

    def test_the_two_are_distinguished_in_the_same_build(self):
        artefact = build(
            map_artefact("A"),
            graph(["A", "B"], [("gone", 0, None), ("outside", 0, 1)]),
        )
        assert artefact["links"]["A"] == [
            {"pipe": "gone", "ends": "unrecorded-destination"},
            {"pipe": "outside", "ends": "leaves-mapped-area"},
        ]
        assert artefact["counts"]["unrecorded-destination"] == 1
        assert artefact["counts"]["leaves-mapped-area"] == 1

    def test_a_back_edge_terminates_rather_than_being_followed(self):
        artefact = build(
            map_artefact("A", "B"),
            graph(["A", "B"], [("p1", 0, 1)], back_edges=[(0, 1)]),
        )
        assert artefact["links"]["A"] == [{"pipe": "p1", "ends": "cycle-guard"}]

    def test_a_cycle_guard_beats_being_inside_the_extent(self):
        # Both pits are present, so without the guard this would be a normal
        # link and a traversal following it would not terminate.
        artefact = build(
            map_artefact("A", "B"),
            graph(["A", "B"], [("p1", 0, 1), ("p2", 1, 0)], back_edges=[(1, 0)]),
        )
        assert artefact["links"]["B"] == [{"pipe": "p2", "ends": "cycle-guard"}]

    def test_every_termination_has_wording(self):
        artefact = build(map_artefact("A"), graph(["A"], []))
        assert set(artefact["terminations"]) == set(TERMINATIONS)
        for reason in TERMINATIONS:
            assert artefact["terminations"][reason].strip()

    def test_no_termination_claims_an_outlet(self):
        # The extent contains no recorded outfall, endwall or discharge point,
        # so a path that stops has reached the end of the record. Wording that
        # said otherwise would be a claim the data cannot support.
        artefact = build(map_artefact("A"), graph(["A"], []))
        assert not any("outlet" in reason for reason in TERMINATIONS)
        blob = json.dumps(artefact["terminations"]).lower()
        assert "outlet" not in blob
        assert "outfall" not in blob


class TestBranching:
    def test_a_pit_with_several_downstream_pipes_keeps_all_of_them(self):
        # Fan-out is the normal case, not an anomaly, and collapsing it to one
        # path would hide half the drainage from the person following it.
        artefact = build(
            map_artefact("A", "B", "C"),
            graph(["A", "B", "C"], [("p1", 0, 1), ("p2", 0, 2)]),
        )
        assert artefact["links"]["A"] == [
            {"pipe": "p1", "to": "B"},
            {"pipe": "p2", "to": "C"},
        ]

    def test_branches_may_terminate_differently_from_each_other(self):
        artefact = build(
            map_artefact("A", "B"),
            graph(["A", "B", "X"], [("kept", 0, 1), ("gone", 0, None), ("out", 0, 2)]),
        )
        assert [link.get("to") or link["ends"] for link in artefact["links"]["A"]] == [
            "B",
            "unrecorded-destination",
            "leaves-mapped-area",
        ]


class TestArtefact:
    def test_every_extent_pit_appears_even_with_no_links(self):
        # A pit missing from `links` is indistinguishable from one the browser
        # failed to load, and the panel would have nothing to say about it.
        artefact = build(map_artefact("A", "B", "C"), graph(["A"], []))
        assert set(artefact["links"]) == {"A", "B", "C"}

    def test_the_artefact_declares_a_source_provided_basis(self):
        artefact = build(map_artefact("A"), graph(["A"], []))
        assert artefact["basis"] == "sourceProvided"
        assert artefact["source"]["data_version_id"] == "test-version"

    def test_an_extent_with_no_pits_is_refused(self):
        with pytest.raises(TraceError):
            build(map_artefact(), graph([], []))

    def test_a_map_without_a_pit_layer_is_refused(self):
        with pytest.raises(TraceError):
            build({"layers": {"road": []}}, graph([], []))

    def test_counts_account_for_every_link_and_dead_end(self):
        artefact = build(
            map_artefact("A", "B"),
            graph(["A", "B", "X"], [("p1", 0, 1), ("p2", 0, None), ("p3", 0, 2)]),
        )
        counts = artefact["counts"]
        emitted = sum(len(links) for links in artefact["links"].values())
        dead_ends = counts["no-recorded-connection"]
        assert emitted + dead_ends == sum(counts.values())


class TestCli:
    def test_it_writes_an_artefact_and_reports_the_counts(self, tmp_path, capsys):
        map_path = tmp_path / "map.json"
        graph_path = tmp_path / "graph.json"
        out = tmp_path / "trace.json"
        map_path.write_text(json.dumps(map_artefact("A", "B")), encoding="utf-8")
        graph_path.write_text(json.dumps(graph(["A", "B"], [("p1", 0, 1)])), encoding="utf-8")

        assert main(["--map", str(map_path), "--graph", str(graph_path), "--out", str(out)]) == 0
        written = json.loads(out.read_text(encoding="utf-8"))
        assert written["links"]["A"] == [{"pipe": "p1", "to": "B"}]
        assert "links within the extent" in capsys.readouterr().out

    def test_a_missing_input_fails_rather_than_writing_an_empty_artefact(self, tmp_path, capsys):
        assert main(["--map", str(tmp_path / "absent.json"), "--out", str(tmp_path / "o.json")]) == 1
        assert "missing input" in capsys.readouterr().err


class TestAgainstTheRealExtent:
    """The counts the interface's wording depends on, measured not assumed."""

    def test_the_kensington_extent_reconciles(self, tmp_path):
        from pathlib import Path

        root = Path(__file__).resolve().parents[2] / "data"
        map_path = root / "map" / "map.json"
        graph_path = root / "graph" / "drainage-graph.json"
        if not (map_path.exists() and graph_path.exists()):
            pytest.skip("artefacts are git-ignored and rebuilt locally")

        artefact = build(
            json.loads(map_path.read_text(encoding="utf-8")),
            json.loads(graph_path.read_text(encoding="utf-8")),
        )
        counts = artefact["counts"]

        assert len(artefact["links"]) == 895
        # The two that must never be merged, and the reason for the module.
        assert counts["leaves-mapped-area"] == 7
        assert counts["unrecorded-destination"] == 29
        # The cycle guard is exercised by the demonstration data itself.
        assert counts["cycle-guard"] >= 1
