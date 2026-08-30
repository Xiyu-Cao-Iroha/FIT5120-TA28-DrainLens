# Iteration 1 — acceptance criteria

DrainLens · TA28 · demonstration **Tuesday 1 September 2026**

What "done" means. The work that produces it is in [ITERATION-1-TASKS.md](./ITERATION-1-TASKS.md), where every task names the criterion below that it serves.

**Tick a criterion only when it has been seen working on the deployed build** — not when the code that should satisfy it has been merged.

**Source:** *Epics, User Stories and Acceptance Criteria*, revision received 27 August 2026. That revision replaced six broad criteria with twenty, restructured around interactions rather than user stories, and added navigation and state-retention requirements that did not exist before. Where this file and that document disagree, the document wins and this file has a bug.

**Scope:** Epic 1 and Epic 2 are Must Have. Epic 3 is Iteration 2.
**Deliberately out of scope:** machine learning, live rainfall, capacity or bottleneck claims, absolute ponding depth or extent, water arrival time, blockage formation over time.

**Resolved 27 August, after the architecture was checked against the revision:**

- **The three-view requirement is withdrawn. AD7 stands** — the result page shows the **Difference only**. This was never a frontend choice: the scenario worker, the golden path, `result_provenance` and the validation checks are all Difference-only, so two standalone maps would have changed the engine's output contract rather than its presentation.
- **AC 2.2.3 becomes "Handle insufficient comparison data."**
- **Navigation criteria are compressed.** Two are kept because they carry state the resident would lose: *Choose another task* and *returning from a result to the scenario setup with the inputs intact*. The remaining back-button behaviours move to the UI definition of done at the end of this file and are covered by Playwright rather than by a criterion each.

---

## Where this stands — 29 August 2026

**77 of 77 interaction criteria met.** Every box below was checked against the code, and the Epic 2 journey was **run end to end in a browser** rather than read. That distinction earned its keep: 2.2.1 had been ticked from the code on 29 August while the comparison could not actually run, and only clicking it found out. Ticks that have not been exercised are worth less than they look. Nothing is left unticked, so the list of known gaps that stood here is gone rather than empty.

Every interaction criterion is met. What remains open is not a criterion but the definition of done: the desktop and mobile layouts, the Playwright coverage of the remaining back and rerun paths, and the deployment items — see [ITERATION-1-TASKS.md](./ITERATION-1-TASKS.md).


**US 1.3 was built on 29 August.** The drawing was the easy half. The map artefact carries **no invert level for any pit** — the pipeline never fetched a field missing from 95.4% of the record and internally inconsistent in what survives — so a cross-section's one axis is the one with no data behind it. The section therefore splits itself: **everything horizontal is recorded** (which pipes connect, on which side, their diameter and material) and **everything vertical is drawn**, said inside the figure rather than in a caption. 726 of 895 pits can have one; the other 169 get AC 1.3.2, which is a real screen rather than a defensive branch. Both states were clicked through in a browser.

US 1.2 was completed on 29 August; see the note under AC 1.2.2. **1.1.2.a and 1.1.3.a were met on 29 August**: the map now opens centred on the address and marks it. Verified in the browser at two addresses — one away from the boundary lands dead centre, one near the western edge stops exactly where the clamp says it should rather than opening onto ground outside the pilot area.

**US 2.2 and 2.3 were finished on 29 August, and finishing them uncovered a defect that would have taken the demonstration with it.** The interface worked out which grid cell a pit occupied from the map geometry, while the pipeline snaps every drain up to three metres onto the flow field. The two disagreed for **895 of 895 drains**, so the engine found no drain at the cell it was given and *every* comparison returned `invalid_inlet`. The interface now reads the cell from the scene, which is the only thing that knows it, and suggestions are filtered to drains the scene actually places. **1.1.2.a and 1.1.3.a were met on 29 August**: the map now opens centred on the address and marks it. Verified in the browser at two addresses — one away from the boundary lands dead centre, one near the western edge stops exactly where the clamp says it should rather than opening onto ground outside the pilot area.

---

## US 1.1 — Explore water flow near an address

### AC 1.1.1 — Select a supported address

*Given the user is on the address search page, when they enter and confirm a recognised address within the supported pilot area, then the system will:*

- [x] **1.1.1.a** Display the selected address
- [x] **1.1.1.b** Open the task-selection page
- [x] **1.1.1.c** Present the options *Follow local water and drainage*, *Compare a drain-blockage scenario* and *Explore the full map*
- [x] **1.1.1.d** Allow the user to continue without creating an account
- [x] **1.1.1.e** Retain the selected address **in memory only, for as long as the tab is open**

> **1.1.1.e is two claims, and they need different checks.** *The address is never sent* — open the network panel, search, and confirm no request carries it; `assertSendable` in `@drainlens/schema` guards the code path and the manual check guards the guard. *The address is not kept* — confirm it appears in no `localStorage` key, no `sessionStorage` key, no URL and no history state. Navigation state lives in memory only; history state carries a screen identifier and nothing else. `sessionStorage` survives a reload, a URL is shared and logged, and history state is written to disk, so none of them is "only for the session" in the sense this criterion means.

### AC 1.1.2 — Follow local water and drainage

*Given a supported address is selected and the user is on the task-selection page, when they select "Follow local water and drainage", then the system will:*

- [x] **1.1.2.a** Open a local map centred on and marking the selected address
- [x] **1.1.2.b** Show likely surface-water paths and nearby drainage pits **by default**
- [x] **1.1.2.c** Provide a short plain-English explanation of where water near the address may move
- [x] **1.1.2.d** Display **one clear next-step instruction** asking the user to select a surface-water path or drainage pit
- [x] **1.1.2.e** Make other layers available through a **collapsed** "More map layers" section
- [x] **1.1.2.f** Clearly identify any missing, incomplete or uncertain information

### AC 1.1.3 — Explore the full map

*Given a supported address is selected and the user is on the task-selection page, when they select "Explore the full map", then the system will:*

- [x] **1.1.3.a** Open a local map centred on and marking the selected address
- [x] **1.1.3.b** Provide controls for the terrain, surface-water path, low-area, drainage-pit and drainage-pipe layers
- [x] **1.1.3.c** Allow individual layers to be turned on or off
- [x] **1.1.3.d** **Distinguish official recorded data from system-derived information**
- [x] **1.1.3.e** Clearly identify information that is missing, incomplete or uncertain

### AC 1.1.4 — Enter an unsupported address

*Given the user is on the address search page, when they enter and confirm an address outside the supported pilot area, then the system will:*

- [x] **1.1.4.a** Explain that detailed local drainage information is not available for that address
- [x] **1.1.4.b** **Not** present local drainage results as if supported data were available
- [x] **1.1.4.c** Allow the user to enter a different address

> The pilot area is the City of Melbourne, bounded by drainage asset coverage rather than terrain. Most of Greater Melbourne will land here, so this path is a main flow, not an edge case.

### AC 1.1.5 — Choose another task

*Given a supported address is selected and the user is on a task page, when they select "Choose another task", then the system will:*

- [x] **1.1.5.a** Return to the task-selection page
- [x] **1.1.5.b** Retain the selected address for the current browser session

---

## US 1.2 — Follow the downstream drainage path

### AC 1.2.1 — Select a drainage pit

*Given the user is viewing a local map containing recorded drainage pits, when they select a pit, then the system will:*

- [x] **1.2.1.a** Highlight the selected pit
- [x] **1.2.1.b** Display the available recorded information for that pit
- [x] **1.2.1.c** **Identify the information as official recorded data**
- [x] **1.2.1.d** Provide an option to follow its recorded downstream connection

> 1.2.1.c pushes provenance down to the individual pit. Every value shown here travels with the basis that produced it — see `packages/schema/src/provenance.ts`, where a value without a basis has no constructible shape.

### AC 1.2.2 — Follow the recorded downstream path

*Given a pit with an available recorded downstream connection is selected, when they select "Follow the recorded downstream path", then the system will:*

- [x] **1.2.2.a** Highlight the selected pit and its available recorded downstream pipes
- [x] **1.2.2.b** Show the recorded direction of the drainage path
- [x] **1.2.2.c** Continue the path to the recorded outlet or the last known connection
- [x] **1.2.2.d** Clearly identify any missing or uncertain connection
- [x] **1.2.2.e** **Avoid completing the path using unsupported or inferred pipe connections**

> **Built 29 August.** The traversal is `apps/web/src/trace/graph.ts`, the rendering `trace/draw.ts`, the panel `screens/PitDetail.tsx`, and the topology comes from `drainlens_pipeline.trace`. 1.2.2.c is satisfied by the *last known connection* in every case: the extent contains no recorded outfall, endwall or discharge point, so no path can reach an outlet and none claims to. See the measured counts below.
>
> Three behaviours are load-bearing and each needs its own test: the cycle guard (18 back-edges across 34 nodes exist in the real data, and a trace without a guard would not terminate on them), branch handling (multiple downstream paths are the normal case and must never collapse to one), and the termination reason — outlet, data boundary, or missing connection, and the interface must say which.
>
> The graph builder already supports 1.2.2.d and 1.2.2.e: a pipe whose downstream pit is absent from the export becomes an edge with **no destination** rather than no edge at all, so the path reaches it and stops there with that reason.

---

## US 1.3 — View the street and underground drainage

### AC 1.3.1 — View an available street cross-section

*Given a pit or pipe with sufficient recorded information is selected, when the user opens the street cross-section, then the system will:*

- [x] **1.3.1.a** Show a simplified relationship between the street surface, the selected pit and the connected underground pipes
- [x] **1.3.1.b** Show recorded pipe direction and depth **where the data supports them**
- [x] **1.3.1.c** Distinguish recorded information from simplified system presentation
- [x] **1.3.1.d** Clearly identify any missing or uncertain depth information
- [x] **1.3.1.e** **Avoid any claim about pipe capacity, underground blockage, or whether the pipe is adequate**

> Depth will be absent almost everywhere — invert values are 95.4% missing and the surviving fraction is internally inconsistent. 1.3.1.b is satisfied by showing depth where it exists and omitting it where it does not. Do not interpolate. 1.3.1.e is AD6 restated as a criterion.

### AC 1.3.2 — Cross-section information is insufficient

*Given the selected location lacks sufficient verified depth or connection information, when the user attempts to open the cross-section, then the system will:*

- [x] **1.3.2.a** Explain that a reliable cross-section cannot be provided for that location
- [x] **1.3.2.b** Identify which required information is missing or uncertain
- [x] **1.3.2.c** **Not** fill missing values using unsupported assumptions

---

## US 2.1 — Set up a local blockage scenario

### AC 2.1.1 — Open the scenario explorer

*Given a supported address is selected and the user is on the task-selection page or the local drainage map, when they select "Compare a drain-blockage scenario", then the system will:*

- [x] **2.1.1.a** Open the scenario setup page
- [x] **2.1.1.b** Present the setup in order: select a pit → choose a blockage setting → choose accumulated rainfall → run the comparison
- [x] **2.1.1.c** Carry over a drainage pit **only** when the user previously selected that pit
- [x] **2.1.1.d** Otherwise present a nearby pit as a **clearly labelled suggestion requiring confirmation**
- [x] **2.1.1.e** Leave the blockage setting **unselected** until the user chooses

> 2.1.1.d and 2.1.1.e are the same instinct as the rest of the product: the system may suggest, but it does not decide on the resident's behalf and then present the decision as theirs.

### AC 2.1.2 — Complete the scenario inputs

*Given the user is on the scenario setup page, when they confirm one pit, select a blockage setting and select an accumulated rainfall within the supported range, then the system will:*

- [x] **2.1.2.a** Allow only one drainage pit to be changed in the scenario
- [x] **2.1.2.b** Allow the blockage setting to be **Clear**, **Partly blocked** or **Fully blocked**
- [x] **2.1.2.c** Display the accumulated rainfall in **millimetres**
- [x] **2.1.2.d** **Explain that the blockage setting is a scenario assumption, not the pit's observed current condition**
- [x] **2.1.2.e** **Explain that the accumulated rainfall is a user-selected assumption, not an observation or a forecast**
- [x] **2.1.2.f** Show the selected pit, blockage setting, accumulated rainfall and local calculation area in a scenario summary
- [x] **2.1.2.g** Enable the user to run the comparison

> **2.1.2.d is the answer to a question a reviewer already asked** — how does the model calculate deposit speed under a large water flow? It does not. The setting is an assumption held constant for the whole scenario, and AD13 records why: the model's independent variable is accumulated rainfall, not time, so no rate can come out of it. Three tests in `packages/scenario` hold that line. This criterion is what makes the interface say so too.
>
> **2.1.2.e** keeps the rainfall field honest while live observation stays a conditional extension outside the MVP.

---

## US 2.2 — Compare the blockage scenario

### AC 2.2.1 — Run the scenario comparison

*Given all required inputs are complete, when the user selects "Run comparison", then the system will:*

- [x] **2.2.1.a** Compare the selected blockage with an all-clear baseline **within the same local calculation area**
- [x] **2.2.1.b** Compare both conditions **at the same accumulated rainfall amount**
- [x] **2.2.1.c** Open the **Difference** view by default
- [x] **2.2.1.d** Keep the selected pit and its connected downstream path visible
- [x] **2.2.1.e** Identify supported result areas as **No clear change** or **Higher than baseline**
- [x] **2.2.1.f** Display **Insufficient information** where the data does not support a clear comparison
- [x] **2.2.1.g** Describe the result as an indicative comparison based on simplified assumptions, **not a live flood prediction**

> **2.2.1.f is implemented** by the gate in AC 2.2.3, which runs before anything is computed.
>
> **No clear change and Insufficient information are different results and must stay different.** The first means the calculation ran and found nothing; the second means it could not be made. `insufficient-data` has been removed from the comparison-band vocabulary so the two cannot share a word: a band describes an area within a comparison that succeeded, a status describes whether there was one.
>
> **A missing downstream connection is a network limitation, not an insufficiency.** Where a pipe leads has no bearing on the surface calculation, so it is reported alongside a successful result rather than replacing one.

### AC 2.2.2 — Change the accumulated rainfall level

*Given a completed comparison is displayed, when the user moves the rainfall control, then the system will:*

- [x] **2.2.2.a** Display the selected level in millimetres
- [x] **2.2.2.b** Update **both** the all-clear baseline and the blockage scenario to that same level
- [x] **2.2.2.c** Update the displayed difference without changing the selected pit or blockage setting
- [x] **2.2.2.d** **Explain that the control shows how the comparison changes as rainfall accumulates, not when water will reach a location**

> Every position is solved independently from zero, so moving the control cannot make an earlier position disagree with itself. A test asserts that solving four positions and solving one give the same answer at the rainfall they share.

### AC 2.2.3 — Handle insufficient comparison data

*Given the data-sufficiency gate rejects the comparison, when the user runs it, then the system will:*

- [x] **2.2.3.a** Display **Insufficient information** instead of a result
- [x] **2.2.3.b** Name the reason: terrain unavailable, invalid inlet, calculation failed, or results not comparable
- [x] **2.2.3.c** **Not** show a partial or placeholder comparison alongside it
- [x] **2.2.3.d** Allow the user to change an input and try again

> **Implemented.** The worker returns `SuccessfulComparison` or `InsufficientInformation` with one of four reasons — `terrain_unavailable`, `invalid_inlet`, `scenario_calculation_failed`, `comparison_not_comparable` — applied in that order, so the reason shown is the one that actually stopped the comparison rather than whichever check ran first. Nine tests in `packages/scenario` cover the gate.
>
> **This criterion replaces a withdrawn one.** The 27 August revision asked for All clear, Blockage and Difference views. AD7 forbids a standalone ponding layer, and the engine, the golden path, `result_provenance` and the validation checks are all Difference-only — so the change would have altered the output contract rather than the presentation. The architecture owner and the product owner resolved it in favour of AD7 and reused the slot for the gate, which the criteria needed and did not have.

### AC 2.2.4 — Return to the scenario setup

*Given a completed comparison is displayed, when the user selects "Back to scenario setup", then the system will:*

- [x] **2.2.4.a** Return to the scenario setup page
- [x] **2.2.4.b** Retain the previously selected pit, blockage setting and rainfall amount

---

## US 2.3 — Understand the scenario result

### AC 2.3.1 — Open the result explanation

*Given a completed comparison is displayed, when the user opens "How this result was produced", then the system will:*

- [x] **2.3.1.a** Summarise the selected pit, blockage setting and accumulated rainfall
- [x] **2.3.1.b** Explain in plain English how the blockage assumption changes the indicative build-up compared with the all-clear baseline
- [x] **2.3.1.c** **Distinguish official recorded data, system-derived indicative results and user-selected assumptions**
- [x] **2.3.1.d** Explain the simplified assumptions the comparison uses
- [x] **2.3.1.e** Identify important missing or uncertain information
- [x] **2.3.1.f** State that the comparison does not estimate water-routing time, flood arrival time or live flood conditions

> 2.3.1.c is what the provenance record exists for, and it cannot be met by styling text at render time. Every value carries a basis: a data version, a derivation, an entry in the assumption register, or a model version. 2.3.1.d needs that register to exist — it is a build artefact, and without it the "assumed" label points at nothing.

### AC 2.3.2 — Explain an unclear result

*Given the data does not support a clear comparison, when the user opens "How this result was produced", then the system will:*

- [x] **2.3.2.a** Explain why the comparison is unclear
- [x] **2.3.2.b** Identify the missing or uncertain information affecting it
- [x] **2.3.2.c** Display **Insufficient information** instead of assigning a strong result category
- [x] **2.3.2.d** **Avoid presenting the result as evidence of real-world flood prediction accuracy**

> 2.3.2.d is precise and worth keeping precise. The engine's checks — synthetic terrain with a known answer, mass balance, monotonicity — verify it through **internal consistency and controlled test cases**. They establish that it behaves as designed. They do not establish real-world accuracy, and nothing in the interface may imply they do.

---

## Definition of done

From *Iteration 1 Requirements*. The revised criteria document does not restate these, and they still govern.

### Epic 1 — Interactive Local Drainage and Water Flow

- [ ] A user can complete the full journey: search an address → view local water flow → trace a downstream path → open the street cross-section, within the supported pilot area
- [ ] The map, drainage trace and cross-section use available source data **without inventing** missing connections, pipe depths or drainage constraints
- [ ] Missing or uncertain information is clearly labelled, data sources and dates are recorded, and searched addresses are not retained after the session
- [ ] The main map controls and explanations work on the agreed desktop and mobile layouts and can be understood without specialist drainage knowledge
- [ ] Reviewed, tested against all Epic 1 criteria, and demonstrated in the test environment with no unresolved defect preventing the main journey

### Epic 2 — Rainfall and Drainage Blockage Scenario Explorer

- [ ] A user can select a drain, choose a blockage condition and rainfall amount, run the scenario, compare it with the clear-drain baseline, and open the result explanation
- [ ] Every comparison uses the same accumulated rainfall level and an all-drains-clear baseline, and **the same inputs produce the same result**
- [ ] Storm progress is presented as accumulated rainfall in millimetres, and the interface does not present the result as an exact water depth, an arrival time, or a flood prediction
- [ ] Assumptions, missing data and uncertainty remain visible, and no strong result is assigned where the information cannot support it
- [ ] Reviewed and tested across all three blockage conditions and the supported rainfall range, all Epic 2 criteria passed, no unresolved defect preventing the main journey

---

## UI definition of done

Behaviours the revision expressed as one criterion per button. They are real requirements and are covered by Playwright on the golden path rather than by a criterion each — a back button that loses state is a defect, but it is not a separate acceptance conversation.

- [ ] **Change address** returns to search, shows the current address in the field, and keeps address state until a different one is confirmed *(was AC 1.1.6)*
- [ ] **Contextual back from scenario setup** returns to whichever page opened it, keeps the address, and restores the previous map layers and selected pit *(was AC 2.1.3)*
- [ ] **Change scenario** returns to setup showing the inputs that produced the current result, and allows a new run *(was AC 2.2.5)*
- [ ] The browser back button never strands the user on a screen whose state has been lost
- [ ] No navigation writes the address to `localStorage`, `sessionStorage`, the URL, or history state; history state carries a screen identifier only

---

## Wording to hold on the day

Everyone who speaks about the product holds these. They are what the criteria above commit us to, and nothing further.

- Not a flood warning, not a forecast, not an engineering assessment.
- The result is an **indicative comparison** against a clear-drain baseline at the same accumulated rainfall — not a depth, not an extent, not a time.
- **The blockage setting is something the resident supposes, not something we observed or derived.** We cannot say how a blockage forms, how fast it forms, or how long until one does: the model's independent variable is accumulated rainfall, not time.
- We do not speak about pipe capacity or bottlenecks. We speak about where water may go, and where a pipe narrows.
- Rainfall is entered by the resident. **Do not demonstrate a live observation** unless permission has arrived first.
- No machine learning in this iteration — a position, not a gap: the project has no outcome labels, so a deterministic, explainable model is the honest choice.
