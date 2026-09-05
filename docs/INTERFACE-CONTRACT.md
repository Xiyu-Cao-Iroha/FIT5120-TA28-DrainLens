# Interface contract — frontend and backend

DrainLens · TA28 · **current as of 30 August 2026**

What the browser sends, what the server answers, and what may never cross between them.

Read the last section first if you are short of time. Most of this document describes a boundary that is deliberately almost empty, and the reason it is empty is the part that matters.

---

## The shape of the system, in one paragraph

**Almost nothing goes to a server.** The map, the terrain, the drainage network and the address index are static files built offline and served as-is. The scenario engine runs in a Web Worker in the browser. The address search runs against an index that ships with the site. A resident can use the entire product — search an address, follow the drainage, run a blockage comparison, read the result — **without a single request that says anything about them**.

That is not an optimisation. It is AD1: the product has no accounts and no identity, and the cheapest way to keep a promise about data is to never receive it.

---

## What the frontend loads today

All of it static, all of it `GET`, none of it carrying a query about the person.

| Path | Size | Built by | Contents |
|---|---:|---|---|
| `/data/map.json` | 318 KB | `drainlens_pipeline.network` | Roads, pipes, pits, street labels |
| `/data/derived.json` | 183 KB | `drainlens_pipeline.derived` | Surface-water paths, low points, unavailable areas |
| `/data/trace.json` | 37 KB | `drainlens_pipeline.trace` | Downstream links, with a reason at every path end |
| `/data/addresses.json` | 678 KB | `drainlens_pipeline.addresses` | The address index **and the pilot boundary** |
| `/data/flood-history.json` | 5 KB | `drainlens_pipeline.flood_history` | Recorded flood incidents by named area, and what a count is |
| `/data/scene/scene.json` | 92 KB | `drainlens_pipeline.scene` | Grid header, depression table, drains |
| `/data/scene/*.bin` | 1.28 MB gzipped | `drainlens_pipeline.scene` | Elevation, flow, depressions, rim depth, coverage, measured |

**Coordinates in every artefact are metres east and north of the extent's south-west corner**, to a decimetre. Not latitude and longitude. The projection was done at build time, so no projection runs in the browser and there is no second place for the map and the model to disagree about where a pit is.

### What the backend must do about these

Serve them, gzipped, with a cache policy that lets a version be replaced. Nothing else. There is no endpoint behind them and no request to authorise.

> **Revisited 5 September 2026.** A database is planned for Iteration 2 and the artefacts below will be assembled from it — in the same shapes, so the frontend and its assertions do not change. What follows stays true of derivation: the pipeline computes, the database stores. See [DATABASE-DESIGN.md](./DATABASE-DESIGN.md).

They are **versioned build products**, not a database. When the extent changes, the pipeline is re-run and the files are replaced wholesale. A backend that tried to assemble these per request would be rebuilding a pipeline that already exists and can be checked offline.

---

## What the frontend sends — the whole list

Two payloads, both defined in [`packages/schema/src/wire.ts`](../packages/schema/src/wire.ts), which is the single authority. **If it is not in that file, the browser does not send it.**

### 1 · A drain check (Epic 4, not yet built)

```
POST /api/drain-checks
```

```ts
interface DrainCheckSubmission {
  assetNumber: string;        // the pit's published identifier
  visibleCondition: VisibleCondition;
  debrisType: DebrisType | null;
  checkedAt: string;          // ISO 8601
  wasModelProposed: boolean;  // did the on-device model suggest this category?
}
```

Exactly these five keys. `DRAIN_CHECK_KEYS` in the schema names them and a test asserts the set, so **adding a sixth fails the build rather than shipping**.

**There is no photograph in this payload and there will not be one.** AD10 puts the classification on the device: the photo is examined in the browser, a category comes out, the resident confirms or changes it, and the photo is discarded. `wasModelProposed` exists so the backend can tell a resident's own judgement from a model's suggestion the resident merely accepted — which matters when anyone later asks how much of this dataset is machine-generated.

**Backend must:** accept the five keys, reject anything else, store no request metadata that would re-identify the submitter (see the forbidden list below), and record `wasModelProposed` rather than dropping it as an implementation detail.

### 2 · A cached rainfall observation (AD12, conditional — see the caveat)

```
GET /api/rainfall/{stationId}
```

```ts
interface RainfallObservationRequest { stationId: string; }

interface RainfallObservationResponse {
  stationId: string;
  stationName: string;
  observedFrom: string;      // ISO 8601
  observedTo: string;
  rainfallMm: number;
  upstreamUpdatedAt: string; // when the publisher last changed it
  fetchedAt: string;         // when we last read it
}
```

**By station identifier only.** The browser resolves the nearest station against a shipped index, so no endpoint ever receives a coordinate. That is the whole design: "which station is nearest to me" is a question answered on the device, and only its answer travels.

Both timestamps are required in the response. `upstreamUpdatedAt` and `fetchedAt` are different facts, and an interface that cannot distinguish "the Bureau published this an hour ago" from "we read it an hour ago" cannot label the value honestly.

> ⚠️ **This endpoint is conditional and must not be built as though it were agreed.** Live rainfall depends on a Bureau of Meteorology authorisation that is an **unresolved external dependency**. It is a *Could Have*. The MVP takes rainfall as a user-entered comparison amount, and nothing in the product may present a modelled or gridded figure as an official observation. Build it when the permission exists, not before.

---

## What may never cross, in either direction

`FORBIDDEN_WIRE_KEYS` in the schema. `assertSendable()` checks any payload structurally before it is sent — cheap enough to call on every submission, and it catches what the type system cannot: an object widened to `unknown` somewhere between a form and a `fetch`.

> **It is called by nothing today, and that is correct.** Nothing is sent: every outbound call in `apps/web` is a `GET` of a static artefact with no body and no query. The guard is here for the submission Epic 4 will add. Wiring it now would mean inventing a payload to guard.

```
photo          photograph     image          imageData
address        streetAddress
lat            lon            latitude       longitude
coordinates    geom
email          userId         sessionId      ipAddress
```

**This binds the backend as much as the frontend.** A response carrying any of these is as much a breach as a request carrying them, and so is a server log. Two specific consequences:

- **Do not log request bodies or IP addresses** for these endpoints. A log line is storage, and an address in a log is an address we said we would not keep. The deployment task list already carries a log exclusion filter for this reason, and [DEPLOYMENT-BASELINE.md](./DEPLOYMENT-BASELINE.md) records that it must be configured **before the first request** — a filter added afterwards cannot unwrite the lines already stored.
- **Do not add a session cookie.** There is no session. A cookie would create the identity the product spent its architecture avoiding.

---

## What runs in the browser and must not move to a server

Listed because each looks like a natural thing to move, and each would break something specific.

**The address search.** The index ships with the site and the search runs in memory. A search box that calls a server sends every keystroke of somebody's home address to it. A test traps `fetch` and asserts the search never reaches for it.

**The downstream trace.** `trace/graph.ts` walks the shipped artefact in memory. It is a graph traversal over 895 pits; a round trip to ask a server which pipe comes next would be slower than the answer and would tell that server which drain outside somebody's house they are looking at.

**What crosses the worker boundary.** The engine produces a band for each of the 1,000,000 cells; the worker replies with a summary band, a count, and the **cells that differ** — 652 for the demonstration pit, so a few kilobytes rather than a few megabytes, capped at 60,000 so a future artefact whose hollows connect cannot post an unbounded message. They cross **already converted to local metres**, on the side the grid lives on. That is not a style preference: the one time this repository carried a cell index across a boundary and rebuilt the coordinate on the other side, all 895 drains disagreed with the scene and every comparison returned `invalid_inlet`. None of this is a network request — it is a `postMessage` inside the tab, so it carries no address, no identity and nothing that could reach a server.

**The scenario engine.** `@drainlens/scenario` runs in a Web Worker over the shipped scene. Moving it server-side would mean sending the selected pit and rainfall — survivable — but the reason to keep it local is that the answer must be reproducible from artefacts anyone can check, and a service that could quietly change its assumptions between two runs breaks AC 2.2.

**The photo classification.** AD10. The photograph never leaves the device.

**All navigation state.** Address, chosen task and scenario inputs live in one object for the life of the tab: not `localStorage`, not `sessionStorage`, not the URL, not `history.state`. Enforced by a test that stubs traps in place of both storages, `history` and `document.cookie` and plays a whole session.

---

## Shared vocabulary

Both sides import these from `@drainlens/schema`. **Do not restate them as string literals** — the schema is the definition and a second copy is a second thing to forget to update.

| Set | Values |
|---|---|
| `BLOCKAGE_SETTINGS` | `clear`, `partly-blocked`, `fully-blocked` |
| `VISIBLE_CONDITIONS` | four values — what a photograph can show |
| `DEBRIS_TYPES` | `leaf-litter`, `rubbish`, `sediment`, `other` |
| `COMPARISON_BANDS` | `no-clear-change`, `higher-than-baseline` |
| `RESULT_STATUSES` | `successful`, `insufficient-information` |
| `INSUFFICIENCY_REASONS` | `terrain_unavailable`, `invalid_inlet`, `scenario_calculation_failed`, `comparison_not_comparable` |
| `NETWORK_LIMITATIONS` | limitations found in the recorded network |

Three distinctions in that table are load-bearing:

**A blockage setting is not a visible condition.** `VISIBLE_CONDITIONS` describes what a photograph shows; `BLOCKAGE_SETTINGS` is an assumption a person chooses for a scenario. There is deliberately **no function anywhere that converts one to the other**, and a test asserts none appears. A photo of a leaf-covered grate is not a licence to set that pit to "fully blocked" in somebody's comparison.

**`no-clear-change` is not `insufficient-information`.** The first means the calculation ran and found no difference. The second means it could not be made. A resident acting on the first is being reasonable; a resident acting on the second, believing it was the first, is acting on nothing. They are different types in the outcome union for exactly this reason.

**A network limitation never becomes an insufficiency.** Where a pipe leads has no bearing on the surface calculation, so a missing downstream connection travels alongside a successful result rather than replacing it.

---

## Provenance, and why the backend has to carry it

Every value the interface displays carries a **basis** — `packages/schema/src/provenance.ts`. Four of them:

| Basis | Meaning |
|---|---|
| `sourceProvided` | Published source values used as provided |
| `derived` | Calculated from recorded data by documented processing |
| `assumed` | A model value where no record exists — the capture fraction, for one |
| `inferred` | An indicative relationship read from available records |

The basis is **not optional and not a label bolted on at render time**. It travels inside the record: `{ value, unit, label, basis }`. Anything the backend returns for display must carry one, because a value that cannot say where it came from cannot go on screen — `assertUsable` and `assertDerived` in the frontend already refuse artefacts that name no source, and `assertFloodHistory` goes further: it refuses one that names no reporting period, no geographic unit, or no sentence saying what a count is. A ranking of suburbs with nothing qualifying it is the one shape that page must never take, so a missing *sentence* fails the load exactly as a missing number does.

For drain checks specifically: a stored check is `sourceProvided` when a resident confirmed it, and the `wasModelProposed` flag is what lets a later reader tell how much of the dataset began as a machine's suggestion.

---

## What the backend does not exist for yet

`apps/api` is not started, and the honest position is that the product currently needs it for **one** thing: receiving drain checks, which is Epic 4 and not in Iteration 1.

Two things that might look like backend work and are not:

- **Serving artefacts** is static hosting behind a CDN, not an application.
- **The rainfall endpoint** is conditional on a permission that does not exist.

If a backend is stood up for Iteration 1, its job is to serve files and to have a health check. Building endpoints against a contract nobody is calling yet is how a system acquires surface area it then has to defend.

---

## Where to look when this document is wrong

This file describes intent. These describe what is actually true, and win any disagreement:

| Question | Authority |
|---|---|
| What may be sent? | [`packages/schema/src/wire.ts`](../packages/schema/src/wire.ts) |
| What is a valid value? | [`packages/schema/src/vocabulary.ts`](../packages/schema/src/vocabulary.ts) |
| What does a basis mean? | [`packages/schema/src/provenance.ts`](../packages/schema/src/provenance.ts) |
| What does an artefact contain? | The `note` and `source` fields inside the artefact itself |
| Which criterion does this serve? | [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md) |
