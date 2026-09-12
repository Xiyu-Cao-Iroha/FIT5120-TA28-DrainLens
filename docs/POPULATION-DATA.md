# Population — the denominator the Severity Score needs

DrainLens · TA28 · measured **12 September 2026**, before any of Epic 4's score was built

Epic 4 asks for a Severity Score: recorded flood-related SES activity relative to the local population. The incident counts have been checked since 3 September ([FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md)). The denominator had not been obtained at all, and [ITERATION-2-TASKS.md](./ITERATION-2-TASKS.md) names it as the single point of failure for the epic: an unmatched denominator is a finding, and inventing one is the one thing this product does not do.

**It matched.** 281 of 281 areas, by two independent joins that agree on every one. The rung of the descope ladder that gives up the Severity Score is not needed.

Every number here was measured from the file.

---

## The source

| | |
| --- | --- |
| Title | Population Estimates by Statistical Area Level 2, 2005 to 2015 |
| Publisher | Australian Bureau of Statistics |
| Catalogue | 3218.0 Regional Population Growth, Australia, 2014-15 |
| Released | 30 March 2016 |
| Licence | CC BY 2.5 AU |
| File | `32180ds0001_2005-15.xls`, 815,104 bytes |
| SHA-256 | `011bb3a4…45eddb03` |
| Table read | `Table 2` — Victoria |

The workbook's own Explanatory Notes carry the two facts the score has to state:

> This spreadsheet contains estimates of the resident population of Statistical Areas Levels 2-4 … for 30 June of each year from 2005 to 2015, according to the **2011 edition** of the Australian Statistical Geography Standard (ASGS). Estimates are final for 2005 to 2011, revised (r) for 2012 to 2014, and preliminary (p) for 2015.

The 2011 edition is the same one the incident counts were joined to for their names. That was the requirement, and it is stated by the file rather than inferred from the release year — a 2016-edition boundary set would match most areas and silently miss the rest.

---

## The match

**The list matched against is every SA2 in Greater Melbourne, not the published thirty.** Those thirty are the top of a ranking, and the map has to show the areas with none. The list is produced by `flood_history --areas` and is checked before anything is matched to it: one name per code and one code per name, asserted in both directions, because the artefact publishes names and a name is not a key.

| | |
| --- | --- |
| SA2 rows read from Table 2 (Victoria) | 433 |
| … in `GREATER MELBOURNE` | **281** |
| Our areas in scope | **281** |
| Matched by nine-digit ASGS code | **281 — 100.0%** |
| Matched by name | **281 — 100.0%** |
| Areas where the two joins disagree | **0** |
| Areas with no population row | **0** |
| Population rows with no area | **0** |
| Matched areas with no figure for the chosen year | **0** |

**Two joins rather than one, because each alone is a guess about a file.** The workbook does not carry the nine-digit `SA2_MAINCODE_2011`; it carries the code split across four indented columns — state, SA4, SA3, SA2 — so using it means reassembling `2` + SA4 + SA3 + SA2, which is a claim about the structure of an identifier. Matching by name instead avoids that and introduces a different assumption, that no two areas in Greater Melbourne share a name. Doing both and requiring them to agree on all 281 tests both claims at once. They agree.

Greater Melbourne's estimated resident population over the reporting period, summed across the matched areas:

| 30 June | Persons |
| --- | --- |
| 2009 | 4,031,787 |
| 2010 | 4,105,857 |
| 2011 | 4,169,366 |
| 2012 | 4,252,458 |
| 2013 | 4,343,568 |
| 2014 | 4,437,903 |
| 2015 | 4,529,496 |

---

## Which year is the denominator

The reporting period is 1 July 2009 to 30 June 2015. **30 June 2012 is the mid-point**, and it is the only choice inside the period that does not lean towards one end of it. The whole 2009–2015 series is loaded beside it, because the score's own by-year view is activity relative to the population of *that* year, and a single denominator repeated across six rows would be a chart of the numerator wearing a different label.

**2012 is an ABS *revised* estimate, not a final one.** Final estimates stop at 2011. That is a real cost of choosing the mid-point and it is recorded rather than smoothed over: the house rule here is that a figure is either re-measured or dated, never adjusted by hand to look current, and the same rule says an estimate keeps the publisher's own label. If the team would rather every figure be final, the alternative is 30 June **2011** — the same year as the boundaries, and the first year of the period, which systematically flatters areas that grew. Greater Melbourne gained 497,709 residents across the six years — 12.3% — so the choice is not cosmetic.

Whatever is chosen has to appear on screen. AC 4.3.2.d asks for the population basis to be stated, and "approx. 5,200 residents" without a date is a number the reader cannot check.

---

## What this changes about the completeness states

AC 4.1.6 asks for three states. The match settles how many of them this data can actually produce, and the answer is not the one the published thirty suggest. **Measured across all 281 areas, not the top of the ranking:**

| State | Cause | Areas |
| --- | --- | --- |
| **Exact** | a complete count, and a population | **197** |
| **Minimum value** | a count inside the area was withheld for privacy, so the total is a floor | **80** |
| **No recorded activity** | a complete count that is zero | **4** |
| **Not available** | no population for the area | **0** |

**Over a quarter of the map is a floor.** 80 areas of 281 contain at least one withheld SA1 region — 106 regions in scope, of the 144 the publisher withholds across Victoria. That is not the impression the published thirty give, where the flag is the exception. A legend that treats *Minimum value* as an edge case is describing a different dataset, and a colour ramp that paints a floor the same as an exact value is claiming precision for 28.5% of the areas that do not have it.

**Two of those 80 have a published total of zero**, which is the sharpest case in the data: every region the SES recorded for them was withheld, so the honest reading is *0 or more, unknown*, not *none*. They are counted above as floors rather than as no recorded activity, because that is what they are.

**Nothing in this data produces a *Not available* score.** Every area in scope has a denominator. The state still has to exist — a guard nobody takes is cheaper than a number with nothing behind it — but the interface should not be built around a case with no instance, and the prototype's `N/A` areas cannot arise for this reason.

---

## Open

- **The Severity Score's definition** — numerator, denominator, rounding, and what it is called on screen — is still to be written, and AC 4.3.2.c requires it to be explainable in two sentences. This file supplies the denominator and nothing else. Nothing here decides what is divided by it.
- **The SA1 grain question** is settled by this: the score is computed at SA2 from the published rollups, so `flood_incident` stays empty and the comment in `db/migrations/001_init.sql` explaining why stays true.
- **`population.area_code`** takes the nine-digit code and `area_level` takes `'SA2'`. The loader for it does not exist yet.
