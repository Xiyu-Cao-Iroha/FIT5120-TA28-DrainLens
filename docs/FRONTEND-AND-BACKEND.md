# What the frontend does, and what the backend does

DrainLens · TA28 · written 13 October 2026 against `develop`

A map of the parts, for somebody who has to answer "where does this happen?" without reading the code. The drawn version of the same thing is [architecture.svg](./architecture.svg).

[INTERFACE-CONTRACT.md](./INTERFACE-CONTRACT.md) is the companion to this one and says what may cross the boundary, field by field. **Read its date before quoting it**: it was written on 30 August 2026 and last re-checked on 14 September, so it predates `POST /api/addresses/search` and `POST /api/chat`, and its claim that the boundary is "deliberately almost empty" was true of the product it described.

---

## The short answer

| Part | Where it runs | What it is for |
| --- | --- | --- |
| **Frontend** | the reader's browser | Draws every map, holds the address, runs the blockage comparison, builds the plan and the report, and keeps all of it out of any server |
| **API** | Cloud Run, `drainlens-api` | Serves four artefacts rebuilt from database rows, answers one submitted address search, and passes a question to the assistant |
| **Database** | Cloud SQL, Postgres 16 | Holds those artefacts as rows. **Derived, on purpose**: every row is rebuilt from files in this repository |
| **Assistant** | Cloud Run, `drainlens-ai` | Answers a question about getting ready, from approved official guidance. Private: reachable only through the API |
| **Pipeline** | a laptop, before anything is deployed | Turns council open data into the artefacts the other four read. **Build time, not request time** |

**The honest summary is that this product is mostly frontend.** The map, the layers, the water paths, the comparison, the plan and the report are all computed or drawn in the browser, from files that were computed before the deployment. The backend exists so the map can be the whole council instead of one square kilometre, and so an address search is backed by the same database the rest is served from.

---

## The frontend

`apps/web`, a Vite build of React and TypeScript, served as static files by nginx in its own container (`deploy/nginx.conf`). Three shared packages go into it: `@drainlens/address`, `@drainlens/scenario` and `@drainlens/schema`.

### What it draws

Every map is a `<canvas>` the browser paints itself, from geometry in metres. Nothing is a map tile from a third party, and nothing is a screenshot.

| Layer | Drawn from |
| --- | --- |
| Drain pits, drain pipes, roads, street names | council records, `map.json` |
| Water paths, low areas, ground data gaps | calculated by DrainLens, `derived.json` |
| Ground height, contours, spot heights | pre-coloured WebP tiles plus `marks.json` per tile |
| The recorded downstream path from a pit | `trace.json`, walked in the browser |
| The subcatchment boundary and its figures | `subcatchments.json` and `address-catchments.json` |
| Before-rain check markers and the 200 m ring | `warnings/<extent>.json`, numbered in the browser |
| The flood history ranking and the area map | `flood-history.json`, `sa2-areas.json`, `flood-events.json` |

### What it computes

- **The blockage comparison.** `@drainlens/scenario` is pure computation with no DOM, and a Web Worker is a thin wrapper around it. The terrain grid, the flow solve and the two results all happen in the reader's own machine.
- **Which places to check.** The markers within 200 m of the address are chosen, numbered and limited to three in the browser.
- **The address match.** `@drainlens/address` holds the packed index and the matcher. Suggestions are answered from memory on every keystroke.
- **The printed plan and the report summary.** Built as a string in the page and printed from a hidden frame. Nothing is uploaded and no file is fetched to make them.

### What it deliberately never does

- **It never sends the address anywhere while you type.** A request per character would send somebody's home address to a server one letter at a time to answer a question already answered locally.
- **It never stores the address.** Not in local storage, not in session storage, not in the URL, not in history state. Local storage holds two keys in total: `drainlens.learned`, six `0`/`1` characters, and `drainlens.tour.seen`.
- **It never keeps your answers.** The before-rain selections live for the life of the tab and are gone on reload, which is a criterion rather than a bug (AC 5.4.1).
- **It never goes blank when a server does not answer.** See [when a part is missing](#when-a-part-is-missing).

---

## The API

`apps/api`, a Hono server on Node, in its own container on Cloud Run, over Cloud SQL. Seven routes and no more.

| Route | What it does |
| --- | --- |
| `GET /health` | Says it is up and how much it holds: `{"status":"ok","pits":21113,"areas":30,"scopeAreas":281}` |
| `GET /api/map/:extent` | The drainage geometry, rebuilt from rows |
| `GET /api/derived/:extent` | The calculated layers, rebuilt from rows |
| `GET /api/trace/:extent` | The pipe graph the downstream path is walked over |
| `GET /api/flood-history` | The ranked areas and their counts |
| `POST /api/addresses/search` | One submitted address, resolved against the database |
| `POST /api/chat` | One question, passed to the assistant |

**The four `GET` artefacts are the whole reason the API exists.** The container ships `kensington`, one square kilometre with 895 pits. The database holds `city-of-melbourne`, 76.5 km² with 21,113. When the API answers, the map is the council; when it does not, the map is the square kilometre and the footer says so.

A rebuilt artefact is memoised for ten minutes per route, because the map and derived routes took 2.5 and 3 seconds before that, and `/api/*` is compressed, which took the council map route to 5.7 times smaller on the wire.

### Address search, and the line it draws

The index stays in the browser. What goes to the API is **one** request, when a search is submitted, and both ends run the same matcher from `@drainlens/address`, so the fallback is the same answer by a different route rather than a lesser one.

This is also the reason the landing page no longer promises that the address stays in the browser: it is true of every keystroke and not true of the submit. That correction is recorded in `DECISIONS-PENDING.md` §14.

### The chat route is a proxy and nothing else

`POST /api/chat` takes `{ message }`, refuses anything that is not a non-empty string, gets a Google ID token, and posts to the assistant's own `/chat`. Any failure upstream becomes a flat `502` with a generic sentence, so an upstream error message never reaches the browser. The assistant is private and is not reachable from the internet except through this route.

---

## The database, and why it has no backups

Postgres 16 on Cloud SQL, created with `--no-backup`, and that is a decision rather than an oversight.

**Every row is derived from `apps/web/public/data/*.json`, which is in this repository.** A migration job rebuilds the whole database from a checkout in one execution. A backup of a derived database is a paid copy of something already in git.

`deploy/API-DEPLOYMENT.md` records this, and names the condition that would make it wrong: the day anything is written there that is not in the repository. Nothing the reader does writes to it. There is no user table, no session table and no log of what anybody searched.

---

## The assistant

`assistant/`, a separate service by a teammate, deployed as `drainlens-ai`. It answers flood preparation questions from approved official guidance (VICSES, Melbourne Water, City of Melbourne) by retrieving the relevant passages and generating an answer from them.

Two operational facts worth knowing before a demonstration:

- It holds no minimum instance and fetches a 79 MB model on a cold start, so **the first question after an idle period takes over a minute**. A warm one takes 11 to 15 seconds. The panel says `Finding an answer in the official guides…` throughout, so nobody meets a blank screen.
- **Ask it one question before the demonstration** to warm it. `--min-instances=1` is the fix and it costs money for as long as it is set.

---

## The pipeline, which is the part people forget

`pipeline/`, Python, run on a laptop before anything is deployed. It is where most of the real computation lives, and none of it happens while anybody is using the site.

| It produces | From |
| --- | --- |
| `map.json`: pits, pipes, roads, street names | City of Melbourne open data |
| `derived.json`: water paths, low areas, data gaps | the 2018 3D point cloud, 4.33 GB of tiles |
| Ground height tiles and their marks | the same point cloud |
| `trace.json`: the pipe graph | the recorded pipe network |
| `warnings/<extent>.json`: the deep low areas on streets | the terrain runs, with the corridor and spacing rules |
| `subcatchments.json`, `address-catchments.json` | Melbourne Water boundaries |
| `flood-history.json`, `population.json`, `sa2-*.json` | SES incident records and ABS boundaries |
| `scenario-differences.json`, scene tiles | the terrain, for the blockage comparison |

Doing it here is what lets the browser draw a council map without a map server, and it is why the frontend can run from a clone with no Python toolchain.

**One thing it does at build time that would otherwise be a bug at run time:** `reframe.py` moves every artefact into the frame of the map it will be drawn over. Coordinates are metres from each extent's own corner, so Kensington's origin is the council's (1500, 6000). Kensington-frame shapes over a council-frame map would land a kilometre and a half west and six kilometres south, silently, still looking like a map.

---

## Where the line is drawn, and why

Three rules decide which side a piece of work goes on. They are worth knowing because they are the answer to most "why is this not an API?" questions.

**1. Anything about the reader stays in the browser.** The address, the selections, the plan, the printed page. The product's privacy claims are criteria in all three iterations, and the cheapest way to keep a promise about data is not to have the data.

**2. Anything that can be computed once is computed before the deployment.** The pipeline is slow, needs 4.33 GB of input and a Python toolchain, and its answer does not change between visits. Running it per request would be paying every reader for work done once.

**3. The server exists for what the browser cannot hold.** 21,113 pits and 17,242 pipes over 76.5 km² is a download nobody should make to look at their own street. That is the API's job, and it is the whole of it.

---

## When a part is missing

Each part failing has a defined behaviour, and none of them is a blank screen.

| Missing | What the reader gets |
| --- | --- |
| The API, or Cloud SQL stopped | The map still draws, from the copies in the site's own container, at one square kilometre instead of the council. The footer says which source answered. **This is a planned state**, not a rare failure: the database is expected to be stopped between demonstrations to save money |
| The API, during an address search | The same matcher runs on the bundled index and gives the same answer |
| The assistant | A `502` and one sentence saying the assistant is temporarily unavailable. Nothing else on the site is affected |
| The terrain tiles | Ground height draws nothing and says nothing. The other layers are unaffected |
| Everything except the container | The site still works: the whole product except the council-wide map and the submitted search runs from files it already has |

That last row is the point of the shape. The site was entirely static until 5 September 2026, and reading from a service was allowed to change what it can show, not whether it works.
