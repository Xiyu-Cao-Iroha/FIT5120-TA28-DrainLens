# Development guide

How to set the project up, run it, and get a change merged. Written for someone joining the repository for the first time.

There are **two toolchains**: Node for `packages/` and `apps/`, Python for `pipeline/`. You only need the second if you are working on artefacts.

---

## Prerequisites

| | Version | Check |
|---|---|---|
| Node | 20 or newer | `node --version` |
| Python | 3.11 or newer | `py --version` (Windows) · `python3 --version` (macOS/Linux) |
| Git | any recent | `git --version` |

---

## First-time setup

### Node side — schema, scenario, and the web and api apps

```bash
git clone https://github.com/Xiyu-Cao-Iroha/FIT5120-TA28-DrainLens.git
cd FIT5120-TA28-DrainLens
npm ci
npm run check
```

`npm run check` should end with all tests passing and a coverage summary. If it does, your setup is correct.

**Use `npm ci`, not `npm install`.** `npm ci` installs exactly what the lockfile says and fails if the lockfile and `package.json` have drifted apart. Lockfile drift breaking CI unnoticed is a defect this team has already had escape once, and this is what catches it. Run `npm install` only when you are deliberately adding or upgrading a dependency — then commit the changed `package-lock.json` with it.

### Python side — the offline pipeline

```bash
cd pipeline
py -m venv .venv                                    # Windows
./.venv/Scripts/python.exe -m pip install -e . -r requirements-dev.txt
./.venv/Scripts/python.exe -m pytest
```

```bash
cd pipeline                                          # macOS / Linux
python3 -m venv .venv
./.venv/bin/python -m pip install -e . -r requirements-dev.txt
./.venv/bin/python -m pytest
```

The `-e .` matters: without it the package is not importable and `python -m drainlens_pipeline.cli` fails with `ModuleNotFoundError`. Tests pass without it because `pyproject.toml` puts `src` on the path for pytest only.

---

## Everyday commands

From the repository root:

| Command | What it does |
|---|---|
| `npm test` | Run the Node suite |
| `npm run test:watch` | Same, re-running on change |
| `npm run coverage` | Suite plus coverage, with thresholds enforced |
| `npm run typecheck` | TypeScript across every workspace |
| `npm run check` | Typecheck then coverage — **run this before opening a pull request** |
| `npm run test:db` | The suite that needs Postgres, which `npm test` leaves out. Start one first with `docker compose -f db/docker-compose.yml up -d` |
| `node tools/data/check-*.mjs` | The published-artefact checks CI runs, one script at a time — worth running after rebuilding any artefact |

From `pipeline/`:

| Command | What it does |
|---|---|
| `./.venv/Scripts/python.exe -m pytest` | Suite plus coverage, threshold enforced |
| `... -m pytest -k narrowing` | Just the tests whose name matches |
| `... -m pytest --no-cov -x` | Fast feedback while iterating: no coverage, stop at the first failure |

---

## Building artefacts

Artefacts are build products. `/data` at the repository root is **ignored** — it holds the full-size intermediates, including a 4 GB point cloud and the council-wide drainage graph.

The clipped, published copies under **`apps/web/public/data/` are committed**, so the frontend runs from a clone with no Python toolchain at all. That is the distinction to keep straight: the pipeline's working directory is ignored, its published output is not.

```bash
cd pipeline
./.venv/Scripts/python.exe -m drainlens_pipeline.cli \
  --pipes  ../../HydroTwin/pipes.json \
  --pits   ../../HydroTwin/pits.json \
  --out    ../data/graph/drainage-graph.json \
  --data-version com-drainage@2023-02-26
```

Source exports come from the City of Melbourne Open Data Portal (`drainpipes`, `stormwater-pits`, CC BY, last modified 26 February 2023). Ask in the team channel for a copy rather than re-downloading.

The build prints a summary and compares it against the figures in the Epic 1 data audit. **Drift is reported, not fatal** — the rules live in this repository and may legitimately change, but a change should never pass unnoticed. If you see drift you did not expect, stop and work out why before building on top of it.

That builds the council-wide graph. The artefacts the browser actually loads are built separately, and the block below is the outline rather than the invocations. **Not every stage writes where it is published by default**: `network`, `addresses`, `derived`, `trace` and `scene` write under the ignored `/data` unless given `--out`, while the later stages default to their published paths. Pass `--out` and check the path before committing.

```bash
./.venv/Scripts/python.exe -m drainlens_pipeline.network         # map.json
./.venv/Scripts/python.exe -m drainlens_pipeline.terrain         # the ground surface and hydrology, under /data
./.venv/Scripts/python.exe -m drainlens_pipeline.derived         # derived.json
./.venv/Scripts/python.exe -m drainlens_pipeline.trace           # trace.json
./.venv/Scripts/python.exe -m drainlens_pipeline.scene           # Kensington's scene/, which the site no longer reads
./.venv/Scripts/python.exe -m drainlens_pipeline.scene_tiles     # scene-tiles/, the comparison's terrain, council-wide
./.venv/Scripts/python.exe -m drainlens_pipeline.terrain_tiles   # terrain-tiles/, Ground height, council-wide
./.venv/Scripts/python.exe -m drainlens_pipeline.address_ground  # terrain/address-ground.json
./.venv/Scripts/python.exe -m drainlens_pipeline.flood_history   # flood-history.json, and sa2-areas.json given --areas PATH
./.venv/Scripts/python.exe -m drainlens_pipeline.population      # population.json
./.venv/Scripts/python.exe -m drainlens_pipeline.area_points     # sa2-points.json
```

Order matters: everything that reads the ground runs after `terrain`, `trace` reads the map, and `population` reads the area list `flood_history --areas` wrote. `flood-events.json` has no stage at all — it is written by hand, and `tools/data/check-events.mjs` holds it against the map's areas. The full commands — the council-wide ones, and the source files `population` and `area_points` require — are in [pipeline/README.md](../pipeline/README.md).

### Which extent

`network`, `addresses` and `derived` take `--extent`, and it names a **published** extent rather than four numbers. `fetch_tiles` and `terrain` spell the same thing `--name`, because their `--extent` is still the four numbers:

```bash
./.venv/Scripts/python.exe -m drainlens_pipeline.network --extent city-of-melbourne
```

| Name | Size | What it is |
|---|---|---|
| `kensington` | 1 × 1 km | The Iteration 1 demonstration extent. The default, and the copy bundled with the site. It was the only extent the address index covered until 14 September |
| `city-of-melbourne` | 8.5 × 9 km | Everywhere the council publishes a drainage record. What the database serves, what the scenario and terrain tiles are cut from, and what the address index and address ground cover |

Both live in `geo.py`'s `EXTENTS`, and `resolve_extent` is shared so four builders cannot come to spell the same extent differently. **An unknown name exits rather than falling back** — a build that quietly produced Kensington when it was asked for the council is a build whose output nobody can tell apart from the right one. `network` also keeps `--bounds MIN_E MIN_N MAX_E MAX_N` for a one-off that is not published under a name; that used to be spelled `--extent`.

> **`city-of-melbourne` was measured, not drawn around the LGA boundary** — the same method that chose Kensington, and for the same reason: the extent that matters is where the *data* is. All 21,113 pits in the council-wide graph carry a position and span 7,971 × 8,237 m; the extent is that rounded outward onto the point cloud's 500 m tile grid.
>
> **It is a 76.5 km² box holding 65.7 km² of data.** Only 56 of its 72 square kilometres contain a pit at all — the Yarra, the parks, and land the council does not drain — and it touches **306** tiles where the archive holds 215. A terrain build over it will not find a tile for every square, and that is a fact about the city rather than a missing download. *(13 September 2026: the build found 211 of the 306, and not one of the council's pits or pipes lies in the other 95.)* Density is not uniform either: the median occupied square kilometre holds 225 pits and the densest holds **1,905**, against Kensington's 895. Anything that draws every pit at once needs to know that before it is asked to draw the CBD.

`flood_history` is the exception to the pattern: it fetches its own two sources rather than reading what an earlier stage left on disk, because neither is a local export. Give it `--incidents` and `--geography` to build from files you already have — both or neither, so a published file is never silently mixed with a local one. See [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md) for what the sources are and what they do and do not support.

See [pipeline/README.md](../pipeline/README.md) for what each stage does and the data findings behind them.

---

## Getting a change merged

**Never push to `main`.** Every change goes through a pull request with written technical feedback from another team member. This is a commitment the team made in its Week 4 KPI assessment and it is assessed.

**Branch from `develop`, and open the pull request into `develop`.** Since 10 September `main` is the published iteration rather than the newest good code: it holds at `iteration-1-frozen` for the whole of Iteration 2, and `git rev-parse origin/main` must stay `138a002`. A pull request into `main` is the mistake to watch for, because it was the habit for a fortnight — see [deploy/README.md](../deploy/README.md#preserving-each-iteration).

```bash
git checkout develop
git pull
git checkout -b feat/short-description       # or fix/, docs/, chore/
# ... work, committing as you go ...
npm run check                                 # and pytest, if you touched pipeline/
git push -u origin feat/short-description
```

The push prints a link that opens the pull request. In the description, say what changed and why, and **name the acceptance criterion the change serves** — `1.2.2.d`, `2.1.2.e`, and so on, from [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md), or during Iteration 2 from [ITERATION-2-ACCEPTANCE.md](./ITERATION-2-ACCEPTANCE.md). A change that serves no criterion is worth a conversation before it is worth a review.

### Commit messages

A subject line in the imperative — "Add the drainage graph builder", not "Added" or "Adding". A body explaining **why**, not what: the diff already says what. Nothing appended — no tool footers, no co-author trailers.

**That last sentence is worth one command before every push**, because the cost of getting it wrong is out of all proportion to the mistake:

```bash
git log origin/develop..HEAD --format=%B | grep -iE 'co-authored-by|generated with'
```

One commit reached `develop` with a `Co-Authored-By` trailer on it. By the time anyone noticed, it had been merged to `develop`, then to `main`, and an automated account was showing in the repository's contributor list. Removing it meant rewriting one line of one commit message — and because everything sat on top of it, that changed **all 27 commit SHAs on both branches**, which needed branch protection temporarily disabled, a force-push, and every teammate to `reset --hard`.

The file trees before and after were byte-identical. A one-line mistake, an afternoon to undo. Run the grep.

### When history has to be rewritten anyway

It happens; do it in this order.

1. Verify the rewrite changed nothing but messages: `git diff <backup> <rewritten>` must be empty and the tree hashes must match.
2. Keep a branch at the pre-rewrite state until everyone has re-synced.
3. Tell the team **before** pushing, with the `reset --hard` they will need.
4. Ask the repository owner to lower the ruleset. Nobody else can, and nobody should try — `--force-with-lease`, not `--force`, so a concurrent push refuses rather than being clobbered.
5. Put the protection back the same minute, and verify it with `gh api repos/:owner/:repo/rules/branches/main` rather than by trying a push. `git push --dry-run` does not run the server's rules, so it proves nothing.

### What a reviewer is looking for

- A test alongside every component that carries a judgement, written before or with it
- No claim in the interface that the data cannot support — this project's whole position is that it does not overstate
- Missing or uncertain information labelled rather than filled in
- Nothing added to `wire.ts` that would send a photograph, an address or a coordinate

---

## Quality gates

CI runs on every pull request and all three jobs must pass: `check` (Node), `pipeline` (Python) and `database` (the suite that needs Postgres, against a service container). The thresholds live in configuration, not in prose, so they move with the code.

| Gate | Where it is set | Value |
|---|---|---|
| Node coverage, overall | `vitest.config.ts` | 88% |
| Node coverage, `packages/schema` | `vitest.config.ts` | 90% |
| Node coverage, `packages/scenario` | `vitest.config.ts` | 90% — **was 90.84%, a margin of about four statements**, when this row was written; 98.08% of lines and 96.08% of branches on 14 September 2026. The margin is wider, and a defensive branch without a test to reach it still counts against it |
| Python coverage | `pipeline/pyproject.toml` | 90% |
| Suite runtime | not automated — watch it | under 5 s. **On the CI runner: Node 5 s in all three samples, which is at the limit, and Python 51–67 s, which breaches it.** Locally 3.6 s and 105 s — different hardware, so quote the one you mean. See the root README |
| Lockfile integrity | `npm ci` in CI | fails on drift |
| Markdown structure | `node tools/docs/check.mjs` | stray table rows, ragged rows, unclosed fences, broken relative links, and a raw NUL byte in any tracked text file |
| Published artefacts | `node tools/data/check-*.mjs`, six scripts | a recorded inlet with a path onward within 200 m of every address the guide can be given, the area files against each other, both copies of the derived layers, the scenario and terrain tile packs against their indexes, and the verified flood events against the map's areas |

> **`apps/web/dist` locally is not what ships.** `npm run typecheck` is `tsc --build --force`, which emits a `.js`, `.d.ts` and `.map` for every source file into the same `dist` Vite writes to — 130 files locally against the 14 the site serves. The container never sees them: the Dockerfile runs only `npm run build`. Confirmed against the live site, where `/map/draw.js` returns the single-page fallback as `text/html` rather than a script. Do not read a local `dist` listing as the deployed file list.

If a test would push the suite past five seconds, it belongs behind a separate script rather than in this run.

---

## Deploying

Cloud Run: https://drainlens-205559161217.australia-southeast1.run.app. The runbook, the two mistakes made getting there, and the verification that asserts the absence of stored IPs are in [deploy/README.md](../deploy/README.md).

**During Iteration 2 the only service that is redeployed is `drainlens-dev`**, built from `develop`. The root service serves `iteration-1-frozen` until Iteration 2 is finished, and `drainlens-iteration1` is never touched. Firebase Hosting is not an option: it was rejected by the teacher before anything was deployed.

A deployment is run by hand, from a terminal on the project, by the team member holding its credentials — never from CI, and never by a script or an automated session acting on its own:

```bash
# From the repository root, on develop. --source looks for ./Dockerfile and nothing else.
gcloud run deploy drainlens-dev --project=fit5120-504507 --source=. --region=australia-southeast1 --allow-unauthenticated --port=8080 --memory=512Mi --max-instances=1
```

The command that once stood here deployed the root service with `--max-instances=3`. Run today, it would replace Iteration 1 at the one URL that is meant to stay put.

---

## Measuring a deployment

W4 asks for p95 latency and the external-fetch failure rate **before and after** every deployment. The comparison is only worth something if both sides are the same script against the same critical path, so the script lives here rather than in somebody's shell history:

```bash
npm run build --workspace @drainlens/web
node tools/perf/serve.mjs apps/web/dist 8099     # the MIME types a deployment must match
node tools/perf/measure.mjs http://localhost:8099 100
```

After deploying, the same command against the deployed URL. **The resource list is discovered from the served `index.html` and `scene.json`, not written down** — Vite hashes asset names on every build, and a stale list probes URLs that 404, which looks fast.

The "before" figures are in [DEPLOYMENT-BASELINE.md](./DEPLOYMENT-BASELINE.md), along with the caveat that matters: they were taken on a laptop against localhost, so they are a floor rather than a network measurement. Say where the "after" was run from.

---

## Repository layout

```
packages/schema     shared definitions — provenance, vocabularies, scenario, wire payloads
packages/scenario   scenario engine — routing, depressions, drains, comparison. No DOM
apps/web            frontend (React + Vite) — session state, canvas map. No map library
apps/api            backend (Node + Hono on Cloud Run) — read-only API over Postgres
db                  the database migrations, and a local Postgres for npm run test:db
pipeline            Python geospatial pipeline and model training, never deployed
tools/perf          the deployment measurement, run identically before and after
tools/data          checks that published artefacts still agree with each other, run in CI
tools/docs          the markdown structure and source-encoding check, run in CI
deploy              the Cloud Run runbook and the nginx configuration
data                full-size intermediates — git-ignored, rebuilt locally
docs                iteration scope, acceptance criteria, interface contract, this guide
models              exported ONNX models and evaluation reports               not yet started
```

`packages/schema` is the one place the frontend, the backend and the model output share a definition. Change it deliberately: a change there can affect three workstreams at once.

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'drainlens_pipeline'`**
The package is not installed into the virtual environment. Run `pip install -e .` from `pipeline/`.

**`npm ci` fails with a lockfile error**
`package.json` and `package-lock.json` have drifted. The usual cause is **adding a workspace without re-running `npm install`** — a new `packages/*/package.json` does not reach the lockfile on its own, and `npm ci` refuses to guess. Run `npm install` once to reconcile them, check the diff, and commit the lockfile with the change that caused it.

Do not silence the install while checking this. `npm ci --silent | tail -1` hides the failure, and the run that follows will pass against the `node_modules` you already had — which is how this reaches CI in the first place.

**esbuild warning: "1 package has install scripts not yet covered by allowScripts"**
npm 11 does not run postinstall scripts by default. It is currently harmless — esbuild's binary comes from a platform-specific package, not the postinstall. If Vitest ever fails to find an esbuild binary, run `npm approve-scripts esbuild`.

**Git warns "LF will be replaced by CRLF"**
Expected on Windows and already handled. `.gitattributes` normalises line endings to LF in the repository, so the warning is Git telling you it is doing its job.

**Tests pass locally but CI fails**
CI runs on Linux and installs from the lockfile only. The usual causes are a file added but not committed, a dependency installed locally but not saved, or a path with different case. Check `git status` first.

---

## Where the design lives

The System Architecture, Data Model, conceptual ERD and ML go/no-go assessment are in the team's project governance folder, not in this repository. The schema in `packages/schema` is the executable form of the data model; **where the two disagree, the data model is authoritative and this repository has a bug.**

Three positions bind every change here, and are not negotiable inside a pull request:

- **No identity.** No user table, no accounts, no sessions, no email, no retained IP. The address is resolved in the browser; no endpoint accepts an address or a coordinate.
- **Build-time heavy, runtime thin.** Expensive work runs once, offline, and publishes immutable versioned artefacts.
- **Provenance is a record, not a label.** Every value carries a basis saying where it came from. A value that cannot account for itself must not be constructible.
