# Demonstration extent and address — proposal

DrainLens · TA28 · 27 August 2026 · **decided and built**

> This was written as a proposal. The recommendation below was adopted and everything downstream — the terrain surface, the drainage graph, the map geometry, the trace and the scene pack — is built from it. It is kept as written because the *reasoning* is what a reader needs; the extent itself now lives as data in `pipeline/geo.py`, which is authoritative.
>
> One figure has moved. The **22-hop** downstream trace quoted below was measured against the council-wide graph. Inside the mapped square kilometre a trace from the nearest inlet is shorter, because the record leaves the extent before it runs out; the trace artefact reports which of the two happened rather than merging them.

Chosen from the data rather than by eye. Every figure below was measured against the drainage export, the address export and the point cloud itself.

---

## Recommendation

**Extent** — 1 km × 1 km, MGA Zone 55

| | |
|---|---|
| Corners | **316,500 – 317,500 E · 5,814,500 – 5,815,500 N** |
| Tiles | `Tile_+007_+015`, `Tile_+008_+015`, `Tile_+007_+016`, `Tile_+008_+016` |
| Suburb | **Kensington**, 98% of addresses in the block |
| Inlet-type pits | **454** |
| Traceable pipes | **698** (both endpoints resolve) |
| Addresses | **4,115** |
| Download | four tiles, well under 200 MB out of a 4.33 GB archive |

**Demonstration address** — **46 Gatehouse Drive, Kensington**

| | |
|---|---|
| Inlet-type pits within 150 m | **62** |
| Nearest inlet | **24 m** |
| Downstream trace from that inlet | **22 hops** before it ends |

**Reserve address** — **13 Neale Street, Kensington**: 71 inlets within 150 m, nearest at 3 m, an 18-hop trace. Denser but a shorter path; use it if Gatehouse Drive disappoints on the real terrain.

---

## Why Kensington and not the CBD

The densest drainage in the City of Melbourne is the CBD — 884 inlets in one square kilometre, nearly twice Kensington's. It is still the wrong choice, for three reasons that only showed up when the data was measured.

**The camera cannot see the ground there.** D2 established that the point cloud is photogrammetric rather than LiDAR. Sampling the lowest point in every 10 m cell shows what that means in practice:

| Block | Median height above the cell floor | Cells that are open ground |
|---|---|---|
| Melbourne CBD | **12–17 m** | **11–17%** |
| Carlton | 7–11 m | 20–31% |
| North Melbourne | 8–9 m | 11–22% |
| **Kensington** | **6–7 m** | **5–31%** |

In the CBD the surface is towers, and the apparent 45–60 m of "relief" in a 500 m tile is mostly roofs in cells where no ground is visible at all. Kensington is low-rise: the ground the scenario model needs to route water over is largely **measured** rather than interpolated.

**Kensington is genuinely low-lying.** Ground in the two western tiles sits at **0.6 to 7.4 m AHD**, with 2.7 to 6.8 m of relief across a tile — a flat, low block near the Maribyrnong where surface water has somewhere to go and somewhere to collect. The CBD's ground rises 30 m from the river to Latrobe Street, which is real but is regional slope rather than the local depressions Epic 2 compares against.

**Our persona is a resident, and the CBD is offices.** Kensington's block is 98% one residential suburb with 4,115 addresses. A demonstration that opens on a street of houses matches the problem statement; one that opens on Collins Street does not.

---

## The tie the team already has

The Problem Statement's own evidence list includes the ABC report on **Kensington Banks** and new Melbourne Water flood mapping — residents told their homes are newly flagged, and worried about what it means for them. The street names the analysis surfaced are that estate: **Gatehouse Drive, McAllister Mews, Stockmans Way, Fairbairn Drive**.

We did not pick Kensington to fit the story. The measurements pointed there, and the story was already on file.

This also settles **D1b**, the open question about the persona. Daniel Chan lives in Lilydale, outside any council that publishes drainage data. Moving him to Kensington puts him inside the pilot area and inside the evidence the project already cites, without inventing anything.

---

## What this does not fix

**Kensington's eastern tiles are not as good as its western ones.** `Tile_+008_+016` shows only 5% open cells and 25 m of spread — that corner runs into the rail corridor and the rise toward Flemington. If the terrain filtering struggles anywhere in this block, it will struggle there. The demonstration address sits in the west, and rung 4 of the descope ladder — shrinking to 500 m — would drop the eastern half and keep everything the demonstration needs.

**454 inlets is fewer than the CBD's 884**, and 698 traceable pipes fewer than 1,366. This is ample for a demonstration and would matter if the pilot were being chosen for coverage rather than for a demonstration.

---

## How this was measured

Reproducible, and worth repeating if the choice is questioned.

1. The point-cloud archive lists 215 tiles individually and S3 serves range requests, so tile extents and headers were read without downloading 4.33 GB.
2. `Tile_+007_+003` reports X 316,500–317,000 and Y 5,808,500–5,809,000, which fixes the grid origin at 313,000 E / 5,807,000 N with 500 m tiles.
3. Every pit in the drainage export was projected to MGA55 and assigned to a tile; every pipe with both endpoints resolving was assigned to a tile pair.
4. All 63,721 addresses were exported and assigned the same way, giving the suburb composition of each block.
5. Every 2 × 2 block of tiles present in the archive was scored on inlet-type pits, traceable pipes and addresses.
6. For the shortlist, the lowest point in each 10 m cell was sampled to approximate the ground, and the height above it to measure how much of the block is built over.
7. Candidate addresses were ranked by inlets within 150 m and by how many hops the downstream trace runs before it ends.

Scripts are in the session scratchpad; the address export is the same file the address index (W1) needs.

---

## Decide today

The terrain build is the critical path and cannot start without an extent. If Kensington is accepted, the four tiles can be pulled and ground-surface filtering can begin immediately.

If the team prefers the CBD for its asset density, that is a defensible choice, but it should be made knowing that the terrain under it is largely inferred rather than measured, and the interface will have to say so.
