"""The council terrain tiles: the ramp, the seams, and a small build end to end."""

from __future__ import annotations

import io
import json

import numpy as np
from PIL import Image

from drainlens_pipeline.geo import TILE_ORIGIN_E, TILE_ORIGIN_N
from drainlens_pipeline.terrain_tiles import (
    BUILDING_RGB,
    RAMP,
    build,
    clip_polyline,
    encode_line,
    fill_invalid,
    main,
    ramp_colour,
    shade_grey,
    tile_contours,
)


def test_the_ramp_draws_every_node_in_the_colour_card_colour():
    heights = np.array([m for m, _ in RAMP])
    drawn = ramp_colour(heights)
    for (_, hex_colour), rgb in zip(RAMP, drawn):
        card = [int(hex_colour[i : i + 2], 16) for i in (1, 3, 5)]
        assert np.abs(rgb.astype(int) - card).max() <= 1


def test_the_ramp_clamps_and_survives_nan():
    below, above, nan = ramp_colour(np.array([-15.6, 173.8, np.nan]))
    assert (below == ramp_colour(np.array([0.0]))[0]).all()
    assert (above == ramp_colour(np.array([40.0]))[0]).all()
    assert (nan == below).all()


def test_the_shade_is_a_multiply_factor_and_white_on_buildings():
    grey = shade_grey(np.array([0.0, 1.0, 0.5]), np.array([False, False, True]))
    assert grey.tolist() == [207, 255, 255]


def test_invalid_cells_take_their_nearest_valid_value():
    values = np.array([[1.0, 2.0, 99.0], [4.0, 5.0, 99.0]])
    valid = np.array([[True, True, False], [True, True, False]])
    assert fill_invalid(values, valid).tolist() == [[1.0, 2.0, 2.0], [4.0, 5.0, 5.0]]
    assert fill_invalid(values, np.ones_like(valid)) is values


def test_a_polyline_is_cut_where_it_leaves_the_box_and_rejoins_where_it_returns():
    line = [(-5.0, 5.0), (5.0, 5.0), (15.0, 5.0), (15.0, 8.0), (5.0, 8.0)]
    pieces = clip_polyline(line, (0.0, 0.0, 10.0, 10.0))
    assert pieces == [[(0.0, 5.0), (5.0, 5.0), (10.0, 5.0)], [(10.0, 8.0), (5.0, 8.0)]]
    assert clip_polyline([(20.0, 20.0), (30.0, 30.0)], (0.0, 0.0, 10.0, 10.0)) == []


def test_a_contour_crossing_a_seam_is_kept_on_both_sides_in_grid_metres():
    # Ground rising east across a 40-cell block; the tile is its east half.
    block = np.tile(np.arange(40, dtype=np.float64) * 0.5, (40, 1))
    west = tile_contours(block, block_origin=(0, 0), grid_rows=40, inner=(0.0, 0.0, 20.0, 40.0))
    east = tile_contours(block, block_origin=(0, 0), grid_rows=40, inner=(20.0, 0.0, 40.0, 40.0))
    assert {line["m"] for line in west} and {line["m"] for line in east}
    for line in east:
        d = line["d"]
        e, n = d[0], d[1]
        points = [(e, n)]
        for i in range(2, len(d), 2):
            e, n = e + d[i], n + d[i + 1]
            points.append((e, n))
        assert all(40 <= pe <= 80 and 0 <= pn <= 80 for pe, pn in points)  # half-metres


def test_contours_are_half_metre_steps_that_add_back_up():
    assert encode_line([(10.2, 20.0), (10.3, 20.1), (12.0, 21.0), (12.0, 21.0)]) == [20, 40, 1, 0, 3, 2]


def _grid(size: int = 1000):
    ground = np.tile(np.linspace(0.0, 12.0, size, dtype=np.float32), (size, 1))
    measured = np.ones((size, size), dtype=bool)
    buildings = np.zeros((size, size), dtype=bool)
    buildings[600:620, 100:140] = True
    valid = np.ones((size, size), dtype=bool)
    valid[:500, 500:] = False  # the north-east tile is not in the archive
    return ground, measured, buildings, valid


def test_a_small_build_writes_tiles_an_overview_and_an_index(tmp_path):
    ground, measured, buildings, valid = _grid()
    extent = {"name": "t", "min_e": TILE_ORIGIN_E, "min_n": TILE_ORIGIN_N, "width_m": 1000, "height_m": 1000}
    index = build(
        tmp_path,
        ground=ground,
        measured=measured,
        buildings=buildings,
        valid=valid,
        roads=np.zeros(ground.shape, dtype=bool),
        extent=extent,
        tiles=[(0, 0), (1, 0), (0, 1)],
        source={"publisher": "p"},
    )
    assert [t["tile"] for t in index["tiles"]] == ["Tile_+000_+000", "Tile_+001_+000", "Tile_+000_+001"]
    assert index["tiles"][2]["n"] == 500.0 and index["tiles"][1]["e"] == 500.0

    colour = Image.open(io.BytesIO((tmp_path / "Tile_+000_+000" / "colour.webp").read_bytes()))
    shade = Image.open(io.BytesIO((tmp_path / "Tile_+000_+000" / "shade.webp").read_bytes()))
    assert colour.size == (500, 500) and colour.mode == "RGB"
    # WebP has no greyscale mode; the grey comes back as three equal channels.
    assert shade.size == (500, 500)
    grey = np.array(shade.convert("RGB")).astype(int)
    assert np.abs(grey[..., 0] - grey[..., 2]).max() <= 3
    # The building in the south-west tile is grey, within compression error.
    pixel = np.array(colour)[110, 120].astype(int)
    assert np.abs(pixel - BUILDING_RGB).max() <= 12

    marks = json.loads((tmp_path / "Tile_+000_+000" / "marks.json").read_text(encoding="utf-8"))
    assert marks["contours"] and marks["spots"]
    # A spot square belongs to the tile its corner is in, and may run up to
    # one square (80 m) past the tile's east or south edge.
    assert all(0 <= p["e"] <= 580 and -80 <= p["n"] <= 500 for p in marks["spots"])

    overview = Image.open(io.BytesIO((tmp_path / "overview-colour.webp").read_bytes()))
    assert overview.size == (250, 250) and overview.mode == "RGBA"
    alpha = np.array(overview)[..., 3]
    assert alpha[:125, 125:].max() < 128 and alpha[125:, :125].min() > 128

    on_disk = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert on_disk["artefact"] == "terrain-tiles" and on_disk["overview"]["cellM"] == 4
    assert b"\r\n" not in (tmp_path / "index.json").read_bytes()


def test_main_builds_from_a_terrain_directory_and_refuses_another_frame(tmp_path, capsys):
    ground, measured, buildings, valid = _grid()
    terrain = tmp_path / "terrain"
    terrain.mkdir()
    for name, array in (
        ("ground-surface.npy", ground),
        ("ground-observed.npy", measured),
        ("barriers.npy", buildings),
        ("ground-valid.npy", valid),
    ):
        np.save(terrain / name, array)
    manifest = {
        "extent": {"name": "t", "min_e": TILE_ORIGIN_E, "min_n": TILE_ORIGIN_N, "max_e": TILE_ORIGIN_E + 1000, "max_n": TILE_ORIGIN_N + 1000},
        "tiles": ["Tile_+000_+000"],
        "source": {"publisher": "p"},
    }
    (terrain / "terrain.json").write_text(json.dumps(manifest), encoding="utf-8")
    geometry = tmp_path / "map.json"
    geometry.write_text(json.dumps({"extent": {"min_e": TILE_ORIGIN_E, "min_n": TILE_ORIGIN_N}, "layers": {"road": []}}), encoding="utf-8")
    out = tmp_path / "out"
    assert main(["--terrain", str(terrain), "--map", str(geometry), "--out", str(out)]) == 0
    assert (out / "Tile_+000_+000" / "colour.webp").exists()
    assert "tiles" in capsys.readouterr().out

    geometry.write_text(json.dumps({"extent": {"min_e": 0, "min_n": 0}, "layers": {}}), encoding="utf-8")
    assert main(["--terrain", str(terrain), "--map", str(geometry), "--out", str(out)]) == 1
