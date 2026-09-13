# Flood history — what the data actually supports

DrainLens · TA28 · verified **3 September 2026**, before any of Epic 2 was built

Epic 2 asks for a ranked view of recorded flood-related incident counts by area. This file is the check that such a thing can be built honestly from the one dataset that fits, done before writing a screen so that the screen does not have to be unwritten. Every number here was measured from the files, not read from a description.

---

## The sources

**Two are needed, because the first one cannot name a place.**

| | Incidents | Geography |
| --- | --- | --- |
| Title | VICSES Incidents Per SA1 ABS Census Areas, 2009 – 2015 | ASGS 2011 Volume 1, Statistical Area Level 1 |
| Publisher | Victoria State Emergency Service | Australian Bureau of Statistics |
| Licence | CC BY 4.0 | CC BY 2.5 AU |
| Catalogue | data.vic, `victoria-ses-incidents-per-sa1-abs-census-areas-2009-2015` | 1270.0.55.001 |
| File | `Dataset - VICSES Incidents Per SA1 ABS Census Areas- 2009 - 2015-xlsx.xlsx`, 2,394,366 bytes | `SA1_2011_AUST.csv`, 8,649,278 bytes |
| SHA-256 | `c2de5a2d…16b7b1db` | `3a8d138a…d292b956` |

**The catalogue's own download link is dead.** data.vic's CKAN record points at `ses.vic.gov.au/documents/236376/264375/…`, which returns a 404 HTML error page — with a `200`-looking `curl` exit and 119 KB of content, so a fetch that only checks the exit code will happily save an error page as a spreadsheet. The live file is a 1.4 MB ZIP at `ses.vic.gov.au/documents/d/www/incidents-per-sa1-abs-census-areas?download=true`, containing the workbook and its Data Quality Statement. **Any pipeline stage that fetches this must assert the content type and the row count**, not the status code.

---

## What one number means

From the Data Quality Statement, and this is the sentence AC 2.3.1.a has to carry:

> For each response a Victoria SES crew was dispatched. Tasks may or may not have been subsequently undertaken in relation to each dispatch. The figures preclude multiple crew attendances at any one incident.

A count is **one crew dispatch**. Not one flood, not one damaged property, not one call. Something may or may not have been done when the crew arrived, and a large incident that drew four crews counts once.

The DQS defines **Flood** as *"the overflowing by water of the normal confines of a stream or other body of water, or the accumulation of water by drainage over areas which are not normally submerged."* The second half is exactly what DrainLens is about.

---

## Reporting period

**Six complete financial years: 1 July 2009 to 30 June 2015.**

The DQS states that period outright, and the workbook has six year columns — `2009-10` through `2014-15` — for each of the eight incident types. The catalogue's description says "July 2009 - 8 August 2015", which is the collection window, not the coverage: the extra five weeks fall in 2015-16 and appear in no column. There is no partial year to exclude, and no basis for quoting the period as "2009–2015" without saying they are financial years.

---

## The file reconciles against its own statement

| Claim in the Data Quality Statement | Measured |
| --- | --- |
| 13,339 data units | 13,339 rows carrying a `region_id` (3 further rows are blank) |
| 144 SA1 regions suppressed | 144 rows with a suppressed Flood cell |
| Covers the entire state of Victoria | every `region_id` is 7 digits, starts with `2`, and all 13,339 are distinct |
| Cells with suppressed data marked "X" | 864 `'X'` strings in the Flood columns — 144 regions × 6 years, so suppression is all-or-nothing per region |

Statewide totals across the six years:

| Type | Incidents | Share |
| --- | --- | --- |
| Storm | 114,792 | 69.9% |
| Flood | 21,960 | 13.4% |
| Support Other Agency | 6,813 | 4.1% |
| Road Rescue | 5,756 | 3.5% |
| Rescue Other | 3,042 | 1.9% |
| Earthquake | 2 | 0.0% |
| Tsunami | 0 | 0.0% |
| **Overall** | **164,174** | 100% |

---

## The areas can be named, and the join is exact

**The Data Quality Statement says it in as many words: "SA1 regions are not named."** They are identified by a 7-digit code which, the DQS explains, is the State identifier, the SA2 identifier and the SA1 identifier. AC 2.1.1.d requires an *area name*, so a second source is not optional.

`SA1_2011_AUST.csv` carries `SA1_7DIGITCODE_2011` beside `SA2_NAME_2011`, `SA3_NAME_2011`, `SA4_NAME_2011` and `GCCSA_NAME_2011`. Joining the two:

- **13,339 of 13,339** VICSES codes match a Victorian SA1 in ASGS 2011
- **0** VICSES codes fail to match
- **0** Victorian SA1s are missing from the VICSES file

Nothing is left over on either side, which is stronger evidence of the code structure than the DQS sentence describing it. The named unit is **SA2**: 435 of them carry incidents, 281 of those in Greater Melbourne. `GCCSA_NAME_2011` also separates Greater Melbourne (9,658 SA1s) from Rest of Vic. (3,677) cleanly.

---

## Four findings that shape what the board may claim

### 1. Greater Melbourne is not in the statewide top five

| Rank | All Victoria | Flood | Greater Melbourne | Flood |
| --- | --- | --- | --- | --- |
| 1 | Mildura | 593 | Bacchus Marsh | 209 |
| 2 | Numurkah | 565 | Croydon | 196 |
| 3 | Horsham | 351 | Eltham | 179 |
| 4 | Swan Hill Region | 347 | Boronia - The Basin | 160 |
| 5 | Rochester | 315 | Gisborne | 133 |

Greater Melbourne holds 9,906 of the 21,960 flood incidents (45.1%), but **not one of its areas reaches the statewide top five** — those are all regional river towns. A product for Greater Melbourne residents that opens with Mildura and Numurkah has answered a question its reader did not ask.

### 2. One event is 42% of the total

Flood incidents in Greater Melbourne, by financial year:

| Year | Incidents | Share |
| --- | --- | --- |
| 2009-10 | 1,908 | 19.3% |
| **2010-11** | **4,144** | **41.8%** |
| 2011-12 | 2,023 | 20.4% |
| 2012-13 | 769 | 7.8% |
| 2013-14 | 501 | 5.1% |
| 2014-15 | 561 | 5.7% |

A six-year total is largely a picture of 2010-11. It changes the answer, not just the magnitude: drop that year and **two of the top five change** — Croydon and Gisborne give way to Mount Eliza and Sunbury - South. Rank on the last three years and only one name survives.

A single total is still the right number to rank on: it is what "recorded incident count" means, and choosing a window to make the ranking prettier would be choosing the answer. But the per-year figures have to be visible somewhere on the page, or the board silently presents one wet summer as a standing property of a suburb.

### 3. Flash flooding is counted as Storm, not Flood

The DQS puts *"heavy rain leading to flash flooding"* inside the **Storm** definition. So the type most relevant to urban stormwater drainage is partly in a bucket that also holds wind, hail, dust and snow — and Storm is 69.9% of all incidents.

The two rank different places. Greater Melbourne's top eight:

- **By Flood:** Bacchus Marsh, Croydon, Eltham, Boronia - The Basin, Gisborne, Dandenong, Ferntree Gully, Sunbury - South
- **By Storm:** Emerald - Cockatoo, Mount Dandenong - Olinda, Boronia - The Basin, Healesville - Yarra Glen, Ferntree Gully, Yarra Valley, Belgrave - Selby, Point Nepean

**Two names in common.** The Storm list is the Dandenongs and the Yarra Valley — tree country, where the dispatches are for fallen limbs. Ranking by Storm, or by Storm + Flood, would put a wind-damage map on a page about flooding.

### 4. Eighty Melbourne areas contain a suppressed region

144 SA1s statewide are suppressed under the Privacy and Data Protection Act 2014 — regions with 20 or fewer people or 10 or fewer dwellings, where a count could identify somebody. In Greater Melbourne that is **636 suppressed SA1-years across 80 of 281 SA2s**, and **9 of the top 30 by flood** contain at least one.

Aggregating to SA2 does not fix this; it hides it. Those nine areas' totals are **lower bounds**, and the page has to say which ones — that is AC 2.1.1.g and AC 2.2.1.f, and it is the same discipline the map already applies to unmeasured ground.

---

## The pilot area itself

Kensington, the SA2 containing the demonstration extent, recorded **39 flood incidents** across the six years, and 205 storm. Its neighbours: North Melbourne 40, Port Melbourne 41, Flemington 35, South Melbourne 62, Melbourne 65.

Small numbers, and worth saying plainly rather than dressing up. They are enough to place the pilot area on the board without implying it is a hotspot, which it is not.

---

## What this means for the criteria

| Criterion | Verdict |
| --- | --- |
| 2.1.1.b–d — five areas, ranked, with name and count | **Satisfiable** at SA2, via the ABS join |
| 2.1.1.f — reporting period, geographic unit, source | **Satisfiable**, and all three are now written down above |
| 2.1.1.g, 2.2.1.f — indicate missing information | **Required in practice**, not defensively: 80 Melbourne areas have suppressed regions |
| 2.2.1.b — no more than 30 locations | 275 Greater Melbourne areas have at least one flood incident, so the cap binds rather than the data |
| 2.2.1.d — same period and counting basis throughout | **Satisfiable**: one file, one basis, six years, no mixing |
| 2.3.1.a — meaning of a count | **One crew dispatch.** Wording is in the DQS and quoted above |
| 2.3.1.b — limitations and gaps | Findings 2, 3 and 4 are the limitations, and each is measured |
| 2.3.1.c — not severity, not damage | **Directly supported by the source**: a dispatch says nothing about either |

Nothing here blocked Epic 2. Three product decisions were taken on 3 September with these measurements in front of them, and each now lives on the artefact rather than in a screen, so the page cannot drift from what was decided:

1. **Scope: Greater Melbourne** (finding 1) — `geography.scope`
2. **Which count: Flood alone** (finding 3) — `incidentType`, with what it leaves out in `excludes`
3. **The six-year total, with every year beside it** (finding 2) — `byYear` on every area, and a chart of the six years above the ranking

The board is `apps/web/src/screens/FloodHistory.tsx`. Two things the measurements above did not anticipate turned up while building it, and both are on the page: ranks five and six are tied at 133, so the default view names the area level with its last row; and nine of the published thirty contain a withheld count, so those totals are shown as floors rather than as measurements.
