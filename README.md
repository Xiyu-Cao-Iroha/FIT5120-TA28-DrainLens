# DrainLens

Stormwater flood risk for residents of Greater Melbourne communities that flood repeatedly.

**Live:** https://drainlens-205559161217.australia-southeast1.run.app

FIT5120 S2 2026 · Disaster Resilience (SDG 11) · Team TA28

A resident searches an address and can **explore** what is under their street, **trace** where water from a nearby drain goes, and **compare** what changes if that drain is blocked. It is not a flood warning, not a forecast, and not an engineering assessment.

---

## What this repository is bound by

Three positions shape almost every decision here. They come from the System Architecture (v5) and are not negotiable inside a pull request.

**No identity.** No user table, no accounts, no sessions, no email, no retained IP. The address is resolved in the browser against an index shipped with the site, and no endpoint accepts an address or a coordinate. Photographs are classified on the device and never uploaded.

**Build-time heavy, runtime thin.** Every expensive or judgement-laden operation — classifying a point cloud, deriving a bare-earth surface, building a directed graph from an incomplete drainage topology — runs once, offline, and publishes immutable versioned artefacts. The browser reads those artefacts and does the rest.

**Provenance is a record, not a label.** Every value that reaches the interface carries a basis saying where it came from: a data version, a derivation, an entry in the assumption register, or a model version. `basis` is not optional, so a value that cannot account for itself cannot be constructed.

Iteration 1 is deterministic. It depends on no machine learning and no live data feed.

A fourth position follows from the third and is worth stating on its own: **the blockage setting is an assumption the resident supposes, not a condition we observed or derived.** The model's independent variable is accumulated rainfall, not time, so it cannot produce a rate — how fast a blockage forms, how long until one does, how quickly water rises. Tests in `packages/scenario` hold that line.

---

## Layout

```
packages/schema     shared definitions — provenance, vocabularies, scenario, wire payloads
packages/scenario   scenario engine — routing, depressions, drains, comparison. No DOM
apps/web            frontend (React + TypeScript + Vite) — session state and the canvas map
apps/api            backend (Node + TypeScript + Hono)                            not yet started
pipeline            Python geospatial pipeline, never deployed — graph, terrain, map geometry, trace
tools/perf          the deployment measurement, run identically before and after
deploy              the Cloud Run runbook and the nginx configuration
data                artefact releases — git-ignored, rebuilt locally
docs                iteration scope, acceptance criteria, development guide, interface contract
models              exported ONNX models and evaluation reports                   not yet started
```

`packages/schema` is the highest-value directory: the frontend, the backend and the model output share one definition, so a decision made there cannot drift between them.

---

## Working on it

**Start with [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)** — setup for both toolchains, everyday commands, how to build artefacts, the pull request workflow, and the gotchas worth knowing before you hit them.

The short version, Node 20 or newer:

```
npm ci          # install exactly what the lockfile says — never npm install before a push
npm run check   # typecheck, then the suite with coverage thresholds enforced
```

`npm ci` rather than `npm install` is deliberate. Lockfile drift breaking CI unnoticed is a defect this team has already had once, and `npm ci` is what catches it.

The Python pipeline has its own setup; see [pipeline/README.md](./pipeline/README.md).

---

## Quality gates

These are the numbers the team committed to in its Week 4 KPI assessment. They are enforced in `vitest.config.ts` and `pipeline/pyproject.toml`, and checked by CI on every pull request — not just written down.

Measured on **30 August 2026**. These are the current figures, not the best ones the project has had: coverage fell from its early highs as the interface grew, which is what the 88% floor exists to bound.

| Gate | Target | Current |
|---|---|---|
| Coverage, judgement-carrying modules | ≥ 90% from the first iteration | `packages/schema` and `packages/scenario` both above 90%, enforced separately |
| Coverage, overall | ≥ 88% | **92.8%** Node · **91.05%** Python |
| Suite runtime | < 5 s | **3.6 s Node ✓ · 105 s Python ✗** — as CI runs them, with coverage. See below |
| Tests | 454 TypeScript · 332 Python | 786 in total |
| Tests written before or alongside the component | every one | met |
| Merges via pull request with written review | 100% | enforced by a GitHub ruleset |
| Direct pushes to `main` | zero | enforced, and **tested by attempting one** |
| CI green rate | ≥ 95% | tracked on the Actions tab |

**The Python suite still breaches this gate, and it is recorded rather than rounded off.** It was 88 s; one test was 32.7 s of that.

> **The figure quoted here was understated for a week, and a self-audit caught it.** "55 s" was measured with `--no-cov`. CI runs plain `pytest`, and `addopts` in `pyproject.toml` turns coverage on, so the run that actually gates a pull request costs **105 s** — 71 s of tests and 34 s of instrumentation. The breach was about twice what was written down. Measure the command CI runs, not a faster one that resembles it.

That test builds a zigzag and runs Douglas–Peucker over it — the algorithm's pathological worst case, and quadratic in the length. Its purpose is to prove `simplify` iterates rather than recurses, and measuring the fixture showed the recursion a recursive version would need is exactly `len(path) - 1`. So the length is now taken from `sys.getrecursionlimit()` rather than picked: twice the limit is a margin that cannot be argued with, and it proves the same property in under half a second. **88 s → 71 s without coverage**, which is the like-for-like comparison; with coverage the same suite is 105 s.

**65 of those 71 seconds are `test_terrain.py`** — nineteen tests, each building a real grid. Everything else in the pipeline suite runs in six. That is inherent to what they check, and splitting them into a separate script is a decision the team should take deliberately rather than one to slip into a documentation pass — note that doing so would leave the rest at six seconds, which still misses the gate.

The Node suite — the one the gate was written for — runs in **3.6 s with coverage** and holds. It was 1.4 s at 426 tests; it is 454 tests now, and almost all of the growth is start-up and instrumentation rather than the tests, which take 0.6 s between them.

A test that would push the suite past five seconds belongs behind a separate script, not in this run.

---

## Version history

Maintained from the first commit, per KPI 2.2. Architecture and data-model documents carry their own version tables.

| Version | Date | Change |
|---|---|---|
| 0.20.0 | 31 Aug 2026 | **Deployed.** https://drainlens-205559161217.australia-southeast1.run.app — Cloud Run, nginx, fourteen static files at 1.36 MB over the wire. Cloud Storage and CDN was abandoned mid-way: it needs a domain for a certificate and there is none, and the app's paths are absolute from `/` so a bucket sub-path cannot serve it either. Firebase Hosting, the obvious alternative, had already been **rejected by the teacher** when the first System Architecture proposed it. **That reversed the logging finding** — on Cloud Storage nothing is logged by default, but Cloud Run writes request logs carrying `remoteIp`, so the exclusion became mandatory. Getting it right took two attempts and **two real client IPs were stored in between**: `NOT LOG_ID(...)` went onto the sink's own filter rather than into `--add-exclusion`, and a query that could not match returned zero, which was read as success. They were deleted, and AD1 is now verified the only way that counts — 25 real requests, then 0 request-log entries and 0 entries carrying an IP, with system and stderr logging intact. A second silent failure: the Dockerfile sat under `deploy/`, so `--source=.` fell back to Buildpacks **without failing**, which would have shipped none of the verified content types, gzip or cache policy. `measure.mjs` was also wrong — it read `content-length` for wire bytes, which nginx does not send when compressing on the fly, so it reported 6.42 MB at a 100% ratio for a response that was gzipped throughout; it counts socket bytes now and still gives the baseline's 1.37 MB against the same server, so the recorded before stays comparable. **After: p95 507.7 ms from a laptop, against a 34.5 ms localhost floor — not a regression, a different measurement.** |
| 0.19.0 | 31 Aug 2026 | **The real address index, and the reason it was not there.** 4,089 addresses across 132 streets, replacing a two-address fixture. The portal's 429 had been read as a rate limit for days; when it cleared, the build returned **zero addresses** — caught by the guard that refuses to publish an empty index, which is the only reason a working search that finds nothing did not ship. The cause was the dataset: `addresses.py` read **`property-boundaries`**, which is parcels. It has no split street fields, and a first fix parsed its free-text `address` against all eight published shapes — producing 1,619 entirely plausible entries containing **neither demonstration address**, because a parcel is not an address and Gatehouse Drive has a 10, a 15 and a 17 but no 46. The dataset it wanted was **`street-addresses`**, 63,721 records, named in the task list from the start; the parser was deleted rather than kept as dead code. The `streets` list is now deliberately wider than the addressed streets: 38 map street names carry no address, so without them somebody on Harper Street is told their street does not exist rather than that it is outside the pilot. Verified in the browser: typing suggests as you go, and Harper Street resolves to "outside the area this pilot covers". Baseline re-taken because the payload changed — 1.37 MB over the wire, p95 34.5 ms. 441 TypeScript tests, 332 Python, 92.7% and 91.05%. |
| 0.18.0 | 30 Aug 2026 | **The credit, and the measurement that cannot be taken later.** Every artefact has carried `publisher`, `licence` and `last_modified` since the first commit and none of it had ever reached a screen — survivable locally, a licence breach once published, because CC BY 4.0 requires the attribution to be visible to the person using the work. There is now a footer on every screen, read from the artefacts so a replaced source carries its credit with it, and carrying the clause people skip: **an indication that changes were made**, since the surface-water paths, low points and ground shading are calculated rather than published. Two defects in the first version, both caught before it shipped: the credit was keyed on `publisher + ' ' + licence` and split back on a space, which credited "City" for everything; and the pre-load screens reached for a value declared thirty lines below them. Separately, **the deployment baseline was taken** — [DEPLOYMENT-BASELINE.md](./docs/DEPLOYMENT-BASELINE.md) — and it reframes the deployment question: loading every artefact costs **41 ms at p95**, while one comparison costs **998 ms**. Hosting is not this product's performance story, and no CDN will change that. 441 TypeScript tests, 332 Python, 92.7% and 91.44%. |
| 0.17.0 | 29 Aug 2026 | **All 77 interaction criteria met.** The last two were the map's own silences. It never said in words where water near an address may move, so it now measures the nearest derived path and low area and says so — rounded to ten metres, because the surface cannot support finer, and silent when nothing is within 150 m rather than reaching for something to say. And it drew everything over a **flat colour**, which was the one thing on screen quietly implying the ground is level in a product whose whole argument is that it is not: there is now a ground-surface layer, painted once from the scene's elevation array and drawn under the network, with its own control alongside separate pit and pipe controls. Its first palette ramped to a pale near-white that was almost exactly the map's ground fill — the layer drew correctly and changed 6.8% of the pixels on screen, which is a layer nobody can see — so the ramp is now cool-low to warm-high, clear of the base at both ends. 426 TypeScript tests, 332 Python, 92.6% and 91.44%. |
| 0.16.0 | 29 Aug 2026 | **US 1.3, and the capture-fraction question closed.** The cross-section was built, and the honest finding is sharper than the criteria assumed: the artefact carries **no invert level for any pit**, because the pipeline never fetched a field missing from 95.4% of the record. A cross-section's one axis is therefore the one with no data behind it, so the drawing splits itself — **horizontal recorded, vertical drawn** — and says so inside the figure. 726 of 895 pits get a drawing; 169 get the unavailable state, which says the gap is *in the record* rather than evidence no pipe exists. The **capture-fraction sensitivity** was finally run and closed the question rather than answering it: zero of forty inlets differ at 15%, 30%, 60% or 90% capture, and blocking the hundred nearest inlets raises water 5.6 mm with no cell over the threshold. The network is redundant and no assumption tunes that away. So the interface reports two bands and the result now **explains why**, including that we will not report a change finer than the ground data's own 25 cm accuracy. **75 of 77 interaction criteria met.** 389 TypeScript tests, 332 Python, 92.0% and 91.44%. |
| 0.15.0 | 29 Aug 2026 | **The comparison journey works, and finding out why it did not is the story worth telling.** The interface worked out which grid cell a pit occupied from the map geometry, while the pipeline snaps every drain up to three metres onto the flow field — a kerbside inlet recorded in the middle of the road belongs to the gutter it drains. The two disagreed for **895 of 895 drains**, so the engine found nothing at the cell it was given and *every* comparison returned "required inlet records are missing": a sentence blaming the council's data for our own arithmetic. The interface now reads the cell from the scene, which is the only thing that knows it, and `cellOf` is deleted rather than corrected — the defect was having two answers to one question. Nothing in 359 tests caught it; clicking the journey did. Also **US 2.2 and 2.3 finished**: a rainfall control that reads the run's cached positions rather than re-solving (so it cannot disagree with itself), the summary grouped by whether a value is the council's, ours or the person's own, and four measured uncertainties on screen. **67 of 77 interaction criteria met.** 359 TypeScript tests, 332 Python, 91.67% and 91.44%. |
| 0.14.0 | 29 Aug 2026 | The map opens centred on the selected address and marks it — AC 1.1.2.a and 1.1.3.a, and the smallest gap the documentation pass had found. `focus` is clamped, so an address near the boundary moves the view as far as it can and no further rather than opening onto ground outside the pilot area; verified in the browser at both demonstration addresses, one landing dead centre and one stopping exactly where the arithmetic says. The marker is deliberately not the pit colour: the address is the person's own location, not a recorded asset. Also **88 s → 55 s on the Python suite**, by taking the length of a Douglas–Peucker worst-case fixture from `sys.getrecursionlimit()` rather than from a round number — measuring showed a recursive version would need a depth of exactly `len(path) - 1`, so twice the limit proves the property that 20,000 vertices were proving at 32.7 s. **60 of 77 interaction criteria met.** 347 TypeScript tests, 332 Python, 91.36% and 91.44%. |
| 0.13.0 | 29 Aug 2026 | **US 1.2 complete**: select a pit, read what the council recorded, and follow the drainage downstream. The feature needed a pipeline stage for one reason — `map.json` cannot tell a pipe clipped out of our square kilometre from one the council never finished recording, and here that is **7 edges against 29**. Drawing all 36 as a pipe going nowhere would state something false about the source, so `trace.py` resolves it offline into a 37 KB artefact. The other finding is worth quoting: **there are no recorded outlets**. All 215 extent pits with no downstream pipe are junctions, kerbside inlets or unrecorded types — 83 of them inlets — so no path can reach an outlet and a test asserts none is claimed. Direction is read from the topology rather than the vertex order, which carries no meaning in the export. Two cycle guards, one of the council's eighteen back edges falling inside the demonstration extent. 334 TypeScript tests, 332 Python, 91.17% and 91.44%. |
| 0.12.0 | 29 Aug 2026 | Documentation for the pre-deployment check: an [interface contract](./docs/INTERFACE-CONTRACT.md) recording that the frontend/backend boundary is deliberately almost empty, and a [walkthrough](./docs/PRE-DEPLOYMENT-WALKTHROUGH.md) that follows one click through file, function and logic. Two drifts found while checking: a docstring pointing at a `preference.ts` that was never written, and a gates table still claiming 99% on both sides. |
| 0.11.0 | 29 Aug 2026 | **The mass balance closed**, from 71.55% of the water lost to 0.00%, through three separate causes. The pipeline shipped the raw surface while the flow field came from the conditioned one, so water was routed by one terrain and stored by another — 65.8%. Ordering cells by elevation is only a *proxy* for topological order and 509 cells out of a million were exactly level at float32, so `upstreamFirst` now uses Kahn's algorithm — 27.0%. Depressions resolved in a single pass ordered by rim height stranded water in already-resolved stores, because a deep pit in low ground can have a higher rim than the hollow feeding it; the passes now repeat until nothing moves. With it closed, blocking any single inlet produces **no visible difference at any rainfall from 20 to 200 mm** — not a bug, but a redundant recorded network under an assumed 60% capture fraction. **That is an open product decision.** |
| 0.10.0 | 28 Aug 2026 | The scenario runs in the browser: scene packing to int16 centimetres and bit-packed masks, a Web Worker so a one-million-cell solve does not freeze the map, the setup screen in its required order, and the result with all four insufficient states. Three defects worth recording — a design mock's `P-14` pit id that no real pit matched, so the engine never ran and a fabricated `invalid_inlet` was shown instead; the measured mask passed where the coverage mask belonged, which made *every* scenario return `terrain_unavailable`; and an address resolver that checked the address list rather than the street list, which would have told 129 covered streets they did not exist. |
| 0.9.1 | 28 Aug 2026 | Terrain-derived layers on the map — surface-water paths, low points, and hatched areas where too little ground was measured to say anything. The simplification tolerance was set by what can be seen rather than by the cell size: 0.25 m preserved every lattice staircase corner, and 1 m took 40,490 vertices to 10,986. |
| 0.9.0 | 27 Aug 2026 | The browser application starts, and the map draws real Kensington. `apps/web` was written fresh rather than adopted from the Figma Make export: that prototype's stack is the one we would have picked, but its data layer is illustrative SVG and its error handling predates the four reason codes, so most of what would carry over is the part that has to be replaced. **MapLibre was dropped** — a fixed square kilometre, north-up, already in metres from the extent corner, has no global projection, no tile pyramid and no third-party basemap, so a library would be several hundred kilobytes solving problems this product does not have. Pan, zoom, hit testing and label placement are ours, and unit-tested. Two defects were found by looking rather than reasoning: street labels were drawn once per segment and unreadable, and their angle was mirrored. The address never reaches storage, enforced by traps rather than by grep. 201 TypeScript tests at 99.5%, 252 pipeline tests at 94%. |
| 0.8.1 | 27 Aug 2026 | Building footprints as no-flow barriers, and the cross-check they turned into. Of the cells the published footprint dataset calls a building, the ground filter had independently removed **92.2%**; the reverse holds at only 51.9%, because about half of what the filter removes is tree canopy — which is the measured reason its object mask cannot serve as a barrier set, since water flows under trees. The footprints also repair the filter's one predicted blind spot: 20,311 roof cells it had kept as ground, concentrated more than 13 m inside a roof, exactly the reach of a 26 m window. A limit derived from theory, pinned by a synthetic test, then confirmed on real ground at the predicted threshold. `depressions.json` split into a table and a compressed label raster: 2 MB to 110 KB. Inverse projection added, round-tripping to 0.0007 mm. 155 tests, 96% coverage. |
| 0.8.0 | 27 Aug 2026 | Depressions, conditioning and D8 routing — the terrain fork the engine has been waiting on. Hollows are measured on the raw surface and directions come from a separate conditioned one, because filling removes exactly the storage the model needs. The 0.25 m depth floor is the source's own quoted accuracy and the knee in the volume curve at once: 537 hollows holding 30,593 m³, from 8,472 whose median depth is 5 cm of noise. The D8 code table is now a checked contract — the test parses `flow.ts` rather than restating the table, so a one-sided edit fails the build instead of routing water sideways in silence. Two whole-field invariants hold: no interior dead ends, and all 998,594 directed cells point strictly downhill, which makes a cycle impossible. The published surface is the one the depressions were measured on, so the manifest reproduces from the artefact exactly. 126 tests, 95% coverage. |
| 0.7.0 | 27 Aug 2026 | Ground-surface filtering, the critical path for Iteration 1. A LAS reader and an SMRF written against numpy and scipy, since PDAL will not install here. 6.6 M points over the Kensington square kilometre in 8.9 s; 54.1% of cells measured, the rest buildings, canopy and gaps. The filter window was measured rather than chosen — 26 m is where the marginal hectare stops finding buildings and starts shaving terrain. Two limits are pinned by tests rather than left to be discovered: a roof wider than the window keeps its middle, and the uphill edge of an extent is shaved. The output is never called a LiDAR DTM; the source is photogrammetric and the ground under canopy was not measured at all. 159 tests, 95% coverage. |
| 0.6.0 | 27 Aug 2026 | Data-sufficiency gate: the worker returns `SuccessfulComparison` or `InsufficientInformation` with one of four named reasons, applied in order. `No clear change` and `Insufficient information` are now different kinds of thing — a band within a comparison that succeeded, and a status saying whether there was one. A missing downstream connection travels as a network limitation rather than an insufficiency. AD7 reaffirmed and the three-view requirement withdrawn. 106 tests, 99% coverage. |
| 0.5.0 | 27 Aug 2026 | Acceptance criteria re-mapped to the revised criteria document: six broad criteria became twenty, restructured around interactions, with navigation and state-retention requirements that had no tasks before. Two consequences recorded rather than absorbed — `Insufficient information` is now required in two criteria and is not implemented, and AC 2.2.3 contradicts AD7 and needs a decision. |
| 0.4.0 | 27 Aug 2026 | Scenario engine: D8 routing, depression fill-and-spill, drain capture by blockage setting, and the comparison against an all-clear baseline. Every position solved independently from zero, so the answer at a given rainfall does not depend on how many positions the interface shows. 88 tests, 99% coverage, 1.7s. |
| 0.3.0 | 26 Aug 2026 | `packages/scenario`: synthetic terrain whose answer is known in advance — a planar slope with nowhere to collect, and a flat-bottomed bowl of exactly stated capacity — plus the mass-balance and monotonicity checks, each tested against results broken in one specific way. Written before the engine, so the engine is never blocked on the terrain pipeline. 56 tests, 100% coverage, 2.4s. |
| 0.2.0 | 26 Aug 2026 | Drainage graph builder and artefact: topology, inlet classification, narrowing indicator, cycle detection. Corrects the audit's traceable share from 79.8% to 70.4% — 1,622 pipes name a pit absent from the export. 48 tests, 100% on the judgement-carrying modules. Development guide added. |
| 0.1.0 | 26 Aug 2026 | Monorepo skeleton and `packages/schema`: provenance records with a non-optional basis, the blockage and visible-condition vocabularies held apart, scenario run provenance, and the wire payloads with a structural guard against sending a photograph, an address or a coordinate. 22 tests, 100% coverage. |
| — | 26 Aug 2026 | Initial Git setup. |

---

## Related documents

The System Architecture (v5), the Data Model (v1), the conceptual ERD and the machine-learning go/no-go assessment live in the team's project governance folder, not in this repository. The schema in `packages/schema` is the executable form of the data model; where the two disagree, the data model is authoritative and this repository has a bug.
