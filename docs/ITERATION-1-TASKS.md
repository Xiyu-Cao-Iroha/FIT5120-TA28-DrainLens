# Iteration 1 — work breakdown

DrainLens · TA28 · demonstration **Tuesday 1 September 2026**

What to do. Every task names the criterion it serves in [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md) — a task that serves none can be questioned.

**Re-mapped 27 August** against the revised criteria document, which replaced six broad criteria with twenty and added navigation and state-retention requirements that had no tasks before.

**The critical path is W1.** Everything visually interesting in Epic 2 depends on a D8 flow-direction grid and depression tables that do not yet exist, and the offline pipeline is the only workstream with genuine uncertainty in it.

---

## Blocked, needs a decision

**AC 2.2.3 — three comparison views — contradicts AD7.** The architecture forbids a standalone ponding layer because the capture fraction is an assumed value; the All clear and Blockage views are exactly that. The engine returns only the difference today.

A middle path, if the views are wanted: allow all three, but give the two absolute views **no numeric scale of any kind** — relative distribution only, under a heading naming it an indicative distribution under an assumed condition.

**Owner: product owner with the architecture owner.** It blocks the view switcher and nothing else, so nobody should wait on it.

---

## Two moves that take out most of the risk

Both happen before any feature code is written.

**Run D2.** One 500 m tile, check whether the LAS files already carry a usable ground classification despite the metadata. If they do, ground classification leaves the plan and a day comes back. If they do not, we know now rather than on Saturday. **Still not done, and it is the first thing to do each morning until it is.**

**Build against fixtures.** The scenario engine and the frontend never wait for the pipeline. The synthetic fixtures — a known bowl and a known planar slope — double as the first validation check, so the engine was developed against terrain whose correct answer was known in advance and met the real artefacts only when both existed. **Done; it worked.**

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

- [ ] **D2 check** — one 500 m tile: does the LAS carry a usable ground classification?
- [ ] Agree the demonstration address and a 1 km × 1 km build extent
- [x] **Drainage graph artefact** — self-loops excluded, directed graph from `upstr_pit`/`dnstr_pit`, cycles recorded, narrowing indicator, inlet classification → *1.2.1, 1.2.2, 1.3.1.c*
- [ ] Address index — trimmed, prefix-searchable, ships with the site → *1.1.1, 1.1.4, 1.1.6*
- [ ] **Pilot-area boundary** the address index can test against, so an unsupported address is recognised rather than guessed → *1.1.4*
- [ ] Ground classification, if D2 says it is needed
- [ ] Bare-earth DTM for the build extent
- [ ] **Depressions characterised on the raw surface** → elevation–volume tables → *2.2.1*
- [ ] **Conditioning on a separate surface**, building footprints as no-flow barriers → D8 flow-direction grid → *1.1.2.b, 2.2.1*
- [ ] Pit and pipe geometry tiles → *1.1.2.b, 1.1.3.b*
- [ ] **Coverage mask** — which cells the terrain artefacts actually cover, so the engine can tell "no clear change" from "we have nothing here" → *2.2.1.f, 2.3.2*
- [ ] **Data manifest** — per source: name, licence, capture date, modified date, coverage, record count, derivation → *1.1.3.d, 1.2.1.c, 2.3.1.c*
- [ ] **Assumption register** — capture fraction, window size, rainfall distribution, operator fallback, arrival-time exclusion → *2.3.1.d*

> **The fork order is a correctness requirement, not a preference.** Depression filling removes exactly the storage volumes the scenario model needs. Characterise depressions on the raw surface **first**, then produce a separate conditioned surface for routing. Reversing this produces a model that runs, looks plausible, and cannot compute ponding at all.

**The drainage graph is delivered.** Building it against the full dataset corrected the audit: 12,798 reachable edges and 12,131 fully resolved (70.4%, not the 79.8% recorded), with 18 back-edges across 34 nodes. The audit counted endpoint identifiers that were present; 1,622 pipes name a pit that is not in the export, and for traversal an unresolvable identifier is as useless as a missing one. See `pipeline/README.md`.

## W2 · Scenario engine

- [x] Synthetic terrain fixtures — a known bowl and a known planar slope *(written before the engine)*
- [x] Mass-balance check — input equals captured plus stored plus leaving the window, per position
- [x] Monotonicity check — ponding must not shrink as accumulated rainfall increases
- [x] D8 routing, depression fill-and-spill, drain capture by blockage setting
- [x] Each position solved independently from zero → *2.2.2*
- [x] Output as **difference from the all-clear baseline** → *2.2.1.a, 2.2.1.b, 2.2.1.e*
- [x] The blockage setting is constant for the whole scenario, and tests hold that line → *2.1.2.d*
- [ ] **Insufficient information on data availability** — no coverage over the window, or a pit with no usable record → *2.2.1.f, 2.3.2.c*
- [ ] Web Worker wrapper; run once on **Run comparison**, cache all positions; the control reads cache only → *2.2.1, 2.2.2*
- [ ] Capture-fraction sensitivity at half, one and two times → decides whether the interface may report three result categories or two
- [ ] **Insufficient information on result robustness** — threshold set from the sensitivity result, not before it → *2.2.1.f*
- [ ] Bare-earth and barrier check — water is neither routed across rooftops nor through building interiors
- [ ] *(Blocked)* Absolute All clear and Blockage views → *2.2.3* — see the decision above

## W3 · Frontend

### Address and navigation — mostly new since the criteria were revised

- [ ] Vite + React + TypeScript + MapLibre shell, rendering fixture tiles
- [ ] Address search against the local index, no network request → *1.1.1.a, 1.1.1.d, 1.1.1.e*
- [ ] **Task-selection page** with the three named options → *1.1.1.b, 1.1.1.c*
- [ ] **Unsupported-address path** — explain, do not fabricate, allow another address → *1.1.4*
- [ ] **Session state**: address retained for the session and across task changes; "Choose another task" and "Change address" both preserve it → *1.1.1.e, 1.1.5, 1.1.6*

### Map and drainage

- [ ] Follow-local-water view: surface-water paths and pits **by default**, one next-step instruction, other layers in a **collapsed** section → *1.1.2*
- [ ] Full-map view: layer controls, individual toggles, recorded versus derived distinguished → *1.1.3*
- [ ] **Pit detail panel** — recorded information, labelled as official recorded data, with the follow-downstream action → *1.2.1*
- [ ] **Trace UI** — highlight, direction, termination reason, branch fan-out shown as multiple paths, gaps shown as gaps → *1.2.2*
- [ ] Hand-authored SVG street cross-section, depth only where supported, no capacity claim → *1.3.1*
- [ ] **Cross-section unavailable state** — say which information is missing rather than filling it → *1.3.2*

### Scenario

- [ ] Scenario setup in the required order, pit carried over only if the user chose it, suggestions labelled and unconfirmed, blockage **unselected** by default → *2.1.1*
- [ ] Setup inputs with the two required explanations — **the blockage setting is an assumption, not an observed condition**, and **the rainfall is a user-selected assumption, not an observation or forecast** → *2.1.2.d, 2.1.2.e*
- [ ] Scenario summary before running → *2.1.2.f*
- [ ] Difference view by default; pit and downstream path stay visible → *2.2.1.c, 2.2.1.d*
- [ ] Result categories: No clear change · Higher than baseline · **Insufficient information** → *2.2.1.e, 2.2.1.f*
- [ ] Rainfall control in millimetres, with the "not when water will reach a location" wording → *2.2.2*
- [ ] **Back and rerun paths** — back to setup, change scenario, contextual back from setup, all retaining state → *2.1.3, 2.2.4, 2.2.5*
- [ ] Result explanation panel → *2.3.1.a, 2.3.1.b, 2.3.1.f*
- [ ] **Provenance display** — recorded data, system-derived results and user assumptions visually separated, driven by the basis carried with each value → *1.1.3.d, 1.2.1.c, 2.3.1.c*
- [ ] Assumptions and uncertainty surfaced from the assumption register → *2.3.1.d, 2.3.1.e*
- [ ] Unclear-result explanation → *2.3.2*
- [ ] Desktop and mobile layouts → *Epic 1 DoD*

## W4 · Deployment, CI and quality

- [x] Branch protection on `main` and `develop`, zero direct pushes — **tested by attempting one; it was rejected**
- [x] CI: `npm ci` then `npm run check` on every pull request, plus the Python suite
- [x] Artefact contract published in `packages/schema`
- [ ] Required approvals raised from 0 to 1 once collaborators are added
- [ ] Cloud Storage + Cloud CDN for artefacts; confirm range requests pass through (PMTiles depends on them)
- [ ] Cloud Run behind the load balancer; one URL map, one origin
- [ ] **Log exclusion filter covering both** load balancer and Cloud Run request logs
- [ ] Record p95 latency and external-fetch failure rate **before and after** every deployment
- [ ] Probe every external dependency **from the deployment host, not a laptop**
- [ ] Confirm each required cloud API is enabled **individually**, not inferred from a sibling working

## W5 · Acceptance, demo and documentation

- [ ] Acceptance checklist in use — twenty criteria now, not six
- [ ] Desk check 1 — render path and traversal service
- [ ] Desk check 2 — full flow
- [ ] Manual click-through in a real browser, desktop and mobile
- [ ] Demo script written, timed, rehearsed with every speaker
- [ ] Schema, architecture and integration points published to the governance portfolio with the version-history table

---

## Day by day

| Day | Focus | Gate at end of day |
|---|---|---|
| **Wed 26** | Repository, schema, drainage graph, CI, branch protection | Done |
| **Thu 27** | **D2 check.** Address index and pilot boundary. Map shell on fixtures. Insufficient-information on data availability | **The D2 result**, and the artefact contract frozen |
| **Fri 28** | **US1.2 complete**, US1.1 navigation and task selection. Terrain: bare-earth DTM. Desk check 1 | **US1.2 demonstrable on fixture data.** If not, the descope ladder starts Saturday |
| **Sat 29** | **D8 grid and depression tables.** Engine on real artefacts. Cross-section. Scenario setup | **Go/no-go.** No grid and tables tonight → take rung 3 and rebuild at 500 m. Do not spend Sunday hoping |
| **Sun 30** | **AC 2.2 and 2.3 end to end.** Manifest and assumption register. First deployment, p95 recorded before and after | Golden path runs on the deployed build |
| **Mon 31** | **Feature freeze at midday**, defects only. External probes from the deployment host. Desk check 2. Demo rehearsed | **If the golden path does not run on the deployed site tonight, tomorrow demonstrates the Friday build.** Decide tonight |
| **Tue 1 Sep** | One final click-through, then demonstrate. Nothing is merged today | — |

---

## Descope ladder

Take in order, and take early. Each is already permitted by the criteria.

| Rung | Give up | Why it is safe |
|---|---|---|
| 1 | **Epic 3 entirely** | Iteration 2 |
| 2 | **The full-map view (AC 1.1.3)** | AC 1.1.2 already delivers a map with the layers that matter; 1.1.3 is the power-user path |
| 3 | **Pipe depth in the cross-section** | AC 1.3.1.b already says show only what the data supports |
| 4 | **Shrink the terrain extent to 500 m** around the demo address | The pilot area is a coverage statement, not a demo requirement |
| 5 | **Two result categories instead of three** | The sensitivity result may force this anyway |
| 6 | **The three-view switcher (AC 2.2.3)** | Already blocked on a decision, and AC 2.2.1.c makes Difference the default view regardless |

**Not on the ladder: AC 2.2.1.** The comparison against a clear-drain baseline is the product. If it cannot be built, the iteration has not met its Must Haves, and that should be said plainly.

---

## Gates

| Gate | When | Status |
|---|---|---|
| Tests written before or alongside every judgement-carrying component | Continuous | holding |
| ≥90% coverage on judgement-carrying modules, ≥88% overall, suite under 5 s | Every pull request | 99% Node · 99% Python · 1.7 s |
| `npm ci`, never `npm install`, before every push | CI | enforced |
| 100% of merges via pull request with written technical feedback | Continuous | enforced by ruleset |
| Zero direct pushes to `main` | Continuous | enforced and tested |
| ≥2 structured desk checks | Friday, Monday | — |
| ≥8 hours cross-discipline pair programming | Friday, Sunday | — |
| Critical defects triaged within 24 h, resolved within the iteration | Continuous | — |
| External dependencies probed from the deployment host | Monday | — |
| p95 latency and external-fetch failure rate recorded before and after deployment | Sunday onward | — |
| Manual click-through in a real browser before the demo | Monday, Tuesday | — |

---

## Honest assessment

The revision added roughly a third more frontend work — a task-selection page, an unsupported-address path, five navigation and state-retention criteria, a pit detail panel, and an unavailable state for the cross-section. None of it is hard; all of it is real, and none of it had a task before 27 August.

The failure mode has not changed. It is not running out of time on the frontend — it is the terrain pipeline slipping to Sunday and taking the scenario engine down with it, at which point there is nothing to demonstrate but a map. The two guards are the D2 check and the Saturday-evening go/no-go. Both are cheap. **D2 is still not done.**
