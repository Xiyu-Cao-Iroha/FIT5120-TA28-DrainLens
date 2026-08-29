"""A stand-in address index, until the real one can be built.

The published address dataset is behind a rate limit that has not cleared, so
the shipped index cannot be produced yet. The frontend does not wait for the
pipeline — that is how this project has worked from the first commit — but a
search box needs *something*, and what it is given here matters.

**Nothing in this file is invented.** The street names are the 132 real ones
carried by the map artefact's street-label layer. The addresses are the two
recorded in `geo.py` as the demonstration and reserve addresses, which were
verified when the extent was chosen.

So the fixture is honest about the two things the interface actually turns on:
a real address resolves, and a street the pilot does not cover is recognised as
outside rather than guessed at. What it cannot do is offer suggestions while
somebody types, because there are two addresses in it.

The artefact declares itself a fixture and the browser says so on screen.
Shipping this to a resident without that would be the exact failure this
product exists to avoid: a confident answer with nothing behind it.
"""

from __future__ import annotations

import json
from pathlib import Path

from .addresses import Address, build
from .geo import DEMONSTRATION_ADDRESS, DEMONSTRATION_EXTENT, RESERVE_ADDRESS, Extent

#: Where the two known addresses sit, in local metres. Taken from the extent
#: work, not estimated here.
KNOWN: tuple[tuple[str, float, float], ...] = (
    (DEMONSTRATION_ADDRESS, 320.0, 640.0),
    (RESERVE_ADDRESS, 140.0, 480.0),
)


def street_names(map_artefact: dict) -> list[str]:
    """The real street names the map already carries."""
    found = set()
    for feature in map_artefact.get("layers", {}).get("street-name", []):
        label = (feature.get("maplabel") or feature.get("name") or "").strip()
        if label:
            # The source double-spaces between the name and the type.
            found.add(" ".join(label.title().split()))
    return sorted(found)


def parse(label: str) -> tuple[str, str, str]:
    """Split "46 Gatehouse Drive, Kensington" into its parts."""
    street_part, _, suburb = label.partition(",")
    number, _, street = street_part.strip().partition(" ")
    return number, street.strip(), suburb.strip()


def make(map_artefact: dict, extent: Extent = DEMONSTRATION_EXTENT) -> dict:
    addresses = []
    for label, east, north in KNOWN:
        number, street, suburb = parse(label)
        addresses.append(
            Address(
                id=f"{extent.name}/{label.lower().replace(' ', '-').replace(',', '')}",
                label=label,
                number=number,
                street=street,
                suburb=suburb,
                e=east,
                n=north,
            )
        )

    artefact = build(extent, addresses)
    artefact["artefact"] = "address-index-fixture"
    # The real streets, so the pilot boundary check works on real data even
    # though only two addresses can be resolved.
    artefact["streets"] = street_names(map_artefact) or artefact["streets"]
    artefact["fixture"] = (
        "A stand-in, not the shipped index. The street names are the real ones from the "
        "map artefact and the two addresses are the recorded demonstration and reserve "
        "addresses; nothing here is invented. It cannot suggest addresses while typing, "
        "because it holds two. Replace it by running "
        "`python -m drainlens_pipeline.addresses` once the portal's rate limit clears."
    )
    return artefact


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.address_fixture",
        description="Write the stand-in address index from the map artefact's real street names.",
    )
    parser.add_argument("--map", type=Path, default=Path("../data/map/map.json"))
    parser.add_argument("--out", type=Path, default=Path("../data/map/addresses.json"))
    args = parser.parse_args(argv)

    artefact = make(json.loads(args.map.read_text(encoding="utf-8")))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, separators=(",", ":")), encoding="utf-8")

    print(
        f"  {len(artefact['addresses'])} addresses, {len(artefact['streets'])} real streets"
        f" -> {args.out} ({args.out.stat().st_size / 1024:.0f} KB)",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
