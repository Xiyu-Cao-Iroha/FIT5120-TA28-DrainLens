# apps/web

The browser application.

```bash
npm run dev --workspace @drainlens/web     # http://localhost:5183
npm run check                              # typecheck and the whole suite, from the repo root
```

## What is here

**Session state** (`src/session.ts`) — a reducer over the address, the chosen task, the scenario inputs and the outcome. Every navigation goes through it, so the rule that the address never reaches storage is enforced in one tested place.

**Address search** (`src/address/`) — normalisation, scoring and a `resolve` that returns four outcomes rather than two: `found`, `ambiguous`, `outside-pilot`, `not-an-address`. Runs against an index shipped with the site and never calls the network.

**The map** (`src/map/`) — the viewport transform, hit testing, drawing, and the React component that binds them to a canvas. Roads, pipes, pits and street labels; a ground-surface layer painted once from the scene's elevation array and drawn beneath them; and the three derived layers over the top. `nearby.ts` measures the closest derived path and low area to an address so the panel can say, in words, where water may move.

**The downstream trace** (`src/trace/`) — traversal of the recorded drainage with a reason at every place a path stops, and its rendering with direction arrows read from the topology.

**The scenario** (`src/scenario/`) — scene loading, the Web Worker the engine runs in, and every user-facing sentence held as data in `outcome.ts`.

**The street cross-section** (`src/crosssection/`) — what a section may claim about one pit, which is mostly a question about what the record does *not* hold. No invert level exists for any pit in this area, so the drawing splits itself: horizontal is recorded, vertical is illustrative.

**Screens** (`src/screens/`) — landing and address search, task selection, the map with its pit detail panel and cross-section, scenario setup, and the result.

**The data credit** (`src/ui/attribution.ts`) — read from the artefacts and shown on every screen. CC BY 4.0 requires the attribution to be visible to the person using the work, and it includes the clause people skip: an indication that changes were made.

**All 77 interaction criteria are met.** What is not built: the mobile layouts, and Playwright coverage of the remaining navigation paths.

## Two decisions worth knowing before you change anything

### The address never leaves memory

Address, task and scenario inputs live in one object for the life of the tab. Not `localStorage`, not `sessionStorage`, not the URL, not `history.state`. That follows from AD1 — no accounts, no identity — and an address written to any of those is an identity left on a shared machine after the person has gone.

The rule is enforced by behaviour, not by reading the source. `session.test.ts` stubs traps in place of both storages, `history` and `document.cookie`, plays a thirteen-event session through the reducer and asserts nothing was written. **A grep for `localStorage` is a rule a refactor walks around; a trap is not.**

A guidance preference is a different kind of thing — "I have read the help box" says nothing about who or where someone is — and when one is added it belongs in its own module, so the rule here can stay absolute.

### There is no map library

The extent is a fixed square kilometre, north-up, and the pipeline ships its geometry as **metres east and north of the extent's south-west corner**. So there is no global projection, no tile pyramid, no level-of-detail switching and no third-party basemap. What is left is an affine transform and a draw call.

MapLibre is several hundred kilobytes solving problems this product does not have. The streets come from the City's own road-corridor polygons, baked into the artefact, so nothing at runtime depends on a tile server being up, licensed or free.

The cost is that panning, zooming, hit testing and label placement are ours. All four are arithmetic in a metre-based frame and all four are unit-tested.

## The one sign that must not be duplicated

Northing increases up the map. A canvas `y` increases down it. That flip lives in `toScreen` and `toLocal` and nowhere else.

A second copy of it mirrors one layer and not another, and a mirrored map **renders, pans, and points at the wrong house** — there is no crash and no blank screen to notice. `viewport.test.ts` asserts north is up, east is right, the extent corners land where they should, and that a point survives a round trip; flipping the sign deliberately fails four of them.

The same class of mistake bit the street labels: the code computed a screen angle and the drawing negated it, so every name tilted the wrong way against its street. It looked almost right until a test asked which way a north-east street runs.

## Testing what a canvas draws

Pixels are not compared. What goes wrong in drawing is order and omission — a pit painted under a road polygon is an invisible pit, and a layer culled by an inverted comparison is a blank map — and both show up in the sequence of calls. `drawMap.test.ts` passes a recording context and asserts on that sequence.

## The artefacts

Everything under `public/data/` is a build product of the Python pipeline, **committed rather than ignored** so the frontend runs from a clone without a Python toolchain. `/data` at the repository root is the ignored one; these are the clipped, published copies.

| File | Size | Built by |
|---|---:|---|
| `map.json` | 318 KB | `drainlens_pipeline.network` |
| `derived.json` | 183 KB | `drainlens_pipeline.derived` |
| `trace.json` | 37 KB | `drainlens_pipeline.trace` |
| `addresses.json` | 3 KB | `drainlens_pipeline.address_fixture` *(a stand-in — see below)* |
| `scene/` | 1.28 MB gzipped | `drainlens_pipeline.scene` |

Rebuild one when the extent changes, for example:

```bash
cd pipeline
./.venv/Scripts/python.exe -m drainlens_pipeline.network --out ../apps/web/public/data/map.json
```

**The address index is a fixture.** It carries the real street names from the map artefact and the two real recorded demonstration addresses; nothing in it is invented, and it declares `artefact: "address-index-fixture"` so it cannot be mistaken for the real one. Replace it with `python -m drainlens_pipeline.addresses` once the portal's rate limit clears.

Each artefact is checked before anything draws it — `assertUsable`, `assertDerived`, `assertTrace`, `assertScene`. Nothing goes on screen without a basis, and an artefact that cannot say where its contents came from cannot be displayed at all. `assertDerived` and `assertTrace` go further and refuse an artefact whose declared basis is the wrong one, because both layers are labelled on screen and a mislabelled basis is a false claim rather than a rendering bug.

## Vite is pinned to 6

The rolldown-based Vite 7 rejects `@vitejs/plugin-react`'s refresh wrapper with `Missing field moduleType`. Unpin it after the demonstration, not before.
