# Test conditions: every criterion from Iterations 1 to 3, in one table

DrainLens · TA28 · written 12 October 2026 against `develop`

Three things live here, in the order they are used:

1. **[The table](#1-the-table)**, all 67 acceptance criteria from the three iterations, one row each, with where on the site each one is seen and a box to tick.
2. **[The run](#2-the-run)**, a click order that reaches every screen once, with the checks that are not criteria: buttons, search, error cases, response time, dropdowns and what happens when a server does not answer.
3. **[An order for a tester](#3-an-order-for-a-tester)**, about twenty five minutes, for a peer mentor who has not seen the product.

**The table is a list of conditions, not the criteria themselves.** Each row is one line about what to look for. The bullets that actually define a criterion stay where they were written, and a row is ticked against those, not against the line here:

| Iteration | Epics | Criteria | The file that defines them |
| --- | --- | --- | --- |
| 1 | 1, 2 | 19 | [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md) |
| 2 | 3, 4 | 23 | [ITERATION-2-ACCEPTANCE.md](./ITERATION-2-ACCEPTANCE.md) |
| 3 | 5, 6 | 25 | [ITERATION-3-ACCEPTANCE.md](./ITERATION-3-ACCEPTANCE.md) |

There is also a longer paired sheet for Iteration 1 that walks the sub criteria letter by letter, [WALKTHROUGH-CHECKLIST.md](./WALKTHROUGH-CHECKLIST.md). This file is the short version that covers all three iterations.

---

## Before you start

**Check the build is not older than the repository.** Cloud Run holds whatever was last deployed, and fixes land on a branch well before they are pushed to it. Running this against a stale build marks defects that are already repaired.

```bash
curl -s https://drainlens-205559161217.australia-southeast1.run.app | grep -o 'index-[A-Za-z0-9_-]*\.js'
```

Compare that with the name in `apps/web/dist/index.html` after `npm run build`. If they differ, run the dev server instead:

```bash
npm run dev --workspace @drainlens/web
```

**Addresses to use.** The site offers three, and they are the ones the data checks hold:

| Address | Why it is in the list |
| --- | --- |
| 46 Gatehouse Drive, Kensington | The example everywhere. One place to check, a teaching pit 24 m away with 22 pipes below it |
| 11 Neale Street, Kensington | A second supported address, for the "change the address" criteria |
| 2 Balmer Street, Kensington | A third, for the same |

**Addresses that should fail, and should fail differently.** `1 Collins Street, Melbourne` is a real address outside the bundled square. `qqqq` matches nothing at all. The two are different cases and the site is required to tell them apart.

**Result codes.** `OK`, `?` for something to discuss, `X` for a defect. Write every `X` in [the defect log](#defect-log) with its number.

**Write it down while doing it.** A sheet filled in afterwards from memory is worth less than a blank one, and a blank one is honest.

---

## 1. The table

### Iteration 1, Epic 1: understand local drainage

| AC | What to look for | Where | Result |
| --- | --- | --- | --- |
| 1.1.1 | With no address chosen, the home page says what the site offers and what it is not | Home page, first visit | `[ ]` |
| 1.1.2 | A drainage, water paths, ground or low areas card opens the local map on that subject | Home page cards, or Tutorial | `[ ]` |
| 1.1.3 | A recognised address inside the pilot area is accepted and the map goes to it | Full map, address box | `[ ]` |
| 1.1.4 | Switching subject redraws the map without losing the address or the view | Full map, the layer buttons along the top | `[ ]` |
| 1.1.5 | Drain pits and Drain pipes turn on and off independently | Full map, the two buttons and the Layers panel | `[ ]` |
| 1.1.6 | The map legend folds away and comes back | Full map, `‹ Hide` on the legend | `[ ]` |
| 1.1.7 | Pressing a pit or a pipe opens a card describing that element | Full map, press a drain or a pipe | `[ ]` |
| 1.1.8 | An address outside the pilot area is refused, and says so in plain words | Full map, search `1 Collins Street` | `[ ]` |
| 1.1.9 | A second address replaces the first and everything about the first is cleared | Full map, search `11 Neale Street` after `46 Gatehouse Drive` | `[ ]` |
| 1.1.10 | Back returns to where the map was opened from | Full map, `← Back` | `[ ]` |
| 1.2.1 | The selected pit is highlighted and named | Full map, Drain pits on, press one | `[ ]` |
| 1.2.2 | The recorded downstream pipes are drawn, and the path stops where the record stops | Pit card, `Show connected drain pipe` | `[ ]` |
| 1.3.1 | Ground height draws, with a scale that says what the colours mean | Full map, Layers, Ground height | `[ ]` |
| 1.3.2 | Low areas draws, labelled as estimated rather than recorded | Full map, Low areas | `[ ]` |

### Iteration 1, Epic 2: historical flood information

| AC | What to look for | Where | Result |
| --- | --- | --- | --- |
| 2.1.1 | The ranked list of areas opens, with the years and the source named | Flood history | `[ ]` |
| 2.1.2 | Back returns to the home page | Flood history, `← Back to the homepage` | `[ ]` |
| 2.2.1 | More than the top five are listed, and the count says how many of how many | Flood history, `Show more locations` | `[ ]` |
| 2.2.2 | The list goes back to five | Flood history, `Show fewer locations` | `[ ]` |
| 2.3.1 | The data is explained: what a count is, what it is not, and what it covers | Flood history, `About the data ›` and `Why "at least"? ›` | `[ ]` |

### Iteration 2, Epic 3: rainfall and blockage scenario

Reached from Tutorial, the card `What happens if a drain is blocked?`, or from a drain on the full map.

| AC | What to look for | Where | Result |
| --- | --- | --- | --- |
| 3.1.1 | A supported drain can be chosen, and an unsupported one says it is not offered | Comparison, the address step then the map | `[ ]` |
| 3.1.2 | The drain condition and the rainfall amount are both set before anything runs | Comparison, the setup step | `[ ]` |
| 3.1.3 | The comparison runs and shows clear against blocked under the same rain | Comparison, run it | `[ ]` |
| 3.1.4 | A location without enough information says so instead of producing a number | Comparison, a drain the model cannot use | `[ ]` |
| 3.2.1 | Changing the rainfall amount recalculates | Comparison result, the rainfall control | `[ ]` |
| 3.2.2 | Moving between rainfall amounts lets the results be compared | Comparison result | `[ ]` |
| 3.2.3 | The rainfall amounts are explained in plain words | Comparison, the rainfall control's explanation | `[ ]` |
| 3.3.1 | How the result was produced is explained | Comparison result, the explanation | `[ ]` |
| 3.3.2 | The limitations are stated, not buried | Comparison result, the explanation | `[ ]` |
| 3.3.3 | Where the data is incomplete or derived, that is said | Comparison result, the explanation | `[ ]` |

### Iteration 2, Epic 4: flood history and severity

| AC | What to look for | Where | Result |
| --- | --- | --- | --- |
| 4.1.1 | The two map views can be switched, and the map says which is showing | Area map, `MAP VIEW` | `[ ]` |
| 4.1.2 | Total emergency responses draws every area, darker for more | Area map, `Total emergency responses` | `[ ]` |
| 4.1.3 | Responses per 1,000 people draws where there are enough residents to divide by | Area map, `Emergency responses per 1,000 people` | `[ ]` |
| 4.1.4 | Pressing an area opens its figures | Area map, click a suburb | `[ ]` |
| 4.1.5 | An area with suppressed records says so rather than showing a smaller number as if it were whole | Area map, an area marked `At least` | `[ ]` |
| 4.1.6 | An area without enough information for a rate says so | Area map, per 1,000 view | `[ ]` |
| 4.2.1 | Recorded flood events are listed for the selected area | Area panel, the events section | `[ ]` |
| 4.2.2 | Only events a team member has checked are shown | Area panel, the events section | `[ ]` |
| 4.2.3 | An area with no checked event says so and does not read as "no floods" | Area panel, an area with none | `[ ]` |
| 4.3.1 | What the activity view is based on is explained | `About the data ›` | `[ ]` |
| 4.3.2 | What the rate view is based on is explained | `About the data ›` | `[ ]` |
| 4.3.3 | The coverage and the uncertainty are stated | `About the data ›` | `[ ]` |
| 4.3.4 | Recorded, calculated and checked information are told apart on screen | Area panel labels | `[ ]` |

### Iteration 3, Epic 5: before-rain checks and the plan

| AC | What to look for | Where | Result |
| --- | --- | --- | --- |
| 5.1.1 | At most three numbered markers within 200 m, each replacing the plain marker rather than sitting beside it, and the count on the card agreeing with the map | Full map or guide, `Before-rain checks` | `[ ]` |
| 5.1.2 | `Place n · Check before heavy rain`, the action before its explanation, both answers changeable, `Why this place?`, `Show on map` | Press a numbered marker | `[ ]` |
| 5.1.3 | An address with no places says none were marked, says that this does not mean it cannot flood, and still offers the general actions | An address with no marker inside 200 m | `[ ]` |
| 5.2.1 | The plan opens from a supported address, keeps the map position, and needs no account | Address card, `Check before heavy rain` | `[ ]` |
| 5.2.2 | A reminder exists only for `Applies to me`, worded `move your car or bins from Place n`, with no probability, depth or evacuation route | The plan, Step 1 | `[ ]` |
| 5.2.3 | `Places near you` and `For every home` are separate, reporting is its own pathway, emergency information is kept apart, no readiness score | The plan | `[ ]` |
| 5.2.4 | Missing information is named rather than guessed at | The plan, at an address with gaps | `[ ]` |
| 5.3.1 | A `Because` line naming the low area and water paths, the source, and one line saying the place is the street and not the reader's property | `Why this place?` | `[ ]` |
| 5.3.2 | No `Who can help: You` against a nearby place, and no organisation named before a problem type is chosen | The plan, and the report pathway | `[ ]` |
| 5.3.3 | Not a live warning, monitor VicEmergency, never enter floodwater or lift a cover, VICSES 132 500, Triple Zero 000 | The plan, `Before you rely on this` | `[ ]` |
| 5.4.1 | Both answers count as reviewed, `n of m` shown, no `Done` or `Completed`, and nothing sent to a server | The plan, and the network tab | `[ ]` |
| 5.4.2 | Changing the address clears every selection and renumbers | Change the address with answers already given | `[ ]` |
| 5.4.3 | The printed page carries only `Applies to me` reminders, the general actions, the sources and the boundary, and is generated in the browser | The plan, `Print or save my plan` | `[ ]` |

### Iteration 3, Epic 6: the drainage area and reporting

| AC | What to look for | Where | Result |
| --- | --- | --- | --- |
| 6.1.1 | The subcatchment is drawn and named in plain English, with wider names under `More information` | Full map, `Spot a problem?` | `[ ]` |
| 6.1.2 | The receiving drain is described in one of the four approved wordings, and no destination is claimed beyond the record | The area card | `[ ]` |
| 6.1.3 | Area, pit count and pipe length clipped to the boundary, with the coverage limitation and no claim of ownership | The area card | `[ ]` |
| 6.1.4 | `This drainage-area record was last updated in [year]`, kept apart from the dataset edit date, and called neither a survey | The area card | `[ ]` |
| 6.1.5 | An address with no matched area says so and keeps the rest of the map | An address outside any area | `[ ]` |
| 6.2.1 | Three levels, their general roles, an official citation, and a line saying these do not confirm an owner | The area card, `Who can help` | `[ ]` |
| 6.2.2 | A pit is identified as a City of Melbourne record, with no operator inferred for it | Press a pit, read its card | `[ ]` |
| 6.2.3 | Preparation stays the reader's own, reporting is its own pathway, and the nearest pit is never called "the drain for this address" | The plan and the area card together | `[ ]` |
| 6.3.1 | Five problem types offered | `Report a problem` | `[ ]` |
| 6.3.2 | The organisation, an official channel, and what to prepare. A drain appears only if the reader selected it. DrainLens does not submit | After choosing a problem type | `[ ]` |
| 6.3.3 | A short summary can be copied or printed, generated locally, said to be the reader's copy | The report panel | `[ ]` |
| 6.3.4 | For an emergency, VICSES 132 500 and Triple Zero 000 come first | `Flood or storm emergency` | `[ ]` |

### A note on the three criteria whose words moved

AC 1.1.4 says "mode" and AC 1.1.5 says "the Layers panel". Iteration 1 shipped four modes with a Layers panel behind them; the map now puts those layers on buttons along the top with a Layers panel for the rest. The criterion is the same question, which is whether the subject can be changed without losing the address or the view, and the mapping between the old names and the ones on screen is in [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md).

---

## 2. The run

Thirty to forty minutes. The order below reaches every screen once and never goes back on itself.

### 2.1 Home page to address, the call to action

1. Open the site with no address chosen. Read the first screen: it should say what the product does and that it is not a flood warning.
2. Press `Get started`. The address screen asks for an address and says which suburbs are covered.
3. Type `qqqq`. It should say nothing matched what you typed.
4. Type `1 Collins Street`. It should say that place is not in this map, which is a different sentence from the one above. **If both cases give the same message, that is a defect.**
5. Type `46 Gat`. The list should narrow as you type. Press the down arrow, then Enter. Keyboard alone must work.
6. Use the three example addresses under `Not sure? Try one of these`. All three must resolve.

### 2.2 Every button on the full map

7. Open `Full map`. Press each of the six layer buttons along the top in turn, then press each one again to turn it off. Nothing should be left drawn with no button lit.
8. Open `Layers`. Turn `Ground height` on and off.
9. Fold the legend with `‹ Hide` and open it again.
10. Press a drain, then `Show connected drain pipe`. Press a pipe. Press empty ground: the card should close.
11. Zoom out to the whole square with `−`, then in again with `+`. **The before-rain markers must still be drawn at the smallest zoom.**
12. Drag the map. The address pin may leave the screen; the view must not snap back.

### 2.3 Places, the plan and the printed page

13. With an address set, press `Before-rain checks`. Count the numbered markers and compare with the number on the address card. They must agree.
14. Press a numbered marker. Answer `Applies to me`. Open `Why this place?`.
15. Open the plan. Check `Places near you` and `For every home` are separate sections, and that the reminder names the place by number.
16. Press `Doesn't apply to me` on the same place. The reminder must go and the count must stay honest.
17. Press `Reset my answers`. Everything goes back to not reviewed.
18. Answer again, then `Print or save my plan`. Read the printed page: only `Applies to me` reminders, the general actions, the sources, the safety boundary, no reviewed count.
19. Change the address. **Every answer must be gone and the places renumbered.**

### 2.4 The drainage area and the report

20. Press `Spot a problem?`. The boundary draws and the card names the area.
21. Open `More information` on that card. Read the dates: the record date and the dataset edit date are two different things and must not be mixed.
22. Press `Report a problem`. Count the problem types: five.
23. Under `What is the problem?`, choose `Blocked or flooded street drain`. Read who to contact and what to prepare.
24. Go back, choose `Flood or storm emergency`. VICSES 132 500 and Triple Zero 000 must be first.
25. Copy or print the summary.

### 2.5 Flood history

26. Open `Flood history`. Read the ranked list, the years and the source.
27. Switch `Ranked by` between the two. Both must relabel the numbers.
28. `Show more locations`, then `Show fewer locations`.
29. Open `Why "at least"? ›` and `About the data ›`.
30. `Open the area map →`. Switch the two map views. Click a suburb and read its panel. Find one with no checked event and read what it says.

### 2.6 The guides

31. Open `Tutorial`. Start `Get ready for heavy rain` and run all six steps.
32. At the end, press `← Previous`, then `Start next guide →`. **The next guide must open at step 1 of 6 on a clean map.**
33. Start `Spot a drainage problem?` and run its three steps.
34. Run `What happens if a drain is blocked?` end to end: choose a drain, set a condition and a rainfall amount, read the result and its explanation.

### 2.7 Every dropdown and fold

Open and close each of these. A fold that opens but will not close is a defect, and so is one that loses what was under it.

| Control | Where |
| --- | --- |
| The address combobox | Address screen, and the map's own search |
| `Layers` | Full map |
| The map legend, and its source groups | Full map |
| `Why this place?` | A place card, and the reminder in the plan |
| `How this plan works` | The plan |
| The four general actions, each with a `+` | The plan |
| `Leaves or litter on top of the grate?` | Street drains panel |
| `More information` and `Why are there different organisations?` | The drainage area card |
| `Ranked by` | Flood history |
| `Why "at least"? ›`, `About the data ›` | Flood history |
| Each street group | Street drains panel |

### 2.8 Response time

**There is no agreed threshold to judge these against.** The team's five second gate is about the test suites, not about the site, and what a page response gate would mean is still open in [DECISIONS-PENDING.md](./DECISIONS-PENDING.md). So record the numbers rather than passing or failing them.

| What | How to measure | Known figure | Yours |
| --- | --- | --- | --- |
| First paint of the home page | DevTools, Network, disable cache, reload | | ______ |
| Full map ready to use | From the press to the drains being drawn | The API caches a rebuilt artefact for ten minutes; the map and derived routes took 2.5 s and 3 s before it did | ______ |
| Address search, first result | From the fifth keystroke | | ______ |
| The assistant, warm | Ask a question twice, time the second | 11 to 15 seconds | ______ |
| The assistant, cold | First question after an idle period | **Over a minute.** `drainlens-ai` has no minimum instance and fetches a 79 MB model on a cold start. The panel says `Finding an answer in the official guides…` throughout, so nobody meets a blank screen | ______ |

The cold start is a known open item, not a new defect. `--min-instances=1` is the fix and it costs money for as long as it is set.

### 2.9 What happens when something does not answer

**The database is derived on purpose and has no backups**, and that is the designed position rather than an oversight: every row comes from `apps/web/public/data/*.json` in the repository, and the migration job rebuilds the whole thing in one execution. A backup of a derived database is a copy of something already in git. [API-DEPLOYMENT.md](../deploy/API-DEPLOYMENT.md) records the reasoning, and names the condition that would make it wrong: the day anything is written there that is not in the repository.

So recovery is tested from the browser, not from the database:

| Test | What should happen |
| --- | --- |
| Block `drainlens-api` in DevTools, Network, then reload the map | The map still draws, from the copies in the site's own container. The footer says which source answered |
| Reload the page with a plan half answered | The answers are gone. **This is AC 5.4.1 working, not a defect:** selections are kept for the session only and never reach a server |
| Reload after finishing a guide | The guide is still marked done. `drainlens.learned` holds six `0`/`1` characters in local storage and nothing else |
| Clear site data, reload | Everything resets to a first visit |
| Open DevTools, Application, Storage, with an address chosen | **No address anywhere**: not in local storage, not in session storage, not in the URL, not in history state, not in any request |

That last row is the one to be strictest about. It is a criterion in all three iterations.

---

## 3. An order for a tester

For a peer mentor with about twenty five minutes who has not seen the product. **Start at Iteration 3**, because it is what is new and it is the part that needs judgement rather than checking.

| Minutes | What they do | What they are judging |
| --- | --- | --- |
| 0 to 3 | Home page, read it, press `Get started`, enter `46 Gatehouse Drive, Kensington` | Does the first screen say what this is and what it is not? |
| 3 to 10 | `Get ready for heavy rain`, all six steps | Is each step one thing to do, and is the thing to press findable? |
| 10 to 15 | From the end of the guide, open the plan, answer both ways, print it | Does the plan read as advice or as a form to finish? Does the printed page carry the boundary? |
| 15 to 19 | `Spot a drainage problem?`, pick a problem type, read who to contact | Is it clear that DrainLens does not send the report? |
| 19 to 22 | `Full map`: the six layer buttons, a drain, its connected pipe | Is it clear which marks are records and which are estimates? |
| 22 to 25 | `Flood history`: the ranking, both `Ranked by` views, `About the data ›` | Is a count of emergency responses read as a count, and not as a flood risk? |

**Ask them for wording, not for bugs.** Defects are what the run in section 2 is for and what the team can find alone. What a mentor can see that the team cannot is the sentence that a resident will read as a promise.

Three questions worth asking at the end:

1. After using this, would you say your street will flood or will not flood? **The right answer is neither.**
2. Which part of this is a council record and which part did we work out? Point at the screen.
3. If your drain were blocked tomorrow, what would you do with this and who would you call?

---

## Defect log

| No. | AC or step | What happened | What should happen | Severity |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

**Severity:** `blocks the demonstration`, `wrong on screen`, `cosmetic`.

```
Run by        ____________________
Build         index-________.js
Date          ____________________
Started ____:____   Finished ____:____
Criteria ticked ______ of 67
```
