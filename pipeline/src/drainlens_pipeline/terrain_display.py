"""The ground surface as the map shows it, kept apart from the one the engine routes on.

`scene.py` ships the **conditioned** surface: filled flat across every hollow,
with every building raised a hundred metres, because that is the surface the
flow field belongs to. The map's Terrain layer used to read that array and undo
it for display — separating out the buildings by height, then fitting a colour
ramp to whatever ground was left in view. It could not undo the filling, so
every hollow the Low areas layer outlines was drawn level.

This writes what the Terrain layer needs instead, and nothing the engine reads:

- `ground.bin` — the raw ground surface, centimetres AHD, int16. Not filled and
  not raised.
- `buildings.bin` — the footprint mask, one bit per cell. Buildings are drawn
  as buildings, not as ground and not as a hundred-metre hill.
- `shade.bin` — a hillshade, one byte per cell, already attenuated where the
  ground was not measured.

**Every number here is fixed, not fitted to a view.** The colour a height is
drawn in is chosen in the browser from a fixed AHD ramp; the only statistic
taken from the data is the 1st and 99th percentile the hillshade is stretched
between, which is a property of this build and is written into the header with
the rest of the settings.

**The shading is attenuated where the ground was interpolated.** Under roofs
and canopy the surface is filled in from the nearest measured ground, and a
hillshade of an interpolation draws smooth slopes that nobody measured. Where
less than 35% of the surrounding 25 m was measured, the relief is drawn at 40%
of its strength; 0.35 is `COVERAGE_MIN_MEASURED`, the threshold the derived
layers already publish, not a new number.

The parameters are the terrain handover's (Terrain V1.1, §2.2). The four
azimuth weights and the strength are trial values it asks to be checked on flat
ground, a slope and a valley before they are frozen.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from scipy import ndimage

from .scene import ELEVATION_SCALE, SceneError, quantise_elevation

#: The sun, degrees above the horizon.
ALTITUDE_DEG = 45.0

#: Relief exaggeration. A residential floodplain is a few metres over hundreds;
#: at 1 the shading would be indistinguishable from flat.
VERTICAL_EXAGGERATION = 3.2

#: Azimuths, degrees clockwise from north, and their weights. The north-west
#: light carries most of it: equal weights from four sides invite relief
#: inversion, where a shadowed valley is read as a ridge.
AZIMUTH_WEIGHTS: tuple[tuple[float, float], ...] = (
    (315.0, 0.55),
    (270.0, 0.18),
    (360.0, 0.18),
    (225.0, 0.09),
)

#: The stretch, as percentiles of the combined hillshade over ground cells.
STRETCH_PERCENTILES = (1.0, 99.0)

#: Measured-coverage window and its smoothing, in cells (metres).
COVERAGE_WINDOW_CELLS = 25
COVERAGE_SIGMA_CELLS = 6.0

#: Below the lower coverage, relief is drawn at the minimum amplitude; by the
#: upper, at full strength. The lower is `COVERAGE_MIN_MEASURED`.
COVERAGE_LOW = 0.35
COVERAGE_FULL = 0.70
AMPLITUDE_MIN = 0.40


class TerrainDisplayError(SceneError):
    pass


def hillshade(ground: np.ndarray, *, cell_m: float = 1.0) -> np.ndarray:
    """Multi-directional hillshade in [0, 1], rows running north to south.

    The normal of each cell is built from central differences, exaggerated
    vertically, and lit from each azimuth in turn; faces turned away from a
    light get nothing from it rather than a negative.
    """
    if ground.ndim != 2:
        raise TerrainDisplayError(f"the ground surface is {ground.ndim}-dimensional")
    surface = ground.astype(np.float64) * VERTICAL_EXAGGERATION
    # Row 0 is the northern edge, so northing increases towards row 0.
    rise_south, rise_east = np.gradient(surface, cell_m)
    rise_north = -rise_south
    norm = np.sqrt(rise_east**2 + rise_north**2 + 1.0)
    nx, ny, nz = -rise_east / norm, -rise_north / norm, 1.0 / norm

    altitude = math.radians(ALTITUDE_DEG)
    total = np.zeros_like(surface)
    for azimuth_deg, weight in AZIMUTH_WEIGHTS:
        azimuth = math.radians(azimuth_deg)
        lx = math.sin(azimuth) * math.cos(altitude)
        ly = math.cos(azimuth) * math.cos(altitude)
        lz = math.sin(altitude)
        total += weight * np.clip(nx * lx + ny * ly + nz * lz, 0.0, 1.0)
    return total / sum(w for _, w in AZIMUTH_WEIGHTS)


def coverage_amplitude(measured: np.ndarray) -> np.ndarray:
    """How strongly relief is drawn at each cell, from the measured share around it."""
    share = ndimage.uniform_filter(measured.astype(np.float64), size=COVERAGE_WINDOW_CELLS, mode="nearest")
    share = ndimage.gaussian_filter(share, sigma=COVERAGE_SIGMA_CELLS, mode="nearest")
    ramp = np.clip((share - COVERAGE_LOW) / (COVERAGE_FULL - COVERAGE_LOW), 0.0, 1.0)
    return AMPLITUDE_MIN + (1.0 - AMPLITUDE_MIN) * ramp


def display_shade(
    ground: np.ndarray, measured: np.ndarray, buildings: np.ndarray
) -> tuple[np.ndarray, tuple[float, float]]:
    """The hillshade, stretched and attenuated, as bytes; and the stretch it used."""
    if not (ground.shape == measured.shape == buildings.shape):
        raise TerrainDisplayError(
            f"the ground is {ground.shape}, the measured mask {measured.shape} and the buildings {buildings.shape}"
        )
    raw = hillshade(ground)
    open_ground = ~buildings
    if not open_ground.any():
        raise TerrainDisplayError("every cell is a building, so there is no ground to shade")
    low, high = (float(v) for v in np.percentile(raw[open_ground], STRETCH_PERCENTILES))
    span = high - low if high > low else 1.0
    stretched = np.clip((raw - low) / span, 0.0, 1.0)
    attenuated = 0.5 + (stretched - 0.5) * coverage_amplitude(measured)
    return np.round(attenuated * 255).astype(np.uint8), (low, high)


def write(
    out_dir: Path,
    *,
    ground: np.ndarray,
    measured: np.ndarray,
    buildings: np.ndarray,
    extent: dict,
    source: dict,
) -> dict:
    """Write the three arrays and a header that says what each one is."""
    out_dir.mkdir(parents=True, exist_ok=True)
    shade, (low, high) = display_shade(ground, measured, buildings)
    rows, cols = ground.shape
    (out_dir / "ground.bin").write_bytes(quantise_elevation(ground).tobytes())
    (out_dir / "buildings.bin").write_bytes(np.packbits(buildings.astype(bool)).tobytes())
    (out_dir / "shade.bin").write_bytes(shade.tobytes())

    header = {
        "artefact": "terrain-display",
        "version": 1,
        "basis": "derived",
        "note": (
            "The ground surface for the map's Terrain layer only. It is the raw, unfilled "
            "surface; the scenario engine routes on a separate conditioned one. Heights are "
            "estimated from filtered aerial photography, about 25 cm vertically, and interpolated "
            "under roofs and canopy."
        ),
        "source": source,
        "grid": {"rows": rows, "cols": cols, "cellSizeM": 1.0, "origin": "north-west"},
        "extent": extent,
        "arrays": {
            "ground": {
                "file": "ground.bin",
                "type": "int16",
                "unit": "centimetres",
                "scale": ELEVATION_SCALE,
                "note": "Divide by the scale for metres AHD. The raw surface: not filled, buildings not raised.",
            },
            "buildings": {
                "file": "buildings.bin",
                "type": "bitmask",
                "note": "One bit per cell, most significant first, 1 inside a building footprint.",
            },
            "shade": {
                "file": "shade.bin",
                "type": "uint8",
                "note": (
                    "Hillshade, 0 to 255 for 0 to 1, already attenuated towards 0.5 where the "
                    "ground was not measured. Multiply, never lighten."
                ),
            },
        },
        "settings": {
            "altitudeDeg": ALTITUDE_DEG,
            "verticalExaggeration": VERTICAL_EXAGGERATION,
            "azimuthWeights": [[a, w] for a, w in AZIMUTH_WEIGHTS],
            "stretchPercentiles": list(STRETCH_PERCENTILES),
            "stretch": [round(low, 6), round(high, 6)],
            "coverageWindowM": COVERAGE_WINDOW_CELLS,
            "coverageSigmaM": COVERAGE_SIGMA_CELLS,
            "coverage": [COVERAGE_LOW, COVERAGE_FULL],
            "amplitudeMin": AMPLITUDE_MIN,
        },
        "stats": {
            "groundM": {
                "min": round(float(ground.min()), 2),
                "max": round(float(ground.max()), 2),
            },
            "buildingFraction": round(float(buildings.mean()), 4),
            "measuredFraction": round(float(measured.mean()), 4),
        },
    }
    # Bytes, not text: on Windows `write_text` turns every newline into CRLF.
    (out_dir / "terrain.json").write_bytes((json.dumps(header, indent=1) + "\n").encode("utf-8"))
    return header


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.terrain_display",
        description="Write the ground surface, buildings and hillshade the map's Terrain layer draws.",
    )
    parser.add_argument("--terrain", type=Path, default=Path("../data/terrain"))
    parser.add_argument("--out", type=Path, default=Path("../apps/web/public/data/terrain"))
    args = parser.parse_args(argv)

    manifest = json.loads((args.terrain / "terrain.json").read_text(encoding="utf-8"))
    box = manifest["extent"]
    extent = {
        "name": box["name"],
        "min_e": box["min_e"],
        "min_n": box["min_n"],
        "width_m": box["max_e"] - box["min_e"],
        "height_m": box["max_n"] - box["min_n"],
    }
    ground = np.load(args.terrain / "ground-surface.npy")
    measured = np.load(args.terrain / "ground-observed.npy")
    buildings_path = args.terrain / "barriers.npy"
    buildings = np.load(buildings_path) if buildings_path.exists() else np.zeros(ground.shape, dtype=bool)

    try:
        header = write(
            args.out,
            ground=ground,
            measured=measured,
            buildings=buildings,
            extent=extent,
            source=manifest.get("source", {}),
        )
    except SceneError as error:
        print(str(error), file=sys.stderr)
        return 1

    total = sum(path.stat().st_size for path in args.out.iterdir())
    print(f"wrote {args.out}  ({total / 1024:.0f} KB)")
    print(f"  ground {header['stats']['groundM']['min']} to {header['stats']['groundM']['max']} m AHD")
    print(f"  hillshade stretched between {header['settings']['stretch']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
