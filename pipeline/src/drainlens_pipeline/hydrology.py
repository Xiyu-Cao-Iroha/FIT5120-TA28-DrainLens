"""Depressions, conditioning and flow routing.

Two surfaces come out of this module and they are **not** interchangeable.

`find_depressions` works on the raw ground surface, because filling a surface
removes precisely the storage volumes the scenario engine needs — characterise
them first or they are gone.

`condition` produces a *separate* surface for routing: filled so that water has
somewhere to go from every cell, with building footprints raised into barriers
so water runs between buildings rather than through them.

Reversing that order gives a model that runs, looks plausible, and cannot
compute ponding at all. It is the single easiest way to get this wrong.
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass

import numpy as np
from scipy import ndimage

#: Offsets for the eight D8 codes, in order: E, SE, S, SW, W, NW, N, NE, as
#: (column step, row step) with rows increasing southward.
#:
#: **This table is a contract with the scenario engine**, which carries the same
#: one in `packages/scenario/src/flow.ts`. If the two ever disagree, water
#: routes sideways and nothing objects: every test passes, every map renders,
#: and every answer is wrong. `tests/test_d8_contract.py` compares this table
#: against the TypeScript source rather than trusting that both were edited.
D8_OFFSETS: tuple[tuple[int, int], ...] = (
    (1, 0),
    (1, 1),
    (0, 1),
    (-1, 1),
    (-1, 0),
    (-1, -1),
    (0, -1),
    (1, -1),
)

#: Water leaves the calculation window from this cell.
LEAVES_WINDOW = -1

#: Raise for a barrier cell, in metres. Large enough that nothing drains into a
#: building at any real gradient, small enough to stay far from float limits.
BARRIER_RAISE_M = 100.0

#: Downhill nudge applied per cell while conditioning, so a filled basin is a
#: gentle ramp towards its outlet rather than a flat where D8 is undefined.
#:
#: This is the alternative to a separate flat-resolution pass, and it is not
#: free: across a thousand-cell basin it accumulates to a centimetre. That is
#: an order of magnitude below the smallest ponding this model reports, and it
#: exists only on the routing surface — the depression volumes are measured on
#: the raw surface, where no nudge is applied.
CONDITIONING_EPSILON_M = 1e-5

#: Shallowest hollow reported as storage, in metres.
#:
#: The City of Melbourne cloud is quoted at about 25 cm accuracy, and a fill of
#: the demonstration extent finds 8,472 separate hollows whose median maximum
#: depth is 5 cm. Those are the surface's own noise, not places water collects.
#:
#: Cutting at the source's stated accuracy keeps 537 hollows — 6.3% of the
#: count — holding 88.8% of the filled volume. Discarding 93.7% of the objects
#: costs 11.2% of the volume, and what it buys is that every remaining hollow
#: is deeper than the error bar on the measurement that found it.
#:
#: The two arguments agree, which is the reason to trust the number: the knee
#: in the volume curve and the accuracy the publisher quotes land in the same
#: place. The discarded water is not lost — it routes downstream instead of
#: ponding — and it is discarded identically in the blocked and all-clear runs,
#: so it largely cancels in the comparison the product actually reports.
MIN_DEPRESSION_DEPTH_M = 0.25


class HydrologyError(Exception):
    pass


@dataclass(frozen=True)
class Depression:
    """A hollow measured on the raw surface, before any filling."""

    id: int
    cells: np.ndarray
    """Flat indices into the grid."""

    capacity_m3: float
    spill_elevation_m: float
    spill_cell: int
    """Flat index of the cell it overflows into, or `LEAVES_WINDOW`."""

    def as_json(self) -> dict:
        return {
            "id": self.id,
            "cells": [int(c) for c in self.cells],
            "capacityM3": round(self.capacity_m3, 3),
            "spillElevationM": round(self.spill_elevation_m, 3),
            "spillCell": int(self.spill_cell),
        }


def fill(elevation: np.ndarray, *, epsilon_m: float = 0.0) -> np.ndarray:
    """Priority-flood fill (Barnes, Lehman and Mulla, 2014).

    Water is raised from the edges inward: every cell ends at the lowest level
    from which it can still reach the edge. With `epsilon_m` above zero each
    step inland is nudged fractionally higher, which leaves basins draining
    towards their outlet instead of dead flat.
    """
    if elevation.ndim != 2:
        raise HydrologyError("elevation must be a 2-D grid")
    rows, cols = elevation.shape
    if rows < 3 or cols < 3:
        raise HydrologyError("the grid is too small to have an interior")

    filled = np.array(elevation, dtype=np.float64)
    closed = np.zeros((rows, cols), dtype=bool)

    queue: list[tuple[float, int, int]] = []
    for r in range(rows):
        for c in (0, cols - 1):
            heapq.heappush(queue, (float(filled[r, c]), r, c))
            closed[r, c] = True
    for c in range(1, cols - 1):
        for r in (0, rows - 1):
            heapq.heappush(queue, (float(filled[r, c]), r, c))
            closed[r, c] = True

    push = heapq.heappush
    pop = heapq.heappop
    while queue:
        level, r, c = pop(queue)
        for dc, dr in D8_OFFSETS:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and not closed[nr, nc]:
                closed[nr, nc] = True
                raised = max(float(filled[nr, nc]), level + epsilon_m)
                filled[nr, nc] = raised
                push(queue, (raised, nr, nc))

    return filled


def find_depressions(
    elevation: np.ndarray,
    cell_size_m: float,
    *,
    min_depth_m: float = MIN_DEPRESSION_DEPTH_M,
) -> list[Depression]:
    """Hollows in the **raw** surface, with what each one holds.

    Pass the ground surface, not a conditioned one. Filling is what this
    measures against; measuring a filled surface would find nothing.
    """
    if cell_size_m <= 0:
        raise HydrologyError("cell size must be positive")

    filled = fill(elevation)
    depth = filled - elevation
    hollow = depth > 1e-9

    # Eight-connected, so a hollow is one hollow under the same neighbour rule
    # the flow routing uses. Four-connectivity would split diagonal chains into
    # separate basins that spill into each other.
    labels, count = ndimage.label(hollow, structure=np.ones((3, 3), dtype=bool))
    if count == 0:
        return []

    cell_area = cell_size_m * cell_size_m
    neighbourhood = np.ones((3, 3), dtype=bool)

    found: list[Depression] = []
    for index in range(1, count + 1):
        mask = labels == index
        if depth[mask].max() < min_depth_m:
            continue

        cells = np.flatnonzero(mask.ravel())
        capacity = float(depth[mask].sum() * cell_area)
        spill_elevation = float(filled[mask].max())

        # Always a real cell, never `LEAVES_WINDOW`. A hollow that touches the
        # grid boundary is seeded at its own elevation by the flood and so does
        # not fill at all — it is a valley draining off the edge, not a basin —
        # which means no depression reaching the border is ever found here. The
        # engine still accepts `LEAVES_WINDOW` for a spill; this producer has
        # no way to emit one. Water that spills onto a boundary cell leaves
        # through that cell's own flow direction instead.
        rim = ndimage.binary_dilation(mask, structure=neighbourhood) & ~mask
        rim_cells = np.flatnonzero(rim.ravel())
        spill_cell = int(rim_cells[np.argmin(filled.ravel()[rim_cells])])

        found.append(
            Depression(
                id=len(found),
                cells=cells,
                capacity_m3=capacity,
                spill_elevation_m=spill_elevation,
                spill_cell=spill_cell,
            )
        )
    return found


def condition(elevation: np.ndarray, barriers: np.ndarray | None = None) -> np.ndarray:
    """A **separate** surface for routing: filled, with buildings as barriers.

    Barriers are raised rather than removed. Water then runs around a building
    the way it does in the street, instead of finding a shortcut through the
    middle of it. Nothing drains into a raised cell, so buildings hold no water
    and pass none on.

    Never hand the result to `find_depressions`. That is the mistake this
    module exists to make hard.
    """
    surface = np.array(elevation, dtype=np.float64)
    if barriers is not None:
        if barriers.shape != elevation.shape:
            raise HydrologyError(
                f"the barrier mask is {barriers.shape} but the surface is {elevation.shape}"
            )
        surface[barriers] += BARRIER_RAISE_M
    return fill(surface, epsilon_m=CONDITIONING_EPSILON_M)


def d8(conditioned: np.ndarray) -> np.ndarray:
    """Steepest-descent flow direction per cell, as D8 codes 0-7.

    `LEAVES_WINDOW` where no neighbour is lower, which on a conditioned surface
    means the cell is on the edge and the water leaves the calculation window.

    Ties go to the lowest code, matching the engine, so the same surface always
    routes the same way. A run that routed differently each time would make
    every result built on it unreproducible.
    """
    rows, cols = conditioned.shape
    best_slope = np.zeros((rows, cols), dtype=np.float64)
    direction = np.full((rows, cols), LEAVES_WINDOW, dtype=np.int8)

    for code, (dc, dr) in enumerate(D8_OFFSETS):
        # Out-of-bounds neighbours are padded high, so a cell never gains a
        # downhill step by pointing off the grid.
        neighbour = np.full((rows, cols), np.inf)
        src_r = slice(max(dr, 0), rows + min(dr, 0))
        src_c = slice(max(dc, 0), cols + min(dc, 0))
        dst_r = slice(max(-dr, 0), rows + min(-dr, 0))
        dst_c = slice(max(-dc, 0), cols + min(-dc, 0))
        neighbour[dst_r, dst_c] = conditioned[src_r, src_c]

        distance = np.hypot(dc, dr)
        slope = (conditioned - neighbour) / distance
        better = slope > best_slope
        best_slope[better] = slope[better]
        direction[better] = code

    return direction
