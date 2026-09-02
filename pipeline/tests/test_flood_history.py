"""Tests for the historical flood incident artefact.

Two failures are worth testing hardest, because both produce a plausible
ranking rather than an error.

A region that does not resolve to a name would simply vanish from the
aggregate, and an area missing from a ranked list looks exactly like an area
with no incidents. And the workbook lays eight incident types side by side in
identical six-column blocks, so a shifted column reads as a different type
without anything looking wrong — Storm sits beside Flood and is five times
larger.
"""

from __future__ import annotations

import io
import json
import zipfile

import pytest
from openpyxl import Workbook

from drainlens_pipeline.flood_history import (
    MAX_AREAS,
    SCOPE,
    YEARS,
    FloodHistoryError,
    Place,
    Region,
    _open,
    build,
    fetch,
    join,
    main,
    rank,
    read_geography,
    read_incidents,
)

TYPES = ("Overall", "Storm", "Flood")


def workbook_bytes(
    rows,
    *,
    types=TYPES,
    years=YEARS,
    first_column="region_id",
    sheet="Master",
):
    """A workbook shaped like the published one.

    `rows` are `(code, {type: [six counts]})`. Anything not given is zero, so
    a test naming only Flood still exercises the column selection.
    """
    book = Workbook()
    sheet_obj = book.active
    sheet_obj.title = sheet

    sheet_obj.append(["ABS Census Areas - Statistical Level 1, count of SES incidents."])
    sheet_obj.append([])
    header_types, header_years = [None], [first_column]
    for kind in types:
        for year in years:
            header_types.append(kind)
            header_years.append(year)
    sheet_obj.append(header_types)
    sheet_obj.append(header_years)

    for code, counts in rows:
        line = [code]
        for kind in types:
            line.extend(counts.get(kind, [0] * len(years)))
        sheet_obj.append(line)

    buffer = io.BytesIO()
    book.save(buffer)
    return buffer.getvalue()


def allocation_bytes(records):
    """`records` are `(sa1_7digit, sa2_name, gccsa_name, state_name)`."""
    header = (
        "SA1_MAINCODE_2011,SA1_7DIGITCODE_2011,SA2_MAINCODE_2011,SA2_5DIGITCODE_2011,"
        "SA2_NAME_2011,SA3_CODE_2011,SA3_NAME_2011,SA4_CODE_2011,SA4_NAME_2011,"
        "GCCSA_CODE_2011,GCCSA_NAME_2011,STATE_CODE_2011,STATE_NAME_2011,AREA_ALBERS_SQM"
    )
    lines = [header]
    for code, area, gccsa, state in records:
        lines.append(
            f"2{code}0001,{code},2{code[1:5]},{code[1:6]},{area},20101,S3,201,S4,"
            f"2GMEL,{gccsa},2,{state},1000.0"
        )
    return ("\n".join(lines) + "\n").encode("utf-8")


def melbourne(*pairs):
    """Places in scope, from `(code, area_name)` pairs."""
    return {code: Place(name, SCOPE) for code, name in pairs}


def flood(*counts):
    return {"Flood": list(counts)}


# --- reading the workbook -------------------------------------------------


def test_reads_the_flood_columns_and_not_its_neighbours():
    data = workbook_bytes(
        [("2100101", {"Overall": [9] * 6, "Storm": [7] * 6, "Flood": [1, 2, 3, 4, 5, 6]})]
    )
    assert read_incidents(data) == [Region("2100101", (1, 2, 3, 4, 5, 6), False)]


def test_treats_a_suppressed_cell_as_zero_and_says_so():
    data = workbook_bytes([("2100101", {"Flood": [1, "X", 3, 0, 0, 0]})])
    region = read_incidents(data)[0]
    # Zero, because it is not known to be anything; flagged, because it is not
    # known to be zero either.
    assert region.by_year == (1, 0, 3, 0, 0, 0)
    assert region.suppressed is True


def test_rejects_a_marker_that_is_not_the_documented_one():
    data = workbook_bytes([("2100101", {"Flood": [1, "n/a", 3, 0, 0, 0]})])
    with pytest.raises(FloodHistoryError, match="suppression marker"):
        read_incidents(data)


def test_rejects_a_workbook_with_no_master_sheet():
    data = workbook_bytes([("2100101", flood(1, 0, 0, 0, 0, 0))], sheet="Data")
    with pytest.raises(FloodHistoryError, match="Master"):
        read_incidents(data)


def test_rejects_a_moved_first_column():
    data = workbook_bytes([("2100101", flood(1, 0, 0, 0, 0, 0))], first_column="sa1")
    with pytest.raises(FloodHistoryError, match="region_id"):
        read_incidents(data)


def test_rejects_a_different_span_of_years():
    shifted = ("2010-11", "2011-12", "2012-13", "2013-14", "2014-15", "2015-16")
    data = workbook_bytes([("2100101", flood(1, 0, 0, 0, 0, 0))], years=shifted)
    with pytest.raises(FloodHistoryError, match="columns to be"):
        read_incidents(data)


def test_rejects_a_missing_flood_block():
    data = workbook_bytes(
        [("2100101", {"Overall": [1] * 6})], types=("Overall", "Storm")
    )
    with pytest.raises(FloodHistoryError, match="columns to be"):
        read_incidents(data)


def test_rejects_a_code_that_is_not_a_seven_digit_sa1():
    data = workbook_bytes([("21001010001", flood(1, 0, 0, 0, 0, 0))])
    with pytest.raises(FloodHistoryError, match="7-digit"):
        read_incidents(data)


def test_rejects_a_repeated_region():
    data = workbook_bytes(
        [("2100101", flood(1, 0, 0, 0, 0, 0)), ("2100101", flood(2, 0, 0, 0, 0, 0))]
    )
    with pytest.raises(FloodHistoryError, match="more than once"):
        read_incidents(data)


def test_rejects_a_workbook_that_is_only_headers():
    with pytest.raises(FloodHistoryError, match="too few to be the data"):
        read_incidents(workbook_bytes([]))


def test_rejects_a_workbook_whose_rows_all_lack_a_region():
    # A different failure from the one above: the sheet is the right shape and
    # carries rows, but none of them names a region. Blank rows are skipped
    # everywhere else, so without this the builder would publish nothing and
    # say nothing.
    with pytest.raises(FloodHistoryError, match="no regions"):
        read_incidents(workbook_bytes([(None, {}), (None, {})]))


def test_skips_trailing_blank_rows():
    # The published file carries three of them below the data.
    data = workbook_bytes([("2100101", flood(1, 0, 0, 0, 0, 0)), (None, {})])
    assert [r.code for r in read_incidents(data)] == ["2100101"]


# --- reading the geography ------------------------------------------------


def test_keeps_the_whole_state_not_just_the_scope():
    data = allocation_bytes(
        [
            ("2100101", "Kensington", SCOPE, "Victoria"),
            ("2140012", "Mildura", "Rest of Vic.", "Victoria"),
            ("1100101", "Goulburn", "Rest of NSW", "New South Wales"),
        ]
    )
    places = read_geography(data)
    # Both Victorian rows, so the join can tell "not ours" from "not found".
    assert set(places) == {"2100101", "2140012"}
    assert places["2140012"] == Place("Mildura", "Rest of Vic.")


def test_rejects_a_state_name_that_matches_nothing():
    data = allocation_bytes([("2100101", "Kensington", SCOPE, "Victoria")])
    with pytest.raises(FloodHistoryError, match="STATE_NAME_2011"):
        read_geography(data, state="Queensland")


# --- the join -------------------------------------------------------------


def test_refuses_a_partial_join():
    regions = [
        Region("2100101", (1,) * 6, False),
        Region("2999999", (99,) * 6, False),
    ]
    with pytest.raises(FloodHistoryError, match="no SA2 name"):
        join(regions, melbourne(("2100101", "Kensington")))


def test_drops_out_of_scope_regions_only_after_the_integrity_check():
    regions = [
        Region("2100101", (1, 1, 1, 1, 1, 1), False),
        Region("2140012", (50,) * 6, False),
    ]
    places = {
        "2100101": Place("Kensington", SCOPE),
        "2140012": Place("Mildura", "Rest of Vic."),
    }
    areas = join(regions, places)
    assert [a.name for a in areas] == ["Kensington"]


def test_rejects_a_scope_that_matches_nothing():
    regions = [Region("2140012", (1,) * 6, False)]
    places = {"2140012": Place("Mildura", "Rest of Vic.")}
    with pytest.raises(FloodHistoryError, match="GCCSA_NAME_2011"):
        join(regions, places)


def test_sums_regions_into_their_area_and_carries_the_suppression():
    regions = [
        Region("2100101", (1, 0, 0, 0, 0, 0), False),
        Region("2100102", (2, 3, 0, 0, 0, 0), True),
        Region("2100201", (5, 0, 0, 0, 0, 0), False),
    ]
    places = melbourne(
        ("2100101", "Kensington"), ("2100102", "Kensington"), ("2100201", "Croydon")
    )
    areas = {a.name: a for a in join(regions, places)}

    assert areas["Kensington"].by_year == (3, 3, 0, 0, 0, 0)
    assert areas["Kensington"].total == 6
    assert areas["Kensington"].regions == 2
    assert areas["Kensington"].suppressed_regions == 1
    # One withheld count makes the area's total a lower bound, and the page has
    # to be able to say which areas those are.
    assert areas["Kensington"].complete is False
    assert areas["Croydon"].complete is True


# --- ranking --------------------------------------------------------------


def test_orders_by_total_then_by_name_so_a_rebuild_repeats():
    regions = [
        Region("2100101", (5,) + (0,) * 5, False),
        Region("2100102", (9,) + (0,) * 5, False),
        Region("2100103", (5,) + (0,) * 5, False),
    ]
    places = melbourne(
        ("2100101", "Zephyr"), ("2100102", "Alpha"), ("2100103", "Beta")
    )
    assert [a.name for a in rank(join(regions, places))] == ["Alpha", "Beta", "Zephyr"]


def test_drops_areas_with_no_recorded_incident():
    regions = [
        Region("2100101", (0,) * 6, False),
        Region("2100102", (1,) + (0,) * 5, False),
    ]
    places = melbourne(("2100101", "Quiet"), ("2100102", "Busy"))
    assert [a.name for a in rank(join(regions, places))] == ["Busy"]


def test_publishes_no_more_than_the_cap():
    regions = [Region(f"21001{i:02d}", (i + 1,) + (0,) * 5, False) for i in range(40)]
    places = melbourne(*((f"21001{i:02d}", f"Area {i:02d}") for i in range(40)))
    assert len(rank(join(regions, places))) == MAX_AREAS


# --- the artefact ---------------------------------------------------------


def sample(count=8):
    regions = [Region(f"21001{i:02d}", (10 * (i + 1),) + (0,) * 5, False) for i in range(count)]
    places = melbourne(*((f"21001{i:02d}", f"Area {i:02d}") for i in range(count)))
    return regions, places


def test_the_artefact_says_what_it_is_and_what_it_is_not():
    artefact = build(*sample())
    assert artefact["artefact"] == "flood-history"
    assert artefact["basis"] == "sourceProvided"
    assert artefact["incidentType"] == "Flood"
    assert artefact["geography"] == {
        "unit": "SA2",
        "standard": "ASGS 2011",
        "scope": SCOPE,
    }
    assert artefact["reportingPeriod"]["years"] == list(YEARS)
    # AC 2.3.1.b: the exclusion is a property of the data, so it travels with
    # the data rather than being written into a screen that could drift.
    assert "flash flooding" in artefact["excludes"].lower()
    assert "Storm" in artefact["excludes"]


def test_areas_are_ranked_from_one_with_their_yearly_series():
    artefact = build(*sample())
    assert [a["rank"] for a in artefact["areas"]] == list(range(1, 9))
    assert artefact["areas"][0]["name"] == "Area 07"
    assert len(artefact["areas"][0]["byYear"]) == len(YEARS)
    assert sum(artefact["areas"][0]["byYear"]) == artefact["areas"][0]["total"]


def test_refuses_to_publish_fewer_than_five_areas():
    with pytest.raises(FloodHistoryError, match="2.1.1.b"):
        build(*sample(count=4))


def test_flags_areas_level_with_a_neighbour():
    regions = [
        Region("2100101", (9,) + (0,) * 5, False),
        Region("2100102", (5,) + (0,) * 5, False),
        Region("2100103", (5,) + (0,) * 5, False),
        Region("2100104", (3,) + (0,) * 5, False),
        Region("2100105", (2,) + (0,) * 5, False),
    ]
    places = melbourne(
        ("2100101", "A"), ("2100102", "B"), ("2100103", "C"), ("2100104", "D"), ("2100105", "E")
    )
    tied = {a["name"]: a["tied"] for a in build(regions, places)["areas"]}
    assert tied == {"A": False, "B": True, "C": True, "D": False, "E": False}


def test_counts_reconcile_with_the_areas_published():
    artefact = build(*sample())
    counts = artefact["counts"]
    assert counts["areasPublished"] == len(artefact["areas"])
    assert counts["incidentsPublished"] == sum(a["total"] for a in artefact["areas"])
    assert counts["incidentsInScope"] >= counts["incidentsPublished"]


def test_the_pilot_area_is_reported_when_it_is_in_scope():
    regions, places = sample()
    regions.append(Region("2100199", (4, 0, 0, 0, 0, 0), True))
    places["2100199"] = Place("Kensington", SCOPE)
    artefact = build(regions, places)
    assert artefact["pilotArea"]["name"] == "Kensington"
    assert artefact["pilotArea"]["total"] == 4
    assert artefact["pilotArea"]["complete"] is False


def test_the_pilot_area_is_null_rather_than_invented():
    assert build(*sample())["pilotArea"] is None


# --- fetching -------------------------------------------------------------


def zipped(name, payload=b"x"):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(name, payload)
    return buffer.getvalue()


def test_rejects_an_error_page_served_as_a_download():
    # data.vic's own link for this dataset returns exactly this: a 404 HTML
    # page, 119 KB, which curl reports as a successful download.
    page = b"<!DOCTYPE html><title>Error Page - Victoria State Emergency Service</title>"
    with pytest.raises(FloodHistoryError, match="not a ZIP archive"):
        fetch(opener=lambda url: page)


def test_rejects_an_archive_without_the_file_it_should_hold():
    with pytest.raises(FloodHistoryError, match="no .xlsx file"):
        fetch(opener=lambda url: zipped("readme.txt"))


def test_returns_the_member_of_each_archive():
    def opener(url):
        return zipped("data.xlsx", b"book") if "ses.vic" in url else zipped("SA1.csv", b"rows")

    assert fetch(opener=opener) == (b"book", b"rows")


# --- the command ----------------------------------------------------------


def sources_on_disk(tmp_path, count=6):
    """The two inputs as files, the way `main` is given them offline."""
    rows = [(f"21001{i:02d}", flood(10 * (i + 1), 0, 0, 0, 0, 0)) for i in range(count)]
    incidents = tmp_path / "incidents.xlsx"
    incidents.write_bytes(workbook_bytes(rows))

    geography = tmp_path / "sa1.csv"
    geography.write_bytes(
        allocation_bytes(
            [(f"21001{i:02d}", f"Area {i:02d}", SCOPE, "Victoria") for i in range(count)]
        )
    )
    return incidents, geography


def test_main_writes_the_artefact(tmp_path, capsys):
    incidents, geography = sources_on_disk(tmp_path)
    out = tmp_path / "flood-history.json"

    code = main(
        [
            "--incidents",
            str(incidents),
            "--geography",
            str(geography),
            "--out",
            str(out),
        ]
    )

    assert code == 0
    artefact = json.loads(out.read_text(encoding="utf-8"))
    assert artefact["artefact"] == "flood-history"
    assert [a["name"] for a in artefact["areas"]][:2] == ["Area 05", "Area 04"]
    # The command reports the counts a reader would otherwise have to open the
    # file to check, including the two the Data Quality Statement can be held
    # against.
    printed = capsys.readouterr().out
    assert "SA1 regions read" in printed
    assert "suppressed for privacy" in printed


def test_main_refuses_one_source_without_the_other(tmp_path, capsys):
    incidents, _ = sources_on_disk(tmp_path)
    # Fetching one and reading the other would mix a published file with a
    # local one and publish the result as though both were published.
    assert main(["--incidents", str(incidents), "--out", str(tmp_path / "o.json")]) == 1
    assert "both" in capsys.readouterr().err


def test_open_passes_the_timeout_through(monkeypatch):
    seen = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return b"payload"

    def urlopen(url, timeout=None):
        seen["url"], seen["timeout"] = url, timeout
        return Response()

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    assert _open("https://example.test/file.zip", 12.5) == b"payload"
    assert seen == {"url": "https://example.test/file.zip", "timeout": 12.5}
