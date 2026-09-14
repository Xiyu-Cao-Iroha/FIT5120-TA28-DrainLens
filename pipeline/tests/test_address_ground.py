"""The ground around an address, on planes and noise small enough to reason about."""

from __future__ import annotations

import json

import numpy as np
import pytest

from drainlens_pipeline.address_ground import (
    AddressGroundError,
    addresses_of,
    assess,
    build,
    code_of,
    compass,
    fit_plane,
    main,
    weights_of,
)

SIZE = 300


def plane(east_slope: float, north_slope: float) -> np.ndarray:
    """Ground as a plane; row 0 is the northern edge, so northing = SIZE - row - 0.5."""
    cols = np.arange(SIZE) + 0.5
    norths = SIZE - (np.arange(SIZE) + 0.5)
    return np.add.outer(north_slope * norths, east_slope * cols) + 5.0


ONES = np.ones((SIZE, SIZE), dtype=bool)
ZEROS = np.zeros((SIZE, SIZE), dtype=bool)


def test_compass_points_in_the_map_frame():
    assert compass(0) == "east" and compass(90) == "north" and compass(180) == "west"
    assert compass(225) == "south-west" and compass(359) == "east" and compass(337.6) == "east"


def test_a_plane_is_recovered_exactly():
    ground = plane(0.02, -0.01)
    a, b, r2 = fit_plane(ground, weights_of(ONES, ZEROS), 150.0, 150.0, 75.0)
    assert a == pytest.approx(0.02) and b == pytest.approx(-0.01)
    assert r2 == pytest.approx(1.0)


def test_ground_rising_to_the_east_falls_west_by_the_fitted_amount():
    result = assess(plane(0.02, 0.0), ONES, ZEROS, 150.0, 150.0)
    assert result["ground"] == "falls"
    assert result["bearing"] == "west"
    assert result["fallM"] == 3.0  # 0.02 m per metre across 150 m
    assert result["fitQuality"] == 1.0 and result["measuredCoverage"] == 1.0


def test_ground_rising_to_the_south_falls_north():
    # Rising southwards means northing slope is negative.
    assert assess(plane(0.0, -0.02), ONES, ZEROS, 150.0, 150.0)["bearing"] == "north"


def test_flat_ground_has_no_direction():
    assert assess(plane(0.001, 0.0), ONES, ZEROS, 150.0, 150.0)["ground"] == "unclear"


def test_ground_that_is_not_a_plane_has_no_direction():
    noise = np.random.default_rng(4).normal(0, 2, (SIZE, SIZE)) + plane(0.004, 0.0)
    result = assess(noise, ONES, ZEROS, 150.0, 150.0)
    assert result["ground"] == "unclear"
    assert result["fitQuality"] < 0.3


def test_ground_nobody_measured_has_no_direction():
    result = assess(plane(0.02, 0.0), ZEROS, ZEROS, 150.0, 150.0)
    assert result["ground"] == "unclear"
    assert result["measuredCoverage"] == 0.0


def test_a_direction_that_changes_with_the_circle_is_not_given():
    # Inside 75 m the ground falls west; the ring between 75 and 100 m rises the
    # other way, steeply enough to turn the 100 m fit round.
    ground = plane(0.02, 0.0)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    ring = (xx + 0.5 - 150) ** 2 + (SIZE - yy - 0.5 - 150) ** 2
    outer = (ring > 76**2) & (ring <= 100**2)
    ground[outer] = 5.0 - 0.2 * (xx[outer] + 0.5 - 150)
    assert assess(ground, ONES, ZEROS, 150.0, 150.0)["ground"] == "unclear"


def test_an_address_within_75_m_of_the_edge_gets_the_third_answer():
    assert assess(plane(0.02, 0.0), ONES, ZEROS, 60.0, 150.0) == {"ground": "edge"}
    assert assess(plane(0.02, 0.0), ONES, ZEROS, 150.0, SIZE - 10.0) == {"ground": "edge"}


def test_buildings_carry_no_weight():
    weights = weights_of(ONES, ONES)
    assert weights.sum() == 0
    assert fit_plane(plane(0.02, 0.0), weights, 150.0, 150.0, 75.0) is None
    assert assess(plane(0.02, 0.0), ONES, ONES, 150.0, 150.0) == {"ground": "edge"}
    partly = weights_of(ZEROS, ZEROS)
    assert np.allclose(partly, 0.35)


def test_ids_are_the_ones_the_web_app_builds():
    index = {"area": "kensington", "on": ["Smithfield Road|Kensington", "No Suburb Lane"], "at": [[["221", 1.0, 2.0]], [["3", 4.0, 5.0]]]}
    assert addresses_of(index) == [
        ("kensington/221-smithfield-road-kensington", 1.0, 2.0),
        ("kensington/3-no-suburb-lane", 4.0, 5.0),
    ]


def test_build_counts_every_answer_and_refuses_another_frame():
    index = {
        "area": "t",
        "extent": {"width_m": SIZE, "height_m": SIZE},
        "on": ["A Street|T"],
        "at": [[["1", 150.0, 150.0], ["2", 10.0, 10.0]]],
    }
    artefact = build(plane(0.02, 0.0), ONES, ZEROS, index)
    assert artefact["counts"] == {"falls": 1, "unclear": 0, "edge": 1}
    assert artefact["version"] == 2 and artefact["on"] == ["A Street|T"]
    # West, 3.0 m: six half-metres. The number travels with its code.
    assert artefact["at"] == [["1=W6", "2=x"]]
    with pytest.raises(AddressGroundError, match="same shape"):
        build(plane(0.02, 0.0), ONES, ZEROS, index, np.ones((3, 3), dtype=bool))
    with pytest.raises(AddressGroundError, match="same frame"):
        build(plane(0.02, 0.0), ONES, ZEROS, {**index, "extent": {"width_m": 1000, "height_m": 1000}})
    with pytest.raises(AddressGroundError, match="same shape"):
        build(plane(0.02, 0.0), np.ones((3, 3), dtype=bool), ZEROS, index)


def test_main_writes_the_artefact(tmp_path, capsys):
    terrain = tmp_path / "terrain"
    terrain.mkdir()
    np.save(terrain / "ground-surface.npy", plane(0.02, 0.0).astype(np.float32))
    np.save(terrain / "ground-observed.npy", ONES)
    addresses = tmp_path / "addresses.json"
    addresses.write_text(
        json.dumps({"area": "t", "extent": {"width_m": SIZE, "height_m": SIZE}, "on": ["A Street|T"], "at": [[["1", 150.0, 150.0]]]}),
        encoding="utf-8",
    )
    out = tmp_path / "out" / "address-ground.json"
    assert main(["--terrain", str(terrain), "--addresses", str(addresses), "--out", str(out)]) == 0
    written = json.loads(out.read_text(encoding="utf-8"))
    assert written["artefact"] == "address-ground" and written["counts"]["falls"] == 1
    assert written["at"] == [["1=W6"]]

    # A council terrain carries its holes; one inside the check disc is the edge.
    holes = ONES.copy()
    holes[140, 140] = False
    np.save(terrain / "ground-valid.npy", holes)
    assert main(["--terrain", str(terrain), "--addresses", str(addresses), "--out", str(out)]) == 0
    assert json.loads(out.read_text(encoding="utf-8"))["at"] == [["1=x"]]
    (terrain / "ground-valid.npy").unlink()
    assert "falls" in capsys.readouterr().out

    addresses.write_text(json.dumps({"area": "t", "extent": {"width_m": 1, "height_m": 1}, "on": [], "at": []}), encoding="utf-8")
    assert main(["--terrain", str(terrain), "--addresses", str(addresses), "--out", str(out)]) == 1


def test_a_hole_in_the_measured_extent_is_its_edge():
    valid = ONES.copy()
    valid[150 - 90, 150] = False  # 90 m north of the address, inside the 100 m check disc
    assert assess(plane(0.02, 0.0), ONES, ZEROS, 150.0, 150.0, valid=valid) == {"ground": "edge"}
    far = ONES.copy()
    far[0, 0] = False
    assert assess(plane(0.02, 0.0), ONES, ZEROS, 150.0, 150.0, valid=far)["ground"] == "falls"


def test_codes_are_short_and_say_the_fall_in_half_metres():
    assert code_of({"ground": "edge"}) == "x"
    assert code_of({"ground": "unclear"}) == "u"
    assert code_of({"ground": "falls", "bearing": "south-west", "fallM": 1.5}) == "SW3"
    assert code_of({"ground": "falls", "bearing": "north", "fallM": 0.5}) == "N1"
