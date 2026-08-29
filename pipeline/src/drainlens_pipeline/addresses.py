"""The address index that ships with the site.

Every keystroke of somebody's home address would otherwise be sent to a server
to be looked up. AD1 says this product has no identity and wants none, so the
index travels to the browser instead of the query travelling to us.

That constrains what goes in it. Only the fields a search and a map pin need:
the label to show, the parts to match on, and where it is. No owner, no
parcel identifier, no valuation, nothing that would make the file worth
holding for a reason other than finding a street.

The index is also the pilot boundary. An address in it is covered; an address
on one of its streets but not in it is a real place the pilot does not reach;
anything else is a query this product cannot speak about at all. AC 1.1.4 turns
on telling those three apart, so the streets are listed separately rather than
being recovered by scanning every label at run time.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Callable, Iterable

from .geo import Extent, from_mga55, to_mga55

DATASET = "property-boundaries"
BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"

SOURCE = {
    "dataset": "Property boundaries",
    "publisher": "City of Melbourne Open Data Portal",
    "licence": "CC BY 4.0",
    "dataset_id": DATASET,
}

#: Fields taken from each record, and nothing else.
#:
#: The published dataset carries far more. Everything not needed to find a
#: street and drop a pin is left behind at build time rather than shipped and
#: ignored — a field that never leaves the pipeline cannot leak from the
#: browser.
KEPT = ("street_number", "street_name", "street_type", "suburb")


class AddressError(Exception):
    pass


@dataclass(frozen=True)
class Address:
    id: str
    label: str
    number: str
    street: str
    suburb: str
    e: float
    n: float

    def as_json(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "number": self.number,
            "street": self.street,
            "suburb": self.suburb,
            "e": round(self.e, 1),
            "n": round(self.n, 1),
        }


def _title(text: str) -> str:
    """Title case that leaves the parts people write in capitals alone."""
    return " ".join(
        word if word.isupper() and len(word) <= 3 else word.capitalize()
        for word in text.split()
    )


def convert(records: Iterable[dict], extent: Extent) -> list[Address]:
    """Published records to indexed addresses, clipped to the extent."""
    found: list[Address] = []
    seen: set[str] = set()

    for record in records:
        point = record.get("geo_point_2d") or {}
        latitude, longitude = point.get("lat"), point.get("lon")
        if latitude is None or longitude is None:
            continue

        easting, northing = to_mga55(float(latitude), float(longitude))
        if not extent.contains(easting, northing):
            continue

        number = str(record.get("street_number") or "").strip()
        name = str(record.get("street_name") or "").strip()
        kind = str(record.get("street_type") or "").strip()
        suburb = str(record.get("suburb") or "").strip()
        if not number or not name:
            continue

        street = _title(f"{name} {kind}".strip())
        suburb = _title(suburb)
        label = f"{number} {street}, {suburb}" if suburb else f"{number} {street}"

        # One pin per address. The source has a record per parcel, and a block
        # of flats is many parcels at one street number.
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)

        found.append(
            Address(
                id=f"{extent.name}/{key.replace(' ', '-').replace(',', '')}",
                label=label,
                number=number,
                street=street,
                suburb=suburb,
                e=easting - extent.min_e,
                n=northing - extent.min_n,
            )
        )

    found.sort(key=lambda a: (a.street, len(a.number), a.number))
    return found


def fetch(
    extent: Extent,
    *,
    opener: Callable[[str], bytes] | None = None,
    timeout: float = 300.0,
) -> list[Address]:
    """Every address inside the extent, as the index will carry it."""
    south, west = from_mga55(extent.min_e, extent.min_n)
    north, east = from_mga55(extent.max_e, extent.max_n)
    where = urllib.parse.quote(f"in_bbox(geo_point_2d, {south}, {west}, {north}, {east})")
    url = f"{BASE}/{DATASET}/exports/json?where={where}"

    if opener is None:

        def opener(target: str) -> bytes:
            with urllib.request.urlopen(target, timeout=timeout) as response:
                return response.read()

    payload = json.loads(opener(url))
    records = payload if isinstance(payload, list) else payload.get("results", [])
    return convert(records, extent)


def build(extent: Extent, addresses: list[Address]) -> dict:
    """The artefact, with the street list the boundary check needs."""
    if not addresses:
        raise AddressError(
            "the index is empty; without it every address is 'not an address' and "
            "the pilot boundary cannot be told from a typing mistake"
        )

    streets = sorted({address.street for address in addresses})
    return {
        "artefact": "address-index",
        "version": 1,
        "area": extent.name,
        "extent": {
            "min_e": extent.min_e,
            "min_n": extent.min_n,
            "width_m": extent.width_m,
            "height_m": extent.height_m,
        },
        "coordinates": (
            "Metres east and north of the extent's south-west corner — the same frame as "
            "the map geometry, so a search result is already a map position."
        ),
        "source": SOURCE,
        "note": (
            "This index is the pilot boundary. An address in it is covered; an address on "
            "one of these streets but not in it is a real place the pilot does not reach; "
            "anything else is outside what this product can speak about. It carries only "
            "what a search and a pin need, and travels to the browser so that no address "
            "typed into the search box is ever sent anywhere."
        ),
        "streets": streets,
        "addresses": [address.as_json() for address in addresses],
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys
    from pathlib import Path

    from .geo import DEMONSTRATION_EXTENT

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.addresses",
        description="Build the address index that ships with the site.",
    )
    parser.add_argument("--out", type=Path, default=Path("../data/map/addresses.json"))
    args = parser.parse_args(argv)

    def log(message: str) -> None:
        print(message, file=sys.stderr)

    extent = DEMONSTRATION_EXTENT
    log(f"Fetching addresses for {extent.name}")
    addresses = fetch(extent)
    artefact = build(extent, addresses)
    log(f"  {len(addresses):,} addresses across {len(artefact['streets'])} streets")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")
    log(f"  written to {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
