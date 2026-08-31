# Deployment baseline — the "before" measurement

DrainLens · TA28 · taken **30 August 2026**, before any deployment exists

W4 requires p95 latency and the external-fetch failure rate recorded **before and after** every deployment. The "after" can be taken whenever. **The "before" cannot be taken retrospectively**, which is the only reason this document exists now rather than after the site is up.

---

## What was measured, and what that is worth

The deployed product **makes no external requests at runtime**. Everything is a static artefact and the scenario engine runs in the browser, so there is no upstream service whose latency could vary. That makes the measurable quantities:

| | |
|---|---|
| **Artefact latency** | serve + transfer time per resource. **This is what deployment changes.** |
| **First-visit total** | the whole critical path at the concurrency the app actually uses |
| **Transfer size** | bytes over the wire, which a CDN's compression settings can change |
| **Fetch failure rate** | the W4 metric, here against the local server |
| **Engine solve time** | CPU-bound in a worker. **Deployment cannot change this** — recorded so that a later change is attributed to code rather than to hosting. |

> **These numbers were taken on a laptop against `localhost`.** W4 says to probe *from the deployment host, not a laptop*, and that instruction stands. A localhost figure has no network in it, so it is a **floor**: it measures how fast the files can be served and decompressed with the network removed. It is a valid comparison only against the same script run the same way. When the "after" is taken, say where it was run from — the two are not interchangeable.

---

## How to take the "after"

The same script, discovering the same critical path:

```bash
node tools/perf/measure.mjs https://the-deployed-url 100
```

The resource list is **discovered, not hard-coded** — read from the served `index.html`, the bundle (for the worker's hashed name) and `scene.json`. A hand-written list stops matching the next build, and probing URLs that 404 looks fast.

To reproduce the "before" exactly:

```bash
npm run build --workspace @drainlens/web
node tools/perf/serve.mjs apps/web/dist 8099
node tools/perf/measure.mjs http://localhost:8099 100
```

---

## The baseline

100 samples per resource, gzip requested, 30 August 2026.

| Resource | p50 | p95 | max | wire (gzip) |
|---|---:|---:|---:|---:|
| `/` | 1.29 | 2.47 | 4.91 | 231 |
| `assets/index-*.js` | 3.50 | 5.50 | 6.72 | 81,908 |
| `assets/worker-*.js` | 1.11 | 1.52 | 6.89 | 3,764 |
| `data/map.json` | 3.26 | 5.66 | 13.63 | 54,897 |
| `data/derived.json` | 2.46 | 4.21 | 20.69 | 41,853 |
| `data/trace.json` | 1.11 | 2.19 | 4.18 | 7,210 |
| `data/addresses.json` | 0.87 | 1.30 | 3.58 | 1,592 |
| `data/scene/scene.json` | 1.49 | 2.03 | 4.03 | 16,396 |
| **`data/scene/elevation.bin`** | **19.31** | **28.14** | 87.26 | **812,867** |
| `data/scene/flow.bin` | 8.63 | 16.19 | 127.64 | 305,822 |
| `data/scene/depressions.bin` | 9.10 | 14.02 | 33.90 | 47,328 |
| `data/scene/coverage.bin` | 1.42 | 2.84 | 4.91 | 156 |

All times in milliseconds.

**First visit, every resource at the app's own concurrency:**

| p50 | p95 | max |
|---:|---:|---:|
| 30.6 ms | **40.8 ms** | 49.9 ms |

**Transfer:** 1.31 MB over the wire, expanding to 5.77 MB — a **23%** ratio.

**Fetch failures:** **0 of 1,200** requests (0.00%).

---

## The engine, which deployment cannot change

Measured directly against the real Kensington scene, 1,000,000 cells, twelve runs:

| | p50 | p95 |
|---|---:|---:|
| One rainfall position | 267 ms | 338 ms |
| **Three positions — a real comparison** | **893 ms** | **998 ms** |

**This is the dominant user-facing latency in the product, and no CDN will improve it.** A comparison takes about a second because it solves a million-cell grid twice per rainfall position. Loading every artefact costs 41 ms at p95; running one comparison costs twenty-four times that.

Worth saying plainly when latency comes up: **hosting is not this product's performance story.** If a comparison ever needs to be faster, the change is in `packages/scenario`, not in the deployment.

---

## Two things the measurement itself found

**The failure counter works, and proved it by accident.** A first run reported **9.09%** failures. The cause was a stale server holding the previous build's `index.html` in memory while the assets on disk had been rebuilt — so the discovered bundle name pointed at a file that no longer existed. That is exactly the shape of a real deployment failure (an index referencing assets that were not uploaded), and the script caught it rather than reporting a fast 404. The clean run above is 0.00%.

**Two artefacts are shipped and never fetched.** `scene.json` declares six arrays; `loadScene` reads four. `rim-depth.bin` (2 MB) and `measured.bin` (125 KB) are deployed and never requested. They cost no bandwidth, but they are **2.1 MB of the 7.9 MB bucket** and they make the header describe more than the application uses. Either wire them up or stop publishing them — this is not urgent and it is not nothing.

---

## Serving requirements the baseline depends on

The local server in `tools/perf/serve.mjs` sets these, and the deployment must match or the comparison is between different things:

| | |
|---|---|
| `.js` | `text/javascript` — **a module worker is refused outright at any other type**, and the whole comparison feature goes with it |
| `.bin` | `application/octet-stream` |
| `.json` | `application/json` |
| gzip | required. Without it the first visit is 5.77 MB instead of 1.31 MB |
| `/assets/*` | `max-age=31536000, immutable` — the names are content-hashed |
| `/data/*` | short max-age. These are **not** hashed, and a rebuilt artefact behind a long cache is a map that silently disagrees with itself |

---

## Still to do, and not mine to take

**The log exclusion filter must be configured before the first request, not after.** A filter added later cannot unwrite the lines already stored, and an IP in a log is exactly what AD1 says this product does not keep. This is the one deployment step that is a correctness requirement rather than an operational one.
