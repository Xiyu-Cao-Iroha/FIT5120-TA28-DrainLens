# Iteration 1 — work breakdown

DrainLens · TA28 · demonstration **Tuesday 1 September 2026**

What to do. Every task names the criterion it serves in [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md) — a task that serves none can be questioned.

**The critical path is W1.** Everything visually interesting in Epic 2 depends on a D8 flow-direction grid and depression tables that do not yet exist, and the offline pipeline is the only workstream with genuine uncertainty in it.

---

## Two moves that take out most of the risk

Both happen before any feature code is written.

**Run D2 today.** One 500 m tile, check whether the LAS files already carry a usable ground classification despite the metadata. If they do, ground classification leaves the plan and a day comes back. If they do not, we know on day zero rather than on Saturday.

**Freeze the artefact contract on Thursday and build against fixtures.** The scenario engine and the frontend must never wait for the pipeline. The synthetic terrain fixtures — a known bowl and a known planar slope — are written Thursday morning and double as the first validation check. The engine is then developed against terrain whose correct answer is known, and meets the real artefacts only when both exist. This is the difference between four workstreams in parallel and four in a queue.

---

## Owners

| # | Workstream | Suggested owner | Depends on |
|---|---|---|---|
| W1 | Offline pipeline | MDS ×2, MAI on terrain | Nothing — starts immediately |
| W2 | Scenario engine | MIT | Artefact contract, **not** the artefacts |
| W3 | Frontend | MCS + MIT | Artefact contract, fixture tiles |
| W4 | Deployment, CI, quality | MIT | First commit |
| W5 | Acceptance, demo, documentation | MBIS | Features as they land |

---

## W1 · Offline pipeline — *critical path*

- [ ] **D2 check** — one 500 m tile: does the LAS carry a usable ground classification? *(today; the answer changes Thursday)*
- [ ] Agree the demonstration address and a 1 km × 1 km build extent
- [x] **Drainage graph artefact** — clean self-loops, build the directed graph from `upstr_pit`/`dnstr_pit`, record cycles, derive the narrowing indicator and inlet classification → *1.2.a–d, 1.3.c*
- [ ] Address index — trimmed, prefix-searchable, ships with the site → *1.1.a, 1.1.e*
- [ ] Ground classification, if D2 says it is needed
- [ ] Bare-earth DTM for the build extent
- [ ] **Depressions characterised on the raw surface** → elevation–volume tables → *2.2.b*
- [ ] **Conditioning on a separate surface**, building footprints as no-flow barriers → D8 flow-direction grid → *1.1.b, 2.2.b*
- [ ] Pit and pipe geometry tiles → *1.1.b*
- [ ] **Data manifest** — per source: name, licence, capture date, modified date, coverage, record count, derivation → *1.1.d, 2.3.c, 2.3.d*
- [ ] **Assumption register** — capture fraction, window size, rainfall distribution, operator fallback, arrival-time exclusion → *2.3.d*

> **The fork order is a correctness requirement, not a preference.** Depression filling removes exactly the storage volumes the scenario model needs. Characterise depressions on the raw surface **first**, then produce a separate conditioned surface for routing. Reversing this produces a model that runs, looks plausible, and cannot compute ponding at all.

**Deliver the drainage graph first.** Done. It unblocks the trace feature entirely, and building it against the full dataset corrected the audit: 12,798 reachable edges and 12,131 fully resolved (70.4%, not the 79.8% recorded), with 18 back-edges across 34 nodes. The audit counted endpoint identifiers that were present; 1,622 pipes name a pit that is not in the export, and for traversal an unresolvable identifier is as useless as a missing one. See pipeline/README.md.

## W2 · Scenario engine

- [x] Synthetic terrain fixtures — a known bowl and a known planar slope *(written before the engine)*
- [x] Mass-balance check — input volume equals captured plus stored plus leaving the window, per position
- [x] Monotonicity check — ponding extent must not shrink as accumulated rainfall increases
- [ ] Web Worker skeleton, typed arrays, 500 m window
- [ ] Each position solved independently from zero, 6–10 positions → *Epic 2 DoD: same inputs, same result*
- [ ] Run once on **Run Scenario**, cache all positions; the slider reads cache only → *2.2.a, 2.2.d*
- [ ] Output as **difference from the all-clear baseline**, never absolute extent → *2.2.b, 2.2.c*
- [ ] Capture-fraction sensitivity at half, one and two times → decides three bands or two
- [ ] Bare-earth and barrier check — water is neither routed across rooftops nor through building interiors
- [ ] Insufficient-data path returns `insufficient-data`, never a strong band → *2.3.e*

## W3 · Frontend

- [ ] Vite + React + TypeScript + MapLibre shell, rendering fixture tiles
- [ ] Address search against the local index, no network request → *1.1.a, 1.1.e*
- [ ] Pit, pipe and terrain layers; toggles operate on visibility, not re-fetch → *1.1.b*
- [ ] Plain-English explanation of local water flow → *1.1.c*
- [ ] **Trace UI** — highlight, direction, termination reason, branch fan-out shown as multiple paths → *1.2.a–d*
- [ ] Hand-authored SVG street cross-section, depth only where supported → *1.3.a–d*
- [ ] Scenario setup — pit selection, three blockage settings, rainfall entry with worked reference points, settings summary before running → *2.1.a–d*
- [ ] Storm-progress slider in millimetres, reading cache → *2.2.a*
- [ ] Comparison layer with the two or three agreed bands → *2.2.c*
- [ ] Indicative-comparison and arrival-time wording shown with the result, not buried → *2.2.e*
- [ ] Result explanation panel → *2.3.a, 2.3.b*
- [ ] **Provenance display** — official data, system estimates and user settings visually separated, driven by the basis carried with each value → *2.3.c, 2.3.d*
- [ ] Desktop and mobile layouts → *Epic 1 DoD*

## W4 · Deployment, CI and quality

- [ ] Branch protection on `main` and `develop`, zero direct pushes
- [x] CI: `npm ci` then `npm run check` on every pull request
- [ ] Artefact contract published in `packages/schema` and frozen after Thursday
- [ ] Cloud Storage + Cloud CDN for artefacts; confirm range requests pass through (PMTiles depends on them)
- [ ] Cloud Run service behind the load balancer; one URL map, one origin
- [ ] **Log exclusion filter covering both** load balancer and Cloud Run request logs
- [ ] Record p95 latency and external-fetch failure rate **before and after** every deployment
- [ ] Probe every external dependency **from the deployment host, not a laptop**
- [ ] Confirm each required cloud API is enabled **individually**, not inferred from a sibling working

## W5 · Acceptance, demo and documentation

- [ ] Acceptance checklist in use from Friday
- [ ] Desk check 1 — render path and traversal service *(Friday)*
- [ ] Desk check 2 — full flow *(Monday)*
- [ ] Manual click-through of the primary flow in a real browser, desktop and mobile *(Monday evening, Tuesday morning)*
- [ ] Demo script written, timed, rehearsed with every speaker
- [ ] Schema, architecture and integration points published to the governance portfolio with the version-history table

---

## Day by day

| Day | Focus | Gate at end of day |
|---|---|---|
| **Wed 26** *(half day)* | D2 check · branch protection and CI · agree demo address and extent | **The D2 result.** Branch A: classification present. Branch B: we classify, and Thursday's terrain work doubles |
| **Thu 27** | Contracts and fixtures. Drainage graph shipped. Synthetic fixtures and checks written before the engine. Map shell rendering fixtures | **Artefact contract frozen.** Changing it after tonight costs three workstreams, not one |
| **Fri 28** | The two features that need no terrain: **US1.2 complete**, US1.1 partial. Terrain: bare-earth DTM. Desk check 1 | **US1.2 demonstrable on fixture data.** If not, the descope ladder starts Saturday, not Sunday |
| **Sat 29** | **D8 grid and depression tables.** Engine against real artefacts. Cross-section. Scenario setup UI | **Go/no-go.** No grid and tables tonight → take rung 3 immediately and rebuild at 500 m. Do not spend Sunday hoping |
| **Sun 30** | **US2.2 end to end** and US2.3. Manifest and assumption register. First deployment, with p95 and failure rate recorded before and after | Golden path runs on the deployed build |
| **Mon 31** | **Feature freeze at midday**, defects only after. External probes from the deployment host. Desk check 2. Demo rehearsed | **If the golden path does not run on the deployed site tonight, tomorrow demonstrates the Friday build.** Decide tonight, not in the morning |
| **Tue 1 Sep** | One final click-through, then demonstrate. Nothing is merged today | — |

---

## Descope ladder

Take in order, and take early. Each is already permitted by the acceptance criteria.

| Rung | Give up | Why it is safe |
|---|---|---|
| 1 | **Epic 3 entirely** | Already out of this iteration |
| 2 | **Pipe depth in the cross-section** | AC 1.3 already says show only what the data supports |
| 3 | **Shrink the terrain extent to 500 m** around the demo address | The pilot area is a coverage statement, not a demo requirement. A smaller extent computes in minutes rather than hours |
| 4 | **Two comparison bands instead of three** | The capture-fraction sensitivity result may force this anyway |
| 5 | **The low-lying-areas layer in 1.1.b** | Omit it and label it unavailable — AC 1.1.d covers that, and inventing it satisfies nothing |

**Not on the ladder: AC 2.2.** The comparison against a clear-drain baseline is the product. If it cannot be built, the iteration has not met its Must Haves, and that should be said plainly rather than disguised.

---

## Gates

Carried from the Week 4 KPI commitments. Scheduled, not appended.

| Gate | When | Status |
|---|---|---|
| Tests written before or alongside every judgement-carrying component | Continuous | — |
| ≥90% coverage on judgement-carrying modules, ≥88% overall, suite under 5 s | Every pull request | enforced in `vitest.config.ts` |
| `npm ci`, never `npm install`, before every push | CI | — |
| 100% of merges via pull request with written technical feedback | Continuous | — |
| ≥2 structured desk checks | Friday, Monday | — |
| ≥8 hours cross-discipline pair programming | Friday (pipeline + engine), Sunday (engine + frontend) | — |
| Critical defects triaged within 24 h, resolved within the iteration | Continuous; Monday afternoon reserved | — |
| External dependencies probed from the deployment host | Monday | — |
| p95 latency and external-fetch failure rate recorded before and after deployment | Sunday onward | — |
| Manual click-through in a real browser before the demo | Monday, Tuesday | — |

---

## Honest assessment

Six days is tight but not unreasonable **if** Thursday goes on contracts and fixtures rather than features. The failure mode is not running out of time on the frontend — it is the terrain pipeline slipping to Sunday and taking the scenario engine down with it, at which point there is nothing to demonstrate but a map.

The two guards against that are the D2 check today and the Saturday-evening go/no-go. Both are cheap. Neither works if it is skipped.
