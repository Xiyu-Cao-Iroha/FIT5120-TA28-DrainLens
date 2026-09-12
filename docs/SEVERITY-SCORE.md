# The Severity Score — what it is, before it is computed

DrainLens · TA28 · defined **12 September 2026**, with no line of it written yet

AC 4.1.3 asks for a population-based Severity Score, and three of its eight sub-criteria are about what the score must not be taken for: the number of people affected, the physical severity of a flood, or a probability. [ITERATION-2-ACCEPTANCE.md](./ITERATION-2-ACCEPTANCE.md) says why those three exist — *"Dispatches per 1,000 residents over six years" is a defensible definition. "Severity" is not, on its own.*

So this file is the definition, written first, and the measurements that shaped it. The inputs are checked already: the counts in [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md), the denominator in [POPULATION-DATA.md](./POPULATION-DATA.md).

---

## The definition

> **Recorded flood-related SES dispatches per 1,000 residents, 1 July 2009 to 30 June 2015.**
>
> The numerator is every Victoria SES crew dispatch recorded as **Flood** in the area across those six financial years. The denominator is the area's estimated resident population at **30 June 2012**, the mid-point of that period.

That is the whole thing. It is a rate, it has a unit, and the unit is on screen beside it.

**The two sentences AC 4.3.2.c asks for**, which are the two above the fold rather than a separate simplification:

> This compares how often the SES was sent to an area for flooding with how many people live there, over the same six years.
> It counts crew dispatches, not floods, not damage and not people affected — so an area with more people, or an area the SES was called to more often, is not necessarily an area where flooding is worse.

### What it is called

**On screen the number is written with its unit**, and the mode keeps the name the criteria give it. `Severity Score` is a mode; `4.7 dispatches per 1,000 residents` is the value. A bare `4.7` beside the word *Severity* is a composite-index shape, and this is not a composite index — nothing is weighted, nothing is combined, and there is no hidden scale to argue about.

**It is not rescaled to 0–10.** The prototype shows `5.6` against a Lower / Moderate / Higher band, and a 0–10 index would fit that layout more neatly. It would also throw away the unit, which is the only thing making the number checkable: a reader can divide 209 by 18,055 and get 11.58 back, and cannot do anything at all with a 5.6. The bands can stay — they are a reading aid over a real quantity — but the quantity stays real underneath them.

**`basis` is `derived`.** AC 4.1.3.e, and the same distinction the drainage map already draws between *recorded by the council* and *calculated by DrainLens*. Both inputs are `sourceProvided`; the division is ours.

---

## The four decisions inside it, and why each went that way

### Per 1,000 residents

Measured across the 274 areas that get a score:

| | dispatches per 1,000, six years |
| --- | --- |
| minimum | 0.00 |
| first quartile | 1.25 |
| median | **1.91** |
| third quartile | 2.98 |
| 95th percentile | 5.71 |
| maximum | **17.18** — Riddells Creek |

Per 1,000 puts almost every area between 0 and 12 with one digit after the point, which reads. Per 10,000 multiplies everything by ten for no gain; per person gives 0.0019 and is unreadable.

**The rate is far less skewed than the count it comes from**, and that matters for the map. The raw totals run 209 down to single digits, so equal-width bins put one area dark and everything else pale — the problem [ITERATION-2-TASKS.md](./ITERATION-2-TASKS.md) names for the colour ramp. The rate's maximum is **9.0× its median**, against the count's 209 against a median in the low single figures. A ramp over the rate can have four bins that all contain areas.

### 30 June 2012

The mid-point of the reporting period, chosen in preference to either end; the reasoning and the cost — it is an ABS *revised* estimate rather than a final one — are in [POPULATION-DATA.md](./POPULATION-DATA.md).

**The per-year view uses that year's population, not this one.** AC 4.1.4.c shows the distribution across years, and the prototype shows it as activity relative to population. Dividing six different numerators by one denominator would be the numerator again with a constant applied, drawn as though it were something else. The whole 2009–2015 series is loaded for this.

### A floor stays a floor

80 of the 281 areas contain at least one SA1 region whose count the publisher withheld for privacy, so their total is a lower bound. **Dividing a lower bound by a known denominator gives a lower bound**, and the score inherits the state: Gisborne is `11.35+`, not `11.35`. AC 4.1.5 and AC 4.1.6 already require this of the count; nothing about division changes it.

This is not a rare flag. Over a quarter of the map carries it.

### Seven areas get no score at all

**A rate needs somebody to be a rate for.** Seven of the 281 areas have almost no residents, and for them a per-resident figure is not unstable so much as meaningless:

| Area | Residents, 2012 | Dispatches |
| --- | ---: | ---: |
| Essendon Airport | 0 | 0 |
| Moorabbin Airport | 0 | 0 |
| West Melbourne | 0 | **2** |
| Port Melbourne Industrial | 15 | 0, and a floor |
| Braeside | 20 | 0, and a floor |
| Flemington Racecourse | 86 | 0 |
| Melbourne Airport | 158 | 0 |

Three of them would divide by zero. The other four would not, and that is the more dangerous case: **one dispatch in Port Melbourne Industrial would score 66.7 per 1,000 — nearly four times the highest rate in Greater Melbourne — off a single crew being sent to an industrial estate.** Nothing in this data prevents that from happening in the next release of the source.

**So the score is published only where the denominator is at least 1,000 residents.** The threshold is deliberately not tuned: the data has no area at all between 158 and 2,777 residents, so any line drawn in that gap excludes exactly these seven, and the number is chosen to be explainable rather than to be optimal. What it says is *this is a rate per resident, and these are not places where people live*.

**West Melbourne is the case the interface has to get right.** It has recorded flood activity and no residents, so it shows a count, its year distribution, and *no score* with a sentence saying why — which is exactly what AC 4.1.4's phrase *"the available"* is for, and what AC 4.1.6's **Not available** state is for. Before this measurement it looked as though no area in the data would ever take that state.

---

## What normalising actually changes

The mentor review's fifth point was that a ranking of raw counts is a ranking of where people are. It is, and here is the size of it — **the count's top twelve, with where the rate puts each**:

| By count | Total | Rate | Rate rank |
| --- | ---: | ---: | ---: |
| Bacchus Marsh | 209 | 11.58 | 2 |
| Croydon | 196 | 6.34 | 8 |
| Eltham | 179 | 7.58 | 5 |
| Boronia - The Basin | 160+ | 6.18+ | 11 |
| Dandenong | 133+ | 4.71+ | **24** |
| Gisborne | 133+ | 11.35+ | **3** |
| Ferntree Gully | 125 | 4.31 | **32** |
| Mornington | 117+ | 4.98+ | 21 |
| Sunbury - South | 117 | 4.65 | 26 |
| Hampton Park - Lynbrook | 116+ | 4.68+ | 25 |
| Mount Eliza | 108 | 5.98 | 12 |
| St Kilda | 107 | 4.23 | **33** |

And the area the rate puts first — **Riddells Creek, 17.18 per 1,000 from 67 dispatches among 3,900 people** — is not in the count's top twelve at all.

**Neither ranking is the correct one.** They answer different questions: *where were crews sent most often* and *where were crews sent most often per person living there*. That is why AC 4.1.1 asks for two modes over one map rather than a single better number, and why the mode switch carries a question rather than a label — the prototype already writes them as *How much flood-related SES activity was recorded?* and *How significant was the recorded activity relative to the local population?*

**Every area with no recorded activity at all is a place almost nobody lives** — all six are the airports, the racecourse, and two industrial areas. There is no residential part of Greater Melbourne that the SES was never called to for flooding in six years. Worth saying on the page, because a pale area on a map invites the opposite reading.

---

## What this does not license

- It is **not a count of floods**. One flood may produce many dispatches or none; the Data Quality Statement says tasks may or may not have been undertaken for each dispatch.
- It is **not a measure of how bad the flooding was**, and nothing in either source records depth, damage or duration.
- It is **not a count of people affected**. The population is the denominator, not the numerator, and dividing by it is the opposite of counting them.
- It is **not a probability, a current risk or a forecast.** It is six financial years that ended on 30 June 2015.
- It is **not comparable to the drainage map's own findings.** The score is Greater Melbourne at SA2; the scenario engine is one square kilometre of measured ground. Nothing joins them and nothing should.

---

## Still open

- **The bands.** *Lower / Moderate / Higher* need thresholds, and the quartiles above are the obvious candidates. They are a reading aid over the rate and must not replace it on screen.
- **Rounding.** Two significant figures reads well at these magnitudes; whether `0.00` and `no recorded activity` are distinguishable enough is a legibility question, not an arithmetic one.
- **Nothing is computed yet.** No stage produces this, `population` is still empty, and the figures in this file were measured to write it rather than published by it.
