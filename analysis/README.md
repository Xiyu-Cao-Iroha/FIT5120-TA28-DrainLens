# Data wrangling and analysis

The team's R and Python work on the source datasets: cleaning scripts, exploratory analysis, and the cleaned files they produced. Merged on 2 October 2026 from a teammate's branch (#159) and gathered here, where it had been spread across the repository root and `docs/`.

**Nothing the product runs reads this folder.** The site, the API and the pipeline fetch their data from the publishers' own APIs and build the published artefacts themselves (`pipeline/README.md`, `docs/DATASETS.md`). What is here is the evidence of how the datasets were examined and what was found in them — which is the thing an assessor asks for and the thing a pipeline cannot show.

## Running it

Open `FIT5120-TA28-DrainLens.Rproj`, which makes this folder the working directory. **Every script reads bare filenames**, so they only work when the data sits beside them — which is why this folder is flat rather than sorted into `scripts/` and `data/`. Moving a file into a subfolder breaks the script that reads it.

## What is here

| | |
|---|---|
| `*_cleaning.R`, `*_cleaning_analysis.ipynb` | Turn a published export into a cleaned file |
| `*_EDA.R` | Exploratory analysis: distributions, missing values, geometry checks |
| `*_FIT5120.R` | The earlier per-dataset scripts |
| `*_Cleaned.csv`, `*_cleaned (1).csv`, `Population_SA2_Victoria_Long.csv` | What those scripts produced |
| everything else | The published exports they read |

`superseded/` holds two earlier copies of scripts that also exist here: `DrainPipe_FIT5120_EDA.R` and `Stormwater_Pits_FIT5120_EDA.R`. The copies beside this file are the later ones — 321 lines against 209, and 256 against 241 — and each is a superset of its older twin. They are kept rather than deleted because they are a teammate's work, and they can be dropped once that teammate says so; the history holds them either way.

## Inputs these scripts expect and this folder does not have

Six filenames are read by a script here and are not in the repository. They are the publishers' exports, downloaded to run the analysis and not committed:

- `MelbourneWater_Drains_Subcatchments.csv`
- `Centreline_of_the_Waterway.xlsx`
- `Melbourne_drain_and_waterway_outlets.xlsx`
- `2020-building-footprints.csv`
- `street-addresses.csv`
- `water-flow-routes-over-land-urban-forest.csv`

A script that reads one of them will stop at that line until the file is downloaded again from the portal it came from.

## Size

73 MB, almost all of it the seven largest CSVs — the building footprints alone are 26 MB and the street addresses 18 MB. That is the cost of keeping the analysis reproducible in the repository, and it is worth knowing before adding more: a clone pays for it every time.
