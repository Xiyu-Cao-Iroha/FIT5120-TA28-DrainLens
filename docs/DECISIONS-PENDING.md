# Decisions the team needs to make

DrainLens · TA28 · written 29 August 2026 · **demonstration Tuesday 1 September**

Seven decisions. The first one changes what the product claims and what the demonstration shows, and it is the only one that needs real discussion — the rest are ten minutes each.

Every number below was measured on the Kensington artefact today, not estimated.

---

## 1 · The comparison does not show a difference, and the reason is physical

**This is the decision. Everything else in this document is housekeeping.**

### What we found

Blocking one drain produces **no visible difference at any rainfall from 20 to 200 mm**. That was known. What was not known is *why*, and the why rules out most of the fixes.

**The capture fraction is not the cause.** The task list reserved a sensitivity test to decide "whether the interface may report three comparison bands or two". It has now been run, across 40 inlets at three rainfall amounts:

| Capture fraction | Inlets showing any difference |
|---|---|
| 15% | 0 / 40 |
| 30% | 0 / 40 |
| **60%** (current) | 0 / 40 |
| 90% | 0 / 40 |

Zero across a six-fold range. **Tuning the assumed capture fraction cannot produce a result**, so that option is closed.

### Where the water actually goes

One 60 mm storm over the square kilometre, mass balance closing exactly:

| | Volume | Share |
|---|---:|---:|
| Rain falling on the extent | 60,000 m³ | 100% |
| Captured by drains | 13,610 m³ | 22.7% |
| Ponded in hollows | 23,407 m³ | 39.0% |
| Left the window | 22,983 m³ | 38.3% |

The model works. It routes 60,000 m³ and accounts for all of it.

### Why one blocked drain vanishes into that

Two separate reasons, and both are real rather than defects:

**The median inlet has almost nothing to release.** Blocking it frees **0.036 m³** — the rain that fell on its own cell and a few upstream. The threshold for "worth telling somebody about" is 0.05 m³ in a single cell. The median inlet is below it before any arithmetic happens.

**When an inlet does release something, it spreads.** The clearest case in the sample, inlet 1144818:

> Blocking it releases **4.349 m³**, and every drop of it becomes extra ponding rather than leaving the area. That water spreads across **6,051 cells** of one large hollow — **0.0007 m³ per cell**, which is a **0.7 mm** rise. The per-cell threshold is 0.05 m³, seventy times larger.

So the water is not lost and the model is not wrong. A blocked drain raises a big hollow by a fraction of a millimetre.

### Blocking a whole street does not fix it either

This was the option I recommended before running the numbers. **It does not work.** Blocking the *k* inlets nearest one point, at 60 mm:

| Inlets blocked | Extra ponding | Deepest rise | Cells above the threshold |
|---:|---:|---:|---:|
| 1 | 0.0 m³ | 0.0 mm | 0 |
| 5 | 5.9 m³ | 2.5 mm | 0 |
| 25 | 6.4 m³ | 2.7 mm | 0 |
| 100 | 13.9 m³ | 5.6 mm | 0 |
| **475 (every inlet in the extent)** | **1,772 m³** | **374 mm** | **19,652** |

Blocking a hundred drains — far more than any believable scenario — raises water by **5.6 mm**. Only the total failure of every drain in a square kilometre produces a visible result, and that is not a scenario a resident has any use for.

**The recorded network in Kensington is redundant.** Water a blocked inlet rejects is taken by the next inlets downstream, and what escapes them spreads across hollows big enough to absorb it invisibly.

### The options, and the one I would argue against

**Option A — report two bands, and say why.** Change nothing in the model. The comparison honestly returns *No clear difference* for every realistic scenario, and we explain it with the numbers above.

- *For:* it is true; the measurement is the finding; it demonstrates that we tested our own product rather than trusting it.
- *Against:* the headline interaction ends in "nothing happens" every time. A marker asking "so what does your product do?" needs a good answer ready.

**Option B — report the rise in millimetres instead of a band.** Replace *Higher / No clear change* with "water in this hollow would sit 2.5 mm higher".

- **I would argue against this and I think it is the trap.** The ground surface is derived from aerial photography and the source is quoted at about **25 cm** accuracy — that is why the depression floor is set at 0.25 m. A computed rise of 0.7 mm is roughly **350 times finer than the data's own error bar**. Putting it on screen presents noise as a finding, and it is exactly the kind of false precision the whole provenance system exists to prevent. If somebody proposes this, that is the counter-argument.

**Option C — change the question the product asks.** Lead with what the model answers strongly: *where does water collect near me, and which drains serve that hollow.* We have 486 measured hollows holding 23,407 m³, and the four largest sit at 0.4–2.3 m AHD in the Kensington Banks flats — the known flood-prone corner. Keep the blockage comparison as a secondary feature that honestly reports no clear change.

- *For:* it is the strongest, most defensible output we have, and it is already built and on the map.
- *Against:* it is a change of emphasis three days out, and Epic 2 is written around the comparison. The acceptance criteria would need renegotiating rather than quietly reinterpreting.

**Option D — move the pilot extent** somewhere the drainage is less redundant. Not realistic in three days; the terrain build alone is a critical path.

**My recommendation: A, with C as the framing.** Keep every criterion as written and keep the comparison exactly as it is — then lead the demonstration with where water collects, and present the "no clear difference" result as a *finding we measured*, not as a feature that underdelivered. The sentence to have ready:

> We built the comparison, and then we tested whether it could tell us anything. In this square kilometre it cannot, because the recorded network is redundant — and we would rather report that than tune an assumption until the screen showed something.

**What we need from the team:** agreement on A, B, C or a combination, and if not A, who renegotiates the Epic 2 criteria before Tuesday.

---

## 2 · The street cross-section — build, descope, or leave

US 1.3 is **eight criteria and nothing is built**. It is the largest remaining gap.

The complication is that most of the work is not the drawing. **Pit depth is missing for 95.4% of the council's record**, and what survives is internally inconsistent, so for almost every location the honest screen is AC 1.3.2 — *"a reliable cross-section cannot be provided here, and this is what is missing"*.

Three ways to go:

| | What it means |
|---|---|
| **Build it** | Roughly a day. Most of the value is the unavailable state, which is genuinely defensible work — it is the criterion that says do not fill gaps with assumptions. |
| **Formally descope** | Write it into the iteration record as a deliberate cut with the 95.4% as the reason, before the demonstration rather than after. |
| **Leave it silent** | Eight unticked boxes and no explanation. **Do not choose this** — an unexplained gap reads as one nobody noticed. |

**Needed:** build or descope, and if descope, who writes it into the iteration record.

---

## 3 · The Python test suite breaches our own runtime gate

The team committed to **suites under five seconds**. Node holds at 1.4 s. Python was 88 s; it is now **55 s** after one pathological fixture was fixed.

The remaining ~45 s is `test_terrain.py`, where a dozen tests each build a real 1000 × 1000 grid. That is inherent to what they check.

| | |
|---|---|
| **Split them out** | Move the grid-building tests behind a separate script so the fast suite holds the gate. Risk: a slow suite nobody runs is worse than a slow suite everyone runs. |
| **Restate the gate** | Say the five-second rule applies to the suite CI blocks on, and record the Python figure separately. Honest, and arguably what was always meant. |
| **Accept the breach** | Leave it recorded as a breach. It is in the README now. |

**Needed:** a choice, so the KPI table says something true on Tuesday.

---

## 4 · Deployment has not started

**Workstream W4 is entirely unticked** and two of its items are assessed KPIs:

- p95 latency and external-fetch failure rate recorded **before and after** deployment
- external dependencies probed **from the deployment host, not a laptop**
- a log exclusion filter covering both the load balancer and Cloud Run — this one is not optional, it is what keeps the no-identity promise true in production

The product is a static site plus a worker, so hosting is not hard. But **"before and after" cannot be recorded retrospectively**: if we deploy Monday night with no before-figure, that KPI is simply gone.

**Needed:** who deploys, when, and who takes the before-measurement first.

---

## 5 · The address index is a fixture

The shipped index holds **two real addresses** and the real street names. Nothing in it is invented and it declares itself a fixture, so it is honest — but a demonstration where only two addresses work is fragile if anyone types their own.

The real build is one command (`python -m drainlens_pipeline.addresses`) and is blocked only on the council portal's rate limit clearing.

**Needed:** somebody to run it before Tuesday and confirm the full index loads, or a decision to demonstrate on the two known addresses and say so.

---

## 6 · A slide deck is now in the repository

`docs/DrainLens-pre-deployment.pptx` (366 KB) was swept into a commit by me. It was not a deliberate choice.

**Needed:** keep it or remove it —

```bash
git rm --cached docs/DrainLens-pre-deployment.pptx
```

---

## 7 · Process evidence I cannot see from the code

The gates table has four rows with a dash where a status belongs, and these are assessed:

- **≥8 hours cross-discipline pair programming** — unrecorded
- **≥2 structured desk checks** — unrecorded
- **Peer programming observation document** — cannot verify from the repository
- **PGP iteration build folder** — cannot verify from the repository

**Needed:** confirmation that each exists and is current. If the hours happened but were never written down, they did not happen as far as the assessment is concerned.

---

## The short version for the meeting

1. **The comparison finding** — the real discussion. Capture-fraction tuning is dead; multi-pit blocking is dead; reporting millimetres is a false-precision trap. Recommend keeping the model honest and reframing the demonstration.
2. Cross-section: build or formally descope.
3. Test runtime: split, restate, or accept.
4. Deployment: who and when, and take the before-measurement first.
5. Address index: run it or demonstrate on two addresses.
6. Slide deck: keep or remove.
7. Pair-programming and desk-check evidence: confirm it exists.
