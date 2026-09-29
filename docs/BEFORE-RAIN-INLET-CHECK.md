# Which street drains are worth checking before heavy rain?

A design note for Epic 5, step 3. DrainLens · TA28 · **30 September 2026**.

**No production code was changed for this note.** Everything below was measured against the published artefacts on `develop` at `ea1598f`.

---

## The answer first

**The data cannot rank street drain inlets by "worth a visual check", and we should not ship a score that pretends otherwise.** Two candidate scores were designed and measured over all 9,239 supported inlets and all 62,397 addresses. Both fail in the same way, and the failure is not a tuning problem:

> Upstream catchment area accumulates **along** a street. Seven inlets in a row on one trunk each report nearly the whole street's water, because it is the same water passing each of them. At 46 Gatehouse Drive the largest and fourth-largest catchments within 200 m differ by **1%**.

A score can separate a large-catchment inlet from a small one — the largest near an address is typically **47 times** the median near it. It cannot separate the first from the fourth, which is precisely the cut a recommendation has to make. Every rule tested that produced a small set did so with a cap (*take three*) or an arbitrary radius knob, not with a finding.

**Recommendation: keep the approved behaviour — show the recorded inlets within 200 m without selecting, numbering or ranking them — and solve the real problem, which is that "show all" means a median of 50 markers.** A layout proposal is in [§8](#8-what-to-do-instead). The proposed AC wording in [§7](#7-proposed-acceptance-criteria-wording) covers both outcomes, so the team can take the other branch with its eyes open.

---

## 1 · What the repository already computes

| Quantity | Where | Notes |
|---|---|---|
| Bare-earth grid, 1 m cells | `pipeline/src/drainlens_pipeline/terrain.py` | Elevation in centimetres, from the point cloud |
| Priority-flood fill, hollows | `hydrology.py` · `fill()` (137), `find_depressions()` (214) | Hollow = filled minus raw surface; capacity, spill elevation, spill cell per hollow |
| Conditioned surface | `hydrology.py` · `condition()` (296) | Buildings as barriers |
| D8 flow direction | `hydrology.py` · `d8()` (321) | Steepest of eight neighbours |
| **Flow accumulation** | `derived.py` · `flow_accumulation()` (81) | Topological pass; one unit per cell |
| **Channels** | `derived.py` · `trace_channels()` (107), `CHANNEL_PERCENTILE = 99.5` (33) | Published as 990 polylines in `derived.json` |
| Low points, coverage gaps | `derived.py` · `outlines()` (255), `coverage_gaps()` (338) | 14,926 low points, 824 unavailable areas |
| Pooling-warning markers | `low_area_warnings.py` | 91 council-wide; ≥ 1 m below spill, ≥ 100 m² hollow, 150 m spacing, street corridors only |
| Scene tiles per window | `scene_tiles.py`, `apps/web/src/scenario/sceneTiles.ts` · `loadWindow`, `stitchWindow` | Elevation, D8, hollow table, rim depth, drains with their snapped cell |
| Flow walk in the browser | `packages/scenario/src/flow.ts` · `downstreamOf`, `LEAVES_WINDOW` | |
| Routing and capture | `packages/scenario/src/engine.ts` · `solvePosition` (296), `routeFrom` (327) | Capture 0.6 × (1, 0.5, 0); mass balance |
| Inlets an address can use | `apps/web/src/scenario/eligibility.ts` · `comparableNear`, `COMPARISON_RADIUS_M = 200` | The same 200 m this note uses |

**Not computed anywhere: flow accumulation per inlet.** It is calculated for the derived layers over the whole extent and thrown away; nothing stores a per-inlet value. For this note it was recomputed from each window's D8 field with a Kahn pass — 9,239 inlets across 154 windows in **72 seconds**, every window's accumulation summing to exactly 1,000,000 cells.

### Two things that will trip up whoever builds this

**`scene.coverage` does not mean "measured ground".** `stitchWindow` ends with `coverage: new Uint8Array(cells).fill(1)` (`sceneTiles.ts:306`). It means "the archive has this tile", which is true by construction for every window offered. The engine's data-sufficiency gate reads it (`coveredFraction`, `engine.ts:508`) against `minimumCoveredFraction: 1`, so **the gate cannot fail**. The honest figure is the scalar `measuredShare`, which is 31–86% per window (median 61%) and is what the result screen shows. Any new feature that reads the per-cell array expecting measurement reads a constant; this note re-stitched the `measured` bitmask from the tiles instead.

**Inlets are snapped onto the flow path** by the pipeline (median offset 3.42 m). That is why the median inlet sits at the **96.5th percentile** of its own window's accumulation: inlets are on the water's path by construction, so "is it on a channel" is close to a tautology for an inlet.

---

## 2 · The two candidate scores

### Method 1 — upstream catchment area

**Input:** `upstreamCells`, the number of grid cells whose water reaches this inlet's cell along the D8 field. At 1 m cells this is square metres.

**Formula:** `score = upstreamCells`, with two gates — the inlet's own cell must be measured ground, and the inlet must be one of the 9,239 the scene tiles support.

**Why it relates to "worth checking":** if this drain stops taking water, a larger area's runoff carries on down the street. It is the only input measured here that is both large-ranged and physically about the drain rather than about the reader.

**Because line:** *Water from a large area of the street flows to this drain in the model.*

### Method 2 — catchment, plus "it collects here", plus "it is the last one"

**Inputs:** `upstreamCells`; `rimDepthM ≥ 0.25 m` where the inlet sits inside a hollow; and `nextInletM`, the along-path distance to the next inlet downstream.

**Formula (as designed, before measurement):** eligible if measured ground and `upstreamCells ≥ floor`; add a point for sitting ≥ 0.25 m below a hollow rim; add a point for having no other inlet within 50 m downstream; rank by catchment within the eligible set.

**Because lines:** *Water from a large area of the street flows to this drain* · *This drain sits in a low spot where water gathers* · *Water passing this drain does not meet another drain nearby.*

**Both extra inputs failed measurement, and neither should be used.**

| Input | What the data says |
|---|---|
| Hollow depth | 2,047 inlets (22.2%) sit in a hollow, but the median sits **0.16 m** below its rim and only **683 (7.4%)** sit 0.25 m or more below it. The ground surface is quoted at about **25 cm** accuracy, so for 92.6% of them the claim is finer than the data that produced it — the same rule that stops the blockage comparison reporting millimetres |
| On a channel | The threshold is each window's own 99.5th percentile, which ranges from **12,239 to 76,624** cells across the 154 windows. Two inlets with identical catchments disagree depending on which window they were assigned |
| Next inlet downstream | **36.2% of paths end in a hollow spill cycle** — the walk re-enters a hollow it already spilled from, an artefact of how spill cells were chosen. Of those, **62.8% have another inlet inside the very hollow they pond in**, at a median of 16 m. The "collector" flag is 63% driven by that artefact |
| Collector vs catchment | They are close to independent, and point the **opposite** way: median catchment of a 50 m collector is **841 m²** against **2,399 m²** for a non-collector. An inlet on a big channel has more inlets packed around it, so it is *less* likely to be a collector |

Method 2 therefore collapses into Method 1 with extra noise. Everything below tests Method 1.

---

## 3 · The threshold, and why no cut-off works

Citywide distribution of `upstreamCells` over all 9,239 inlets:

| min | p10 | p25 | median | p75 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|---|
| 6 | 47 | 174 | **1,343** | 10,953 | 51,334 | 105,553 | 278,871 | 643,860 |

A citywide cut-off was the method the brief asked for. Applied to every address's 200 m set:

| Cut-off | Inlets citywide | Addresses with 0 | with 1–3 | with 4+ | median | max |
|---|---|---|---|---|---|---|
| ≥ 1,000 m² | 4,894 | 1.0% | 2.3% | 96.7% | 26 | 98 |
| ≥ 5,000 m² | 3,167 | 1.7% | 6.5% | 91.8% | 17 | 72 |
| ≥ 10,000 m² | 2,400 | 4.2% | 10.3% | 85.5% | 12 | 65 |
| ≥ 20,000 m² | 1,704 | 8.9% | 18.9% | 72.2% | 7 | 53 |
| ≥ 50,000 m² | 947 | 26.7% | 26.4% | 46.9% | 3 | 36 |

**There is no cut-off that gives a small set to most addresses.** The one that finally reaches a median of 3 leaves a quarter of addresses with nothing *and* still gives 4 or more to 47% of them, up to 36. The reason is in the next table.

### Why: the same water, counted along the street

Within one address's 200 m:

| Comparison | p10 | median | p90 |
|---|---|---|---|
| Largest catchment ÷ median catchment | 7× | **47×** | 456× |
| Largest ÷ **fourth** largest | **1.0×** | **2×** | 6× |

The first row is the signal a score needs; the second is the cut a recommendation has to make, and it is not there. At 46 Gatehouse Drive the top seven inlets run consecutively down Moylan Lane and Westbourne Road at **323k, 322k, 322k, 321k, 319k, 319k and 306k m²** — one trunk, one body of water, seven candidates.

Three ways to break the tie were tested. Each produces a small set only by imposing one:

| Rule | 0 | 1–3 | 4+ | median | max |
|---|---|---|---|---|---|
| Floor 5,000 m², keep those ≥ 50% of the local largest | 1.7% | 42.5% | 55.8% | 4 | 29 |
| Floor 5,000 m², **take the top three** | 1.7% | 98.3% | 0% | 3 | 3 |
| Floor 10,000 m², drop any inlet within 60 m of a kept one within a factor of 2 | 4.2% | 22.0% | 73.8% | 6 | 21 |
| Floor 10,000 m², same but 150 m and a factor of 4 | 4.2% | 53.4% | 42.4% | 3 | 10 |

The second row is a cap, not a threshold: it answers "three" because it was told to. The third and fourth are a spatial heuristic whose two knobs — 60 m or 150 m, factor 2 or 4 — have no basis in the data, and each setting changes which drain a resident is sent to look at. Chain collapse using the flow field, which would have been the principled version, separates the set at Poplar Road and Market Street and **does not move Gatehouse Drive at all** (1.0× → 1.1×), because those trunk inlets' paths end in separate spill cycles rather than reaching each other.

---

## 4 · Results over a sample of addresses

Twenty-one addresses — the product's seven example addresses plus fourteen taken at a fixed stride through the index. Counts under the most generous defensible rule tested (measured ground, ≥ 10,000 m², dedupe 60 m / factor 2):

| | inlets within 200 m | recommended |
|---|---|---|
| minimum | 4 | **2** |
| median | 43 | **6** |
| maximum | 99 | **12** |

### Worked example 1 — 46 Gatehouse Drive, Kensington (the guide's address)

94 supported inlets on measured ground within 200 m. Top of the set:

| Asset | Catchment | Next inlet downstream | In a hollow |
|---|---|---|---|
| 1144824 | 323,000 m² | — (spill cycle) | no |
| next six on the same trunk | 322k, 322k, 321k, 319k, 319k, 306k | — | no |
| 1585125 | 99,000 m² | — | no |

**1st ÷ 4th = 1.01.** Any rule that returns one of these seven returns it arbitrarily. *Because* line, honestly written, would have to be: *water from a large area flows to this drain — and to the six next to it.*

### Worked example 2 — 89 Market Street, Kensington

23 inlets on measured ground within 200 m; 1st ÷ 4th = 3.8×. Rule keeps two: 1144985 at 74,000 m² and 1144895 at 20,000 m². This is the case the design was hoping for — and it is not the common one.

### Worked example 3 — 35 Poplar Road, Parkville

9 inlets within 200 m; 1st ÷ 4th = 6.1×, the cleanest separation in the sample. Rule keeps three: 1146554 at 180,000 m², 1146557 at 30,000 m², 1146551 at 17,000 m². Chain collapse sharpens it further (97.8×). Quiet streets separate; the dense streets where most of the pilot's residents live do not.

---

## 5 · Edge cases

| Case | How often | What must happen |
|---|---|---|
| No inlet within 200 m | **334 addresses (0.5%)** | Say so plainly, keep the general actions, and do not present it as lower risk |
| The inlet's own cell is not measured ground | **1,306 inlets (14.1%)** | Not shown with any hydrological claim. Their elevation and flow are interpolated |
| Partially measured surroundings | **every inlet** — `coverageShare50m` never reaches 1.0 (max 0.978, median 0.544) | A "fully measured" test is vacuous; the honest statement is the share, or nothing |
| Two inlets on one snapped cell | **572 inlets (6.2%)**, byte-identical metrics | They cannot be ordered against each other at all |
| Inlet outside the scene-tile coverage | 21,113 pits against 9,239 supported | Already handled: the map says a pit cannot be tested rather than guessing |
| Address outside the pilot | existing behaviour | General guidance only, said to be general |
| Pit type | 22 description strings for about seven real types, under four inconsistent prefixes | Normalise before any rule reads them |

---

## 6 · Performance and where the computation lives

**Precompute per inlet, in the pipeline.** The full sweep — 154 windows, a Kahn pass over 1,000,000 cells each, 9,239 inlets — took **72 seconds** on this laptop. Per request it is impossible: the browser holds one 1 km window at a time and would need every window within 200 m of the address.

The artefact would be one row per inlet — asset number, catchment, measured flag — about **9,239 rows, under 200 KB**, published like `scenario-differences.json`. The browser then does a radius query against data it already has, and **the address never leaves the device**, which is the standing rule and is what AC 5.4.1 requires.

> If the team takes the ranking branch anyway, the score must be published as a **number per inlet**, never as a rank or a "top three" list, so that the ordering is recomputed for the reader's own address rather than baked in.

---

## 7 · Proposed acceptance-criteria wording

Written so the team can adopt either branch. **Branch A** is the recommendation; **Branch B** is what to write if the team decides to rank anyway.

### Branch A — keep "no ranking", fix the volume

**AC 5.2.3, replace the new bullet** (minimum change — three words and a sentence):

> - provide *Check the street drains near you* for every supported address, showing all recorded surface drain inlets within the 200-metre radius, using the pit types approved as surface inlets in the preparation rules register, **grouped by street and listed in a panel rather than numbered on the map**, without selecting, numbering or ranking them;
> - state how many recorded inlets were found, and that the list is every recorded inlet near the address rather than a selection;

**AC 5.1.3, add one bullet** (the zero case is 0.5% of addresses and currently unstated):

> - where no recorded surface drain inlet falls within the 200-metre radius, say so and continue to provide the general preparation actions.

**AC 5.3.2, no change.** **AC 6.2.3 and 6.3.2, no change** — nothing here selects a drain for the reader.

**Epic 5 Definition of Done, extend the existing line:**

> - Users at every supported address can view recorded surface drain inlets within the 200-metre radius, without selection, numbering or ranking, **grouped by street, with the count stated**, and can report a selected inlet through User Story 6.3.

### Branch B — if the team ranks anyway

Then these are the minimum changes, and each exists because of a measurement in this note.

**AC 5.2.3** — replace *without selecting, numbering or ranking them* with:

> - order the recorded surface drain inlets within the 200-metre radius by the modelled area of ground that drains to each one, and show the order as a property of each drain rather than as a recommendation;
> - state that the order describes how much of the surrounding ground drains to each inlet in the model, and does not mean that a higher inlet is more likely to block, more likely to flood, or more relevant to the user's property;
> - **where the modelled areas of the highest-ordered inlets are within a factor of two of each other, present them as one group rather than in order**, because the model cannot separate them;
> - exclude any inlet whose own ground was not measured, and say how many were excluded for that reason.

**AC 5.3.2** — add:

> - provide, for each ordered inlet, a plain-English *Because* line built only from the modelled drainage area, and no *Because* line where that value is unavailable or where the ground was not measured.

**AC 6.2.3** — the existing line forbids recommending *the nearest* recorded pit. It needs one clause so ordering is not read as recommendation:

> - avoid selecting or recommending the nearest recorded stormwater pit as the drain relevant to the selected address, **and avoid presenting an ordered inlet as the drain that serves the user's property**;

**AC 6.3.2** — unchanged in substance, plus:

> - where the user arrives from an ordered inlet, identify it as *Selected recorded drain* in the same way as a drain selected on the map.

**Epic 5 Definition of Done** — replace the no-ranking line with:

> - Users at every supported address can view recorded surface drain inlets within the 200-metre radius, ordered only by modelled drainage area, with inlets the model cannot separate shown as one group, and can report a selected inlet through User Story 6.3.
> - The ordering rule, its inputs and the group-when-inseparable rule are recorded in the preparation rules register, with the measured distributions that justify them.

---

## 8 · What to do instead

The problem the ranking was meant to solve is real: *show all inlets within 200 m* means a **median of 50 markers**, 107 at the 90th percentile and **170** at the worst address. That is unreadable, and it is the argument for changing AC 5.2.3 — just not into a ranking.

| Addresses' inlet counts within 200 m | |
|---|---|
| median | 50 |
| p75 / p90 | 76 / 107 |
| max | 170 |
| zero | 334 addresses |

**Proposal.** Keep the drains as the map layer they already are, and put the *Check the street drains near you* content in a panel:

1. **Say the number**: *There are 47 recorded street drains within 200 m of this address.*
2. **Group by street**, longest list first: *Westbourne Road (12) · Moylan Lane (7) · …*. A street is something a resident can walk; a rank is not.
3. **One action for all of them**, which is what the guidance actually supports: look from a safe place for a blocked or damaged grate before heavy rain, and report through the existing pathway.
4. **Select a drain on the map** to carry it into US 6.3, exactly as AC 6.3.2 already requires.

This keeps every promise made to the mentors, needs no score, and can be built from data already published. The one honest hydrological statement available per inlet — its modelled drainage area — can still be shown **on a drain the reader selected**, where it is a fact about that drain rather than a reason to choose it over its neighbours.

---

## 9 · What would change the answer

This note says the data cannot support the ranking today. Three things would change that, and none is a tuning knob:

1. **Imperviousness weighting.** Every cell counts one, whether it is a roof, a road or a park. A runoff-weighted accumulation would separate inlets that currently tie.
2. **Spill cells chosen so hollows drain somewhere.** 36.2% of downstream walks end in a spill cycle; fixing that in the pipeline would make "the last drain on this stretch" a real, checkable property.
3. **Inlet capacity or condition data.** Nothing in the council's published pit record says how much a pit can take or what state it is in. With it, "worth checking" would be a property of the drain rather than of the ground above it.
