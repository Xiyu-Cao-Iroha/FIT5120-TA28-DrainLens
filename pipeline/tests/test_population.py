"""The denominator, and the ways it could be wrong while looking right.

The workbook is an indented hierarchy rather than a table, and the nine-digit
code it never writes down has to be built from three of its columns. Both of
those are assumptions about a file's shape, and both are tested here against
rows rather than against a fixture workbook — ABS publishes this as the older
OLE2 `.xls`, which nothing in this project can write.

The `build` tests are the more valuable half. A parser that misreads a row
produces a number nobody can explain; a join that pairs the wrong code with the
wrong name produces a number that looks completely ordinary.
"""

from __future__ import annotations

import json

import pytest

from drainlens_pipeline.population import (
    DENOMINATOR_YEAR,
    MIN_RESIDENTS,
    SCOPE,
    YEARS,
    Estimate,
    PopulationError,
    build,
    main,
    read_estimates,
    rows_from,
)

WIDTH = 23
FIRST_YEAR = 2005
ALL_YEARS = tuple(range(FIRST_YEAR, 2016))


def blank():
    return [""] * WIDTH


def capital(code, name):
    """A greater-capital heading, which names itself where SA4s name themselves."""
    row = blank()
    row[0], row[4] = code, name
    return row


def sa4(code):
    row = blank()
    row[1] = float(code)
    return row


def sa3(code):
    row = blank()
    row[2] = float(code)
    return row


def area(code, name, *, start=10_000, step=100):
    """An SA2 row whose population rises by `step` each year from `start`."""
    row = blank()
    row[3], row[5] = float(code), name
    for index, _year in enumerate(ALL_YEARS):
        row[6 + index] = float(start + index * step)
    return row


def sheet(*areas):
    """One SA4 and one SA3 in scope, then the given SA2 rows."""
    return [capital("2GMEL", SCOPE), sa4(6), sa3(1), *areas]


# --- reading the sheet ----------------------------------------------------


def test_builds_the_nine_digit_code_the_workbook_never_writes():
    # 2 for Victoria, then SA4, SA3 and the SA2's own four digits -- which is
    # how ASGS composes it, and the only reason a population row can be joined
    # to anything.
    [one] = read_estimates(sheet(area(1105, "Brunswick")))
    assert one.code == "206011105"
    assert one.name == "Brunswick"


def test_keeps_only_the_years_the_flood_counts_cover():
    # The workbook carries 2005 to 2015. Four of those are before the first
    # dispatch and nothing can be divided by them.
    [one] = read_estimates(sheet(area(1105, "Brunswick", start=10_000, step=100)))
    assert tuple(one.persons) == YEARS
    assert one.persons[2009] == 10_400
    assert one.persons[DENOMINATOR_YEAR] == 10_700


def test_carries_each_heading_forward_to_the_areas_under_it():
    rows = [
        capital("2GMEL", SCOPE),
        sa4(6),
        sa3(1),
        area(1105, "Brunswick"),
        sa3(2),
        area(2201, "Carlton"),
    ]
    assert [e.code for e in read_estimates(rows)] == ["206011105", "206022201"]


def test_leaves_out_areas_in_another_greater_capital():
    rows = [
        capital("2GMEL", SCOPE),
        sa4(6),
        sa3(1),
        area(1105, "Brunswick"),
        capital("2RVIC", "REST OF VIC."),
        sa4(17),
        sa3(1),
        area(1101, "Mildura"),
    ]
    assert [e.name for e in read_estimates(rows)] == ["Brunswick"]


def test_stops_at_the_footer_rather_than_reading_it_as_an_area():
    footer = blank()
    footer[0] = "Source: Regional Population Growth, Australia"
    rows = [*sheet(area(1105, "Brunswick")), footer, area(9999, "Not an area")]
    assert [e.name for e in read_estimates(rows)] == ["Brunswick"]


def test_refuses_a_scope_that_matches_nothing():
    # The two files spell the same region differently -- `Greater Melbourne` in
    # the ABS allocation, `GREATER MELBOURNE` here -- so this is the error a
    # reader gets for using the other one, and it says which.
    with pytest.raises(PopulationError, match="upper case"):
        read_estimates(sheet(area(1105, "Brunswick")), scope="Greater Melbourne")


def test_refuses_an_area_that_appears_before_any_heading():
    # Without an SA4 and an SA3 the code cannot be built, and building it from
    # whatever was left over from a previous sheet is how one area's residents
    # end up under another area's identifier.
    with pytest.raises(PopulationError, match="cannot be built"):
        read_estimates([capital("2GMEL", SCOPE), area(1105, "Brunswick")])


def test_refuses_a_population_that_is_not_a_number():
    rows = sheet(area(1105, "Brunswick"))
    rows[-1][6 + 2012 - FIRST_YEAR] = "n.a."
    with pytest.raises(PopulationError, match="Brunswick in 2012"):
        read_estimates(rows)


def test_ignores_rows_too_short_to_be_estimates():
    # Some sheets carry ragged trailing rows. A short row is not an area, and
    # reading one would index off the end.
    assert read_estimates([*sheet(area(1105, "Brunswick")), ["", ""]])[0].name == "Brunswick"


# --- the join -------------------------------------------------------------


def estimate(code, name, persons):
    return Estimate(code, name, {year: persons for year in YEARS})


def listed(*pairs):
    return [{"code": code, "name": name} for code, name in pairs]


def test_builds_the_artefact_in_code_order():
    artefact = build(
        [estimate("206022201", "Carlton", 9_000), estimate("206011105", "Brunswick", 20_000)],
        listed(("206011105", "Brunswick"), ("206022201", "Carlton")),
    )
    assert [a["name"] for a in artefact["areas"]] == ["Brunswick", "Carlton"]
    assert artefact["areas"][0]["persons"] == [20_000] * len(YEARS)
    assert artefact["counts"] == {"areas": 2, "scored": 2, "belowMinimum": 0}
    assert artefact["basis"] == "sourceProvided"
    assert artefact["denominator"] == f"{DENOMINATOR_YEAR}-06-30"
    assert artefact["asAt"][0] == f"{YEARS[0]}-06-30"


def test_counts_the_areas_too_small_to_score_without_dropping_them():
    # They stay in the artefact. The population of an industrial estate is a
    # fact; what it is not is a denominator, and `minimumResidents` is how the
    # consumer knows which.
    artefact = build(
        [estimate("206011105", "Brunswick", 20_000), estimate("206022201", "Port", 15)],
        listed(("206011105", "Brunswick"), ("206022201", "Port")),
    )
    assert artefact["counts"] == {"areas": 2, "scored": 1, "belowMinimum": 1}
    assert artefact["minimumResidents"] == MIN_RESIDENTS
    assert len(artefact["areas"]) == 2


def test_refuses_an_area_with_no_estimate():
    # This is the failure the whole epic turned on. An area that silently drops
    # out shows a count and no score, and that state is meant to mean "nobody
    # lives here", not "the join missed".
    with pytest.raises(PopulationError, match="no population estimate"):
        build(
            [estimate("206011105", "Brunswick", 20_000)],
            listed(("206011105", "Brunswick"), ("206022201", "Carlton")),
        )


def test_refuses_an_estimate_belonging_to_no_area():
    with pytest.raises(PopulationError, match="belong to no area"):
        build(
            [estimate("206011105", "Brunswick", 20_000), estimate("206022201", "Carlton", 9_000)],
            listed(("206011105", "Brunswick")),
        )


def test_refuses_a_code_and_a_name_that_disagree():
    """The one that would never be noticed.

    Both joins succeed, both files look complete, and Brunswick's residents are
    the denominator under Carlton's dispatches. Every number downstream has an
    ordinary magnitude.
    """
    with pytest.raises(PopulationError, match="disagree"):
        build(
            [estimate("206011105", "Carlton", 9_000)],
            listed(("206011105", "Brunswick")),
        )


def test_refuses_a_name_that_belongs_to_two_areas():
    with pytest.raises(PopulationError, match="join by name is ambiguous"):
        build(
            [estimate("206011105", "Richmond", 20_000), estimate("206022201", "Richmond", 9_000)],
            listed(("206011105", "Richmond"), ("206022201", "Richmond")),
        )


# --- reading the workbook, and the command --------------------------------


class FakeSheet:
    def __init__(self, title, rows):
        self._title, self._rows = title, rows
        self.nrows = len(rows)

    def cell_value(self, r, c):
        return self._rows[r][c]

    def row(self, r):
        return [type("Cell", (), {"value": v})() for v in self._rows[r]]


class FakeBook:
    def __init__(self, sheets):
        self._sheets = sheets

    def sheet_names(self):
        return list(self._sheets)

    def sheet_by_name(self, name):
        return self._sheets[name]


def workbook(monkeypatch, sheets):
    import xlrd

    monkeypatch.setattr(xlrd, "open_workbook", lambda path: FakeBook(sheets))


def titled(title, body):
    """A sheet with `title` in the cell the reader looks at, then `body`."""
    rows = [blank() for _ in range(4)]
    rows[3][0] = title
    return FakeSheet(title, [*rows, *([blank()] * 5), *body])


def test_finds_victorias_sheet_by_its_title_not_its_position(monkeypatch):
    # `Table 2` is the name, but the name is not what says which state it is --
    # that is in the caption, and a workbook that gains a sheet would otherwise
    # be read as another state's estimates without anything failing.
    workbook(
        monkeypatch,
        {
            "Table 1": titled("Table 1. Estimated Resident Population, New South Wales", []),
            "Table 2": titled("Table 2. Estimated Resident Population, Victoria", sheet(area(1105, "Brunswick"))),
        },
    )
    [one] = read_estimates(rows_from("ignored.xls"))
    assert one.name == "Brunswick"


def test_refuses_a_workbook_with_no_victoria_sheet(monkeypatch):
    workbook(monkeypatch, {"Contents": titled("Contents", [])})
    with pytest.raises(PopulationError, match="Table 2"):
        rows_from("ignored.xls")


def test_main_writes_the_artefact(tmp_path, monkeypatch, capsys):
    import drainlens_pipeline.population as module

    monkeypatch.setattr(module, "rows_from", lambda path: sheet(area(1105, "Brunswick")))
    areas = tmp_path / "areas.json"
    areas.write_text(json.dumps({"areas": listed(("206011105", "Brunswick"))}), encoding="utf-8")
    out = tmp_path / "population.json"

    assert main(["--estimates", "x.xls", "--areas", str(areas), "--out", str(out)]) == 0
    written = json.loads(out.read_text(encoding="utf-8"))
    assert written["artefact"] == "population"
    assert written["scope"] == SCOPE.title()
    assert "areas matched" in capsys.readouterr().out


def test_main_reports_a_refusal_without_a_traceback(tmp_path, monkeypatch, capsys):
    # A build that fails is a finding about the sources, and the person running
    # it should read a sentence rather than a stack.
    import drainlens_pipeline.population as module

    monkeypatch.setattr(module, "rows_from", lambda path: sheet(area(1105, "Brunswick")))
    areas = tmp_path / "areas.json"
    areas.write_text(
        json.dumps({"areas": listed(("206011105", "Brunswick"), ("206022201", "Carlton"))}),
        encoding="utf-8",
    )
    out = tmp_path / "population.json"

    assert main(["--estimates", "x.xls", "--areas", str(areas), "--out", str(out)]) == 1
    assert "no population estimate" in capsys.readouterr().err
    assert not out.exists()
