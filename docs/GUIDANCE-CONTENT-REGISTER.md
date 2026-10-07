# Guidance content register

DrainLens · TA28 · Iteration 3 · task W4.2 · read on **3 October 2026**, with §4 read on **8 October 2026**

Every official channel, telephone number and quotation the product shows, with its source and the date the page was read. Serves AC 5.2.3, 5.3.2, 6.2.1, 6.3.2 and the Epic 5 and Epic 6 definitions of done.

> **Approved 4 October 2026 by Xiyu Cao**, for every channel and every quotation below. The rows are what the code reads, taken from the publishers' own pages on the dates given.
>
> **§4 is new and is not covered by that approval.** *Ask about getting ready* was added on 8 October 2026, after the approval above, and its ten answers are waiting for one. Until they have it the panel still ships — every answer carries the page it was written from and the test holds it there — but nobody has yet said the ten are right, and this line is how that stays visible.
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

## 4 · Ask about getting ready

Read by `apps/web/src/ask/answers.ts`. The panel answers from this register and from nothing else.

**No model runs.** The repository carries a retrieval prototype under `assistant/` — Streamlit, ChromaDB and `llama3.2` under Ollama on one person's machine — and it is not deployed, not reachable from the product, and not what the panel reads. A language model in the browser would put the project's name on sentences nobody approved, about floodwater, for readers who are not in a position to check them. Ten answers, each written from an official page and carrying the sentence it came from, are what ships.

### 4.1 What each answer may say, and where it came from

| Answer | Source quotation | Publisher | Page | Read |
|---|---|---|---|---|
| How do I clean gutters and drains safely? | "Clear debris from gutters and drains." | Melbourne Water | melbournewater.com.au (Prepare for flooding) | 2026-10-08 |
| What can I do to keep water out of my home? | "Check that you have sandbags or know where to get them." / "Block it: Block drains, toilets, and doorways" | Melbourne Water · VICSES | melbournewater.com.au · ses.vic.gov.au (Flood) | 2026-10-08 |
| What should I do with valuable things in the house? | "Lift it: Lift your valuables up high" | VICSES | ses.vic.gov.au (Flood) | 2026-10-08 |
| How should I keep documents and photographs safe? | "Store important documents and valuables in waterproof containers, or create digital backups." | Melbourne Water | melbournewater.com.au (Prepare for flooding) | 2026-10-08 |
| What should I check in my insurance? | "Check if your home insurance policy covers flood and stormwater damage, and make sure you understand any exclusions or limitations." | Melbourne Water | melbournewater.com.au (Prepare for flooding) | 2026-10-08 |
| What goes in an emergency kit? | "Pack an emergency flood kit with at least three days' worth of essentials, in case you lose power or need to evacuate." | Melbourne Water | melbournewater.com.au (Prepare for flooding) | 2026-10-08 |
| What should I do if I have to leave? | "Turn off gas and electricity at your home or workplace." | VICSES | ses.vic.gov.au (Flood) | 2026-10-08 |
| How can I protect my car? | "Never drive through floodwater – just 15cm of water can float a small car" | Melbourne Water | melbournewater.com.au (Prepare for flooding) | 2026-10-08 |
| Where do I find current warnings? | "Stay informed – monitor weather warnings and forecasts at the Bureau of Meteorology website, and warnings through the VicEmergency app, website and hotline (1800 226 226)." | VICSES | ses.vic.gov.au (Flood) | 2026-10-08 |
| How do I find out about flooding in my suburb? | "Check if your suburb has a VICSES Local Flood Guide." | Melbourne Water | melbournewater.com.au (Prepare for flooding) | 2026-10-08 |

Every quotation in the file is the full sentence as the page carries it; the table shows one per answer where an answer draws on several. `apps/web/src/ask/respond.test.ts` fails the build if an answer loses its source, its quotation or its date.

### 4.2 Why these ten, and not others

The Stage 2 evaluation (`assistant/evaluation_results.csv`) is thirty questions in three categories, scored by hand, each row naming the document and page a person checked. **An answer ships only where that evaluation found the question answerable from official guidance**, and each answer names the rows it covers. The eight *Normal* rows the evaluation marked **Fail** are not in the register: a question the team's own evaluation could not answer from the sources is not one the product should answer either.

The same evaluation decides the two states that are not answers:

- Its six **Unanswerable** rows — flood depth, arrival time, whether this house will flood, repair cost, which insurer, whether somebody's switchboard is safe — are refused **by name and before any matching**, because each is full of words the register would otherwise recognise. The test runs all six.
- Its six **Emergency** rows are answered with three telephone numbers and nothing else, **before anything is read or matched**.

### 4.3 Why the sources are pages and not the evaluation's PDFs

The evaluation checked nine PDFs, and `assistant/sources.csv` records every one of them as *no open licence identified*. The answers are written from the publishers' own web pages instead. A page this project is free to quote and a reader can open in one tap is worth more than a page number out of a document neither of them is licensed to reproduce.

---

## 5 · What the team is being asked to approve

1. That each channel above is the right one for the problem it is attached to.
2. That the five problem types in `report/problems.ts` are the five the criterion names and that none of them sends a reader somewhere they should not go, particularly **Private property**, which goes to a plumber rather than to the council.
3. That the quotations are accurate and the pages are the ones a reader should be sent to.
4. Whether to keep looking for a source for *Move valuable items above floor level*, or to drop it from the design.
5. That the ten answers in §4 say what the pages behind them say, and that answering from a register rather than from a model is the right call for a product that cannot check its own sentences.

Re-read the pages before the demonstration: a telephone number or a form that moved is the one kind of error in this product that could waste somebody's time in an emergency.
