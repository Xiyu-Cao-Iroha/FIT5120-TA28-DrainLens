"""Pack the terrain into what the scenario engine loads in a browser.

The engine takes an elevation grid, a flow field, depression storage and a set
of drains. In the pipeline those are float64 rasters totalling ten megabytes,
which is not a thing to send anyone.

Measuring rather than assuming settled the shape of this. Quantised and
gzipped, the whole square kilometre is **1.27 MB**: elevation at 848 KB, flow
directions at 306 KB, depression labels at 46 KB and coverage at 68 KB. That is
small enough to ship whole, so the tiling this was going to need does not exist
— and the calculation window the interface draws stays a statement about what
the model looks at, not a workaround for a download.

Each array is its own file. A single packed blob would be one byte-offset
arithmetic mistake away from an elevation grid read as flow directions, and
nothing about that failure would look wrong until water ran uphill.

**The elevation shipped here is the conditioned surface, not the raw one**, and
that is the fork order arriving at the browser boundary. The engine walks cells
in descending elevation so that a cell is solved before whatever it drains
into; the flow field was computed on the conditioned surface, so ordering by
any other surface puts the two out of step. Water then arrives at a cell that
has already been visited, and is dropped.

Shipping the raw surface was tried, and 71.6% of the rain vanished: 40,000 m³
fell, 11,379 m³ was accounted for. The engine's mass-balance check caught it
and refused the comparison, which is the only reason it was not a plausible map
of where water goes. The raw surface's job ended when the depression capacities
were measured on it; those travel in the table.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

#: Elevation is stored as centimetres in an int16.
#:
#: The extent spans -3.29 to 29.84 m AHD, so centimetres fit with three orders
#: of magnitude to spare, and a centimetre is already an order finer than the
#: 25 cm the source quotes. Halves the payload against float32 for precision
#: the surface does not have.
ELEVATION_SCALE = 100.0

#: `-1` in the depression raster means "in no depression", which the engine
#: reads as `cellDepression` does.
NO_DEPRESSION = -1


class SceneError(Exception):
    pass


def quantise_elevation(elevation: np.ndarray) -> np.ndarray:
    lowest, highest = float(elevation.min()), float(elevation.max())
    limit = np.iinfo(np.int16)
    if lowest * ELEVATION_SCALE < limit.min or highest * ELEVATION_SCALE > limit.max:
        raise SceneError(
            f"elevations from {lowest:.2f} to {highest:.2f} m do not fit centimetres in an int16; "
            "an extent with real relief needs a different scale"
        )
    return np.round(elevation * ELEVATION_SCALE).astype(np.int16)


#: How far a drain may be moved onto the flow path near it, in metres.
#:
#: A pit position comes from an asset register and a flow path from a
#: photogrammetric surface. Neither is wrong; they simply do not agree to a
#: metre, and at a one-metre cell with single-path routing that disagreement is
#: the difference between a drain on the gutter and a drain on the footpath
#: beside it.
#:
#: Measured, not assumed. As recorded, the median inlet sits on a cell with
#: nine cells of catchment above it — it collects its own square metre of rain
#: and nothing else, so blocking it changes 0.024 m³ and no comparison can ever
#: show anything. Snapping to the highest-accumulation cell within one metre
#: lifts that median to 136 cells, within two to 463, within three to 1,028 —
#: about a thousand square metres draining through the inlet, which is what a
#: street inlet serves.
#:
#: Three metres is the choice because it is narrower than any road in the
#: extent, so a pit cannot snap across a kerb onto a different street's flow.
#: It is a stated tolerance on position, not a claim that the pit is elsewhere.
DRAIN_SNAP_M = 3.0


def snap_to_flow(
    cell: int, accumulation: np.ndarray, radius_m: float, cell_size_m: float
) -> int:
    """Move a drain to the busiest cell within the snapping radius."""
    rows, cols = accumulation.shape
    reach = int(round(radius_m / cell_size_m))
    if reach < 1:
        return cell

    row, col = divmod(cell, cols)
    top, bottom = max(0, row - reach), min(rows, row + reach + 1)
    left, right = max(0, col - reach), min(cols, col + reach + 1)
    window = accumulation[top:bottom, left:right]
    offset = int(np.argmax(window))
    return (top + offset // window.shape[1]) * cols + (left + offset % window.shape[1])


def drains_from(
    pits: list[dict],
    extent_width_m: float,
    extent_height_m: float,
    cell_size_m: float,
    accumulation: np.ndarray | None = None,
) -> list[dict]:
    """Map the pit layer onto grid cells, in the frame the engine indexes by.

    A pit outside the grid is dropped rather than clamped to an edge cell. A
    drain pinned to the boundary would take water from a place it does not
    serve, and the map would show a plausible pit doing it.
    """
    cols = int(round(extent_width_m / cell_size_m))
    rows = int(round(extent_height_m / cell_size_m))

    found: list[dict] = []
    for pit in pits:
        position = pit.get("c")
        if not position or len(position) != 2:
            continue
        col = int(position[0] // cell_size_m)
        row = rows - 1 - int(position[1] // cell_size_m)
        if not (0 <= row < rows and 0 <= col < cols):
            continue

        description = str(pit.get("asset_description") or "")
        found.append(
            {
                "assetNumber": str(pit.get("asset_number") or ""),
                "cell": (
                    snap_to_flow(row * cols + col, accumulation, DRAIN_SNAP_M, cell_size_m)
                    if accumulation is not None
                    else row * cols + col
                ),
                # Only an inlet can carry a surface blockage. The published
                # description is the only signal the source gives, so the rule
                # is stated here rather than guessed at in the browser.
                "isInlet": "entry" in description.lower() or "grated" in description.lower(),
            }
        )
    return found


def write(
    out_dir: Path,
    *,
    elevation: np.ndarray,
    direction: np.ndarray,
    depression_labels: np.ndarray,
    observed: np.ndarray,
    rim_depth: np.ndarray,
    depressions: list[dict],
    drains: list[dict],
    cell_size_m: float,
    extent: dict,
) -> dict:
    """Write the scene files and return the header describing them."""
    rows, cols = elevation.shape
    for name, array in (
        ("flow direction", direction),
        ("depression labels", depression_labels),
        ("coverage", observed),
    ):
        if array.shape != elevation.shape:
            raise SceneError(f"the {name} grid is {array.shape} but the elevation is {elevation.shape}")

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "elevation.bin").write_bytes(quantise_elevation(elevation).tobytes())
    (out_dir / "flow.bin").write_bytes(direction.astype(np.int8).tobytes())
    (out_dir / "depressions.bin").write_bytes(depression_labels.astype(np.int16).tobytes())

    # Coverage and measurement are different questions, and conflating them
    # stops the engine dead. `coverage` asks whether a terrain artefact exists
    # at a cell; the engine refuses to compare over a window that is not fully
    # covered, because a partial window is not comparable with a full one.
    # `measured` asks whether the ground there was seen rather than
    # interpolated between rooftops — a confidence signal for the interface,
    # not a reason the model cannot route water.
    #
    # Shipping the measured mask as coverage was tried, and made every scenario
    # in the extent return `terrain_unavailable`: 52.1% measured is below any
    # sane coverage threshold, while the artefact in fact covers all of it.
    covered = np.ones(elevation.shape, dtype=bool)
    (out_dir / "coverage.bin").write_bytes(np.packbits(covered).tobytes())
    (out_dir / "measured.bin").write_bytes(np.packbits(observed).tobytes())

    # The shape of each hollow, as centimetres below its own rim.
    #
    # A capacity alone tells the engine how much a depression holds and nothing
    # about where. It could only spread the water evenly, and evenly is wrong in
    # the way that hides this product's subject: the few cubic metres a blocked
    # drain releases into a two-hectare hollow become a quarter of a millilitre
    # per cell, and every comparison reports no clear change. With the shape,
    # water finds a level and the change concentrates where it would.
    (out_dir / "rim-depth.bin").write_bytes(rim_depth.tobytes())

    header = {
        "artefact": "scene",
        "version": 1,
        "grid": {"rows": rows, "cols": cols, "cellSizeM": cell_size_m, "origin": "north-west"},
        "extent": extent,
        "arrays": {
            "elevation": {
                "file": "elevation.bin",
                "type": "int16",
                "unit": "centimetres",
                "scale": ELEVATION_SCALE,
                "note": (
                    "Divide by the scale for metres AHD. Centimetres because the source is "
                    "quoted at 25 cm, so storing more precision would be storing noise."
                ),
            },
            "flow": {"file": "flow.bin", "type": "int8", "note": "D8 code 0-7, or -1 where water leaves the window."},
            "depressions": {
                "file": "depressions.bin",
                "type": "int16",
                "note": f"Depression id per cell, {NO_DEPRESSION} where the cell is in none.",
            },
            "coverage": {
                "file": "coverage.bin",
                "type": "bitmask",
                "note": (
                    "One bit per cell, most significant first, 1 where a terrain artefact "
                    "covers the cell. This is what the engine gates on, and it is not the "
                    "same question as whether the ground there was measured."
                ),
            },
            "rim-depth": {
                "file": "rim-depth.bin",
                "type": "int16",
                "unit": "centimetres",
                "scale": ELEVATION_SCALE,
                "note": (
                    "How far each cell sits below the rim of its depression. Zero outside "
                    "one. This is the shape a capacity cannot carry: without it the engine "
                    "can only spread a hollow's water evenly over its whole footprint."
                ),
            },
            "measured": {
                "file": "measured.bin",
                "type": "bitmask",
                "note": (
                    "1 where the ground was measured rather than interpolated. A confidence "
                    "signal for the interface. Passing this to the engine as coverage makes "
                    "every scenario report terrain_unavailable, because 52.1% of a covered "
                    "extent looks like a hole in it."
                ),
            },
        },
        "depressions": depressions,
        "drains": drains,
        "note": (
            "Everything here is derived from a filtered photogrammetric surface. The elevations "
            "are not survey levels and the flow directions are not observed flow. The engine "
            "compares two assumptions over this surface and reports the difference; it does not "
            "report depth."
        ),
    }
    (out_dir / "scene.json").write_text(json.dumps(header, separators=(",", ":")), encoding="utf-8")
    return header


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    from .geo import DEMONSTRATION_EXTENT
    from .derived import flow_accumulation
    from .hydrology import condition, fill

    parser = argparse.ArgumentParser(
        prog="python -m drainlens_pipeline.scene",
        description="Pack the terrain artefacts into the scene the browser engine loads.",
    )
    parser.add_argument("--terrain", type=Path, default=Path("../data/terrain"))
    parser.add_argument("--map", type=Path, default=Path("../data/map/map.json"))
    parser.add_argument("--out", type=Path, default=Path("../data/scene"))
    args = parser.parse_args(argv)

    def log(message: str) -> None:
        print(message, file=sys.stderr)

    extent = DEMONSTRATION_EXTENT
    # The conditioned surface, because the flow field belongs to it. See the
    # module docstring: ordering by any other surface loses water.
    raw = np.load(args.terrain / "ground-surface.npy").astype(np.float64)
    barriers_path = args.terrain / "barriers.npy"
    barriers = np.load(barriers_path) if barriers_path.exists() else None
    elevation = condition(raw, barriers)

    # The shape of each hollow: how far every cell sits below the level its
    # depression fills to. Measured on the raw surface, like the capacities,
    # because that is where a hollow has a shape at all — the conditioned
    # surface is flat across every one of them by construction.
    labels = np.load(args.terrain / "depression-cells.npz")["labels"]
    inside = labels >= 0
    rim_depth = np.zeros(raw.shape, dtype=np.int16)
    rim_depth[inside] = np.round((fill(raw)[inside] - raw[inside]) * ELEVATION_SCALE).astype(np.int16)
    map_artefact = json.loads(args.map.read_text(encoding="utf-8"))
    pits = map_artefact.get("layers", {}).get("pit", [])

    accumulation = flow_accumulation(np.load(args.terrain / "flow-direction.npy"), elevation)
    drains = drains_from(pits, extent.width_m, extent.height_m, 1.0, accumulation)
    inlets = sum(1 for d in drains if d["isInlet"])
    log(f"Packing the scene for {extent.name}")
    log(f"  {len(drains):,} drains on the grid, {inlets:,} of them inlets")

    header = write(
        args.out,
        elevation=elevation,
        direction=np.load(args.terrain / "flow-direction.npy"),
        depression_labels=labels,
        rim_depth=rim_depth,
        observed=np.load(args.terrain / "ground-observed.npy"),
        depressions=json.loads((args.terrain / "depressions.json").read_text(encoding="utf-8")),
        drains=drains,
        cell_size_m=1.0,
        extent={
            "name": extent.name,
            "min_e": extent.min_e,
            "min_n": extent.min_n,
            "width_m": extent.width_m,
            "height_m": extent.height_m,
        },
    )

    total = sum(path.stat().st_size for path in args.out.iterdir())
    log(f"  {len(header['depressions']):,} depressions, {total / 1024:.0f} KB on disk")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
