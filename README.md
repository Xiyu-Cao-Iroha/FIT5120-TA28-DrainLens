# DrainLens

Stormwater flood risk for residents of Greater Melbourne communities that flood repeatedly.

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
apps/web            frontend (React + TypeScript + Vite, MapLibre + deck.gl)      not yet started
apps/api            backend (Node + TypeScript + Hono on Cloud Run)               not yet started
pipeline            Python geospatial pipeline, never deployed — drainage graph done, terrain next
data                artefact releases — git-ignored, rebuilt locally
docs                iteration scope, acceptance criteria, development guide
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

| Gate | Target | Current |
|---|---|---|
| Coverage, judgement-carrying modules | ≥ 90% from the first iteration | 100% (`packages/schema`, `graph.py`, `classification.py`) |
| Coverage, overall | ≥ 88% | 100% Node · 99% Python |
| Suite runtime | < 5 s | ~1.0 s Node · ~0.5 s Python |
| Tests written before or alongside the component | every one | met |
| Merges via pull request with written review | 100% | — |
| CI green rate | ≥ 95% | — |
| Direct pushes to `main` | zero | — |

A test that would push the suite past five seconds belongs behind a separate script, not in this run.

---

## Version history

Maintained from the first commit, per KPI 2.2. Architecture and data-model documents carry their own version tables.

| Version | Date | Change |
|---|---|---|
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
