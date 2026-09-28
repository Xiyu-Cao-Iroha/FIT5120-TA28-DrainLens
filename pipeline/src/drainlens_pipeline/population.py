"""Resident population by statistical area — the Severity Score's denominator.

Epic 4 asks for flood-related SES activity *relative to how many people live
there*. The counts come from `flood_history`; this is the other half, and it is
the half the work breakdown named as the single point of failure for the epic:
a denominator that cannot be matched honestly is a finding, not a gap to fill
with an estimate.

**It matched.** All 281 Greater Melbourne areas, by two independent joins that
agree on every one. What that means, which year is the denominator and why, and
the seven areas that get no score at all are in `docs/POPULATION-DATA.md` and
`docs/SEVERITY-SCORE.md`. The definition was written before this file.

**Why the workbook is read as rows rather than as bytes.** The other stage that
reads a spreadsheet, `flood_history`, takes bytes and opens them with openpyxl,
and its tests build a workbook to feed it. This file is `.xls` — the older OLE2
format, which openpyxl cannot read and which no dependency here can *write*. So
the parsing takes an iterable of row values and `rows_from` is the only part
that touches xlrd: the judgement is tested against plain lists, and what is
untested is a call that either opens a file or raises.

**The code is reassembled, and that is why it is checked twice.** The workbook
does not carry `SA2_MAINCODE_2011`. It carries the code split across four
indented columns — state, SA4, SA3, SA2 — so a nine-digit code has to be built
from them, which is a claim about the structure of an identifier. Matching by
name instead avoids that claim and makes a different one, that no two areas in
the scope share a name. `build` requires both joins to agree on every area,
which tests both at once.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

#: The estimates.
SOURCE = {
    "dataset": "Population Estimates by Statistical Area Level 2, 2005 to 2015",
    "publisher": "Australian Bureau of Statistics",
    "licence": "CC BY 2.5 AU",
    "dataset_id": "3218.0",
}

#: As the workbook writes it, which is not how the allocation writes it.
#:
#: `flood_history` scopes on `GCCSA_NAME_2011`, where it is `Greater Melbourne`.
#: The same region is `GREATER MELBOURNE` here. Two spellings of one place, and
#: the comparison is made once, in `read_estimates`, rather than at each use.
SCOPE = "GREATER MELBOURNE"

#: The years the reporting period covers, as at 30 June.
#:
#: The workbook carries 2005 to 2015. The flood counts run from 1 July 2009 to
#: 30 June 2015, so 2005 to 2008 would be four columns nothing can divide by.
YEARS: tuple[int, ...] = (2009, 2010, 2011, 2012, 2013, 2014, 2015)

#: The denominator for the headline score: the mid-point of the period.
DENOMINATOR_YEAR = 2012

#: Below this, no score is published.
#:
#: Not a tuned threshold. The data has no area at all between 158 and 2,777
#: residents, so any line drawn in that gap excludes exactly the same seven —
#: two airports, a racecourse, two industrial areas and two more. It is chosen
#: to be explainable: *this is a rate per resident, and these are not places
#: where people live*. See `docs/SEVERITY-SCORE.md`.
MIN_RESIDENTS = 1000

#: Where the estimates begin, after three title rows and a three-row header.
FIRST_DATA_ROW = 9

#: `ERP at 30 June`, one column per year from 2005.
FIRST_YEAR_COLUMN = 6
FIRST_YEAR = 2005


class PopulationError(RuntimeError):
    """The source does not support the denominator it would be used as."""


@dataclass(frozen=True)
class Estimate:
    """One statistical area's resident population, by year."""

    code: str
    name: str
    persons: Mapping[int, int]


def _text(value: object) -> str:
    return str(value).strip()


def _int(value: object, what: str) -> int:
    try:
        return int(round(float(value)))  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise PopulationError(f"{what} is {value!r}, which is not a population") from exc


def read_estimates(rows: Iterable[Sequence[object]], *, scope: str = SCOPE) -> list[Estimate]:
    """The areas inside the scope, from the workbook's rows.

    The sheet is an indented hierarchy rather than a table: a greater-capital
    row, then SA4, then SA3, then the SA2s underneath them, each level writing
    its code into its own column and leaving the rest blank. So the walk carries
    the current SA4 and SA3 forward, which is also what makes the nine-digit
    code reconstructable.

    A row is an SA2 when it has a code in the SA2 column and a name in the SA2
    name column. Everything else — blank spacer rows, the state total, the
    copyright line — either fails that test or ends the walk.
    """
    found: list[Estimate] = []
    current = scope_now = None
    sa4 = sa3 = None

    for row in rows:
        if len(row) < FIRST_YEAR_COLUMN + len(range(FIRST_YEAR, max(YEARS) + 1)):
            continue
        first = _text(row[0])
        if first.startswith("Source") or first.startswith("©"):
            break
        # `2GMEL`, `2RVIC` — a greater-capital heading, naming itself in the
        # column the SA4 names use.
        if first and first[1:].isalpha():
            scope_now = _text(row[4])
            sa4 = sa3 = None
            continue
        if _text(row[1]):
            sa4 = _int(_text(row[1]), "an SA4 code")
            continue
        if _text(row[2]):
            sa3 = _int(_text(row[2]), "an SA3 code")
            continue

        code_cell, name = _text(row[3]), _text(row[5])
        if not code_cell or not name or scope_now != scope:
            continue
        if sa4 is None or sa3 is None:
            raise PopulationError(
                f"{name!r} appears before any SA4 or SA3 heading, so its nine-digit "
                "code cannot be built; the sheet is not shaped as this reader expects"
            )
        sa2 = _int(code_cell, f"the SA2 code for {name}")
        persons = {
            year: _int(row[FIRST_YEAR_COLUMN + year - FIRST_YEAR], f"{name} in {year}")
            for year in YEARS
        }
        found.append(Estimate(f"2{sa4:02d}{sa3:02d}{sa2:04d}", name, persons))
        current = name

    if not found:
        raise PopulationError(
            f"no area in the workbook belongs to {scope!r}; the scope must match the "
            f"heading the sheet writes, which is upper case (last area read: {current!r})"
        )
    return found


def rows_from(path: str) -> list[Sequence[object]]:
    """The Victoria sheet's rows. The only part of this module that reads a file.

    Kept to one call so everything above it can be tested against lists. `xlrd`
    reads the older OLE2 `.xls`, which is what ABS publishes this as and what no
    library here can write — so a fixture workbook is not an option and the
    split is the alternative to leaving the parsing untested.
    """
    import xlrd  # imported here so the rest of the pipeline does not need it

    book = xlrd.open_workbook(path)
    for name in book.sheet_names():
        sheet = book.sheet_by_name(name)
        if sheet.nrows > FIRST_DATA_ROW and _text(sheet.cell_value(3, 0)).startswith(
            "Table 2."
        ):
            return [[c.value for c in sheet.row(r)] for r in range(sheet.nrows)]
    raise PopulationError(
        "no sheet in the workbook starts with 'Table 2.', which is where Victoria's "
        f"estimates live; sheets are {book.sheet_names()}"
    )


def build(
    estimates: Sequence[Estimate],
    areas: Sequence[Mapping[str, object]],
) -> dict[str, object]:
    """The artefact, with the match asserted rather than reported afterwards.

    `areas` is the in-scope list `flood_history --areas` writes: the areas the
    flood counts were joined to, by ASGS code and name. Matching against that
    rather than against the published thirty is the point — those thirty are
    the top of a ranking, and the map has to show the areas with none.

    Three things have to hold, and each is a different way of being wrong:

    * **Every area has an estimate.** One without is an area that would show a
      count and no score, and there is a state for that — but it has to be
      because nobody lives there, not because the join missed.
    * **Every estimate has an area.** A left-over is a scope that does not mean
      what it is being read as.
    * **The two joins agree.** An area matched by code to one name and by name
      to another code would attach one area's residents to another's incidents,
      and every number downstream would look ordinary.
    """
    by_code = {e.code: e for e in estimates}
    by_name: dict[str, list[Estimate]] = {}
    for e in estimates:
        by_name.setdefault(e.name, []).append(e)

    wanted = {str(a["code"]): str(a["name"]) for a in areas}
    missing = sorted(code for code in wanted if code not in by_code)
    if missing:
        raise PopulationError(
            f"{len(missing)} of {len(wanted)} areas have no population estimate "
            f"(first: {[wanted[c] for c in missing[:3]]}). A denominator that is absent "
            "for some areas and silently absent for others is not a denominator"
        )
    extra = sorted(code for code in by_code if code not in wanted)
    if extra:
        raise PopulationError(
            f"{len(extra)} estimates belong to no area in the list "
            f"(first: {[by_code[c].name for c in extra[:3]]}); the scope does not match"
        )
    for code, name in wanted.items():
        if by_code[code].name != name:
            raise PopulationError(
                f"SA2 {code} is {name!r} in the area list and {by_code[code].name!r} in the "
                "workbook: the code join and the name join disagree, and one of them is "
                "attaching the wrong residents"
            )
        if len(by_name.get(name, [])) != 1:
            raise PopulationError(
                f"{name!r} names {len(by_name.get(name, []))} areas in the workbook, so a "
                "join by name is ambiguous"
            )

    ordered = [by_code[code] for code in sorted(wanted)]
    below = [e for e in ordered if e.persons[DENOMINATOR_YEAR] < MIN_RESIDENTS]
    return {
        "artefact": "population",
        "version": 1,
        "basis": "sourceProvided",
        "note": (
            "Estimated resident population at 30 June, by SA2, ASGS 2011. The Severity "
            "Score's denominator is the mid-period figure; the series is published "
            "beside it because activity relative to population in one year has to be "
            "divided by that year."
        ),
        "source": dict(SOURCE),
        "scope": SCOPE.title(),
        "asAt": [f"{year}-06-30" for year in YEARS],
        "denominator": f"{DENOMINATOR_YEAR}-06-30",
        "minimumResidents": MIN_RESIDENTS,
        "counts": {
            "areas": len(ordered),
            "scored": len(ordered) - len(below),
            "belowMinimum": len(below),
        },
        "areas": [
            {
                "code": e.code,
                "name": e.name,
                "persons": [e.persons[year] for year in YEARS],
            }
            for e in ordered
        ],
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys
    from pathlib import Path

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.population",
        description="Build the resident population artefact.",
    )
    parser.add_argument(
        "--estimates", type=Path, required=True, help="the ABS 3218.0 SA2 .xls"
    )
    parser.add_argument(
        "--areas",
        type=Path,
        required=True,
        help="the in-scope area list from `flood_history --areas`",
    )
    parser.add_argument(
        "--out", type=Path, default=Path("../apps/web/public/data/population.json")
    )
    args = parser.parse_args(argv)

    areas = json.loads(args.areas.read_text(encoding="utf-8"))["areas"]
    try:
        artefact = build(read_estimates(rows_from(str(args.estimates))), areas)
    except PopulationError as error:
        print(str(error), file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")

    counts = artefact["counts"]
    assert isinstance(counts, dict)
    print(f"wrote {args.out}  ({args.out.stat().st_size / 1024:.1f} KB)")
    print(f"  areas matched             {counts['areas']:>7,}")
    print(f"  with a usable denominator {counts['scored']:>7,}")
    print(f"  under {MIN_RESIDENTS:,} residents      {counts['belowMinimum']:>7,}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
