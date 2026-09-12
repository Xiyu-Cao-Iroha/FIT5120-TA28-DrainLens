"""Placing an area, and the ways a point can be in the wrong one.

The geometry here is written by hand rather than taken from the published file:
a 121 MB boundary set is not a fixture, and none of the judgements in this
module are about its size. What they are about is a point landing inside the
shape it names, which a square cannot demonstrate and a crescent can.

**MID and MIF are two files in one order**, with nothing inside either saying
which row belongs to which feature. That is the assumption most likely to
produce a map that draws perfectly and labels everything wrong, so the pairing
is by position and the position is carried rather than recomputed.
"""

from __future__ import annotations

import json

import pytest

from drainlens_pipeline.area_points import (
    SCOPE,
    AreaPointsError,
    Placed,
    build,
    centroid,
    inside,
    place,
    point_on_surface,
    read_attributes,
    read_regions,
)

# A square, a crescent whose centroid falls in its own bay, and a two-part
# area. Longitude then latitude, as MapInfo writes them.
SQUARE = [(144.0, -37.0), (144.1, -37.0), (144.1, -37.1), (144.0, -37.1)]
CRESCENT = [
    (144.0, -37.0),
    (144.2, -37.0),
    (144.2, -37.2),
    (144.0, -37.2),
    (144.0, -37.15),
    (144.15, -37.15),
    (144.15, -37.05),
    (144.0, -37.05),
]
ISLAND = [(145.0, -38.0), (145.01, -38.0), (145.01, -38.01), (145.0, -38.01)]


def mid(*rows):
    """MID lines, with only the three columns this module reads filled in."""
    lines = []
    for code, name, gccsa in rows:
        parts = [""] * 12
        parts[0], parts[2], parts[8] = code, name, gccsa
        lines.append(",".join(parts))
    return "\n".join(lines) + "\n"


def mif(*features):
    """A MIF geometry section: each feature is a list of rings."""
    lines = ["VERSION 450", 'DELIMITER ","', "COLUMNS 12", "DATA"]
    for rings in features:
        if rings is None:
            lines.append("NONE")
            continue
        lines.append(f"REGION {len(rings)}")
        for ring in rings:
            lines.append(str(len(ring)))
            lines.extend(f"{x} {y}" for x, y in ring)
    return lines


# --- reading the two files ------------------------------------------------


def test_keeps_the_row_number_so_a_row_can_find_its_shape():
    # The pairing is positional and nothing in either file states it. Carrying
    # the index is what lets `place` assert the two files match.
    rows = read_attributes(
        mid(
            ("206011105", "Brunswick", SCOPE),
            ("101011001", "Goulburn", "Rest of NSW"),
            ("206022201", "Carlton", SCOPE),
        )
    )
    assert [(index, parts[2]) for index, parts in rows] == [(0, "Brunswick"), (2, "Carlton")]


def test_refuses_a_scope_that_matches_nothing():
    with pytest.raises(AreaPointsError, match="GCCSA_NAME_2011"):
        read_attributes(mid(("101011001", "Goulburn", "Rest of NSW")))


def test_reads_every_ring_of_a_multi_part_area():
    [feature] = list(read_regions(mif([SQUARE, ISLAND])))
    assert [len(ring) for ring in feature] == [4, 4]


def test_yields_nothing_for_a_feature_that_is_not_a_region():
    """A gap, not a skip.

    A feature with no polygon still occupies a position in the file. Dropping
    it would shift every feature after it onto the wrong attribute row, and the
    map would draw correctly with every name one place out.
    """
    assert [len(f) for f in read_regions(mif([SQUARE], None, [ISLAND]))] == [1, 0, 1]


def test_refuses_a_file_with_no_data_section():
    with pytest.raises(AreaPointsError, match="DATA"):
        list(read_regions(["VERSION 450", "COLUMNS 12"]))


# --- putting the point inside the shape -----------------------------------


def test_a_square_is_placed_at_its_middle():
    assert centroid(SQUARE) == pytest.approx((144.05, -37.05))
    assert inside(centroid(SQUARE), SQUARE)


def test_a_crescents_centroid_is_outside_it_and_the_fallback_is_not():
    """The case two of Greater Melbourne's 281 areas are in.

    Abbotsford and Strathmore are each cut into a crescent by a river bend, and
    their area centroids land in a neighbouring suburb. A label in the wrong
    area is the kind of error that looks like a map working.
    """
    assert not inside(centroid(CRESCENT), CRESCENT)
    assert inside(point_on_surface(CRESCENT), CRESCENT)


def test_places_an_area_and_refuses_one_with_no_boundary():
    rows = read_attributes(mid(("206011105", "Brunswick", SCOPE)))
    [placed] = place(rows, list(read_regions(mif([SQUARE]))))
    assert placed.code == "206011105"
    assert placed.name == "Brunswick"
    # Somewhere in Victoria, in metres rather than degrees.
    assert 200_000 < placed.easting < 800_000
    assert 5_500_000 < placed.northing < 6_100_000

    with pytest.raises(AreaPointsError, match="no boundary"):
        place(rows, list(read_regions(mif(None))))


def test_uses_the_largest_part_rather_than_averaging_across_the_water():
    # Three Greater Melbourne areas are more than one piece. A point averaged
    # across an island and a mainland is in the sea between them.
    rows = read_attributes(mid(("206011105", "Two Pieces", SCOPE)))
    [both] = place(rows, list(read_regions(mif([SQUARE, ISLAND]))))
    [mainland] = place(rows, list(read_regions(mif([SQUARE]))))
    assert both.easting == pytest.approx(mainland.easting)
    assert both.northing == pytest.approx(mainland.northing)


def test_refuses_when_the_two_files_are_different_releases():
    # The failure that would otherwise be silent: fewer features than rows
    # means every pairing after the gap is wrong, and the map still draws.
    rows = read_attributes(
        mid(("206011105", "Brunswick", SCOPE), ("206022201", "Carlton", SCOPE))
    )
    with pytest.raises(AreaPointsError, match="not the same release"):
        place(rows, list(read_regions(mif([SQUARE]))))


# --- the artefact ---------------------------------------------------------


def points(*placed):
    return build(list(placed))


def test_publishes_metres_from_the_extents_own_corner():
    """The frame every other artefact here uses, so the browser needs no projection."""
    artefact = points(
        Placed("206011105", "Brunswick", 320_400.0, 5_815_600.0),
        Placed("206022201", "Carlton", 322_900.0, 5_812_100.0),
    )
    extent = artefact["extent"]
    assert extent["min_e"] == 320_000
    assert extent["min_n"] == 5_812_000
    assert extent["crs"] == "EPSG:28355"
    assert artefact["areas"][0] == {"code": "206011105", "name": "Brunswick", "e": 400, "n": 3600}
    assert artefact["areas"][1]["e"] == 2900


def test_rounds_the_extent_outward_so_nothing_sits_on_an_edge():
    artefact = points(Placed("1", "One", 320_001.0, 5_812_001.0))
    extent = artefact["extent"]
    assert extent["min_e"] == 320_000
    assert artefact["areas"][0]["e"] == 1
    assert extent["width_m"] >= 1000


def test_says_it_is_calculated_rather_than_recorded():
    # The point is ours; the boundary it came from is ABS's. AC 4.3.4 asks the
    # legend to keep those apart, and it can only do that if the artefact does.
    artefact = points(Placed("1", "One", 320_400.0, 5_815_600.0))
    assert artefact["basis"] == "derived"
    assert artefact["source"]["publisher"] == "Australian Bureau of Statistics"
    assert "whole area" in str(artefact["note"])


def test_refuses_to_publish_nothing():
    with pytest.raises(AreaPointsError, match="no areas"):
        build([])


def test_main_writes_the_artefact(tmp_path, capsys):
    from drainlens_pipeline.area_points import main

    mid_file, mif_file = tmp_path / "a.mid", tmp_path / "a.mif"
    mid_file.write_text(mid(("206011105", "Brunswick", SCOPE)), encoding="utf-8")
    mif_file.write_text("\n".join(mif([SQUARE])) + "\n", encoding="utf-8")
    out = tmp_path / "sa2-points.json"

    assert main(["--mid", str(mid_file), "--mif", str(mif_file), "--out", str(out)]) == 0
    written = json.loads(out.read_text(encoding="utf-8"))
    assert written["artefact"] == "sa2-points"
    assert written["counts"]["areas"] == 1
    assert "areas placed" in capsys.readouterr().out


def test_main_reports_a_refusal_without_a_traceback(tmp_path, capsys):
    from drainlens_pipeline.area_points import main

    mid_file, mif_file = tmp_path / "a.mid", tmp_path / "a.mif"
    mid_file.write_text(mid(("101011001", "Goulburn", "Rest of NSW")), encoding="utf-8")
    mif_file.write_text("\n".join(mif([SQUARE])) + "\n", encoding="utf-8")
    out = tmp_path / "sa2-points.json"

    assert main(["--mid", str(mid_file), "--mif", str(mif_file), "--out", str(out)]) == 1
    assert "GCCSA_NAME_2011" in capsys.readouterr().err
    assert not out.exists()
