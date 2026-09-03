# How the water is routed

DrainLens · TA28 · the algorithm chain, end to end

Everything this product says about water comes from one chain: a point cloud
becomes a ground surface, the surface becomes a flow field and a set of
hollows, and the browser routes rainfall over both. This document walks that
chain and names the file and function at each step, so a question about any
claim on screen has somewhere to land.

> **The last link in this chain is not currently on screen.** The surface, the
> flow field and the hollows are — they are what the map draws as terrain,
> water flow and low areas. The rainfall routing on top of them belongs to the
> drain-blockage comparison, which AC 1.1.1 requires to be absent from the
> Iteration 1 interface. The engine, its tests and this description are all
> intact and unchanged; what is missing is a way to reach it. See
> [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md).

**What it defers.** [pipeline/README.md](../pipeline/README.md) is the authority
on the ground filter — the SMRF window, the building-footprint cross-check, and
why the source is photogrammetric rather than LiDAR. This document starts where
a bare-earth surface already exists and follows the water.

---

## The chain in one line

```
point cloud → bare-earth surface → ┬→ conditioned surface → D8 flow field ─┐
                                   │                     └→ accumulation → channels (the blue lines)
                                   └→ depressions (capacity, spill, shape) ─┤
                                                                            ↓
                                                    solvePosition: rain → capture → route → fill → spill
                                                                            ↓
                                              two runs at the same rainfall, differenced
```

---

## Part 1 — Offline, in the pipeline

### Three surfaces, and why mixing them is the mistake this code guards against

| Purpose | Which surface | Why not another |
|---|---|---|
| Find hollows | the **raw** bare-earth surface | filling is what a hollow is measured *against*; a filled surface has none left to find |
| Route water | a **conditioned** surface | raw ground has pits and flats that trap water and stall the routing |
| Draw the blue lines | accumulation over the conditioned surface | it is a picture of the same routing, not a second opinion |

[`condition()`](../pipeline/src/drainlens_pipeline/hydrology.py) says this in its
own docstring: *"Never hand the result to `find_depressions`. That is the
mistake this module exists to make hard."* The two surfaces exist at the same
time, look almost identical, and answer opposite questions.

### Priority-flood fill — `hydrology.fill()`

Barnes, Lehman and Mulla (2014). Every boundary cell is pushed onto a
min-heap at its own elevation; cells are popped lowest-first, and each unvisited
neighbour is raised to at least the level it was reached from. **Water is raised
from the edges inward**, so a cell ends at the lowest level from which it can
still reach the edge.

`epsilon_m` (`CONDITIONING_EPSILON_M = 1e-5` m) nudges each step inland
fractionally higher. Without it a filled basin is **dead flat** and has no
direction to give the router. With it, every filled cell still drains towards
its outlet.

Complexity **O(n log n)** in the cell count, from the heap.

### Conditioning — `hydrology.condition()`

Building footprints are **raised by `BARRIER_RAISE_M = 100` m, not removed**.
The distinction is the whole point:

- **Raised**, nothing drains into a building, so it holds no water and passes
  none on — water runs *around* it, the way it does in a street.
- **Removed**, the building becomes a hole in the terrain and water takes a
  shortcut through the middle of a house.

The raised surface is then filled with the epsilon above.

### D8 flow direction — `hydrology.d8()`

Steepest descent among the eight neighbours, each drop divided by the distance
to it, so a diagonal step is divided by √2 and does not win simply for being
longer. The result is one code 0–7 per cell, or `LEAVES_WINDOW` where no
neighbour is lower — which on a conditioned surface means the cell is on the
boundary and the water leaves.

**Ties go to the lowest code**, and the browser engine breaks them the same way.
A tie broken differently in the two halves would route the same surface two
ways, and every result built on it would be unreproducible.

### Depressions — `hydrology.find_depressions()`

Run on the **raw** surface.

1. `depth = filled − raw`; anything above zero is inside a hollow.
2. Label the hollows **eight-connected**, matching the router's neighbour rule.
   Four-connectivity would cut a diagonal chain into separate basins that then
   appear to spill into each other.
3. Discard any hollow whose maximum depth is under
   `MIN_DEPRESSION_DEPTH_M = 0.25` m. The source is quoted at about 25 cm
   accuracy and the median untrimmed hollow is 5 cm, so most of them are the
   surface's own noise. On the demonstration extent this cuts **8,472 raw
   hollows to 486**.
4. For each survivor: `capacity = Σ depth × cell area`, and the **spill cell**
   is the lowest cell on the dilated rim.

A hollow touching the grid boundary is seeded by the flood at its own
elevation and never fills, so it is not a basin and is not found — which is
correct: it is a valley draining off the edge.

### Flow accumulation and the blue lines — `derived.flow_accumulation()`, `derived.trace_channels()`

Accumulation counts how many cells drain through each cell. Cells are processed
**highest first**, so a cell's own total is complete before it is passed on;
that ordering is what makes a single pass enough rather than iterating to
convergence.

Cells above the **99.5th percentile** of accumulation are called channel, traced
from each head downstream, and simplified with Douglas–Peucker at a 1 m
tolerance. These are the *Likely surface water paths* layer, labelled
**System-derived** on screen — they are not a council dataset and the interface
never implies they are.

---

## Part 2 — At runtime, in the browser

[`solvePosition()`](../packages/scenario/src/engine.ts) in
`packages/scenario`, run inside a Web Worker.

Every rainfall position is solved **independently from zero**, never stepped
forward from the previous one. That is what lets the rainfall control be a
lookup rather than a re-run, and it is why the engine checks monotonicity
across positions rather than assuming it.

### 1. Rain

Uniform over the window: `rainfallMm / 1000 × cellArea` cubic metres on every
cell. No intensity, no duration — the input is an *accumulated* amount, and the
interface says so wherever it appears.

### 2. Order the cells — `upstreamFirst()`

**Kahn's topological sort on the flow field**, not a sort by elevation. Cells
with nothing upstream come first, in index order, so the whole solve is
reproducible. Sorting by elevation is the obvious proxy and it is wrong — see
*Failure 1* below.

Complexity **O(n)**.

### 3. Route

Walking that order, for each cell:

1. If a drain sits here, it takes `captureFraction × blockageMultiplier` of the
   water — `0.6` by default, times `1` clear, `0.5` partly blocked, `0` fully
   blocked.
2. If the cell is inside a depression, the remainder goes to that depression's
   account and stops.
3. Otherwise the remainder is passed to the downstream cell.
4. If there is no downstream cell, it has left the window.

### 4. Depressions fill, then spill — **repeatedly**

Each depression takes what fits in `capacity − already held`; the overflow is
routed onward from its spill cell. The passes repeat **until nothing moves**,
bounded by one pass per depression plus one. A single pass is not enough — see
*Failure 2*.

Anything still unresolved at the bound would be a cycle in the spill graph. It
is added to *left the window* rather than dropped: the balance must account for
every drop, and an honest overflow beats a silent loss.

### 5. Spread the held water by level — `fillToLevel()`

Water finds a level. Given how far each cell sits below its rim (`rimDepthM`,
shipped by the pipeline), there is exactly one water surface at which the volume
held equals the volume asked for. Sort the depths, walk down them — at each step
the wetted area grows by one cell, so the volume between consecutive depths is
exact rather than iterated towards — then raise the surface evenly over
whatever is already wet with what is left.

Cells above that surface stay **dry**. Without this the only honest distribution
is an even one, and even is wrong in a way that hides the product's subject —
see *Failure 3*.

Complexity **O(k log k)** per depression, k being its cell count.

### 6. Account for every drop

Each solve returns a balance: `rainfall = captured + ponded + left the window`.
`checkMassBalance()` runs over it inside `runScenario` and refuses the
comparison if it does not hold. It is not a diagnostic — it is the gate that
caught all three failures below.

### 7. Difference, not depth

`runScenario` solves the whole thing **twice** at each rainfall: once with the
chosen blockage, once with every drain clear. The output is the set of cells
where the blocked run holds more than the baseline by more than
`noticeableVolumeM3 = 0.05` m³. Absolute depth is never reported — AD7, and the
result screen says so in its own words.

---

## The three failures that shaped this, measured

All three were caught by the mass-balance check, not by looking at the map. Each
figure below was **re-measured on 2 September** by reverting that one fix in a
built copy of the engine and running the published Kensington artefact.

| | 20 mm | 40 mm | 60 mm |
|---|---:|---:|---:|
| **The engine as it ships** | 0.00% | 0.00% | 0.00% |
| Failure 1 — cells ordered by elevation | 61.50% | 61.50% | 61.50% |
| Failure 2 — depressions filled in one pass | 13.00% | 19.47% | 25.46% |

*(Percentage of rainfall the run could not account for.)*

### Failure 1 — sorting by elevation instead of topologically

Sorting cells by elevation is a proxy for "solve everything upstream first", and
it holds only while the surface strictly decreases along every flow path. The
conditioned surface tries to guarantee that with a nudge of 1e-5 m per step,
and **no finite representation of that surface can keep it**: at single
precision on the real artefact, **509 of a million cells** ended up exactly
level with the cell they drain into. At each one the order is arbitrary, and
water passed downstream lands on a cell that has already been solved and is
never read again.

The flow field is a forest of paths to the boundary, so Kahn's algorithm on it
is exact by construction and needs no tolerance at all.

### Failure 2 — filling depressions in a single pass

A single pass ordered by rim height assumes spill chains always run downhill in
*rim* terms. Real terrain does not oblige: a deep pit in low ground can have a
higher rim than the shallow hollow feeding it. Water landing in a store that
has already been resolved was stranded — counted as neither ponded nor passed
on.

Note the shape of the measurement: this leak **grows with rainfall** (13% →
25%), because more water means more spilling and more chances to land in a
resolved store. Failure 1's is flat, because it is structural.

### Failure 3 — spreading a depression's water evenly

Not a mass-balance failure — the water was all accounted for. It was a
*reporting* failure, and worse for it. The 4.7 m³ a blocked drain releases into
an 18,856-cell hollow becomes a quarter of a millilitre per cell. Every
comparison returned **no clear change**, and the product's entire subject
disappeared into an average while the arithmetic stayed correct.

> **A number in the code comments does not reproduce.** Both fixes are
> annotated in `engine.ts` as having leaked "27% of the rainfall". Neither
> figure came back at 27% when reverted independently against today's artefact:
> Failure 1 gives 61.50%, Failure 2 gives 13–25% depending on rainfall. The
> reversions above are reconstructions of the original bugs rather than the
> original code, so this is not proof the comments were wrong — but the two
> matching figures should not be quoted as independent measurements until
> somebody can reproduce them.

---

## Cost

| | |
|---|---|
| Grid | 1000 × 1000 cells at 1 m |
| One `solvePosition` | O(n log n), dominated by the depression fills |
| One comparison | **two** solves per rainfall position, and three positions by default |
| Measured | about **998 ms** per comparison, against **41 ms** to load every artefact |

That ratio is the reason hosting is not this product's performance story: one
comparison costs roughly twenty-five times the entire page load, and no CDN or
cache header changes it. If a comparison needs to be faster the change is in
`packages/scenario`. See [DEPLOYMENT-BASELINE.md](./DEPLOYMENT-BASELINE.md).

---

## What these algorithms deliberately do not do

Each of these is a decision recorded elsewhere, not a gap:

- **No capacity model.** Pipe invert levels are missing for 95.4% of the
  council's record and internally inconsistent in what survives, so nothing
  here computes whether a pipe can carry a flow. **AD6.**
- **No absolute depth on screen.** The engine computes ponded volume per cell
  and the interface reports only where two runs *differ*. **AD7.**
- **No timing.** Rainfall is an accumulated total. Nothing models when water
  arrives, and the result screen states that.
- **No claim of real-world accuracy.** The checks here establish internal
  consistency — mass balance, monotonicity, reproducibility — against
  controlled cases. That is not validation against observed flooding, and no
  claim of that kind is made anywhere in this project.
