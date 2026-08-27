# pipeline

The offline geospatial pipeline. Runs once, on a developer machine, and publishes versioned static artefacts. **Never deployed** — nothing in here executes in production.

## Setup

```
cd pipeline
py -m venv .venv                      # python3 -m venv .venv on macOS/Linux
./.venv/Scripts/python.exe -m pip install -e . -r requirements-dev.txt
./.venv/Scripts/python.exe -m pytest
```

## Build the drainage graph artefact

```
./.venv/Scripts/python.exe -m drainlens_pipeline.cli \
  --pipes  path/to/pipes.json \
  --pits   path/to/pits.json \
  --out    ../data/graph/drainage-graph.json \
  --data-version com-drainage@2023-02-26
```

Source exports come from the City of Melbourne Open Data Portal (`drainpipes`, `stormwater-pits`, both CC BY, last modified 26 February 2023).

**Artefacts are not committed.** They are build products, they are large, and rebuilding them during a sprint would add several megabytes to the history each time. `/data` is ignored. Once the demonstration extent is agreed, the clipped extent for that area is small enough to commit and will be, so the frontend does not need a Python toolchain to have something to render.

## What the graph builder does, and what it refuses to do

Topology only. Geometry lives in the pit and pipe tile artefacts, which the renderer consumes separately.

Three properties of the source data shape the output, and each is **recorded in the artefact rather than silently repaired**:

**Self-loops are excluded.** 87 pipes name the same pit at both ends.

**A pipe whose downstream pit is absent from the pit dataset is kept, not dropped.** It becomes an edge with `d: null`. The pipe is real, a trace can reach it, and where it leads is unknown — so the path ends there with that reason. Dropping it would make the network look as though the pipe were not there at all, which is the opposite of what AC 1.2.d asks for. A pipe whose *upstream* pit is absent is a different case: no trace can ever reach it, so it is not an edge, and it is counted separately.

**Cycles are detected here and counted.** 18 back-edges across 34 nodes. This is what makes the runtime cycle guard a requirement rather than a defensive habit.

The narrowing indicator compares a pipe's nominal size with the pipes immediately upstream. It is a **geometric step-down, not a capacity claim** — invert data is 95.4% missing and no capacity model is built anywhere in this project.

## A finding worth carrying forward

The Epic 1 data audit recorded **13,753 traceable pipes (79.8%)**. That figure counts a pipe as traceable when both endpoint identifiers are *recorded*. This build additionally requires each identifier to *resolve* against the pit dataset, and **1,622 pipes (9.4%) name a pit that is not in the export**.

| Measure | Pipes | Share |
|---|---|---|
| Endpoint identifier missing | 3,317 | 19.2% |
| Self-loop | 87 | 0.5% |
| Upstream pit not in the dataset — unreachable | 955 | 5.5% |
| **Reachable edges** (upstream known) | **12,798** | **74.2%** |
| — of those, downstream pit not in the dataset | 667 | 3.9% |
| **Fully resolved** (both ends known) | **12,131** | **70.4%** |

For traversal an unresolvable identifier is exactly as useless as a missing one, so **70.4% is the honest figure** and the architecture's 79.8% is optimistic by nine percentage points. The narrowing count of 459 matches the audit exactly, which is a useful cross-check that the rest of the model agrees.

The CLI compares its output against the audit figures on every run and reports drift rather than failing: the rules live in this repository and may legitimately move, but drift should never pass unnoticed.

## Fetch the demonstration tiles

```
./.venv/Scripts/python.exe -m drainlens_pipeline.fetch_tiles --out ../data/pointcloud
```

No arguments needed: it defaults to the Iteration 1 demonstration extent. The point cloud is published as one 4.33 GB zip, but S3 serves HTTP range requests and a zip keeps its directory at the end, so the four tiles the extent needs come back in **81.5 MB** — 98.1% of the archive never leaves the server.

That is not a micro-optimisation. It is the difference between a teammate rebuilding the terrain artefacts in a few minutes and having to schedule a download, which on a six-day iteration decides whether anyone reruns the build at all.

`--extent MIN_E MIN_N MAX_E MAX_N` takes any MGA55 bounds; `--force` re-fetches what is already on disk.

## The demonstration extent

Kensington, 1 km², MGA Zone 55 **316,500–317,500 E · 5,814,500–5,815,500 N** — `Tile_+007_+015`, `Tile_+008_+015`, `Tile_+007_+016`, `Tile_+008_+016`. Opening address **46 Gatehouse Drive**.

Chosen by measurement, not by eye. The reasoning is in `docs/DEMO-EXTENT.md`; the extent itself is stated as data in `geo.py` so the three workstreams that need to know "which tiles?" cannot each derive a different answer.

The projection in `geo.py` is worth trusting: it agrees with the eastings and northings the City of Melbourne publishes alongside latitude and longitude, across all 63,721 address records, to within a millimetre.

## Build the ground surface

```
./.venv/Scripts/python.exe -m drainlens_pipeline.terrain --out ../data/terrain
```

6.6 million points to a 1000 × 1000 m grid in about nine seconds. Writes the surface, a mask saying which cells were measured, and a manifest recording how it was made.

**This is not a LiDAR DTM, and must never be called one.** D2 established the source is photogrammetric — imagery matched between overlapping photographs. A laser finds the ground through gaps in a canopy; a camera does not. Under dense trees there are no ground points to keep, only an absence, and the surface there is interpolated from the nearest measured ground. Streets are open to the sky and are measured directly, which is the part the model routes water over. `terrain.json` carries that sentence and a test fails if it goes missing.

### Why a filter of our own

PDAL ships an SMRF and will not install on the machines this is being built on. The algorithm is published, it is about eighty lines against numpy and scipy, and one written here can be tested against surfaces whose answer is known and explained at the showcase. `tests/test_ground.py` checks the case that actually matters — not "a building is removed", which is obvious in any rendering, but "a building is removed *and the street grade underneath survives*", which is the failure that produces a plausible-looking surface where every slope is wrong.

### Two numbers that were measured rather than chosen

**Window 26 m.** Widening it removes steadily more: 12→18 m a further 5.8 ha, 18→26 m a further 2.2 ha, then a near-constant ~1 ha per step, which is terrain being shaved rather than buildings found. Of the 2.2 ha that 26 m removes and 18 m does not, 54% stands over two metres up. The other 46% is ground rejected needlessly — worth it, because a rejected ground cell is interpolated from a neighbour a metre away and lands within centimetres, while a surviving roof is a three- to eight-metre plateau sitting in the middle of the flow routing.

**54.1% of the extent measured.** The rest is buildings, canopy and gaps. Only 1.1% of cells had no point at all; the remaining 44.8% were filtered out, and those cells stood a median 3.5 m and a 90th percentile 8.6 m above the ground kept around them — the height of a house, a terrace roof, a street tree.

### Two limits worth knowing before you trust it

**A roof wider than the window keeps its middle.** Opening leaves a straight edge alone and only rounds convex corners, so an idealised 60 m flat-topped warehouse loses four corners and nothing else. Real roofs are gabled and cluttered at 1 m and give the filter plenty to bite on, which is why 44.8% of the extent came out; but an extent full of large sheds would need the window raised, and would pay for it in shaved landforms.

**The uphill edge is shaved.** Opening returns a plane exactly — that is what stops the filter flattening streets — but only on an unbounded one. Within `max_window_m / 2` of the uphill boundary the structuring element cannot fit, so a band there is lowered. At Kensington's gradients this stays far below the threshold and nothing is flagged. The fix, if an extent ever needs it, is to filter a buffer and crop.

## Still to come

Depressions characterised on the raw surface, then conditioning on a *separate* surface with building footprints as barriers, then the D8 flow-direction grid. The order is a correctness requirement: filling removes exactly the storage volumes the scenario model needs.
