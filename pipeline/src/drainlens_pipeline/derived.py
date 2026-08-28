"""The terrain-derived map layers, as geometry the browser can draw.

Three layers come out of here, and none of them is a recorded fact. Surface
water paths, low points and the coverage boundary are all calculated from a
filtered photogrammetric surface — `System-derived`, in the interface's own
vocabulary — and they have to look different from the pits and pipes, which
are published records used as provided.

Everything is emitted in the same frame as `network.py`: metres east and north
of the extent's south-west corner, to a decimetre. Rasters do not travel. A
1000 x 1000 grid is four megabytes as float32 and the browser has no use for
per-cell elevation; what it needs is where the water goes, where it collects,
and where we have nothing to say.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import ndimage

from .geo import Extent
from .hydrology import D8_OFFSETS, LEAVES_WINDOW

#: Share of cells treated as channel, by flow accumulation.
#:
#: Measured against the City's own overland flow routes rather than picked. At
#: the top half-percent our channels sit a median 24 m from theirs — about a
#: street width — against 30% of random cells within the same distance. Going
#: wider raises the coincidence but only by drawing most of the street network,
#: which stops being a statement about where water concentrates.
CHANNEL_PERCENTILE = 99.5

#: Cell size of the coverage summary, in metres.
#:
#: The measured mask is 52.1% true and pixel-fragmented — every roof and street
#: tree is a hole in it — so contouring it directly yields thousands of shapes
#: that say nothing a reader can use. At 25 m the question becomes the one the
#: interface actually asks: is there enough ground here to say anything?
COVERAGE_BLOCK_M = 25.0

#: Below this measured share, a coverage block is reported as unavailable.
#:
#: A deliberately stated tolerance, not a hidden one. A block that is one third
#: ground is a block whose slope is mostly interpolation between rooftops.
COVERAGE_MIN_MEASURED = 0.35


class DerivedError(Exception):
    pass


@dataclass(frozen=True)
class DerivedLayers:
    channels: list[list[list[float]]]
    depressions: list[dict]
    unavailable: list[list[list[float]]]


def flow_accumulation(direction: np.ndarray, elevation: np.ndarray) -> np.ndarray:
    """How many cells drain through each cell.

    Cells are processed highest first, so a cell's own total is complete before
    it is passed on. That ordering is what makes one pass enough; doing it in
    any other order needs iteration to converge.
    """
    if direction.shape != elevation.shape:
        raise DerivedError(
            f"the flow field is {direction.shape} but the surface is {elevation.shape}"
        )
    rows, cols = direction.shape
    accumulated = np.ones(rows * cols)
    codes = direction.ravel()

    for flat in np.argsort(-elevation.ravel(), kind="stable"):
        code = int(codes[flat])
        if code == LEAVES_WINDOW:
            continue
        dc, dr = D8_OFFSETS[code]
        row, col = divmod(int(flat), cols)
        accumulated[(row + dr) * cols + (col + dc)] += accumulated[flat]

    return accumulated.reshape(rows, cols)


def trace_channels(
    direction: np.ndarray,
    accumulated: np.ndarray,
    *,
    percentile: float = CHANNEL_PERCENTILE,
    min_length: int = 8,
) -> list[list[tuple[int, int]]]:
    """Follow the channels downstream, from each head to where they merge.

    A path stops when it reaches a cell another path has already claimed, so a
    tributary is drawn once rather than repeated along every trunk below it.
    Without that the same downstream kilometre is redrawn for every headwater
    above it, and the map goes solid.
    """
    rows, cols = direction.shape
    channel = accumulated >= np.percentile(accumulated, percentile)

    # A head is a channel cell with nothing upstream of it that is also channel.
    upstream_count = np.zeros((rows, cols), dtype=np.int32)
    for code, (dc, dr) in enumerate(D8_OFFSETS):
        source = channel & (direction == code)
        rr, cc = np.nonzero(source)
        inside = (rr + dr >= 0) & (rr + dr < rows) & (cc + dc >= 0) & (cc + dc < cols)
        np.add.at(upstream_count, (rr[inside] + dr, cc[inside] + dc), 1)

    claimed = np.zeros((rows, cols), dtype=bool)
    paths: list[list[tuple[int, int]]] = []

    heads = np.argwhere(channel & (upstream_count == 0))
    # Longest first, so trunks are claimed by the path that runs furthest.
    order = sorted(heads.tolist(), key=lambda rc: -accumulated[rc[0], rc[1]])

    for row, col in order:
        path: list[tuple[int, int]] = []
        r, c = int(row), int(col)
        while True:
            path.append((r, c))
            claimed[r, c] = True
            code = int(direction[r, c])
            if code == LEAVES_WINDOW:
                break
            dc, dr = D8_OFFSETS[code]
            r, c = r + dr, c + dc
            if not (0 <= r < rows and 0 <= c < cols) or not channel[r, c]:
                break
            if claimed[r, c]:
                path.append((r, c))  # meet the trunk rather than stopping short of it
                break
        if len(path) >= min_length:
            paths.append(path)

    return paths


def simplify(path: list[tuple[float, float]], tolerance_m: float) -> list[tuple[float, float]]:
    """Douglas-Peucker, so a shape is a line rather than a list of pixels.

    A traced channel has a vertex per metre and an outline traced along the
    cell lattice is a staircase. Both are a hundred times more detail than the
    shape needs at any zoom this map supports, and all of it is payload.

    Iterative rather than recursive: an outline of a large depression runs to
    thousands of vertices, and the worst case for this algorithm is a recursion
    as deep as the path is long.

    Closed rings work unchanged. When the first and last point coincide the
    perpendicular distance degenerates, and the fallback measures from the
    start instead, which splits the ring at its furthest point.
    """
    if len(path) < 3:
        return list(path)

    keep = [False] * len(path)
    keep[0] = keep[-1] = True
    stack = [(0, len(path) - 1)]

    while stack:
        first, last = stack.pop()
        if last <= first + 1:
            continue

        start, end = path[first], path[last]
        dx, dy = end[0] - start[0], end[1] - start[1]
        span = float(np.hypot(dx, dy))

        furthest, worst = first, 0.0
        for index in range(first + 1, last):
            point = path[index]
            if span == 0:
                offset = float(np.hypot(point[0] - start[0], point[1] - start[1]))
            else:
                offset = (
                    abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0])
                    / span
                )
            if offset > worst:
                furthest, worst = index, offset

        if worst > tolerance_m:
            keep[furthest] = True
            stack.append((first, furthest))
            stack.append((furthest, last))

    return [point for point, kept in zip(path, keep) if kept]


#: Smallest hollow drawn on the map, in square metres.
#:
#: **A display threshold, not a model one.** The scenario engine uses all 486
#: depressions whatever this is set to; the question here is only which of them
#: can be seen. The median hollow is 32 m², and at the zoom this map opens at —
#: a kilometre across a laptop window, roughly 0.7 pixels per metre — anything
#: under a five-metre square is a few pixels and cannot be told from a
#: rendering artefact.
#:
#: Cutting at 25 m² draws 273 of the 486, holding 98.6% of the stored volume.
#: The 213 left out hold 1.4% between them.
MIN_DRAWN_DEPRESSION_M2 = 25.0

#: Vertex tolerance when simplifying, in metres.
#:
#: Set by what can be seen rather than by the cell size, which was the first
#: attempt and the wrong instinct. A boundary traced along a one-metre lattice
#: is a staircase whose every corner sits half a metre off the chord, so a
#: quarter-metre tolerance preserves all of them and removes almost nothing.
#:
#: One metre is under a pixel at the zoom this map opens at, and one pixel at
#: its native resolution. What it buys is the staircase collapsing into the
#: diagonals it was approximating.
SIMPLIFY_TOLERANCE_M = 1.0


def ring_area_m2(ring: list[tuple[float, float]]) -> float:
    """Enclosed area by the shoelace formula, unsigned."""
    total = 0.0
    for index in range(len(ring) - 1):
        x1, y1 = ring[index]
        x2, y2 = ring[index + 1]
        total += x1 * y2 - x2 * y1
    return abs(total) / 2.0


def outlines(
    mask: np.ndarray,
    extent: Extent,
    cell_size_m: float,
    *,
    tolerance_m: float = SIMPLIFY_TOLERANCE_M,
    min_area_m2: float = 0.0,
) -> list[list[list[float]]]:
    """Trace the boundary of every region in a mask, as closed rings.

    Square-tracing along cell edges rather than through cell centres, so the
    ring follows the actual boundary of the area and closes on itself. A
    centre-based trace cuts every corner and leaves a shape smaller than the
    thing it describes.
    """
    rings: list[list[list[float]]] = []
    labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=bool))
    rows = mask.shape[0]

    for index in range(1, count + 1):
        region = labels == index
        # Edges between a cell inside the region and one outside it. Each is a
        # unit segment on the grid lattice; chaining them gives the boundary.
        segments: dict[tuple[float, float], list[tuple[float, float]]] = {}

        def add(a: tuple[float, float], b: tuple[float, float]) -> None:
            segments.setdefault(a, []).append(b)

        for r, c in np.argwhere(region):
            r, c = int(r), int(c)
            # Grid corners of this cell, in local metres, north-up.
            left = extent.min_e + c * cell_size_m
            right = left + cell_size_m
            top = extent.min_n + (rows - r) * cell_size_m
            bottom = top - cell_size_m
            if r == 0 or not region[r - 1, c]:
                add((left, top), (right, top))
            if r == rows - 1 or not region[r + 1, c]:
                add((right, bottom), (left, bottom))
            if c == 0 or not region[r, c - 1]:
                add((left, bottom), (left, top))
            if c == mask.shape[1] - 1 or not region[r, c + 1]:
                add((right, top), (right, bottom))

        while segments:
            start = next(iter(segments))
            ring: list[tuple[float, float]] = [start]
            point = start
            while True:
                following = segments.get(point)
                if not following:
                    break
                nxt = following.pop()
                if not following:
                    del segments[point]
                ring.append(nxt)
                point = nxt
                if point == start:
                    break
            if len(ring) < 4 or ring_area_m2(ring) < min_area_m2:
                # Applies to holes as much as to outlines. A bump inside a
                # hollow, smaller than the hollow has to be to be drawn at all,
                # is not a hole worth punching in it.
                continue
            trimmed = simplify(ring, tolerance_m) if tolerance_m > 0 else ring
            if len(trimmed) >= 4:
                rings.append(
                    [[round(x - extent.min_e, 1), round(y - extent.min_n, 1)] for x, y in trimmed]
                )

    return rings


def coverage_gaps(
    observed: np.ndarray,
    extent: Extent,
    cell_size_m: float,
    *,
    block_m: float = COVERAGE_BLOCK_M,
    min_measured: float = COVERAGE_MIN_MEASURED,
) -> list[list[list[float]]]:
    """Where there is too little measured ground to say anything.

    Summarised into blocks before being outlined. The per-cell mask is holed by
    every roof and street tree, and its outline would be thousands of shapes
    that answer no question a reader is asking.
    """
    step = int(round(block_m / cell_size_m))
    if step < 1:
        raise DerivedError("the coverage block is smaller than a cell")

    rows, cols = observed.shape
    usable_rows, usable_cols = rows // step * step, cols // step * step
    blocks = (
        observed[:usable_rows, :usable_cols]
        .reshape(usable_rows // step, step, usable_cols // step, step)
        .mean(axis=(1, 3))
    )
    return outlines(blocks < min_measured, extent, block_m)


def build(
    extent: Extent,
    cell_size_m: float,
    *,
    direction: np.ndarray,
    conditioned: np.ndarray,
    observed: np.ndarray,
    depression_labels: np.ndarray,
    depressions: list[dict],
    log=lambda _: None,
) -> dict:
    """The three derived layers, in the frame `network.py` uses."""
    accumulated = flow_accumulation(direction, conditioned)
    traced = trace_channels(direction, accumulated)
    channels = []
    for path in traced:
        metres = [
            ((col + 0.5) * cell_size_m, (direction.shape[0] - 1 - row + 0.5) * cell_size_m)
            for row, col in path
        ]
        line = simplify(metres, SIMPLIFY_TOLERANCE_M)
        if len(line) >= 2:
            channels.append([[round(x, 1), round(y, 1)] for x, y in line])
    log(f"  channels    {len(channels):>4} lines")

    drawn = {d["id"] for d in depressions if d["cellCount"] * cell_size_m**2 >= MIN_DRAWN_DEPRESSION_M2}
    hollows = outlines(
        np.isin(depression_labels, list(drawn)),
        extent,
        cell_size_m,
        min_area_m2=MIN_DRAWN_DEPRESSION_M2,
    )
    log(f"  low points  {len(hollows):>4} rings from {len(drawn)} of {len(depressions)} hollows")

    gaps = coverage_gaps(observed, extent, cell_size_m)
    log(f"  gaps        {len(gaps):>4} rings")

    return {
        "artefact": "derived-layers",
        "version": 1,
        "extent": {
            "name": extent.name,
            "width_m": extent.width_m,
            "height_m": extent.height_m,
        },
        "coordinates": (
            "Metres east and north of the extent's south-west corner, to a decimetre — "
            "the same frame as the map geometry."
        ),
        "basis": "derived",
        "note": (
            "Every layer here is calculated from a filtered photogrammetric surface, not "
            "recorded. Surface-water paths follow the steepest descent of that surface and "
            "are not a survey of where water has been seen to go; low points are hollows "
            "measured on it; the unavailable areas are where too little ground was observed "
            "to say anything. The interface must label all three System-derived."
        ),
        "layers": {
            "channel": [{"g": "line", "c": line} for line in channels],
            "low-point": [{"g": "polygon", "c": [ring]} for ring in hollows],
            "unavailable": [{"g": "polygon", "c": [ring]} for ring in gaps],
        },
        "settings": {
            "channel_percentile": CHANNEL_PERCENTILE,
            "min_drawn_depression_m2": MIN_DRAWN_DEPRESSION_M2,
            "coverage_block_m": COVERAGE_BLOCK_M,
            "coverage_min_measured": COVERAGE_MIN_MEASURED,
            "simplify_tolerance_m": SIMPLIFY_TOLERANCE_M,
            "display_only": (
                "The depression size threshold is a display filter. The scenario engine "
                "uses every hollow the pipeline found, whatever is drawn here."
            ),
        },
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import json
    import sys
    from pathlib import Path

    from .geo import DEMONSTRATION_EXTENT
    from .hydrology import condition

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.derived",
        description="Build the terrain-derived map layers from the terrain artefacts.",
    )
    parser.add_argument("--terrain", type=Path, default=Path("../data/terrain"))
    parser.add_argument("--out", type=Path, default=Path("../data/map/derived.json"))
    args = parser.parse_args(argv)

    def log(message: str) -> None:
        print(message, file=sys.stderr)

    extent = DEMONSTRATION_EXTENT
    surface = np.load(args.terrain / "ground-surface.npy").astype(np.float64)
    log(f"Deriving layers for {extent.name}")

    artefact = build(
        extent,
        1.0,
        direction=np.load(args.terrain / "flow-direction.npy"),
        conditioned=condition(surface),
        observed=np.load(args.terrain / "ground-observed.npy"),
        depression_labels=np.load(args.terrain / "depression-cells.npz")["labels"],
        depressions=json.loads((args.terrain / "depressions.json").read_text(encoding="utf-8")),
        log=log,
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")
    log(f"  written to {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
