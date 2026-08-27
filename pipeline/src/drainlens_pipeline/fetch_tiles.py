"""Fetch the point-cloud tiles an extent needs.

    python -m drainlens_pipeline.fetch_tiles --out ../data/pointcloud

Defaults to the Iteration 1 demonstration extent, so a teammate who wants to
rebuild the terrain runs one command with no arguments and gets four tiles
rather than a 4.33 GB download.

The work is split from the network on purpose: `fetch_extent` takes a range
reader, so the whole of it is exercised against an in-memory archive in the
tests and only `main` knows about HTTP.
"""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path
from typing import Sequence, TextIO

from .archive import (
    ARCHIVE_URL,
    ArchiveError,
    RangeReader,
    http_reader,
    http_size,
    read_directory,
    read_member,
    select,
)
from .geo import DEMONSTRATION_ADDRESS, DEMONSTRATION_EXTENT, Extent

#: Melbourne sits between roughly -20 m and 400 m AHD. Anything outside this is
#: not an elevation, and saying so early is what stops a misread header being
#: printed once and believed.
PLAUSIBLE_Z = (-100.0, 1000.0)


def las_summary(data: bytes) -> dict[str, object]:
    """The header fields worth printing back, so a bad fetch is obvious."""
    if data[:4] != b"LASF":
        raise ArchiveError("the fetched member is not a LAS file")
    # Public header block: the six bounding values run max X, min X, max Y,
    # min Y, max Z, min Z from offset 179. Reading past 227 leaves the LAS 1.2
    # header entirely and returns point-record bytes reinterpreted as a double.
    max_x, min_x, max_y, min_y, max_z, min_z = struct.unpack_from("<dddddd", data, 179)
    low, high = PLAUSIBLE_Z
    if not (low < min_z <= max_z < high):
        raise ArchiveError(
            f"the LAS header reports Z from {min_z:g} to {max_z:g}, which is not an elevation"
        )
    return {
        "version": f"{data[24]}.{data[25]}",
        "software": data[58:90].rstrip(b"\x00 ").decode("latin-1", "replace"),
        "format": data[104],
        "points": struct.unpack_from("<I", data, 107)[0],
        "min_z": min_z,
        "max_z": max_z,
        "width_m": max_x - min_x,
        "height_m": max_y - min_y,
    }


def fetch_extent(
    read: RangeReader,
    total: int,
    extent: Extent,
    out: Path,
    *,
    force: bool = False,
    log: TextIO | None = None,
) -> dict[str, object]:
    """Write every tile the extent needs into `out`, skipping what is already there."""
    say = (lambda m: print(m, file=log)) if log is not None else (lambda m: None)

    names = extent.tile_names()
    say(
        f"extent    {extent.name}: {extent.min_e:,.0f}–{extent.max_e:,.0f} E  "
        f"{extent.min_n:,.0f}–{extent.max_n:,.0f} N  "
        f"({extent.width_m:,.0f} × {extent.height_m:,.0f} m)"
    )
    say(f"tiles     {', '.join(names)}\n")
    say(f"archive   {total / 1e9:.2f} GB — reading its directory only")

    members = read_directory(read, total)
    say(f"          {len(members)} members\n")

    wanted = select(members, names)
    out.mkdir(parents=True, exist_ok=True)

    fetched_bytes, written, skipped, points = 0, [], [], 0
    for member in wanted:
        target = out / f"{member.stem}.las"
        if target.exists() and not force:
            skipped.append(member.stem)
            say(f"  {member.stem}  already on disk, skipping")
            continue
        data = read_member(read, member)
        summary = las_summary(data)
        target.write_bytes(data)
        fetched_bytes += member.compressed_size
        written.append(member.stem)
        points += int(summary["points"])
        say(
            f"  {member.stem}  {member.compressed_size / 1e6:5.1f} MB over the wire → "
            f"{len(data) / 1e6:5.1f} MB   {summary['points']:>9,} points   "
            f"Z {summary['min_z']:6.2f}..{summary['max_z']:7.2f}   "
            f"LAS {summary['version']} fmt {summary['format']}"
        )

    if fetched_bytes and total:
        say(
            f"\nfetched {fetched_bytes / 1e6:.1f} MB of a {total / 1e9:.2f} GB archive "
            f"— {(total - fetched_bytes) / total:.1%} of it never left the server"
        )
    return {"written": written, "skipped": skipped, "bytes": fetched_bytes, "points": points}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fetch point-cloud tiles for a build extent")
    parser.add_argument("--out", type=Path, required=True, help="directory to write .las files into")
    parser.add_argument("--url", default=ARCHIVE_URL)
    parser.add_argument(
        "--extent",
        nargs=4,
        type=float,
        metavar=("MIN_E", "MIN_N", "MAX_E", "MAX_N"),
        help="MGA55 bounds; defaults to the demonstration extent",
    )
    parser.add_argument("--force", action="store_true", help="re-fetch tiles already on disk")
    args = parser.parse_args(argv)

    extent = Extent("custom", *args.extent) if args.extent else DEMONSTRATION_EXTENT
    if extent is DEMONSTRATION_EXTENT:
        print(f"address   {DEMONSTRATION_ADDRESS}", file=sys.stderr)

    fetch_extent(
        http_reader(args.url),
        http_size(args.url),
        extent,
        args.out,
        force=args.force,
        log=sys.stderr,
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
