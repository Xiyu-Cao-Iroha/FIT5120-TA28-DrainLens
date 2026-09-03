# Iteration 1 — acceptance criteria

DrainLens · TA28 · demonstration **Tuesday 1 September 2026**

What "done" means. The work that produces it is in [ITERATION-1-TASKS.md](./ITERATION-1-TASKS.md), where every task names the criterion below that it serves.

**Tick a criterion only when it has been seen working on the deployed build** — not when the code that should satisfy it has been merged.

**Source:** *Epics, User Stories and Acceptance Criteria*, current approved revision. That revision keeps Epic 1 focused on the local two-dimensional map, moves the Comparison feature to Epic 3 in Iteration 2, and replaces the former Epic 2 with historical flood information. Where this file and that document disagree, the document wins and this file has a bug.

**Scope:** Epic 1 and Epic 2 are Must Have. Epic 3 is Iteration 2.
**Deliberately out of scope:** the drain-blockage Comparison feature; a street or underground cross-section; machine learning; live rainfall; capacity or bottleneck claims; absolute ponding depth or extent; water arrival time; blockage formation over time; pit-to-address distance states; and expanding or collapsing supplementary pit information.

**Resolved after the revised Epic 1–2 scope was agreed:**

- **Comparison moves to Epic 3 and Iteration 2.** It must not appear in the Iteration 1 interface, even if implementation remains in the codebase.
- **Epic 2 is the historical flood information board.** It shows the Top Five areas by recorded flood-related incident count by default, can show more available locations up to 30, and can collapse back to the Top Five.
- **The main experience begins on an explanatory homepage.** A user may choose a feature before entering an address; address search remains available at the top of the local map.
- **The local map remains two-dimensional.** Drainage pits and pipes are recorded layers; Terrain uses contours or an equivalent elevation visualisation; Low Areas and Water Flow are presented as indicative where applicable.
- **Drainage pits and pipes can be controlled independently.** The map legend expands or collapses and must stay consistent with the active mode and visible layers.
- **Navigation is explicit.** The local map and historical flood information page each include a Back action instead of relying on the browser controls.
- **Pit distance and supplementary pit-information collapse are deferred.** Neither is an Iteration 1 acceptance criterion.

---

## Where this stands — revised scope

The former **77 of 77 interaction criteria met** statement applied to the superseded scope and must not be carried forward. The criteria below now match the approved Epic 1–2 revision. All boxes are intentionally open until the revised journeys have been exercised on the deployed build.

Some existing implementation evidence remains useful: address centring and marking, privacy-preserving in-memory address state, recorded pit details, and downstream tracing were previously exercised. Those notes are retained under the relevant criteria, but they do not by themselves prove that the revised homepage, map modes, navigation or historical information journey works end to end.

The current acceptance pass must cover both journeys:

1. Homepage → local map → supported or unsupported address → map modes and layers → map popup → downstream drainage path → Back.
2. Homepage → historical flood information → Top Five → Show More Locations → Show Fewer Locations → local drainage map or Back.

---

## US 1.1 — Understand and explore water flow near an address

### AC 1.1.1 — View the available information

*Given the user has not selected an address, when they open the website, then the system will:*

- [ ] **1.1.1.a** Display a homepage that briefly explains the purpose of the website
- [ ] **1.1.1.b** Introduce the available local drainage, water-flow, terrain, low-area and historical flood information
- [ ] **1.1.1.c** Present clear entry points to the main available features
- [ ] **1.1.1.d** Allow the user to choose where to begin without first entering an address
- [ ] **1.1.1.e** Not display the drain-blockage Comparison feature in the Iteration 1 interface

> The homepage is an introduction and route into the product, not an address-search screen with explanatory text added around it. The Comparison route must be absent from the current interface rather than merely labelled as unavailable.

### AC 1.1.2 — Open the local map

*Given the user is on the homepage, when they select a local drainage, water-flow, terrain or low-area option, then the system will:*

- [ ] **1.1.2.a** Open the local map
- [ ] **1.1.2.b** Display an address search bar at the top of the map
- [ ] **1.1.2.c** Display the available mode controls at the top of the map
- [ ] **1.1.2.d** Activate the mode associated with the option selected by the user
- [ ] **1.1.2.e** Allow the user to enter an address within the supported pilot area

### AC 1.1.3 — Select a supported address

*Given the user is on the local map, when they enter and confirm a recognised address within the supported pilot area, then the system will:*

- [ ] **1.1.3.a** Display the selected address
- [ ] **1.1.3.b** Centre the map on and mark the selected address
- [ ] **1.1.3.c** Display the available information for the active mode
- [ ] **1.1.3.d** Allow the user to continue without creating an account
- [ ] **1.1.3.e** Retain the selected address only for the current browser session
- [ ] **1.1.3.f** Clearly identify any missing, incomplete or uncertain information

> **The address-state evidence from the previous build remains relevant but must be rerun through the revised map entry.** Confirm no request carries the address and that it appears in no `localStorage` key, `sessionStorage` key, URL or history state. Navigation state should remain in memory only. Address centring and marking were previously checked at an interior address and near the supported-area boundary; repeat those checks in the revised journey.

### AC 1.1.4 — Change the information mode

*Given the user has selected a supported address and is viewing the local map, when they select Drainage, Water Flow, Terrain or Low Areas, then the system will:*

- [ ] **1.1.4.a** Clearly identify the selected mode as active
- [ ] **1.1.4.b** Retain the selected address and current map location
- [ ] **1.1.4.c** Display recorded drainage pits and pipes when Drainage is selected
- [ ] **1.1.4.d** Display indicative surface-water paths when Water Flow is selected
- [ ] **1.1.4.e** Display contour lines or an equivalent elevation visualisation when Terrain is selected
- [ ] **1.1.4.f** Display the available low-area information when Low Areas is selected
- [ ] **1.1.4.g** Distinguish official recorded data from system-derived information
- [ ] **1.1.4.h** Provide the available modes for users to toggle

> Mode changes must update the information presented without resetting the selected address or unexpectedly moving the map. Drainage is not a master switch for every overlay: its pit and pipe sublayers are controlled separately under AC 1.1.5.

### AC 1.1.5 — Control the drainage layers

*Given the user is viewing the local map with Drainage selected, when they open Layers and change the Drainage Pits or Drainage Pipes option, then the system will:*

- [ ] **1.1.5.a** Allow the drainage-pit and drainage-pipe layers to be shown or hidden independently
- [ ] **1.1.5.b** Retain the visibility of the layer that the user has not changed
- [ ] **1.1.5.c** Clearly identify which drainage layers are currently visible
- [ ] **1.1.5.d** Update the map legend to reflect the visible drainage layers
- [ ] **1.1.5.e** Retain the selected address and current map location

> Check all four meaningful states: both layers visible, pits only, pipes only, and both hidden. Changing one layer must not silently change the other.

### AC 1.1.6 — Expand or collapse the map legend

*Given the user is viewing the local map, when they select the Map Legend control, then the system will:*

- [ ] **1.1.6.a** Expand the map legend when it is collapsed
- [ ] **1.1.6.b** Collapse the map legend when it is expanded
- [ ] **1.1.6.c** Display legend information relevant to the active mode and currently visible layers when expanded
- [ ] **1.1.6.d** Keep the Map Legend control available when the legend is collapsed
- [ ] **1.1.6.e** Retain the selected address, active mode, layer visibility and current map location

### AC 1.1.7 — View information about a map element

*Given the user is viewing a map containing selectable information, when they select an available map element, then the system will:*

- [ ] **1.1.7.a** Highlight the selected map element
- [ ] **1.1.7.b** Display the available information in a popup
- [ ] **1.1.7.c** Provide a short plain-English explanation of the selected information
- [ ] **1.1.7.d** Identify whether the information is official recorded data or system-derived information
- [ ] **1.1.7.e** Provide a relevant next action where one is available
- [ ] **1.1.7.f** Clearly identify any missing, incomplete or uncertain information

> The popup may show available pit information, but Iteration 1 does not require a pit-to-address distance or a control for collapsing supplementary pit information. Those behaviours are deferred rather than hidden inside this general criterion.

### AC 1.1.8 — Enter an unsupported address

*Given the user is on the local map, when they enter and confirm an address outside the supported pilot area, then the system will:*

- [ ] **1.1.8.a** Explain that detailed local drainage information is not available for the address
- [ ] **1.1.8.b** Not present local drainage results as if supported data were available
- [ ] **1.1.8.c** Allow the user to enter a different address

> The supported pilot area follows the verified drainage-data coverage. An unsupported address is a normal user path, not an exceptional error state.

### AC 1.1.9 — Change the selected address

*Given the user has selected an address and is viewing the local map, when they enter and confirm a different recognised address, then the system will:*

- [ ] **1.1.9.a** Replace the previously selected address
- [ ] **1.1.9.b** Centre the map on and mark the new address
- [ ] **1.1.9.c** Update the displayed information for the new address
- [ ] **1.1.9.d** Retain the active information mode where that mode is available

### AC 1.1.10 — Return from the local map

*Given the user has opened the local map from the homepage or the historical flood information page, when they select Back, then the system will:*

- [ ] **1.1.10.a** Return the user to the page from which the local map was opened
- [ ] **1.1.10.b** Retain the selected address only for the current browser session
- [ ] **1.1.10.c** Allow the user to return without relying on the browser's navigation controls

> Test both origins. Back from a map opened on the homepage must return to the homepage; Back from a map opened through the historical board must return to that board.

---

## US 1.2 — Follow the downstream drainage path

### AC 1.2.1 — Select a drainage pit

*Given the user is viewing a local map containing recorded drainage pits, when they select a drainage pit, then the system will:*

- [ ] **1.2.1.a** Highlight the selected drainage pit
- [ ] **1.2.1.b** Display the available recorded information for the pit in a popup
- [ ] **1.2.1.c** Identify the information as official recorded data
- [ ] **1.2.1.d** Provide an option to show its recorded downstream path

> Existing pit-detail provenance remains relevant: every displayed recorded value must keep the basis that produced it. The revised acceptance pass should verify this inside the new popup presentation.

### AC 1.2.2 — Follow the recorded downstream path

*Given the user has selected a drainage pit with an available recorded downstream connection, when they select Show downstream path, then the system will:*

- [ ] **1.2.2.a** Highlight the selected pit and its available recorded downstream pipes
- [ ] **1.2.2.b** Show the recorded direction of the drainage path
- [ ] **1.2.2.c** Continue the path to the recorded outlet or the last known connection
- [ ] **1.2.2.d** Clearly identify any missing or uncertain connection
- [ ] **1.2.2.e** Avoid completing the path using unsupported or inferred pipe connections

> **Existing implementation evidence remains applicable.** The traversal is in `apps/web/src/trace/graph.ts`, the rendering in `trace/draw.ts`, the pit panel in `screens/PitDetail.tsx`, and the topology comes from `drainlens_pipeline.trace`.
>
> Three behaviours remain load-bearing and each needs its own test: the cycle guard, branch handling, and the termination reason — outlet, data boundary or missing connection. A pipe whose downstream pit is absent from the export must remain an edge with no destination so that the displayed path reaches the last recorded connection and stops with an honest reason.

---

## US 1.3 — Understand local terrain and low areas

### AC 1.3.1 — View the local terrain

*Given the user has selected a supported address and is viewing the local map, when they select Terrain, then the system will:*

- [ ] **1.3.1.a** Display contour lines or an equivalent two-dimensional elevation visualisation
- [ ] **1.3.1.b** Clearly distinguish differences in terrain elevation
- [ ] **1.3.1.c** Retain the selected address and current map location
- [ ] **1.3.1.d** Provide a legend or explanation for the terrain visualisation
- [ ] **1.3.1.e** Distinguish recorded information from system-derived information
- [ ] **1.3.1.f** Clearly indicate when terrain information is missing, incomplete or unavailable

> The previous street cross-section criteria do not apply to this iteration. Terrain remains a two-dimensional map visualisation and must not imply unsupported underground depth information.

### AC 1.3.2 — View low areas

*Given the user has selected a supported address and is viewing the local map, when they select Low Areas, then the system will:*

- [ ] **1.3.2.a** Display the available low-lying areas on the two-dimensional map
- [ ] **1.3.2.b** Visually distinguish low areas from other map information
- [ ] **1.3.2.c** Retain the selected address and current map location
- [ ] **1.3.2.d** Provide a legend or explanation for the displayed low areas
- [ ] **1.3.2.e** Identify the information as indicative where applicable
- [ ] **1.3.2.f** Not present the displayed low areas as current or predicted flood conditions

---

## US 2.1 — View areas with the highest recorded flood-related incident counts

### AC 2.1.1 — View the historical flood overview

*Given the user is on the homepage, when they select the historical flood information option, then the system will:*

- [ ] **2.1.1.a** Open the historical flood information page
- [ ] **2.1.1.b** Display the five areas with the highest recorded flood-related incident counts based on the available historical data
- [ ] **2.1.1.c** Order the areas from the highest to the lowest recorded incident count
- [ ] **2.1.1.d** Display the rank, area name and recorded flood-related incident count for each area
- [ ] **2.1.1.e** Present the information using an infographic, bar chart or equivalent data visualisation
- [ ] **2.1.1.f** Display the reporting period, geographic unit and source of the historical information
- [ ] **2.1.1.g** Clearly indicate when required information is missing, incomplete or unavailable
- [ ] **2.1.1.h** Retain the five highest-ranked areas as the default view
- [ ] **2.1.1.i** Provide an option to continue to the local drainage map

> The ranking uses recorded incident count only. Final area names, reporting period, geographic unit, source and counting basis must come from the verified dataset; illustrative design values are not acceptance evidence.

### AC 2.1.2 — Return from the historical flood information page

*Given the user is viewing the historical flood information page, when they select Back, then the system will:*

- [ ] **2.1.2.a** Return the user to the homepage
- [ ] **2.1.2.b** Allow the user to return without relying on the browser's navigation controls

---

## US 2.2 — View more locations

### AC 2.2.1 — Show more locations

*Given the user is viewing the historical flood information page, when they select Show More Locations, then the system will:*

- [ ] **2.2.1.a** Display additional available locations
- [ ] **2.2.1.b** Display no more than 30 locations in total
- [ ] **2.2.1.c** Retain the Top Five locations at the beginning of the displayed results
- [ ] **2.2.1.d** Use the same reporting period and counting basis for all displayed locations
- [ ] **2.2.1.e** Display the available recorded flood-related incident count for each location
- [ ] **2.2.1.f** Clearly indicate when information for a location is missing, incomplete or unavailable

### AC 2.2.2 — Show fewer locations

*Given the historical flood information page is displaying more than the default Top Five locations, when they select Show Fewer Locations, then the system will:*

- [ ] **2.2.2.a** Collapse the displayed results to the five highest-ranked locations
- [ ] **2.2.2.b** Retain the original ranking and reporting basis
- [ ] **2.2.2.c** Replace Show Fewer Locations with Show More Locations
- [ ] **2.2.2.d** Retain the user on the historical flood information page

> Show More Locations and Show Fewer Locations are two states of the same ranking. Collapsing the list must not rerank it, change the reporting basis or navigate away from the page.

---

## US 2.3 — Understand the historical information

### AC 2.3.1 — View the data explanation

*Given the user is viewing the historical flood information page, when the historical information is displayed, then the system will:*

- [ ] **2.3.1.a** Identify the source, reporting period and meaning of a recorded flood-related incident count
- [ ] **2.3.1.b** Explain any relevant limitations or gaps in the available historical data
- [ ] **2.3.1.c** Explain that recorded incident counts do not indicate flood severity or property damage
- [ ] **2.3.1.d** State that the information does not represent current or future flood conditions

> Data validation belongs to the verified dataset and implementation rather than the wording of the user need. Acceptance requires the displayed values and context to match that verified data; it does not prescribe a specific database field, API shape or calculation implementation.

---

## Definition of done

From the current Iteration 1 requirements. These checks govern delivery but do not add interaction outcomes to the acceptance criteria above.

### Epic 1 — Understand Local Drainage and Water Flow

- [ ] A user can complete the full journey: open the homepage → enter the local map through a chosen feature → select an address → change modes and drainage layers → inspect a map element → follow a recorded downstream path
- [ ] The map and drainage trace use available source data without inventing missing connections, terrain information or drainage constraints
- [ ] Recorded and system-derived information are distinguishable; missing or uncertain information is labelled; searched addresses are retained only for the current browser session
- [ ] Drainage pits and pipes can be shown or hidden independently, and the collapsible legend remains consistent with the visible information
- [ ] Terrain and low-area information remains two-dimensional and does not claim current or predicted flood conditions
- [ ] Explicit Back navigation works from every required origin without losing required session state
- [ ] Reviewed, tested against all Epic 1 criteria, and demonstrated in the test environment with no unresolved defect preventing the main journey

### Epic 2 — Understand Historical Flood Patterns

- [ ] A user can open the historical board, view the default Top Five, show more available locations up to 30, collapse back to the Top Five, and continue to the local drainage map
- [ ] The ranking uses the verified historical data and one consistent reporting period, geographic unit and counting basis
- [ ] Rank, area name and recorded incident count are presented clearly through an infographic, bar chart or equivalent visualisation
- [ ] Source, meaning, missing information and relevant limitations remain visible and understandable
- [ ] The board does not present incident count as severity, damage, a live warning or a prediction of future flood conditions
- [ ] Explicit Back navigation returns the user to the homepage
- [ ] Reviewed, tested against all Epic 2 criteria, and demonstrated in the test environment with no unresolved defect preventing the main journey

---

## UI definition of done

Behaviours that support the agreed experience without replacing the acceptance conversation above.

- [ ] The homepage introduces the product and its main features without requiring an address first
- [ ] The local map gives priority to the map, with address search and mode controls at the top rather than a permanent sidebar
- [ ] Popup information, layer controls and the legend do not obscure the user's selected address or essential map controls
- [ ] Active modes, visible layers and available Back actions are visually clear
- [ ] The agreed desktop and mobile layouts preserve the same required journeys and information hierarchy
- [ ] The browser back button does not strand the user on a screen whose required state has been lost
- [ ] No navigation writes the address to `localStorage`, `sessionStorage`, the URL or history state; history state carries a screen identifier only

---

## Wording to hold on the day

Everyone who speaks about the product holds these. They are what the criteria above commit us to, and nothing further.

- Not a flood warning, not a forecast, not an engineering assessment.
- Historical rankings show recorded flood-related incident counts only — not flood severity, damage, affected population, current conditions or future risk.
- Terrain, low-area and surface-water information is indicative where applicable and must not be described as a current or predicted flood condition.
- Drainage pits, pipes and recorded downstream connections are official recorded data; derived water-flow or terrain presentation must be identified separately.
- We do not fill missing connections or other unavailable information using unsupported assumptions.
- We do not speak about pipe capacity or bottlenecks.
- The Comparison feature is Epic 3 in Iteration 2 and must not be demonstrated in the Iteration 1 interface.
- No machine learning in this iteration.