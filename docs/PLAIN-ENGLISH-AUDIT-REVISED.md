# Plain English audit: revised wording proposals

DrainLens · TA28 · **10 October 2026** · copy review only, no product changes

This file reviews the proposed replacement wording in the original
PLAIN-ENGLISH-AUDIT.md. It keeps the original audit's observations and
structure, but revises suggestions that could misstate what the model or the
reporting flow does. The observations below are from the original auditor;
this revision is an editorial review, not another usability test.

**Build covered by the original audit:** develop at 4fb774b, run locally.
The original report says the deployed site was behind that build. This
revision has not retested either version, so the final copy must be checked
against the build used for release.

---

## A limitation to state before the findings

The original auditor disclosed that they had written or changed much of the
product copy. Their confidence scores are therefore a review of whether the
visible words stand on their own, not a genuinely naive first-user reading.
This revision does not remove that limitation.

Before the showcase, ask at least one person who has not worked on DrainLens
to say what each home-page feature does before opening it, then watch them
complete the comparison, Prepare and Report flows. Do not explain the labels
before they try.

---

## Pass 1: the home page, read cold

The table preserves the original auditor's first-pass observations. The
replacement text is in Pass 2 and the proposed home-page block below.

| On screen | What the words say it does | 1 to 5 |
|---|---|---|
| *Explore your street. Prepare for heavy rain.* | Look at my street and get ready for rain. | 5 |
| Supporting paragraph | See drains and pipes on a map, get a before-rain plan, and gather details to report a problem. | 4 |
| *Get started →* | Opens the product. | 5 |
| *Council drain records* · *No account required* | Tells me the data source and that I do not have to sign up. | 4 |
| *Current map scope: City of Melbourne* | Tells me the area covered, but *scope* is technical wording. | 3 |
| The small map card showing *46 Gatehouse Drive, Kensington* | Could look as if the product already knows my address; it is not labelled as an example. | 2 |
| *Recorded drainage* | Means street drains and pipes, but the title does not say that directly. | 3 |
| *Where rainwater may move* | Shows downhill flow with arrows. | 4 |
| *The shape of the ground* | Shows which parts sit higher or lower. | 5 |
| *Low areas* | Shows dips where water may collect. | 4 |
| *Get ready for heavy rain* | Opens things to check near me. | 4 |
| *Report a drainage problem* | Opens reporting help, but *send yourself* could mean emailing details to myself. | 2 |
| *Open the full map →* | Opens the whole map. | 5 |
| Flood history block | Shows past SES flood responses by area, 2009 to 2015. | 4 |
| *At least (+)* in the area map legend | Cannot be explained from the legend alone. | 2 |
| *Same rainfall, two settings* · *Blocked (assumed)* | *Setting* could mean an app preference instead of a modelled case. | 2 |
| *Clear or blocked: would rainwater collect in different places?* | Asks me to compare two drain conditions. | 4 |
| *Compare a nearby drain →* | Starts the comparison. | 4 |
| The small note saying it is a modelled comparison | States that it is not a live drain check or a flood forecast. | 4 |
| *DrainLens is not a live flood warning.* | Clear. | 5 |

**Main gap:** the comparison block explains the mechanism but gives the
resident little reason to open it. The revised block below makes the
purpose concrete: understand a possible local effect of a blockage before
heavy rain. It does not imply that DrainLens has found a real blockage or
that a model result tells somebody whether to report a drain.

---

## Pass 2: the four journeys

The original audit reports that all four journeys were completed and that
the comparison was run once with a visible difference and once without.
The wording decisions below rely on those reported observations. They have
not been reverified in the local build for this revision.

| Screen | Exact current wording | What a user might think it means | What the feature actually does | Priority | Suggested replacement |
|---|---|---|---|---|---|
| Comparison result, map key | **Purple marks changes large enough to report.** | The app is telling me to report this drain to the council. | Purple marks a modelled increase that passes a display threshold. It is not reporting advice. | **P1** | **Purple shows where the model estimates more water on the ground than with the drain clear.** |
| Comparison, step 1 map key and step 2 heading | **Drain available to test** · **Other drains (can't be tested)** · **What drain condition do you want to test?** · **Change the test** | The app checks a physical drain and tells me its condition. | It compares assumed drain conditions in a model. | **P1** | Use **compare** throughout: **Drain you can compare**; **Other drains (no comparison available)**; **Imagine this drain is...**; **Change my choices**. |
| Comparison, step 1 | **Drain that shows a difference · about 10 m away** | There is already something wrong with this drain. | The model can produce a visible comparison for this suggested drain under some choices. | **P1** | **Suggested drain for comparison · about 10 m away.** Explain why it is suggested in optional help, not in the main label. |
| Comparison result, below the summary | No result-level sentence states whether the selected drain is actually blocked now. | A visible model result may be mistaken for a finding about the real drain. | The app has not observed the drain's current condition. | **P1** | **This model does not show whether the drain is blocked now. It does not predict flooding.** |
| Home page, Report card | **...copy or print the details to send yourself.** | The app might email the details to me. | The resident chooses an issue, gets a contact, and copies or prints details to use when reporting it. DrainLens does not submit the report. | **P2** | **Choose the problem, find the right contact, and copy or print the details. DrainLens does not send the report for you.** |
| Comparison result, no difference | Heading **No visible difference nearby**, summary row **No clear difference** | These sound like two different results. | Both refer to the same model result for the chosen inputs. | **P2** | Use **No visible difference nearby** in both places. Keep the caveat that this does not rule out flooding or a meaningful blockage. |
| Comparison, step 2 | **In this model, a blockage at this drain shows a difference with: Partly blocked at 40 mm or 60 mm; Fully blocked at 20 mm or 40 mm or 60 mm.** | I must decode a list of conditions before I can choose. | It lists which choices may produce a visible result. | **P2** | Remove the combinations from the main step. Use: **Choose a drain condition and an amount of rain. Some choices may show no visible difference.** Put exact combinations in optional help only if needed. |
| Comparison, step 2 | **Clear** · *Uses the model's normal drain setting* | *Setting* explains nothing about what clear means here. | This is the normal clear-drain case in the model. | **P2** | **Clear · This drain works normally in this example.** |
| Comparison, step 2 | **Choose a total rainfall amount** | I may assume 20, 40 or 60 mm describes a real storm over a known period. | The comparison uses total rain but does not account for duration or intensity. | **P2** | Keep the label. Add: **The same total rain is used in both cases. The model does not account for how quickly it falls.** Do not call the amounts light, medium or heavy rain. |
| Home page, example map | **46 Gatehouse Drive, Kensington** with no example label | The site already knows my address. | It is an illustration of the product. | **P2** | Add **Example address** beside the address. |
| Home page, drainage card | **Recorded drainage** | I cannot tell what I will see without reading the smaller text. | It opens council-recorded street drains and connected pipes. | **P2** | Title: **Street drains and pipes**. Description: **Explore council-recorded street drains near you and the pipes that join them.** |
| Home page, comparison illustration | **Same rainfall, two settings** · **Blocked (assumed)** | A *setting* might be an app preference; *assumed* is unexplained. | Two modelled cases use the same amount of rain. | **P2** | **Same rain, two examples** · **Drain clear** · **Drain blocked**. Keep the model limitation nearby. |
| Preparation plan | **STEP 1 · PLACES NEAR YOU**, **STEP 2 · FOR EVERY HOME**, **STEP 3 · STREET DRAINS NEAR YOU** | I must complete them in order. | They are three sections without a required order. | **P2** | Remove **STEP** and the numbers: **Places near you**, **For every home**, **Street drains near you**. |
| Comparison, step 2 | **Takes no surface water at this pit** | *Pit* may be a different thing from the drain mentioned elsewhere. | It refers to the same selected street drain. | **P3** | **Takes no surface water at this drain.** |
| Preparation plan | **0 OF 1 REVIEWED** | It looks like a readiness score. | It counts the nearby places the user has answered about. | **P3** | **Nearby places reviewed: 0 of 1.** Keep the separate explanation that this is not a safety score. |
| Flood area map legend | **At least (+)** | The symbol has no clear meaning on its own. | A count with + is a lower bound, not an exact count. | **P3** | **+ means at least this many emergency responses.** Explain why exact counts are unavailable in the data information. |
| Home page | **Current map scope: City of Melbourne** | *Scope* is internal-sounding language. | The street map covers City of Melbourne addresses. | **P3** | **Map covers: City of Melbourne.** |

### Things that read well and should not be touched

Keep the meaning of these statements. If surrounding labels change, adjust
only enough to maintain consistent terminology.

- The explanation that comparison choices are not observations of a drain,
  and that DrainLens does not know whether it is blocked now. If *settings*
  is removed elsewhere, begin this explanation with **These are choices for
  a modelled comparison, not observations of the drain.**
- **This does not mean the area cannot flood, or that a blockage here would
  not matter.** Keep this beside a no-difference result.
- **Never enter floodwater, lift drain covers or interfere with public
  drainage.**
- Keep the explanation that a visible difference may appear at one rainfall
  amount and not the next. It belongs in optional detail, not the main
  result. **May not** reads more naturally than **need not**.
- Keep the Report flow's **What to send them** section, which shows the
  details the user can copy or print.

### One journey break that is not wording

The original audit observed that **Have a question about getting ready?
Ask ›** returned **503, the chat service is not configured**. This is not
a copy issue. Verify it in the release build; if it still fails, repair the
service or remove the entry point before the showcase.

---

## The five most important changes

1. **Use compare instead of test.** The app models an assumed blockage; it
   does not inspect a physical drain. Use the exact labels in Pass 2.
2. **Remove reporting language from the purple map key.** A model display
   threshold is not a reason to contact the council.
3. **Make the suggested drain label neutral.** Do not imply the drain is
   faulty or promise a result before the user chooses the conditions.
4. **Explain the home-page purpose.** The comparison helps a resident
   understand a possible local effect of a blockage before heavy rain. It
   does not identify a real blockage or make a reporting decision.
5. **Repeat the key limit at the result.** Whether the result shows a
   difference or not, say that the model does not know the drain's current
   condition and cannot predict flooding.

---

## Proposed home page block for the drain comparison

This replaces the original audit's proposed block. Its sentence claiming
that a no-difference result means water has somewhere else to go must not
be used. The model does not establish where that water went, and a result
with no visible difference does not rule out flooding.

> **Section label**
> CLEAR VS BLOCKED
>
> **Heading**
> Clear or blocked: would rainwater build up more or collect somewhere new?
>
> **Description**
> Compare the same rain with a nearby drain clear and blocked. See whether
> the model shows more water on the ground, a new place where it collects,
> or no visible difference. Understand one possible local effect of a
> blockage before heavy rain.
>
> **Button**
> Compare a nearby drain →
>
> **Small note**
> This is a modelled comparison. It does not show whether the drain is
> blocked now or predict flooding.

**Why this heading:** it names the two conditions and the two changes a
resident may care about: more water in the same place, or water collecting
somewhere new. A no-difference result remains a valid answer.

**Why the original no-difference explanation was removed:** the absence of
a visible change for selected model inputs does not show that water has
another route or that a street is safe. The result screen should state
what the model did and did not show, without inventing a cause.

**What was kept:** the nearby-drain button, the same-rain comparison and
the two essential limits. All main copy uses short sentences without
technical model thresholds.

---

## What this report does not cover

- **Mobile.** The original audit was read at desktop width. This revision
  does not verify text wrapping or comprehension on mobile.
- **A genuinely naive reading.** The original auditor knew the product.
  Test the final copy with somebody outside the team.
- **All guides.** The original audit did not walk every guide. It noted that
  some guide feedback still begins with *Great!*; decide whether that
  feedback is useful in a separate guide review.
- **Implementation.** This file proposes wording only. Check the final
  copy in the latest build and make sure labels, screenshots and routes
  match the behaviour.
