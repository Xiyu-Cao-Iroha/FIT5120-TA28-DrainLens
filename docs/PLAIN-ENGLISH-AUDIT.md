# Plain English audit

DrainLens · TA28 · **10 October 2026** · read-only, no product changes

Requested on the team's 10 October list, item 13, with a harness: read the
product as a first-time resident rather than as a drainage expert, say what
you think each thing does, then walk four journeys and report what misleads.

**Build audited:** `develop` at `4fb774b`, run locally. Not the deployed site,
which is seven merges behind and would have been the wrong thing to read.

---

## A limitation to state before the findings

The harness says *do not fill gaps using your knowledge of the project*. I
cannot honestly claim to have done that. I wrote or changed a large share of
the wording below, so I know what every label is supposed to mean, and a
confidence score from me is a reconstruction of ignorance rather than the
real thing.

What I can do, and what Pass 1 below actually is, is narrower and still
worth having: **read each label as written and ask whether the words alone
carry the meaning**, flagging the ones that only work if you already know the
answer. Where a phrase is only meaningful because of something I know from
the code, that is itself the finding, and several below are exactly that.

A genuinely naive pass needs somebody who has not seen this repository. That
is a twenty-minute job for a person outside the team and I would recommend it
before the showcase.

---

## Pass 1: the home page, read cold

One sentence on what I think each thing does, and how confident the words
alone make me.

| On screen | What the words say it does | 1 to 5 |
|---|---|---|
| *Explore your street. Prepare for heavy rain.* | Two things: look at my street, and get ready for rain. | 5 |
| Supporting paragraph | See drains and pipes on a map, get a before-rain plan, and gather details to report a problem. | 4 |
| *Get started →* | Opens the product. | 5 |
| *Council drain records* · *No account required* | Where the data comes from, and that I do not have to sign up. | 4 |
| *Current map scope: City of Melbourne* | The area covered. *Scope* is the word a developer would pick. | 3 |
| The small map card showing *46 Gatehouse Drive, Kensington* | Unclear. It is decoration, but it shows a real address with no label saying it is an example, so it reads as though the product already knows where I live. | 2 |
| *Recorded drainage* | Street drains and pipes. *Recorded* leads the title and does no work for a reader who has not yet met an estimated layer. | 3 |
| *Where rainwater may move* | Arrows showing downhill flow. | 4 |
| *The shape of the ground* | Which parts sit higher or lower. | 5 |
| *Low areas* | Dips where water pools. | 4 |
| *Get ready for heavy rain* | Things to check near me. | 4 |
| *Report a drainage problem* | Report something. But *copy or print the details to send yourself* could mean *for you to send* or *email them to yourself*. | 2 |
| *Open the full map →* | The whole map. | 5 |
| Flood history block | How often the SES was called out, by area, 2009 to 2015. | 4 |
| *At least (+)* in the area map legend | Cannot explain it from the legend alone. The explanation is a paragraph away, under the ranking. | 2 |
| *Same rainfall, two settings* · *Blocked (assumed)* | Cannot explain *setting* confidently. In an app, a setting is a preference I change; here it means a case in a model. | 2 |
| *Clear or blocked: would rainwater collect in different places?* | Compare a drain clear and blocked. Clear on **what** it does. | 4 |
| *Compare a nearby drain →* | Starts that comparison. | 4 |
| *This is a modelled comparison, not a check of the drain's current condition or a flood forecast.* | A useful limit, plainly put. | 4 |
| *DrainLens is not a live flood warning.* | Clear. | 5 |

**The gap Pass 1 leaves open is the one the harness asks about.** The home
page says clearly *what* the comparison does and never says *why a resident
would run it*. Nothing on the page connects it to a decision somebody could
make. That is the single largest comprehension gap on the page, and it is the
subject of the proposal at the end.

---

## Pass 2: the four journeys

All four were completed. The comparison was run twice, once with a visible
difference and once without, as the harness asks.

| Screen | Exact current wording | What a user might think it means | What the feature actually does | Priority | Suggested replacement |
|---|---|---|---|---|---|
| Comparison result, map key | **Purple marks changes large enough to report.** | The change is big enough that I should report it to the council. | Big enough to clear the model's own display threshold. It is a drawing rule, not advice. | **P1** | Purple marks the smallest change this model will draw. It is not advice to report anything. |
| Comparison, step 1 map key and step 2 heading | **Drain available to test** · **Other drains (can't be tested)** · **What drain condition do you want to test?** · **Change the test** | The product examines the real drain and tells me its condition. | It runs a model with an assumed condition. It never looks at the drain. The home page says so: *not a check of the drain's current condition*. | **P1** | Use *compare* throughout: *Drain you can compare*, *Other drains (not in the model)*, *Which condition should we compare?*, *Change my choices*. |
| Comparison, step 1 | **Drain that shows a difference · about 10 m away** | Something is wrong with this drain. | Of the drains near you, this is one where the model produces a visible result, so the comparison is worth running here. | **P1** | Comparing this drain gives a visible result · about 10 m away |
| Comparison, step 1 map key | **Other drains (can't be tested)** | They are broken, or off limits. | The model has no result for them, usually because they are outside the measured ground. | **P1** | Other drains (no result in this model) |
| Home page, guide card | **…copy or print the details to send yourself.** | The app will email the details to me. | You copy or print them, then you send them to the council yourself. | **P2** | …then copy or print the details and send them yourself. |
| Comparison result, no difference | Heading **No visible difference nearby**, summary row **No clear difference** | Two different results. | One result, named twice on one screen. | **P2** | Use *No visible difference* in both places. |
| Comparison, step 2 | **In this model, a blockage at this drain shows a difference with: Partly blocked at 40 mm or 60 mm; Fully blocked at 20 mm or 40 mm or 60 mm.** | Needs reading twice. The semicolon separates two nested lists. | Which combinations produce a visible result. | **P2** | This drain gives a visible result when it is partly blocked with 40 or 60 mm, or fully blocked with any amount. |
| Comparison, step 2 | **Clear** · *Uses the model's normal drain setting* | Circular. *Setting* is defined by the word *setting*. | The drain takes water as the model normally assumes. | **P2** | Clear · The drain takes water as usual |
| Comparison, step 2 | **Choose a total rainfall amount** | 60 mm over how long? An hour? A day? | A total, with no duration, which the model does not use. | **P2** | Keep the label, and answer the question the reader is actually asking: *A total amount, however long it takes to fall. The model does not use duration or intensity.* |
| Home page | The map card showing **46 Gatehouse Drive, Kensington** | The product knows my address already. | It is a picture of the product. | **P2** | Label it *Example* on the card. |
| Preparation plan | **STEP 1 · PLACES NEAR YOU**, **STEP 2 · FOR EVERY HOME**, **STEP 3 · STREET DRAINS NEAR YOU** | I must finish step 1 before step 2. | Three sections, in no required order. | **P2** | Drop *Step*: *Places near you*, *For every home*, *Street drains near you*. |
| Comparison, step 2 | **Takes no surface water at this pit** | What is a pit? Everything else calls it a drain. | The same thing. *Pit* is the council's asset word and appears here once. | **P3** | Takes no surface water at this drain |
| Preparation plan | **0 OF 1 REVIEWED** | A score. | How many nearby places you have given an answer about. | **P3** | The product already has to add *It is not a safety or readiness score* underneath, which is the signal the label is read as one. Say *You have answered about 0 of 1 place*. |
| Flood area map legend | **At least (+)** | Cannot be read on its own. | The SES withheld exact counts for small areas, so the figure is a floor. | **P3** | At least this many (exact count withheld) |
| Home page | **Current map scope: City of Melbourne** | *Scope* is developer vocabulary. | Which area the map covers. | **P3** | Map covers: City of Melbourne |

### Things that read well and should not be touched

Worth saying, because an audit that only lists faults invites rewriting what
already works.

- *These are settings for the comparison, not observations of the drain.
  DrainLens does not know whether the drain is blocked now or how a blockage
  formed.* Precise, and it does the hardest job on the screen.
- *This does not mean the area cannot flood, or that a blockage here would
  not matter.* On the no-difference result, which is the result most people
  will get. It is the most important sentence in the product.
- *Never enter floodwater, lift drain covers or interfere with public
  drainage.*
- *A change need not grow steadily with rainfall: it can appear at one amount
  and not at the next, as low areas fill and overflow.* Only *need not* is
  stiff; *may not* would do.
- The report flow's *What to send them*, now that it shows answers rather
  than asking for them.

### One journey break that is not wording

The plan's last row, *Have a question about getting ready? Ask ›*, opens a
panel that answers **503, the chat service is not configured**, because the
retrieval service has not been deployed. A first-time resident meets a
control that cannot answer. Recorded in `DECISIONS-PENDING.md` §10 and not a
copy problem, but it is in the journey the harness asks about, so it belongs
in this report.

---

## The five most important changes

1. **Stop the product saying it tests drains.** *Available to test*, *can't
   be tested*, *what drain condition do you want to test*, *change the test*.
   Four labels in one flow say the product examines a real drain, and the
   home page says in as many words that it does not. Use *compare*
   throughout. This is the one finding that makes the product claim something
   untrue about the physical world.
2. **Fix *large enough to report*.** It is one word away from telling a
   resident to ring the council because a threshold in a model was crossed.
3. **Rename *Drain that shows a difference*.** It is the first thing a
   resident reads in the comparison and it sounds like a fault report.
4. **Say why the comparison is worth running**, on the home page. See below.
5. **Say what the comparison cannot establish at the moment the result
   appears**, not only before it. The limits are on the home page and on the
   result; the sentence a reader needs at the result is the one about the
   drain's real condition, and that one is only before.

---

## Proposed home page block for the drain comparison

The team wrote the current block on the 10 October list and it shipped in
#225. It is a clear improvement on what it replaced, and it still answers
*what* rather than *why*. This keeps its structure and its limits, and adds
the reason.

> **Section label**
> CLEAR VS BLOCKED
>
> **Heading**
> If a drain near you were blocked, would rainwater collect somewhere new?
>
> **Description**
> Pick a street drain near your address and compare the same rainfall with
> it clear and with it blocked. Most comparisons show no visible difference,
> which is worth knowing too: it means the water near you has somewhere else
> to go.
>
> **Button**
> Compare a nearby drain →
>
> **Small note**
> This is a modelled comparison. It does not check the drain's condition now
> and it does not forecast flooding.

**Why the heading changed.** *Clear or blocked: would rainwater collect in
different places?* is a question about the model. *If a drain near you were
blocked* is a question about the reader's street, which is the question they
have.

**Why the description says most comparisons show nothing.** It is true, it is
measured (`DECISIONS-PENDING.md` §1: zero of forty inlets at any capture
fraction, and 36 of 8,978 drains council-wide), and it is the result most
readers will get. A page that implies a dramatic answer and then does not
give one teaches people the product is broken. Saying it up front turns the
common result into information instead of an anticlimax.

**What was kept deliberately.** The small note keeps both limits in the
team's own wording. *Compare a nearby drain* is unchanged.

---

## What this report does not cover

- **Mobile.** Item 3 on the same list, not yet started. Every screen above
  was read at desktop width.
- **A genuinely naive reading.** See the limitation at the top.
- **The guides.** The harness names four journeys and none of them is a
  guide. Epic 6's guide was rebuilt against Figma on 10 October (#226); the
  other three still open their feedback with *Great!*, which is a house
  convention of mine that appears on no Figma frame, and is worth a decision
  rather than a rewrite.
