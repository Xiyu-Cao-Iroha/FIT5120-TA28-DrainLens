"""Contours and spot heights on surfaces small enough to check by hand."""

from __future__ import annotations

import json
import math

import numpy as np
import pytest
from scipy import ndimage

from drainlens_pipeline.terrain_marks import (
    SPOT_TILE_M,
    TerrainMarksError,
    contour_level,
    contours,
    main,
    road_mask,
    spot_heights,
    write,
)


def plane_east(size: int = 20) -> np.ndarray:
    """Ground rising 1 m per cell towards the east."""
    return np.tile(np.arange(size, dtype=np.float64), (size, 1))


def test_a_level_crosses_a_plane_where_it_should():
    lines = contour_level(plane_east(), 5.5)
    assert len(lines) == 1
    xs = {round(e, 6) for e, _ in lines[0]}
    # Cell centres are at half-metres, so 5.5 m lies halfway between columns 5 and 6: e = 6.0.
    assert xs == {6.0}
    ns = sorted(n for _, n in lines[0])
    assert ns[0] == pytest.approx(0.5) and ns[-1] == pytest.approx(19.5)


def test_a_hill_gives_one_closed_ring():
    yy, xx = np.mgrid[0:30, 0:30]
    hill = 10 * np.exp(-((xx - 15) ** 2 + (yy - 15) ** 2) / 40.0)
    rings = contour_level(hill, 5.0)
    assert len(rings) == 1
    assert rings[0][0] == rings[0][-1]
    # Every vertex is on the level, to the linear interpolation.
    centre = (15.5, 30 - 15.5)
    radii = [math.dist(p, centre) for p in rings[0]]
    assert max(radii) - min(radii) < 1.0


def test_contours_are_whole_metres_long_enough_and_flag_every_fifth():
    ground = np.tile(np.linspace(0, 12, 120), (120, 1))
    lines = contours(ground)
    levels = sorted({line["m"] for line in lines})
    assert levels == [float(m) for m in range(1, 12)]
    assert all(line["major"] == (line["m"] % 5 == 0) for line in lines)
    assert all(len(line["c"]) >= 2 for line in lines)


def test_contours_drop_rings_too_short_to_be_ground_rather_than_noise():
    ground = np.zeros((60, 60))
    ground[30, 30] = 50.0  # one spiked cell smooths to a bump a few metres across
    # Its 1 m ring is about 15 m round, under the 25 m a contour must be.
    assert contour_level(ndimage.gaussian_filter(ground, 2.0), 1.0)
    assert contours(ground) == []


def test_road_mask_fills_the_polygon_in_local_metres():
    roads = [{"c": [[[2, 2], [8, 2], [8, 4], [2, 4]]]}]
    mask = road_mask(roads, 10, 10)
    # Northing 2-4 m is rows 6-7 when row 0 is the northern edge (north 9.5).
    assert mask[6:8, 2:8].all()
    assert mask.sum() == 12
    assert not road_mask([{"c": [[[50, 50], [60, 50], [60, 60]]]}], 10, 10).any()


def spots_on(ground, **over):
    rows, cols = ground.shape
    measured = over.get("measured", np.ones((rows, cols), dtype=bool))
    buildings = over.get("buildings", np.zeros((rows, cols), dtype=bool))
    roads = over.get("roads", np.zeros((rows, cols), dtype=bool))
    return spot_heights(ground, measured, buildings, roads)


def test_three_tiers_per_square_with_stable_ids_and_half_metre_heights():
    ground = np.tile(np.linspace(1.0, 9.0, SPOT_TILE_M), (SPOT_TILE_M, 1))
    points = spots_on(ground)
    assert [p["id"] for p in points] == ["sp-000-000-a", "sp-000-000-b", "sp-000-000-c"]
    heights = [p["heightM"] for p in points]
    assert heights == sorted(heights)
    assert all((h * 2) == round(h * 2) for h in heights)
    assert all(0 <= p["e"] <= SPOT_TILE_M and 0 <= p["n"] <= SPOT_TILE_M for p in points)


def test_a_flat_square_keeps_one_point_rather_than_three_that_say_the_same():
    points = spots_on(np.full((SPOT_TILE_M, SPOT_TILE_M), 2.5))
    assert [p["tier"] for p in points] == ["a"]


def test_no_point_on_a_building_a_road_or_ground_nobody_measured():
    size = SPOT_TILE_M
    ground = np.tile(np.linspace(1.0, 9.0, size), (size, 1))
    buildings = np.zeros((size, size), dtype=bool)
    buildings[:, : size // 2] = True
    roads = np.zeros((size, size), dtype=bool)
    roads[: size // 2, :] = True
    for p in spots_on(ground, buildings=buildings, roads=roads):
        row, col = int(size - p["n"]), int(p["e"])
        assert not buildings[row, col] and not roads[row, col]
    assert spots_on(ground, measured=np.zeros((size, size), dtype=bool)) == []


def test_refuses_grids_of_different_shapes():
    with pytest.raises(TerrainMarksError, match="same shape"):
        spot_heights(np.zeros((4, 4)), np.ones((4, 4), dtype=bool), np.zeros((3, 3), dtype=bool), np.zeros((4, 4), dtype=bool))


def _terrain_dir(tmp_path, *, map_min_e=0.0):
    terrain = tmp_path / "terrain"
    terrain.mkdir()
    size = SPOT_TILE_M
    (terrain / "terrain.json").write_text(
        json.dumps({"extent": {"name": "t", "min_e": 0.0, "min_n": 0.0, "max_e": float(size), "max_n": float(size)}}),
        encoding="utf-8",
    )
    np.save(terrain / "ground-surface.npy", np.tile(np.linspace(0.0, 12.0, size), (size, 1)).astype(np.float32))
    np.save(terrain / "ground-observed.npy", np.ones((size, size), dtype=bool))
    geometry = tmp_path / "map.json"
    geometry.write_text(
        json.dumps({"extent": {"min_e": map_min_e, "min_n": 0.0}, "layers": {"road": [{"c": [[[0, 0], [10, 0], [10, 3], [0, 3]]]}]}}),
        encoding="utf-8",
    )
    return terrain, geometry


def test_main_writes_both_artefacts(tmp_path, capsys):
    terrain, geometry = _terrain_dir(tmp_path)
    out = tmp_path / "out"
    assert main(["--terrain", str(terrain), "--map", str(geometry), "--out", str(out)]) == 0
    lines = json.loads((out / "terrain-contours.json").read_text(encoding="utf-8"))
    spots = json.loads((out / "spot-heights.json").read_text(encoding="utf-8"))
    assert lines["artefact"] == "terrain-contours" and lines["lines"]
    assert spots["artefact"] == "spot-heights" and spots["points"]
    assert b"\r\n" not in (out / "spot-heights.json").read_bytes()
    assert "spot heights" in capsys.readouterr().out


def test_main_refuses_a_map_in_another_frame(tmp_path, capsys):
    terrain, geometry = _terrain_dir(tmp_path, map_min_e=1500.0)
    assert main(["--terrain", str(terrain), "--map", str(geometry), "--out", str(tmp_path / "out")]) == 1
    assert "frame" in capsys.readouterr().err


def test_write_returns_what_it_wrote(tmp_path):
    ground = np.tile(np.linspace(0.0, 6.0, SPOT_TILE_M), (SPOT_TILE_M, 1))
    ones = np.ones(ground.shape, dtype=bool)
    zeros = np.zeros(ground.shape, dtype=bool)
    extent = {"name": "t", "min_e": 0.0, "min_n": 0.0, "width_m": SPOT_TILE_M, "height_m": SPOT_TILE_M}
    lines, spots = write(tmp_path, ground=ground, measured=ones, buildings=zeros, roads=zeros, extent=extent)
    assert json.loads((tmp_path / "terrain-contours.json").read_text(encoding="utf-8")) == lines
    assert spots["settings"]["tileM"] == SPOT_TILE_M
