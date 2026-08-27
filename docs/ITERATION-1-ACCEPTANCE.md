# Iteration 1 — acceptance criteria

DrainLens · TA28 · demonstration **Tuesday 1 September 2026**

What "done" means. The work that produces it is in [ITERATION-1-TASKS.md](./ITERATION-1-TASKS.md), where every task names the criterion below that it serves.

**Tick a criterion only when it has been seen working on the deployed build** — not when the code that should satisfy it has been merged.

**Source:** *Epics, User Stories and Acceptance Criteria*, revision received 27 August 2026. That revision replaced six broad criteria with twenty, restructured around interactions rather than user stories, and added navigation and state-retention requirements that did not exist before. Where this file and that document disagree, the document wins and this file has a bug.

**Scope:** Epic 1 and Epic 2 are Must Have. Epic 3 is Iteration 2.
**Deliberately out of scope:** machine learning, live rainfall, capacity or bottleneck claims, absolute ponding depth or extent, water arrival time, blockage formation over time.

> ### ⚠ One criterion is unresolved
>
> **AC 2.2.3 requires three comparison views — All clear, Blockage and Difference. AD7 in the System Architecture forbids exactly that**, on the grounds that the capture fraction is an assumed value and an absolute-looking layer invites a reading the model cannot support. The engine currently returns only the difference.
>
> One of the two has to move. This is a product decision, not a technical one, and it blocks the view switcher but nothing else. See the note under AC 2.2.3.

---

## US 1.1 — Explore water flow near an address

### AC 1.1.1 — Select a supported address

*Given the user is on the address search page, when they enter and confirm a recognised address within the supported pilot area, then the system will:*

- [ ] **1.1.1.a** Display the selected address
- [ ] **1.1.1.b** Open the task-selection page
- [ ] **1.1.1.c** Present the options *Follow local water and drainage*, *Compare a drain-blockage scenario* and *Explore the full map*
- [ ] **1.1.1.d** Allow the user to continue without creating an account
- [ ] **1.1.1.e** Retain the selected address **only for the current browser session**

> **1.1.1.e is verified by inspection, not by trust:** open the network panel, search an address, and confirm no request carries it. `assertSendable` in `@drainlens/schema` guards the code path; the manual check guards the guard.

### AC 1.1.2 — Follow local water and drainage

*Given a supported address is selected and the user is on the task-selection page, when they select "Follow local water and drainage", then the system will:*

- [ ] **1.1.2.a** Open a local map centred on and marking the selected address
- [ ] **1.1.2.b** Show likely surface-water paths and nearby drainage pits **by default**
- [ ] **1.1.2.c** Provide a short plain-English explanation of where water near the address may move
- [ ] **1.1.2.d** Display **one clear next-step instruction** asking the user to select a surface-water path or drainage pit
- [ ] **1.1.2.e** Make other layers available through a **collapsed** "More map layers" section
- [ ] **1.1.2.f** Clearly identify any missing, incomplete or uncertain information

### AC 1.1.3 — Explore the full map

*Given a supported address is selected and the user is on the task-selection page, when they select "Explore the full map", then the system will:*

- [ ] **1.1.3.a** Open a local map centred on and marking the selected address
- [ ] **1.1.3.b** Provide controls for the terrain, surface-water path, low-area, drainage-pit and drainage-pipe layers
- [ ] **1.1.3.c** Allow individual layers to be turned on or off
- [ ] **1.1.3.d** **Distinguish official recorded data from system-derived information**
- [ ] **1.1.3.e** Clearly identify information that is missing, incomplete or uncertain

### AC 1.1.4 — Enter an unsupported address

*Given the user is on the address search page, when they enter and confirm an address outside the supported pilot area, then the system will:*

- [ ] **1.1.4.a** Explain that detailed local drainage information is not available for that address
- [ ] **1.1.4.b** **Not** present local drainage results as if supported data were available
- [ ] **1.1.4.c** Allow the user to enter a different address

> The pilot area is the City of Melbourne, bounded by drainage asset coverage rather than terrain. Most of Greater Melbourne will land here, so this path is a main flow, not an edge case.

### AC 1.1.5 — Choose another task

*Given a supported address is selected and the user is on a task page, when they select "Choose another task", then the system will:*

- [ ] **1.1.5.a** Return to the task-selection page
- [ ] **1.1.5.b** Retain the selected address for the current browser session

### AC 1.1.6 — Change the selected address

*Given an address is selected and the user is on a task page, when they select "Change address", then the system will:*

- [ ] **1.1.6.a** Return to the address search page
- [ ] **1.1.6.b** Display the current address in the search field
- [ ] **1.1.6.c** Retain the current address-related state **until a different address is confirmed**

---

## US 1.2 — Follow the downstream drainage path

### AC 1.2.1 — Select a drainage pit

*Given the user is viewing a local map containing recorded drainage pits, when they select a pit, then the system will:*

- [ ] **1.2.1.a** Highlight the selected pit
- [ ] **1.2.1.b** Display the available recorded information for that pit
- [ ] **1.2.1.c** **Identify the information as official recorded data**
- [ ] **1.2.1.d** Provide an option to follow its recorded downstream connection

> 1.2.1.c pushes provenance down to the individual pit. Every value shown here travels with the basis that produced it — see `packages/schema/src/provenance.ts`, where a value without a basis has no constructible shape.

### AC 1.2.2 — Follow the recorded downstream path

*Given a pit with an available recorded downstream connection is selected, when they select "Follow the recorded downstream path", then the system will:*

- [ ] **1.2.2.a** Highlight the selected pit and its available recorded downstream pipes
- [ ] **1.2.2.b** Show the recorded direction of the drainage path
- [ ] **1.2.2.c** Continue the path to the recorded outlet or the last known connection
- [ ] **1.2.2.d** Clearly identify any missing or uncertain connection
- [ ] **1.2.2.e** **Avoid completing the path using unsupported or inferred pipe connections**

> Three behaviours are load-bearing and each needs its own test: the cycle guard (18 back-edges across 34 nodes exist in the real data, and a trace without a guard would not terminate on them), branch handling (multiple downstream paths are the normal case and must never collapse to one), and the termination reason — outlet, data boundary, or missing connection, and the interface must say which.
>
> The graph builder already supports 1.2.2.d and 1.2.2.e: a pipe whose downstream pit is absent from the export becomes an edge with **no destination** rather than no edge at all, so the path reaches it and stops there with that reason.

---

## US 1.3 — View the street and underground drainage

### AC 1.3.1 — View an available street cross-section

*Given a pit or pipe with sufficient recorded information is selected, when the user opens the street cross-section, then the system will:*

- [ ] **1.3.1.a** Show a simplified relationship between the street surface, the selected pit and the connected underground pipes
- [ ] **1.3.1.b** Show recorded pipe direction and depth **where the data supports them**
- [ ] **1.3.1.c** Distinguish recorded information from simplified system presentation
- [ ] **1.3.1.d** Clearly identify any missing or uncertain depth information
- [ ] **1.3.1.e** **Avoid any claim about pipe capacity, underground blockage, or whether the pipe is adequate**

> Depth will be absent almost everywhere — invert values are 95.4% missing and the surviving fraction is internally inconsistent. 1.3.1.b is satisfied by showing depth where it exists and omitting it where it does not. Do not interpolate. 1.3.1.e is AD6 restated as a criterion.

### AC 1.3.2 — Cross-section information is insufficient

*Given the selected location lacks sufficient verified depth or connection information, when the user attempts to open the cross-section, then the system will:*

- [ ] **1.3.2.a** Explain that a reliable cross-section cannot be provided for that location
- [ ] **1.3.2.b** Identify which required information is missing or uncertain
- [ ] **1.3.2.c** **Not** fill missing values using unsupported assumptions

---

## US 2.1 — Set up a local blockage scenario

### AC 2.1.1 — Open the scenario explorer

*Given a supported address is selected and the user is on the task-selection page or the local drainage map, when they select "Compare a drain-blockage scenario", then the system will:*

- [ ] **2.1.1.a** Open the scenario setup page
- [ ] **2.1.1.b** Present the setup in order: select a pit → choose a blockage setting → choose accumulated rainfall → run the comparison
- [ ] **2.1.1.c** Carry over a drainage pit **only** when the user previously selected that pit
- [ ] **2.1.1.d** Otherwise present a nearby pit as a **clearly labelled suggestion requiring confirmation**
- [ ] **2.1.1.e** Leave the blockage setting **unselected** until the user chooses

> 2.1.1.d and 2.1.1.e are the same instinct as the rest of the product: the system may suggest, but it does not decide on the resident's behalf and then present the decision as theirs.

### AC 2.1.2 — Complete the scenario inputs

*Given the user is on the scenario setup page, when they confirm one pit, select a blockage setting and select an accumulated rainfall within the supported range, then the system will:*

- [ ] **2.1.2.a** Allow only one drainage pit to be changed in the scenario
- [ ] **2.1.2.b** Allow the blockage setting to be **Clear**, **Partly blocked** or **Fully blocked**
- [ ] **2.1.2.c** Display the accumulated rainfall in **millimetres**
- [ ] **2.1.2.d** **Explain that the blockage setting is a scenario assumption, not the pit's observed current condition**
- [ ] **2.1.2.e** **Explain that the accumulated rainfall is a user-selected assumption, not an observation or a forecast**
- [ ] **2.1.2.f** Show the selected pit, blockage setting, accumulated rainfall and local calculation area in a scenario summary
- [ ] **2.1.2.g** Enable the user to run the comparison

> **2.1.2.d is the answer to a question a reviewer already asked** — how does the model calculate deposit speed under a large water flow? It does not. The setting is an assumption held constant for the whole scenario, and AD13 records why: the model's independent variable is accumulated rainfall, not time, so no rate can come out of it. Three tests in `packages/scenario` hold that line. This criterion is what makes the interface say so too.
>
> **2.1.2.e** keeps the rainfall field honest while live observation stays a conditional extension outside the MVP.

### AC 2.1.3 — Return from the scenario setup

*Given setup was opened from the task-selection page or the local drainage map, when the user selects the contextual back action, then the system will:*

- [ ] **2.1.3.a** Return to the page it was opened from
- [ ] **2.1.3.b** Retain the selected address
- [ ] **2.1.3.c** Restore the previous map layers and selected pit when returning to the map

---

## US 2.2 — Compare the blockage scenario

### AC 2.2.1 — Run the scenario comparison

*Given all required inputs are complete, when the user selects "Run comparison", then the system will:*

- [ ] **2.2.1.a** Compare the selected blockage with an all-clear baseline **within the same local calculation area**
- [ ] **2.2.1.b** Compare both conditions **at the same accumulated rainfall amount**
- [ ] **2.2.1.c** Open the **Difference** view by default
- [ ] **2.2.1.d** Keep the selected pit and its connected downstream path visible
- [ ] **2.2.1.e** Identify supported result areas as **No clear change** or **Higher than baseline**
- [ ] **2.2.1.f** Display **Insufficient information** where the data does not support a clear comparison
- [ ] **2.2.1.g** Describe the result as an indicative comparison based on simplified assumptions, **not a live flood prediction**

> **2.2.1.f is not yet implemented.** The band exists in the shared vocabulary but the engine never emits it. Two distinct triggers were conflated when the engine was written and should not be: **data availability** — no terrain or depression artefact covers the window, or the selected pit has no usable record — which is implementable now; and **result robustness**, which depends on the capture-fraction sensitivity run and cannot be given a threshold before that exists.

### AC 2.2.2 — Change the accumulated rainfall level

*Given a completed comparison is displayed, when the user moves the rainfall control, then the system will:*

- [ ] **2.2.2.a** Display the selected level in millimetres
- [ ] **2.2.2.b** Update **both** the all-clear baseline and the blockage scenario to that same level
- [ ] **2.2.2.c** Update the displayed difference without changing the selected pit or blockage setting
- [ ] **2.2.2.d** **Explain that the control shows how the comparison changes as rainfall accumulates, not when water will reach a location**

> Every position is solved independently from zero, so moving the control cannot make an earlier position disagree with itself. A test asserts that solving four positions and solving one give the same answer at the rainfall they share.

### AC 2.2.3 — Change the comparison view

*Given a completed comparison is displayed, when the user selects "All clear", "Blockage" or "Difference", then the system will:*

- [ ] **2.2.3.a** Display the selected view
- [ ] **2.2.3.b** Retain the same pit, blockage setting and rainfall level
- [ ] **2.2.3.c** Clearly identify which view is active
- [ ] **2.2.3.d** Preserve the distinction between the all-clear baseline and the user-selected scenario

> **⚠ Unresolved: this criterion contradicts AD7.** The architecture forbids a standalone ponding layer because the capture fraction is an assumed value and an absolute-looking map invites a reading the model cannot support. The All clear and Blockage views are exactly that. The engine returns only the difference today.
>
> A middle path, if the team wants the views: allow all three, but let the two absolute views carry **no numeric scale of any kind** — no depth, no area, no legend in metres — showing relative distribution only, under a heading that names it an indicative distribution under an assumed condition. That keeps the comparison readable without producing a figure anyone can quote.
>
> **Needs a decision from the product owner and the architecture owner together. It blocks the view switcher and nothing else.**

### AC 2.2.4 — Return to the scenario setup

*Given a completed comparison is displayed, when the user selects "Back to scenario setup", then the system will:*

- [ ] **2.2.4.a** Return to the scenario setup page
- [ ] **2.2.4.b** Retain the previously selected pit, blockage setting and rainfall amount

### AC 2.2.5 — Change and rerun the scenario

*Given a completed comparison is displayed, when the user selects "Change scenario", then the system will:*

- [ ] **2.2.5.a** Return to the scenario setup page
- [ ] **2.2.5.b** Display the inputs that produced the current result
- [ ] **2.2.5.c** Allow an input to be changed and a new comparison run

---

## US 2.3 — Understand the scenario result

### AC 2.3.1 — Open the result explanation

*Given a completed comparison is displayed, when the user opens "How this result was produced", then the system will:*

- [ ] **2.3.1.a** Summarise the selected pit, blockage setting and accumulated rainfall
- [ ] **2.3.1.b** Explain in plain English how the blockage assumption changes the indicative build-up compared with the all-clear baseline
- [ ] **2.3.1.c** **Distinguish official recorded data, system-derived indicative results and user-selected assumptions**
- [ ] **2.3.1.d** Explain the simplified assumptions the comparison uses
- [ ] **2.3.1.e** Identify important missing or uncertain information
- [ ] **2.3.1.f** State that the comparison does not estimate water-routing time, flood arrival time or live flood conditions

> 2.3.1.c is what the provenance record exists for, and it cannot be met by styling text at render time. Every value carries a basis: a data version, a derivation, an entry in the assumption register, or a model version. 2.3.1.d needs that register to exist — it is a build artefact, and without it the "assumed" label points at nothing.

### AC 2.3.2 — Explain an unclear result

*Given the data does not support a clear comparison, when the user opens "How this result was produced", then the system will:*

- [ ] **2.3.2.a** Explain why the comparison is unclear
- [ ] **2.3.2.b** Identify the missing or uncertain information affecting it
- [ ] **2.3.2.c** Display **Insufficient information** instead of assigning a strong result category
- [ ] **2.3.2.d** **Avoid presenting the result as evidence of real-world flood prediction accuracy**

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

## Wording to hold on the day

Everyone who speaks about the product holds these. They are what the criteria above commit us to, and nothing further.

- Not a flood warning, not a forecast, not an engineering assessment.
- The result is an **indicative comparison** against a clear-drain baseline at the same accumulated rainfall — not a depth, not an extent, not a time.
- **The blockage setting is something the resident supposes, not something we observed or derived.** We cannot say how a blockage forms, how fast it forms, or how long until one does: the model's independent variable is accumulated rainfall, not time.
- We do not speak about pipe capacity or bottlenecks. We speak about where water may go, and where a pipe narrows.
- Rainfall is entered by the resident. **Do not demonstrate a live observation** unless permission has arrived first.
- No machine learning in this iteration — a position, not a gap: the project has no outcome labels, so a deterministic, explainable model is the honest choice.
