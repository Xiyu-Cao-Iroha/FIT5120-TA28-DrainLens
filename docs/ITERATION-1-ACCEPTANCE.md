# Iteration 1 — acceptance criteria

DrainLens · TA28 · demonstration **Tuesday 1 September 2026**

What "done" means. The work that produces it is in [ITERATION-1-TASKS.md](./ITERATION-1-TASKS.md), where every task names the criterion below that it serves.

**Tick a criterion only when it has been seen working on the deployed build** — not when the code that should satisfy it has been merged.

**Scope:** Epic 1 and Epic 2 are Must Have. Epic 3 is not in this iteration.
**Deliberately out of scope:** machine learning, live rainfall, capacity or bottleneck claims, absolute ponding depth or extent, water arrival time.

---

## AC 1.1 — Explore water flow near an address

*Given the user enters an address within the supported pilot area, when the user selects the address, then:*

- [ ] **1.1.a** The map centres on and marks the selected address
- [ ] **1.1.b** The map shows nearby surface water paths, low-lying areas, drainage pits and pipes **where data is available**
- [ ] **1.1.c** The page provides a short explanation of where water near the address may flow and which nearby drains it may reach
- [ ] **1.1.d** Missing or uncertain information is clearly identified
- [ ] **1.1.e** The search completes without an account, and the searched address is **not saved after the session**

> **1.1.e is verified by inspection, not by trust:** open the network panel, search an address, and confirm no request carries it. `assertSendable` in `@drainlens/schema` guards the code path; the manual check guards the guard.

## AC 1.2 — Follow the downstream drainage path

*Given the local drainage network is displayed, when the user selects a drainage pit and chooses to follow the downstream path, then:*

- [ ] **1.2.a** The selected pit and its recorded downstream pipes are highlighted
- [ ] **1.2.b** The direction of the drainage path is clear
- [ ] **1.2.c** The path continues to the recorded outlet or the last known connection
- [ ] **1.2.d** Any missing or uncertain connection is shown clearly, **without completing the path using unsupported information**

> Three behaviours are load-bearing and each needs its own test: the cycle guard (3.9% of traces would otherwise not terminate), branch handling (62.5% of traces meet at least one branching node — multiple downstream paths are the normal case and must never be collapsed to one), and the termination reason (outlet, data boundary, or missing connection — the interface must say which).

## AC 1.3 — View the street and underground drainage

*Given the user has selected a drainage pit or pipe, when the user opens the street cross-section, then:*

- [ ] **1.3.a** The view shows the street surface, selected pit and connected pipes
- [ ] **1.3.b** Pipe direction and depth are shown **where the available data supports them**
- [ ] **1.3.c** Any possible drainage constraint is labelled and explained in plain English
- [ ] **1.3.d** If the available information is insufficient, the page explains that the constraint **cannot be assessed** at that location

> Depth will be absent almost everywhere — invert values are 95.4% missing. 1.3.b is satisfied by showing depth where it exists and omitting it where it does not; 1.3.d is what covers the rest. Do not interpolate.

## AC 2.1 — Set up a local blockage scenario

*Given the user has opened an address within the supported pilot area, when the user opens the scenario explorer, then:*

- [ ] **2.1.a** The user can select one nearby public drainage pit
- [ ] **2.1.b** The user can choose **Clear**, **Partly blocked** or **Fully blocked**
- [ ] **2.1.c** The user can select a total accumulated rainfall amount within the supported range
- [ ] **2.1.d** The selected drain, blockage condition, rainfall amount and calculation area are shown **before** the user runs the scenario

> 2.1.c is satisfied by manual entry. The rainfall field needs worked reference points beside it — a resident has no basis for knowing whether 30 mm is a lot.

## AC 2.2 — Compare the blockage scenario

*Given the selected scenario has been completed, when the user moves the storm progress slider, then:*

- [ ] **2.2.a** The slider shows accumulated rainfall in **millimetres**
- [ ] **2.2.b** The map compares the selected blockage with **all drains clear at the same accumulated rainfall level**
- [ ] **2.2.c** Areas are labelled as **No clear change** or **Higher than baseline**
- [ ] **2.2.d** The selected drain and its connected downstream path remain visible during the comparison
- [ ] **2.2.e** The page describes the result as an **indicative comparison based on simplified assumptions**, and states that water arrival time is outside the model

## AC 2.3 — Understand the scenario result

*Given a scenario result is displayed, when the user opens the result explanation, then:*

- [ ] **2.3.a** The page summarises the selected rainfall amount, drain and blockage condition
- [ ] **2.3.b** The page explains how the selected blockage may affect surface water build-up in the surrounding area
- [ ] **2.3.c** Official map data, system estimates and user-selected scenario settings are **clearly separated**
- [ ] **2.3.d** Important assumptions, missing data and uncertainty are explained in plain English
- [ ] **2.3.e** If the available information does not support a clear comparison, the page explains this **without assigning a strong result category**

> 2.3.c is what the provenance record exists for. It cannot be satisfied by styling text at render time — the basis travels with the value.

---

## Definition of done

### Epic 1 — Interactive Local Drainage and Water Flow

- [ ] A user can complete the full journey: search an address → view local water flow → trace a downstream path → open the street cross-section, within the supported pilot area
- [ ] The map, drainage trace and cross-section use available source data **without inventing** missing connections, pipe depths or drainage constraints
- [ ] Missing or uncertain information is clearly labelled, data sources and dates are recorded, and searched addresses are not retained after the session
- [ ] The main map controls and explanations work on the agreed desktop and mobile layouts and can be understood without specialist drainage knowledge
- [ ] Reviewed, tested against all Epic 1 acceptance criteria, and demonstrated in the test environment with no unresolved defect preventing the main journey

### Epic 2 — Rainfall and Drainage Blockage Scenario Explorer

- [ ] A user can select a drain, choose a blockage condition and rainfall amount, run the scenario, compare it with the clear-drain baseline, and open the result explanation
- [ ] Every comparison uses the same accumulated rainfall level and an all-drains-clear baseline, and **the same inputs produce the same result**
- [ ] Storm progress is presented as accumulated rainfall in millimetres, and the interface does not present the result as an exact water depth, an arrival time, or a flood prediction
- [ ] Assumptions, missing data and uncertainty remain visible, and no strong result is assigned where the information cannot support it
- [ ] Reviewed and tested across all three blockage conditions and the supported rainfall range, all Epic 2 criteria passed, no unresolved defect preventing the main journey

---

## Wording to hold on the day

Everyone who speaks about the product holds these. They are what the criteria above commit us to, and nothing further.

- Not a flood warning, not a forecast, not an engineering assessment.
- The result is an **indicative comparison** against a clear-drain baseline at the same accumulated rainfall — not a depth, not an extent, not a time.
- We do not speak about pipe capacity or bottlenecks. We speak about where water may go, and where a pipe narrows.
- Rainfall is entered by the resident. **Do not demonstrate a live observation** unless permission has arrived first.
- No machine learning in this iteration — and that is a position, not a gap: the project has no outcome labels, so a deterministic, explainable model is the honest choice.
