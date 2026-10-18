# Datasets

DrainLens · TA28 · written **14 September 2026**

Every dataset DrainLens reads, who publishes it, the licence it is used under, and where it ends up. **Everything on the site is either one of these, or calculated from them by the pipeline** — nothing is typed in, and the site credits each source in its footer, under *Data sources · Licensing · Not a flood warning*.

Detailed verification of three of them is in their own files: [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md) (SES incidents and ASGS names), [POPULATION-DATA.md](./POPULATION-DATA.md) (ABS population) and [DEMO-EXTENT.md](./DEMO-EXTENT.md) (the point cloud, measured for the pilot extent).

---

## At a glance

| # | Dataset | Publisher | Licence | Identifier | Used for |
|---:|---|---|---|---|---|
| 1 | Stormwater pits | City of Melbourne Open Data Portal | CC BY 4.0 | `stormwater-pits` | Drainage map, trace, scenario inlets |
| 2 | Drainpipes | City of Melbourne Open Data Portal | CC BY 4.0 | `drainpipes` | Drainage map, trace |
| 3 | Road corridors | City of Melbourne Open Data Portal | CC BY 4.0 | `road-corridors` | Map base layer |
| 4 | Street names | City of Melbourne Open Data Portal | CC BY 4.0 | `street-names` | Map labels, address search |
| 5 | Street addresses | City of Melbourne Open Data Portal | CC BY 4.0 | `street-addresses` | Address search (City of Melbourne) |
| 6 | 2020 Building Footprints | City of Melbourne Open Data Portal | CC BY 4.0 | `2020-building-footprints` | Terrain: roofs as barriers to water |
| 7 | City of Melbourne 3D Point Cloud 2018 | City of Melbourne Open Data Portal | CC BY 4.0 | `CoM_Point_Cloud_2018_LAS.zip` | Ground height, contours and spot heights, water paths, low areas, address insight, scenario |
| 8 | VICSES Incidents Per SA1 ABS Census Areas, 2009 – 2015 | Victoria State Emergency Service (via data.vic) | CC BY 4.0 | `victoria-ses-incidents-per-sa1-abs-census-areas-2009-2015` | Flood history board, flood map counts |
| 9 | ASGS 2011, Volume 1 — SA1 and SA2 | Australian Bureau of Statistics | CC BY 2.5 AU | 1270.0.55.001 | Area names, SA2 boundaries on the flood map, suburb-name positions on the Full map |
| 10 | Population Estimates by SA2, 2005 to 2015 | Australian Bureau of Statistics | CC BY 2.5 AU | 3218.0 | Denominator of *Emergency responses per 1,000 people* |
| 11 | Catchments — Waterways and Drains Subcatchments | Melbourne Water Corporation (via data.vic) | CC BY 4.0 | `catchments-waterways-and-drains-subcatchments` | The drainage area an address is in, and what receives its water |

Licence deeds: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · [CC BY 2.5 AU](https://creativecommons.org/licenses/by/2.5/au/). The footer links each credit to its own licence (`apps/web/src/ui/attribution.ts`); the ABS is **not** CC BY 4.0.

---

## City of Melbourne Open Data Portal

All fetched from the portal's export API, `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/<id>/exports/…`, and projected by the pipeline to MGA zone 55 (EPSG:28355). Every artefact built from them stores coordinates in metres from its own extent's south-west corner, so the browser needs no projection.

### 1–4 · The drainage network and the streets

| Dataset | Last modified | Features, City of Melbourne | Features, Kensington pilot |
|---|---|---:|---:|
| `stormwater-pits` | 2023-02-26 | 21,113 | 895 |
| `drainpipes` | 2023-02-26 | 17,242 | 893 |
| `road-corridors` | 2021-09-30 | 4,177 | 220 |
| `street-names` | 2021-09-30 | 2,775 | 163 |

- **Pipeline:** `pipeline/src/drainlens_pipeline/network.py`, `trace.py`.
- **Artefacts:** `apps/api/data/city-of-melbourne/map.json` and `trace.json` (loaded into the database, served by the API); `apps/web/public/data/map.json` and `trace.json` (Kensington, the bundled fallback).
- **Recorded, not calculated.** Pit and pipe attributes are shown as the council records them. The trace (which pipe a pit drains to, and where that leads) is calculated from the recorded connections and says so.
- **Pit types decide what a scenario can use.** Only surface inlets — side-entry and grated pits — can be blocked in a comparison; 9,239 of the council's pits qualify.

### 5 · Street addresses

- **Pipeline:** `addresses.py`. **Artefact:** `apps/web/public/data/addresses.json`.
- 63,721 records in the dataset; the index keeps **62,397 addresses across 2,293 streets** inside the City of Melbourne extent (4,089 across 132 streets while it was the Kensington pilot, until 14 September), and only `street_no`, `str_name`, `suburb` and the point. Every other field is dropped at build time.
- **Bundled, never sent anywhere.** The search runs in the browser; no address or coordinate reaches an endpoint, `localStorage`, the URL or history.
- Not `property-boundaries`: that dataset is parcels, and was used by mistake until 31 August.

### 6 · 2020 Building Footprints

- **Pipeline:** `footprints.py`, used by `terrain.py`. Last modified 2023-02-26.
- **What it does:** footprints whose base stands on the ground become no-flow barriers in the terrain, so water runs round buildings rather than over roofs. Upper tiers that start metres up (overhangs) are not barriers.
- **It also corrects the ground filter.** The filter keeps some flat roofs as ground; the footprints remove them. Council-wide, 26,601 ground footprints corrected 2.36 million roof cells.
- Not published as its own layer.

### 7 · City of Melbourne 3D Point Cloud 2018

- **Source file:** `CoM_Point_Cloud_2018_LAS.zip`, on the portal's attachment store (`opendatasoft-s3…/attachments/`). 215 tiles of 500 m, about 4.3 GB. EPSG:28355, heights in AHD.
- **Read in place.** `archive.py` range-reads individual tiles from the ZIP rather than downloading it; `las.py` parses LAS 1.2 by hand.
- **Photogrammetric, not LiDAR.** Every point is matched between aerial photographs, quoted at about 25 cm. Ground under dense canopy was never seen and is interpolated — which is why the map hatches *Ground data gaps*, and why a comparison never reports millimetres.
- **Coverage:** 211 of the 306 tiles in the City of Melbourne extent exist in the archive. The other 95 are missing, and nothing is drawn or claimed there. No pit or pipe lies in a missing tile.
- **Pipeline:** `ground.py` (SMRF ground filter), `terrain.py`, `hydrology.py` (fill, D8 flow, depressions), `derived.py`, `scene.py`, `scene_tiles.py`, `terrain_tiles.py` (with `terrain_display.py` and `terrain_marks.py`), `address_ground.py`.
- **Artefacts, all calculated:**
  - `apps/api/data/city-of-melbourne/derived.json` — water paths, low points, coverage gaps, council-wide.
  - `apps/web/public/data/derived.json` — Kensington. `scene/` beside it is Kensington's scene pack, which the site no longer reads.
  - `apps/web/public/data/scene-tiles/` — 211 tiles (64 MB) the comparison stitches into a one-kilometre window around the chosen drain.
  - `apps/web/public/data/terrain-tiles/` — the *Ground height* layer for the whole council: 211 tiles of pre-coloured ground, hillshade, contours and spot heights, and a 4 m overview (17.1 MB).
  - `apps/web/public/data/terrain/address-ground.json` — which way the ground falls around each of the 62,397 addresses in the index.

---

## Victoria State Emergency Service

### 8 · VICSES Incidents Per SA1 ABS Census Areas, 2009 – 2015

- **Catalogue:** data.vic, `victoria-ses-incidents-per-sa1-abs-census-areas-2009-2015`. **The catalogue's download link is dead**; the live ZIP (workbook and Data Quality Statement) is at `https://www.ses.vic.gov.au/documents/d/www/incidents-per-sa1-abs-census-areas?download=true`.
- **What it counts:** SES crew dispatches by ABS 2011 SA1 — shown on the site as *emergency responses* — per financial year 2009-10 to 2014-15 (1 July 2009 – 30 June 2015). **Only the `Flood` incident type is used.** A dispatch is not a flood event, not a measure of severity, and flash flooding is mostly recorded under storms.
- **Withheld counts:** 144 of 13,339 SA1 regions were suppressed for privacy. Suppressed is kept as unknown, never zero, so 80 of the 281 Greater Melbourne SA2 totals are minimums, shown with `+`.
- **Pipeline:** `flood_history.py`. **Artefacts:** `flood-history.json` (the board's top 30) and `sa2-areas.json` (all 281 areas, 9,906 dispatches).
- Verified against its own Data Quality Statement in [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md).

---

## Australian Bureau of Statistics

### 9 · Australian Statistical Geography Standard (ASGS) 2011, Volume 1

Two files from 1270.0.55.001, both the **2011 edition**, which is the edition the SES counts and the population estimates use.

| File | Used for | Pipeline | Artefact |
|---|---|---|---|
| `SA1_2011_AUST.csv` | Rolling SA1 counts up to SA2, with names, scoped to Greater Melbourne | `flood_history.py` | `sa2-areas.json`, `flood-history.json` |
| `SA2_2011_AUST.mid` / `.mif` (MapInfo Interchange, 121 MB) | Each area's boundary and the point its name is written at | `area_points.py` | `sa2-points.json` |

- 2,214 SA2s nationally; **281 in Greater Melbourne**, the same 281 on every artefact (`tools/data/check-areas.mjs`).
- Boundaries are simplified to 25 m (182,991 vertices to 19,682) and drawn as the flood map. The raw files stay in the git-ignored `data/` directory and are not published.
- The same boundaries place the 14 suburb names on the Full map: each is anchored at the median position of the council's drain pits inside its SA2, or at street intersections where the 2011 SA2 does not match the suburb (`apps/web/src/map/places.ts`).

### 10 · Population Estimates by Statistical Area Level 2, 2005 to 2015

- **Catalogue:** 3218.0 Regional Population Growth, Australia, 2014-15, released 30 March 2016. File `32180ds0001_2005-15.xls`, Table 2 (Victoria).
- **Used:** estimated resident population at 30 June 2009 to 2015; **30 June 2012 is the denominator of *Emergency responses per 1,000 people*** — the Severity Score of SEVERITY-SCORE.md, renamed on screen on 14 September. Areas under 1,000 residents get no rate (7 of 281), which leaves 274 in the board's ranking per 1,000 residents.
- **Pipeline:** `population.py`. **Artefact:** `population.json`, and the `population` table.
- Verified in [POPULATION-DATA.md](./POPULATION-DATA.md); the score is defined in [SEVERITY-SCORE.md](./SEVERITY-SCORE.md).

---

## Sources that are not datasets

### Verified flood events

`apps/web/public/data/flood-events.json` is **written by the team**, not downloaded. Each event is drafted from at least two official pages, and each page is linked on the site beside it. **News reports are not used** (team decision, 16 September):

| Publisher | Pages used |
|---|---|
| Australian Institute for Disaster Resilience | Knowledge Hub event records: Melbourne storms 2010, February 2011, 2011 |
| Bureau of Meteorology | *Victoria in March 2010*; *Special Climate Statement 28* (February 2011 rainfall); *Victoria in December 2011* |
| Melbourne Water | *Maribyrnong River flood* page; its announcement of the independent review panel's final report |

The pages are cited and linked, not copied: summaries are the team's own sentences, and say only what those pages state. An event appears only after a team member fills in `checkedBy` and `checkedOn`. **On 16 September none of the four is checked**: all four were rewritten from these sources that day, so the Maribyrnong check of 14 September was cleared with them. `tools/data/check-events.mjs` holds the file to that rule in CI, refuses a source on a news outlet's site (`NEWS_HOSTS`), and ties every event to an area the map has.

### Official guidance the product quotes

Epic 5 and Epic 6 cite pages rather than datasets: what to do before heavy rain, and who to contact about a drainage problem. Every one is recorded in [GUIDANCE-CONTENT-REGISTER.md](./GUIDANCE-CONTENT-REGISTER.md) with the sentence it came from, the publisher, the page and the day it was read — Victoria State Emergency Service, City of Melbourne, Melbourne Water and the Building and Plumbing Commission, read on 2 and 3 October 2026.

They are quoted, not copied: one sentence each, shortened into the product's own words, with the original kept in the register for a reviewer to check. **Two things those pages say are deliberately left out**: their response times, which AC 6.3.2 forbids repeating, and anything about what will be done, for the same reason. The register also records the one action the design asks for that no official page was found to carry.

### Not data at all

- **The homepage photograph** (`apps/web/public/hero-street.webp`) is illustrative. Nothing is measured from it and it is not of the pilot area. Its origin and licence are not recorded in the repository — **fill this in before submission**.
- **The guide chooser's landscape** (`apps/web/public/choose-landscape.webp`) is an illustration behind the guide cards, added on 14 September. The same applies: nothing is measured from it, and its origin and licence are not recorded — **fill this in too**.
- **The typeface** is self-hosted with its licence file beside it; the site makes no request to a font or map service.

---

## What DrainLens calculates

Everything below is described as estimated by DrainLens on the site, and is not published by any of the sources above:

- the drainage trace between pits and pipes;
- the ground surface, water paths, low areas and *Ground data gaps* areas;
- the *Ground height* colours, hillshade, contours and spot heights;
- which way the ground falls around an address;
- the blockage comparison (*No clear difference* / *More water than with a clear drain*);
- *Emergency responses per 1,000 people* (the Severity Score, in the model's own documents);
- where each statistical area is drawn, its simplified boundary, and where the suburb names sit.

---

## Melbourne Water Corporation

### 11 · Catchments — Waterways and Drains Subcatchments

The drainage areas Epic 6 is built on: 3,409 subcatchments over Melbourne Water's operating region, of which **35 reach the City of Melbourne extent** and addresses fall inside **20** of them.

- **Portal:** [data.vic](https://discover.data.vic.gov.au/dataset/catchments-waterways-and-drains-subcatchments), which lists the layer's own ArcGIS feature service beside the file downloads. Portal metadata last modified 2025-02-10.
- **Fetched from the feature service, by bounding box**, in EPSG:28355 both ways: 35 features and 292 KB for the council, against 23 MB for the published GeoJSON of the whole region. **This is the only layer that needs no projection** — the service speaks the frame the pipeline already works in.
- **Fields kept:** the subcatchment number and name, the major, primary and river-basin names, the recorded area in km², and both dates — `DATE_CAPTURED` and `DATE_LAST_UPDATED`. The record's own date is what AC 6.1.4 shows; the portal's metadata date is a different thing and the criterion forbids presenting one as the other. Every one of the 35 carries a last-updated date, and all of them read 2013-11-20.
- **Pipeline:** `subcatchments.py`. **Artefact:** `subcatchments.json` (57 KB), published in the council extent's frame and shifted into whichever map the browser has, as the address index is.
- **Boundaries are published whole** — never clipped to the extent — because AC 6.1.1 asks for the complete boundary, and simplified to **5 m** for drawing. The simplification is a drawing tolerance and not a record: tested over all 62,397 addresses, deciding membership from the published rings instead of the service's geometry would put **287 addresses (0.46%)** in a different area, leave 8 in none and 43 in two. Which area an address is in is therefore decided in the pipeline, against the geometry as fetched.
