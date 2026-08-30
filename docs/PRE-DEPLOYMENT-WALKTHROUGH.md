# Pre-deployment walkthrough — how DrainLens actually works

DrainLens · TA28 · for the tech mentor check, **Tuesday 1 September 2026**

This document exists for one purpose: so that any member of the team, asked to open a file and say what it does, can. It is not a feature list and not a sales document. It follows the path a single click takes, names the file and the function at each step, and says why each was written that way rather than another way.

**Read section 2 before anything else.** It is the question we are most likely to answer badly.

---

## 1 · The system in sixty seconds

Say this, in this order:

> DrainLens lets a resident of a flood-prone Melbourne street search their address, see the drainage under it, and compare what changes if a nearby drain is blocked.
>
> It has three parts. An **offline Python pipeline** reads a LiDAR point cloud and the council's drainage records and produces a small set of static artefacts. A **browser application** in React and TypeScript loads those artefacts and draws them on a canvas. A **scenario engine**, a separate TypeScript package with no DOM, routes water over the terrain in a Web Worker and returns a comparison.
>
> There is no application server in Iteration 1, and that is a decision rather than a gap. I can explain why.

That last sentence is deliberate. It invites the question we have a good answer to, instead of letting it arrive as an accusation.

### The three repository positions

Every design choice below traces to one of these. They are in `README.md` and they come from System Architecture v5.

| Position | What it means in code |
|---|---|
| **No identity** | No accounts, no sessions, no retained IP. No endpoint accepts an address or a coordinate. |
| **Build-time heavy, runtime thin** | Anything expensive or judgement-laden runs once, offline, and publishes a versioned artefact. |
| **Provenance is a record** | Every displayed value carries a `basis` saying where it came from. A value that cannot account for itself cannot be constructed. |

---

## 2 · "Walk me through a request from the frontend"

This is the standard backend question, and **our honest answer is that there is no request.** Answering it well is the difference between looking like we skipped the backend and looking like we decided against one.

### The answer

> Almost nothing goes to a server. The map, the terrain, the drainage network and the address index are static files built offline and served as-is. The address search and the scenario engine both run in the browser. A resident can use the whole product — search an address, follow the drainage, run a blockage comparison, read the result — without one request that says anything about them.
>
> That is AD1, no identity. The cheapest way to keep a promise about data is never to receive it. An address search box that calls a server sends every keystroke of somebody's home address to that server, and a log line is storage.
>
> Two payloads are specified for later work, in `packages/schema/src/wire.ts`. Neither is built yet. One is drain-check submission, which is Epic 4. The other is a cached rainfall observation, which depends on a Bureau of Meteorology authorisation we do not have.

Then offer the walkthrough we *do* have, which is the same shape of question:

> What I can walk you through end to end is a comparison: from the click, through the reducer, across a `postMessage` boundary into a worker, into the engine, and back to the screen. It crosses a thread boundary instead of a network one, and every other part of the question — which file, which function, what logic, how the result comes back — is the same.

That walkthrough is section 4.3. **Whoever answers this should have it ready.**

### If pressed: why not build a backend anyway?

> Serving static artefacts is static hosting behind a CDN, not an application. Building endpoints against a contract nobody is calling is how a system acquires surface area it then has to defend. `apps/api` is a directory in the layout with "not yet started" written next to it, because we would rather it be visibly absent than present and hollow.

The full reasoning, including the forbidden-key list that will bind the backend when it does exist, is in [INTERFACE-CONTRACT.md](./INTERFACE-CONTRACT.md).

---

## 3 · The map of the code

```
pipeline/                    Python. Never deployed. Produces artefacts.
  las.py         ground.py         → bare-earth surface from LiDAR
  hydrology.py   footprints.py     → depressions, conditioning, D8 routing
  network.py     derived.py        → map geometry, surface-water layers
  addresses.py   scene.py          → address index, browser scene pack
  trace.py                         → downstream topology, with a reason at every end

packages/schema/             Shared definitions. No logic. The single authority.
  vocabulary.ts  wire.ts  provenance.ts  scenario.ts

packages/scenario/           The engine. Pure TypeScript, no DOM, no fetch.
  engine.ts  flow.ts  terrain.ts  checks.ts

apps/web/                    React + Vite. The only thing deployed.
  session.ts                        state machine
  address/search.ts                 in-memory address search
  map/                              canvas renderer
  trace/                            downstream traversal and its rendering
  scenario/                         worker, scene loading, wording
  crosssection/                     what a section may claim
  screens/                          six screens
```

**`packages/schema` is the highest-value directory.** The frontend, the future backend and the model output share one definition, so a decision made there cannot drift between them. If a mentor asks where to start reading, start there.

---

## 4 · Feature walkthroughs

Eight features. Each gives the click, the files in order, and the thing worth understanding.

### 4.1 · Address search and the pilot boundary

| Step | File · function | What happens |
|---|---|---|
| 1 | `App.tsx` · `load()` | On mount, fetches `/data/addresses.json` and checks it carries an `addresses` array |
| 2 | `screens/Landing.tsx` | Each keystroke calls `search()` — no debounce needed, it is an array scan |
| 3 | `address/search.ts` · `normalise()` | Lower-cases, strips punctuation, expands `st`→`street`, `rd`→`road` |
| 4 | `address/search.ts` · `scoreOne()` | Scores each candidate; a whole-query prefix beats everything |
| 5 | `address/search.ts` · `resolve()` | Returns one of four results: `found`, `ambiguous`, `outside-pilot`, `not-an-address` |
| 6 | `session.ts` · `reduce()` | `address-accepted` or `address-rejected`, moving the screen |

**The thing worth understanding.** `resolve()` returns four outcomes, not two, because "this is not an address" and "this is an address outside the pilot area" need different screens. Telling somebody in Footscray that their address does not exist is wrong; telling them it is outside the pilot is true.

**The bug that nearly shipped.** `resolve()` originally scanned the *address* list to decide whether a street was known. The demonstration index holds only two real recorded addresses, so it would have told residents of 129 covered streets that their street did not exist. It now checks `index.streets` through `namesAKnownStreet()`. Worth telling the mentor unprompted — it is a good defect story, and it shows the fixture was tested against rather than around.

**Why in the browser at all.** A test traps `fetch` and asserts the search never reaches for it. See section 2.

---

### 4.2 · The canvas map

| Step | File · function | What happens |
|---|---|---|
| 1 | `App.tsx` · `load()` | Fetches `/data/map.json` and `/data/derived.json` |
| 2 | `map/artefact.ts` · `assertUsable()` | Refuses an artefact that names no source |
| 3 | `map/derived.ts` · `assertDerived()` | Refuses a derived artefact whose `basis` is not `derived` |
| 4 | `map/viewport.ts` · `fit()` | Computes scale and centre so the extent fills the canvas |
| 5 | `map/MapCanvas.tsx` | Owns the canvas element, pointer events and the animation frame |
| 6 | `map/draw.ts` · `drawMap()` | Roads, pipes, pits, labels |
| 7 | `map/derived.ts` · `drawDerived()` | Channels, low points, unavailable areas |
| 8 | `map/hit.ts` · `pick()` | On tap, finds what was hit within 18 screen pixels |

**Why canvas and not MapLibre or Leaflet.** This is our clearest technical-choice answer.

> We have no basemap tiles and no geographic layers to combine. Everything we draw is our own artefact, already projected at build time into metres east and north of the extent corner. A map library's whole value is tile management, projection and layer composition, and we need none of the three. What we would get instead is a dependency that owns the render loop, a second coordinate frame to keep in sync with the pipeline's, and a few hundred kilobytes before a single road is drawn.
>
> What we do instead is one affine transform. `toScreen()` in `viewport.ts` is nine lines, and there is exactly one minus sign in the file — the northing-up to canvas-y-down flip. That is the whole projection story on the client.

**The syntax a mentor might point at.**

```ts
// map/viewport.ts
return [
  viewport.widthPx / 2 + (east - centreE) * viewport.scale,
  // Northing up, canvas y down. The only minus sign in the file.
  viewport.heightPx / 2 - (north - centreN) * viewport.scale,
];
```

Translate relative to the centre, scale, flip y. Having exactly one place that flips is why a mirrored-label bug was a one-line fix rather than a hunt.

**A defect worth mentioning.** Street labels were first drawn once per segment, which made the map unreadable. `placeLabels()` now keeps one label per street name, at its longest run, and drops any that collide.

---

### 4.3 · The scenario comparison — the full end-to-end

**This is the walkthrough to have ready.** It is the answer to "trace a request" in a system that has no requests.

**The click.** `screens/ScenarioSetup.tsx`, the Run button.

| # | File · function | What happens |
|---|---|---|
| 1 | `App.tsx` · `onRun` | Looks the pit up in `map.layers.pit` by `asset_number` |
| 2 | `App.tsx` | Reads the pit's cell **from the scene**, never recomputing it from the map |
| 3 | `session.ts` · `reduce()` | `comparison-started` sets `running: true` |
| 4 | `scenario/useScenario.ts` · `run()` | Assigns a request id, posts to the worker |
| 5 | `scenario/worker.ts` · `self.onmessage` | Receives it, off the main thread |
| 6 | `scenario/worker.ts` · `handle()` | Calls the engine; converts a throw into a reason |
| 7 | `packages/scenario/engine.ts` · `runScenario()` | The data-sufficiency gate, then the solve |
| 8 | `engine.ts` · `solvePosition()` | Called **twice per rainfall position** — scenario and baseline |
| 9 | `engine.ts` · `checkMassBalance()` | Rejects a result that does not conserve water |
| 10 | back through `useScenario` → `session.ts` | `comparison-finished` carries the outcome |
| 11 | `screens/Result.tsx` + `scenario/outcome.ts` | Wording chosen from the outcome |

**Five things in that path a mentor may stop on.**

**(a) Why a Web Worker.** A comparison solves a one-million-cell grid twice for each rainfall position. On the main thread that freezes the map mid-gesture, and a frozen map reads as a crash — the person taps again, and now two runs are competing. The worker loads the scene once and keeps it, so changing a blockage setting costs a calculation rather than a megabyte.

**(b) Why requests carry an id.** Replies are matched against the newest request. Somebody who changes the blockage while a comparison is running sees the answer to what they asked last, not whichever run happened to finish second.

**(c) The data-sufficiency gate runs in a deliberate order.** In `runScenario()`: terrain coverage, then whether the selected asset is an inlet, then the calculation, then comparability — cheapest and most decisive first. The reason a resident sees is the one that actually stopped the comparison, not whichever check happened to be written first.

**(d) `no-clear-change` is not `insufficient-information`.** They are different branches of the outcome union. The first means the calculation ran and found no difference. The second means it could not be made. A resident acting on the first is being reasonable; a resident acting on the second, believing it was the first, is acting on nothing.

**(e) The engine throws for caller mistakes and returns for data problems.** An empty or unordered rainfall list throws `EngineError`, because that is a defect in the code that built it and hiding it behind a friendly status would let it ship. A blocked pit that is not an inlet *returns* `invalid_inlet`, because that is a real situation a resident can be in.

---

### 4.4 · The scenario engine's water model

The most likely place for a "what does this function do" question, because it is the only part of the codebase doing real physics.

**`solvePosition()` in three sentences.** Rain falls uniformly on the window. Water moves downslope one cell at a time along the flow field; a drain takes its share of whatever reaches it; a depression holds water to its capacity and passes the rest to its spill cell. Anything reaching the boundary leaves.

**`upstreamFirst()` — Kahn's algorithm.** Cells must be solved in an order where everything upstream is already done.

```ts
// count how many cells drain into each cell
for (let cell = 0; cell < cells; cell += 1) {
  const next = downstreamOf(flow, cell);
  if (next !== LEAVES_WINDOW) upstreamCount[next]! += 1;
}
// start from cells with nothing upstream, then peel
while (head < tail) {
  const cell = queue[head++]!;
  order[written++] = cell;
  const next = downstreamOf(flow, cell);
  if (next !== LEAVES_WINDOW && --upstreamCount[next]! === 0) queue[tail++] = next;
}
```

Be ready for **"why not just sort by elevation?"** — that was the first version, and it is the best defect story we have:

> Sorting by elevation is a *proxy* for topological order, not the thing itself. On the real artefact, 509 cells out of a million were exactly level at float32 precision, so the order among them was arbitrary and water was solved out of sequence. Kahn's algorithm on a flow field is exact by construction and needs no tolerance. Ties break by cell index, so two runs give the same answer — a solve that disagreed with itself in tie-breaking would still violate AC 2.2.

**The `!` after array reads.** `upstreamCount[next]!` is TypeScript's non-null assertion. Indexing a typed array yields `number | undefined` under `noUncheckedIndexedAccess`, which we have on. Inside a loop bounded by the array's own length the value cannot be undefined, so the assertion states what the bound already guarantees. Where the index is *not* provably in range — `downstreamOf()` — the code checks instead of asserting. Know which is which if asked.

**The mass balance.** `checkMassBalance()` in `checks.ts` asserts that rain in equals captured plus ponded plus left-the-window. It found three real bugs in sequence, and they are worth telling as one story:

> With the balance instrumented we were losing 71.55% of the water. Three separate causes. The pipeline was shipping the *raw* surface while the flow field came from the *conditioned* one, so water was routed by one terrain and stored by another — that was 65.8%. Replacing the elevation sort with Kahn's brought it to 27.0%. The last was that depressions were resolved in a single pass ordered by rim height, which assumes spill chains always run downhill in rim terms; on real terrain they do not, because a deep pit in low ground can have a higher rim than the shallow hollow feeding it. Water landing in an already-resolved store was stranded, counted as neither ponded nor passed on. Repeating the passes until nothing moves brought the loss to 0.00%.

**Constants worth knowing**, in `DEFAULT_ASSUMPTIONS`:

- `captureFraction: 0.6` — **assumed**, not measured. It stands in for inlet geometry, grate condition and approach flow, none of which the source records. See section 8.
- `noticeableVolumeM3: 0.05` — below this, a difference is reported as no clear change, so a millimetre of arithmetic is not presented as something to act on.
- `minimumCoveredFraction: 1` — the whole window must be covered. A comparison over a partly covered window is not comparable with one over a full window.

`blockageMultiplier()` is a `switch` rather than a lookup table **on purpose**: the compiler proves every setting is handled, so adding a fourth blockage setting fails the build here instead of silently falling through to a default.

---

### 4.5 · The offline pipeline

Nothing here is deployed. It runs on a laptop and writes files. A mentor may still open it, and the terrain chain is the most technically substantial thing the team has built.

| Stage | Module | What it does |
|---|---|---|
| 1 | `archive.py`, `las.py` | Range-reads the LiDAR archive; parses LAS 1.2 point formats 0–3 by hand |
| 2 | `ground.py` · `build_ground_surface()` | **SMRF** — removes buildings and trees, leaving bare earth |
| 3 | `footprints.py` · `barrier_mask()` | Council building footprints, rasterised as flow barriers |
| 4 | `hydrology.py` · `find_depressions()` | Priority-flood fill on the **raw** surface |
| 5 | `hydrology.py` · `condition()` → `d8()` | Epsilon-gradient conditioning on a **separate** surface, then D8 routing |
| 6 | `network.py`, `derived.py` | Map geometry; flow accumulation, channels, outlines |
| 7 | `scene.py` · `write()` | Packs the browser scene: int16 centimetres, bit-packed masks |

**Three answers to have ready.**

**Why we implemented SMRF ourselves.** PDAL, the standard tool, would not install on the team's machines. SMRF (Pingel, Clarke & McBride 2013) is a morphological opening at growing window sizes: a cell is an object if the surface drops by more than a slope tolerance as the window grows. It is about eighty lines of numpy and scipy.

**Where the window size came from** — the answer to "why 26 metres?" Not from a paper's default:

> We measured the marginal effect. Growing the window from 12 m to 18 m removes 5.8 more hectares of objects; 18 m to 26 m removes a further 2.2; beyond that it settles at a near-constant hectare per step, which is the filter shaving terrain rather than finding buildings. The knee is where we stopped.

The same method set the 0.25 m depression floor and the 1 m simplification tolerance. If asked how we justify a parameter in a derived layer, this is the answer: **measure the marginal effect and stop at the knee.**

**The independent cross-check.** The council's building footprints and the filter's object mask agree 92.2% one way and 51.9% the other. The asymmetry is the interesting half:

> Almost every footprint is inside the object mask, but only half the object mask is footprints — the rest is tree canopy. That is why the object mask cannot serve as flow barriers: water flows under trees. It also confirmed the filter's predicted blind spot at the predicted threshold — 44.7% missed beyond 13 m inside a large roof, and a 26 m window reaches 13 m in.

**The fork worth pointing at**, in `terrain.py`:

```python
raw = surface.elevation.astype(np.float32).astype(np.float64)
depressions = find_depressions(raw, CELL_SIZE_M)     # measure on the published surface
direction = d8(condition(raw, barriers))             # route on a separate conditioned one
```

Depressions are *measured* on the raw surface, because that is the terrain we publish. Routing needs a surface with no flat spots, so conditioning adds an epsilon gradient — but on a copy. Shipping the raw surface while routing on the conditioned one was two-thirds of the mass-balance leak: the two must be built from the same source and used for different jobs.

---

### 4.6 · Following the drainage downstream

Built 29 August. The best answer in the codebase to "why is there a pipeline stage for this?"

| Step | File · function | What happens |
|---|---|---|
| 1 | `pipeline/trace.py` · `build()` | Offline: the extent's downstream links, each with a reason if it stops |
| 2 | `App.tsx` · `load()` | Fetches `/data/trace.json` (37 KB) |
| 3 | `trace/graph.ts` · `assertTrace()` | Refuses an artefact not declaring a `sourceProvided` basis |
| 4 | `screens/PitDetail.tsx` | Shows the recorded fields, and offers the follow action |
| 5 | `trace/graph.ts` · `traceDownstream()` | Breadth-first over all branches, cycle-guarded |
| 6 | `trace/draw.ts` · `drawTrace()` | Path, direction arrows, a mark at every stop |

**Why a pipeline stage at all — the question to have ready.** `map.json` already carries every pipe with an `upstr_pit` and a `dnstr_pit`, so the browser could trace without any new artefact. It could not do one thing:

> A pipe whose downstream pit is not among the extent's pits has two completely different explanations, and the map artefact cannot tell them apart. Either the council recorded where it goes and it goes somewhere we clipped off — the path continues, we are simply not drawing it — or the council never recorded where it goes, and the path stops because the record stops. In this extent that is **7 edges of the first kind and 29 of the second**. Showing all 36 as "the pipe goes nowhere" would state something false about the source data. Only the council-wide graph knows which is which, so we resolve it once, offline, and ship the reason.

**There are no recorded outlets, and this is the honest finding worth volunteering.** All 215 extent pits with no downstream pipe are junctions, kerbside inlets or unrecorded types — not one is an outfall, endwall or discharge point. **83 of them are inlets**, and a kerbside grate is not where a drainage system ends; it is where the record does. So the code has no `outlet` termination to return and the interface has none to display. AC 1.2.2.c offers "the recorded outlet or the last known connection"; in this data it is always the second, and a trace that announced an outlet would be inventing the end of a drainage system.

**Direction comes from topology, not geometry.** A pipe's vertices are ordered however the surveyor captured them, so `orientAwayFrom()` decides which end is upstream by asking which is nearer the pit the path arrived from. Reading direction off vertex order would produce arrows that are right about half the time — and a confidently wrong arrow about which way water flows is worse than no arrow.

**Two cycle guards, on purpose.** The artefact marks the council's own back edges (18 across 34 nodes; one of them lies inside the demonstration extent, so the guard is exercised by the demo data itself). The traversal *also* keeps a visited set, because the artefact's marking was computed over the council-wide graph and a loop that only closes within the extent would not appear in it.

**The measured counts**, which the panel's wording depends on:

| | |
|---|---:|
| Pits in the extent | 895 |
| Links that stay inside it | 697 |
| Pits with no downstream pipe at all | 215 |
| Pipes whose destination was never recorded | 29 |
| Pipes continuing past the mapped area | 7 |
| Back edges inside the extent | 1 |

---

### 4.7 · The street cross-section

Built 29 August. The shortest answer to "what do you do when the data is not there".

**No invert level exists for any pit in the extent.** Not 95.4% missing — absent, because the pipeline never fetched a field missing from 95.4% of the council's record and internally inconsistent in what survives. A cross-section is a *vertical* drawing, and the one axis it exists to show is the one with no data behind it.

So the section splits itself, and says so inside the figure rather than in a caption:

> **Everything horizontal is recorded** — which pipes connect, on which side, their diameter and material. **Everything vertical is drawn.** The pipes are spaced evenly because the record gives no depth to space them by, and the vertical axis is labelled *depth not recorded — spacing illustrative*.

**726 of 895 pits** get a drawing; the other **169** get AC 1.3.2, which says the record connects no pipe here **and that this is a gap in the record rather than evidence that no pipe exists**. The two are indistinguishable from the data, and only one of them is a claim about the world.

A pipe with no recorded diameter is drawn at the minimum and labelled, never at the average of its neighbours — that is AC 1.3.2.c, an unsupported assumption dressed as a measurement.

**The line to have ready if asked about capacity:** a recorded diameter is a dimension, not a capacity. Going from one to the other needs a hydraulic model this project decided not to build (AD6), and the drawing says so on screen.

---

### 4.8 · The result screen and its wording

`scenario/outcome.ts` holds every user-facing sentence as data — `BANDS`, `INSUFFICIENT`, `RESULT_DISCLAIMER`, `HOW_IT_WAS_PRODUCED`. `Result.tsx` chooses from it and renders. Nothing writes a sentence inline.

**Why.** Wording that carries a claim about certainty is reviewable when it sits in one file, and is not when it is scattered through JSX. There are four insufficiency reasons and each carries its own action, because "try again" and "choose another pit" are different advice and offering the wrong one wastes the person's time.

**AD7, which shapes the whole screen.** The result is a *difference*, never an absolute ponding extent. An absolute-looking layer invites a reading the model cannot support. The engine returns comparison bands per cell and nothing else.

---

## 5 · The data flow, end to end

```
LiDAR archive          council open data
      │                        │
      └────────┬───────────────┘
               ▼
      pipeline/  (Python, offline, on a laptop)
      ground → hydrology → derived → scene
               │
               ▼   static build products, versioned, replaced wholesale
      map.json · derived.json · trace.json · addresses.json · scene.json · *.bin
               │
               ▼   plain GET, gzipped, no query about the person
      apps/web  ──► App.tsx load()  ──► assertUsable / assertDerived
               │
               ├──► address/search.ts    (in memory, never fetches)
               ├──► trace/graph.ts       (downstream traversal, cycle-guarded)
               ├──► map/draw.ts          (canvas, one affine transform)
               └──► scenario/worker.ts   ──► packages/scenario/engine.ts
                              postMessage           runScenario()
                                   ▲                     │
                                   └─────────────────────┘
                                        outcome
```

**One frame throughout.** Coordinates in every artefact are metres east and north of the extent's south-west corner, to a decimetre — not latitude and longitude. The projection happens once, at build time, in `pipeline/geo.py`. So no projection runs in the browser and there is no second place for the map and the model to disagree about where a pit is.

**Sizes**, for the "does it scale" question:

| Artefact | Size |
|---|---:|
| `map.json` | 318 KB |
| `derived.json` | 183 KB |
| `trace.json` | 37 KB |
| `scene.json` | 92 KB |
| `scene/*.bin` | 1.28 MB gzipped |

We measured the whole extent at 1.27 MB gzipped and concluded that **tiling is not needed** for the pilot area. That is a measurement, not an assumption, and it is the honest answer to "what happens when you scale up": at Greater Melbourne extent it would need tiling, and we have not built that.

---

## 6 · Technical choices, and what we rejected

The mentor may ask "why did you choose X". Each of these has a rejected alternative, which is the part that makes the answer credible.

| Choice | Instead of | Why |
|---|---|---|
| Canvas | MapLibre / Leaflet | No basemap, no layer composition, already projected. A library would own the render loop and add a second coordinate frame. |
| Static artefacts | REST API + database | AD1. No endpoint that receives an address can leak one. |
| Web Worker | Main thread, or a server | A million cells solved twice per position; a frozen map reads as a crash. Server-side would break reproducibility (AC 2.2). |
| npm workspaces + project references | Separate repos, or one flat package | The schema is shared by three consumers; TypeScript project references make a breaking change a build failure rather than a runtime surprise. |
| Own SMRF in numpy | PDAL | PDAL would not install on the team's machines. Eighty lines, and we understand every one. |
| D8 single-flow routing | D-infinity / multiple-flow | D8 is exact for the topological order we need, and the artefact is an `Int8Array` of direction codes rather than eight fractions per cell. |
| Kahn's algorithm | Sort by elevation | Elevation is a proxy. 509 of a million cells were exactly level at float32. |
| Discriminated unions for outcomes | Nullable fields / error strings | The compiler forces every screen to handle every case; a new insufficiency reason breaks the build at each site that must change. |
| An offline trace artefact | Tracing from `map.json` in the browser | The map cannot distinguish a pipe we clipped from one the council never finished recording. 7 edges versus 29, and they are different claims. |
| Vitest | Jest | Native ESM and TypeScript with no transform config; the suite runs in 1.4 s, which is what keeps it being run. |

---

## 7 · Development process evidence

What the mentor can check in the repository, and what lives outside it.

### In the repository

| Practice | Where | Current state |
|---|---|---|
| Branching | `main` ← `develop` ← feature branches | held throughout |
| Pull requests | 7 opened, 6 merged, each with written review | GitHub |
| Branch protection | GitHub ruleset on `main` | zero direct pushes, enforced |
| CI | `.github/workflows/ci.yml` | typecheck + tests + coverage, Node and Python jobs |
| `npm ci`, never `npm install` | CI install step | fails if lockfile and `package.json` have drifted |
| Coverage gates | `vitest.config.ts`, `pyproject.toml` | 88% overall, 90% for judgement-carrying modules |
| Commit messages | prose explaining *why*, not what | see `git log` |

### Numbers, as measured on 29 August 2026 (after the trace feature landed)

| Metric | Value |
|---|---|
| TypeScript tests | **441**, 20 files, **1.6 s** |
| Python tests | **332**, **55 s** — still over the 5 s gate, see below |
| TypeScript coverage | **92.7%** statements · 93.9% branches · 95.3% functions |
| Python coverage | **91.44%** |
| Source lines, excluding tests | ~17,000 |

Both suites pass and both are above their **coverage** gate. The **runtime** gate is a different story and it is better to raise it than be shown it:

> The Node suite runs in 1.4 s and holds the five-second rule. The Python suite takes 55 s, down from 88 s: the worst offender was a 20,000-vertex zigzag through Douglas–Peucker — that algorithm's pathological worst case, and quadratic in the length — which took 32.7 s to prove something the recursion limit proves in under half a second. What remains is ~45 s of `test_terrain.py` building real grids, which is inherent to what those tests check. CI blocks on the Node suite, so nothing was failing; but the rule is the team's own and we are not quietly exempting the slow half.

Interaction criteria: **77 of 77 met**, each checked against the code on 29 August rather than assumed from a task list. [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md) records how each was checked. What remains is the definition of done — mobile layouts, Playwright, deployment — not the criteria.

### Not in the repository — check before Tuesday

These are assessed and I cannot verify them from the codebase. **Somebody needs to confirm each one exists and is current:**

- [ ] **Peer programming observation document** — the gates table records ≥8 hours cross-discipline pair programming as still unmarked
- [ ] **PGP iteration build folder** — build artefacts for this iteration
- [ ] **Structured desk checks** — ≥2 required; the gates table shows none recorded yet
- [ ] **LeanKit board** — current, matching what is actually built

The gates table in [ITERATION-1-TASKS.md](./ITERATION-1-TASKS.md) has four rows with an em dash where a status should be. That table is honest, which is good, but a mentor reading it will see the same gaps.

---

## 8 · Say these first, before you are asked

Volunteering a limitation reads as understanding. Being caught by it reads as not knowing. All four of these are real.

**The capture fraction is assumed, and its sensitivity is an open question.** `captureFraction: 0.6` stands in for inlet geometry and grate condition, which the source data does not record. We have measured a consequence: blocking any single inlet currently produces no visible difference at any rainfall from 20 to 200 mm — not because of a bug, but because the recorded network is redundant. The median inlet captures only its own cell's rain, and every drain downstream takes 60% of what reaches it, so water released by one blocked inlet is absorbed within a few cells. **This is an open product decision**, not a defect: it decides whether the interface reports three comparison bands or two, and whether the demonstration blocks one pit or several.

**The address index is a fixture.** It carries 131 real street names taken from the map artefact and the two real recorded addresses; nothing is invented, and it declares `artefact: "address-index-fixture"` so it cannot be mistaken for the real thing. The real index builds from the council portal once the rate limit clears.

**The flow-route cross-check is weak, and we say so.** We compared our channels against the City of Melbourne's published overland flow routes. That layer is itself derived — a 2008 DEM through ESRI Spatial Analyst — so it is one derivation against another. Flow accumulation gave a 24 m median offset and a 1.7× lift over chance. **It is recorded as weaker evidence than the footprint check and is not quoted alongside it.**

**Say this one before anything else if the demonstration is mentioned.** Until 29 August the compare journey could not run at all, and nothing in the test suite noticed. The interface worked out which grid cell a pit occupied from the map geometry; the pipeline snaps every drain up to three metres onto the flow field, because a kerbside inlet recorded in the middle of the road belongs to the gutter it drains. The two disagreed for **895 of 895 drains**, so the engine found no drain at the cell it was handed and every comparison returned "required inlet records are missing" — a sentence about the council's data, blaming the source for our arithmetic. It was found by clicking the journey, not by reading it, which is the whole argument for the manual click-through being on the gate list.

**`apps/api` and `models/` are empty.** Both are in the layout with "not yet started" written beside them. Neither is in Iteration 1 scope.

---

## 9 · Who answers what

Fill this in before Tuesday. The person who wrote a piece is asked first; if they cannot answer, anyone may be asked.

| Area | Files | Primary | Backup |
|---|---|---|---|
| Offline pipeline — LiDAR, ground filter | `pipeline/las.py`, `ground.py` | | |
| Offline pipeline — hydrology, derived layers | `pipeline/hydrology.py`, `derived.py` | | |
| Scenario engine | `packages/scenario/` | | |
| Shared schema | `packages/schema/` | | |
| Canvas map | `apps/web/src/map/` | | |
| Downstream trace | `pipeline/trace.py`, `apps/web/src/trace/` | | |
| Screens, session, wording | `apps/web/src/screens/`, `session.ts` | | |
| Worker and scene loading | `apps/web/src/scenario/` | | |
| CI, branching, quality gates | `.github/`, `vitest.config.ts` | | |

**Everyone should be able to give section 1 and section 2 without notes.** Those are the two that get asked regardless of who wrote what.

---

## 10 · The half hour before

1. `npm run check` and `pytest` — both green, and know the numbers in section 7.
2. `git log --oneline -10` on `develop` — be able to say what the last three commits did.
3. Open the app and click through: address → task → scenario → result, including one insufficient state.
   Then select pit **1145091** and follow it: 33 pipes, 15 steps, stopping in five places for three different reasons.
4. Have `engine.ts`, `viewport.ts` and `ground.py` open in tabs. They are the three most likely to be pointed at.
5. Read section 8 aloud once. Those are the things to say before being asked.

---

## Where this document is wrong

It describes intent. These win any disagreement:

| Question | Authority |
|---|---|
| What may be sent over a wire? | [`packages/schema/src/wire.ts`](../packages/schema/src/wire.ts) |
| What crosses the frontend/backend boundary? | [INTERFACE-CONTRACT.md](./INTERFACE-CONTRACT.md) |
| Which criterion does a feature serve? | [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md) |
| What is still outstanding? | [ITERATION-1-TASKS.md](./ITERATION-1-TASKS.md) |
| How do I build and run this? | [DEVELOPMENT.md](./DEVELOPMENT.md) |
