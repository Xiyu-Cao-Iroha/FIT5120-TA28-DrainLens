# Subcatchment classification register

DrainLens · TA28 · proposed 2 October 2026 · **approved 4 October 2026 by Xiyu Cao, all thirty-five rows in one sitting**

What each drainage area is called on screen, and what it drains to. The Epic 6 definition of done asks for this register, approved by the team and recorded in the project governance portfolio, and says plainly that **no subcatchment is described as a Melbourne Water drain without an approved classification**.

The machine-readable copy is `pipeline/src/drainlens_pipeline/subcatchment_register.py`; this file and that one say the same thing, and `tools/data/check-subcatchments.mjs` fails the build if the published artefact disagrees with either.

---

## The two columns, and why only one of them needs you

**The name is reproduction.** `9877 COUNCIL DRAINAGE DIRECT TO BAY` becomes *Council Drainage Direct to Bay* and `ALEXANDRA PARADE M.D.` becomes *Alexandra Parade Main Drain*: the numeric prefix comes off and the abbreviations are written out, which is what AC 6.1.1 asks for. Nothing is added — the reach in brackets is kept, because *(Lower)* is how a reader tells which part of a creek they are near.

**The classification is a claim.** AC 6.1.2 allows four sentences:

| Class | What the screen says |
|---|---|
| `main-drain` | the area is associated with that receiving Melbourne Water drain |
| `waterway-section` | the area drains to that section of the waterway |
| `council-direct` | *This area is recorded as council drainage discharging directly to a receiving waterway or bay* |
| `unclassified` | the area is named, and the receiving drain type has not been confirmed |

**Until a row is approved it publishes `unclassified`**, whatever the proposal says. That is enforced in code, not by discipline: `classify()` reads the approval, not the proposal.

**All thirty-five rows were approved on 4 October 2026**, which the register allows to be done in one sitting and asks to be recorded as exactly that. The published artefact now carries 26 `main-drain`, 5 `waterway-section`, 3 `council-direct` and 1 `unclassified` — the last is 4229 Dynon Road Tidal Canal, whose *proposal* was `unclassified` and whose approval therefore confirms that it stays unnamed rather than being guessed at.

## What approving a row means

Open Melbourne Water's own description of that subcatchment, confirm the receiving drain or waterway is the kind the proposal says, and record your name and the date in the register entry's `approved` field. The proposals below come from the naming conventions of the published layer and nothing else — a name ending in `M.D.` is strong evidence and is not a confirmation.

**Three rows were flagged as where a naming convention is least safe**, and are recorded here because the approval covered them too:

- **4229 Dynon Road Tidal Canal** — proposed `unclassified`. It is a canal, the layer does not say whose, and 270 addresses are in it.
- **4401 Elizabeth Street Drain (City)** — proposed `main-drain` on the strength of *Drain* in the name. It holds **14,259 addresses**, more than any other area, so a wrong class here is the one most people would read.
- **4400 Yarra River (Mouth to Merri)** — proposed `waterway-section`. 12,907 addresses, and the only check worth making is that the area really drains to that reach rather than being named after it.

---

## The register

Ordered by how many addresses fall in each area. Twenty of the thirty-five hold an address; the other fifteen reach the extent and nobody lives in the part that does.

| Number | Published name | On screen | Proposed class | Evidence | Addresses |
|---|---|---|---|---|---|
| 4401 | ELIZABETH ST DRAIN (CITY) | Elizabeth Street Drain (City) | main-drain | named for a drain | 14,259 |
| 4400 | YARRA RIVER (MOUTH TO MERRI) | Yarra River (Mouth to Merri) | waterway-section | a named reach of the Yarra | 12,907 |
| 4310 | MOONEE PONDS CREEK (LOWER) | Moonee Ponds Creek (Lower) | waterway-section | a named reach of Moonee Ponds Creek | 8,329 |
| 4312 | ARDEN ST DRAIN | Arden Street Drain | main-drain | named for a drain | 6,916 |
| 4220 | MARIBYRNONG RIVER (LOWER) | Maribyrnong River (Lower) | waterway-section | a named reach of the Maribyrnong | 6,468 |
| 4410 | ALEXANDRA PARADE M.D. | Alexandra Parade Main Drain | main-drain | named for a main drain | 5,038 |
| 4806 | HANNA ST M.D. | Hanna Street Main Drain | main-drain | named for a main drain | 4,988 |
| 4405 | RICHMOND QUARRY M.D. | Richmond Quarry Main Drain | main-drain | named for a main drain | 1,354 |
| 4911 | COWDEROY ST M.D. | Cowderoy Street Main Drain | main-drain | named for a main drain | 506 |
| 4313 | ROYAL PARK M.D. | Royal Park Main Drain | main-drain | named for a main drain | 378 |
| 9877 | 9877 COUNCIL DRAINAGE DIRECT TO BAY | Council Drainage Direct to Bay | council-direct | the layer's own wording | 301 |
| 4229 | DYNON RD TIDAL CANAL | Dynon Road Tidal Canal | unclassified | a canal, and the layer does not say whose | 270 |
| 4404 | YARRA PARK M.D. | Yarra Park Main Drain | main-drain | named for a main drain | 267 |
| 9874 | 9874 COUNCIL DRAINAGE DIRECT TO BAY | Council Drainage Direct to Bay | council-direct | the layer's own wording | 138 |
| 4803 | GITTUS ST M.D. | Gittus Street Main Drain | main-drain | named for a main drain | 122 |
| 4223 | ASCOT VALE M.D. | Ascot Vale Main Drain | main-drain | named for a main drain | 84 |
| 4804 | JOHNSON ST M.D. | Johnson Street Main Drain | main-drain | named for a main drain | 46 |
| 4805 | FERRARS ST DRAIN | Ferrars Street Drain | main-drain | named for a drain | 23 |
| 4801 | YARRA STREET DRAIN, PRAHRAN | Yarra Street Drain, Prahran | main-drain | named for a drain | 1 |
| 4901 | ROSNY ST M.D. | Rosny Street Main Drain | main-drain | named for a main drain | 1 |
| 4202 | BURLEIGH ST DRAIN | Burleigh Street Drain | main-drain | named for a drain | 0 |
| 4210 | STONY CREEK (LOWER) | Stony Creek (Lower) | waterway-section | a named reach of Stony Creek | 0 |
| 4221 | FOOTSCRAY M.D. | Footscray Main Drain | main-drain | named for a main drain | 0 |
| 4222 | SUMMERHILL RD M.D. | Summerhill Road Main Drain | main-drain | named for a main drain | 0 |
| 4314 | BENT ST M.D. | Bent Street Main Drain | main-drain | named for a main drain | 0 |
| 4420 | MERRI CREEK (LOWER) | Merri Creek (Lower) | waterway-section | a named reach of Merri Creek | 0 |
| 4423 | GLENLYON RD DRAIN | Glenlyon Road Drain | main-drain | named for a drain | 0 |
| 4424 | SUMNER AVE M.D. | Sumner Avenue Main Drain | main-drain | named for a main drain | 0 |
| 4811 | PRAHRAN M.D. | Prahran Main Drain | main-drain | named for a main drain | 0 |
| 4812 | ESSEX ST M.D. | Essex Street Main Drain | main-drain | named for a main drain | 0 |
| 4902 | PRINCES ST M D | Princes Street Main Drain | main-drain | named for a main drain, written without points | 0 |
| 4903 | ESPLANADE WEST M.D. | Esplanade West Main Drain | main-drain | named for a main drain | 0 |
| 4904 | RICHARDSON ST M.D. | Richardson Street Main Drain | main-drain | named for a main drain | 0 |
| 4908 | CRUIKSHANK ST M.D. | Cruikshank Street Main Drain | main-drain | named for a main drain | 0 |
| 9880 | 9880 COUNCIL DRAINAGE DIRECT TO BAY | Council Drainage Direct to Bay | council-direct | the layer's own wording | 0 |

**Totals.** 26 proposed `main-drain`, 5 `waterway-section`, 3 `council-direct` and 1 `unclassified` — the register is 35 rows and every one carries its evidence. 62,396 of 62,397 addresses are in one of them; 5 Webb Dock, Port Melbourne is in none, which AC 6.1.5 covers separately.

## Approving the whole register at once

Allowed, and it should be recorded as what it is: one person confirming thirty-five rows in one sitting, with their name and the date on each. What is not allowed is approving them because the code proposed them — the proposals are a naming convention, and the register exists because a convention is not a source.

**That is what happened on 4 October 2026**: Xiyu Cao approved all thirty-five in one sitting, and the machine-readable copy carries that name and date on every row rather than a single approval standing in for thirty-five. Anybody reopening a row later changes it there and here, and `check-subcatchments.mjs` holds the artefact to whatever the two of them say.
