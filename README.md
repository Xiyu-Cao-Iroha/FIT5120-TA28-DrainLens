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

---

## Layout

```
packages/schema     shared definitions — provenance, vocabularies, scenario, wire payloads
apps/web            frontend (React + TypeScript + Vite, MapLibre + deck.gl)      not yet started
apps/api            backend (Node + TypeScript + Hono on Cloud Run)               not yet started
pipeline            Python geospatial pipeline and model training, never deployed not yet started
data                versioned artefact releases and the data manifest             not yet started
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

These are the numbers the team committed to in its Week 4 KPI assessment. They are enforced in `vitest.config.ts`, not just written down.

| Gate | Target | Current |
|---|---|---|
| Coverage, judgement-carrying modules | ≥ 90% from the first iteration | 100% (`packages/schema`) |
| Coverage, overall | ≥ 88% | 100% |
| Suite runtime | < 5 s | ~1.0 s |
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
| 0.2.0 | 26 Aug 2026 | Drainage graph builder and artefact: topology, inlet classification, narrowing indicator, cycle detection. Corrects the audit's traceable share from 79.8% to 70.4% — 1,622 pipes name a pit absent from the export. 48 tests, 100% on the judgement-carrying modules. Development guide added. |
| 0.1.0 | 26 Aug 2026 | Monorepo skeleton and `packages/schema`: provenance records with a non-optional basis, the blockage and visible-condition vocabularies held apart, scenario run provenance, and the wire payloads with a structural guard against sending a photograph, an address or a coordinate. 22 tests, 100% coverage. |
| — | 26 Aug 2026 | Initial Git setup. |

---

## Related documents

The System Architecture (v5), the Data Model (v1), the conceptual ERD and the machine-learning go/no-go assessment live in the team's project governance folder, not in this repository. The schema in `packages/schema` is the executable form of the data model; where the two disagree, the data model is authoritative and this repository has a bug.
