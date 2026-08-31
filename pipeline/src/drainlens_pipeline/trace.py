"""The downstream topology for the extent, and an honest reason at every end.

The browser could almost build this itself: `map.json` already carries every
pipe with an ``upstr_pit`` and a ``dnstr_pit``, so a trace inside the extent is
a dictionary lookup away. It cannot build one thing, and that one thing is the
reason this module exists.

**A pipe whose downstream pit is not among the extent's pits has two entirely
different explanations**, and the map artefact cannot tell them apart:

* the council recorded where the pipe goes, and it goes somewhere we clipped
  off — the path continues, we simply are not drawing it; or
* the council never recorded where the pipe goes — the path stops, because the
  record stops.

In the Kensington extent that is 7 edges of the first kind and 29 of the
second. Presenting all 36 as "the pipe goes nowhere" would state something
false about the source data, which is what AC 1.2.2.d exists to prevent. Only
the council-wide graph knows which is which, so the distinction is resolved
here, once, and travels as a reason.

**There are no recorded outlets.** All 215 extent pits with no downstream pipe
are junctions, kerbside inlets or unrecorded types; not one is an outfall, an
endwall or a discharge point. So this module never emits an outlet, and the
interface must never claim the path reached one. 83 of those 215 are *inlets* —
a kerbside grate is not where a drainage system ends, it is where the record
does. AC 1.2.2.c offers "the recorded outlet or the last known connection"; in
this data it is always the second.

The artefact is scoped to the extent because that is the only place a path can
be drawn. Following the full council graph would need the 4 MB export for a
square kilometre holding 895 pits, and would trace water into streets the
person cannot see.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

ARTEFACT = "drainage-trace"
VERSION = 1

#: Why a downstream path stops. No outlet: see the module docstring.
TERMINATIONS = (
    "no-recorded-connection",
    "unrecorded-destination",
    "leaves-mapped-area",
    "cycle-guard",
)


class TraceError(Exception):
    """The inputs cannot produce a trustworthy trace artefact."""


@dataclass(frozen=True)
class Link:
    """One recorded pipe leaving a pit.

    ``to`` is the downstream pit when it is inside the extent, and ``None``
    otherwise — in which case ``reason`` says which kind of nothing it is.
    """

    pipe_ref: str
    to: str | None
    reason: str | None

    def as_dict(self) -> dict[str, Any]:
        entry: dict[str, Any] = {"pipe": self.pipe_ref}
        if self.to is not None:
            entry["to"] = self.to
        else:
            entry["ends"] = self.reason
        return entry


def _asset(value: Any) -> str:
    """Asset numbers arrive as ints from one source and strings from another."""
    return str(value)


def index_graph(graph: Mapping[str, Any]) -> dict[str, list[tuple[str, str | None]]]:
    """Council-wide downstream edges, keyed by upstream asset number.

    The value is a list of ``(pipe_ref, downstream_asset_or_None)``. A ``None``
    destination is the council's own gap — the export carries the pipe but not
    the pit it reaches — and it is the distinction the whole module turns on,
    so it is preserved rather than dropped.
    """
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise TraceError("the graph artefact carries no nodes and edges")

    assets = [_asset(node["assetNumber"]) for node in nodes]
    out: dict[str, list[tuple[str, str | None]]] = {}
    for edge in edges:
        upstream = assets[edge["u"]]
        downstream = assets[edge["d"]] if edge.get("d") is not None else None
        out.setdefault(upstream, []).append((_asset(edge["pipeRef"]), downstream))
    return out


def back_edge_set(graph: Mapping[str, Any]) -> set[tuple[str, str]]:
    """Edges the graph builder identified as closing a cycle.

    18 of them across 34 nodes in the council data. A trace that followed one
    would not terminate, so they are carried through and refused at traversal
    time rather than silently deleted here — a deleted back edge is a path that
    quietly ends one step early with no explanation.
    """
    nodes = graph.get("nodes", [])
    assets = [_asset(node["assetNumber"]) for node in nodes]
    return {(assets[u], assets[d]) for u, d in graph.get("backEdges", [])}


def build(
    map_artefact: Mapping[str, Any],
    graph: Mapping[str, Any],
) -> dict[str, Any]:
    """The extent's downstream topology, with a reason at every termination."""
    layers = map_artefact.get("layers")
    if not isinstance(layers, dict) or "pit" not in layers:
        raise TraceError("the map artefact carries no pit layer")

    pits: Sequence[Mapping[str, Any]] = layers["pit"]
    inside = {_asset(pit["asset_number"]) for pit in pits}
    if not inside:
        raise TraceError("the extent holds no pits, so no path can be followed")

    downstream = index_graph(graph)
    back_edges = back_edge_set(graph)

    links: dict[str, list[dict[str, Any]]] = {}
    counts = dict.fromkeys(TERMINATIONS, 0)
    counts["within-extent"] = 0

    for asset in sorted(inside):
        recorded = downstream.get(asset, [])
        if not recorded:
            # No pipe at all. Not an outlet — see the module docstring.
            links[asset] = []
            counts["no-recorded-connection"] += 1
            continue

        entries: list[Link] = []
        for pipe_ref, destination in recorded:
            if destination is None:
                entries.append(Link(pipe_ref, None, "unrecorded-destination"))
                counts["unrecorded-destination"] += 1
            elif (asset, destination) in back_edges:
                entries.append(Link(pipe_ref, None, "cycle-guard"))
                counts["cycle-guard"] += 1
            elif destination not in inside:
                entries.append(Link(pipe_ref, None, "leaves-mapped-area"))
                counts["leaves-mapped-area"] += 1
            else:
                entries.append(Link(pipe_ref, destination, None))
                counts["within-extent"] += 1
        links[asset] = [link.as_dict() for link in entries]

    return {
        "artefact": ARTEFACT,
        "version": VERSION,
        "basis": "sourceProvided",
        "note": (
            "Recorded downstream connections for the pits inside the extent. "
            "Every path end carries a reason. No outlet is ever claimed: the "
            "extent contains no recorded outfall, endwall or discharge point, "
            "so a path that stops has reached the end of the record, not the "
            "end of the drainage system."
        ),
        "source": {
            "dataset_id": "drainpipes + stormwater-pits",
            "publisher": "City of Melbourne Open Data Portal",
            "data_version_id": graph.get("dataVersionId"),
            "graph_artefact_version": graph.get("artefactVersion"),
        },
        "terminations": {
            "no-recorded-connection": (
                "This pit has no downstream pipe in the council's record. That is "
                "where the record ends, not where the water does."
            ),
            "unrecorded-destination": (
                "A pipe leaves this pit, but the council's record does not say "
                "which pit it reaches."
            ),
            "leaves-mapped-area": (
                "The pipe continues to a recorded pit outside the mapped area."
            ),
            "cycle-guard": (
                "The recorded connections loop back on themselves here, so the "
                "path cannot be followed further."
            ),
        },
        "counts": counts,
        "links": links,
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys
    from pathlib import Path

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.trace",
        description="Build the extent's downstream trace artefact.",
    )
    parser.add_argument("--map", type=Path, default=Path("../data/map/map.json"))
    parser.add_argument("--graph", type=Path, default=Path("../data/graph/drainage-graph.json"))
    parser.add_argument("--out", type=Path, default=Path("../data/map/trace.json"))
    args = parser.parse_args(argv)

    for path in (args.map, args.graph):
        if not path.exists():
            print(f"missing input: {path}", file=sys.stderr)
            return 1

    artefact = build(
        json.loads(args.map.read_text(encoding="utf-8")),
        json.loads(args.graph.read_text(encoding="utf-8")),
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")

    counts = artefact["counts"]
    print(f"wrote {args.out}  ({args.out.stat().st_size / 1024:.1f} KB)")
    print(f"  pits                    {len(artefact['links']):>5}")
    print(f"  links within the extent {counts['within-extent']:>5}")
    for reason in TERMINATIONS:
        print(f"  {reason:<23} {counts[reason]:>5}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
