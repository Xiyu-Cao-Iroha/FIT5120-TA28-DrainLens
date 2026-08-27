"""Tests for fetching an extent's tiles.

The whole of `fetch_extent` runs here against an in-memory archive, so the
network is never touched and the behaviour that matters — which tiles, how many
bytes, what gets skipped — is asserted rather than assumed.
"""

from __future__ import annotations

import io
import struct
import zipfile

import pytest

from drainlens_pipeline.archive import ArchiveError, http_reader
from drainlens_pipeline.fetch_tiles import fetch_extent, main
from drainlens_pipeline.geo import DEMONSTRATION_EXTENT, Extent

HEADER_SIZE = 227


def las_bytes(points: int = 1000, min_z: float = 1.2, max_z: float = 40.0) -> bytes:
    h = bytearray(HEADER_SIZE)
    h[0:4] = b"LASF"
    h[24], h[25] = 1, 2
    h[58:90] = b"ContextCapture".ljust(32, b"\x00")
    h[104] = 2
    struct.pack_into("<H", h, 105, 26)
    struct.pack_into("<I", h, 107, points)
    struct.pack_into("<dddddd", h, 179, 317000.0, 316500.0, 5815000.0, 5814500.0, max_z, min_z)
    return bytes(h) + bytes(range(256)) * 4


def archive_of(stems, **kw) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        for stem in stems:
            z.writestr(f"LAS/{stem}.las", las_bytes(**kw))
    return buffer.getvalue()


def reader_of(blob: bytes):
    def read(start: int, end: int) -> bytes:
        return blob[start : end + 1]

    return read


DEMO_TILES = DEMONSTRATION_EXTENT.tile_names()


def test_writes_every_tile_the_extent_needs(tmp_path):
    blob = archive_of(DEMO_TILES + ["Tile_+099_+099"])
    result = fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path)

    assert sorted(result["written"]) == sorted(DEMO_TILES)
    assert sorted(p.name for p in tmp_path.iterdir()) == sorted(f"{s}.las" for s in DEMO_TILES)
    # The tile outside the extent is left in the archive.
    assert not (tmp_path / "Tile_+099_+099.las").exists()


def test_skips_what_is_already_on_disk(tmp_path):
    blob = archive_of(DEMO_TILES)
    fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path)
    again = fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path)

    assert again["written"] == []
    assert sorted(again["skipped"]) == sorted(DEMO_TILES)
    assert again["bytes"] == 0


def test_force_re_fetches(tmp_path):
    blob = archive_of(DEMO_TILES)
    fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path)
    again = fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path, force=True)

    assert sorted(again["written"]) == sorted(DEMO_TILES)
    assert again["skipped"] == []


def test_counts_the_points_it_brought_back(tmp_path):
    blob = archive_of(DEMO_TILES, points=1_500_000)
    result = fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path)
    assert result["points"] == 4 * 1_500_000


def test_creates_the_output_directory(tmp_path):
    blob = archive_of(DEMO_TILES)
    nested = tmp_path / "data" / "pointcloud"
    fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, nested)
    assert nested.is_dir()


def test_reports_what_it_did_when_asked_to(tmp_path, capsys):
    blob = archive_of(DEMO_TILES)
    log = io.StringIO()
    fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path, log=log)
    text = log.getvalue()
    assert "kensington" in text
    assert "Tile_+007_+015" in text
    assert "never left the server" in text
    # Nothing is written to stdout; the caller decides where the log goes.
    assert capsys.readouterr().out == ""


def test_says_nothing_when_no_log_is_given(tmp_path, capsys):
    blob = archive_of(DEMO_TILES)
    fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path)
    assert capsys.readouterr().out == ""


def test_refuses_an_extent_the_archive_cannot_cover(tmp_path):
    # Three of the four tiles. A terrain build over a partly covered extent
    # would look plausible and be wrong, so this fails rather than proceeding.
    blob = archive_of(DEMO_TILES[:3])
    with pytest.raises(ArchiveError, match="Tile_"):
        fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_refuses_a_member_that_is_not_a_las_file(tmp_path):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as z:
        for stem in DEMO_TILES:
            z.writestr(f"LAS/{stem}.las", b"this is not a LAS file" * 20)
    blob = buffer.getvalue()
    with pytest.raises(ArchiveError, match="not a LAS file"):
        fetch_extent(reader_of(blob), len(blob), DEMONSTRATION_EXTENT, tmp_path)


def test_a_custom_extent_selects_its_own_tiles(tmp_path):
    one = Extent("one-tile", 316500.0, 5814500.0, 317000.0, 5815000.0)
    blob = archive_of(DEMO_TILES)
    result = fetch_extent(reader_of(blob), len(blob), one, tmp_path)
    assert result["written"] == ["Tile_+007_+015"]


class TestHttpReader:
    def test_rejects_a_server_that_ignores_the_range(self, monkeypatch):
        # If the server answers 200 it is sending the whole archive. Failing
        # here is the difference between an error and a silent 4.33 GB download.
        class Response:
            status = 200

            def read(self):  # pragma: no cover - never reached
                return b""

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        monkeypatch.setattr("urllib.request.urlopen", lambda *a, **k: Response())
        with pytest.raises(ArchiveError, match="ignored the range request"):
            http_reader("https://example.invalid/x.zip")(0, 10)

    def test_returns_the_bytes_on_a_partial_response(self, monkeypatch):
        class Response:
            status = 206

            def read(self):
                return b"abc"

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        monkeypatch.setattr("urllib.request.urlopen", lambda *a, **k: Response())
        assert http_reader("https://example.invalid/x.zip")(0, 2) == b"abc"


def test_main_wires_the_extent_to_the_fetcher(tmp_path, monkeypatch):
    blob = archive_of(DEMO_TILES)
    monkeypatch.setattr("drainlens_pipeline.fetch_tiles.http_reader", lambda url: reader_of(blob))
    monkeypatch.setattr("drainlens_pipeline.fetch_tiles.http_size", lambda url: len(blob))

    assert main(["--out", str(tmp_path)]) == 0
    assert sorted(p.stem for p in tmp_path.iterdir()) == sorted(DEMO_TILES)


def test_main_accepts_an_explicit_extent(tmp_path, monkeypatch):
    blob = archive_of(DEMO_TILES)
    monkeypatch.setattr("drainlens_pipeline.fetch_tiles.http_reader", lambda url: reader_of(blob))
    monkeypatch.setattr("drainlens_pipeline.fetch_tiles.http_size", lambda url: len(blob))

    argv = ["--out", str(tmp_path), "--extent", "316500", "5814500", "317000", "5815000"]
    assert main(argv) == 0
    assert [p.stem for p in tmp_path.iterdir()] == ["Tile_+007_+015"]
