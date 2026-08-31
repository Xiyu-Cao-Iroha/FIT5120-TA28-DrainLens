# Paired walkthrough — 77 criteria, in the order you click them

DrainLens · TA28 · a working sheet for a paired session, **not a record of one**

Fill it in while doing it. An entry written afterwards from memory is worth less than a blank one, and a blank one is honest.

---

## How to run this

**Two people, one screen, one driving.** The person who did *not* write the code drives the mouse; the one who did answers questions and does not touch the keyboard. That is the whole method, and it is what makes the session worth eight hours rather than one person clicking quickly.

**Why this counts as cross-discipline pairing.** The KPI asks for *cross-discipline* hours, not for two programmers. Half of what is checked below is a judgement about wording and about what a resident will believe — which is the W5 owner's discipline, not a developer's — and the pipeline thresholds are a data-science judgement. Pair on the parts that are each person's own expertise. Record the hours that actually happen.

**Run it against a real browser**, not the dev server alone if a deployment exists. Start at `npm run dev --workspace @drainlens/web`.

```
Date            ____________________
Driver          ____________________   (does not write this code)
Navigator       ____________________
Started ____:____   Finished ____:____   = ______ hours
```

**Result codes:** `OK` · `?` needs discussion · `X` defect, write the number in Defects at the end.

---

## Before you start — three things already known

Do not spend the session rediscovering these.

| | |
|---|---|
| **The ground-surface ramp was changed and never seen** | The colours were widened after the layer was verified, and the preview pane went blank before it could be re-checked. **Toggling "Ground surface" must produce an obviously different map.** If the difference is subtle, that is the defect. |
| **Blocking one drain gives "No clear difference" every time** | Measured, not broken: 0 of 40 inlets differ at any capture fraction from 15% to 90%. Check that the screen *explains* this rather than just saying it. |
| **There are no recorded outlets** | Every trace ends at the edge of the record. The wording must never say a path reached an outlet. |

---

## 1 · Landing and address search

Type `46 Gatehouse Drive` — do not paste, so you see the suggestions appear.

| | What to look at | Result | Note |
|---|---|---|---|
| 1.1.1.d | No account is asked for anywhere | | |
| 1.1.1.a | The chosen address is shown on the next screen | | |
| 1.1.1.b | The task page opens | | |
| 1.1.1.c | All three tasks are offered, named as the criterion words them | | |
| 1.1.1.e | Open DevTools → Application. **`localStorage`, `sessionStorage` and cookies hold no address.** Check the URL too | | |

Now try `10 Harper Street`, then `10 Nonexistent Boulevard`.

| | What to look at | Result | Note |
|---|---|---|---|
| 1.1.4.a | A real street outside the addressed area says **outside the pilot** | | |
| 1.1.4.b | Nothing about drainage is shown for it | | |
| 1.1.4.c | You can type another address without reloading | | |

> A made-up street and a real one outside the area must **not** get the same message. If they do, that is a defect.

---

## 2 · Follow local water and drainage

| | What to look at | Result | Note |
|---|---|---|---|
| 1.1.2.a | The map opens **centred on** the address, with a marker on it | | |
| 1.1.2.b | Surface-water paths and pits are on before you touch anything | | |
| 1.1.2.c | A sentence says where water near *this* address may move, with a direction and a distance | | |
| | It says "may", never "will" | | |
| 1.1.2.d | Exactly **one** next-step instruction | | |
| 1.1.2.e | Other layers are behind a collapsed section | | |
| 1.1.2.f | Areas with too little measured ground are visibly marked | | |

**Ask the navigator:** *is the sentence true of what you can see on the map?* It names the nearest path and low area; check they are actually where it says.

---

## 3 · The full map and its layers

| | What to look at | Result | Note |
|---|---|---|---|
| 1.1.3.a | Centred on and marking the address | | |
| 1.1.3.b | Five controls: pits, pipes, ground surface, water paths, low points | | |
| 1.1.3.c | Each one turns its layer off and on **individually** | | |
| | **Ground surface off → on is obviously different** (see above) | | |
| 1.1.3.d | Every layer carries *Official recorded data* or *System-derived result* | | |
| 1.1.3.e | The "not enough ground measured" layer is available and legible | | |

---

## 4 · A drainage pit, and following it downstream

Select a pit near the address. **Pit 1145091 is a good one** — 33 pipes, 15 steps, stops in five places for three different reasons.

| | What to look at | Result | Note |
|---|---|---|---|
| 1.2.1.a | The selected pit is visibly highlighted | | |
| 1.2.1.b | Its recorded fields are shown | | |
| | A field the record does not hold says **Not recorded**, not blank | | |
| 1.2.1.c | Labelled *Official recorded data* | | |
| 1.2.1.d | A follow-downstream action is offered | | |
| 1.2.2.a | The path highlights the pit and its pipes | | |
| 1.2.2.b | Arrows show which way water runs — **check one against the map** | | |
| 1.2.2.c | The path continues until the record stops | | |
| 1.2.2.d | Every place it stops is marked and explained | | |
| 1.2.2.e | Nothing is joined up that the record does not join | | |

> **Now find a pit with no downstream pipe.** The follow button must be disabled and say why — and the reason for "no pipe recorded" differs from "the pipe's destination was never recorded".

---

## 5 · The street cross-section

Open it on the same pit, then on one the record connects nothing to.

| | What to look at | Result | Note |
|---|---|---|---|
| 1.3.1.a | Street surface, the pit, and the connected pipes | | |
| 1.3.1.b | Direction is shown; **depth is not** | | |
| 1.3.1.c | The figure itself says horizontal is recorded and vertical is illustrative | | |
| 1.3.1.d | It states that no depth is recorded **for any pit in this area** | | |
| 1.3.1.e | Nothing anywhere claims capacity, adequacy, or a blockage underground | | |
| 1.3.2.a | On an unconnected pit: it says a section cannot be drawn | | |
| 1.3.2.b | It names what is missing | | |
| 1.3.2.c | It says the gap is **in the record**, not that no pipe exists | | |

**Ask the navigator:** *could someone screenshot this and think it shows real depths?* If yes, that is a defect.

---

## 6 · Setting up a comparison

| | What to look at | Result | Note |
|---|---|---|---|
| 2.1.1.a | The setup page opens | | |
| 2.1.1.b | In order: pit → blockage → rainfall → run | | |
| 2.1.1.d | A suggested pit is **labelled as a suggestion** and needs confirming | | |
| 2.1.1.e | **No blockage is pre-selected** | | |
| 2.1.1.c | Go back and choose a pit yourself; it is carried over | | |
| 2.1.2.a | Only one pit can be changed | | |
| 2.1.2.b | Clear / Partly blocked / Fully blocked | | |
| 2.1.2.c | Rainfall in millimetres | | |
| 2.1.2.d | It says the blockage is an **assumption**, not an observation | | |
| 2.1.2.e | It says the rainfall is **user-selected**, not a forecast | | |
| 2.1.2.f | A summary shows all four before you run | | |
| 2.1.2.g | Run is enabled only when the inputs are complete | | |

---

## 7 · The result

| | What to look at | Result | Note |
|---|---|---|---|
| 2.2.1.a | Open **"How this result was produced"**. It must say the same rainfall was run twice, once with every drain clear — that is the baseline, and it is the only place the UI can show it | | |
| 2.2.1.b | The same panel must say both conditions used the **same** amount | | |
| 2.2.1.c | The **difference** is what is shown — no absolute depth anywhere | | |
| 2.2.1.d | The selected pit **and its downstream path** stay visible on the map | | |
| 2.2.1.e | The band is *No clear change* or *Higher than baseline* | | |
| 2.2.1.f | Where the data cannot support a comparison, *Insufficient information* appears instead of a band — tested properly in section 8 | | |
| 2.2.1.g | It is described as indicative, not a flood prediction | | |
| | **Open "Why this is usually the answer here"** — does it explain, or excuse? | | |
| 2.2.2.a | Rainfall shown in millimetres | | |
| 2.2.2.c | Change it: the pit and blockage do **not** change | | |
| 2.2.2.b | Both conditions move to the same amount | | |
| 2.2.2.d | It says this is accumulation, **not when water arrives** | | |
| 2.3.1.a | The summary names pit, blockage and rainfall | | |
| 2.3.1.b | The finding is stated in plain English — read it aloud. If the navigator has to re-read it, that is the defect | | |
| 2.3.1.c | Recorded / derived / your assumption are **visually separated** | | |
| 2.3.1.d | "How this result was produced" opens and reads plainly | | |
| 2.3.1.e | "What is missing or uncertain" names four things, with numbers | | |
| 2.3.1.f | It states no arrival time is estimated | | |
| 2.2.4.a | Change scenario returns to setup | | |
| 2.2.4.b | Your inputs are still there | | |

---

## 8 · When it cannot answer

Reach an insufficient state — a pit the scene cannot place will do.

| | What to look at | Result | Note |
|---|---|---|---|
| 2.2.3.a | *Insufficient information* instead of a result | | |
| 2.2.3.b | The reason is named, and it is the **right** reason | | |
| 2.2.3.c | No partial or placeholder comparison beside it | | |
| 2.2.3.d | A way to change an input and retry | | |
| 2.3.2.a | It explains **why** it is unclear | | |
| 2.3.2.b | It names the missing information | | |
| 2.3.2.c | No strong result category is assigned | | |
| 2.3.2.d | It is not presented as evidence about real flood accuracy | | |

> **The distinction to test out loud:** *No clear change* means the calculation ran and found nothing. *Insufficient information* means it could not be made. Ask the navigator to say which one they are looking at without being told.

---

## 9 · The frame, on every screen

| | What to look at | Result | Note |
|---|---|---|---|
| — | The *Indicative local information* banner never scrolls away | | |
| — | The data credit is in the footer, with a working licence link | | |
| — | It says the derived layers are **calculated, not published by the council** | | |
| 1.1.5.a | "Choose a task" returns to the task page | | |
| 1.1.5.b | The address survives it | | |
| — | Browser **back** never lands on a screen with lost state | | |

---

## Defects found

| # | Where | What happened | What should happen | Raised as |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |

---

## What this session covered

Tick only what actually happened.

- [ ] **Structured desk check** — this sheet, worked end to end *(gate: ≥2 desk checks)*
- [ ] **Manual click-through in a real browser** *(gate: before the demo)*
- [ ] **Cross-discipline pairing** — hours: ______, and who with: ______________
- [ ] **Explain-it-back** — the navigator opened a source file and the author explained it. File: ______________

> The last one is the closest thing to a rehearsal for Tuesday. `engine.ts`, `ground.py` and `viewport.ts` are the three most likely to be opened.

**If the eight hours were not reached, write the real number and why.** A short figure with a reason survives a question; a round one that nobody can describe does not.

Hours this session: ______   ·   Running total: ______ / 8
