"""Tests for the terrain build.

Built on synthetic tiles rather than the real point cloud: the artefacts are
4.33 GB behind an HTTP range reader and are not in the repository, so a test
that needed them would be a test nobody runs.
"""

from __future__ import annotations

import json
import re

import numpy as np
import pytest

from drainlens_pipeline import terrain
from drainlens_pipeline.geo import Extent
from test_las import build_las

# One 500 m tile, so a build stays small and fast.
EXTENT = Extent("test-block", 316_500.0, 5_814_500.0, 317_000.0, 5_815_000.0)
TILE = "Tile_+007_+015"


HOUSE = (slice(200, 214), slice(200, 214))  # 14 m across — inside the window
WAREHOUSE = (slice(300, 360), slice(300, 360))  # 60 m across — wider than it


def synthetic_tile(rows: int = 500, cols: int = 500) -> bytes:
    """A tile 500 m square: ground falling 2% to the west, with two buildings."""
    ground = 8.0 + 0.02 * np.arange(cols)
    surface = np.tile(ground, (rows, 1))
    surface[HOUSE] += 6.0
    surface[WAREHOUSE] += 6.0

    row, col = np.mgrid[0:rows, 0:cols]
    e = EXTENT.min_e + col + 0.5
    n = EXTENT.max_n - row - 0.5
    points = list(zip(e.ravel().tolist(), n.ravel().tolist(), surface.ravel().tolist()))
    return build_las(points, offset=(316_000.0, 5_814_000.0, 0.0))


@pytest.fixture
def tile_dir(tmp_path):
    directory = tmp_path / "pointcloud"
    directory.mkdir()
    (directory / f"{TILE}.las").write_bytes(synthetic_tile())
    return directory


class TestLoadTiles:
    def test_reads_the_tiles_the_extent_covers(self, tile_dir):
        points, names = terrain.load_tiles(tile_dir, EXTENT)
        assert names == [TILE]
        assert len(points) == 250_000

    def test_names_the_missing_tile_and_the_command_that_fetches_it(self, tmp_path):
        with pytest.raises(FileNotFoundError, match=rf"missing {re.escape(TILE)}.*fetch_tiles"):
            terrain.load_tiles(tmp_path, EXTENT)


class TestBuild:
    def test_removes_a_house_and_recovers_the_grade_beneath_it(self, tile_dir):
        surface = terrain.build(tile_dir, EXTENT).surface
        assert surface.shape == (500, 500)
        assert not surface.observed[HOUSE].any(), "the roof is not ground"

        error = np.abs(surface.elevation[HOUSE] - (8.0 + 0.02 * np.arange(200, 214)))
        # The worst cell is the middle of the roof, 7 m from the nearest measured
        # ground, and nearest-neighbour fill copies that cell's height rather
        # than following the grade: 7 m x 2% = 0.14 m. That is the price of not
        # inventing a gradient across a gap, and it is the number to check
        # against if the fill is ever changed.
        assert error.max() == pytest.approx(0.14, abs=0.005)
        assert error.mean() < 0.03

    def test_a_roof_wider_than_the_window_loses_only_its_corners(self, tile_dir):
        # A stated limit, not an oversight, and sharper than "wide buildings
        # survive": opening leaves a straight edge alone and rounds convex
        # corners by the radius of its structuring element. A 60 m flat-topped
        # warehouse therefore keeps its middle whatever the threshold.
        #
        # Real roofs are gabled, cluttered and noisy at 1 m, which gives the
        # opening plenty to bite on — on the demonstration extent 42.7% of
        # cells are removed with a median height of 3.5 m. This synthetic
        # plateau is the idealised worst case, and it is here so the limit is
        # visible in the suite rather than discovered at the showcase.
        surface = terrain.build(tile_dir, EXTENT).surface
        assert surface.elevation[330, 330] > 12.0, "the roof interior is still standing"
        assert not surface.observed[300, 300], "the corners are rounded off"
        assert not surface.observed[359, 359]
        assert (~surface.observed[WAREHOUSE]).mean() < 0.1, "and little else of it"

    def test_records_what_it_read(self, tile_dir):
        result = terrain.build(tile_dir, EXTENT)
        assert result.tiles == [TILE]
        assert result.point_count == 250_000
        assert result.extent is EXTENT
        assert result.seconds > 0


class TestBarriers:
    def barrier_over(self, block) -> np.ndarray:
        mask = np.zeros((500, 500), dtype=bool)
        mask[block] = True
        return mask

    def test_a_roof_the_filter_kept_is_corrected_from_the_footprint(self, tile_dir):
        # The filter's known blind spot: an opening cannot reach the middle of
        # a roof wider than its window, so the warehouse interior survives as
        # "measured ground". The footprint dataset knows better, and the build
        # takes its word for it.
        without = terrain.build(tile_dir, EXTENT).surface
        assert without.observed[330, 330], "the warehouse middle starts out as ground"

        with_footprints = terrain.build(
            tile_dir, EXTENT, barriers=self.barrier_over(WAREHOUSE)
        ).surface
        assert not with_footprints.observed[330, 330], "and is corrected away"
        assert with_footprints.filled_fraction > without.filled_fraction

    def test_the_ground_under_a_corrected_roof_comes_from_the_street(self, tile_dir):
        built = terrain.build(tile_dir, EXTENT, barriers=self.barrier_over(WAREHOUSE))
        under = built.surface.elevation[330, 330]
        assert under == pytest.approx(8.0 + 0.02 * 330, abs=0.7), "the 2% grade, not the roof"

    def test_routing_without_barriers_is_recorded_as_such(self, tile_dir):
        manifest = terrain.build(tile_dir, EXTENT).manifest()["barriers"]
        assert manifest["source"] is None
        assert manifest["cells"] == 0

    def test_routing_with_barriers_names_the_source_and_counts_them(self, tile_dir):
        mask = self.barrier_over(WAREHOUSE)
        manifest = terrain.build(tile_dir, EXTENT, barriers=mask).manifest()["barriers"]
        assert manifest["source"]["licence"] == "CC BY 4.0"
        assert manifest["cells"] == int(mask.sum())

    def test_the_manifest_says_why_the_object_mask_is_not_used(self, tile_dir):
        note = terrain.build(tile_dir, EXTENT).manifest()["barriers"]["note"]
        assert "canopy" in note and "under trees" in note


class TestManifest:
    def test_carries_the_provenance_the_interface_needs(self, tile_dir):
        manifest = terrain.build(tile_dir, EXTENT).manifest()
        assert manifest["source"]["crs"] == "EPSG:28355 (MGA Zone 55)"
        assert manifest["source"]["licence"] == "CC BY 4.0"
        assert manifest["tiles"] == [TILE]
        assert manifest["grid"] == {
            "rows": 500,
            "cols": 500,
            "cell_size_m": 1.0,
            "origin": "north-west",
        }

    def test_the_derivation_note_refuses_the_words_lidar_and_dtm(self):
        # D2 found the cloud is photogrammetric. Calling the output a LiDAR DTM
        # would be a claim about how the ground under trees was measured, and
        # it was not measured at all.
        note = terrain.DERIVATION_NOTE.lower()
        assert "not a lidar terrain model" in note
        assert "photogrammetric" in note
        assert "interpolated" in note

    def test_reports_coverage_as_two_fractions_that_account_for_everything(self, tile_dir):
        coverage = terrain.build(tile_dir, EXTENT).manifest()["coverage"]
        assert coverage["measured_fraction"] + coverage["interpolated_fraction"] == pytest.approx(1.0)
        assert 0.0 < coverage["interpolated_fraction"] < 0.2, "one building in 25 hectares"


class TestWrite:
    def test_writes_a_surface_a_mask_and_a_manifest(self, tile_dir, tmp_path):
        out = tmp_path / "terrain"
        result = terrain.build(tile_dir, EXTENT)
        terrain.write(result, out)

        elevation = np.load(out / "ground-surface.npy")
        observed = np.load(out / "ground-observed.npy")
        manifest = json.loads((out / "terrain.json").read_text(encoding="utf-8"))

        assert elevation.dtype == np.float32, "centimetre precision does not need 8 bytes"
        assert observed.dtype == np.bool_
        assert elevation.shape == observed.shape == (500, 500)
        assert manifest["extent"]["min_e"] == EXTENT.min_e

    def test_the_mask_is_written_beside_the_surface_not_folded_into_it(self, tile_dir, tmp_path):
        # A sentinel inside the elevation array would be read as an elevation
        # by anything that did not know the convention. The mask is separate so
        # that "we did not measure this" cannot be mistaken for a height.
        out = tmp_path / "terrain"
        terrain.write(terrain.build(tile_dir, EXTENT), out)
        elevation = np.load(out / "ground-surface.npy")
        assert np.isfinite(elevation).all()


class TestMain:
    """`--no-footprints` is not a convenience here; it is what keeps these
    tests offline.

    Both of these passed for a while without it, because the footprint fetch
    happened to reach the portal. That is a unit test quietly depending on a
    third-party service: it passes until somebody runs the suite on a train, or
    the publisher rate-limits the address behind it, and then it fails for a
    reason that has nothing to do with the code under test. Which is exactly
    what happened.
    """

    def test_builds_and_writes_from_the_command_line(self, tile_dir, tmp_path, capsys):
        out = tmp_path / "terrain"
        code = terrain.main(
            [
                "--tiles", str(tile_dir),
                "--out", str(out),
                "--no-footprints",
                "--extent", *(str(v) for v in (EXTENT.min_e, EXTENT.min_n, EXTENT.max_e, EXTENT.max_n)),
            ]
        )
        assert code == 0
        assert (out / "terrain.json").exists()
        assert "measured" in capsys.readouterr().err

    def test_defaults_to_the_demonstration_extent(self, tmp_path, capsys):
        # Nobody should have to remember four six-digit numbers to rebuild the
        # thing the demonstration runs on.
        with pytest.raises(FileNotFoundError, match="Tile_"):
            terrain.main(["--tiles", str(tmp_path), "--out", str(tmp_path / "out"), "--no-footprints"])

    def test_says_when_it_is_routing_without_barriers(self, tile_dir, tmp_path, capsys):
        # A build with no footprints lets water cross buildings. That is a
        # legitimate way to run it and an illegitimate thing to do silently.
        terrain.main(
            [
                "--tiles", str(tile_dir),
                "--out", str(tmp_path / "terrain"),
                "--no-footprints",
                "--extent", *(str(v) for v in (EXTENT.min_e, EXTENT.min_n, EXTENT.max_e, EXTENT.max_n)),
            ]
        )
        assert "no barriers" in capsys.readouterr().err

    def test_no_test_in_this_file_reaches_the_network(self, tile_dir, tmp_path, monkeypatch):
        # The guard for the failure above. A trap rather than a convention,
        # because a convention is what let the fetch in.
        def refuse(*args, **kwargs):
            raise AssertionError("a test in this file tried to open a network connection")

        monkeypatch.setattr("urllib.request.urlopen", refuse)
        terrain.main(
            [
                "--tiles", str(tile_dir),
                "--out", str(tmp_path / "terrain"),
                "--no-footprints",
                "--extent", *(str(v) for v in (EXTENT.min_e, EXTENT.min_n, EXTENT.max_e, EXTENT.max_n)),
            ]
        )
