# Iteration 1 — acceptance criteria

DrainLens · TA28 · demonstrated **Tuesday 1 September 2026**, revised **3 September 2026**

What "done" means. The work that produces it is in [ITERATION-1-TASKS.md](./ITERATION-1-TASKS.md).

**Tick a criterion only when it has been seen working on the deployed build** — not when the code that should satisfy it has been merged.

**Source:** *Epic 1-2 Revised*, received **3 September 2026**. Where this file and that document disagree, the document wins and this file has a bug.

---

## What the 3 September revision changed

Three things, and the third is a hazard rather than a feature.

**Epic 2 is a different epic.** It was *Rainfall and Drainage Blockage Scenario Explorer*; it is now *Understand Historical Flood Patterns* — a ranked view of recorded flood-related incident counts by area, with a Show More list and a data explanation. Nothing of the old Epic 2 survives in the new one.

**The drain-blockage comparison must be absent from the Iteration 1 interface** (AC 1.1.1, last bullet). It is not merely unrequired; showing it fails a criterion. The comparison code, its screens and its tests are intact in the repository and reachable in one edit — see the note under AC 1.1.1 — but nothing in the running interface offers it, describes it, or fetches its data.

**Every number moved.** The revision renumbered and re-scoped the criteria without changing their format, so the same identifier means something else than it did a week ago:

| 27 August | 3 September | Note |
| --- | --- | --- |
| 1.1.1 Select a supported address | **1.1.3** | Same requirement, new number |
| 1.1.2 Follow local water and drainage | **1.1.2** *(partly)* | The guided-task defaults are no longer a criterion; 1.1.2 is now *Open the Local Map* |
| 1.1.3 Explore the full map | **1.1.4** + **1.1.5** | Split into modes and drainage layers |
| 1.1.4 Enter an unsupported address | **1.1.7** | Same requirement, new number |
| 1.1.5 Choose another task | — | Dropped |
| 1.2.1, 1.2.2 | **1.2.1, 1.2.2** | Unchanged, letters included |
| 1.3.1 Street cross-section | — | Dropped. **1.3.1 is now *View the Local Terrain*** |
| 1.3.2 Cross-section insufficient | — | Dropped. **1.3.2 is now *View Low Areas*** |
| 2.1–2.3 Scenario explorer | — | Dropped. **Epic 2 is now flood history** |

**The collisions to watch are 1.3.1, 1.3.2 and all of Epic 2**: those identifiers are live and mean something entirely different from what they meant on 29 August.

**Citation convention.** A comment in the source citing `AC 1.3.1` means the revised criterion. Comments about the deferred comparison say `(Aug-27 set)` after the number. Nothing else in the source carries a superseded number.

---

## Where this stands — 3 September 2026

**Epic 1: 51 of 53 sub-criteria met.** The two open ones are both AC 1.1.1's requirement to introduce and offer historical flood information, which cannot be met until Epic 2 exists.

**Epic 2: nothing built, but the data is verified.** The board needs *VICSES Incidents Per SA1 ABS Census Areas, 2009 – 2015* (Victoria State Emergency Service, via data.vic, CC BY 4.0). It has now been fetched and measured — see [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md) — and it reconciles against its own Data Quality Statement exactly: 13,339 SA1 rows, 144 of them suppressed for privacy.

> **Correction, 3 September.** An earlier note here said the file "stops in August 2015, and 2010–2014 are the five complete years". That came from the catalogue's description, which gives the collection period as July 2009 – 8 August 2015. The file itself has six financial-year columns, 2009-10 to 2014-15, and the Data Quality Statement states the reference period as **1 July 2009 – 30 June 2015**. All six are complete; there is no partial year to exclude. The reporting period AC 2.1.1.f must display is *six financial years, 1 July 2009 to 30 June 2015*.

**What was rebuilt for this revision**, and clicked through in a browser on 3 September: the four modes and the drainage-layer switches (1.1.4, 1.1.5), the homepage's per-mode ways in (1.1.1, 1.1.2), the retention of modes across an address change (1.1.8.d), and the comparison's removal from the homepage, the task question and the address screen.

**What is carried over** from the 27 August criteria without re-clicking, because the code behind it did not change: 1.1.3, 1.1.6, 1.1.7, 1.2.1, 1.2.2, 1.3.2. Each was demonstrated on 1 September under its old number.

**Not yet deployed.** The live service still serves the 1 September build. Everything below describes `main`.

---

## US 1.1 — Understand and explore water flow near an address

### AC 1.1.1 — View the available information

*Given the user has not selected an address, when the user opens the website, then the system will:*

- [x] **1.1.1.a** Display a homepage that briefly explains the purpose of the website
- [ ] **1.1.1.b** Introduce the available local drainage, water-flow, terrain, low-area **and historical flood** information
- [ ] **1.1.1.c** Present clear entry points to the main available features
- [x] **1.1.1.d** Allow the user to choose where to begin without first entering an address
- [x] **1.1.1.e** **Not** display the drain-blockage Comparison feature in the Iteration 1 interface

> **1.1.1.b and 1.1.1.c are open for the same reason.** Four of the five kinds of information are introduced, each with an entry point that opens the map in that mode. Historical flood information is not, because there is no page for it to point at. A card describing a board that does not exist is a promise the site cannot keep, so the card waits for the board rather than the board waiting for the card. Both tick when Epic 2 lands.
>
> **1.1.1.e is met by removal, not by hiding.** The comparison's card is gone from the homepage, its option is gone from the task question, and the two sentences on the address screen that described it are rewritten. It is also not *fetched*: starting the scenario worker pulls `scene.json` and the elevation, flow, depression and coverage arrays — a little over five megabytes — and that now happens only on the two screens that use it, neither of which is reachable. `Task` still admits `'compare'` and `screens/ScenarioSetup.tsx`, `screens/Result.tsx` and their tests are untouched; Iteration 2 restores one entry in `TaskSelect.tsx` and one card in `Home.tsx`.

### AC 1.1.2 — Open the local map

*Given the user is on the homepage, when the user selects a local drainage, water-flow or terrain option, then the system will:*

- [x] **1.1.2.a** Open the local map
- [x] **1.1.2.b** Display an address search bar at the top of the map
- [x] **1.1.2.c** Display the available mode controls at the top of the map
- [x] **1.1.2.d** Activate the mode associated with the option selected by the user
- [x] **1.1.2.e** Allow the user to enter an address within the supported pilot area

> **1.1.2.d turns on the chosen mode and no other, with one exception.** Terrain stays on underneath whatever was chosen, because it is background — it is what the recorded network and the derived paths are drawn over, and without it the map opens onto a flat colour that quietly implies level ground. Opening everything else as well would make the choice invisible, and a click that changes nothing on screen is a click somebody repeats to believe.
>
> Clicked on 3 September: *Open water flow* opened the map with Water flow and Terrain lit, Drainage and Low areas dark, and the legend listing exactly those two layers.

### AC 1.1.3 — Select a supported address

*Given the user is on the local map, when the user enters and confirms a recognised address within the supported pilot area, then the system will:*

- [x] **1.1.3.a** Display the selected address
- [x] **1.1.3.b** Centre the map on and mark the selected address
- [x] **1.1.3.c** Display the available information for the active mode
- [x] **1.1.3.d** Allow the user to continue without creating an account
- [x] **1.1.3.e** Retain the selected address **only for the current browser session**
- [x] **1.1.3.f** Clearly identify any missing, incomplete or uncertain information

> **1.1.3.e is met more strictly than it asks.** The address is held in memory for the life of the tab and in nothing else — not `localStorage`, not `sessionStorage`, not the URL, not `history.state`. `session.test.ts` enforces this by running a whole session against traps in place of both storages, `history` and `document.cookie`, rather than by reading the source: a rule checked by grep is a rule a refactor walks around.
>
> *The address is also never sent*, and the reason is stronger than a guard — there is no request that could carry it. Every outbound call in `apps/web` is a `GET` of a static artefact, with no body and no query string.

### AC 1.1.4 — Change the information mode

*Given a supported address is selected and the user is viewing the local map, when the user selects Drainage, Water Flow, Terrain or Low Areas, then the system will:*

- [x] **1.1.4.a** Clearly identify the selected mode as active
- [x] **1.1.4.b** Retain the selected address and current map location
- [x] **1.1.4.c** Display recorded drainage pits and pipes when Drainage is selected
- [x] **1.1.4.d** Display indicative surface-water paths when Water Flow is selected
- [x] **1.1.4.e** Display contour lines or an equivalent elevation visualisation when Terrain is selected
- [x] **1.1.4.f** Display the available low-area information when Low Areas is selected
- [x] **1.1.4.g** **Distinguish official recorded data from system-derived information**
- [x] **1.1.4.h** Provide the available modes for users to toggle

> **The modes are multi-select, and that is a reading of the criterion rather than a departure from it.** 1.1.4.a is singular — "the selected mode" — but 1.1.4.h asks that the modes be available "for users to toggle", and every bullet between them is of the form *when X is selected, display X*, all of which hold when several are on. Mutual exclusion is the reading that loses information for no reason: where water runs is a question about the ground it runs over, and a person comparing the two should not have to choose. Confirmed with the team on 2 September.
>
> **1.1.4.e is an equivalent visualisation, not contour lines.** The surface is shaded by elevation, ramped across the ground actually present in the extent rather than against sea level. The reason it is not contours is in `map/terrain.ts`: the shipped array is the *conditioned routing surface*, which raises every building a hundred metres so water runs between them, and contour lines drawn on it would be lines around buildings presented as lines around terrain. The shading is fitted at robust percentiles and carries no metric legend, because the surface's own accuracy — about 25 cm — does not support one.
>
> **1.1.4.g is the legend's job.** Every layer currently drawn appears in it with *Official recorded data* or *System-derived result* beside it. It used to sit under each control; with the controls compressed into chips there is no room, and a tooltip is not something a layer *carries*.

### AC 1.1.5 — Control the drainage layers

*Given the user is viewing the local map with Drainage selected, when the user opens Layers and changes the Drainage Pits or Drainage Pipes option, then the system will:*

- [x] **1.1.5.a** Allow the drainage-pit and drainage-pipe layers to be shown or hidden independently
- [x] **1.1.5.b** Retain the visibility of the layer that the user has not changed
- [x] **1.1.5.c** Clearly identify which drainage layers are currently visible
- [x] **1.1.5.d** Update the map legend to reflect the visible drainage layers
- [x] **1.1.5.e** Retain the selected address and current map location

> **1.1.5.b is stronger than it sounds and is tested as a truth table.** A layer is visible when its mode is on *and* its own switch is on, so a switch survives its mode being turned off and on again: turning Drainage off and back on does not resurrect the pipes somebody hid. `map/modes.test.ts` proves it; on 3 September it was also clicked.
>
> A switch whose mode is off is shown disabled with the reason, not silently inert. The panel also carries *Not enough ground measured*, which is deliberately governed by no mode: it is a statement about the evidence rather than a view of the world, it is true in every mode, and behind Terrain it would be the one mark saying the map is guessing that a person could switch off by accident.

### AC 1.1.6 — View information about a map element

*Given the user is viewing a map containing selectable information, when the user selects an available map element, then the system will:*

- [x] **1.1.6.a** Highlight the selected map element
- [x] **1.1.6.b** Display the available information in a popup
- [x] **1.1.6.c** Provide a short plain-English explanation of the selected information
- [x] **1.1.6.d** Identify whether the information is official recorded data or system-derived information
- [x] **1.1.6.e** Provide a relevant next action where one is available
- [x] **1.1.6.f** Clearly identify any missing, incomplete or uncertain information

> **The street cross-section is now 1.1.6.e rather than a criterion of its own.** The revision dropped US 1.3's cross-section entirely; the feature is built, tested and kept, because it is exactly "a relevant next action" from a selected pit. Its two states carry 1.1.6.d and 1.1.6.f: **everything horizontal is recorded** — which pipes connect, on which side, their diameter and material — and **everything vertical is drawn**, said inside the figure rather than in a caption. The map artefact carries no invert level for any pit, so 726 of 895 pits can have a section and the other 169 get a screen that says what is missing and invents nothing.

### AC 1.1.7 — Enter an unsupported address

*Given the user is on the local map, when the user enters and confirms an address outside the supported pilot area, then the system will:*

- [x] **1.1.7.a** Explain that detailed local drainage information is not available for the address
- [x] **1.1.7.b** **Avoid** presenting local drainage results as if supported data were available
- [x] **1.1.7.c** Allow the user to enter a different address

> The distinction this turns on is between *no such address* and *a real address we hold nothing for*, and they are different things to a resident. Neither is ever resolved to a nearby address.

### AC 1.1.8 — Change the selected address

*Given an address is selected and the user is viewing the local map, when the user enters and confirms a different recognised address, then the system will:*

- [x] **1.1.8.a** Replace the previously selected address
- [x] **1.1.8.b** Centre the map on and mark the new address
- [x] **1.1.8.c** Update the displayed information for the new address
- [x] **1.1.8.d** Retain the active information mode where that mode is available

> Clicked on 3 September with a non-default mode set: Low Areas was switched on, the address was changed from 32 Altona Street to 3 Bangalore Street, and all four modes were still on afterwards with the map recentred and the new address marked.

---

## US 1.2 — Follow the downstream drainage path

Unchanged by the revision, letters included. Both criteria were built on 29 August and demonstrated on 1 September.

### AC 1.2.1 — Select a drainage pit

- [x] **1.2.1.a** Highlight the selected drainage pit
- [x] **1.2.1.b** Display the available recorded information for the pit in a popup
- [x] **1.2.1.c** **Identify the information as official recorded data**
- [x] **1.2.1.d** Provide an option to show its recorded downstream path

> 1.2.1.c pushes provenance down to the individual value. Every value shown travels with the basis that produced it — see `packages/schema/src/provenance.ts`, where a value without a basis has no constructible shape.

### AC 1.2.2 — Follow the recorded downstream path

- [x] **1.2.2.a** Highlight the selected pit and its available recorded downstream pipes
- [x] **1.2.2.b** Show the recorded direction of the drainage path
- [x] **1.2.2.c** Continue the path to the recorded outlet or the last known connection
- [x] **1.2.2.d** Clearly identify any missing or uncertain connection
- [x] **1.2.2.e** **Avoid** completing the path using unsupported or inferred pipe connections

> 1.2.2.c is satisfied by the *last known connection* in every case: the extent contains no recorded outfall, endwall or discharge point, so no path can reach an outlet and none claims to.
>
> Three behaviours are load-bearing and each has its own test: the cycle guard (18 back-edges across 34 nodes exist in the real data), branch handling (multiple downstream paths are the normal case and must never collapse to one), and the termination reason — outlet, data boundary, or missing connection, with the interface saying which. A pipe whose downstream pit is absent from the export becomes an edge with **no destination** rather than no edge at all, so the path reaches it and stops there with that reason.

---

## US 1.3 — Understand local terrain and low areas

### AC 1.3.1 — View the local terrain

*Given a supported address is selected and the user is viewing the local map, when the user selects Terrain, then the system will:*

- [x] **1.3.1.a** Display contour lines or an equivalent two-dimensional elevation visualisation
- [x] **1.3.1.b** Clearly distinguish differences in terrain elevation
- [x] **1.3.1.c** Retain the selected address and current map location
- [x] **1.3.1.d** Provide a legend or explanation for the terrain visualisation
- [x] **1.3.1.e** Distinguish recorded information from system-derived information
- [x] **1.3.1.f** Clearly indicate when terrain information is missing, incomplete or unavailable

> **1.3.1.f has a layer of its own.** *Not enough ground measured* hatches the cells where too little was measured to say anything: 52.1% of this extent was measured directly and the rest — under roofs and canopy — is interpolated from the nearest measured ground. It is drawn over the surface so the hatching still reads, and it is switchable independently of every mode.
>
> **1.3.1.e is met by calling the surface what it is.** It is derived, not recorded, and it is not a LiDAR product: it comes from aerial photography filtered to bare earth. The legend says *System-derived result* beside it.
>
> See the note under AC 1.1.4.e for why this is shading rather than contours.

### AC 1.3.2 — View low areas

*Given a supported address is selected and the user is viewing the local map, when the user selects Low Areas, then the system will:*

- [x] **1.3.2.a** Display the available low-lying areas on the two-dimensional map
- [x] **1.3.2.b** Visually distinguish low areas from other map information
- [x] **1.3.2.c** Retain the selected address and current map location
- [x] **1.3.2.d** Provide a legend or explanation for the displayed low areas
- [x] **1.3.2.e** Identify the information as indicative where applicable
- [x] **1.3.2.f** **Avoid** presenting the displayed low areas as current or predicted flood conditions

---

## Epic 2 — Understand historical flood patterns

**Nothing below is built.** The dataset it needs has not been fetched. Recorded here in full so that the shape of the work is fixed before any of it starts.

### AC 2.1.1 — View the historical flood overview

*Given the user is on the homepage, when the user selects the historical flood information option, then the system will:*

- [ ] **2.1.1.a** Open the historical flood information page
- [ ] **2.1.1.b** Display the five areas with the highest recorded flood-related incident counts
- [ ] **2.1.1.c** Order the areas from the highest to the lowest recorded incident count
- [ ] **2.1.1.d** Display the rank, area name and recorded incident count for each area
- [ ] **2.1.1.e** Present the information using an infographic, bar chart or equivalent visualisation
- [ ] **2.1.1.f** Display the reporting period, geographic unit and source of the information
- [ ] **2.1.1.g** Clearly indicate when required information is missing, incomplete or unavailable
- [ ] **2.1.1.h** Retain the five highest-ranked areas as the default view
- [ ] **2.1.1.i** Provide an option to continue to the local drainage map

> **2.1.1.f is the criterion the data was checked against, and it is satisfiable.** Source: Victoria State Emergency Service, *VICSES Incidents Per SA1 ABS Census Areas, 2009 – 2015*, via data.vic under CC BY 4.0. Reporting period: **six financial years, 1 July 2009 to 30 June 2015**, which is what the Data Quality Statement states and what the file's six year columns contain.
>
> **The geographic unit needs a second source.** The DQS says in as many words that "SA1 regions are not named", so AC 2.1.1.d's *area name* cannot come from this file. ABS ASGS 2011 (`SA1_2011_AUST.csv`) carries `SA1_7DIGITCODE_2011` alongside `SA2_NAME_2011` and `GCCSA_NAME_2011`, and all **13,339 of 13,339** VICSES codes join to it with nothing left over on either side. The named unit is therefore **SA2**, and Greater Melbourne is separable from the rest of Victoria. Details and the measurements behind them: [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md).

### AC 2.2.1 — Show more locations

*Given the user is viewing the historical flood information page, when the user selects Show More Locations, then the system will:*

- [ ] **2.2.1.a** Display additional available locations
- [ ] **2.2.1.b** Display **no more than 30 locations in total**
- [ ] **2.2.1.c** Retain the Top Five locations at the beginning of the displayed results
- [ ] **2.2.1.d** Use the same reporting period and counting basis for all displayed locations
- [ ] **2.2.1.e** Display the available recorded incident count for each location
- [ ] **2.2.1.f** Clearly indicate when information for a location is missing, incomplete or unavailable

### AC 2.3.1 — View the data explanation

*Given the user is viewing the historical flood information page, when the historical information is displayed, then the system will:*

- [ ] **2.3.1.a** Identify the source, reporting period and meaning of a recorded incident count
- [ ] **2.3.1.b** Explain any relevant limitations or gaps in the available historical data
- [ ] **2.3.1.c** Explain that recorded incident counts **do not indicate flood severity or property damage**
- [ ] **2.3.1.d** State that the information **does not represent current or future flood conditions**

> **2.3.1.c and 2.3.1.d are the same commitment the rest of the product already makes**, applied to a new kind of number. An incident count is a count of times somebody called for help. It is shaped by who calls, by how many people live in the area, and by what SES recorded — none of which is flood severity. A ranked list invites exactly the reading these two bullets forbid, so the explanation has to sit with the chart rather than behind a link.

---

## Deferred to Iteration 2 — the drain-blockage comparison

The old Epic 2, built and demonstrated on 1 September, and now out of the interface by AC 1.1.1.e. Kept here so the work is not lost and its criteria can be found under the numbers the source still cites.

The engine (`packages/scenario`), the worker, the difference layer, the setup and result screens and their tests are all in the repository and all still tested — 532 tests pass with the comparison unreachable. What was demonstrated: a person chose a pit, a blockage assumption and an accumulated rainfall amount; the run compared that against the same rainfall with every drain clear; the result showed **the difference only**, never a depth, and refused to answer where the information could not support one.

Comments in `apps/web/src/scenario/`, `screens/ScenarioSetup.tsx`, `screens/Result.tsx`, `map/difference.ts` and the scenario parts of `session.ts` cite `AC 2.x (Aug-27 set)`. Those numbers refer to the 27 August document, not to the flood-history criteria above.

---

## Definition of done

From *Iteration 1 Requirements*. The revised criteria document does not restate these, and they still govern.

### Epic 1 — Interactive local drainage and water flow

- [ ] A user can complete the full journey: open the map, find an address, read the recorded network, and trace a downstream path, within the supported pilot area
- [ ] The map and drainage trace use available source data **without inventing** missing connections, pipe depths or drainage constraints
- [ ] Missing or uncertain information is clearly labelled, data sources and dates are recorded, and searched addresses are not retained after the session
- [ ] The main map controls and explanations work on the agreed desktop and mobile layouts and can be understood without specialist drainage knowledge
- [ ] Reviewed, tested against all Epic 1 criteria, and demonstrated in the test environment with no unresolved defect preventing the main journey

### Epic 2 — Historical flood patterns

- [ ] A user can open the historical flood page from the homepage, read the ranked areas, expand to more locations, and understand what the counts do and do not mean
- [ ] Every displayed location uses the same reporting period and counting basis, and the source and period are on the page rather than in a footnote
- [ ] The page states that recorded incident counts are not severity, not damage, and not current or future conditions
- [ ] Reviewed and tested, all Epic 2 criteria passed, no unresolved defect preventing the main journey

---

## UI definition of done

Behaviours the criteria express through state retention rather than as buttons. Covered on the golden path rather than by a criterion each — a back button that loses state is a defect, but it is not a separate acceptance conversation.

- [ ] **Change address** from the map keeps the active modes and the map location *(AC 1.1.8.d)*
- [ ] **Home** returns to the homepage from any screen and starts a fresh way in
- [ ] The browser back button never strands the user on a screen whose state has been lost
- [ ] No navigation writes the address to `localStorage`, `sessionStorage`, the URL, or history state; history state carries a screen identifier only
- [ ] The breadcrumb lists only screens the person actually passed through

---

## Wording to hold on the day

Everyone who speaks about the product holds these. They are what the criteria above commit us to, and nothing further.

- Not a flood warning, not a forecast, not an engineering assessment.
- The ground surface, the surface-water paths and the low areas are **calculated**, and the map says so beside each of them. The pits and pipes are the council's record.
- We do not speak about pipe capacity or bottlenecks. We speak about where water may go, and where a pipe narrows.
- **The drain-blockage comparison is not part of Iteration 1.** It is built and it is not shown. If asked, say that: it is a deliberate scope decision recorded in AC 1.1.1, not an unfinished feature.
- Recorded flood incidents, when that page exists, are counts of calls for help — not severity, not damage, not a prediction.
- No machine learning in this iteration — a position, not a gap: the project has no outcome labels, so a deterministic, explainable model is the honest choice.
