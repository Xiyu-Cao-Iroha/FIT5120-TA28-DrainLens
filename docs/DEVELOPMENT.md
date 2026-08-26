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

### Node side — schema, and later the web and api apps

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

From `pipeline/`:

| Command | What it does |
|---|---|
| `./.venv/Scripts/python.exe -m pytest` | Suite plus coverage, threshold enforced |
| `... -m pytest -k narrowing` | Just the tests whose name matches |
| `... -m pytest --no-cov -x` | Fast feedback while iterating: no coverage, stop at the first failure |

---

## Building artefacts

Artefacts are **build products and are not committed**. `/data` is ignored. Rebuild them locally when you need them.

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

See [pipeline/README.md](../pipeline/README.md) for what the graph builder does and the data findings behind it.

---

## Getting a change merged

**Never push to `main`.** Every change goes through a pull request with written technical feedback from another team member. This is a commitment the team made in its Week 4 KPI assessment and it is assessed.

```bash
git checkout main
git pull
git checkout -b feat/short-description       # or fix/, docs/, chore/
# ... work, committing as you go ...
npm run check                                 # and pytest, if you touched pipeline/
git push -u origin feat/short-description
```

The push prints a link that opens the pull request. In the description, say what changed and why, and **name the acceptance criterion the change serves** — `1.2.d`, `2.1.b`, and so on, from [ITERATION-1-ACCEPTANCE.md](./ITERATION-1-ACCEPTANCE.md). A change that serves no criterion is worth a conversation before it is worth a review.

### Commit messages

A subject line in the imperative — "Add the drainage graph builder", not "Added" or "Adding". A body explaining **why**, not what: the diff already says what. Nothing appended — no tool footers, no co-author trailers.

### What a reviewer is looking for

- A test alongside every component that carries a judgement, written before or with it
- No claim in the interface that the data cannot support — this project's whole position is that it does not overstate
- Missing or uncertain information labelled rather than filled in
- Nothing added to `wire.ts` that would send a photograph, an address or a coordinate

---

## Quality gates

CI runs on every pull request and both jobs must pass. The thresholds live in configuration, not in prose, so they move with the code.

| Gate | Where it is set | Value |
|---|---|---|
| Node coverage, overall | `vitest.config.ts` | 88% |
| Node coverage, `packages/schema` | `vitest.config.ts` | 90% |
| Python coverage | `pipeline/pyproject.toml` | 90% |
| Suite runtime | not automated — watch it | under 5 s |
| Lockfile integrity | `npm ci` in CI | fails on drift |

If a test would push the suite past five seconds, it belongs behind a separate script rather than in this run.

---

## Repository layout

```
packages/schema     shared definitions — provenance, vocabularies, scenario, wire payloads
apps/web            frontend (React + Vite, MapLibre + deck.gl)              not yet started
apps/api            backend (Node + Hono on Cloud Run)                       not yet started
pipeline            Python geospatial pipeline and model training, never deployed
data                artefact releases — git-ignored, rebuilt locally
docs                iteration scope, acceptance criteria, this guide
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
