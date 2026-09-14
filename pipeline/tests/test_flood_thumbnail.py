"""The homepage's flood map picture, and the ways it could stop being the map.

Two failures matter and neither is visible by looking at the picture. The
first is **drift**: the browser's breaks or ramp change and this copy does not,
so the homepage's dark blue means a different count from the map's. The test
reads the TypeScript and compares. The second is **staleness**: the artefacts
are rebuilt and the WebP is not. The last test renders the published data and
compares it with the committed file.

The geometry in the rest is drawn by hand — squares, and a square with a hole —
because what is being tested is the fill rule, not Greater Melbourne.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from drainlens_pipeline.flood_thumbnail import (
    ACTIVITY_BREAKS,
    ACTIVITY_RAMP,
    EMPTY_FILL,
    GROUND,
    Area,
    FloodThumbnailError,
    band_of,
    decode_ring,
    frame_for,
    join,
    main,
    render,
    summary,
)

WEB = Path(__file__).resolve().parents[2] / "apps" / "web"


def hex_rgb(colour: str) -> tuple[int, int, int]:
    return (int(colour[1:3], 16), int(colour[3:5], 16), int(colour[5:7], 16))


def square(e: float, n: float, size: float) -> tuple[tuple[float, float], ...]:
    return ((e, n), (e + size, n), (e + size, n + size), (e, n + size))


def area(code: str, total: int, complete: bool, *rings) -> Area:
    return Area(code=code, name=code, total=total, complete=complete, rings=tuple(rings))


# --- the copy of the browser's rule -----------------------------------------


def test_the_breaks_are_the_ones_the_map_uses():
    source = (WEB / "src" / "history" / "severity.ts").read_text(encoding="utf-8")
    block = source[source.index("export const ACTIVITY_BREAKS") :]
    block = block[: block.index("];")]
    found = [
        (int(low), None if high == "null" else int(high))
        for low, high in re.findall(r"from:\s*(\d+),\s*to:\s*(\d+|null)", block)
    ]
    assert tuple(found) == ACTIVITY_BREAKS


def test_the_ramp_is_the_one_the_map_uses():
    source = (WEB / "src" / "history" / "drawAreas.ts").read_text(encoding="utf-8")
    line = re.search(r"activity:\s*\[([^\]]*)\]", source)
    assert line is not None
    assert tuple(re.findall(r"'(#[0-9a-f]{6})'", line.group(1))) == ACTIVITY_RAMP


@pytest.mark.parametrize(
    ("total", "band"),
    [(0, None), (1, 0), (10, 0), (11, 1), (25, 1), (26, 2), (50, 2), (51, 3), (209, 3)],
)
def test_a_boundary_count_is_in_the_lower_band(total, band):
    assert band_of(total) == band


def test_a_ring_is_its_first_vertex_then_steps():
    assert decode_ring([100, 200, 10, 0, 0, 10, -10, 0]) == [
        (100, 200),
        (110, 200),
        (110, 210),
        (100, 210),
    ]
    with pytest.raises(FloodThumbnailError):
        decode_ring([1, 2, 3, 4])


def test_a_floor_of_zero_is_hatched_not_called_empty():
    # Two areas publish zero because every region in them was withheld. That is
    # not "no recorded call-outs", and drawing it white-and-outlined would say so.
    withheld = area("a", 0, False, square(0, 0, 1))
    nothing = area("b", 0, True, square(0, 0, 1))
    assert (withheld.state, withheld.fill) == ("minimum", None)
    assert (nothing.state, nothing.fill) == ("none", None)
    assert area("c", 60, True, square(0, 0, 1)).fill == ACTIVITY_RAMP[3]


# --- the join --------------------------------------------------------------


def artefacts(**overrides):
    points = {
        "artefact": "sa2-points",
        "areas": [{"code": "206011105", "rings": [[0, 0, 100, 0, 0, 100, -100, 0]]}],
    }
    areas = {
        "artefact": "sa2-areas",
        "areas": [
            {"code": "206011105", "name": "Brunswick", "total": 12, "complete": True, "suppressedRegions": 0}
        ],
    }
    population = {"artefact": "population", "areas": [{"code": "206011105"}]}
    found = {"points": points, "areas": areas, "population": population}
    found.update(overrides)
    return found


def test_the_join_carries_every_area():
    joined = join(**artefacts())
    assert [(a.name, a.total, a.state) for a in joined] == [("Brunswick", 12, "exact")]
    assert joined[0].rings[0][2] == (100, 100)


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"population": {"artefact": "population", "areas": []}}, "no population"),
        ({"points": {"artefact": "sa2-points", "areas": []}}, "does not place"),
        ({"points": {"artefact": "sa2-areas", "areas": []}}, "not sa2-points"),
        ({"areas": {"artefact": "population", "areas": []}}, "not sa2-areas"),
        ({"population": {"artefact": "sa2-points", "areas": []}}, "not population"),
        ({"areas": {"artefact": "sa2-areas", "areas": []}}, "no areas"),
        (
            {
                "areas": {
                    "artefact": "sa2-areas",
                    "areas": [
                        {"code": "206011105", "name": "Brunswick", "total": 12, "complete": True, "suppressedRegions": 2}
                    ],
                }
            },
            "withheld",
        ),
    ],
)
def test_the_join_refuses_what_the_map_would_refuse(override, message):
    with pytest.raises(FloodThumbnailError, match=message):
        join(**artefacts(**override))


# --- drawing ----------------------------------------------------------------


def test_north_is_up_and_the_areas_are_centred():
    south = area("s", 5, True, square(0, 0, 10))
    north = area("n", 5, True, square(0, 90, 10))
    frame = frame_for([south, north], 200, 100, padding=0)
    assert frame.to_px(5, 95)[1] < frame.to_px(5, 5)[1]
    # 100 m tall in a 100 px picture, so 1 px a metre, and 10 m wide in 200 px
    # leaves 95 px either side.
    assert frame.to_px(0, 100) == pytest.approx((95, 0))
    assert frame.to_px(10, 0) == pytest.approx((105, 100))


def pixel(image: Image.Image, frame, e: float, n: float) -> tuple[int, int, int]:
    x, y = frame.to_px(e, n)
    return image.getpixel((round(x), round(y)))


def test_fills_are_flat_and_holes_are_holes():
    ring_with_hole = area("h", 60, True, square(0, 0, 100), square(35, 35, 30))
    empty = area("z", 0, True, square(120, 0, 100))
    image = render([ring_with_hole, empty], width=440, height=200)
    frame = frame_for([ring_with_hole, empty], 440, 200)

    assert pixel(image, frame, 15, 15) == pytest.approx(hex_rgb(ACTIVITY_RAMP[3]), abs=3)
    # Even-odd: the inner ring is the hole, and the ground shows through it.
    assert pixel(image, frame, 50, 50) == pytest.approx(hex_rgb(GROUND), abs=3)
    assert pixel(image, frame, 170, 50) == pytest.approx(hex_rgb(EMPTY_FILL), abs=3)
    # Outside every area, the ground.
    assert image.getpixel((2, 2)) == pytest.approx(hex_rgb(GROUND), abs=3)


def test_a_floor_is_hatched_over_its_own_colour():
    floor = area("f", 30, False, square(0, 0, 100))
    image = np.asarray(render([floor], width=200, height=200), dtype=int)
    inside = image[60:140, 60:140].reshape(-1, 3)
    fill = np.array(hex_rgb(ACTIVITY_RAMP[2]))
    # Mostly its band's colour, with a light line through it — band 2 is dark,
    # so the hatch lightens rather than darkens.
    near_fill = (np.abs(inside - fill).sum(axis=1) < 12).mean()
    lighter = (inside.sum(axis=1) > fill.sum() + 120).mean()
    assert 0.3 < near_fill < 0.95
    assert lighter > 0.05


def test_summary_counts_what_was_drawn():
    drawn = [
        area("a", 5, True, square(0, 0, 1)),
        area("b", 30, False, square(0, 0, 1)),
        area("c", 0, True, square(0, 0, 1)),
    ]
    assert summary(drawn) == {
        "band0": 1,
        "band1": 0,
        "band2": 1,
        "band3": 0,
        "minimum": 1,
        "none": 1,
        "areas": 3,
    }


def test_main_writes_a_webp_and_refuses_bad_data(tmp_path, capsys):
    found = artefacts()
    for name, value in found.items():
        (tmp_path / f"{name}.json").write_text(json.dumps(value), encoding="utf-8")
    out = tmp_path / "thumb.webp"
    argv = [
        "--points", str(tmp_path / "points.json"),
        "--areas", str(tmp_path / "areas.json"),
        "--population", str(tmp_path / "population.json"),
        "--out", str(out),
    ]
    assert main(argv) == 0
    with Image.open(out) as written:
        assert (written.format, written.size) == ("WEBP", (960, 720))

    (tmp_path / "population.json").write_text(json.dumps({"artefact": "population", "areas": []}))
    assert main(argv) == 1
    assert "no population for Brunswick" in capsys.readouterr().err


# --- the published file -------------------------------------------------------


def test_the_published_picture_is_drawn_from_the_published_data():
    """Stale is the failure nobody would see: a rebuilt artefact and an old picture.

    WebP is lossy, so the comparison is a mean difference rather than equality.
    A picture from a different data build moves whole areas between bands, which
    is tens of levels over thousands of pixels, far above encoder noise.
    """
    data = WEB / "public" / "data"
    joined = join(
        json.loads((data / "sa2-points.json").read_text(encoding="utf-8")),
        json.loads((data / "sa2-areas.json").read_text(encoding="utf-8")),
        json.loads((data / "population.json").read_text(encoding="utf-8")),
    )
    counts = summary(joined)
    # The numbers `severity.ts` and `check-areas.mjs` state for the activity map.
    assert (counts["areas"], counts["minimum"], counts["none"]) == (281, 80, 4)

    fresh = np.asarray(render(joined), dtype=np.int16)
    with Image.open(WEB / "public" / "flood-areas-thumb.webp") as published:
        committed = np.asarray(published.convert("RGB"), dtype=np.int16)
    assert committed.shape == fresh.shape
    assert np.abs(committed - fresh).mean() < 2.0
