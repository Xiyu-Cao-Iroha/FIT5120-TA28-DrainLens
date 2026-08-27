"""Tests for the LAS reader.

A misread LAS file does not raise. It returns numbers, and they look like
coordinates. The header offsets in this reader were wrong once already — they
produced an elevation range of 1e229 metres and nothing objected — so these
tests check the values against a file whose contents are known by construction,
and the module carries a plausibility gate for the case they are not.
"""

from __future__ import annotations

import struct

import numpy as np
import pytest

from drainlens_pipeline.las import LasError, read_header, read_points

HEADER_SIZE = 227
FORMAT_LENGTHS = {0: 20, 1: 28, 2: 26, 3: 34}


def build_las(
    points: list[tuple[float, float, float]],
    *,
    point_format: int = 2,
    scale: tuple[float, float, float] = (0.001, 0.001, 0.001),
    offset: tuple[float, float, float] = (316_000.0, 5_814_000.0, 0.0),
    version: tuple[int, int] = (1, 2),
    software: str = "ContextCapture",
    count_override: int | None = None,
    record_length: int | None = None,
) -> bytes:
    """A LAS file containing exactly the given points, built to the spec."""
    length = record_length if record_length is not None else FORMAT_LENGTHS[point_format]
    header = bytearray(HEADER_SIZE)
    header[0:4] = b"LASF"
    header[24], header[25] = version
    header[58 : 58 + len(software)] = software.encode()
    struct.pack_into("<H", header, 94, HEADER_SIZE)
    struct.pack_into("<I", header, 96, HEADER_SIZE)
    header[104] = point_format
    struct.pack_into("<H", header, 105, length)
    struct.pack_into("<I", header, 107, len(points) if count_override is None else count_override)
    struct.pack_into("<ddd", header, 131, *scale)
    struct.pack_into("<ddd", header, 155, *offset)

    xs = [p[0] for p in points] or [0.0]
    ys = [p[1] for p in points] or [0.0]
    zs = [p[2] for p in points] or [0.0]
    struct.pack_into(
        "<dddddd", header, 179, max(xs), min(xs), max(ys), min(ys), max(zs), min(zs)
    )

    body = bytearray()
    for x, y, z in points:
        record = bytearray(length)
        struct.pack_into(
            "<iii",
            record,
            0,
            round((x - offset[0]) / scale[0]),
            round((y - offset[1]) / scale[1]),
            round((z - offset[2]) / scale[2]),
        )
        body += record
    return bytes(header) + bytes(body)


KENSINGTON = [
    (316_512.345, 5_814_601.5, 4.25),
    (316_700.0, 5_814_900.25, 7.125),
    (317_100.5, 5_815_400.0, 2.5),
]


class TestReadHeader:
    def test_reads_the_fields_the_terrain_build_uses(self):
        header = read_header(build_las(KENSINGTON))
        assert header.version == "1.2"
        assert header.software == "ContextCapture"
        assert header.point_format == 2
        assert header.record_length == 26
        assert header.point_count == 3
        assert header.offset_to_points == HEADER_SIZE

    def test_reads_the_bounding_box_from_the_right_offset(self):
        header = read_header(build_las(KENSINGTON))
        assert header.min_x == pytest.approx(316_512.345)
        assert header.max_x == pytest.approx(317_100.5)
        assert header.min_y == pytest.approx(5_814_601.5)
        assert header.max_y == pytest.approx(5_815_400.0)
        assert header.min_z == pytest.approx(2.5)
        assert header.max_z == pytest.approx(7.125)

    def test_reports_the_extent_it_covers(self):
        header = read_header(build_las(KENSINGTON))
        assert header.width_m == pytest.approx(588.155)
        assert header.height_m == pytest.approx(798.5)

    def test_rejects_a_file_that_is_not_las(self):
        with pytest.raises(LasError, match="signature"):
            read_header(b"PK\x03\x04" + bytes(300))

    def test_rejects_a_point_format_it_cannot_read(self):
        data = bytearray(build_las(KENSINGTON))
        data[104] = 6
        with pytest.raises(LasError, match="format 6"):
            read_header(bytes(data))

    def test_rejects_an_implausible_elevation_rather_than_returning_it(self):
        # The exact failure the wrong offsets produced. Without this gate the
        # build runs to completion on nonsense.
        data = bytearray(build_las(KENSINGTON))
        struct.pack_into("<dd", data, 179 + 32, 1e229, 1e229)
        with pytest.raises(LasError, match="not an elevation"):
            read_header(bytes(data))

    def test_rejects_a_record_too_short_to_hold_a_point(self):
        data = bytearray(build_las(KENSINGTON))
        struct.pack_into("<H", data, 105, 12)
        with pytest.raises(LasError, match="too short"):
            read_header(bytes(data))

    def test_rejects_a_non_positive_scale_factor(self):
        data = bytearray(build_las(KENSINGTON))
        struct.pack_into("<d", data, 131, 0.0)
        with pytest.raises(LasError, match="scale factor"):
            read_header(bytes(data))


class TestReadPoints:
    def test_recovers_the_coordinates_that_went_in(self):
        _, xyz = read_points(build_las(KENSINGTON))
        assert xyz.shape == (3, 3)
        assert np.allclose(xyz, np.array(KENSINGTON), atol=1e-3)

    def test_applies_the_header_offset(self):
        # Real tiles store an offset so the scaled integers stay in range;
        # ignoring it puts every point near the origin, half a world away.
        las = build_las(KENSINGTON, offset=(316_500.0, 5_814_600.0, 2.0))
        _, xyz = read_points(las)
        assert np.allclose(xyz, np.array(KENSINGTON), atol=1e-3)

    @pytest.mark.parametrize("point_format", sorted(FORMAT_LENGTHS))
    def test_reads_every_supported_format(self, point_format: int):
        _, xyz = read_points(build_las(KENSINGTON, point_format=point_format))
        assert np.allclose(xyz, np.array(KENSINGTON), atol=1e-3)

    def test_a_longer_record_does_not_shift_the_coordinates(self):
        # Extra bytes per record are legal. Reading them as coordinates is the
        # kind of mistake that yields a cloud shaped like static.
        las = build_las(KENSINGTON, point_format=2, record_length=40)
        _, xyz = read_points(las)
        assert np.allclose(xyz, np.array(KENSINGTON), atol=1e-3)

    def test_refuses_a_truncated_file_rather_than_reading_what_is_there(self):
        las = build_las(KENSINGTON, count_override=5000)
        with pytest.raises(LasError, match="only .* fit in the file"):
            read_points(las)
