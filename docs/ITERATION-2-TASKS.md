# Iteration 2 — work breakdown

DrainLens · TA28 · demonstration **date to be confirmed**

What to do. Every task names the criterion it serves in [ITERATION-2-ACCEPTANCE.md](./ITERATION-2-ACCEPTANCE.md) — a task that serves none can be questioned.

**Every AC number in this file is the Iteration 2 set.** Comments in the scenario source still cite `AC 2.x (Aug-27 set)`; the mapping is at the top of the acceptance file.

**The critical path is W1, and it is data.** Epic 3 is largely built and needs one engine change and a route back into the interface. Epic 4 needs a map of Greater Melbourne, a population dataset and a set of verified events, none of which are in the repository — and two of those three cannot be started by writing code.

---

## Where Iteration 2 starts from

Iteration 1 is frozen and serving. `origin/main` stays at `138a002` for the whole of Iteration 2; everything below happens on `develop` and reaches `drainlens-dev`.

**Already delivered during the Iteration 1 to 2 gap**, and relevant to what follows:

- **The map is the whole City of Melbourne** when the database answers — 21,113 pits and 17,242 pipes against Kensington 895 and 893 — with the container copy as the fallback. The API serves it compressed.
- **A guided tutorial** on the real map, with the four-card chooser behind *Get started* and the whole map behind an unlock.
- **The terrain, derived layers and scenario engine still cover the Kensington square kilometre only.** The drainage map grew; the measured ground did not. That mismatch is [DECISIONS-PENDING.md §8](./DECISIONS-PENDING.md) and it is now on Epic 3 critical path through AC 3.3.2.i.

---

## Two decisions to take in the first two days

Both block work that cannot start without them, and neither is a coding task.

**D1 — How Greater Melbourne is drawn.** *(AC 4.1.1, 4.1.2, 4.1.3)*

Every map in this product today is one affine transform over an extent in metres, north-up, with no projection at run time and no basemap. That was chosen for 1 km², survived the move to 76 km², and is the reason the browser bundle carries no map library at all. Greater Melbourne is roughly 10,000 km² and its boundaries are published in latitude and longitude.

Three options, and the answer decides a week of work:

| | What it means | Cost |
|---|---|---|
| **Project at build time** | The pipeline reprojects SA2 boundaries into one metre frame for Greater Melbourne, exactly as it already does for every other artefact, and the existing canvas draws polygons | Keeps the architecture. Polygon simplification and artefact size become the work |
| **A map library with a basemap** | A third-party tile server under a choropleth | Adds a runtime external dependency to a product that currently makes **none**, and every deployment claim about offline behaviour has to be re-examined |
| **No map** | Keep the ranked board and fail 4.1.1 and 4.1.2 | Two Must Have criteria unmet. Only on the descope ladder |

**Recommended: project at build time.** It is the option consistent with everything already built, and the pipeline already has the machinery.

**D2 — What the Severity Score is.** *(AC 4.1.3, 4.3.2)* — **taken, 12 September.**

[SEVERITY-SCORE.md](./SEVERITY-SCORE.md). **Recorded flood-related SES dispatches per 1,000 residents, 2009-10 to 2014-15, over the population at 30 June 2012.** A rate with its unit on screen rather than a 0-10 index; a floor stays a floor; and **seven areas get no score at all** because a per-resident rate needs residents — one dispatch in an industrial estate of fifteen people would outscore everywhere in Greater Melbourne by four times.

Writing it first paid for itself twice. It found that *Not available* has instances after all, which the population reconciliation had said it did not, and it found that the two map modes produce different completeness states — so a legend shared between them offers each mode a state that mode cannot produce.

**D1 was not taken so much as dissolved:** with the map drawn as marks at area centroids rather than as boundary polygons, no reprojected SA2 boundary artefact is needed. What is still needed is a position per area, which is two orders of magnitude smaller than a polygon set.

---

## Owners

Carried over from Iteration 1 — **confirm at the first stand-up** rather than assuming.

| # | Workstream | Suggested owner | Depends on |
|---|---|---|---|
| W1 | Data — boundaries, population, events | MDS ×2 | D1 and D2 |
| W2 | Scenario engine — per-location blockage | MIT | Nothing; starts immediately |
| W3 | Frontend — scenario explorer | MCS + MIT | W2 input shape, not W2 delivery |
| W4 | Frontend — flood map | MCS | **unblocked** — every artefact it needs is published |
| W5 | Deployment, CI, quality | MIT | First commit |
| W6 | Acceptance, demo, documentation | MBIS | Features as they land |

---

## W1 · Data — *critical path*

### Boundaries

- [x] **Fetched, and it is the 2011 edition** → *4.1.1.a, 4.1.2.a*. ABS 1270.0.55.001, MapInfo Interchange. The 66 kB CSV was tried first and carries no coordinates at all, which cost 66 kB to know rather than to assume
- [x] **Reconciled before anything was drawn** → *4.1.2.e*. The file holds 2,214 SA2s nationally and **281 in Greater Melbourne — the same 281**, matching the published list on code and on name with none left over either way. `tools/data/check-areas.mjs` holds that in CI
- [x] **Placed, not reprojected** → *D1 as taken*. With the areas drawn as marks rather than polygons, what was needed was a point each, not a simplified boundary set: `sa2-points.json`, 19 KB, metres from a `greater-melbourne` extent corner in the same convention every other artefact uses. Built from ABS MapInfo Interchange — text, so no dependency was added to read a 121 MB file that is not published. **Two of the 281 have an area centroid outside their own area** (Abbotsford and Strathmore, each cut into a crescent by a river bend) and are placed by point-on-surface instead; every published point is asserted to be inside the area it names
- [x] **All 281 are drawn** → *4.1.2.e*. The alternative was the published thirty, and the sentence that would have had to go beside it is the argument against it: a map of thirty implies the rest are empty, and 275 of them are not. `sa2-areas.json` publishes the scope for exactly this

### Population

- [x] **Obtain the population dataset** with a stated vintage → *4.1.3.a, 4.3.2.d*. ABS 3218.0, SA2 estimates 2005–2015, released 30 March 2016
- [x] **Reconcile it against its own documentation**, the same discipline every other source went through → *4.3.3.a*. Its Explanatory Notes state the 2011 ASGS edition, and that 2012 is revised rather than final
- [x] **Matched, and the rate reported** → *4.1.6.a, 4.1.6.e*. **281 of 281**, by code and by name, the two joins agreeing on every one. But *Not available* is not empty for the reason this line assumed: **seven areas match and still get no score**, because their population is zero or near it. An unmatched area was never the only way to reach that state
- [x] **Loaded, and joinable** → *4.1.3.a*. 1,967 population rows, and the flood tables now hold all 281 areas with their ASGS code rather than the board's thirty by name. `board_rank` keeps AC 2.2.1.b in the data rather than in a query. The Severity Score computes in SQL
- [x] **Decided: SA2.** `flood_incident` is declared and nothing loads it: the pipeline computes 13,339 regions and discards them at build time. If the Severity Score is computed at SA2 from published rollups, this stays empty and the comment stays true. If it is computed at SA1, the pipeline has to emit that grain and re-fetch the sources. **Pick one and write down which**

### Events

- [ ] **Define what *verified* means** and who does it → *4.2.2.a*. A named process, before any content
- [ ] **Schema for events**: name, first recorded date, associated places, area, team-written summary, source links → *4.2.1.a–e*
- [ ] **Three or four events, well sourced** → *4.2.1, 4.2.2*. **Thin and honest beats long and quick.** 4.2.3 is written on the assumption that most areas have none
- [ ] **Review pass on the summaries** → *4.2.2.d*. No casualty figures without a source, no damage estimates, no superlatives. Nothing here is checked by a test, which is why it needs a reader

---

## W2 · Scenario engine

- [ ] **Per-location blockage** → *3.1.2.c*. The engine applies one setting to every inlet and `packages/scenario` asserts that against AC 2.1.2.d (Aug-27 set). The input shape, the worker cache key and the checks all change. **Update the tests that hold the old line rather than deleting them** — the invariant is not wrong, it is superseded, and the commit should say so
- [ ] **A sufficiency test that does not require running the scenario** → *3.1.1.a, 3.1.1.d*. `terrain_unavailable` and `invalid_inlet` are answerable from the coverage mask and the inlet classification alone. `scenario_calculation_failed` and `comparison_not_comparable` are not, which is why 3.1.4 stays
- [ ] **Choose and pin the validated rainfall levels** → *3.2.3.b*. `RAINFALL_RANGE_MM` is a continuous 0–120 mm range; the criterion asks for a validated set. The sensitivity work used 20, 60 and 200 mm and 200 is outside the published range
- [ ] **Re-run the blockage sensitivity against per-location blocking** → *3.1.3.f, 3.3.2.h*. The existing measurement already covers the single-inlet case at 0.0 m³, but it was taken with a global setting; confirm the new input path reproduces it. **If it does not, that is a defect in the change, not a discovery**
- [ ] Mass balance and monotonicity checks still pass with the new input shape → *3.2.2.d*

---

## W3 · Frontend — scenario explorer

- [ ] **Route back into the interface** → *3.1.1*. Iteration 1 removed it by AC 1.1.1.e: one entry in `TaskSelect.tsx` and one card in `Home.tsx` restore it, and the screens and their tests are untouched
- [ ] **Mark supported and unsupported locations on the map** → *3.1.1.a, 3.1.1.d*, with wording that does not read as "this drain is fine" → *3.1.1.e*
- [ ] **Blockage control bound to the selected location only** → *3.1.2.c*
- [ ] **Rainfall control offering the validated levels** → *3.2.3.a, 3.2.3.b*
- [ ] **Selection summary before the run** → *3.1.2.f*
- [ ] Labels for assumption and input → *3.1.2.d, 3.1.2.e*
- [ ] **Result explanation extended to nine limitations** → *3.3.2.a–i*. Iteration 1 covered most of them; c, h and i need writing. **h does not go under *More information*** — it is the sentence that makes a null result honest
- [ ] **The supported-calculation-area boundary on screen** → *3.3.2.i*. Blocked by [DECISIONS-PENDING.md §8](./DECISIONS-PENDING.md)
- [ ] Uncertainty explanation, including photogrammetric rather than LiDAR and 52.1% of cells measured → *3.3.3.b*

---

## W4 · Frontend — flood map

- [x] **The map draws**, 281 areas as marks → *4.1.1.a, 4.1.2.a*
- [x] **One map, two paint functions, one mode switch** → *4.1.1.b, 4.1.1.c*. Selection and zoom survive a mode change, as predicted, because there is nothing to retain
- [ ] **Colour ramp with named breaks** → *4.1.2.b, 4.1.2.d*. **The distribution is severely skewed** — 209 at the top and single digits across most areas — so equal-width bins produce one dark area and twenty-nine identical pale ones. Choose the breaks deliberately and put the ranges in the legend
- [ ] **Recorded activity distinguished from no recorded activity** → *4.1.2.e*
- [ ] **Area detail panel** → *4.1.4.a–h*, showing what is available and saying why anything absent is absent
- [ ] **Completeness states** — Exact, Minimum value, Not available → *4.1.6.a*, with the two distinct causes kept distinct: a suppressed numerator is a floor, a missing denominator is no score
- [ ] **Events section**, including the empty state → *4.2.1, 4.2.3*. **Build the empty state first**; it is what almost every area shows
- [ ] **Evidence explanations** → *4.3.1, 4.3.2, 4.3.3*. 4.3.1 is six sentences that already exist on the Iteration 1 board and should be lifted rather than rewritten
- [ ] **A third provenance mark** → *4.3.4.a*. The legend separates *recorded by the council* from *calculated by DrainLens*; a verified event is neither

---

## W5 · Deployment, CI and quality

- [ ] Migration for the events table, and for anything the Severity Score needs → *4.2.1*
- [x] `check-guide.mjs` equivalent for the new artefacts — `tools/data/check-areas.mjs`, in CI. It recomputes the board’s thirty from the 281 and checks the population against the same codes. Mutation-tested: a swapped name, a changed total, a dropped population row and a reordered board are all caught
- [ ] Boundary artefact size measured raw and gzipped, and recorded
- [ ] The API compresses `/api/*` already; confirm any new route is under it
- [ ] `verify-api.mjs` extended to any new endpoint, **deeply** — it compares whole responses against the published artefact, and that is what caught 85 pipes reported as reference number 0
- [ ] Deploy to `drainlens-dev` from `develop` as the work lands; `origin/main` untouched at `138a002`
- [ ] AD1 re-checked after each deployment, with its positive control

---

## W6 · Acceptance, demo and documentation

- [ ] Acceptance checklist in use — **134 sub-criteria**, against 96 in Iteration 1
- [ ] Severity Score definition written **before** the score is computed → *4.3.2.c*
- [ ] Desk check 1 — the scenario journey end to end
- [ ] Desk check 2 — the flood map, both modes, including an area with no events and an area with no score
- [ ] Manual click-through in a real browser, desktop and mobile
- [ ] Demo script written, timed, rehearsed with every speaker
- [ ] **Decide how the demonstration handles *No clear change*** — this is a rehearsal decision and it is still open from Iteration 1

---

## Sequence

Dates are relative because the demonstration date is not confirmed. The order is not.

| | Focus | Gate at end |
|---|---|---|
| **Day 1–2** | **D1 and D2 taken.** W2 starts on per-location blockage. Boundary and population data located | **Both decisions written down.** If D1 is unresolved on day two, the flood map has lost a week and the descope ladder starts |
| **Day 3–4** | Boundary artefact built and reconciled. Population matched, match rate reported. Scenario explorer routed back into the interface | **The boundary artefact exists and its name match rate is known.** Population match rate known |
| **Day 5–6** | Flood map draws both modes. Per-location blockage lands with its tests. Events schema and the first two events | **A map of Greater Melbourne is on screen** with real counts. Go / no-go on the Severity Score |
| **Day 7–8** | Area detail, completeness states, empty event state. Result explanation extended. §8 boundary resolved | Both journeys walkable on `drainlens-dev` |
| **Day 9** | **Feature freeze at midday**, defects only. Desk check 2. Demo rehearsed | **If both journeys do not run on the deployed site tonight, the demonstration shows what does.** Decide tonight |
| **Day 10** | One final click-through, then demonstrate. Nothing is merged | — |

---

## Descope ladder

Take in order, and take early.

| Rung | Give up | Why it is survivable |
|---|---|---|
| 1 | **Epic 5 entirely** | Should / Could / Will not have. It is not in this document for a reason |
| 2 | **Verified events beyond two** *(4.2.1)* | Two well-sourced events satisfy 4.2.1 and 4.2.2 as fully as ten. 4.2.3 already covers every other area |
| 3 | **Severity Score for SA1** | Compute at SA2 from the published rollups. `flood_incident` stays empty and its comment stays true |
| 4 | **The Severity Score itself** *(4.1.3)* | Only if the population data cannot be matched honestly. **Say that plainly** — an unmatched denominator is a finding, and inventing one is the one thing this product does not do. Costs 4.1.3, 4.1.6, 4.3.2 |
| 5 | **Per-location blockage** *(3.1.2.c)* | Keep the global setting and state on screen that the assumption applies to every drain. Fails 3.1.2.c; keeps the rest of Epic 3 honest |
| 6 | **The map, keeping the ranked board** *(4.1.1, 4.1.2)* | Fails two Must Have criteria. Last rung before the iteration has not met its Must Haves, and that should be said plainly rather than absorbed |

**Not on the ladder: AC 3.3.2.h and AC 4.1.5.** The sentence explaining what *No clear change* means, and showing a suppressed total as a floor. Both are the product refusing to overclaim, and both are cheap.

---

## Gates

Carried from Iteration 1, with the two that were breached still breached.

| Gate | When | Status |
|---|---|---|
| Tests written before or alongside every judgement-carrying component | Continuous | holding |
| ≥90% coverage on judgement-carrying modules, ≥88% overall, suite under 5 s | Every pull request | **Node 6 s on the runner ✗** as of 5 September, not re-measured since. **Python 68 s ✗**. Locally 3.9–4.0 s over three runs on 11 September. Counts and coverage are in the README's gate table and are not restated here — three copies of that number have gone stale, one of them within hours |
| `npm ci`, never `npm install`, before every push | CI | enforced |
| 100% of merges via pull request with written technical feedback | Continuous | enforced by ruleset |
| Zero direct pushes to `main`; `origin/main` stays at `138a002` | Continuous | enforced and checked after every push |
| ≥2 structured desk checks | Day 4, Day 9 | sheet ready: [WALKTHROUGH-CHECKLIST.md](./WALKTHROUGH-CHECKLIST.md) |
| ≥8 hours cross-discipline pair programming | — | **record the hours that happen** |
| Critical defects triaged within 24 h, resolved within the iteration | Continuous | — |
| p95 latency recorded before and after deployment | Each deployment | API measured 11 September; the map route was 749.6 ms p50 uncompressed and is now gzipped 5.7× |
| Manual click-through in a real browser before the demo | Day 9, Day 10 | — |

---

## Honest assessment

**Epic 3 is in better shape than it looks and Epic 4 is in worse shape than it looks.**

Epic 3 is a built feature that was switched off. The engine, the worker, both screens, the sufficiency gate and the tests are all there. The real work is one input-shape change, one pre-flight sufficiency test, and writing three more sentences into an explanation panel. The risk is not that it fails to work; it is that AC 3.1.2.c delivers exactly the scenario that returns *No clear change* every time, and that the team is not ready to present a null result as a finding. **That is a rehearsal problem and it has been open since 3 September.**

Epic 4 looks like an extension of the flood board and is mostly a new feature on new data. A choropleth of Greater Melbourne, a score that needs a dataset nobody has fetched and reconciled yet, and a set of hand-verified events with sources — **and the second and third cannot be fixed by writing code faster.** The population data is the single point of failure: if it cannot be matched to ASGS 2011 honestly, the Severity Score is not shippable, and rung 4 is the answer.

The failure mode is not the frontend. It is arriving at day five without a boundary artefact, without a matched population dataset, and with a week of map work that cannot start. **D1 and D2 on day two are the whole guard.**

One more thing worth saying out loud: the Iteration 1 to 2 gap has already produced three defects that the tests did not catch and a walk-through did — a coordinate frame that put every address pin 1.5 km from the house, 85 pipes reported as reference number 0, and an entire deployed URL silently serving a square kilometre because a CORS list had not been updated. **Deploy early and walk it in a browser.** Every one of those was found by opening the thing and looking at it.
