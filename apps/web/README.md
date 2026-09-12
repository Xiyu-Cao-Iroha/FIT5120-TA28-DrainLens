# apps/web

The browser application.

```bash
npm run dev --workspace @drainlens/web     # http://localhost:5183
npm run check                              # typecheck and the whole suite, from the repo root
```

## What is here

**Session state** (`src/session.ts`) — a reducer over the address, the way in, the map mode, the page the map was opened from, and the scenario inputs. Every navigation goes through it, so the rule that the address never reaches storage is enforced in one tested place. It also records which of its screens are unreachable and why: four of the eight are, deliberately, and a union half dead is worth annotating rather than leaving to a grep.

**Address search** (`src/address/`) — normalisation, scoring and a `resolve` that returns four outcomes rather than two: `found`, `ambiguous`, `outside-pilot`, `not-an-address`. Runs against an index shipped with the site and never calls the network.

**The map** (`src/map/`) — the viewport transform, hit testing, drawing, and the React component that binds them to a canvas. Roads, pipes, pits and street labels; a ground-surface layer painted once from the scene's elevation array and drawn beneath them; and the three derived layers over the top. `nearby.ts` measures the closest derived path and low area to an address so the panel can say, in words, where water may move. `difference.ts` paints where a finished comparison puts more water than its baseline — flat violet, because AD7 allows one output and it is *where*, not how much, so a ramp would invite reading a quantity off a legend this product does not publish.

**The downstream trace** (`src/trace/`) — traversal of the recorded drainage with a reason at every place a path stops, and its rendering with direction arrows read from the topology.

**The scenario** (`src/scenario/`) — scene loading, the Web Worker the engine runs in, and every user-facing sentence held as data in `outcome.ts`.

**The street cross-section** (`src/crosssection/`) — what a section may claim about one pit, which is mostly a question about what the record does *not* hold. No invert level exists for any pit in this area, so the drawing splits itself: horizontal is recorded, vertical is illustrative.

**Screens** (`src/screens/`) — the homepage, the map with its pit detail panel and cross-section, the historical flood board, the guide's four-card chooser, and the notice in front of the whole map. Also the address screen, the task question, the scenario setup and the result.

Those last four spent Iteration 1 off every route — the first two replaced by the homepage's cards and the map's own search bar, the last two being the drain-blockage comparison AC 1.1.1 required to be absent. **All four are back**, and putting them back needed more than an entry: `screen: 'task'` is only reached by giving an address with no guide section running, and after the homepage was rebuilt around the guide, every route to the address screen set one. So the homepage's comparison card carries a *pending task* through the address screen, the way a chosen guide section already did, and an address given for nothing in particular still lands on the task question.

**The guided tutorial** (`src/tutorial/`) — three lessons over the real map, one per information mode, held as data: a lesson is a list of steps, each with a requirement the map can satisfy and a chip it unlocks. `lesson.ts` is the machinery, `lessons.ts` the registry, and `GUIDED_SECTIONS` is derived from it so a card cannot offer a lesson nobody wrote. The map is **locked** while a lesson runs — no pan, no zoom, scale bar only — because a step that says *find the low point near you* is not answerable on a map somebody has dragged somewhere else.

**Where an artefact comes from** (`src/data/`) — the API first, the copy in this container second, with the footer naming which one answered. `fetchTogether` is the part worth reading: three artefacts describing the same place must all come from the same side, because a council map drawn with a Kensington trace is worse than either alone.

**The flood history** (`src/history/`) — the artefact behind the board, and the checks that refuse it. Those checks are strict about *sentences* as well as numbers: no reporting period, no geographic unit, no source, or no note saying what a count is, and the page does not render. A ranked list of suburbs with nothing qualifying it is the one shape that page must never take.

**The data credit** (`src/ui/attribution.ts`) — read from the artefacts and shown on every screen. CC BY 4.0 requires the attribution to be visible to the person using the work, and it includes the clause people skip: an indication that changes were made.

**Iteration 1 finished at Epic 1 70 of 71 and Epic 2 25 of 25**, against *Epic 1-2 Revised (2)*, and is frozen at `138a002`. The single open item is AC 1.1.4.c, a deliberate deviation recorded in [ITERATION-1-ACCEPTANCE.md](../../docs/ITERATION-1-ACCEPTANCE.md): the map has no Drainage mode, because pits and pipes are chips of their own.

**Iteration 2 is Epic 3 and Epic 4 — 134 sub-criteria against 96** — and its criteria and work breakdown are in [ITERATION-2-ACCEPTANCE.md](../../docs/ITERATION-2-ACCEPTANCE.md) and [ITERATION-2-TASKS.md](../../docs/ITERATION-2-TASKS.md). Counting what is met here would be a second copy of a checklist that already exists; the honest summary is that Epic 3 is a built feature being reconnected and extended, and Epic 4 is a new one.

What is still not built: the mobile layouts, and Playwright coverage of the navigation paths.

## Two decisions worth knowing before you change anything

### The address never leaves memory

Address, task and scenario inputs live in one object for the life of the tab. Not `localStorage`, not `sessionStorage`, not the URL, not `history.state`. That follows from AD1 — no accounts, no identity — and an address written to any of those is an identity left on a shared machine after the person has gone.

The rule is enforced by behaviour, not by reading the source. `session.test.ts` stubs traps in place of both storages, `history` and `document.cookie`, plays a thirteen-event session through the reducer and asserts nothing was written. **A grep for `localStorage` is a rule a refactor walks around; a trap is not.**

A guidance preference is a different kind of thing — "I have read the help box" says nothing about who or where someone is — and when one is added it belongs in its own module, so the rule here can stay absolute.

### There is no map library

An extent is a rectangle, north-up, and the pipeline ships its geometry as **metres east and north of that extent's own south-west corner**. So there is no global projection, no tile pyramid, no level-of-detail switching and no third-party basemap. What is left is an affine transform and a draw call.

**It stopped being one square kilometre and the transform did not change.** The map is the whole City of Melbourne — 8.5 by 9 km, 21,113 pits and 17,242 pipes — whenever the database answers, and the Kensington square kilometre in this container when it does not. What the extent grew into instead was a frame problem: every artefact's coordinates are relative to *its own* corner, so the address index built for Kensington put every pin 1.5 km west and 6 km south of the house when it was drawn over the council map. `address/search.ts` now shifts an index into the frame of the map it is drawn on, and refuses if it does not fit.

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
| `addresses.json` | 81 KB, 30 KB gzipped | `drainlens_pipeline.addresses` |
| `flood-history.json` | 5 KB | `drainlens_pipeline.flood_history` |
| `scene/` | 7.00 MB, 1.33 MB gzipped | `drainlens_pipeline.scene` |

`scene/` is the outlier and still does not load on a first visit: the scenario worker that reads it starts only on the two comparison screens. Those are reachable again — the homepage offers the comparison for Epic 3 — so it is now a load somebody asked for rather than one nobody could trigger.

The three council artefacts are not here. They are in `apps/api/data/city-of-melbourne/`, where the API's Dockerfile copies them from, because `/data` is ignored by both git and Docker: `map.json` 6.67 MB, `trace.json` 693 KB, `derived.json` 210 KB.

`flood_history` is the one stage that fetches its own sources rather than reading what an earlier stage wrote — two published files, neither a local export. See [FLOOD-HISTORY-DATA.md](../../docs/FLOOD-HISTORY-DATA.md) for what they are and what they do not support.

Rebuild one when the extent changes, for example:

```bash
cd pipeline
./.venv/Scripts/python.exe -m drainlens_pipeline.network --out ../apps/web/public/data/map.json
```

**The address index travels grouped by street**, which is why it is 81 KB rather than the 678 KB it was: a flat list repeated every street name once per house. **It is the real one** — 4,089 addresses across 132 streets, from the council's `street-addresses` dataset. Its `streets` list is deliberately wider than the streets that have addresses: it also carries the map's street names, so a real street just outside the addressed area is told it is outside the pilot rather than told it does not exist.

Each artefact is checked before anything draws it — `assertUsable`, `assertDerived`, `assertTrace`, `assertScene`, `assertFloodHistory`. Nothing goes on screen without a basis, and an artefact that cannot say where its contents came from cannot be displayed at all. `assertDerived` and `assertTrace` go further and refuse an artefact whose declared basis is the wrong one, because both layers are labelled on screen and a mislabelled basis is a false claim rather than a rendering bug.

## Vite is pinned to 6

The rolldown-based Vite 7 rejects `@vitejs/plugin-react`'s refresh wrapper with `Missing field moduleType`. Unpin it after the demonstration, not before.
