# Guidance content register

DrainLens · TA28 · Iteration 3 · task W4.2 · read on **3 October 2026**

Every official channel, telephone number and quotation the product shows, with its source and the date the page was read. Serves AC 5.2.3, 5.3.2, 6.2.1, 6.3.2 and the Epic 5 and Epic 6 definitions of done.

> **Approved 4 October 2026 by Xiyu Cao**, for every channel and every quotation below. The rows are what the code reads, taken from the publishers' own pages on the dates given.
>
> **§4 was withdrawn the day it was written** and nothing in it reached the product, so the approval above still covers everything the product says.
>
> **One question in §5 is not settled by that approval**: whether to keep looking for a source for the design's fourth preparation action. It is a decision about what to do next, not about anything the product currently says.

---

## 1 · Reporting channels

Read by `apps/web/src/report/channels.ts`. Each row carries the sentence it came from, so a reviewer can check the wording against the page rather than against somebody's memory of it.

| Organisation | What the reader does | Source quotation | Page | Read |
|---|---|---|---|---|
| City of Melbourne | Report a maintenance issue online | "City of Melbourne is responsible for the management and maintenance of our stormwater system. These include the kerb and channels (gutters), open channels, underground drains, pits located in public roads and our drains in drainage easements." | melbourne.vic.gov.au/stormwater | 2026-10-03 |
| City of Melbourne | Call straight away if there is danger to the public, on **03 9658 9658** | "If there is any danger to the public or public space, call us straight away on 03 9658 9658." | melbourne.vic.gov.au/street-cleaning-and-maintenance | 2026-10-03 |
| Melbourne Water | Call **131 722**, or use the online enquiry form | "To report smell, pollution or another urgent issue relating to one of our sites, please call us directly on 131 722 at any time." | melbournewater.com.au/about/contact-us | 2026-10-03 |
| A licensed plumber | Find and check a practitioner in the regulator's directory | "Make sure you engage a licensed or registered plumber when you want plumbing work carried out." | bpc.vic.gov.au (Engaging a plumber) | 2026-10-03 |
| Victoria State Emergency Service | Call for emergency flood or storm assistance, on **132 500** | "Call 132 500 for emergency assistance from VICSES." | ses.vic.gov.au (Flood) | 2026-10-03 |
| Emergency services | Call in a life-threatening emergency, on **000** | "Call Triple Zero (000) in life-threatening emergencies" | ses.vic.gov.au (Flood) | 2026-10-03 |

### Two things deliberately left out

**Response times.** Three of these pages publish one. AC 6.3.2 forbids stating a response time, an outcome or a repair, and a test holds the whole of the reporting pathway against that: repeating another organisation's service standard is this project making a promise on their behalf.

**The regulator's old name.** The Victorian Building Authority is now the **Building and Plumbing Commission**, and its pages redirect to `bpc.vic.gov.au`. The new name is what a reader sees when they follow the link, so it is the name in the product.

---

## 2 · General preparation actions

Read by `apps/web/src/prepare/actions.ts`. AC 5.2.3 asks for three to four, each one short specific sentence, each traceable.

> **Three of these four are new on 8 October 2026 and are *not* covered by the approval at the top of this file.** The row that is unchanged is the first.

| Shown as | Source quotation | Publisher | Page | Read |
|---|---|---|---|---|
| Clean gutters, downpipes and drains when it is safe to do so. | "Clean your gutters, downpipes and drains to ensure they are not blocked." | Victoria State Emergency Service | ses.vic.gov.au (Storm) | 2026-10-02 |
| Lift valuables up high. | "Lift it: Lift your valuables up high" | Victoria State Emergency Service | ses.vic.gov.au (Flood) | 2026-10-08 |
| Pack an emergency kit with enough essentials for three days. | "Pack an emergency flood kit with at least three days' worth of essentials, in case you lose power or need to evacuate." | Melbourne Water | melbournewater.com.au (Prepare for flooding) | 2026-10-08 |
| Monitor weather warnings and official forecasts. | "Stay informed – monitor weather warnings and forecasts at the Bureau of Meteorology website, and warnings through the VicEmergency app, website and hotline (1800 226 226)." | Victoria State Emergency Service | ses.vic.gov.au (Flood) | 2026-10-08 |

### What was removed, and why the fourth is here now

**Two approved actions were taken out on 8 October**, at the team's direction: *Secure loose outdoor items, such as furniture and umbrellas.* and *Park under cover or away from trees.* Both were accurate, both were quoted from the VICSES storm page, and both were approved on 4 October. They are storm advice. The design's set is about water reaching the house, and the team chose the design's set.

**The fourth action is no longer waiting for a source.** Until today this section recorded that the design's *Move valuable items above floor level* had no official page behind it and was therefore not in the product, because a mock-up is not a source. VICSES's flood page carries *Lift it: Lift your valuables up high*, read on 8 October, so the action is in — under the publisher's own words rather than the mock-up's.

**Each action now carries a photograph**, which is a separate kind of claim and has its own record: `IMAGE-CREDITS.md`. None of them is evidence about the reader's house; the sentence is the thing with a source.

---

## 3 · The safety boundary

Read by `SAFETY` in `apps/web/src/prepare/actions.ts`, shown in full wherever the plan is read and on the printed page (AC 5.3.3).

The six statements are the criterion's own, in its order. The last two are the telephone numbers above, and they are never folded away or shortened.

---

## 4 · Ask about getting ready — **withdrawn 8 October 2026, nothing in the product**

This section carried ten answers, written from official pages on 8 October and read by `apps/web/src/ask/answers.ts`. **They are gone, and so is the panel.** The assistant is being built separately against the retrieval prototype in `assistant/`, and two answers to the same question — one of them a register nobody had approved — is one too many.

What is left in the product is a row at the foot of the plan reading *Have a question about getting ready?* and, where the control will go, *Coming soon*. It has the design's wording and the design's position and nothing behind it. Whoever writes the panel inherits the slot, not a register they have to agree with.

**Nothing here was approved and nothing here shipped**, so there is no approved wording to withdraw. The sentences themselves are not lost: they are in the history at `feat/ask-slot-left-for-the-chatbot`'s parent, with the page and date each was read from, if the assistant work wants a starting point.

The one thing worth carrying forward is what bounded them. `assistant/evaluation_results.csv` is thirty questions scored by hand, and it already says which are answerable from official guidance, which are not — flood depth, arrival time, whether this house will flood, repair cost, which insurer — and which are an emergency. A panel that answers the second group is the failure mode this product's whole vocabulary exists to prevent. That is a constraint on the assistant, not a decision this register can make for it.

---

## 5 · What the team is being asked to approve

1. That each channel above is the right one for the problem it is attached to.
2. That the five problem types in `report/problems.ts` are the five the criterion names and that none of them sends a reader somewhere they should not go, particularly **Private property**, which goes to a plumber rather than to the council.
3. That the quotations are accurate and the pages are the ones a reader should be sent to.
4. Whether to keep looking for a source for *Move valuable items above floor level*, or to drop it from the design.

Re-read the pages before the demonstration: a telephone number or a form that moved is the one kind of error in this product that could waste somebody's time in an emergency.
