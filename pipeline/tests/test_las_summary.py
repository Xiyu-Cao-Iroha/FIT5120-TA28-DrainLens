"""Tests for the LAS header summary.

These exist because of a real defect. The first version read the bounding
values at offset 227 and 235, which is past the end of a LAS 1.2 public header,
so it reinterpreted the first point record as a pair of doubles and reported an
elevation range of 1e229 metres. It printed once, looked obviously wrong to a
human, and nothing in the code objected.
"""

from __future__ import annotations

import struct

import pytest

from drainlens_pipeline.archive import ArchiveError
from drainlens_pipeline.fetch_tiles import las_summary

HEADER_SIZE = 227


def las_header(
    min_z: float,
    max_z: float,
    *,
    points: int = 1000,
    version: tuple[int, int] = (1, 2),
    trailing: int = 100,
) -> bytes:
    """A LAS public header block with the bounding values in their real places."""
    h = bytearray(HEADER_SIZE)
    h[0:4] = b"LASF"
    h[24], h[25] = version
    h[58:90] = b"ContextCapture".ljust(32, b"\x00")
    h[104] = 2  # point data record format
    struct.pack_into("<H", h, 105, 26)  # record length
    struct.pack_into("<I", h, 107, points)
    # max X, min X, max Y, min Y, max Z, min Z — a 500 m tile
    struct.pack_into("<dddddd", h, 179, 317000.0, 316500.0, 5815000.0, 5814500.0, max_z, min_z)
    # Something after the header, so a wrong offset has bytes to misread.
    return bytes(h) + bytes(range(256)) * (trailing // 256 + 1)


def test_reads_the_bounding_values_from_the_header():
    s = las_summary(las_header(1.44, 41.13, points=1_551_045))
    assert s["version"] == "1.2"
    assert s["software"] == "ContextCapture"
    assert s["format"] == 2
    assert s["points"] == 1_551_045
    assert s["min_z"] == pytest.approx(1.44)
    assert s["max_z"] == pytest.approx(41.13)
    assert s["width_m"] == pytest.approx(500.0)
    assert s["height_m"] == pytest.approx(500.0)


def test_accepts_ground_below_sea_level():
    # Parts of Southbank and the Kensington flats sit just below zero AHD.
    s = las_summary(las_header(-3.65, 19.40))
    assert s["min_z"] == pytest.approx(-3.65)


@pytest.mark.parametrize(
    "min_z,max_z",
    [
        (1.4e229, 1.4e229),  # the original defect
        (-500.0, 40.0),  # implausibly deep
        (1.0, 5000.0),  # implausibly high for Melbourne
        (40.0, 1.0),  # inverted
    ],
)
def test_refuses_a_z_range_that_is_not_an_elevation(min_z, max_z):
    with pytest.raises(ArchiveError, match="not an elevation"):
        las_summary(las_header(min_z, max_z))


def test_refuses_something_that_is_not_a_las_file():
    with pytest.raises(ArchiveError, match="not a LAS file"):
        las_summary(b"PK\x03\x04" + bytes(400))
