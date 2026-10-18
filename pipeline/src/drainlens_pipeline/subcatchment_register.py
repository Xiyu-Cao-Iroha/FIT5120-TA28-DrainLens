"""The subcatchment register: how an area is named on screen, and what it drains to.

Two different jobs live here, and the difference between them is the whole
point of the file.

**Cleaning the name is reproduction.** `9877 COUNCIL DRAINAGE DIRECT TO BAY`
carries a number a reader does not need and `ALEXANDRA PARADE M.D.` carries an
abbreviation they cannot be expected to know. Writing them as *Council drainage
direct to bay* and *Alexandra Parade Main Drain* says what the record says, in
words. AC 6.1.1 asks for exactly this.

**Classifying it is a claim**, and a claim this project is not entitled to make
on its own. AC 6.1.2 has four sentences — the area is associated with a
Melbourne Water main drain, it drains to a section of a waterway, it is council
drainage discharging directly, or the receiving type is not confirmed — and the
Epic 6 definition of done says plainly that *no subcatchment is described as a
Melbourne Water drain without an approved classification*. A name ending in
`M.D.` is strong evidence and is not an approval.

So the register below carries, for every published area, a **proposed** class
and the evidence for it, and an `approved` field that is `None` until a team
member has checked that area against Melbourne Water's own description and
recorded their name and the date. `classify` returns `unclassified` for
everything unapproved, whatever the proposal says, so the screen says *the
receiving drain type has not been confirmed* until somebody has confirmed it.
That is the honest default and it is also the only one that cannot ship a
wrong claim by accident.

`docs/SUBCATCHMENT-CLASSIFICATION.md` is the same register in the form the team
reviews, with what each row would put on screen.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

#: The four answers AC 6.1.2 allows, by the name the artefact publishes.
#:
#: - `main-drain` — the area is associated with a receiving Melbourne Water drain.
#: - `waterway-section` — it drains to that section of the waterway.
#: - `council-direct` — recorded as council drainage discharging directly.
#: - `unclassified` — the receiving drain type has not been confirmed.
Classification = Literal["main-drain", "waterway-section", "council-direct", "unclassified"]

UNCLASSIFIED: Classification = "unclassified"

#: Abbreviations written out, longest first so `M.D.` is not read as `M`.
#:
#: Street-type abbreviations are expanded because the name is read aloud by a
#: resident looking for their street; `M.D.` because nothing on the page says
#: what it stands for. The expansion is a reading of the record's own words and
#: not a statement about what the drain does — that is the classification's
#: job, and it is approved separately.
ABBREVIATIONS: tuple[tuple[str, str], ...] = (
    ("M.D.", "Main Drain"),
    ("M D", "Main Drain"),
    ("AVE", "Avenue"),
    ("RD", "Road"),
    ("ST", "Street"),
)

#: A leading number, which the published names carry on the council-drainage
#: areas (`9877 COUNCIL DRAINAGE DIRECT TO BAY`) and nowhere else.
NUMERIC_PREFIX = re.compile(r"^\d+\s+")


def clean_name(name: str) -> str:
    """The published name as a reader should see it (AC 6.1.1).

    The numeric prefix comes off, approved abbreviations are written out, and
    the rest becomes title case with the small words left alone. Anything in
    brackets is kept — `(LOWER)` and `(MOUTH TO MERRI)` say which part of a
    waterway the area belongs to, which is the thing a reader checks their
    suburb against.
    """
    without_number = NUMERIC_PREFIX.sub("", name.strip())
    words = without_number.split()
    out: list[str] = []
    index = 0
    while index < len(words):
        pair = " ".join(words[index : index + 2]).upper()
        single = words[index].upper()
        expanded = None
        skip = 1
        for abbreviation, full in ABBREVIATIONS:
            if " " in abbreviation and pair == abbreviation:
                expanded, skip = full, 2
                break
            if " " not in abbreviation and single.rstrip(",") == abbreviation:
                expanded = full + ("," if words[index].endswith(",") else "")
                break
        out.append(expanded if expanded is not None else title_word(words[index]))
        index += skip
    return " ".join(out)


def title_word(word: str) -> str:
    """Title case that leaves bracketed parts and small words readable."""
    if word.startswith("("):
        return "(" + title_word(word[1:])
    if word.endswith(")"):
        return title_word(word[:-1]) + ")"
    lowered = word.lower()
    if lowered in {"to", "of", "the", "and"}:
        return lowered
    return lowered.capitalize()


@dataclass(frozen=True)
class Entry:
    """One area's proposed classification, its evidence, and its approval."""

    number: str
    name: str
    proposed: Classification
    evidence: str
    #: `(who, when)` once a team member has checked it against Melbourne
    #: Water's description. `None` until then, and `classify` reads it.
    approved: tuple[str, str] | None = None


#: Every subcatchment the council extent reaches, with a proposal and why.
#:
#: The proposals follow the naming conventions of the published layer: an area
#: named for a main drain (`… M.D.`, and one `PRINCES ST M D`) or for a named
#: drain is proposed as a main drain; one named for a reach of a waterway
#: (`… (LOWER)`, `… (MOUTH TO MERRI)`) as a waterway section; the three
#: `COUNCIL DRAINAGE DIRECT TO BAY` areas as council drainage. `DYNON RD TIDAL
#: CANAL` is proposed as unclassified: it is a canal, the layer does not say
#: whose, and guessing is the thing the criterion forbids.
#:
#: **Every row was approved on 4 October 2026 by Xiyu Cao, in one sitting**,
#: which the register's own instructions allow and ask to be recorded as what
#: it is. `APPROVED` below is that approval; before it, `classify()` published
#: `unclassified` for all thirty-five however strongly a name read.
#:
#: Twenty of the thirty-five actually hold
#: an address, and those are the twenty a reader can reach.
REGISTER: tuple[Entry, ...] = (
    Entry("4202", "BURLEIGH ST DRAIN", "main-drain", "named for a drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4210", "STONY CREEK (LOWER)", "waterway-section", "a named reach of Stony Creek", ("Xiyu Cao", "2026-10-04")),
    Entry("4220", "MARIBYRNONG RIVER (LOWER)", "waterway-section", "a named reach of the Maribyrnong", ("Xiyu Cao", "2026-10-04")),
    Entry("4221", "FOOTSCRAY M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4222", "SUMMERHILL RD M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4223", "ASCOT VALE M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4229", "DYNON RD TIDAL CANAL", UNCLASSIFIED, "a canal, and the layer does not say whose", ("Xiyu Cao", "2026-10-04")),
    Entry("4310", "MOONEE PONDS CREEK (LOWER)", "waterway-section", "a named reach of Moonee Ponds Creek", ("Xiyu Cao", "2026-10-04")),
    Entry("4312", "ARDEN ST DRAIN", "main-drain", "named for a drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4313", "ROYAL PARK M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4314", "BENT ST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4400", "YARRA RIVER (MOUTH TO MERRI)", "waterway-section", "a named reach of the Yarra", ("Xiyu Cao", "2026-10-04")),
    Entry("4401", "ELIZABETH ST DRAIN (CITY)", "main-drain", "named for a drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4404", "YARRA PARK M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4405", "RICHMOND QUARRY M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4410", "ALEXANDRA PARADE M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4420", "MERRI CREEK (LOWER)", "waterway-section", "a named reach of Merri Creek", ("Xiyu Cao", "2026-10-04")),
    Entry("4423", "GLENLYON RD DRAIN", "main-drain", "named for a drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4424", "SUMNER AVE M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4801", "YARRA STREET DRAIN, PRAHRAN", "main-drain", "named for a drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4803", "GITTUS ST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4804", "JOHNSON ST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4805", "FERRARS ST DRAIN", "main-drain", "named for a drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4806", "HANNA ST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4811", "PRAHRAN M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4812", "ESSEX ST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4901", "ROSNY ST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4902", "PRINCES ST M D", "main-drain", "named for a main drain, written without points", ("Xiyu Cao", "2026-10-04")),
    Entry("4903", "ESPLANADE WEST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4904", "RICHARDSON ST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4908", "CRUIKSHANK ST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("4911", "COWDEROY ST M.D.", "main-drain", "named for a main drain", ("Xiyu Cao", "2026-10-04")),
    Entry("9874", "9874 COUNCIL DRAINAGE DIRECT TO BAY", "council-direct", "the layer's own wording", ("Xiyu Cao", "2026-10-04")),
    Entry("9877", "9877 COUNCIL DRAINAGE DIRECT TO BAY", "council-direct", "the layer's own wording", ("Xiyu Cao", "2026-10-04")),
    Entry("9880", "9880 COUNCIL DRAINAGE DIRECT TO BAY", "council-direct", "the layer's own wording", ("Xiyu Cao", "2026-10-04")),
)

BY_NUMBER = {entry.number: entry for entry in REGISTER}


def classify(number: str) -> Classification:
    """What the artefact may publish for this area today.

    Unapproved is unclassified, whatever the proposal says. The screen then
    names the area and says the receiving drain type has not been confirmed,
    which is true, rather than naming a Melbourne Water drain on the strength
    of a naming convention.
    """
    entry = BY_NUMBER.get(number)
    if entry is None or entry.approved is None:
        return UNCLASSIFIED
    return entry.proposed


def proposal(number: str) -> Entry | None:
    """The register row, approved or not, for the document that reviews it."""
    return BY_NUMBER.get(number)


def unapproved() -> tuple[Entry, ...]:
    """Every row still waiting for a team member, for the build to report."""
    return tuple(entry for entry in REGISTER if entry.approved is None)
