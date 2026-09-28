"""Re-express an artefact's coordinates in a larger extent's frame.

**Every artefact's coordinates are metres from its own extent's south-west
corner.** That is a good frame -- the browser needs no projection, and a search
result is already a map position -- and it has one consequence that only shows
up when two extents exist at once: the same ground has two different
coordinates depending on which extent you asked for.

Kensington's corner is at 316,500 / 5,814,500 and the council's is at
315,000 / 5,808,500, so Kensington's origin is the council's (1500, 6000).
Drawing Kensington-frame shapes over a council-frame map puts them one and a
half kilometres west and six kilometres south of where they belong -- on
screen, silently, and looking like a map.

This repository has had that bug once already, in a different frame. In 0.15.0
the interface worked out a pit's grid cell from map geometry while the pipeline
snapped drains onto the flow field, and **all 895 drains disagreed**, so every
comparison returned "required inlet records are missing" -- a sentence blaming
the council's data for our own arithmetic. The fix then was to have one thing
own the answer. This is the same fix: the shift happens once, here, where both
extents are known, so the artefact the API serves is internally consistent and
the browser never learns that two frames exist.

**Only the derived layers need it.** The map and trace artefacts are rebuilt
from source at whatever extent is asked for, so they are born in the right
frame. The derived layers cannot be: they come from a measured ground surface
that exists for one square kilometre, and expanding the recorded network did
not expand the terrain.

**Since 13 September there are two measured areas**, Kensington and the
Hoddle Grid, and `combine` puts both into the council frame as one artefact.
They are built separately because each is its own terrain run; they are
served together because the browser draws one derived artefact per map.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .geo import EXTENTS, Extent


class ReframeError(Exception):
    pass


def shift_coordinates(value: Any, de: float, dn: float) -> Any:
    """Add an offset to every ``[e, n]`` pair, at any nesting depth.

    Recursive rather than keyed on layer names, because the artefact holds
    points, lines and polygon rings and a function that knew which was which
    would need editing every time a layer is added -- and the edit that is
    forgotten is the one where a new layer silently stays in the old frame.
    """
    if not isinstance(value, list):
        return value
    if (
        len(value) == 2
        and all(isinstance(n, (int, float)) and not isinstance(n, bool) for n in value)
    ):
        return [round(value[0] + de, 1), round(value[1] + dn, 1)]
    return [shift_coordinates(item, de, dn) for item in value]


def reframe(artefact: dict, source: Extent, target: Extent) -> dict:
    """The same shapes, expressed in ``target``'s frame.

    Refuses rather than guesses when the source extent does not sit inside the
    target: an artefact half outside the map it is drawn on is not something to
    shift into place, it is a question about which extents were meant.
    """
    if artefact.get("extent", {}).get("name") != source.name:
        raise ReframeError(
            f"artefact says its extent is {artefact.get('extent', {}).get('name')!r}, not {source.name!r}"
        )
    inside = (
        target.min_e <= source.min_e
        and target.min_n <= source.min_n
        and source.max_e <= target.max_e
        and source.max_n <= target.max_n
    )
    if not inside:
        raise ReframeError(f"{source.name} is not inside {target.name}")

    de = source.min_e - target.min_e
    dn = source.min_n - target.min_n

    out = dict(artefact)
    out["layers"] = {
        name: [
            {**shape, "c": shift_coordinates(shape["c"], de, dn)} for shape in shapes
        ]
        for name, shapes in artefact.get("layers", {}).items()
    }
    out["extent"] = {
        "name": target.name,
        "width_m": target.width_m,
        "height_m": target.height_m,
    }
    # The sentence a reader needs and the shapes cannot say for themselves.
    out["covers"] = (
        f"These layers are calculated from a measured ground surface that exists for "
        f"{source.name} only -- {source.width_m:,.0f} by {source.height_m:,.0f} metres of "
        f"the {target.width_m:,.0f} by {target.height_m:,.0f} this extent covers, with its "
        f"south-west corner at ({de:,.0f}, {dn:,.0f}). Everywhere else on this map, the "
        f"ground has not been measured and nothing is claimed about where water goes."
    )
    out["areas"] = [_area(source, target)]
    return out


def _area(source: Extent, target: Extent) -> dict:
    """Where a measured area sits, in the frame it has been moved into."""
    return {
        "name": source.name,
        "e": round(source.min_e - target.min_e, 1),
        "n": round(source.min_n - target.min_n, 1),
        "width_m": source.width_m,
        "height_m": source.height_m,
    }


def _overlap(a: Extent, b: Extent) -> bool:
    return a.min_e < b.max_e and b.min_e < a.max_e and a.min_n < b.max_n and b.min_n < a.max_n


def combine(parts: list[tuple[dict, Extent]], target: Extent) -> dict:
    """Several measured areas, each moved into ``target``'s frame, as one artefact.

    Refuses rather than merges when the parts disagree about how they were
    made. The unavailable hatching means "under a fifth measured, four blocks
    or more"; two halves built with different thresholds would draw one legend
    entry meaning two things, and nobody looking at the map could tell where
    the meaning changed.

    Refuses overlapping areas too. The same ground built twice is two sets of
    water paths over one street, and which one is right is not a question a
    merge can answer.
    """
    if not parts:
        raise ReframeError("there is nothing to combine")

    for index, (_, first) in enumerate(parts):
        for _, second in parts[index + 1 :]:
            if _overlap(first, second):
                raise ReframeError(f"{first.name} and {second.name} overlap")

    settings = [artefact.get("settings") for artefact, _ in parts]
    if any(s != settings[0] for s in settings[1:]):
        names = ", ".join(source.name for _, source in parts)
        raise ReframeError(f"{names} were built with different settings")

    moved = [reframe(artefact, source, target) for artefact, source in parts]
    out = dict(moved[0])
    layer_names: list[str] = []
    for part in moved:
        for name in part["layers"]:
            if name not in layer_names:
                layer_names.append(name)
    out["layers"] = {
        name: [shape for part in moved for shape in part["layers"].get(name, [])]
        for name in layer_names
    }
    out["areas"] = [area for part in moved for area in part["areas"]]

    measured = sum(source.width_m * source.height_m for _, source in parts) / 1e6
    names = " and ".join(source.name for _, source in parts)
    out["covers"] = (
        f"These layers are calculated from a measured ground surface that exists for "
        f"{names} only -- {measured:,.2f} km2 of the "
        f"{target.width_m * target.height_m / 1e6:,.2f} km2 this extent covers; `areas` "
        f"gives each one's south-west corner and size in this frame. Everywhere else on "
        f"this map, the ground has not been measured and nothing is claimed about where "
        f"water goes."
    )
    return out


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.reframe",
        description="Re-express one or more artefacts' coordinates in a larger extent's frame.",
    )
    parser.add_argument("--in", dest="source_files", type=Path, action="append", required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--from", dest="sources", choices=sorted(EXTENTS), action="append", required=True
    )
    parser.add_argument("--to", dest="target", choices=sorted(EXTENTS), required=True)
    args = parser.parse_args(argv)

    if len(args.source_files) != len(args.sources):
        parser.error("give one --from for every --in, in the same order")

    parts = [
        (json.loads(path.read_text(encoding="utf-8")), EXTENTS[name])
        for path, name in zip(args.source_files, args.sources, strict=True)
    ]
    target = EXTENTS[args.target]
    moved = reframe(*parts[0], target) if len(parts) == 1 else combine(parts, target)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(moved, separators=(",", ":")), encoding="utf-8")

    shapes = sum(len(v) for v in moved["layers"].values())
    print(
        f"wrote {args.out}: {shapes} shapes moved from {' + '.join(args.sources)} "
        f"into {args.target}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
