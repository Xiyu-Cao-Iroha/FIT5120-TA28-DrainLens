# apps/web

The browser application.

```bash
npm run dev --workspace @drainlens/web     # http://localhost:5183
npm run check                              # typecheck and the whole suite, from the repo root
```

## What is here so far

**Session state** (`src/session.ts`) — a reducer over the address, the chosen task, the scenario inputs and the outcome.

**The map** (`src/map/`) — the viewport transform, hit testing, the drawing, and the React component that binds them to a canvas.

Not yet: address search, the task-selection page, the scenario setup, the result screen, the derived terrain layers.

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

## The map artefact

`public/data/map.json`, 318 KB, built by `python -m drainlens_pipeline.network`. It is committed rather than ignored so the frontend runs from a clone without a Python toolchain. Rebuild it when the extent changes:

```bash
cd pipeline
./.venv/Scripts/python.exe -m drainlens_pipeline.network --out ../apps/web/public/data/map.json
```

`assertUsable` refuses an artefact that names no sources. Nothing goes on screen without a basis, and an artefact that cannot say where its contents came from cannot be displayed at all.

## Vite is pinned to 6

The rolldown-based Vite 7 rejects `@vitejs/plugin-react`'s refresh wrapper with `Missing field moduleType`. Unpin it after the demonstration, not before.
