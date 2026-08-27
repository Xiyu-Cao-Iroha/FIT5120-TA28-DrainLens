"""Read LAS point records into arrays.

Only what this project needs: the public header and X, Y, Z. The City of
Melbourne tiles are LAS 1.2 point data record format 2 — coordinates and RGB,
no GPS time — but formats 0 to 3 all place X, Y and Z in the same first twelve
bytes, so all four are read the same way.

Deliberately not a general LAS library. It reads the fields the terrain build
uses and refuses anything it does not understand, rather than returning
plausible numbers from a file it has misread.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np

#: Formats 0-3 share a header layout for X, Y, Z. Formats 6-10 rearrange the
#: bytes after them but not those, though they are not expected here.
_SUPPORTED_FORMATS = frozenset({0, 1, 2, 3})

#: Melbourne is between roughly -20 m and 400 m AHD. Anything outside this
#: means the header was read at the wrong offset.
_PLAUSIBLE_Z = (-100.0, 1000.0)


class LasError(Exception):
    pass


@dataclass(frozen=True)
class LasHeader:
    version: str
    software: str
    point_format: int
    record_length: int
    point_count: int
    offset_to_points: int
    scale: tuple[float, float, float]
    offset: tuple[float, float, float]
    min_x: float
    max_x: float
    min_y: float
    max_y: float
    min_z: float
    max_z: float

    @property
    def width_m(self) -> float:
        return self.max_x - self.min_x

    @property
    def height_m(self) -> float:
        return self.max_y - self.min_y


def read_header(data: bytes | memoryview) -> LasHeader:
    if bytes(data[:4]) != b"LASF":
        raise LasError("not a LAS file: the signature is missing")

    point_format = data[104]
    if point_format not in _SUPPORTED_FORMATS:
        raise LasError(
            f"point data record format {point_format} is not supported; this project reads formats 0-3"
        )

    record_length = struct.unpack_from("<H", data, 105)[0]
    offset_to_points = struct.unpack_from("<I", data, 96)[0]
    count = struct.unpack_from("<I", data, 107)[0]
    scale = struct.unpack_from("<ddd", data, 131)
    offset = struct.unpack_from("<ddd", data, 155)
    max_x, min_x, max_y, min_y, max_z, min_z = struct.unpack_from("<dddddd", data, 179)

    low, high = _PLAUSIBLE_Z
    if not (low < min_z <= max_z < high):
        raise LasError(f"the header reports Z from {min_z:g} to {max_z:g}, which is not an elevation")
    if record_length < 20:
        raise LasError(f"a record length of {record_length} is too short to hold a point")
    if any(s <= 0 for s in scale):
        raise LasError(f"the header reports a non-positive scale factor {scale}")

    return LasHeader(
        version=f"{data[24]}.{data[25]}",
        software=bytes(data[58:90]).rstrip(b"\x00 ").decode("latin-1", "replace"),
        point_format=point_format,
        record_length=record_length,
        point_count=count,
        offset_to_points=offset_to_points,
        scale=scale,
        offset=offset,
        min_x=min_x,
        max_x=max_x,
        min_y=min_y,
        max_y=max_y,
        min_z=min_z,
        max_z=max_z,
    )


def read_points(data: bytes | memoryview) -> tuple[LasHeader, np.ndarray]:
    """Return the header and an (n, 3) array of X, Y, Z in the file's own CRS."""
    header = read_header(data)
    start = header.offset_to_points
    available = (len(data) - start) // header.record_length
    if available < header.point_count:
        raise LasError(
            f"the header claims {header.point_count:,} points but only {available:,} fit in the file"
        )

    raw = np.frombuffer(
        data,
        dtype=np.dtype([("xyz", "<i4", 3), ("rest", "V", header.record_length - 12)]),
        count=header.point_count,
        offset=start,
    )
    xyz = raw["xyz"].astype(np.float64)
    xyz *= np.asarray(header.scale)
    xyz += np.asarray(header.offset)
    return header, xyz


def read_file(path: Path) -> tuple[LasHeader, np.ndarray]:
    return read_points(path.read_bytes())
