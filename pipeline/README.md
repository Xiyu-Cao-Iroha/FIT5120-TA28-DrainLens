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

**Full-size artefacts are not committed.** They are build products, they are large, and rebuilding them during a sprint would add several megabytes to the history each time. `/data` is ignored — it holds the 4.33 GB point cloud tiles and the council-wide graph. The **clipped copies for the demonstration extent are committed**, under `apps/web/public/data/`, so the frontend runs from a clone with no Python toolchain: 318 KB of map geometry, 183 KB of derived layers, 37 KB of trace topology, and 1.28 MB of scene arrays.

## What the graph builder does, and what it refuses to do

Topology only. Geometry lives in the pit and pipe tile artefacts, which the renderer consumes separately.

Three properties of the source data shape the output, and each is **recorded in the artefact rather than silently repaired**:

**Self-loops are excluded.** 87 pipes name the same pit at both ends.

**A pipe whose downstream pit is absent from the pit dataset is kept, not dropped.** It becomes an edge with `d: null`. The pipe is real, a trace can reach it, and where it leads is unknown — so the path ends there with that reason. Dropping it would make the network look as though the pipe were not there at all, which is the opposite of what AC 1.2.2.d asks for. A pipe whose *upstream* pit is absent is a different case: no trace can ever reach it, so it is not an edge, and it is counted separately.

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

**52.1% of the extent measured.** The rest is buildings, canopy and gaps. Only 1.1% of cells had no point at all; everything else was filtered out, and those cells stood a median 3.5 m and a 90th percentile 8.6 m above the ground kept around them — the height of a house, a terrace roof, a street tree.

The filter on its own leaves 54.1%. The building footprints then take another 2% away, because they identify roofs the filter had kept as ground — see the cross-check below. **52.1% is the figure that ships**, and it is the one `terrain.json` reports; anything quoting 54.1% is describing the filter in isolation rather than the artefact.

### Two limits worth knowing before you trust it

**A roof wider than the window keeps its middle.** Opening leaves a straight edge alone and only rounds convex corners, so an idealised 60 m flat-topped warehouse loses four corners and nothing else. Real roofs are gabled and cluttered at 1 m and give the filter plenty to bite on, which is why 44.8% of the extent came out; but an extent full of large sheds would need the window raised, and would pay for it in shaved landforms.

**The uphill edge is shaved.** Opening returns a plane exactly — that is what stops the filter flattening streets — but only on an unbounded one. Within `max_window_m / 2` of the uphill boundary the structuring element cannot fit, so a band there is lowered. At Kensington's gradients this stays far below the threshold and nothing is flagged. The fix, if an extent ever needs it, is to filter a buffer and crop.

## Depressions and flow routing

Both come out of the same `terrain` command, and the order they come out in is a correctness requirement rather than a preference.

**Depressions are measured on the raw surface. Flow directions come from a separate conditioned one.** Filling a surface removes precisely the storage this model needs — characterise the hollows first, or they are gone and the engine can never report ponding. A build with the two swapped succeeds, renders, and is silently useless. `hydrology.py` says so at the top for whoever edits it next.

### The 0.25 m floor, and why most hollows are not hollows

Filling the demonstration extent finds **8,472 separate hollows whose median maximum depth is 5 cm**. The source is quoted at about 25 cm accuracy, so the great majority of those are the surface's own noise rather than places water collects.

Cutting at the accuracy the publisher quotes keeps **6.3% of the count holding 88.8% of the filled volume**. Throwing away 93.7% of the objects costs 11.2% of the water. Two independent arguments land on the same number, which is the reason to trust it: the knee in the volume curve, and the error bar on the measurement that found them.

On the surface as published — filtered *and* corrected from the building footprints — that leaves **486 hollows holding 31,364 m³**. Slightly fewer than the 537 the filter alone finds, and slightly more water: removing the false rooftop plateaus both deletes the small artificial hollows they created and unblocks real ones they were damming.

The discarded water is not lost. It routes downstream instead of ponding, and it is discarded identically in the blocked and all-clear runs, so it largely cancels in the comparison the product actually reports.

The four largest hollows sit at **0.4–2.3 m AHD** — the lowest ground in the extent, the Kensington Banks flats. The biggest storage landing in the known flood-prone corner is the sanity check that matters most.

### The one number that could break everything silently

The D8 code table is a contract between this pipeline and `packages/scenario/src/flow.ts`. If the two ever disagree about what a `1` means, water routes sideways and **nothing objects**: the build succeeds, the tests pass, the map renders, and every answer is wrong.

So `tests/test_d8_contract.py` does not restate the table. It parses the TypeScript declaration and compares it — the only version of the check that can fail when somebody edits one side. Tampering with a single offset trips four of its assertions at once.

### Two invariants held over the whole field, not sampled

- **Zero interior dead ends.** Every cell away from the boundary has somewhere for water to go.
- **All 998,594 directed cells point strictly downhill**, the smallest step being the conditioning epsilon. That is what makes a cycle impossible: following directions strictly decreases elevation, so every path terminates at the window edge.

## Building footprints, and the cross-check they made possible

Fetched from the City of Melbourne `2020-building-footprints` dataset (CC BY, same 26 February 2023 vintage as the drainage data), clipped to the extent with 100 m of padding — a building straddling the boundary still dams water inside it.

They do **two** jobs, and the second was not planned.

**Barriers.** Water runs between buildings, not through them. 258,754 cells, 25.9% of the extent.

**Repair.** They also fix the ground filter's one known blind spot. An opening cannot reach the middle of a roof wider than its window, so some rooftops survive the filter as "measured ground" — fake plateaus sitting in the flow routing. The footprints identify 20,311 such cells, 2% of the extent, and the build corrects them.

### Two independent sources agreeing

Of the cells the footprint dataset calls a building, the ground filter had **independently removed 92.2%** — a 2020 vector dataset and a morphological filter over a 2018 photogrammetric cloud, arriving at the same answer with nothing in common but the ground itself.

The reverse only holds at **51.9%**, and that asymmetry is the whole argument against the shortcut: **about half of what the filter removes is not a building.** It is tree canopy, and water flows under trees. Using the object mask as a barrier set would wall off every tree-lined street in Kensington, which is most of them.

### The predicted limit, measured

The synthetic test says a roof wider than the window keeps its middle. The real data says exactly how much:

| Distance inside a footprint | Cells | Filter missed |
|---|---:|---:|
| more than 5 m | 37,025 | 18.9% |
| more than 10 m | 12,093 | 41.2% |
| more than 13 m | 8,643 | 44.7% |

A 26 m window's structuring element reaches 13 m inside a roof. The breakpoint lands where the arithmetic says it should, which is the most convincing form a limitation can take: predicted from theory, pinned by a synthetic test, then confirmed on real ground at the predicted threshold.

### Overhangs are not dams

The dataset models a building as tiers, each with its own base elevation. A tier starting several metres up shades the footpath; it does not dam it. Footprints whose base sits more than 0.5 m above their structure's base are excluded — 683 of 4,552 rings, worth 3.5% of the barrier area. The half-metre absorbs the dataset's own rounding, which comes in half-metre steps.

## Map geometry for the browser

```
./.venv/Scripts/python.exe -m drainlens_pipeline.network --out ../data/map/map.json
```

The graph artefact carries topology — which pit feeds which — because that is what a trace needs. This is the other half: where the things are. 220 road polygons, 893 pipes, 895 pits and 163 street labels for the demonstration extent, fetched in about three seconds and written as **318 KB**.

**Coordinates are local metres, not latitude and longitude** — east and north of the extent's south-west corner, to a decimetre. The extent is a north-up square of one-metre cells, so a coordinate becomes a pixel by multiplying by the zoom, and no projection runs in the browser at all. That removes a second place for the map and the model to disagree about where something is, and turns fifteen-digit numbers into four.

**No basemap service.** The streets come from the City's own road-corridor polygons, baked into the artefact. Nothing at runtime depends on a third-party tile server being up, licensed, or free.

The portal is not consistent about how to ask for a bounding box: most datasets carry a `geo_point_2d` that `in_bbox` understands, while the stormwater pits carry bare `lat` and `lon` columns and reject `in_bbox` with a 400. That difference lives in the `Dataset` records so the next layer added does not rediscover it.

The fetch reaches 150 m past the extent, because a pipe with one end outside still runs through it. A vertex survives the clip when it is near the extent **or next to one that is** — dropping the far end of a crossing segment leaves a one-vertex path, and a pipe entering the extent would disappear from the map rather than be drawn to the edge. Fixing that recovered four pipes and five street labels.

## The downstream trace artefact

```
./.venv/Scripts/python.exe -m drainlens_pipeline.trace --out ../apps/web/public/data/trace.json
```

Reads the map artefact and the council-wide graph, and writes 37 KB: for each of the extent's 895 pits, the pipes leaving it, and for every pipe that cannot be followed, **why**.

### Why this is not done in the browser

`map.json` already carries every pipe with an `upstr_pit` and a `dnstr_pit`, so a trace inside the extent is a dictionary lookup away. It cannot do one thing, and that one thing is the reason this stage exists.

A pipe whose downstream pit is not among the extent's pits has **two entirely different explanations**, and the map artefact cannot tell them apart:

- the council recorded where the pipe goes, and it goes somewhere we clipped off — the path continues, we are simply not drawing it; or
- the council never recorded where the pipe goes — the path stops, because the record stops.

Here that is **7 edges of the first kind and 29 of the second**. Presenting all 36 as "the pipe goes nowhere" would state something false about the source data, which is what AC 1.2.2.d exists to prevent. Only the council-wide graph knows which is which, so the distinction is resolved here, once, and travels as a reason.

### There are no recorded outlets

All **215** extent pits with no downstream pipe are junctions, kerbside inlets or unrecorded types. Not one is an outfall, an endwall or a discharge point:

| Object type | Pits |
|---|---:|
| Junction | 64 |
| Grated OFK | 49 |
| Lane Type | 30 |
| Grated Side Entry | 21 |
| unrecorded | 15 |
| everything else | 36 |

**83 of the 215 are inlets.** A kerbside grate is not where a drainage system ends; it is where the record does. So this module never emits an outlet, and the interface must never claim the path reached one. AC 1.2.2.c offers "the recorded outlet or the last known connection"; in this data it is always the second, and a test asserts the word does not appear in the artefact's wording.

### The counts the interface depends on

| | |
|---|---:|
| Pits in the extent | 895 |
| Links that stay inside it | 697 |
| Pits with no downstream pipe | 215 |
| Pipes whose destination was never recorded | 29 |
| Pipes continuing past the mapped area | 7 |
| Back edges falling inside the extent | 1 |

That last row matters: the cycle guard is exercised by the demonstration data itself rather than only by a fixture.

## The City's own overland flow routes, and what they do and do not settle

`water-flow-routes-over-land-urban-forest` publishes 173 flow lines across the extent. It is tempting to treat these as ground truth for our surface-water paths. They are not, and the reasons are worth writing down.

They are **derived, not observed** — the dataset's own `source` field says "2008 DEM to stream order using ESRI Spatial Analyst". So the comparison is one derivation against another, from data ten years apart, at different resolutions, for a different purpose (the dataset is scoped to urban forest watering).

Comparing our per-cell D8 directions to their line bearings gives agreement *worse* than random. That test is meaningless: at one metre, a cell's direction is set by kerbs, driveways and the conditioning ramp inside a filled basin, not by a regional channel. Comparing flow **accumulation** is the right question, and it gives:

| Our channels | Median distance from an official vertex | Within 25 m | Random baseline |
|---|---:|---:|---:|
| top 0.5% of accumulation | 24.0 m | 51.3% | 30.3% |
| top 1% | 10.0 m | 75.7% | 53.5% |

So there is real agreement — our channels sit closer to their routes than chance — but a 1.7× lift and a 24 m median offset is "the same street, a different centreline", not a match. **This is weaker evidence than the 92.2% footprint cross-check and should not be quoted alongside it.** The interface must label surface-water paths `System-derived` and must not imply the City has endorsed them.

## Built since this file was first written

Map geometry (`network`), the terrain-derived layers (`derived`), the browser scene pack (`scene`), the downstream trace (`trace`), and an address index (`addresses`) with a fixture standing in for it.

**The address index is the real one as of 31 August** — 4,089 addresses across 132 streets.

It reads **`street-addresses`** (63,721 records — confirmed against the portal's own metadata on 1 September, along with its title), not `property-boundaries`. That distinction cost a build: the parcel dataset has no split street fields and does not contain either demonstration address, because a parcel is not an address — Gatehouse Drive has a 10, a 15 and a 17, and no 46. The index it produced had 1,619 entirely plausible entries and was missing the two addresses the demonstration is built on.

## Still to come

The assumption register and a single data manifest across all artefacts. The coverage mask ships inside the scene pack; it is the assumption register that has no home yet, and the capture fraction is the first thing that belongs in it.
