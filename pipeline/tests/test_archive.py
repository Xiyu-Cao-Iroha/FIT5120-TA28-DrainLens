"""Tests for the ranged archive reader.

Every test builds a real zip in memory and serves it through a reader that
records which byte ranges were asked for. That keeps the suite off the network
and lets the tests assert the property the module exists for: that reading one
member does not read the whole archive.
"""

from __future__ import annotations

import io
import zipfile

import pytest

from drainlens_pipeline.archive import (
    ArchiveError,
    read_directory,
    read_member,
    select,
)


def build_zip(files: dict[str, bytes], compression: int = zipfile.ZIP_DEFLATED) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression) as z:
        for name, data in files.items():
            z.writestr(name, data)
    return buffer.getvalue()


class Recorder:
    """A range reader over bytes that remembers what it was asked for."""

    def __init__(self, blob: bytes):
        self.blob = blob
        self.ranges: list[tuple[int, int]] = []

    def __call__(self, start: int, end: int) -> bytes:
        self.ranges.append((start, end))
        return self.blob[start : end + 1]

    @property
    def bytes_read(self) -> int:
        return sum(end - start + 1 for start, end in self.ranges)


TILES = {
    "LAS/Tile_+007_+015.las": b"LASF" + b"one" * 5000,
    "LAS/Tile_+008_+015.las": b"LASF" + b"two" * 5000,
    "LAS/Tile_+007_+016.las": b"LASF" + b"three" * 5000,
}


class TestDirectory:
    def test_lists_every_member(self):
        blob = build_zip(TILES)
        read = Recorder(blob)
        members = read_directory(read, len(blob))
        assert [m.name for m in members] == list(TILES)
        assert [m.stem for m in members] == ["Tile_+007_+015", "Tile_+008_+015", "Tile_+007_+016"]

    def test_records_the_sizes_the_member_reader_needs(self):
        blob = build_zip(TILES)
        members = read_directory(Recorder(blob), len(blob))
        for m in members:
            assert m.uncompressed_size == len(TILES[m.name])
            assert 0 < m.compressed_size < m.uncompressed_size  # these compress well

    def test_the_directory_costs_the_same_whatever_the_archive_weighs(self):
        # The property the module exists for. The real archive is 4.33 GB and
        # its directory is 14 KB, so this is asserted against an archive that
        # is genuinely much larger than its own directory — a three-file
        # fixture would pass by accident.
        import os

        bulky = {f"LAS/Tile_+00{i}_+015.las": os.urandom(400_000) for i in range(4)}
        blob = build_zip(bulky, compression=zipfile.ZIP_STORED)
        assert len(blob) > 1_500_000

        read = Recorder(blob)
        members = read_directory(read, len(blob))
        assert len(members) == 4
        assert read.bytes_read < 100_000

    def test_handles_a_stored_archive(self):
        blob = build_zip(TILES, compression=zipfile.ZIP_STORED)
        members = read_directory(Recorder(blob), len(blob))
        assert all(m.compressed_size == m.uncompressed_size for m in members)

    def test_refuses_something_that_is_not_a_zip(self):
        blob = b"not a zip at all" * 100
        with pytest.raises(ArchiveError, match="not a zip"):
            read_directory(Recorder(blob), len(blob))


class TestMember:
    def test_returns_the_original_bytes(self):
        blob = build_zip(TILES)
        members = read_directory(Recorder(blob), len(blob))
        read = Recorder(blob)
        for m in members:
            assert read_member(read, m) == TILES[m.name]

    def test_reads_one_member_without_reading_the_others(self):
        blob = build_zip(TILES)
        members = read_directory(Recorder(blob), len(blob))
        read = Recorder(blob)
        one = members[0]
        read_member(read, one)
        # 30 bytes of local header plus the compressed payload, and nothing near
        # the size of the whole archive.
        assert read.bytes_read < one.compressed_size + 200

    def test_works_for_a_stored_member(self):
        blob = build_zip(TILES, compression=zipfile.ZIP_STORED)
        members = read_directory(Recorder(blob), len(blob))
        assert read_member(Recorder(blob), members[1]) == TILES[members[1].name]

    def test_refuses_a_member_whose_local_header_is_missing(self):
        blob = bytearray(build_zip(TILES))
        members = read_directory(Recorder(bytes(blob)), len(blob))
        target = members[0]
        blob[target.local_header_offset : target.local_header_offset + 4] = b"XXXX"
        with pytest.raises(ArchiveError, match="no local header"):
            read_member(Recorder(bytes(blob)), target)

    def test_refuses_an_unsupported_compression_method(self):
        blob = build_zip(TILES)
        member = read_directory(Recorder(blob), len(blob))[0]
        odd = type(member)(member.name, 99, member.compressed_size, member.uncompressed_size, member.local_header_offset)
        with pytest.raises(ArchiveError, match="compression method 99"):
            read_member(Recorder(blob), odd)

    def test_refuses_a_member_that_decompresses_to_the_wrong_size(self):
        # A truncated or tampered payload must fail loudly. A terrain build over
        # a half-read tile would produce a surface that looks fine and is not.
        blob = build_zip(TILES)
        member = read_directory(Recorder(blob), len(blob))[0]
        wrong = type(member)(member.name, member.method, member.compressed_size, 999_999, member.local_header_offset)
        with pytest.raises(ArchiveError, match="decompressed to"):
            read_member(Recorder(blob), wrong)


class TestSelect:
    def test_returns_the_tiles_asked_for_in_that_order(self):
        blob = build_zip(TILES)
        members = read_directory(Recorder(blob), len(blob))
        chosen = select(members, ["Tile_+007_+016", "Tile_+007_+015"])
        assert [m.stem for m in chosen] == ["Tile_+007_+016", "Tile_+007_+015"]

    def test_refuses_rather_than_quietly_returning_fewer(self):
        # A terrain build over three of four tiles would produce a
        # plausible-looking surface with a quarter of it missing.
        blob = build_zip(TILES)
        members = read_directory(Recorder(blob), len(blob))
        with pytest.raises(ArchiveError, match="Tile_\\+008_\\+016"):
            select(members, ["Tile_+007_+015", "Tile_+008_+016"])

class TestZip64:
    """The production archive is 4.33 GB and uses ZIP64, so this is the path
    the real data takes — and it was the last one left untested."""

    def build_zip64(self) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as z:
            for name, data in TILES.items():
                # force_zip64 makes the writer saturate the 32-bit fields and
                # emit the extended information, exactly as a >4 GB archive does.
                with z.open(name, "w", force_zip64=True) as fh:
                    fh.write(data)
        return buffer.getvalue()

    def test_reads_a_zip64_directory(self):
        blob = self.build_zip64()
        members = read_directory(Recorder(blob), len(blob))
        assert [m.stem for m in members] == ["Tile_+007_+015", "Tile_+008_+015", "Tile_+007_+016"]
        for m in members:
            assert m.uncompressed_size == len(TILES[m.name])

    def test_reads_a_member_out_of_a_zip64_archive(self):
        blob = self.build_zip64()
        members = read_directory(Recorder(blob), len(blob))
        for m in members:
            assert read_member(Recorder(blob), m) == TILES[m.name]

    def test_refuses_a_directory_that_claims_zip64_without_the_record(self):
        # A truncated or malformed archive must fail rather than read garbage
        # offsets and fetch whatever happens to be at them.
        blob = bytearray(build_zip(TILES))
        at = blob.rfind(b"PK")
        blob[at + 16 : at + 20] = (0xFFFFFFFF).to_bytes(4, "little")
        with pytest.raises(ArchiveError, match="needs ZIP64"):
            read_directory(Recorder(bytes(blob)), len(blob))
