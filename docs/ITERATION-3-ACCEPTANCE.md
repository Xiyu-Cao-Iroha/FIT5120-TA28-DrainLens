# Iteration 3 — acceptance criteria

DrainLens · TA28 · demonstration **date to be confirmed**

What "done" means for Epic 5 and Epic 6. The work that produces it is in [ITERATION-3-TASKS.md](./ITERATION-3-TASKS.md).

**Tick a criterion only when it has been seen working on the deployed build** — not when the code that should satisfy it has been merged. Nothing below is ticked: this file was written on **29 September 2026**, before the work.

**Source:** *Iteration 3 Requirements* and *Iteration 3 Epic, US & AC*, received **29 September 2026**. Epic 5 (US 5.1–5.4) and Epic 6 (US 6.1–6.3) are **Must Have**. Epic 7 (US 7.1–7.2) is **Could Have**, US 7.3 **Won't Have**, and neither has criteria here. Where those documents and this file disagree, the documents win and this file has a bug.

**190 sub-criteria: 109 in Epic 5, 81 in Epic 6**, across 25 acceptance criteria. Iteration 1 had 96 and Iteration 2 had 134.

---

## The three measurements that shape this iteration

Taken on 29 September against the published artefacts, before any of the work, because each one decides what the criteria can honestly say.

### 1 · There are 91 warning markers in the council, and most addresses have none near them

Epic 5 is built on the pooling-warning markers already published (`low-area-warnings.json`): the lowest street cell of a hollow, at least 1 m below its spill level, on a hollow of at least 100 m², no two within 150 m. There are **91 across the City of Melbourne** and 2 in the bundled Kensington square.

Against all 62,397 addresses in the index:

| Search distance | Addresses with at least one marker | 0 | 1 | 2 | 3 or more |
|---:|---:|---:|---:|---:|---:|
| 100 m | 17.1% | 51,749 | 10,384 | 264 | 0 |
| 150 m | 30.5% | 43,378 | 15,228 | 3,487 | 304 |
| **200 m** | **41.4%** | **36,555** | **15,697** | **6,731** | **3,414** |
| 300 m | 58.1% | 26,142 | 17,446 | 6,358 | 12,451 |

**AC 5.1.3 — the address with no nearby place — is the majority case, not the edge case.** At 200 m, 58.6% of addresses have nothing to number. That is the iteration's version of Iteration 2's *No clear difference*: the honest answer for most people, and the criteria were written for it. A search distance chosen to make the screen look busy would be the one change that makes the product worse.

### 2 · Every address but one falls in exactly one subcatchment

The Melbourne Water subcatchment boundaries (3,409 across its region, EPSG:28355) were tested against every address:

| | |
|---|---|
| Subcatchments overlapping the council extent | 33 |
| Subcatchments an address actually falls in | 20 |
| Addresses matched to exactly one | **62,396 of 62,397** |
| Addresses matched to more than one | **0** |
| Addresses matched to none | **1** |

So AC 6.1.5 — *could not be confidently identified* — is real, rare and must still be built. **It must not be satisfied by assigning the nearest subcatchment**, which the criterion forbids outright.

The 20 subcatchments carry all four of AC 6.1.2's classes: main drains (`ALEXANDRA PARADE M.D.`, `HANNA ST M.D.`), waterway sections (`YARRA RIVER (MOUTH TO MERRI)`, `MOONEE PONDS CREEK (LOWER)`), council drainage discharging directly (`9877 COUNCIL DRAINAGE DIRECT TO BAY` — with the numeric prefix AC 6.1.1 says to remove), and names needing a decision before they can be classed at all (`ELIZABETH ST DRAIN (CITY)`, `DYNON RD TIDAL CANAL`).

### 3 · The pipe operator field exists at the source, and we dropped it

AC 6.2.2 asks for three distinct answers about a pipe's operator. The published dataset has exactly those three states, and our artefact has none of them: `network.py` keeps five fields and `operator` is not one.

| Value in the source | Pipes | What AC 6.2.2 requires on screen |
|---|---:|---|
| `City of Melbourne` | 16,302 | *City of Melbourne* |
| empty | 87 | *Operator not recorded* |
| `4` | 853 | *Operator code not yet identified* |

The stormwater pits dataset has **no operator field at all**, which is why the criterion forbids showing one for a pit and forbids inferring it from a connected pipe.

---

## Parameters decided before the work

AC 5.1.1 and the Epic 5 definition of done require the search distance, selection rule, numbering rule and count limit to be **defined, justified against the available data and approved before acceptance testing**. These are the team's decisions of 29 September, with the justification beside each.

| Parameter | Value | Why |
|---|---|---|
| Search distance | **200 m** | The distance already used for *a drain near your address* (`COMPARISON_RADIUS_M`) and the guide's teaching radius. One meaning of "near" across the product. 41.4% of addresses have a place; the rest take AC 5.1.3 |
| Qualifying location | An existing published pooling-warning marker, unchanged | AC 5.1.1: *only locations that meet the approved preparation rules and are represented by the existing pooling-warning markers*. Nothing new is computed for Epic 5 |
| Count limit | **3** | AC 5.1.1 and 5.2.2. At 200 m this caps 3,414 addresses; the rest are under it already |
| Numbering rule | **Nearest first**, ties broken on easting then northing | Distance is the one ordering a reader can check against the map. It must be said in words that it is distance, because AC 5.1.1 forbids implying risk, severity or priority |
| Relevance storage | In memory for the session only | AC 5.4.1: not a server, and the address must not reach storage (the standing rule since Iteration 1) |

**Three registers have to exist and be approved before acceptance testing**, and they are the team's, not the code's: the preparation rules register (Epic 5), the guidance content register (Epic 5 and 6) and the subcatchment classification register with the operator mapping (Epic 6). Each gets a document in this repository so the code has one source to read, and each is marked *awaiting team approval* until the team records it in the project governance portfolio.

---

## What the criteria can reuse, and what has to be built

| Already in the product | Used by |
|---|---|
| Pooling-warning markers, their pipeline rules and the map layer | 5.1.1, 5.1.2, 5.3.1 |
| Low areas, water paths and ground height, with their *Estimated by DrainLens* labels | 5.1.2, 5.3.1 |
| The address screen, session-only address handling and *About the data* | 5.2.1, 5.4.2, 6.1.1 |
| Pit and pipe records with their council identifiers | 6.2.2, 6.3.2 |
| The source and provenance vocabulary in `ui/terms.ts` and `ui/sources.ts` | throughout |

| Does not exist yet | Needed by |
|---|---|
| Subcatchment boundaries, names, areas and record dates as an artefact | 6.1.1–6.1.5 |
| The pipe `operator` field, through the pipeline, the database and the API | 6.2.2 |
| Pit counts and clipped pipe length per subcatchment | 6.1.3 |
| A preparation plan screen, its relevance state and its printable form | 5.2, 5.4 |
| A reporting-guidance journey with five problem types | 6.3 |
| Official guidance sources for every action and channel | 5.3.2, 6.2.1, 6.3.2 |

---

## Epic 5 — Turn local map information into before-rain checks

### US 5.1 — Review nearby places before heavy rain

**AC 5.1.1 — View before-rain checks on the map.** At most three qualifying markers within 200 m; each qualifying marker is *replaced* by a numbered version of the same marker, never drawn twice; markers beyond 200 m stay as they are; a *Before-rain checks* control; the legend *Places to check before heavy rain · Estimated by DrainLens*; numbers and labels that do not cover water paths, pipes or pits; *Check before heavy rain (n)* on the address card, without the count where there is none; and the address, mode, layers and view all kept.

> The replacement is the part to test hardest. Two markers for one hollow would read as two places, and the count on the card would disagree with the map.

**AC 5.1.2 — Review a nearby place.** *Place n · Check before heavy rain*; the conditional action before its explanation; move cars or bins when heavy rain is forecast; *Applies to me* / *Doesn't apply to me*, changeable; *Next place* only where another exists; a way into the plan; the pooling explanation, source and limitation folded under *Why this place?*; plain English for why it was identified; *Estimated by DrainLens · Not a live warning*; *Show on map*; and anything missing or uncertain said plainly.

**AC 5.1.3 — Addresses without nearby places.** No numbered places; no *Places near you* section; a statement that none were marked from the available information; that this does not mean the area cannot flood; no presentation of absence as lower risk; the general actions still offered, and reachable from the address card.

### US 5.2 — Build a relevant preparation plan

**AC 5.2.1** opens the checks and the plan from a supported address, keeps the map position, distinguishes *Places near you* from *For every home*, returns to the map without losing selections, and needs no account.

**AC 5.2.2** generates reminders only from qualifying markers, at most three, each a separate place but the same conditional action; ground slope explains a place and never creates one; **the nearest pit, a mapped pipe, a blockage-scenario result and area-level flood history must not identify, number or order a place**; a reminder exists only for *Applies to me*, worded *When heavy rain is forecast: move your car or bins from Place n*; and no probability, category, depth, safe route or evacuation route.

**AC 5.2.3** organises the plan: *Places near you* only where there are some, each with its status and *Show on map*; no *Who can help: You* for a nearby place; three to four general actions, one short sentence each; a separate *Report a drainage problem* pathway; emergency information kept apart; a direct VicEmergency link; and no readiness or preparedness score.

**AC 5.2.4** handles missing information and unsupported addresses: general actions still shown, what is missing named, unsupported places omitted rather than guessed.

### US 5.3 — Why a place is shown, and where to get help

**AC 5.3.1** gives a *Because* line naming the low area and water paths, *Show on map*, *Estimated by DrainLens*, the official source behind the action, that it is not a live warning, and one sentence that the place is the street rather than the reader's property.

**AC 5.3.2** keeps help and reporting separate: no *Who can help: You* for a nearby place, official guidance for the general actions, *Report a drainage problem* as its own pathway into US 6.3, an organisation named only after a problem type is chosen, and VICSES and Triple Zero kept apart from non-urgent reporting.

**AC 5.3.3** states the safety boundary: not a live warning or forecast; the map does not decide whether a property will flood; monitor VicEmergency; never enter floodwater, lift drain covers or interfere with drainage; VICSES 132 500; Triple Zero 000.

### US 5.4 — Review and keep the plan

**AC 5.4.1** counts both answers as reviewed, shows *n of m reviewed*, distinguishes the three states, allows change and reset, avoids *Done* or *Completed*, keeps selections for the session only, avoids calling the count a score, and **sends neither the address nor the selections to a server**.

**AC 5.4.2** clears every selection when the address changes, renumbers for the new address, generates nothing from the old selections, and leaves the general actions alone.

**AC 5.4.3** prints or downloads a one-page plan: address and date; only *Applies to me* reminders; no *Doesn't apply* or *Not reviewed*; the section omitted where none apply; the general actions; sources and the safety boundary; *Estimated by DrainLens* kept on each reminder; no reviewed count or controls; generated in the browser; and a line saying the copy is the reader's to keep.

---

## Epic 6 — Understand my drainage area and where to report problems

### US 6.1 — Subcatchment and receiving drain

**AC 6.1.1** identifies the subcatchment from the complete boundary, draws it, names it in plain English with numeric prefixes removed and abbreviations written out, puts wider catchment names under *More information*, identifies it as official Melbourne Water data, and keeps address, mode and position for the session only.

**AC 6.1.2** describes the receiving drain from the approved classification register, with the four wordings — main drain, waterway section, *This area is recorded as council drainage discharging directly to a receiving waterway or bay*, and unclassified — naming a destination only where the fields support it, and never claiming that every pipe from the address reaches it.

**AC 6.1.3** summarises the area: recorded area, pit count, mapped pipe length **clipped to the subcatchment**, whether supported low areas are present, the coverage limitation, no claim of council ownership, and the statement that a shared subcatchment is not a shared flood risk or shared pipes.

**AC 6.1.4** shows *This drainage-area record was last updated in [year]* from the matched record, keeps *Record last updated* and *Dataset layer last edited* separate, hides internal field names, calls neither a survey date, does not present portal metadata as the record date, and explains that the area may not reflect recent development and that the boundary is not a flood extent, a pipe connection or legal ownership.

**AC 6.1.5** handles the unmatched or ambiguous address: say so, never substitute the nearest, never pick between matches without an approved rule, keep the reporting guidance and keep the rest of the map.

### US 6.2 — Who can help at each level

**AC 6.2.1** shows three levels — private property, local street drainage, regional drains and waterways — with the general roles, an official citation, and a statement that these do not confirm the owner or operator of a specific asset.

**AC 6.2.2** displays the operator mapping in the table above for pipes, identifies a pit as a City of Melbourne stormwater pits record, and shows no operator for a pit, inferred from nothing.

**AC 6.2.3** keeps preparation separate from reporting: *You or your household* for a preparation action, never an organisation because a pit or pipe is nearby, never the nearest pit as "the drain for this address", reporting as its own pathway, and an organisation named only after a problem type or a feature the reader selected.

### US 6.3 — Report a drainage problem

**AC 6.3.1** offers five problem types: blocked or flooded street drain; damaged or missing grate; private property; regional drain or waterway; flood or storm emergency.

**AC 6.3.2** shows the organisation, an official channel from the guidance register, and what to prepare — location, date and time, photos taken from a safe place. A recorded pit appears **only if the reader selected it**, labelled *Selected recorded drain*, with its identifier; continuing without one is allowed; nothing is auto-selected; private property goes to a licensed plumber; no response time, outcome or repair is stated; and DrainLens prepares the report but does not submit it.

**AC 6.3.3** copies or prints a short summary — address, problem type, who to contact, the checklist — generated locally, kept by nobody after the session, and said to be the reader's copy.

**AC 6.3.4** puts VICSES 132 500 and Triple Zero 000 first for an emergency, keeps the non-urgent checklist out of the primary position, and advises against entering floodwater or approaching drains in unsafe conditions.

---

## How each criterion will be checked

The same three ways as Iteration 2, and a criterion is ticked only when the first applies.

1. **Seen on the deployed build**, against this file, by a person following [WALKTHROUGH-CHECKLIST.md](./WALKTHROUGH-CHECKLIST.md) — extended for Epics 5 and 6 as part of this iteration.
2. **Held by a test** where the rule is one code can be wrong about: numbering, the count limit, relevance state, what the printed plan contains, the classification wording, the operator mapping.
3. **Held by a data check** in `tools/data/` where the rule is about an artefact: every address matching one subcatchment or none, the marker count, pipe length clipped to boundaries.

**Privacy is not a criterion to tick once.** AC 5.4.1, 5.4.3 and 6.3.3 all forbid the address or the reader's selections reaching a server. The existing rule — no address in storage, the URL, history state or any request — extends to the relevance selections and the printed plan, and the check-list is the same one used since Iteration 1.
