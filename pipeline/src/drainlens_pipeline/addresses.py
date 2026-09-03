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
anything else is a query this product cannot speak about at all. AC 1.1.8 turns
on telling those three apart, so the streets are listed separately rather than
being recovered by scanning every label at run time.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Callable, Iterable

from .geo import Extent, from_mga55, to_mga55

DATASET = "street-addresses"
BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"

#: What the portal calls this dataset, and its id.
#:
#: The two must name the same thing. When the builder was moved off the parcel
#: dataset only `dataset_id` was updated, so every published index went out
#: carrying "Property boundaries" as its human-readable source while its id
#: said `street-addresses` -- a false provenance statement inside an artefact
#: whose whole purpose is to be checkable. The attribution footer reads the id,
#: so nothing wrong ever reached a screen; the artefact was wrong regardless.
#: "Street addresses" is the portal's own title for `street-addresses`.
SOURCE = {
    "dataset": "Street addresses",
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
KEPT = ("street_no", "str_name", "suburb", "geo_point_2d")

#: The fields an address needs, and nothing else.
#:
#: The published dataset carries far more. Everything not needed to find a
#: street and drop a pin is left behind at build time rather than shipped and
#: ignored — a field that never leaves the pipeline cannot leak from the
#: browser.
#:
#: **This is `street-addresses`, not `property-boundaries`.** An earlier
#: version read the parcel dataset, which has 15,341 records, no split street
#: fields, and does not contain either demonstration address: Gatehouse Drive
#: has a 10, a 15 and a 17 but no 46, because a parcel is not an address. It
#: produced an index of 1,619 entries that looked entirely reasonable and was
#: missing the two addresses the demonstration is built on. `street-addresses`
#: has 63,721 records, 4,136 of them inside the extent, and carries
#: `street_no`, `str_name` and `suburb` already split and already title-cased.

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

        # `str_name` already carries the type — "Gatehouse Drive" — so there
        # is no separate street_type to join on.
        number = str(record.get("street_no") or "").strip()
        name = str(record.get("str_name") or "").strip()
        locality = str(record.get("suburb") or "").strip()
        if not number or not name:
            continue

        street = _title(name)
        suburb = _title(locality)
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


def build(
    extent: Extent,
    addresses: list[Address],
    map_streets: Iterable[str] = (),
) -> dict:
    """The artefact, with the street list the boundary check needs.

    ``streets`` is deliberately wider than the streets that have addresses.
    The interface asks it one question — *is this a real street?* — and uses
    the answer to tell "outside the pilot area" from "not an address". Those
    are different things to be told, and only one of them is true of a street
    that exists.

    Measured on the demonstration extent: 38 street names on the map carry no
    address in this dataset. Some straddle the extent edge, because the map
    fetch reaches 150 m further than the addresses are clipped to; some are
    service lanes with no parcels fronting them. Built from addresses alone,
    the index would tell somebody on Harper Street that their street does not
    exist — the same defect as the one this list was introduced to fix, just
    one boundary further out.
    """
    if not addresses:
        raise AddressError(
            "the index is empty; without it every address is 'not an address' and "
            "the pilot boundary cannot be told from a typing mistake"
        )

    # Deduplicated on a normalised form, not on the raw string. The map's
    # labels carry double spaces — "McTaggart  Street" — so a plain union
    # listed 92 streets twice and made the index look like it covered twice
    # what it does.
    by_form: dict[str, str] = {}
    for name in [a.street for a in addresses] + list(map_streets):
        readable = " ".join(str(name or "").split())
        if not readable:
            continue
        by_form.setdefault(readable.casefold(), readable)
    streets = sorted(by_form.values())
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
    parser.add_argument(
        "--map",
        type=Path,
        default=Path("../apps/web/public/data/map.json"),
        help="map artefact, read for street names that carry no address",
    )
    args = parser.parse_args(argv)

    def log(message: str) -> None:
        print(message, file=sys.stderr)

    extent = DEMONSTRATION_EXTENT
    log(f"Fetching addresses for {extent.name}")
    addresses = fetch(extent)

    # Street names the map knows, so a real street just outside the addressed
    # area is told it is outside the pilot rather than told it does not exist.
    map_streets: list[str] = []
    if args.map.exists():
        layers = json.loads(args.map.read_text(encoding="utf-8")).get("layers", {})
        map_streets = [
            str(feature.get("maplabel") or feature.get("name") or "")
            for feature in layers.get("street-name", [])
        ]
        log(f"  {len({n for n in map_streets if n.strip()}):,} street names from the map")
    else:
        log(f"  no map artefact at {args.map}; street list will cover addressed streets only")

    artefact = build(extent, addresses, map_streets)
    log(f"  {len(addresses):,} addresses across {len(artefact['streets'])} streets")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")
    log(f"  written to {args.out} ({args.out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
