"""Build the directed drainage graph artefact.

Topology only. Geometry belongs to the pit and pipe tile artefacts, which the
renderer consumes; this artefact is what the traversal service walks, and it is
kept lean because it is loaded in full rather than by viewport.

Three properties of the source data drive the shape of this module, and each is
recorded in the artefact rather than silently repaired:

* some pipes name the same pit at both ends (self-loops), and are excluded;
* some pipes reference a pit that is not in the pit dataset, so the path cannot
  be continued through them — they are kept and flagged, never dropped;
* the graph contains cycles, so any traversal needs a guard. The back-edges are
  detected here and counted in the artefact, which is what makes the runtime
  guard a requirement rather than a defensive habit.
"""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping, Sequence

from .classification import InletClass, classify_object_type

ARTEFACT_VERSION = "1"


@dataclass(frozen=True)
class Node:
    asset_number: str
    object_type: str | None
    inlet_class: InletClass
    lat: float | None
    lon: float | None


@dataclass(frozen=True)
class Edge:
    pipe_ref: str
    upstream: str
    #: ``None`` where the source records a downstream pit that is absent from the
    #: pit dataset. The pipe is real and traversable; where it leads is not
    #: known, and a trace reaching it terminates with that reason rather than
    #: appearing to have no onward connection at all.
    downstream: str | None
    nominal_size_mm: int | None
    operator: str | None
    #: True where this pipe is narrower than a pipe immediately upstream of it.
    #: A geometric step-down, not a capacity claim — see the note in build().
    narrowing: bool


@dataclass
class BuildStats:
    pipes_in: int = 0
    pits_in: int = 0
    self_loops_excluded: int = 0
    #: Source records no identifier at one or both ends.
    endpoints_unrecorded: int = 0
    #: Upstream identifier names a pit absent from the pit dataset, so no trace
    #: can ever reach this pipe.
    upstream_unresolved: int = 0
    #: Traversable edges — upstream pit is known.
    edges_total: int = 0
    #: Of those, edges whose downstream pit is not in the dataset.
    edges_to_unknown_pit: int = 0
    #: Of those, edges with both ends resolved.
    edges_fully_resolved: int = 0
    narrowing_edges: int = 0
    back_edges: int = 0
    nodes_in_cycles: int = 0
    inlet_class_counts: dict[str, int] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "pipesIn": self.pipes_in,
            "pitsIn": self.pits_in,
            "selfLoopsExcluded": self.self_loops_excluded,
            "endpointsUnrecorded": self.endpoints_unrecorded,
            "upstreamUnresolved": self.upstream_unresolved,
            "edgesTotal": self.edges_total,
            "edgesToUnknownPit": self.edges_to_unknown_pit,
            "edgesFullyResolved": self.edges_fully_resolved,
            "narrowingEdges": self.narrowing_edges,
            "backEdges": self.back_edges,
            "nodesInCycles": self.nodes_in_cycles,
            "inletClassCounts": dict(sorted(self.inlet_class_counts.items())),
        }


@dataclass
class DrainageGraph:
    nodes: dict[str, Node]
    edges: list[Edge]
    #: Node asset number -> indices into ``edges`` leaving that node.
    downstream: dict[str, list[int]]
    #: Pipe refs whose upstream or downstream pit is absent from the pit dataset.
    unresolved_endpoints: list[str]
    back_edges: list[tuple[str, str]]
    stats: BuildStats


def _as_id(value: Any) -> str | None:
    """Source identifiers arrive as ints or strings; normalise to a string key."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _nominal_size(pipe: Mapping[str, Any]) -> int | None:
    """Comparable size across pipe forms.

    Circular pipes carry a diameter. Box culverts carry width and height, for
    which the smaller dimension is the one that constrains a step-down, so it is
    used. Where neither is present the size is unknown and stays unknown.
    """
    diameter = pipe.get("diameter")
    if isinstance(diameter, (int, float)) and diameter > 0:
        return int(diameter)
    width, height = pipe.get("width_mm"), pipe.get("height_mm")
    if (
        isinstance(width, (int, float))
        and isinstance(height, (int, float))
        and width > 0
        and height > 0
    ):
        return int(min(width, height))
    return None


def _find_back_edges(
    nodes: Iterable[str], downstream: Mapping[str, Sequence[int]], edges: Sequence[Edge]
) -> list[tuple[str, str]]:
    """Iterative depth-first search recording every edge that closes a cycle.

    Iterative rather than recursive on purpose: the deepest chains in this
    network are well within Python's recursion limit today, but the limit is not
    a property of the data and a future release should not be able to break the
    build by being deeper.
    """
    WHITE, GREY, BLACK = 0, 1, 2
    colour: dict[str, int] = {n: WHITE for n in nodes}
    back: list[tuple[str, str]] = []

    for root in list(colour):
        if colour[root] != WHITE:
            continue
        stack: list[tuple[str, int]] = [(root, 0)]
        colour[root] = GREY
        while stack:
            node, cursor = stack[-1]
            outgoing = downstream.get(node, ())
            if cursor < len(outgoing):
                stack[-1] = (node, cursor + 1)
                # An edge with no destination cannot close a cycle. Its
                # upstream node is always known, so the lookup below cannot
                # miss; indexing rather than .get() keeps that loud.
                nxt = edges[outgoing[cursor]].downstream
                if nxt is None:
                    continue
                state = colour[nxt]
                if state == GREY:
                    back.append((node, nxt))
                elif state == WHITE:
                    colour[nxt] = GREY
                    stack.append((nxt, 0))
            else:
                colour[node] = BLACK
                stack.pop()
    return back


def build(pipes: Sequence[Mapping[str, Any]], pits: Sequence[Mapping[str, Any]]) -> DrainageGraph:
    """Build the graph from raw source records."""
    stats = BuildStats(pipes_in=len(pipes), pits_in=len(pits))

    nodes: dict[str, Node] = {}
    for pit in pits:
        asset = _as_id(pit.get("asset_number"))
        if asset is None:
            continue
        object_type = pit.get("object_type_lupvalue")
        lat, lon = pit.get("lat"), pit.get("lon")
        nodes[asset] = Node(
            asset_number=asset,
            object_type=object_type,
            inlet_class=classify_object_type(object_type),
            lat=float(lat) if isinstance(lat, (int, float)) else None,
            lon=float(lon) if isinstance(lon, (int, float)) else None,
        )

    counts: dict[str, int] = {}
    for node in nodes.values():
        counts[node.inlet_class] = counts.get(node.inlet_class, 0) + 1
    stats.inlet_class_counts = counts

    raw: list[tuple[str, str, str | None, int | None, str | None]] = []
    unresolved: list[str] = []
    for pipe in pipes:
        ref = _as_id(pipe.get("ref"))
        up = _as_id(pipe.get("upstr_pit"))
        down = _as_id(pipe.get("dnstr_pit"))
        if ref is None:
            continue
        if up is None or down is None:
            unresolved.append(ref)
            stats.endpoints_unrecorded += 1
            continue
        if up == down:
            stats.self_loops_excluded += 1
            continue
        if up not in nodes:
            # Nothing can ever trace into this pipe, so it cannot be an edge.
            unresolved.append(ref)
            stats.upstream_unresolved += 1
            continue
        # A downstream pit that is absent from the dataset is kept as an edge
        # with no destination. The path reaches it and stops there, which is
        # what AC 1.2.d asks for: show the gap, do not complete it.
        resolved_down = down if down in nodes else None
        if resolved_down is None:
            unresolved.append(ref)
        raw.append((ref, up, resolved_down, _nominal_size(pipe), pipe.get("operator")))

    # Narrowing is decided against the pipes immediately upstream, so the
    # incoming sizes must be known before any edge is finalised.
    incoming_sizes: dict[str, list[int]] = {}
    for _ref, _up, down, size, _op in raw:
        if size is not None and down is not None:
            incoming_sizes.setdefault(down, []).append(size)

    edges: list[Edge] = []
    downstream: dict[str, list[int]] = {}
    for ref, up, down, size, operator in raw:
        upstream_sizes = incoming_sizes.get(up, ())
        narrowing = size is not None and any(s > size for s in upstream_sizes)
        downstream.setdefault(up, []).append(len(edges))
        edges.append(
            Edge(
                pipe_ref=ref,
                upstream=up,
                downstream=down,
                nominal_size_mm=size,
                operator=operator if isinstance(operator, str) and operator.strip() else None,
                narrowing=narrowing,
            )
        )

    stats.edges_total = len(edges)
    stats.edges_to_unknown_pit = sum(1 for e in edges if e.downstream is None)
    stats.edges_fully_resolved = stats.edges_total - stats.edges_to_unknown_pit
    stats.narrowing_edges = sum(1 for e in edges if e.narrowing)

    back_edges = _find_back_edges(nodes.keys(), downstream, edges)
    stats.back_edges = len(back_edges)
    stats.nodes_in_cycles = len({n for pair in back_edges for n in pair})

    return DrainageGraph(
        nodes=nodes,
        edges=edges,
        downstream=downstream,
        unresolved_endpoints=unresolved,
        back_edges=back_edges,
        stats=stats,
    )


def to_artefact(graph: DrainageGraph, data_version_id: str, generated_at: str | None = None) -> dict[str, Any]:
    """Serialise to the compact form the traversal service loads.

    Nodes are addressed by index so the adjacency lists stay small; the asset
    number is kept alongside because it is what the renderer and every
    submission join on.
    """
    order = sorted(graph.nodes)
    index = {asset: i for i, asset in enumerate(order)}
    generated = generated_at or _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")

    return {
        "artefactVersion": ARTEFACT_VERSION,
        "dataVersionId": data_version_id,
        "generatedAt": generated,
        "nodes": [
            {
                "assetNumber": graph.nodes[a].asset_number,
                "objectType": graph.nodes[a].object_type,
                "inletClass": graph.nodes[a].inlet_class,
                "lat": graph.nodes[a].lat,
                "lon": graph.nodes[a].lon,
            }
            for a in order
        ],
        "edges": [
            {
                "pipeRef": e.pipe_ref,
                "u": index[e.upstream],
                "d": index[e.downstream] if e.downstream is not None else None,
                "sizeMm": e.nominal_size_mm,
                "operator": e.operator,
                "narrowing": e.narrowing,
            }
            for e in graph.edges
        ],
        "downstream": [graph.downstream.get(a, []) for a in order],
        "unresolvedEndpoints": graph.unresolved_endpoints,
        "backEdges": [[index[u], index[d]] for u, d in graph.back_edges],
        "stats": graph.stats.as_dict(),
    }
