# Guidance content register

DrainLens · TA28 · Iteration 3 · task W4.2 · read on **3 October 2026**

Every official channel, telephone number and quotation the product shows, with its source and the date the page was read. Serves AC 5.2.3, 5.3.2, 6.2.1, 6.3.2 and the Epic 5 and Epic 6 definitions of done.

> **Approved 4 October 2026 by Xiyu Cao**, for every channel and every quotation below. The rows are what the code reads, taken from the publishers' own pages on the dates given.
>
> **One question in §4 is not settled by that approval**: whether to keep looking for a source for the design's fourth preparation action. It is a decision about what to do next, not about anything the product currently says.

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

| Shown as | Source quotation | Publisher | Page | Read |
|---|---|---|---|---|
| Clean gutters, downpipes and drains when it is safe to do so. | "Clean your gutters, downpipes and drains to ensure they are not blocked." | Victoria State Emergency Service | ses.vic.gov.au (Storm) | 2026-10-02 |
| Secure loose outdoor items, such as furniture and umbrellas. | "Check that loose items such as outdoor furniture, umbrellas and trampolines are safely secured." | Victoria State Emergency Service | ses.vic.gov.au (Storm) | 2026-10-02 |
| Park under cover or away from trees. | "Park your car under cover or away from trees." | Victoria State Emergency Service | ses.vic.gov.au (Storm) | 2026-10-02 |

### One action waiting for a source

The design (Figma, *Get ready for heavy rain*) shows a fourth action, **Move valuable items above floor level**. No official page carrying it was found on the day it was looked for. Three is within what the criterion asks for, so it is not in the product: a mock-up is not a source. If the team finds the page, add the row here and the action goes in.

---

## 3 · The safety boundary

Read by `SAFETY` in `apps/web/src/prepare/actions.ts`, shown in full wherever the plan is read and on the printed page (AC 5.3.3).

The six statements are the criterion's own, in its order. The last two are the telephone numbers above, and they are never folded away or shortened.

---

## 4 · What the team is being asked to approve

1. That each channel above is the right one for the problem it is attached to.
2. That the five problem types in `report/problems.ts` are the five the criterion names and that none of them sends a reader somewhere they should not go, particularly **Private property**, which goes to a plumber rather than to the council.
3. That the quotations are accurate and the pages are the ones a reader should be sent to.
4. Whether to keep looking for a source for *Move valuable items above floor level*, or to drop it from the design.

Re-read the pages before the demonstration: a telephone number or a form that moved is the one kind of error in this product that could waste somebody's time in an emergency.
