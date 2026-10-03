# Iteration 3 — work breakdown

DrainLens · TA28 · demonstration **date to be confirmed**

What to do. Every task names the criterion it serves in [ITERATION-3-ACCEPTANCE.md](./ITERATION-3-ACCEPTANCE.md) — a task that serves none can be questioned.

---

## Where Iteration 3 starts from

Iteration 2 was frozen on 28 September at `0ff2b82`, tagged `iteration-2-frozen`, and is serving at the live URL and at `drainlens-iteration2`. **`main` now holds Iteration 2 and does not move until Iteration 3 is finished.** Everything below happens on `develop` and reaches `drainlens-dev`.

Delivered in Iteration 2 and relied on here:

- The council map from the API — 21,113 pits, 17,242 pipes — with the bundled Kensington square as the fallback.
- Ground height, low areas, water paths and **91 pooling-warning markers** council-wide, each with its own pipeline rules.
- The blocked-drain comparison, four guides, the flood history map, and *About the data*.
- Session-only address handling: the address reaches no storage, no URL and no server.

**The critical path is data again, and this time most of it is already in hand.** The subcatchment boundaries arrived on 29 September and match every address but one; the pipe operator field exists at the source and only needs keeping. What is not in hand is the official guidance content — the channels, phone numbers and advice Epic 5 and Epic 6 must cite — and that cannot be written by code.

---

## Where it stands, 3 October 2026

All of the Must Have build work is done. What is left is content the team signs off and the quality work around it, and the two of those are not the same kind of task: the first is a decision, the second is an afternoon.

| Block | State |
|---|---|
| **W1 · Data** | **Done.** W1.1 to W1.7. 35 subcatchments published, 62,396 of 62,397 addresses matched to exactly one, pipe length clipped at the boundary, the operator field carried through to the API, and two new checks in CI. |
| **W2 · Epic 6 screens** | **Done.** W2.1 to W2.6 landed as the drainage-area guide; W2.7 and W2.8, the reporting pathway and its emergency branch, on 3 October. |
| **W3 · Epic 5 screens** | **Done.** W3.1 to W3.8, including the printed plan (W3.7) and the safety boundary block (W3.8). |
| **W4 · Content the team writes** | **Done, 4 October.** All three registers approved by Xiyu Cao: W4.1 [PREPARATION-RULES-REGISTER.md](./PREPARATION-RULES-REGISTER.md), W4.2 and W4.3 [GUIDANCE-CONTENT-REGISTER.md](./GUIDANCE-CONTENT-REGISTER.md), W4.4 [SUBCATCHMENT-CLASSIFICATION.md](./SUBCATCHMENT-CLASSIFICATION.md) — all 35 rows in one sitting. The published artefact now carries 26 main drains, 5 waterway sections, 3 council-direct and 1 unclassified, so an address reads what receives its water instead of *has not been confirmed*. One question is left open on purpose: whether to keep looking for a source for the design's fourth preparation action. |
| **W5 · Quality and operations** | **Partly done.** W5.1 (this checklist, extended), W5.2 (checks in CI), W5.3 (the privacy pass, re-run on 3 October) and W5.6 (both operational jobs settled on 4 October) are done. W5.4 accessibility and W5.5 the carried-over copy audit are not. |

> **The three registers were the only thing between this iteration and its definition of done, and they were approved on 4 October.** What is left is W5.4 accessibility and W5.5 the carried-over copy audit — both of them work, not decisions.

---

## Decisions taken before the work, 29 September

| | Decision |
|---|---|
| Search distance | 200 m, the product's existing meaning of "near" |
| Count limit | three places |
| Numbering | nearest first, said in words to be distance and not risk |
| Order of work | data first, then Epic 6's screens, then Epic 5's |
| Epic 7 | not started until every Epic 5 and 6 criterion is met |

The measurements behind the first three are in the acceptance file.

---

## W1 · Data — *critical path*

| | Task | Serves |
|---|---|---|
| W1.1 | A `subcatchments.py` pipeline module: read the Melbourne Water GeoJSON (EPSG:28355, 3,409 features), clip to the extent, keep `SUB_CATCHMENT_NBR`, `SUB_CATCHMENT_NAME`, `MAJOR_CATCHMENT_NAME`, `PRIMARY_CATCHMENT_NAME`, `RIVER_BASIN_CATCHMENT_NAME`, `AREA_SQ_KM`, `DATE_LAST_UPDATED`, publish boundaries in local metres | 6.1.1, 6.1.4 |
| W1.2 | Point-in-polygon for every address, published as a lookup rather than computed in the browser; the one unmatched address stays unmatched | 6.1.1, 6.1.5 |
| W1.3 | Per-subcatchment counts: pits inside the boundary, pipe length **clipped at the boundary**, whether supported low areas are present | 6.1.3 |
| W1.4 | Keep `operator` in `network.py`, re-fetch, and carry it through the database migration and the API's map route | 6.2.2 |
| W1.5 | The subcatchment classification register: a rule per name pattern producing one of the four classes, with every one of the 20 names classified by hand and recorded | 6.1.2 |
| W1.6 | `tools/data/check-subcatchments.mjs`: every address matches one subcatchment or none; no address matches two; every published subcatchment carries a class, a name and a record date | 6.1.1–6.1.5 |
| W1.7 | Name cleaning: numeric prefixes off, `M.D.` and `D.S.` written out, `ST` to *Street*, checked against all 20 | 6.1.1 |

> **The GeoJSON is 23 MB and does not belong in the repository.** The pipeline fetches or reads it from the portal copy, the same as every other dataset, and publishes only the 33 subcatchments that overlap the extent. `docs/DATASETS.md` records the source, the licence and the date.

---

## W2 · Epic 6 screens

| | Task | Serves |
|---|---|---|
| W2.1 | *My drainage area*: boundary on the map, plain-English name, receiving drain by class, wider names under *More information* | 6.1.1, 6.1.2 |
| W2.2 | The area summary: recorded area, pit count, pipe length, low areas present, coverage limitation, the shared-subcatchment sentence | 6.1.3 |
| W2.3 | Currency and limits: record year on the card, record date and layer date separate in *More information*, no survey-date claim | 6.1.4 |
| W2.4 | The unmatched address: says so, substitutes nothing, keeps the rest of the map | 6.1.5 |
| W2.5 | *Who can help*: three levels, official citation, the "general roles, not ownership" statement | 6.2.1 |
| W2.6 | Operator on a selected pipe, the three cases; a pit identified as a record with no operator | 6.2.2 |
| W2.7 | *Report a drainage problem*: five problem types, channel and checklist per type, a selected drain only when chosen on the map, copy or print locally | 6.3.1–6.3.3 |
| W2.8 | The emergency branch, with VICSES and Triple Zero as the primary actions | 6.3.4 |

---

## W3 · Epic 5 screens

| | Task | Serves |
|---|---|---|
| W3.1 | `beforeRain.ts`: the qualifying markers for an address — within 200 m, at most three, nearest first — as a pure module with its own tests | 5.1.1, 5.2.2 |
| W3.2 | Numbered markers **replacing** the unnumbered ones, the *Before-rain checks* control, the legend line, labels that avoid paths, pipes and pits | 5.1.1 |
| W3.3 | The place card: title, conditional action, relevance choice, *Next place*, *Why this place?*, *Show on map*, *Estimated by DrainLens · Not a live warning* | 5.1.2, 5.3.1 |
| W3.4 | The preparation plan: *Places near you* against *For every home*, reminders only for *Applies to me*, three to four general actions, reporting kept separate | 5.2.1–5.2.3 |
| W3.5 | Relevance state in the session reducer: three states, reviewed count, change, reset, cleared on a new address, never stored or sent | 5.4.1, 5.4.2 |
| W3.6 | The zero-place address and the unsupported address, both keeping the general plan | 5.1.3, 5.2.4 |
| W3.7 | Print or download: one page, applicable reminders only, sources and safety boundary, generated in the browser | 5.4.3 |
| W3.8 | The safety boundary block, VicEmergency link, VICSES 132 500, Triple Zero 000 | 5.3.3 |

---

## W4 · Content the team has to write

**None of this can be produced by code, and Epic 5 and Epic 6 cannot be finished without it.**

| | Task | Serves |
|---|---|---|
| W4.1 | ~~The preparation rules register~~ — **approved 4 October**, [PREPARATION-RULES-REGISTER.md](./PREPARATION-RULES-REGISTER.md) | 5.1.1, DoD |
| W4.2 | ~~The guidance content register~~ — **approved 4 October**, [GUIDANCE-CONTENT-REGISTER.md](./GUIDANCE-CONTENT-REGISTER.md) | 5.3.2, 6.2.1, 6.3.2 |
| W4.3 | ~~Three to four general preparation actions, each traceable~~ — **approved 4 October**; the design's fourth is still without a source, which is the one question left open | 5.2.3 |
| W4.4 | ~~The subcatchment classification register, signed off name by name~~ — **approved 4 October**, all 35 rows in one sitting | 6.1.2 |
| W4.5 | ~~Checking the four flood events still waiting from Iteration 2~~ — done 29 September; all four are checked and shown | carried over |
| W4.6 | Deciding the *Check the street drains near you* branch: the measured design note is [BEFORE-RAIN-INLET-CHECK.md](./BEFORE-RAIN-INLET-CHECK.md), which recommends keeping the approved no-ranking behaviour and changing AC 5.2.3 for volume rather than for a score | 5.2.3, DoD |

---

## W5 · Quality, deployment and carried-over work

| | Task |
|---|---|
| W5.1 | The walkthrough checklist extended to Epics 5 and 6 |
| W5.2 | Data checks for the new artefacts in CI |
| W5.3 | The privacy pass: the relevance selections and the printed plan reach no storage and no server |
| W5.4 | Accessibility: the numbered markers, the relevance controls and the printed page |
| W5.5 | Carried over from Iteration 2 — the copy audit's third tier (15 items), the drain aria-label that still says *the nearest you can test*, and the two model simplifications recorded in DECISIONS-PENDING.md |
| W5.6 | ~~Operational: `--min-instances=1` on the API, and the gate password~~ — **both settled 4 October.** `drainlens-api` is back to `--min-instances=0` (revision `drainlens-api-00016-f65`), so no service pays for an idle instance; the first request after an idle period is a 0.74 s cold start, which is the trade. **The password is deliberately not being rotated** — the team's call, recorded in DECISIONS-PENDING.md §9 |

---

## Sequence

1. **W1.1–W1.4 first.** Every Epic 6 screen waits on the artefact, and the pipeline, database and API each need a change before any of it reaches a browser.
2. **W2 while W4 is being written.** The screens can be built against the register's shape before its content is final, provided nothing ships with invented guidance.
3. **W3 last of the Must Have work**, because it depends on no new data and can therefore absorb whatever time W1 and W2 overrun.
4. **Epic 7 only after every Epic 5 and 6 criterion is met**, and only US 7.1 and 7.2. US 7.3 is *Won't Have* and is not to be built by accident while doing the other two.

## Descope ladder

If the demonstration date arrives before the work does, drop in this order, and say in the demonstration what was dropped:

1. Epic 7 entirely.
2. W3.7, the printed plan — the plan still works on screen.
3. W2.7's copy-and-print summary, keeping the guidance on screen.
4. W1.3's pipe length, keeping the pit count and the area.

**Nothing on this ladder is an honesty feature.** The safety boundary, the *Estimated by DrainLens* labels, the zero-place wording and the "not a live warning" statements are not droppable; a version of this product without them is not a smaller version, it is a different and worse one.

## Gates

The quality gates are unchanged: coverage at or above 88% overall and 90% on judgement-carrying modules, every merge through a reviewed pull request, no direct push to `main`, CI green. `git rev-parse origin/main` must stay **`0ff2b82`** for the whole of Iteration 3.
