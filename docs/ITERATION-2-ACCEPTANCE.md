# Iteration 2 — acceptance criteria

DrainLens · TA28 · demonstration **date to be confirmed**

What "done" means for Epic 3 and Epic 4. The work that produces it is in [ITERATION-2-TASKS.md](./ITERATION-2-TASKS.md).

**Tick a criterion only when it has been seen working on the deployed build** — not when the code that should satisfy it has been merged. Nothing below is ticked, because nothing below has been seen on an Iteration 2 build.

**Source:** *Iteration 2 Requirements*, received **10 September 2026**. Epic 3 and Epic 4 are both **Must Have** (US 3.1–3.3, US 4.1–4.3). Epic 5 is Should / Could / Will not have and has no criteria here. Where this file and that document disagree, the document wins and this file has a bug.

**134 sub-criteria: 56 in Epic 3, 78 in Epic 4.** Iteration 1 had 96.

---

## The one measurement that shapes this iteration

**Blocking one drain produces no visible difference at any rainfall from 20 to 200 mm.** This was measured during Iteration 1, and the reason is physical rather than a defect. It is recorded in full in [DECISIONS-PENDING.md §1](./DECISIONS-PENDING.md); the short version, at 60 mm over the pilot square kilometre:

| Inlets blocked | Extra ponding | Deepest rise | Cells above the reporting threshold |
|---:|---:|---:|---:|
| 1 | 0.0 m³ | 0.0 mm | 0 |
| 5 | 5.9 m³ | 2.5 mm | 0 |
| 100 | 13.9 m³ | 5.6 mm | 0 |
| 475 — every inlet in the extent | 1,772 m³ | 374 mm | 19,652 |

The recorded network in Kensington is **redundant**: water a blocked inlet rejects is taken by the inlets below it, and what escapes them spreads across hollows large enough to absorb it invisibly. The median inlet has **0.036 m³** to release against a 0.05 m³ reporting threshold — it is below the threshold before any arithmetic happens.

**Epic 3 is satisfiable, and it will mostly answer *No clear change*.** That is not a failure of AC 3.1.3. The criterion asks for the two bands to be distinguished, and then explicitly requires the interface to **avoid implying that No clear change means the location has no blockage or flood concern** (3.1.3.f), with AC 3.3.2.h requiring that meaning to be stated outright. The criteria were written for this answer.

What must not happen is the one change that would make the screen look better and the product worse: reporting the rise in millimetres. The ground surface is derived from aerial photography quoted at about **25 cm** accuracy, and a computed 0.7 mm rise is roughly **350 times finer than the data own error bar**. AC 3.2.2.e — *avoid converting the result into flood depth, severity or risk categories* — closes that door, and it should stay closed.

> **Say it as a finding, not as an apology.** We built the comparison, then tested whether it could tell us anything. In this square kilometre it cannot, because the network is redundant — and we would rather report that than tune an assumption until the screen showed something.

---

## Where this stands, 11 September 2026

### Epic 3 — mostly built, and unreachable on purpose

The scenario explorer **is** Iteration 1 old Epic 2, demonstrated on 1 September and then taken out of the interface by AC 1.1.1.e. `packages/scenario`, `apps/web/src/scenario/`, `screens/ScenarioSetup.tsx`, `screens/Result.tsx`, `map/difference.ts` and the scenario parts of `session.ts` are all in the repository and all still tested, with the comparison unreachable.

**Three things in Epic 3 are genuinely new, and one of them changes the engine.**

| | |
|---|---|
| **AC 3.1.2.c** — *allow only the selected drainage location to have its blockage assumption changed* | **This contradicts what was built.** The Iteration 1 blockage setting is constant for the whole scenario, and `packages/scenario` has tests holding that line against AC 2.1.2.d (Aug-27 set). Per-location blockage is a change to the engine input, not to a screen |
| **AC 3.1.1.a and 3.1.1.d** — identify and distinguish locations that support scenario calculation | Iteration 1 let a person choose any pit and told them afterwards, through the data-sufficiency gate. Saying so **before** the choice is new, and needs the sufficiency question to be answerable without running the scenario |
| **AC 3.2.3.b** — *only rainfall levels supported and validated by the current scenario model* | `RAINFALL_RANGE_MM` is a continuous 0–120 mm range today. A set of validated levels is a different thing from a range, and which levels have been validated has to be decided and written down |

Everything else in Epic 3 has an implementation to point at: two bands (`COMPARISON_BANDS`), four named insufficiency reasons (`INSUFFICIENCY_REASONS`), difference-only output, the caching worker that lets rainfall move without re-running, and the *Why this is usually the answer here* explanation on the result screen.

### Epic 4 — the board exists; the map, the score and the events do not

Iteration 1 Epic 2 shipped a **ranked board** of 30 Greater Melbourne SA2 areas, verified against its own Data Quality Statement: 13,339 SA1 regions, **144 suppressed**, six financial years from 1 July 2009 to 30 June 2015, counting VICSES *Flood* dispatches only. See [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md).

Epic 4 asks for three things that board is not:

| Wanted | What exists | What is missing |
|---|---|---|
| A **map** of Greater Melbourne statistical areas, coloured by dispatch count (4.1.1, 4.1.2) | A ranked list. `flood-history.json` carries names, totals, per-year counts and coverage — **and no geometry at all** | SA2 boundary polygons (ABS ASGS 2011), and a decision about how a roughly 10,000 km² map in latitude and longitude coexists with a metre-framed local one |
| A population-based **Severity Score** (4.1.3, 4.3.2) | The `population` table, **declared and deliberately empty**: the dataset is not in the repository and has not been reconciled against its own documentation or matched to ASGS 2011 | The ABS population data, that reconciliation, and a written definition of the score |
| **Verified flood events** with sources (4.2) | Nothing. There is no events table and no editorial process | A table, the events themselves, team-written summaries, source links, and a review step that makes "verified" mean something |

**The suppression work is already done, and it lands straight on 4.1.5 and 4.1.6.** `flood_area_coverage.complete` is false wherever a region inside an area was withheld — **nine of the thirty published areas** — and the board already shows those totals as floors. `Exact / Minimum value / Not available` is that same distinction with a third state added for a missing denominator.

---

## Numbering — read this before citing an AC in a comment

**`AC 3.x` is ambiguous in this repository and has to be qualified.** Comments in `apps/web/src/scenario/`, `screens/ScenarioSetup.tsx`, `screens/Result.tsx`, `map/difference.ts` and parts of `session.ts` cite `AC 2.x (Aug-27 set)` — the 27 August document, where the scenario explorer was Epic 2. Those numbers are not the ones below.

From here on: **a scenario criterion cited without a suffix is this document.** When touching a comment that carries `(Aug-27 set)`, either leave it exactly as it is or re-map it to the Iteration 2 number and drop the suffix. Doing half of that is how the Iteration 1 renumbering hurt.

| Aug-27 set | Iteration 2 | |
|---|---|---|
| 2.1.1 Select a drainage location | **3.1.1** | Gains *identify* and *distinguish* unsupported locations |
| 2.1.2 Set scenario assumptions | **3.1.2** | Gains per-location blockage, which the engine does not do |
| 2.2.1 Run the comparison | **3.1.3** | Substantially the same |
| 2.2.2 Change rainfall | **3.2.1** + **3.2.2** | Split |
| 2.2.3 / 2.3.2 Data sufficiency | **3.1.4** + **3.3.3** | Split into the failed-run state and the uncertainty explanation |
| 2.3.1 Result explanation | **3.3.1** + **3.3.2** | Split into *how* and *limitations*; the limitations list grew to nine |
| — | **3.2.3** | New: explain the rainfall levels |

---

## Epic 3 — Rainfall and drainage blockage scenario explorer

*As a user, I want to explore how water build-up near a location may change under different rainfall and drainage blockage conditions, so that I can better understand how local drainage conditions may affect the area.*

## US 3.1 — Explore a local drainage scenario

### AC 3.1.1 — Select a supported drainage location

*Given the user is viewing the local drainage map, when the user opens the Scenario Explorer, then the system will:*

- [ ] **3.1.1.a** Identify drainage locations that currently support scenario calculation
- [ ] **3.1.1.b** Allow the user to select one supported drainage location
- [ ] **3.1.1.c** Keep the selected location visible on the map
- [ ] **3.1.1.d** Distinguish locations that do not support scenario calculation
- [ ] **3.1.1.e** Avoid implying that an unsupported location has no drainage or flood concern

> **a and d are the new work, and they need a cheap sufficiency test.** Iteration 1 answered *can this location be calculated?* by running the calculation and catching the failure — four named reasons, applied in order. Marking pits on the map before anybody chooses means answering `terrain_unavailable` and `invalid_inlet` from the artefacts alone, which both can be: they are coverage-mask and inlet-classification questions. `scenario_calculation_failed` and `comparison_not_comparable` can only be known by running, which is why 3.1.4 still has to exist.
>
> **e is the one to word carefully.** An unmarked pit means *we cannot compute a scenario here*, which is a statement about the coverage of a derived terrain surface — not about the drain. The wording must not let a resident read a grey marker as "this drain is fine".

### AC 3.1.2 — Set scenario assumptions

*Given the user has selected a supported drainage location, when the user sets up a scenario, then the system will:*

- [ ] **3.1.2.a** Allow the user to select a supported accumulated rainfall level
- [ ] **3.1.2.b** Allow the blockage assumption to be **Clear**, **Partly blocked** or **Fully blocked**
- [ ] **3.1.2.c** Allow only the selected drainage location to have its blockage assumption changed
- [ ] **3.1.2.d** Clearly label the blockage setting as a **user-selected scenario assumption**, not an observed drain condition
- [ ] **3.1.2.e** Clearly label accumulated rainfall as a **scenario input**, not a rainfall observation or weather forecast
- [ ] **3.1.2.f** Show the selected drainage location, blockage assumption and rainfall level before the scenario is run

> **b is already the vocabulary.** `BLOCKAGE_SETTINGS` is exactly `['clear', 'partly-blocked', 'fully-blocked']`, and `isBlockageSetting('mostly-blocked')` is false in a test.
>
> **c is an engine change and the riskiest item in Epic 3.** The engine today applies one blockage setting to every inlet, and `packages/scenario` asserts that. Moving to a per-inlet setting changes the scenario input shape, the worker cache key, and the checks. It is also the change that makes the measurement above bite hardest: a single blocked inlet is the case measured at **0.0 m³ of extra ponding**, so this criterion delivers precisely the scenario that is guaranteed to return *No clear change*.
>
> Build it anyway, and say what it means. The alternative — leaving the setting global while a screen says it applies to one drain — is the interface making a claim the model does not keep.
>
> **d and e are labels Iteration 1 already carries.** `visibleConditionIsNotABlockageSetting` is a schema constant precisely so that "what the drain looks like" and "what you assumed" cannot be confused.

### AC 3.1.3 — Run the local scenario

*Given the user has selected a supported drainage location, blockage assumption and rainfall level, when the user runs the scenario, then the system will:*

- [ ] **3.1.3.a** Calculate the selected blockage scenario and an all-clear baseline using the same accumulated rainfall level
- [ ] **3.1.3.b** Compare the selected scenario with the all-clear baseline
- [ ] **3.1.3.c** Keep the selected drainage location visible
- [ ] **3.1.3.d** Show where the scenario produces **higher water build-up than the clear baseline**, where supported by the calculation
- [ ] **3.1.3.e** Distinguish **Higher than baseline** from **No clear change**
- [ ] **3.1.3.f** Avoid implying that No clear change means the selected drainage location has no blockage or flood concern
- [ ] **3.1.3.g** Describe the result as an indicative scenario comparison rather than a prediction of real flood conditions

> **a, b, d and e are built.** The engine solves each position independently from zero, outputs the difference from the all-clear baseline and nothing else, and `COMPARISON_BANDS` is two members long. Mass balance closes exactly: 60,000 m³ of rain over the extent accounted for as 13,610 captured, 23,407 ponded and 22,983 leaving the window.
>
> **f is the criterion the measurement above exists to serve.** The result screen already carries *Why this is usually the answer here* whenever the band is `no-clear-change`: the drains below take the water, what gets past spreads out, and we will not report a change finer than the ground data.

### AC 3.1.4 — Handle insufficient scenario information

*Given the selected location does not contain the information required for a valid scenario calculation, when the user attempts to run the scenario, then the system will:*

- [ ] **3.1.4.a** Display **Insufficient information**
- [ ] **3.1.4.b** Explain the relevant reason for the unavailable result
- [ ] **3.1.4.c** Avoid generating or estimating an unsupported scenario result
- [ ] **3.1.4.d** Avoid assigning **Higher than baseline** or **No clear change** when the calculation was not completed
- [ ] **3.1.4.e** Allow the user to select another supported drainage location

> **Built, and the distinction in d is structural rather than a convention.** `RESULT_STATUSES` is `['successful', 'insufficient-information']`, and a comparison band exists only on a successful result — there is no shape in which a band and an insufficiency coexist.
>
> The four reasons in b are `terrain_unavailable`, `invalid_inlet`, `scenario_calculation_failed` and `comparison_not_comparable`, applied in order, each explained by the interface in its own words. A missing downstream connection is **not** one of them: it travels as a `NETWORK_LIMITATION` reported *alongside* a successful result, because the surface calculation does not depend on where a pipe leads.

## US 3.2 — Explore changes across rainfall levels

### AC 3.2.1 — Change the accumulated rainfall level

*Given the system has completed a scenario calculation, when the user selects another supported accumulated rainfall level, then the system will:*

- [ ] **3.2.1.a** Retain the selected drainage location
- [ ] **3.2.1.b** Retain the selected blockage assumption
- [ ] **3.2.1.c** Apply the same selected rainfall level to both the blockage scenario and the all-clear baseline
- [ ] **3.2.1.d** Update the displayed comparison for the selected rainfall level
- [ ] **3.2.1.e** Allow the user to move between supported rainfall levels without changing the scenario location

> **Built, and how it is built is why moving the control is instant.** The worker runs once on *Run comparison* and caches every position; the rainfall control reads the cache and never re-runs. That also makes c structural rather than careful: one run produces the scenario and its baseline at the same rainfall, so the two cannot drift apart.

### AC 3.2.2 — Compare results across rainfall levels

*Given results are available for more than one supported rainfall level, when the user moves between the rainfall levels, then the system will:*

- [ ] **3.2.2.a** Show the comparison result associated with each rainfall level
- [ ] **3.2.2.b** Update the displayed **Higher than baseline** areas where applicable
- [ ] **3.2.2.c** Show **No clear change** where the calculation does not identify a clear difference
- [ ] **3.2.2.d** Avoid implying that the result must increase continuously as rainfall increases
- [ ] **3.2.2.e** Avoid converting the result into flood depth, severity or risk categories

> **d has a test behind it in the engine pointing the other way, and both are needed.** `engine.monotonicity.test.ts` asserts that *ponding* must not shrink as rainfall increases — a physical invariant of the model. The *comparison* carries no such guarantee: a difference can appear at one level and vanish at the next as a hollow fills and spills. The screen must not draw a ladder.
>
> **e is the defence against the trap in [DECISIONS-PENDING.md §1](./DECISIONS-PENDING.md), Option B.** Do not put millimetres on screen. 0.7 mm against a 25 cm error bar is presenting noise as a finding.

### AC 3.2.3 — Explain the rainfall levels

*Given the user is exploring accumulated rainfall levels, when the rainfall control or its explanation is displayed, then the system will:*

- [ ] **3.2.3.a** Display accumulated rainfall in millimetres
- [ ] **3.2.3.b** Provide only rainfall levels supported and validated by the current scenario model
- [ ] **3.2.3.c** Explain that accumulated rainfall represents a simplified total amount
- [ ] **3.2.3.d** Explain that the scenario does not model rainfall intensity or duration
- [ ] **3.2.3.e** State that the rainfall levels are not a weather forecast or prediction of a future storm

> **b needs a decision that has not been taken.** `RAINFALL_RANGE_MM` is `{ min: 0, max: 120 }` — a continuous range, validated as a range. "Supported and validated levels" is a discrete set, and which set it is has to be chosen and recorded: the sensitivity work used 20, 60 and 200 mm, and 200 is outside the published range. Pick the levels, write down why each one is in, and let the control offer those and nothing else.

## US 3.3 — Understand the scenario result

### AC 3.3.1 — Explain how the result was produced

*Given a scenario result is displayed, when the user opens the result explanation, then the system will:*

- [ ] **3.3.1.a** Summarise the selected drainage location, blockage assumption and accumulated rainfall level
- [ ] **3.3.1.b** Explain that the result compares the selected blockage scenario with an all-clear baseline under the same rainfall level
- [ ] **3.3.1.c** Explain in plain English that the displayed areas represent additional water build-up relative to the clear baseline
- [ ] **3.3.1.d** Distinguish recorded source data, system-derived information and user-selected assumptions
- [ ] **3.3.1.e** Explain the simplified assumptions used in the scenario calculation

> **d is the provenance system, already in the artefacts.** Every artefact carries a `basis` of `sourceProvided`, `derived`, `assumed` or `inferred`, and the result screen groups by it rather than labelling each line by hand. The three categories the criterion names map onto the first, the second and the third.

### AC 3.3.2 — Explain important limitations

*Given the user is viewing the scenario explanation, when the limitations are displayed, then the system will clearly state that:*

- [ ] **3.3.2.a** The blockage condition is assumed rather than observed
- [ ] **3.3.2.b** Accumulated rainfall is an input rather than a weather forecast
- [ ] **3.3.2.c** The model does not determine the rainfall amount at which a drain will fail
- [ ] **3.3.2.d** Actual pipe hydraulic capacity is not modelled
- [ ] **3.3.2.e** The result does not show validated flood depth or water depth
- [ ] **3.3.2.f** The result does not estimate flood arrival time
- [ ] **3.3.2.g** The result does not provide flood probability or a risk score
- [ ] **3.3.2.h** A **No clear change** result means the simplified calculation did not identify a clear difference from the all-clear baseline, and does **not** mean that blockage would have no effect under real flood conditions
- [ ] **3.3.2.i** The result only shows differences relative to the all-clear baseline within the supported calculation area

> **d is a standing commitment of this product, not a new sentence.** Invert data is 95.4% missing and no capacity model is built anywhere in this repository. The narrowing indicator is a geometric step-down between nominal pipe sizes and is labelled as one.
>
> **h is the most important sentence in Epic 3**, and it is the difference between an honest null result and a misleading one. It should not be buried under *More information*. The measurement at the top of this file is what makes it true, and the numbers are there if anybody asks.
>
> **i has a boundary that is about to move.** "The supported calculation area" is the Kensington square kilometre — the terrain surface exists there and nowhere else — while the drainage map is now the whole City of Melbourne. Where that boundary is drawn on screen is [DECISIONS-PENDING.md §8](./DECISIONS-PENDING.md), open and deferred to 13 September, and Epic 3 cannot be finished without it.

### AC 3.3.3 — Explain data uncertainty

*Given the scenario relies on recorded, derived or incomplete local data, when the user opens the result explanation, then the system will:*

- [ ] **3.3.3.a** Identify important missing or uncertain data affecting the scenario
- [ ] **3.3.3.b** Identify where important terrain or drainage information is derived rather than directly measured
- [ ] **3.3.3.c** Avoid replacing missing information with unsupported assumptions
- [ ] **3.3.3.d** Explain how these limitations affect how strongly the result should be interpreted

> **b has something specific to say and it should be said plainly.** The ground surface is **photogrammetric, not LiDAR** — a camera cannot see through a tree canopy, so under vegetation the surface is interpolated rather than measured. 52.1% of cells in the extent are measured. A test fails if the words "LiDAR DTM" appear anywhere in the product.

---

## Epic 3 — definition of done

From *Iteration 2 Requirements*.

- [ ] Users can select a supported drainage location, choose **Clear, Partly blocked or Fully blocked**, select a supported accumulated rainfall level, and run a local drainage scenario
- [ ] The system compares the selected blockage assumption with an **all-clear baseline using the same rainfall level** and shows only the supported comparison result: **Higher than baseline** or **No clear change**
- [ ] Users can move between supported rainfall levels while keeping the selected drainage location and blockage assumption, and the displayed comparison updates correctly for each level
- [ ] The scenario clearly distinguishes **recorded information, system-derived results and user-selected assumptions**, and explains that the blockage condition and rainfall amount are scenario inputs rather than observed or forecast conditions
- [ ] Unsupported or incomplete scenario locations display **Insufficient information** with a clear explanation and do not generate unsupported results, flood-depth values, risk scores or predictions
- [ ] Scenario results have been checked across the supported drainage locations, blockage assumptions and rainfall levels, and the result explanation accurately communicates the main assumptions and limitations
- [ ] All Epic 3 acceptance criteria have passed the agreed functional and data checks, and all identified critical and high-priority defects affecting the scenario journey or result interpretation are resolved

---

## Epic 4 — Explore local flood history and severity

*As a user, I want to explore historical flood-related records and population-based flood severity across local areas, so that I can understand how flooding has been recorded in the past and where the potential community impact may be greater.*

## US 4.1 — Explore historical flood activity and severity

### AC 4.1.1 — Switch between map modes

*Given the user opens the Greater Melbourne historical flood map, when the map is loaded, then the system will:*

- [ ] **4.1.1.a** Provide a **Historical Flood Activity** mode and a **Severity Score** mode
- [ ] **4.1.1.b** Allow the user to switch between the two modes without leaving the map
- [ ] **4.1.1.c** Retain the same map location and selected area when switching modes
- [ ] **4.1.1.d** Clearly show which mode is currently active
- [ ] **4.1.1.e** Avoid presenting either mode as a prediction of current or future flooding

> **"The Greater Melbourne historical flood map" does not exist yet, and this is the largest single item in Iteration 2.** What exists is a ranked list of thirty names. A map needs SA2 boundary polygons, which are not in the repository and are not in `flood-history.json`.
>
> **It is also a second kind of map.** Everything drawn today lives in one extent metre frame, north-up, with a single affine transform and no projection at run time — a deliberate choice for a square kilometre, and then for 76 km². Greater Melbourne is roughly 10,000 km² and its boundaries are published in latitude and longitude. Deciding how that is drawn is an architecture decision, not a component: either a second projection at build time in the pipeline, or a basemap library the product has so far not needed. Take it in week one, not in week two.
>
> **c is cheap if the two modes are two paint functions over one viewport, and expensive if they are two screens.** Build them as one map with a mode switch.

### AC 4.1.2 — View historical flood activity

*Given the user selects Historical Flood Activity mode, when the map is displayed, then the system will:*

- [ ] **4.1.2.a** Show the available Greater Melbourne statistical areas
- [ ] **4.1.2.b** Use colour intensity to show fewer or more recorded flood-related SES crew dispatches
- [ ] **4.1.2.c** Show the historical reporting period
- [ ] **4.1.2.d** Show the actual dispatch-count ranges represented by the map colours
- [ ] **4.1.2.e** Distinguish areas with recorded activity from areas with no recorded activity
- [ ] **4.1.2.f** Explain that the values represent recorded SES crew dispatches, not individual flood events
- [ ] **4.1.2.g** Avoid implying that the historical records represent current flood frequency

> **c and f are already written and verified**, and should be lifted rather than rewritten: the reporting period is six financial years, 1 July 2009 to 30 June 2015, and one recorded value is one crew dispatch — a task may or may not have followed, and several crews at one incident count once.
>
> **d rules out a smooth colour ramp with no numbers.** The legend has to name the breaks. That is a decision about how to cut the distribution, and the distribution is severely skewed — Bacchus Marsh has 209 and most areas have single digits — so equal-width bins will produce one dark area and twenty-nine identical pale ones. Choose the breaks deliberately and say what they are.
>
> **e is a distinction the artefact can already make and the map must not blur.** 281 areas are in scope, 275 have at least one dispatch, and **30 are published**. "No recorded activity" and "not in the top thirty" are different statements, and a map of only thirty areas can imply the rest are empty. Either draw all 281, or say plainly which subset is drawn.

### AC 4.1.3 — View severity score

*Given the user selects Severity Score mode, when sufficient historical and population information is available, then the system will:*

- [ ] **4.1.3.a** Display a population-based Severity Score for each supported area
- [ ] **4.1.3.b** Visually distinguish areas with different Severity Score values or levels
- [ ] **4.1.3.c** Provide a clear legend explaining how the score should be read
- [ ] **4.1.3.d** Explain that the score is derived from historical flood-related SES activity and local population information
- [ ] **4.1.3.e** Clearly identify the score as system-derived information
- [ ] **4.1.3.f** Avoid presenting the score as the actual number of people affected
- [ ] **4.1.3.g** Avoid presenting the score as the physical severity of an individual flood
- [ ] **4.1.3.h** Avoid presenting the score as flood probability, current flood risk or future flood prediction

> **Nothing here is built, and the blocking item is data rather than code.** The `population` table is declared and deliberately empty. Its comment says why: the dataset is not in the repository and has not been reconciled against its own documentation or matched to ABS ASGS 2011 — the discipline every other source here went through. The table exists so that the shape of the intended join is visible and so that whoever loads it first has to choose the grain deliberately.
>
> **The score has to be defined in writing before it is computed**, in the same place and to the same standard as [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md). At minimum: which numerator, which denominator, which years, which population vintage, what happens to an area whose total is a floor, and what the number is called. "Dispatches per 1,000 residents over six years" is a defensible definition. "Severity" is not, on its own, which is why f, g and h exist.
>
> **e is not decoration.** Every artefact in this product carries a `basis`, and a score computed by us is `derived`. The interface already distinguishes *recorded by the council* from *calculated by DrainLens* on the drainage map; the same distinction, in the same words, belongs here.

### AC 4.1.4 — View details for a selected area

*Given either map mode is displayed, when the user selects an area, then the system will show the available:*

- [ ] **4.1.4.a** Area name
- [ ] **4.1.4.b** Total recorded flood-related SES activity
- [ ] **4.1.4.c** Distribution of recorded activity across the available years
- [ ] **4.1.4.d** Historical reporting period
- [ ] **4.1.4.e** Population information used in the Severity Score
- [ ] **4.1.4.f** Severity Score, where supported
- [ ] **4.1.4.g** Data completeness status
- [ ] **4.1.4.h** Option to learn more about the data, calculation and limitations

> **a to d and g exist in the artefact today** — `name`, `total`, `byYear` across six years, the reporting period, and `regions` / `suppressedRegions` / `complete`. The board already draws the per-year distribution.
>
> **"the available" is doing real work in this criterion.** An area with no population figure shows a and b to d and g and says why f is absent. It does not show a blank where a score would be.

### AC 4.1.5 — Handle incomplete historical records

*Given some historical records within an area were suppressed in the source data, when the area is displayed or selected, then the system will:*

- [ ] **4.1.5.a** Clearly identify that the historical record is incomplete
- [ ] **4.1.5.b** Show the recorded total as a minimum or lower-bound value where appropriate
- [ ] **4.1.5.c** Avoid presenting hidden records as observed zero values
- [ ] **4.1.5.d** Avoid presenting the displayed total as an exact complete count
- [ ] **4.1.5.e** Explain that the incomplete historical record also affects any derived Severity Score

> **This is the one part of Epic 4 that is finished before it starts.** 144 of 13,339 SA1 regions were withheld by the publisher for privacy, nine of the thirty published areas contain at least one, and the schema column that carries a withheld count is `NULL` rather than `0` — with a comment saying that a schema unable to tell those apart would produce a ranking that is quietly wrong. The board shows those totals as floors already.
>
> **e is the new half.** A floor in the numerator makes the Severity Score a floor too, and that has to propagate rather than be quietly dropped when the number is divided.

### AC 4.1.6 — Handle severity score data quality

*Given the information required to calculate a Severity Score is incomplete or insufficient, when the user views the area in Severity Score mode, then the system will:*

- [ ] **4.1.6.a** Display an **Exact**, **Minimum value** or **Not available** status as appropriate
- [ ] **4.1.6.b** Display a minimum Severity Score when suppressed historical records make the result a lower bound
- [ ] **4.1.6.c** Clearly explain why a result is incomplete or unavailable
- [ ] **4.1.6.d** Avoid generating an unsupported Severity Score
- [ ] **4.1.6.e** Avoid replacing missing population information with an unsupported value
- [ ] **4.1.6.f** Continue to show any supported historical flood information for the area

> **The three statuses map onto two different causes and should not be collapsed.** *Minimum value* is a suppressed numerator — the score is real and is a floor. *Not available* is a missing or unmatched denominator — there is no score at all. Nine areas are already known to be in the first category; how many are in the second is not known until the population data is matched, and **that number is a finding worth reporting** whichever way it comes out.
>
> **e is the same rule as everywhere else in this product**: an absent value stays absent. Do not interpolate a population from a neighbouring area, and do not fall back to an SA2 figure for an SA1 that failed to match.

## US 4.2 — Explore recorded flood events for a selected area

### AC 4.2.1 — View recorded flood events

*Given the user has selected an area, when verified historical flood events are available, then the system will show:*

- [ ] **4.2.1.a** The event name
- [ ] **4.2.1.b** The date it was first recorded or reported
- [ ] **4.2.1.c** The places associated with the event
- [ ] **4.2.1.d** A short factual summary
- [ ] **4.2.1.e** Links to supporting sources

### AC 4.2.2 — Only show verified events

*Given a historical flood event is included in DrainLens, when the event is displayed, then the system will:*

- [ ] **4.2.2.a** Ensure the event has been checked by the project team
- [ ] **4.2.2.b** Provide supporting sources
- [ ] **4.2.2.c** Clearly identify the area associated with the event
- [ ] **4.2.2.d** Use a team-written factual summary
- [ ] **4.2.2.e** Keep the supporting source links accessible

> **US 4.2 is editorial work wearing a technical shape, and it is the item most likely to be underestimated.** Everything else in this repository is derived from a published dataset by a script; these are sentences a person writes about a real flood, and *verified* is a claim about a process rather than about a schema.
>
> Three things follow. **The process has to exist before the content**: who checks, against what, and what gets recorded — b and e mean the source links are part of the artefact, not a bibliography kept somewhere else. **The summaries are ours**, so the same discipline that keeps the rest of the product from overclaiming applies to prose that no test can check: no casualty figures without a source, no "worst in living memory", no damage estimates.
>
> **Scope this to a handful and say so.** Three or four well-sourced events across Greater Melbourne satisfy 4.2.1 and 4.2.2 completely, and 4.2.3 is written on the assumption that most areas have none. A thin, honest list is the deliverable; a long one assembled quickly is the failure mode.

### AC 4.2.3 — Handle areas without verified events

*Given the user selects an area where DrainLens currently has no verified historical event, when the event section is displayed, then the system will:*

- [ ] **4.2.3.a** State that no verified event is currently available in the DrainLens record
- [ ] **4.2.3.b** Explain that this does not mean flooding has never occurred there
- [ ] **4.2.3.c** Avoid presenting the event list as a complete record of all historical flooding
- [ ] **4.2.3.d** Continue to show available historical activity and Severity Score information

> **This is the default state for almost every area, so it is the state to design first.** It is also the same shape of sentence as AC 3.1.3.f and AC 3.1.1.e: the absence of a record in our product is a fact about our product, and the interface has to say which kind of absence it is.

## US 4.3 — Understand the evidence behind the map

### AC 4.3.1 — Explain historical flood activity

*Given the user is viewing Historical Flood Activity mode, when the user opens the evidence explanation, then the system will explain in plain English:*

- [ ] **4.3.1.a** Where the historical SES data comes from
- [ ] **4.3.1.b** The years covered by the dataset
- [ ] **4.3.1.c** That the map groups information by statistical area
- [ ] **4.3.1.d** That one recorded value represents an SES crew dispatch, not one flood event
- [ ] **4.3.1.e** That some historical records may be suppressed or incomplete
- [ ] **4.3.1.f** That the historical activity does not represent current or future flood conditions

> **All six are written, verified and on a screen already** — this is the Iteration 1 explanation panel, and moving it onto the map is the work. The source is *VICSES Incidents Per SA1 ABS Census Areas, 2009–2015* (Victoria State Emergency Service, via data.vic, CC BY 4.0), joined to ABS ASGS 2011 for the names.
>
> Three product decisions behind those sentences were taken with the measurements in front of them and should not be quietly revisited: **Greater Melbourne**, because no Melbourne area reaches the statewide top five; **Flood alone**, because the Data Quality Statement files flash flooding under Storm and ranking on Storm produces the Dandenongs; and **the six-year total with every year shown beside it**, because 2010-11 is most of the total and choosing a shorter window would be choosing the answer.

### AC 4.3.2 — Explain the severity score

*Given the user is viewing Severity Score mode, when the user opens the score explanation, then the system will explain in plain English:*

- [ ] **4.3.2.a** Which historical and population data are used
- [ ] **4.3.2.b** What the important inputs represent
- [ ] **4.3.2.c** How the inputs are combined to produce the Severity Score
- [ ] **4.3.2.d** The period represented by the historical and population data
- [ ] **4.3.2.e** That the Severity Score is system-derived
- [ ] **4.3.2.f** That a higher score represents more recorded flood-related SES activity relative to the local population
- [ ] **4.3.2.g** That the score does not show how many people were actually affected
- [ ] **4.3.2.h** That the score does not measure physical flood severity, flood probability or future flood risk

> **c is the criterion that makes the definition non-negotiable.** A score whose method cannot be explained in two sentences on a screen is a score that should not be shipped.
>
> **d is a trap worth naming now.** The SES data covers 2009-10 to 2014-15. Any population figure will be from a different moment — a census year, or an estimate as at a given date. The two periods will not match, and AC 4.3.3.c requires that mismatch to be stated rather than smoothed over. Decide the population vintage deliberately and put the date on the screen.

### AC 4.3.3 — Explain data coverage and uncertainty

*Given the datasets used by Epic 4 contain limitations, when the evidence explanation is displayed, then the system will:*

- [ ] **4.3.3.a** Identify important missing, suppressed or incomplete information
- [ ] **4.3.3.b** Show the relevant years for the datasets used
- [ ] **4.3.3.c** Explain any important differences in the time periods represented by the datasets
- [ ] **4.3.3.d** Distinguish source data from system-derived information
- [ ] **4.3.3.e** Avoid filling missing information with unsupported assumptions
- [ ] **4.3.3.f** Explain how important data limitations affect interpretation of the Severity Score

### AC 4.3.4 — Distinguish the types of information

*Given historical flood activity, historical events and Severity Scores are available, when the user explores Epic 4, then the system will:*

- [ ] **4.3.4.a** Clearly distinguish recorded historical activity, verified historical events and system-derived Severity Scores
- [ ] **4.3.4.b** Explain the purpose of each information type in plain English
- [ ] **4.3.4.c** Avoid presenting Severity Scores as observed historical facts
- [ ] **4.3.4.d** Avoid presenting any of the information as current or future flood prediction
- [ ] **4.3.4.e** Allow the user to understand the source and limitations of each information type separately

> **Three kinds of thing on one map, and they are not equally solid.** A dispatch count is a published record. An event summary is a person writing. A Severity Score is arithmetic we did. The map legend already separates *recorded by the council* from *calculated by DrainLens*; this needs a third mark, and the three have to stay distinguishable when an area shows all of them at once.

---

## Epic 4 — definition of done

From *Iteration 2 Requirements*.

- [ ] Users can open the Greater Melbourne flood map and switch between **Historical Flood Activity** and **Severity Score** modes while retaining the same geographic context
- [ ] **Historical Flood Activity** mode correctly displays the available recorded flood-related SES responses, reporting period and response-count ranges without presenting the historical records as current flood frequency or future flood conditions
- [ ] **Severity Score** mode displays the supported population-based Severity Score and clearly identifies the result as system-derived information representing potential community impact
- [ ] Users can select an area and view its available historical response information, population-related information, Severity Score, reporting period and completeness status
- [ ] Areas with incomplete historical records or insufficient information for Severity Score calculation are clearly identified, and the system does not generate unsupported response totals or Severity Scores
- [ ] Where verified historical flood events are available, users can view the event information and supporting sources; where none is available, the system clearly explains that this does not mean flooding has never occurred there
- [ ] Historical response records, verified historical events and system-derived Severity Scores are clearly distinguished, with their sources, calculation basis, coverage and limitations explained in plain English
- [ ] The displayed historical records, population-related information, Severity Scores and event information have passed the agreed functional and data checks, and the displayed values are consistent with the documented data definitions and calculation method
- [ ] All Epic 4 acceptance criteria have passed the agreed functional and data checks, and all identified critical and high-priority defects affecting map usability, data accuracy, Severity Score calculation or interpretation are resolved

---

## What Iteration 2 needs that does not exist yet

Four items, and three of them are data rather than code. Each blocks criteria that cannot start without it.

| | Blocks | Note |
|---|---|---|
| **SA2 boundary polygons**, Greater Melbourne, ABS ASGS 2011 | 4.1.1, 4.1.2, 4.1.3, 4.1.4 | Must be the **2011** edition, because the names in the flood data were joined against ASGS 2011. A 2016 or 2021 boundary set will mostly match and quietly will not |
| **Population by statistical area**, with a stated vintage | 4.1.3, 4.1.4.e, 4.1.6, 4.3.2 | Reconciled against its own documentation and matched to ASGS 2011 before it is loaded, the same as every other source here. How many areas fail to match is a result, not an error to hide |
| **Verified flood events** and the process that verifies them | 4.2.1, 4.2.2 | Editorial. Three or four well-sourced events is a complete answer |
| **The validated rainfall levels** | 3.2.3.b | A decision, not a fetch. Choose the set, record why |

**And one decision already open:** [DECISIONS-PENDING.md §8](./DECISIONS-PENDING.md), where the measured ground stops on a council-wide map — deferred to 13 September, and AC 3.3.2.i cannot be closed before it is taken.

---

## UI definition of done

Behaviours the criteria express through state retention rather than as buttons, carried over from Iteration 1 and extended.

- [ ] **Mode switching** on the flood map keeps the map location and the selected area *(AC 4.1.1.c)*
- [ ] **Changing rainfall** keeps the location and the blockage assumption *(AC 3.2.1.a, 3.2.1.b)*
- [ ] **Back** and **Home** are reachable from every screen in both journeys, including the ones that ask for something before they give anything
- [ ] The browser back button never strands the user on a screen whose state has been lost
- [ ] No navigation writes the address to `localStorage`, `sessionStorage`, the URL or history state
- [ ] Nothing in either journey sends a coordinate to an endpoint — an extent id and an area name remain the only things any route accepts

---

## Wording to hold on the day

Everyone who speaks about the product holds these. They are what the criteria above commit us to, and nothing further.

- Not a flood warning, not a forecast, not an engineering assessment.
- **The blockage is an assumption somebody chose. The rainfall is an input somebody chose.** Neither is an observation, and neither is a forecast.
- **No clear change means our simplified calculation found no clear difference.** It does not mean a blocked drain has no effect. We measured why, and we can show the numbers.
- We do not report a change finer than the ground data. The surface is accurate to about 25 cm; we will not put 0.7 mm on a screen.
- We do not speak about pipe capacity. Invert data is 95.4% missing and no capacity model exists.
- **A dispatch is a crew being sent, not a flood.** Counts are not severity, not damage, and not current or future conditions.
- **A Severity Score is arithmetic we did**, from recorded dispatches and published population. It is not the number of people affected, and it is not a risk score.
- **No verified event in an area means we have not recorded one.** It does not mean flooding has never happened there.
