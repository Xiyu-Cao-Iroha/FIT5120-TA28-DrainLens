# Iteration 1 — acceptance criteria

DrainLens · TA28 · demonstrated **Tuesday 1 September 2026**, revised **3 September 2026**

What "done" means. The work that produces it is in [ITERATION-1-TASKS.md](./ITERATION-1-TASKS.md).

**Tick a criterion only when it has been seen working on the deployed build** — not when the code that should satisfy it has been merged.

**Source:** *Epic 1-2 Revised (2)*, received **3 September 2026**, superseding *Epic 1-2 Revised* from earlier the same day. Where this file and that document disagree, the document wins and this file has a bug.

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
| 1.1.4 Enter an unsupported address | **1.1.8** | Same requirement, new number |
| 1.1.5 Choose another task | — | Dropped |
| 1.2.1, 1.2.2 | **1.2.1, 1.2.2** | Unchanged, letters included |
| 1.3.1 Street cross-section | — | Dropped. **1.3.1 is now *View the Local Terrain*** |
| 1.3.2 Cross-section insufficient | — | Dropped. **1.3.2 is now *View Low Areas*** |
| 2.1–2.3 Scenario explorer | — | Dropped. **Epic 2 is now flood history** |

### The second revision, later on 3 September

Two criteria were **added inside Epic 1**, which pushed three along again:

| Revised | Revised (2) |
| --- | --- |
| — | **1.1.6 Expand or Collapse the Map Legend** (new) |
| 1.1.6 View Information About a Map Element | **1.1.7** |
| 1.1.7 Enter an Unsupported Address | **1.1.8** |
| 1.1.8 Change the Selected Address | **1.1.9** |
| — | **1.1.10 Return from the Local Map** (new) |
| — | **2.1.2 Return from the Historical Flood Information Page** (new) |
| — | **2.2.2 Show Fewer Locations** (new) |

AC 1.1.2's trigger also gained a fourth option: *drainage, water-flow, terrain **or low-area***, which the homepage's four cards already offered.

**Three of the four new criteria describe work that already existed** when the document arrived — the legend folds, the flood list closes, and both were built the same afternoon for the same reasons the criteria give. Only AC 1.1.10 needed building.

**The collisions to watch are 1.3.1, 1.3.2 and all of Epic 2**: those identifiers are live and mean something entirely different from what they meant on 29 August.

**Citation convention.** A comment in the source citing `AC 1.3.1` means the revised criterion. Comments about the deferred comparison say `(Aug-27 set)` after the number. Nothing else in the source carries a superseded number.

---

## Where this stands — 3 September 2026

**Epic 1: 70 of 71 sub-criteria met, and one deliberate deviation.** AC 1.1.1's two open items closed when the flood board landed on 3 September. **AC 1.1.4.c is not met**, by a design decision taken the same day and recorded under that criterion — the map has no Drainage mode, because pits and pipes are chips of their own.

**Epic 2: 25 of 25 sub-criteria met, and clicked through on 3 September.** The board reads *VICSES Incidents Per SA1 ABS Census Areas, 2009 – 2015* (Victoria State Emergency Service, via data.vic, CC BY 4.0), joined to ABS ASGS 2011 for the names. The data was verified before any of it was built — see [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md) — and it reconciles against its own Data Quality Statement exactly: 13,339 SA1 rows, 144 of them suppressed for privacy.

> **Three product decisions were taken with the measurements in front of them**, and each is on the artefact rather than in a screen, so the page cannot drift from what was decided. **Greater Melbourne**, because not one Melbourne area reaches the statewide top five. **Flood alone**, because the Data Quality Statement files flash flooding under Storm and ranking on Storm produces the Dandenongs. **The six-year total, with every year shown beside it**, because 2010-11 is most of the total and choosing a shorter window would be choosing the answer.

> **Correction, 3 September.** An earlier note here said the file "stops in August 2015, and 2010–2014 are the five complete years". That came from the catalogue's description, which gives the collection period as July 2009 – 8 August 2015. The file itself has six financial-year columns, 2009-10 to 2014-15, and the Data Quality Statement states the reference period as **1 July 2009 – 30 June 2015**. All six are complete; there is no partial year to exclude. The reporting period AC 2.1.1.f must display is *six financial years, 1 July 2009 to 30 June 2015*.

**What was rebuilt for this revision**, and clicked through in a browser on 3 September: the four modes and the drainage-layer switches (1.1.4, 1.1.5), the homepage's per-mode ways in (1.1.1, 1.1.2), the retention of modes across an address change (1.1.9.d), and the comparison's removal from the homepage, the task question and the address screen.

**What is carried over** from the 27 August criteria without re-clicking, because the code behind it did not change: 1.1.3, 1.1.7, 1.1.8, 1.2.1, 1.2.2, 1.3.2. Each was demonstrated on 1 September under its old number.

**The address screen and the task question are hidden.** From 3 September the homepage opens the map directly, and nothing routes to the standalone address field or to the task chooser any more. The hero carried two buttons that day, *Explore the map* and *See flood history*; from 4 September it carries only the first, and the header carries two entries rather than five — see the mentor-feedback note below.

> That moves the implementation **towards** the criteria rather than away from them. AC 1.1.2 asks the map to open from the homepage carrying its own address search bar, and AC 1.1.3 opens *"given the user is on the local map"* — both describe naming an address on the map, which is now the only way to do it. The screens and their code are kept, like the comparison, and Iteration 2 decides whether they return or go.

**Not yet deployed.** The live service still serves the 1 September build. Everything below describes `main`.

### Mentor feedback, 4 September — six changes

Six of eleven points from the mentor review are in. None of them changes a criterion's outcome; all six are recorded here because each one contradicts a sentence written above it on 3 September.

| # | Asked for | What changed | Criterion |
|---|---|---|---|
| 1 | Two entries in the header, not five | The three in-page anchors are gone; *Flood history* and *Explore map* remain | **1.1.1.c still met** — the anchors scrolled the page you were on, they were never entry points |
| 3 | Remove the hero's *See flood history* | The hero asks for one thing. The board keeps its own way in further down the page, beside the paragraph that says what it is, and the header keeps its link | **1.1.1.c still met** — entry points, not entry buttons in one place |
| 4 | Less text in *Start with what you want to understand* | Retitled *Four ways to understand your area*: a drawn thumbnail, a title and **one** sentence per card, and the whole card is now the button | **1.1.1.b, 1.1.2 still met** — re-clicked: the water-flow card opens the map with Water flow lit and the other three chips dark |
| 8 | Legend at the top right | Moved from the bottom left, and it no longer places itself: it sits in the controls row and is laid out by flexbox, so a wrapped chip row pushes it instead of landing on it | **1.1.6** unaffected — the fold, the control and the per-layer basis are untouched |
| 9 | A red pin, not a crosshair | The ring centred *on* the address became a teardrop standing beside it, tip on the point. At street zoom the ring sat over the pits and paths a person came to read | none — the address marker is named by no criterion |
| 11 | Arrows on the water flow | An arrowhead every 46 screen pixels along each path, pointing downstream | **1.1.4.d** — still indicative paths, now with the one thing a dashed line cannot say |

> **The arrows are the only one of the four that makes a new claim**, and it is a claim a reader can act on: an arrow pointing upstream is worse than no arrow. Vertex order is flow direction because `trace_channels` walks each path from its head down the D8 field one cell at a time and Douglas-Peucker drops vertices without reordering them — so that is now asserted in the pipeline's own tests (`never_runs_uphill`, `keeps_the_order_it_was_given`) rather than left as a property nobody was checking. The heading is taken in screen space, so the northing-up flip needs no correction, and that is tested too.
>
> **Point 4 removed sentences that were carefully written, and that is the point of recording it here.** The four cards carried two or three sentences each, and the qualifications in them — *"where a path stops because the record does rather than because the water does"*, *"not a statement that any of them has flooded or will"* — are the product's position, not filler. They are not lost: every one is still in *DrainLens does not provide* further down this page and in the per-layer basis labels on the map itself, where a person reads them next to the thing they qualify. A caveat nobody reads is not a caveat, and the mentor's observation was that nobody was reading these.
>
> **The card thumbnails are drawn, not screenshotted**, in the map's own palette constants rather than retyped hex — so a card cannot come to show a colour the map does not use. Nothing is fetched for them; this product loads nothing from a third party.
>
> **What the mentor asked for and did not get yet:** the pin's optional popup (point 9's *"甚至可以"*), which belongs with point 7's click-to-expand pit card rather than on its own.

---

## US 1.1 — Understand and explore water flow near an address

### AC 1.1.1 — View the available information

*Given the user has not selected an address, when the user opens the website, then the system will:*

- [x] **1.1.1.a** Display a homepage that briefly explains the purpose of the website
- [x] **1.1.1.b** Introduce the available local drainage, water-flow, terrain, low-area **and historical flood** information
- [x] **1.1.1.c** Present clear entry points to the main available features
- [x] **1.1.1.d** Allow the user to choose where to begin without first entering an address
- [x] **1.1.1.e** **Not** display the drain-blockage Comparison feature in the Iteration 1 interface

> **1.1.1.b and 1.1.1.c closed on 3 September**, when the board they were waiting for was built. Four of the five kinds of information are four cards, each opening the map in that mode. The fifth sits in a band of its own below them, because a card in that row would say "this opens the map too" — and the difference between six years across a city and the ground under one square kilometre is the thing most worth not blurring.
>
> **1.1.1.e is met by removal, not by hiding.** The comparison's card is gone from the homepage, its option is gone from the task question, and the two sentences on the address screen that described it are rewritten. It is also not *fetched*: starting the scenario worker pulls `scene.json` and the elevation, flow, depression and coverage arrays — a little over five megabytes — and that now happens only on the two screens that use it, neither of which is reachable. `Task` still admits `'compare'` and `screens/ScenarioSetup.tsx`, `screens/Result.tsx` and their tests are untouched; Iteration 2 restores one entry in `TaskSelect.tsx` and one card in `Home.tsx`.

### AC 1.1.2 — Open the local map

*Given the user is on the homepage, when the user selects a local drainage, water-flow, terrain or low-area option, then the system will:*

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

> **There is one way to name an address, and it is the map's own search bar.** The separate address screen is no longer on any route, so the criterion's *"given the user is on the local map"* is the only state it can be exercised from — which is what it describes.
>
> **1.1.3.e is met more strictly than it asks.** The address is held in memory for the life of the tab and in nothing else — not `localStorage`, not `sessionStorage`, not the URL, not `history.state`. `session.test.ts` enforces this by running a whole session against traps in place of both storages, `history` and `document.cookie`, rather than by reading the source: a rule checked by grep is a rule a refactor walks around.
>
> *The address is also never sent*, and the reason is stronger than a guard — there is no request that could carry it. Every outbound call in `apps/web` is a `GET` of a static artefact, with no body and no query string.

### AC 1.1.4 — Change the information mode

*Given a supported address is selected and the user is viewing the local map, when the user selects Drainage, Water Flow, Terrain or Low Areas, then the system will:*

- [x] **1.1.4.a** Clearly identify the selected mode as active
- [x] **1.1.4.b** Retain the selected address and current map location
- [ ] **1.1.4.c** Display recorded drainage pits and pipes when Drainage is selected — **deviation, see below**
- [x] **1.1.4.d** Display indicative surface-water paths when Water Flow is selected
- [x] **1.1.4.e** Display contour lines or an equivalent elevation visualisation when Terrain is selected
- [x] **1.1.4.f** Display the available low-area information when Low Areas is selected
- [x] **1.1.4.g** **Distinguish official recorded data from system-derived information**
- [x] **1.1.4.h** Provide the available modes for users to toggle

> **1.1.4.c is not met, and the reason is a decision rather than an omission.** The criterion
> describes a **Drainage** mode covering pits and pipes together, with the two separated behind
> the Layers button (AC 1.1.5). That was built on 3 September and reversed the same day by the
> design owner: **Pits and Pipes are chips of their own**, and Terrain moved behind Layers with
> the data-quality hatching.
>
> What is lost: there is no single control that turns the recorded network on and off in one
> press, and the top row does not read as the four names the criterion lists.
>
> What is kept, and it is the substance both criteria protect: **every layer still has its own
> switch**, pits and pipes are still independent, and each still says whether it is recorded or
> derived. The argument for the change is that a control's place should follow how often it is
> used — pits and pipes are the recorded data this product exists to show and are what a person
> switches most, while the ground surface is background, on by default and drawn under
> everything.
>
> Raised with the design owner with this criterion quoted, and confirmed. It is recorded here so
> that the answer exists before somebody asks the question.
>
> **The chips are multi-select, and that part is a reading of the criterion rather than a departure from it.** 1.1.4.a is singular — "the selected mode" — but 1.1.4.h asks that the modes be available "for users to toggle", and every bullet between them is of the form *when X is selected, display X*, all of which hold when several are on. Mutual exclusion is the reading that loses information for no reason: where water runs is a question about the ground it runs over, and a person comparing the two should not have to choose. Confirmed with the team on 2 September.
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

> **Every effect this criterion asks for is met; its opening clause is not.** There is no
> Drainage mode to have selected, so "given the user is viewing the local map with Drainage
> selected" describes a state the interface does not have — see the deviation under AC 1.1.4.c.
> Pits and Pipes are chips instead, and from there each of a to e holds: they switch
> independently, the untouched one keeps its visibility, the chips show which are on, the legend
> follows, and the address and map position are untouched.
>
> The Layers panel still exists and carries *Ground surface* and *Not enough ground measured*.
> The hatching is deliberately never hidden by anything else: it is a statement about the
> evidence rather than a view of the world, and it is the one mark that says the map is
> guessing.

### AC 1.1.6 — Expand or collapse the map legend

*Given the user is viewing the local map, when the user selects the Map Legend control, then the system will:*

- [x] **1.1.6.a** Expand the map legend when it is collapsed
- [x] **1.1.6.b** Collapse the map legend when it is expanded
- [x] **1.1.6.c** Display legend information relevant to the active mode and currently visible layers when expanded
- [x] **1.1.6.d** Keep the Map Legend control available when the legend is collapsed
- [x] **1.1.6.e** Retain the selected address, active mode, layer visibility and current map location

> **It is at the top right from 4 September**, at the mentor's request, and the move changed how it is positioned rather than only where. It used to be pinned to the bottom-left corner while the chips were pinned to the top; two absolutely positioned overlays cannot see each other, so on a narrow window one lands on the other. It is now the second child of the controls row, held right by `marginLeft: auto`, and wraps below the chips when there is no room for both.
>
> **Built before the criterion arrived, and 1.1.6.d is the reason it reads this way.** Collapsed, the legend keeps the words *Map legend* and its control rather than disappearing: a legend that vanishes completely is one nobody can find again. The criterion asks for exactly that, which is a pleasant way to find out a decision was the right one.
>
> **1.1.6.c is not a filter written twice.** The legend renders the layers that are currently visible — the same `LayerState` the canvas draws from — so a layer switched off leaves the key in the same render. There is no second list to fall out of step.
>
> **1.1.6.e is free, and that is the design.** The fold is local to the legend and touches nothing else; the address, the chips and the viewport are held elsewhere and never see it.

### AC 1.1.7 — View information about a map element

*Given the user is viewing a map containing selectable information, when the user selects an available map element, then the system will:*

- [x] **1.1.7.a** Highlight the selected map element
- [x] **1.1.7.b** Display the available information in a popup
- [x] **1.1.7.c** Provide a short plain-English explanation of the selected information
- [x] **1.1.7.d** Identify whether the information is official recorded data or system-derived information
- [x] **1.1.7.e** Provide a relevant next action where one is available
- [x] **1.1.7.f** Clearly identify any missing, incomplete or uncertain information

> **The street cross-section is now 1.1.7.e rather than a criterion of its own.** The revision dropped US 1.3's cross-section entirely; the feature is built, tested and kept, because it is exactly "a relevant next action" from a selected pit. Its two states carry 1.1.7.d and 1.1.7.f: **everything horizontal is recorded** — which pipes connect, on which side, their diameter and material — and **everything vertical is drawn**, said inside the figure rather than in a caption. The map artefact carries no invert level for any pit, so 726 of 895 pits can have a section and the other 169 get a screen that says what is missing and invents nothing.

### AC 1.1.8 — Enter an unsupported address

*Given the user is on the local map, when the user enters and confirms an address outside the supported pilot area, then the system will:*

- [x] **1.1.8.a** Explain that detailed local drainage information is not available for the address
- [x] **1.1.8.b** **Avoid** presenting local drainage results as if supported data were available
- [x] **1.1.8.c** Allow the user to enter a different address

> The distinction this turns on is between *no such address* and *a real address we hold nothing for*, and they are different things to a resident. Neither is ever resolved to a nearby address.

### AC 1.1.9 — Change the selected address

*Given an address is selected and the user is viewing the local map, when the user enters and confirms a different recognised address, then the system will:*

- [x] **1.1.9.a** Replace the previously selected address
- [x] **1.1.9.b** Centre the map on and mark the new address
- [x] **1.1.9.c** Update the displayed information for the new address
- [x] **1.1.9.d** Retain the active information mode where that mode is available

> Clicked on 3 September with a non-default mode set: Low Areas was switched on, the address was changed from 32 Altona Street to 3 Bangalore Street, and all four modes were still on afterwards with the map recentred and the new address marked.

### AC 1.1.10 — Return from the local map

*Given the user has opened the local map from the homepage or the historical flood information page, when the user selects Back, then the system will:*

- [x] **1.1.10.a** Return the user to the page from which the local map was opened
- [x] **1.1.10.b** Retain the selected address only for the current browser session
- [x] **1.1.10.c** Allow the user to return without relying on the browser's navigation controls

> **1.1.10.a is the one that needed building, and the reason is that there are two ways in.** The map opens from the homepage and from the flood board, so the session records which, and Back follows it. A Back that always went home would have been right half the time and silently wrong the other half — the worst kind of navigation bug, because nothing about it looks broken.
>
> It is not the `back` event, which walks a fixed chain of screens. This one reads where the person actually came from.
>
> **1.1.10.c is a button, and it took two attempts to put it where a person would look.** The first version was a link at the foot of the map panel and a clickable *Home* leading the breadcrumb. Neither reads as a way out: a breadcrumb says where you *are*, its first crumb happening to be clickable is not an exit, and the panel link sat below the fold of a side panel that can itself be collapsed. It is now a bordered *← Home* / *← Flood history* button at the top left of every screen that has somewhere to go back to, with the trail beside it reduced to the page you are on.
>
> Naming the destination is what makes it honest with two possible origins; a bare *Back* would be a guess.
>
> Clicked both ways on 3 September: from the board the crumb reads Flood history and Back lands on the board; from the homepage it reads Home and Back lands there.

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

**Built and clicked through on 3 September.** The board is `screens/FloodHistory.tsx`, the artefact `apps/web/public/data/flood-history.json` (5.4 KB), and the stage that builds it `drainlens_pipeline.flood_history`.

### AC 2.1.1 — View the historical flood overview

*Given the user is on the homepage, when the user selects the historical flood information option, then the system will:*

- [x] **2.1.1.a** Open the historical flood information page
- [x] **2.1.1.b** Display the five areas with the highest recorded flood-related incident counts
- [x] **2.1.1.c** Order the areas from the highest to the lowest recorded incident count
- [x] **2.1.1.d** Display the rank, area name and recorded incident count for each area
- [x] **2.1.1.e** Present the information using an infographic, bar chart or equivalent visualisation
- [x] **2.1.1.f** Display the reporting period, geographic unit and source of the information
- [x] **2.1.1.g** Clearly indicate when required information is missing, incomplete or unavailable
- [x] **2.1.1.h** Retain the five highest-ranked areas as the default view
- [x] **2.1.1.i** Provide an option to continue to the local drainage map

> **2.1.1.c is checked, not enforced.** The artefact arrives ranked and the browser refuses it if it is not descending, rather than re-sorting it: a file out of order is a pipeline defect, and sorting it here would hide the defect while leaving the ranks it published wrong.
>
> **2.1.1.b needed a decision the criterion does not anticipate.** Ranks five and six both recorded 133, and 133, 117, 85, 81 and 80 all repeat inside the published thirty. Five rows would present "the five highest" as five of the six highest without saying so, so the last row names the area level with it and where to find it. The alternative — a ranking drawn sharper than the counts behind it — is the failure this whole page is built against.
>
> **2.1.1.f sits above the first row, not in a footer.** Reporting period, area unit and both sources are the first thing under the heading, because a ranked list of suburbs is the most persuasive thing this product will ever show and the qualifications must not be scrollable past.
>
> **2.1.1.g is a live case rather than a defensive branch.** Nine of the thirty contain an SA1 whose count was withheld under the Privacy and Data Protection Act 2014. Those rows are marked *a count withheld* and their totals carry a `+`, because the number is a floor.
>
> **2.1.1.i is made concrete by the pilot area.** Kensington recorded 39 or more incidents over the six years, which places it well down the list — said on the page, so the invitation to the map is not an abstract link and does not imply the pilot area is a hotspot.

### AC 2.1.2 — Return from the historical flood information page

*Given the user is viewing the historical flood information page, when the user selects Back, then the system will:*

- [x] **2.1.2.a** Return the user to the homepage
- [x] **2.1.2.b** Allow the user to return without relying on the browser's navigation controls

> **Two controls, and neither is redundant.** *← Home* sits at the top left of every screen, which is where somebody looks first. The one at the foot of this page earns its place because the page is long — a ranking, six headed paragraphs and an invitation to the map — so by the time it has been read, the top of the screen is a long way up.

### AC 2.2.1 — Show more locations

*Given the user is viewing the historical flood information page, when the user selects Show More Locations, then the system will:*

- [x] **2.2.1.a** Display additional available locations
- [x] **2.2.1.b** Display **no more than 30 locations in total**
- [x] **2.2.1.c** Retain the Top Five locations at the beginning of the displayed results
- [x] **2.2.1.d** Use the same reporting period and counting basis for all displayed locations
- [x] **2.2.1.e** Display the available recorded incident count for each location
- [x] **2.2.1.f** Clearly indicate when information for a location is missing, incomplete or unavailable

> **2.2.1.b is enforced where the data is, not where it is drawn.** The pipeline publishes thirty and no more, so the cap cannot be exceeded by a change to a screen. 275 of Greater Melbourne's 281 areas recorded at least one incident, so the cap binds rather than the data.
>
> **2.2.1.d is free here and would not be if the page did the arithmetic.** One file, one incident type, one six-year period, one counting basis — nothing on the page recomputes anything.
>
> **The control is a toggle, and that is AC 2.1.1.h rather than a nicety.** It called the top five the default view, and a view somebody cannot return to is not a default -- it is a state the page leaves them in. Expanded, the button reads *Show the top 5 only*; collapsing scrolls the list back into sight, because folding thirty rows away from under the button would otherwise drop the reader below the whole section.
>
> Clicked on 3 September: thirty rows, Bacchus Marsh still first and Keilor East last. The bars do not rescale when the list grows, because they are scaled against every published area rather than the visible ones — a picture that changed while the data did not would be its own small lie.

### AC 2.2.2 — Show fewer locations

*Given the page is displaying more than the default Top Five, when the user selects Show Fewer Locations, then the system will:*

- [x] **2.2.2.a** Collapse the displayed results to the five highest-ranked locations
- [x] **2.2.2.b** Retain the original ranking and reporting basis
- [x] **2.2.2.c** Replace Show Fewer Locations with Show More Locations
- [x] **2.2.2.d** Retain the user on the historical flood information page

> **Built before the criterion arrived**, for the reason AC 2.1.1.h gives: it calls the top five the default view, and a view somebody cannot return to is not a default but a state the page leaves them in.
>
> **2.2.2.b is free because nothing is recomputed.** Expanding and collapsing slice the same ranked array; there is no second sort to disagree with the first.
>
> Collapsing also scrolls the list back into sight. The control sits under thirty rows, so folding them away without it drops the reader below the whole section with no sign that the list had shrunk — measured after the change at 138px of an 800px viewport.

### AC 2.3.1 — View the data explanation

*Given the user is viewing the historical flood information page, when the historical information is displayed, then the system will:*

- [x] **2.3.1.a** Identify the source, reporting period and meaning of a recorded incident count
- [x] **2.3.1.b** Explain any relevant limitations or gaps in the available historical data
- [x] **2.3.1.c** Explain that recorded incident counts **do not indicate flood severity or property damage**
- [x] **2.3.1.d** State that the information **does not represent current or future flood conditions**

> **2.3.1.a is quoted from the Data Quality Statement rather than paraphrased.** One count is one crew dispatch; a task may or may not have followed; several crews at one incident count once.
>
> **2.3.1.b has four limitations, and each is measured rather than hedged.** Flash flooding is recorded under Storm and is not counted here. 2010-11 is 45% of the incidents on the board, so the ranking is substantially a record of one year — drawn as a chart above the list rather than written under it, because a sentence beneath a chart is a sentence people skim past the chart to reach. 144 small areas had counts withheld for privacy. And a count depends on who calls, which varies with population and with whether people ring the SES, the council, or nobody.
>
> **2.3.1.c and 2.3.1.d are the same commitment the rest of the product makes**, applied to a new kind of number. Each is its own headed paragraph, not a clause inside another one.

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

- [ ] **Change address** from the map keeps the active modes and the map location *(AC 1.1.9.d)*
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
