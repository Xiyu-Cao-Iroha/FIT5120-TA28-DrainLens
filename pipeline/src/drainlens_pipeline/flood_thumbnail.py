"""The homepage's picture of the flood map, drawn from the flood map's own data.

The homepage offers the area map beside the top-five ranking, and it needs a
picture of it. **Not a mock, and not a screenshot.** A mock is an invented map
of recorded call-outs on the front page of a product whose position is that it
does not overstate what it knows; a screenshot goes stale silently the next
time the artefacts are rebuilt. This draws the same 281 shapes from the same
two artefacts, coloured by the same rule, and is rebuilt beside them.

**Why a file and not a canvas.** Drawn in the browser, the homepage would fetch
`sa2-points.json` and `sa2-areas.json` — about 220 KB — to show a thumbnail
most visitors scroll past. The WebP is a few tens of kilobytes and the areas
are still fetched only when somebody opens the map, as `useAreas` intends.

**The rule is the browser's, copied, and a test holds the copy to it.**
`ACTIVITY_BREAKS` and the ramp come from `history/severity.ts` and
`history/drawAreas.ts`; `test_flood_thumbnail.py` reads those two files and
fails if a break or a colour here stops matching. Two definitions of a colour
scale are a drift waiting to happen, and the drift would be a homepage picture
whose dark blue means something the map's dark blue does not.

What it draws, in activity mode only — the map opens in that mode:

* each area filled flat in its band's colour, with a white edge;
* **a floor** — an incomplete total — hatched over its colour, dark lines on
  the two pale bands and light lines on the two dark ones;
* **no recorded call-outs** — white, outlined in grey.

The population artefact is read for one reason: the map refuses to draw an area
it cannot join to a population (`joinAreas`), so this refuses too. A picture of
an area the map would not show is a picture of a different map.

    python -m drainlens_pipeline.flood_thumbnail \\
        --points ../apps/web/public/data/sa2-points.json \\
        --areas ../apps/web/public/data/sa2-areas.json \\
        --population ../apps/web/public/data/population.json \\
        --out ../apps/web/public/flood-areas-thumb.webp
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw


class FloodThumbnailError(ValueError):
    pass


#: `ACTIVITY_BREAKS` in `history/severity.ts`: inclusive lower and upper
#: bounds, the last open-ended.
ACTIVITY_BREAKS: tuple[tuple[int, int | None], ...] = ((1, 10), (11, 25), (26, 50), (51, None))

#: `RAMPS.activity` in `history/drawAreas.ts`, palest first.
ACTIVITY_RAMP: tuple[str, ...] = ("#cdd9ee", "#93a9d6", "#5871b0", "#2b3f7d")

#: The rest of `drawAreas.ts`'s palette that activity mode uses.
NOTHING_RECORDED = "#8c98a4"
EMPTY_FILL = "#ffffff"
BORDER = "#ffffff"
GROUND = "#e3e8ec"
HATCH_ON_LIGHT = (30, 43, 54, round(0.55 * 255))
HATCH_ON_DARK = (255, 255, 255, round(0.65 * 255))

#: The published picture. 4:3, drawn for a card about 480 CSS pixels wide, so
#: two image pixels to one CSS pixel on a high-density screen.
WIDTH = 960
HEIGHT = 720

#: Drawn this many times larger and reduced, because Pillow's polygons are not
#: antialiased and 281 aliased boundaries read as a jagged mesh.
SUPERSAMPLE = 3

#: Margin around the areas' own extent, as a share of the picture.
PADDING = 0.04

#: In published-image pixels. The map's hatch is 6 CSS px at its own scale;
#: at thumbnail scale the areas are smaller, so the grid is tighter to still
#: land inside the inner-city areas.
HATCH_SPACING = 9
HATCH_WIDTH = 1.6
BORDER_WIDTH = 1.2
OUTLINE_WIDTH = 1.6


def band_of(total: int) -> int | None:
    """The band a count falls in, or None for zero, as `bandOf` does."""
    for index, (low, high) in enumerate(ACTIVITY_BREAKS):
        if total >= low and (high is None or total <= high):
            return index
    return None


def decode_ring(flat: Sequence[float]) -> list[tuple[float, float]]:
    """First vertex, then steps — `decodeRing` in `severity.ts`."""
    if len(flat) < 6 or len(flat) % 2:
        raise FloodThumbnailError(f"has a ring of {len(flat)} numbers, which is not a polygon")
    out: list[tuple[float, float]] = []
    e = n = 0.0
    for index in range(0, len(flat), 2):
        if index == 0:
            e, n = float(flat[0]), float(flat[1])
        else:
            e += flat[index]
            n += flat[index + 1]
        out.append((e, n))
    return out


@dataclass(frozen=True)
class Area:
    code: str
    name: str
    total: int
    complete: bool
    rings: tuple[tuple[tuple[float, float], ...], ...]

    @property
    def state(self) -> str:
        """`completenessOf(area, 'activity')`: minimum, none or exact."""
        if not self.complete:
            return "minimum"
        return "none" if self.total == 0 else "exact"

    @property
    def fill(self) -> str | None:
        """`fillFor`: a band colour, or None for an area with no colour of its own."""
        if self.state == "none":
            return None
        band = band_of(self.total)
        return None if band is None else ACTIVITY_RAMP[band]


def join(
    points: Mapping[str, Any], areas: Mapping[str, Any], population: Mapping[str, Any]
) -> list[Area]:
    """The three artefacts as one list, refusing an area the map would refuse."""
    if points.get("artefact") != "sa2-points":
        raise FloodThumbnailError("has a points file that is not sa2-points")
    if areas.get("artefact") != "sa2-areas":
        raise FloodThumbnailError("has an areas file that is not sa2-areas")
    if population.get("artefact") != "population":
        raise FloodThumbnailError("has a population file that is not population")

    placed = {a["code"]: a for a in points["areas"]}
    persons = {a["code"] for a in population["areas"]}
    out: list[Area] = []
    for area in areas["areas"]:
        code = area["code"]
        if code not in persons:
            raise FloodThumbnailError(f"has no population for {area['name']}")
        point = placed.get(code)
        if point is None:
            raise FloodThumbnailError(f"does not place {area['name']}")
        if area["complete"] != (area["suppressedRegions"] == 0):
            raise FloodThumbnailError(
                f"says {area['name']} is {'complete' if area['complete'] else 'incomplete'}"
                f" with {area['suppressedRegions']} withheld regions"
            )
        out.append(
            Area(
                code=code,
                name=area["name"],
                total=int(area["total"]),
                complete=bool(area["complete"]),
                rings=tuple(tuple(decode_ring(ring)) for ring in point["rings"]),
            )
        )
    if not out:
        raise FloodThumbnailError("carries no areas")
    return out


@dataclass(frozen=True)
class Frame:
    """Local metres to picture pixels, north up, one scale on both axes."""

    min_e: float
    max_n: float
    scale: float
    left: float
    top: float

    def to_px(self, e: float, n: float) -> tuple[float, float]:
        return (self.left + (e - self.min_e) * self.scale, self.top + (self.max_n - n) * self.scale)


def frame_for(areas: Sequence[Area], width: int, height: int, padding: float = PADDING) -> Frame:
    """Every area in the picture, centred, with the same margin as the map's fit."""
    es = [e for a in areas for ring in a.rings for e, _ in ring]
    ns = [n for a in areas for ring in a.rings for _, n in ring]
    min_e, max_e, min_n, max_n = min(es), max(es), min(ns), max(ns)
    inner_w = width * (1 - 2 * padding)
    inner_h = height * (1 - 2 * padding)
    scale = min(inner_w / (max_e - min_e), inner_h / (max_n - min_n))
    left = (width - (max_e - min_e) * scale) / 2
    top = (height - (max_n - min_n) * scale) / 2
    return Frame(min_e=min_e, max_n=max_n, scale=scale, left=left, top=top)


def _hex(colour: str) -> tuple[int, int, int]:
    return (int(colour[1:3], 16), int(colour[3:5], 16), int(colour[5:7], 16))


def _area_mask(area: Area, frame: Frame) -> tuple[Image.Image, tuple[int, int]]:
    """The area's shape, even-odd across its rings, as `drawAreas` fills it.

    Cut to the area's own box and returned with the box's corner: 281 masks the
    size of the whole picture took half a minute to draw.
    """
    rings = [[frame.to_px(e, n) for e, n in ring] for ring in area.rings]
    left = int(min(x for ring in rings for x, _ in ring)) - 1
    top = int(min(y for ring in rings for _, y in ring)) - 1
    right = int(max(x for ring in rings for x, _ in ring)) + 2
    bottom = int(max(y for ring in rings for _, y in ring)) + 2
    size = (right - left, bottom - top)
    mask = np.zeros((size[1], size[0]), dtype=bool)
    for ring in rings:
        layer = Image.new("1", size, 0)
        ImageDraw.Draw(layer).polygon([(x - left, y - top) for x, y in ring], fill=1)
        mask ^= np.asarray(layer, dtype=bool)
    return Image.fromarray(mask.astype(np.uint8) * 255, mode="L"), (left, top)


def render(areas: Sequence[Area], width: int = WIDTH, height: int = HEIGHT) -> Image.Image:
    """The picture, as RGB."""
    s = SUPERSAMPLE
    size = (width * s, height * s)
    frame = frame_for(areas, size[0], size[1])
    canvas = Image.new("RGBA", size, _hex(GROUND) + (255,))
    draw = ImageDraw.Draw(canvas)

    # One hatch texture for the whole picture, on a grid fixed to the picture
    # rather than to each area, so two hatched neighbours read as one texture.
    yy, xx = np.mgrid[0 : size[1], 0 : size[0]]
    lines = ((xx + yy) % round(HATCH_SPACING * s)) < round(HATCH_WIDTH * s)

    masks = {area.code: _area_mask(area, frame) for area in areas}

    # Fills, then the white edges between them.
    for area in areas:
        fill = _hex(area.fill or EMPTY_FILL) + (255,)
        mask, corner = masks[area.code]
        canvas.paste(Image.new("RGBA", mask.size, fill), corner, mask)
        for ring in area.rings:
            points = [frame.to_px(e, n) for e, n in ring]
            draw.line(points + points[:1], fill=BORDER, width=round(BORDER_WIDTH * s), joint="curve")

    # What colour cannot say, over every fill so no neighbour's edge crosses it.
    for area in areas:
        if area.state == "minimum":
            dark = area.fill is not None and ACTIVITY_RAMP.index(area.fill) >= 2
            ink = HATCH_ON_DARK if dark else HATCH_ON_LIGHT
            mask, (left, top) = masks[area.code]
            shape = np.asarray(mask)
            grid = lines[top : top + shape.shape[0], left : left + shape.shape[1]]
            alpha = np.where(grid & (shape > 0), ink[3], 0).astype(np.uint8)
            layer = Image.new("RGBA", mask.size, ink[:3] + (0,))
            layer.putalpha(Image.fromarray(alpha, mode="L"))
            canvas.alpha_composite(layer, dest=(left, top))
        elif area.state == "none":
            for ring in area.rings:
                points = [frame.to_px(e, n) for e, n in ring]
                draw.line(
                    points + points[:1],
                    fill=NOTHING_RECORDED,
                    width=round(OUTLINE_WIDTH * s),
                    joint="curve",
                )

    return canvas.resize((width, height), Image.Resampling.LANCZOS).convert("RGB")


def summary(areas: Sequence[Area]) -> dict[str, int]:
    """What was drawn, for the log and the test: bands, floors and zeros."""
    counts = {f"band{index}": 0 for index in range(len(ACTIVITY_BREAKS))}
    counts.update(minimum=0, none=0, areas=len(areas))
    for area in areas:
        band = band_of(area.total)
        if band is not None:
            counts[f"band{band}"] += 1
        if area.state in ("minimum", "none"):
            counts[area.state] += 1
    return counts


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    data = Path("../apps/web/public/data")
    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.flood_thumbnail",
        description="Draw the homepage's picture of the flood area map.",
    )
    parser.add_argument("--points", type=Path, default=data / "sa2-points.json")
    parser.add_argument("--areas", type=Path, default=data / "sa2-areas.json")
    parser.add_argument("--population", type=Path, default=data / "population.json")
    parser.add_argument("--out", type=Path, default=Path("../apps/web/public/flood-areas-thumb.webp"))
    args = parser.parse_args(argv)

    try:
        areas = join(
            json.loads(args.points.read_text(encoding="utf-8")),
            json.loads(args.areas.read_text(encoding="utf-8")),
            json.loads(args.population.read_text(encoding="utf-8")),
        )
    except FloodThumbnailError as error:
        print(f"not drawn: the area data {error}", file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    # `method=6` is the slowest encoder setting and the smallest file; this runs
    # once per data rebuild, not per request.
    render(areas).save(args.out, "WEBP", quality=82, method=6)
    counts = summary(areas)
    print(f"wrote {args.out}  ({args.out.stat().st_size / 1024:.1f} KB)")
    print(f"  areas drawn    {counts['areas']:>5}")
    print(f"  by band        {', '.join(str(counts[f'band{i}']) for i in range(len(ACTIVITY_BREAKS)))}")
    print(f"  floors         {counts['minimum']:>5}")
    print(f"  no call-outs   {counts['none']:>5}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
