# Decisions the team needs to make

DrainLens · TA28 · written 29 August 2026 · **demonstration Tuesday 1 September**

Seven decisions. The first changes what the product claims and what the demonstration shows.

> **Five of the seven were taken on 29 August** and are marked **DECIDED** below, with what was done. Two are left open because they are not mine to take: **the deployment** (§4) needs cloud credentials and is an outward-facing action, and **the process evidence** (§7) I cannot see from the code. The reasoning under each decision stands whether or not the team agrees — reopen any of them.

Every number below was measured on the Kensington artefact today, not estimated.

---

## 1 · The comparison does not show a difference, and the reason is physical  — **DECIDED: A + C**

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

**Decided: A, with C as the framing.** Keep every criterion as written and keep the comparison exactly as it is — then lead the demonstration with where water collects, and present the "no clear difference" result as a *finding we measured*, not as a feature that underdelivered. The sentence to have ready:

> We built the comparison, and then we tested whether it could tell us anything. In this square kilometre it cannot, because the recorded network is redundant — and we would rather report that than tune an assumption until the screen showed something.

**What was done.** The model is unchanged and every criterion stands as written. The result screen now carries *Why this is usually the answer here* whenever the band is `no-clear-change` — three lines, in the person's terms: the drains below take the water, what gets past spreads out, and **we will not report a change finer than the ground data**. That last line is the defence against Option B, on screen rather than only in this document.

**Still needs the team:** whether the demonstration leads with where water collects (C) or with the comparison. That is a rehearsal decision, not a code one.

---

## 2 · The street cross-section — **DECIDED: built**

US 1.3 is **eight criteria and nothing is built**. It is the largest remaining gap.

The complication is that most of the work is not the drawing. **Pit depth is missing for 95.4% of the council's record**, and what survives is internally inconsistent, so for almost every location the honest screen is AC 1.3.2 — *"a reliable cross-section cannot be provided here, and this is what is missing"*.

Three ways to go:

| | What it means |
|---|---|
| **Build it** | Roughly a day. Most of the value is the unavailable state, which is genuinely defensible work — it is the criterion that says do not fill gaps with assumptions. |
| **Formally descope** | Write it into the iteration record as a deliberate cut with the 95.4% as the reason, before the demonstration rather than after. |
| **Leave it silent** | Eight unticked boxes and no explanation. **Do not choose this** — an unexplained gap reads as one nobody noticed. |

**Built.** `crosssection/section.ts` decides what may be claimed and `screens/CrossSection.tsx` draws it. The honest finding is sharper than expected: the artefact carries **no invert level for any pit**, not 95.4% of them, because the pipeline never fetched a field it could not trust. So the section splits itself — **horizontal is recorded, vertical is drawn** — and says so inside the figure. 726 of 895 pits get a drawing; 169 get the unavailable state. Both clicked through in a browser. All eight criteria met.

---

## 3 · The Python test suite breaches our own runtime gate — **DECIDED: record it honestly**

The team committed to **suites under five seconds**. Node holds at 1.4 s. Python was 88 s; it is now **55 s** after one pathological fixture was fixed.

The remaining ~45 s is `test_terrain.py`, where a dozen tests each build a real 1000 × 1000 grid. That is inherent to what they check.

| | |
|---|---|
| **Split them out** | Move the grid-building tests behind a separate script so the fast suite holds the gate. Risk: a slow suite nobody runs is worse than a slow suite everyone runs. |
| **Restate the gate** | Say the five-second rule applies to the suite CI blocks on, and record the Python figure separately. Honest, and arguably what was always meant. |
| **Accept the breach** | Leave it recorded as a breach. It is in the README now. |

**Decided: record it rather than hide it.** The README and the gates table now say Node 1.4 s (holds) and Python 55 s (breaches), with the cause named. Splitting `test_terrain.py` behind a separate script was rejected: a slow suite everybody runs is worth more than a fast one that skips the terrain, and hiding the number would be the one option that is not honest. **Reopen this if a marker reads the KPI table as a failure rather than as a disclosure.**

---

## 4 · Deployment — **DONE: deployed and verified 31 August**

**Workstream W4 is entirely unticked** and two of its items are assessed KPIs:

- p95 latency and external-fetch failure rate recorded **before and after** deployment
- external dependencies probed **from the deployment host, not a laptop**
- a log exclusion filter covering both the load balancer and Cloud Run — this one is not optional, it is what keeps the no-identity promise true in production

The product is a static site plus a worker, so hosting is not hard. But **"before and after" cannot be recorded retrospectively**: if we deploy Monday night with no before-figure, that KPI is simply gone.

**Deployed on 31 August** to Cloud Run: https://drainlens-205559161217.australia-southeast1.run.app. Every command was run by the user; nothing was executed from here.

**Cloud Storage + CDN was abandoned mid-way, for a reason worth recording.** It needs a domain for a certificate and there is none — and the app's paths are absolute from `/`, so it cannot be served from a bucket sub-path either. Firebase Hosting, the obvious alternative, was **rejected by the teacher** when the first System Architecture proposed it. Cloud Run is what survives all three constraints.

**That reversed the logging finding.** On Cloud Storage there was nothing to filter. Cloud Run writes request logs carrying `remoteIp` by default, so the exclusion became mandatory — and getting it right took two attempts, with two real client IPs stored in between and later deleted. The detail is in [deploy/README.md](../deploy/README.md) because it is the more useful half of the story.

**Two things that must happen before the first request, not after.**

*The before-measurement.* **Done on 30 August** — [DEPLOYMENT-BASELINE.md](./DEPLOYMENT-BASELINE.md), taken with `tools/perf/measure.mjs` so the "after" is the same script rather than a similar one. It also settled what deployment can and cannot affect: the whole artefact load is **41 ms at p95** and one comparison is **998 ms**, so hosting is not this product's performance story. Caveat stated in the document: it was run on a laptop against localhost, which is a floor, and W4's "from the deployment host" still stands — say where the "after" was run.

*The log exclusion filter.* **On Cloud Storage + CDN there is nothing to filter**, which is the better answer rather than a lucky one: load balancer request logging is off by default on a backend bucket and Cloud Storage access logs are opt-in, so AD1 is kept by never switching them on. [deploy/README.md](../deploy/README.md) carries commands that assert the absence rather than assume it. The filter becomes mandatory the day `apps/api` reaches Cloud Run, which logs `remoteIp` by default. The original wording assumed Cloud Run and is left here because the reasoning still applies to it: it has to be configured before traffic arrives. A filter added afterwards cannot unwrite the log lines already holding the first visitors' IP addresses, and for those people AD1 was false from the start.

*The data credit.* **Done on 29 August.** CC BY 4.0 requires the attribution to be visible to the person using the work, and it appeared nowhere on screen — the `publisher` and `licence` fields were in the artefacts and never rendered. There is now a footer on every screen, read from the artefacts so replacing a source updates the credit with it, including the clause most often skipped: **an indication that changes were made**, because the surface-water paths, low points and ground shading are calculated rather than published.

**And the plan itself needs revisiting.** W4 says Cloud Run behind a load balancer, with Cloud Storage and Cloud CDN confirming range requests for PMTiles. That was written when `apps/api` was expected and when the map was expected to be tiled. Neither exists: `apps/api` is not a directory, there is no Dockerfile, CI never builds or deploys, and tiling was dropped after the whole extent measured 1.27 MB gzipped. What there is to deploy is **14 static files, 8.5 MB on disk and 1.37 MB over the wire**.

Cloud Run remains reasonable as an *Iteration 2* target for server-side AI — but note AD10 puts the photo classification on the device, and `FORBIDDEN_WIRE_KEYS` forbids `photo`, `image` and `imageData` structurally, so `assertSendable` would throw. Moving inference server-side means changing that contract deliberately, as a new declared payload type, not by deleting a key from a list. What I can say is the constraint: **the before-measurement cannot be taken retrospectively.** Whoever deploys must record p95 and the external-fetch failure rate *first*, from the deployment host, or that KPI is gone regardless of how well the deployment goes.

---

## 5 · The address index — **DONE: the real one is in**

The shipped index holds **two real addresses** and the real street names. Nothing in it is invented and it declares itself a fixture, so it is honest — but a demonstration where only two addresses work is fragile if anyone types their own.

The real build is one command (`python -m drainlens_pipeline.addresses`) and is blocked only on the council portal's rate limit clearing.

**Built on 31 August: 4,089 addresses across 132 streets.** The 429 cleared on its own, and what it had been hiding was a defect rather than a rate limit — the builder was reading `property-boundaries`, the parcel dataset. That fetched and parsed and produced 1,619 plausible entries containing **neither demonstration address**, because a parcel is not an address: Gatehouse Drive has a 10, a 15 and a 17 and no 46. The dataset it wanted was `street-addresses`, 63,721 records, named in the task list from the start. Search now suggests while typing, which two addresses could not. **Demonstrate on any Kensington address.**

---

## 6 · A slide deck is now in the repository — **DECIDED: removed**

`docs/DrainLens-pre-deployment.pptx` (366 KB) was swept into a commit by me. It was not a deliberate choice.

**Removed from tracking, and the file is untouched on disk.** It was swept in by a `git add -A` of mine rather than chosen, so untracking restores what was there. `docs/*.pptx` is now in `.gitignore` so the next `-A` does not take it again. **Reopen if the deck was meant to be versioned** — that is a reasonable thing to want, it just should be a decision.

---

## 7 · Process evidence I cannot see from the code — **OPEN, and not mine to take**

The gates table has four rows with a dash where a status belongs, and these are assessed:

- **≥8 hours cross-discipline pair programming** — unrecorded
- **≥2 structured desk checks** — unrecorded
- **Peer programming observation document** — cannot verify from the repository
- **PGP iteration build folder** — cannot verify from the repository

**Needed:** confirmation that each exists and is current. If the hours happened but were never written down, they did not happen as far as the assessment is concerned.

---

## The short version for the meeting

**Two things still need the team:**

1. **Deployment** (§4) — who, when, and **take the before-measurement first**, because it cannot be taken afterwards.
2. **Pair-programming hours and desk checks** (§7) — confirm the records exist. If the work happened but was never written down, the assessment cannot see it.

**One thing worth a conversation rather than a decision:** whether the demonstration leads with *where water collects* or with the comparison. The comparison now explains itself when it finds nothing, so either order is defensible.

**Five are done** and are recorded above with reasoning. Reopen any of them — particularly §3 if the KPI table reads badly, and §6 if the deck was meant to be versioned.
