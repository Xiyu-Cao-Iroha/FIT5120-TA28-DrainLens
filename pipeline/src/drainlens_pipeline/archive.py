"""Pull individual tiles out of the point-cloud archive over HTTP range requests.

The City of Melbourne publishes the 2018 point cloud as a single 4.33 GB zip.
The demonstration extent needs four of its 215 tiles — about 60 MB. S3 serves
range requests and a zip keeps its directory at the end, so the four can be
taken without the other 4.27 GB.

This is not a micro-optimisation. It is the difference between a teammate being
able to rebuild the terrain artefacts in a few minutes and having to schedule a
download, which on a six-day iteration decides whether anyone reruns the build
at all.
"""

from __future__ import annotations

import struct
import urllib.request
import zlib
from dataclasses import dataclass
from typing import Callable, Iterable

ARCHIVE_URL = (
    "https://opendatasoft-s3.s3.ap-southeast-2.amazonaws.com/attachments/CoM_Point_Cloud_2018_LAS.zip"
)

_EOCD = b"PK\x05\x06"
_EOCD64 = b"PK\x06\x06"
_CENTRAL = b"PK\x01\x02"
_LOCAL = b"PK\x03\x04"

STORED, DEFLATED = 0, 8


class ArchiveError(Exception):
    pass


@dataclass(frozen=True)
class Member:
    name: str
    method: int
    compressed_size: int
    uncompressed_size: int
    local_header_offset: int

    @property
    def stem(self) -> str:
        """Bare tile name, e.g. `Tile_+007_+015`."""
        return self.name.rsplit("/", 1)[-1].rsplit(".", 1)[0]


#: A reader is anything that returns bytes for an inclusive byte range, so tests
#: can supply an in-memory archive and never touch the network.
RangeReader = Callable[[int, int], bytes]


def http_reader(url: str = ARCHIVE_URL, timeout: float = 300.0) -> RangeReader:
    def read(start: int, end: int) -> bytes:
        request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status != 206:
                raise ArchiveError(
                    f"the server ignored the range request and returned {response.status}; "
                    "it may not support ranges, in which case the whole archive would be downloaded"
                )
            return response.read()

    return read


def http_size(url: str = ARCHIVE_URL, timeout: float = 60.0) -> int:
    request = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return int(response.headers["Content-Length"])


def _zip64_extra(extra: bytes, uncompressed: int, compressed: int, offset: int) -> tuple[int, int, int]:
    """Apply the ZIP64 extended information, which replaces only the saturated
    fields and does so in a fixed order."""
    cursor = 0
    while cursor + 4 <= len(extra):
        header_id, size = struct.unpack_from("<HH", extra, cursor)
        if header_id == 0x0001:
            body, at = extra[cursor + 4 : cursor + 4 + size], 0
            if uncompressed == 0xFFFFFFFF:
                uncompressed = struct.unpack_from("<Q", body, at)[0]
                at += 8
            if compressed == 0xFFFFFFFF:
                compressed = struct.unpack_from("<Q", body, at)[0]
                at += 8
            if offset == 0xFFFFFFFF:
                offset = struct.unpack_from("<Q", body, at)[0]
            break
        cursor += 4 + size
    return uncompressed, compressed, offset


def read_directory(read: RangeReader, total: int) -> list[Member]:
    """List the archive's members, reading only its directory."""
    tail_length = min(70_000, total)
    tail = read(total - tail_length, total - 1)

    at = tail.rfind(_EOCD)
    if at < 0:
        raise ArchiveError("no end-of-central-directory record; this is not a zip archive")

    size = struct.unpack_from("<I", tail, at + 12)[0]
    offset = struct.unpack_from("<I", tail, at + 16)[0]
    count = struct.unpack_from("<H", tail, at + 10)[0]

    # A saturated field means the real value lives in the ZIP64 record. Deciding
    # that from the fields alone, rather than from whether a ZIP64 record
    # happens to be present, is what turns a malformed archive into a clear
    # error instead of a directory read at offset 0xFFFFFFFF that returns
    # nothing and reports "0 members".
    needs_zip64 = 0xFFFFFFFF in (size, offset) or count == 0xFFFF
    if needs_zip64:
        at64 = tail.rfind(_EOCD64)
        if at64 < 0:
            raise ArchiveError("the archive needs ZIP64 but carries no ZIP64 directory record")
        count = struct.unpack_from("<Q", tail, at64 + 32)[0]
        size = struct.unpack_from("<Q", tail, at64 + 40)[0]
        offset = struct.unpack_from("<Q", tail, at64 + 48)[0]

    directory = read(offset, offset + size - 1)
    members: list[Member] = []
    cursor = 0
    while cursor + 46 <= len(directory) and directory[cursor : cursor + 4] == _CENTRAL:
        method = struct.unpack_from("<H", directory, cursor + 10)[0]
        compressed, uncompressed = struct.unpack_from("<II", directory, cursor + 20)
        name_len, extra_len, comment_len = struct.unpack_from("<HHH", directory, cursor + 28)
        header_offset = struct.unpack_from("<I", directory, cursor + 42)[0]
        name = directory[cursor + 46 : cursor + 46 + name_len].decode("utf-8", "replace")
        extra = directory[cursor + 46 + name_len : cursor + 46 + name_len + extra_len]
        if 0xFFFFFFFF in (compressed, uncompressed, header_offset):
            uncompressed, compressed, header_offset = _zip64_extra(
                extra, uncompressed, compressed, header_offset
            )
        members.append(Member(name, method, compressed, uncompressed, header_offset))
        cursor += 46 + name_len + extra_len + comment_len

    if count and len(members) != count:
        raise ArchiveError(f"directory lists {count} members but {len(members)} could be read")
    return members


def read_member(read: RangeReader, member: Member) -> bytes:
    """Fetch and decompress one member."""
    # The local header repeats the name and carries its own extra field, so the
    # data cannot start at the offset the directory records.
    header = read(member.local_header_offset, member.local_header_offset + 29)
    if header[:4] != _LOCAL:
        raise ArchiveError(f"no local header for {member.name} at the recorded offset")
    name_len, extra_len = struct.unpack_from("<HH", header, 26)
    start = member.local_header_offset + 30 + name_len + extra_len

    payload = read(start, start + member.compressed_size - 1)
    if member.method == STORED:
        data = payload
    elif member.method == DEFLATED:
        data = zlib.decompressobj(-zlib.MAX_WBITS).decompress(payload)
    else:
        raise ArchiveError(f"{member.name} uses compression method {member.method}, which is not supported")

    if len(data) != member.uncompressed_size:
        raise ArchiveError(
            f"{member.name} decompressed to {len(data):,} bytes, not the {member.uncompressed_size:,} recorded"
        )
    return data


def select(members: Iterable[Member], stems: Iterable[str]) -> list[Member]:
    """Members matching the given tile names, in the order asked for.

    Raises rather than silently returning fewer: a terrain build over three of
    four tiles would produce a plausible-looking surface with a quarter missing.
    """
    by_stem = {m.stem: m for m in members}
    wanted = list(stems)
    missing = [s for s in wanted if s not in by_stem]
    if missing:
        raise ArchiveError(f"the archive has no member for {', '.join(missing)}")
    return [by_stem[s] for s in wanted]
