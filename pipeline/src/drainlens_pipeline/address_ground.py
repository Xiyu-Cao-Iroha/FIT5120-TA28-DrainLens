"""Which way the ground falls around each address — Address Insight, terrain handover §3.3.

For every address in the index, a plane is fitted to the raw ground within
75 m of it. The plane's downhill direction is the answer, and it is given only
when four things all hold:

| Condition | Threshold |
|---|---|
| The fitted fall across the 150 m-wide area | ≥ 0.5 m |
| How well a plane describes that ground, R² | ≥ 0.30 |
| The share of the fit's weight on measured ground | ≥ 0.35 |
| The downhill direction at 75 m and at 100 m | within 22.5° |

**What it claims, and what it does not.** One of eight compass points, for the
ground around the house as a whole. Not a path water takes, and not the fall a
person would walk down: a 75 m-radius fit is a trend over an area about 150 m
across. The handover measured the nearest water path against this direction at
2,231 addresses and found them a median 37° apart, 18% more than 90° — a
channel runs along a valley floor and the ground at a house falls into the
valley, roughly across it. The two answer different questions and neither
stands in for the other.

**The 22.5° test is what an octant can bear.** An arrow that names one of eight
points is right if the true direction is within 22.5° of it. When the 75 m and
100 m fits disagree by more than that, the direction depends on where the circle
is drawn, and no arrow is given.

**Weights.** Building cells carry nothing — the ground under a roof is
interpolated — and open cells carry 0.35 plus 0.65 of whether they were
measured, so interpolated open ground still counts, less.

**Three answers, not two.** `falls`, `unclear` (flat, or not planar, or
unstable), and `edge`: the 75 m disc runs off the measured extent, so there is
no fit to make. That third reason is not "too flat" and not "too little
measured", and the card says which it is.

**Off the extent includes the holes in it.** Over the whole council the point
cloud has 211 of the extent's 306 tiles; the ground in the other 95 is not
low-confidence ground, it is no ground, stored as whatever the grid held. A fit
that reaches into one would be a plane through numbers nobody measured, so any
invalid cell within the 100 m check disc makes the answer `edge`, the same as
the extent's outer boundary.

**Version 2 is one short code per address, in the index's own order.** Keyed by
id, the council's 62,397 addresses came to about seven megabytes of repeated
strings. The artefact now carries the index's `on` list and, for each street,
`number=code` per address in the same order — the code is `x` edge, `u`
unclear, or a compass abbreviation followed by the fall in half-metres (`SW3` is
south-west, 1.5 m). The browser rebuilds each id from the street and the number
exactly as it rebuilds the index's, so the two cannot drift apart by position.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

FIT_RADIUS_M = 75.0
CHECK_RADIUS_M = 100.0
AREA_ACROSS_M = 150.0
MIN_FALL_M = 0.5
MIN_R2 = 0.30
MIN_MEASURED = 0.35
MAX_BEARING_SPREAD_DEG = 22.5
FALL_ROUNDING_M = 0.5
WEIGHT_UNMEASURED = 0.35

COMPASS = ("east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east")

#: The code each compass point is written as in the artefact.
ABBREVIATION = dict(zip(COMPASS, ("E", "NE", "N", "NW", "W", "SW", "S", "SE")))


class AddressGroundError(RuntimeError):
    pass


def compass(angle_deg: float) -> str:
    """One of eight points for an angle in the map frame (0° east, 90° north)."""
    return COMPASS[int(round(angle_deg / 45.0)) % 8]


def fit_plane(
    ground: np.ndarray, weights: np.ndarray, e: float, n: float, radius_m: float
) -> tuple[float, float, float] | None:
    """Weighted plane over the cells within `radius_m`: (east slope, north slope, R²).

    Cells outside the grid are simply absent. None when the disc holds no weight.
    """
    rows, cols = ground.shape
    c0, c1 = max(int(math.floor(e - radius_m)), 0), min(int(math.ceil(e + radius_m)), cols - 1)
    r0, r1 = max(int(math.floor(rows - n - radius_m)), 0), min(int(math.ceil(rows - n + radius_m)), rows - 1)
    if c0 > c1 or r0 > r1:
        return None
    xs = np.arange(c0, c1 + 1) + 0.5 - e
    ys = rows - (np.arange(r0, r1 + 1) + 0.5) - n
    xx, yy = np.meshgrid(xs, ys)
    inside = xx**2 + yy**2 <= radius_m**2
    w = weights[r0 : r1 + 1, c0 : c1 + 1][inside]
    if w.sum() <= 0:
        return None
    z = ground[r0 : r1 + 1, c0 : c1 + 1][inside].astype(np.float64)
    x, y = xx[inside], yy[inside]
    root = np.sqrt(w)
    design = np.column_stack([x, y, np.ones_like(x)]) * root[:, None]
    coefficients, *_ = np.linalg.lstsq(design, z * root, rcond=None)
    a, b, c = (float(v) for v in coefficients)
    fitted = a * x + b * y + c
    mean = float((w * z).sum() / w.sum())
    total = float((w * (z - mean) ** 2).sum())
    residual = float((w * (z - fitted) ** 2).sum())
    r2 = 0.0 if total <= 0 else max(0.0, 1.0 - residual / total)
    return a, b, r2


def _all_valid(valid: np.ndarray, e: float, n: float, radius_m: float) -> bool:
    """Whether every cell within `radius_m` of the address holds ground."""
    rows, cols = valid.shape
    c0, c1 = max(int(math.floor(e - radius_m)), 0), min(int(math.ceil(e + radius_m)), cols - 1)
    r0, r1 = max(int(math.floor(rows - n - radius_m)), 0), min(int(math.ceil(rows - n + radius_m)), rows - 1)
    xx, yy = np.meshgrid(np.arange(c0, c1 + 1) + 0.5 - e, rows - (np.arange(r0, r1 + 1) + 0.5) - n)
    inside = xx**2 + yy**2 <= radius_m**2
    return bool(np.asarray(valid[r0 : r1 + 1, c0 : c1 + 1])[inside].all())


def code_of(record: dict) -> str:
    """The short form an answer is published in: `x`, `u`, or e.g. `SW3` for south-west, 1.5 m."""
    if record["ground"] == "edge":
        return "x"
    if record["ground"] == "unclear":
        return "u"
    return f"{ABBREVIATION[record['bearing']]}{int(round(record['fallM'] / FALL_ROUNDING_M))}"


def weights_of(measured: np.ndarray, buildings: np.ndarray) -> np.ndarray:
    """Nothing on a roof; 0.35 on interpolated open ground; 1 on measured open ground."""
    return (~buildings) * (WEIGHT_UNMEASURED + (1.0 - WEIGHT_UNMEASURED) * measured)


def assess(
    ground: np.ndarray,
    measured: np.ndarray,
    buildings: np.ndarray,
    e: float,
    n: float,
    weights: np.ndarray | None = None,
    valid: np.ndarray | None = None,
) -> dict:
    """One address's answer, with the numbers that decided it.

    `valid`, where given, marks the cells that hold ground at all. A missing
    tile inside the check disc is the edge of the extent, and is answered as one.
    """
    rows, cols = ground.shape
    if e - FIT_RADIUS_M < 0 or n - FIT_RADIUS_M < 0 or e + FIT_RADIUS_M > cols or n + FIT_RADIUS_M > rows:
        return {"ground": "edge"}
    if valid is not None and not _all_valid(valid, e, n, CHECK_RADIUS_M):
        return {"ground": "edge"}

    if weights is None:
        weights = weights_of(measured, buildings)
    main = fit_plane(ground, weights, e, n, FIT_RADIUS_M)
    check = fit_plane(ground, weights, e, n, CHECK_RADIUS_M)
    if main is None or check is None:
        return {"ground": "edge"}

    a, b, r2 = main
    # The measured share as the fit saw it: weighted, so it is the share of the
    # fit's own weight that rests on measured ground. It is the handover's
    # definition, and reproduces its published values at every address sampled.
    c0, c1 = int(math.floor(e - FIT_RADIUS_M)), int(math.ceil(e + FIT_RADIUS_M))
    r0, r1 = int(math.floor(rows - n - FIT_RADIUS_M)), int(math.ceil(rows - n + FIT_RADIUS_M))
    c1, r1 = min(c1, cols - 1), min(r1, rows - 1)
    xx, yy = np.meshgrid(np.arange(c0, c1 + 1) + 0.5 - e, rows - (np.arange(r0, r1 + 1) + 0.5) - n)
    disc = xx**2 + yy**2 <= FIT_RADIUS_M**2
    w_disc = weights[r0 : r1 + 1, c0 : c1 + 1][disc]
    m_disc = measured[r0 : r1 + 1, c0 : c1 + 1][disc]
    share = float((w_disc * m_disc).sum() / w_disc.sum()) if w_disc.sum() > 0 else 0.0

    fall = math.hypot(a, b) * AREA_ACROSS_M
    downhill = math.degrees(math.atan2(-b, -a)) % 360.0
    check_downhill = math.degrees(math.atan2(-check[1], -check[0])) % 360.0
    spread = abs((downhill - check_downhill + 180.0) % 360.0 - 180.0)

    record = {
        "fitQuality": round(r2, 2),
        "measuredCoverage": round(share, 2),
    }
    if fall >= MIN_FALL_M and r2 >= MIN_R2 and share >= MIN_MEASURED and spread <= MAX_BEARING_SPREAD_DEG:
        return {
            "ground": "falls",
            "bearing": compass(downhill),
            "fallM": round(fall / FALL_ROUNDING_M) * FALL_ROUNDING_M,
            **record,
        }
    return {"ground": "unclear", **record}


def addresses_of(index: dict) -> list[tuple[str, float, float]]:
    """(id, east, north) for every address, with the id the web app builds."""
    area = index["area"]
    out = []
    for key, group in zip(index["on"], index["at"]):
        street, _, suburb = key.partition("|")
        for number, e, n in group:
            label = f"{number} {street}, {suburb}" if suburb else f"{number} {street}"
            out.append((f"{area}/{label.lower().replace(' ', '-').replace(',', '')}", float(e), float(n)))
    return out


def build(
    ground: np.ndarray,
    measured: np.ndarray,
    buildings: np.ndarray,
    index: dict,
    valid: np.ndarray | None = None,
) -> dict:
    if not (ground.shape == measured.shape == buildings.shape) or (valid is not None and valid.shape != ground.shape):
        raise AddressGroundError("the ground, measured and building grids are not the same shape")
    width, height = ground.shape[1], ground.shape[0]
    if index.get("extent", {}).get("width_m") != width or index.get("extent", {}).get("height_m") != height:
        raise AddressGroundError("the address index is not in the same frame as the ground")
    weights = weights_of(measured, buildings)
    counts = {"falls": 0, "unclear": 0, "edge": 0}
    codes = []
    for group in index["at"]:
        street = []
        for number, e, n in group:
            record = assess(ground, measured, buildings, float(e), float(n), weights, valid)
            counts[record["ground"]] += 1
            street.append(f"{number}={code_of(record)}")
        codes.append(street)
    return {
        "artefact": "address-ground",
        "version": 2,
        "basis": "derived",
        "area": index["area"],
        "note": (
            "Which way the ground around each address falls, from a weighted plane fitted to the "
            "estimated ground within 75 m. One of eight compass points for the area as a whole — not a "
            "water path, and not given where the fit is flat, not planar, unstable, or runs off the "
            "measured ground."
        ),
        "settings": {
            "fitRadiusM": FIT_RADIUS_M,
            "checkRadiusM": CHECK_RADIUS_M,
            "areaAcrossM": AREA_ACROSS_M,
            "minFallM": MIN_FALL_M,
            "minR2": MIN_R2,
            "minMeasured": MIN_MEASURED,
            "maxBearingSpreadDeg": MAX_BEARING_SPREAD_DEG,
            "fallRoundingM": FALL_ROUNDING_M,
            "weightUnmeasured": WEIGHT_UNMEASURED,
        },
        "counts": counts,
        "codes": "number=code per address; code x: too near the edge of the measured ground; u: unclear; otherwise a compass point (E, NE, N, NW, W, SW, S, SE) and the fall in half-metres",
        "on": list(index["on"]),
        "at": codes,
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.address_ground",
        description="Fit the ground around every address and say which way it falls, where that can be said.",
    )
    parser.add_argument("--terrain", type=Path, default=Path("../data/terrain-council"))
    parser.add_argument("--addresses", type=Path, default=Path("../apps/web/public/data/addresses.json"))
    parser.add_argument("--out", type=Path, default=Path("../apps/web/public/data/terrain/address-ground.json"))
    args = parser.parse_args(argv)

    ground = np.load(args.terrain / "ground-surface.npy")
    measured = np.load(args.terrain / "ground-observed.npy")
    buildings_path = args.terrain / "barriers.npy"
    buildings = np.load(buildings_path) if buildings_path.exists() else np.zeros(ground.shape, dtype=bool)
    # Only the council's terrain has holes; a pilot extent is measured end to end.
    valid_path = args.terrain / "ground-valid.npy"
    valid = np.load(valid_path) if valid_path.exists() else None
    index = json.loads(args.addresses.read_text(encoding="utf-8"))
    try:
        artefact = build(ground, measured, buildings, index, valid)
    except AddressGroundError as error:
        print(str(error), file=sys.stderr)
        return 1
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes((json.dumps(artefact, separators=(",", ":")) + "\n").encode("utf-8"))
    counts = artefact["counts"]
    total = sum(counts.values())
    print(f"wrote {args.out}  ({args.out.stat().st_size / 1024:.0f} KB)")
    for state in ("falls", "unclear", "edge"):
        print(f"  {state:<8} {counts[state]:>6,}  {counts[state] / total:.1%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
