"""The display terrain: raw ground, buildings and a hillshade that only darkens.

The shading's failures are quiet ones. A light from the wrong side draws
valleys as ridges; a north-south flip lights south-facing slopes as if they
faced the sun; a stretch that is not clamped writes bytes that wrap. Each test
below is one of those on a surface small enough to reason about by hand.
"""

from __future__ import annotations

import json

import numpy as np
import pytest

from drainlens_pipeline.scene import ELEVATION_SCALE
from drainlens_pipeline.terrain_display import (
    AMPLITUDE_MIN,
    TerrainDisplayError,
    coverage_amplitude,
    display_shade,
    hillshade,
    main,
    write,
)

SIZE = 40


def ramp_east() -> np.ndarray:
    """Ground rising towards the east: a west-facing slope."""
    return np.tile(np.arange(SIZE, dtype=np.float64) * 0.2, (SIZE, 1))


def ramp_south() -> np.ndarray:
    """Ground rising towards the south (down the rows): a north-facing slope."""
    return np.tile((np.arange(SIZE, dtype=np.float64) * 0.2)[:, None], (1, SIZE))


def test_flat_ground_is_lit_evenly():
    shade = hillshade(np.zeros((SIZE, SIZE)))
    assert np.allclose(shade, shade[0, 0])


def test_the_north_west_light_brightens_west_and_north_facing_slopes():
    # West-facing (rising east) against east-facing (rising west).
    assert hillshade(ramp_east())[20, 20] > hillshade(ramp_east()[:, ::-1])[20, 20]
    # North-facing (rising south, because row 0 is north) against south-facing.
    # Getting the row direction backwards is the flip this catches.
    assert hillshade(ramp_south())[20, 20] > hillshade(ramp_south()[::-1, :])[20, 20]


def test_shade_stays_between_zero_and_one():
    rough = np.random.default_rng(7).normal(0, 3, (SIZE, SIZE))
    shade = hillshade(rough)
    assert shade.min() >= 0.0 and shade.max() <= 1.0


def test_refuses_a_surface_that_is_not_a_grid():
    with pytest.raises(TerrainDisplayError, match="dimensional"):
        hillshade(np.zeros(SIZE))


def test_relief_is_full_strength_where_measured_and_weakened_where_not():
    assert np.allclose(coverage_amplitude(np.ones((SIZE, SIZE), dtype=bool)), 1.0)
    assert np.allclose(coverage_amplitude(np.zeros((SIZE, SIZE), dtype=bool)), AMPLITUDE_MIN)


def test_unmeasured_ground_is_pulled_towards_neutral():
    ground = np.random.default_rng(3).normal(5, 2, (SIZE, SIZE))
    buildings = np.zeros((SIZE, SIZE), dtype=bool)
    measured, _ = display_shade(ground, np.ones((SIZE, SIZE), dtype=bool), buildings)
    guessed, _ = display_shade(ground, np.zeros((SIZE, SIZE), dtype=bool), buildings)
    spread = lambda b: float(np.abs(b.astype(float) - 127.5).mean())  # noqa: E731
    assert spread(guessed) < spread(measured) * 0.5
    assert measured.dtype == np.uint8 and guessed.dtype == np.uint8


def test_the_stretch_ignores_buildings():
    ground = ramp_east()
    ground[:10, :10] = 200.0  # a cliff that is really a roof
    buildings = np.zeros((SIZE, SIZE), dtype=bool)
    buildings[:10, :10] = True
    _, with_roofs_excluded = display_shade(ground, np.ones((SIZE, SIZE), dtype=bool), buildings)
    _, flat_only = display_shade(ramp_east(), np.ones((SIZE, SIZE), dtype=bool), np.zeros((SIZE, SIZE), dtype=bool))
    assert with_roofs_excluded[1] <= flat_only[1] + 0.2


def test_refuses_mismatched_grids_and_ground_that_is_all_building():
    grid = np.zeros((SIZE, SIZE))
    with pytest.raises(TerrainDisplayError, match="measured mask"):
        display_shade(grid, np.ones((3, 3), dtype=bool), np.zeros((SIZE, SIZE), dtype=bool))
    with pytest.raises(TerrainDisplayError, match="no ground to shade"):
        display_shade(grid, np.ones((SIZE, SIZE), dtype=bool), np.ones((SIZE, SIZE), dtype=bool))


def test_writes_the_raw_ground_the_buildings_and_the_shade(tmp_path):
    ground = ramp_south() - 3.29
    buildings = np.zeros((SIZE, SIZE), dtype=bool)
    buildings[5, 7] = True
    header = write(
        tmp_path,
        ground=ground,
        measured=np.ones((SIZE, SIZE), dtype=bool),
        buildings=buildings,
        extent={"name": "t", "min_e": 316500.0, "min_n": 5814500.0, "width_m": SIZE, "height_m": SIZE},
        source={"publisher": "City of Melbourne"},
    )
    read_ground = np.frombuffer((tmp_path / "ground.bin").read_bytes(), dtype=np.int16).reshape(SIZE, SIZE)
    # Raw, not filled and not raised: the centimetres come straight back.
    assert np.allclose(read_ground / ELEVATION_SCALE, ground, atol=0.006)
    bits = np.unpackbits(np.frombuffer((tmp_path / "buildings.bin").read_bytes(), dtype=np.uint8))[: SIZE * SIZE]
    assert bits.reshape(SIZE, SIZE)[5, 7] == 1 and bits.sum() == 1
    assert (tmp_path / "shade.bin").stat().st_size == SIZE * SIZE

    on_disk = json.loads((tmp_path / "terrain.json").read_text(encoding="utf-8"))
    assert on_disk == header
    assert on_disk["artefact"] == "terrain-display" and on_disk["basis"] == "derived"
    assert on_disk["extent"]["min_e"] == 316500.0
    assert on_disk["settings"]["azimuthWeights"][0] == [315.0, 0.55]
    assert b"\r\n" not in (tmp_path / "terrain.json").read_bytes()


def test_main_builds_from_a_terrain_directory(tmp_path, capsys):
    terrain = tmp_path / "terrain"
    terrain.mkdir()
    (terrain / "terrain.json").write_text(
        json.dumps(
            {
                "extent": {"name": "t", "min_e": 0.0, "min_n": 0.0, "max_e": float(SIZE), "max_n": float(SIZE)},
                "source": {"publisher": "p"},
            }
        ),
        encoding="utf-8",
    )
    np.save(terrain / "ground-surface.npy", ramp_east().astype(np.float32))
    np.save(terrain / "ground-observed.npy", np.ones((SIZE, SIZE), dtype=bool))
    out = tmp_path / "out"
    # No barriers file: every cell is ground.
    assert main(["--terrain", str(terrain), "--out", str(out)]) == 0
    assert json.loads((out / "terrain.json").read_text(encoding="utf-8"))["extent"]["width_m"] == SIZE
    assert "hillshade stretched" in capsys.readouterr().out


def test_main_reports_a_refusal_without_a_traceback(tmp_path, capsys):
    terrain = tmp_path / "terrain"
    terrain.mkdir()
    (terrain / "terrain.json").write_text(
        json.dumps({"extent": {"name": "t", "min_e": 0.0, "min_n": 0.0, "max_e": 4.0, "max_n": 4.0}}),
        encoding="utf-8",
    )
    np.save(terrain / "ground-surface.npy", np.zeros((4, 4), dtype=np.float32))
    np.save(terrain / "ground-observed.npy", np.ones((3, 3), dtype=bool))
    assert main(["--terrain", str(terrain), "--out", str(tmp_path / "out")]) == 1
    assert "measured mask" in capsys.readouterr().err
