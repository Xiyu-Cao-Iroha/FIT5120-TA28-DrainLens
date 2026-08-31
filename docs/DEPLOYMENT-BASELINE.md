# Deployment measurement — before and after

DrainLens · TA28 · **before re-taken and after taken, 31 August 2026**

**Deployed:** https://drainlens-205559161217.australia-southeast1.run.app

| | before | after |
|---|---:|---:|
| First visit, p95 | **34.5 ms** | **507.7 ms** |
| Transfer | 1.37 MB (21%) | **1.36 MB (21%)** |
| Fetch failures | 0 of 1,200 | **0 of 360** |

> **They are not the same measurement and must not be read as a regression.** The "before" was taken on a laptop against `localhost`, which has no network in it — it is a floor, and the document said so before the deployment existed. The "after" is a real round trip from Melbourne to Sydney and back. What *is* comparable is the transfer: 1.37 MB against 1.36 MB at the same 21% ratio, which is the evidence that gzip is genuinely reaching the client in production rather than being inferred from a header.

> Taken once on 30 August against a 1.31 MB payload, then **re-taken** when the address index was replaced. The fixture held two addresses and 3 KB; the real index holds 4,089 and 66 KB over the wire. A "before" measured against a payload the site no longer ships is not a before, so the numbers below are the ones the "after" must be compared with.

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
| `assets/index-*.js` | 2.76 | 4.49 | 8.47 | 81,909 |
| `assets/worker-*.js` | 0.89 | 1.36 | 2.62 | 3,764 |
| `data/map.json` | 2.49 | 3.68 | 10.25 | 54,897 |
| `data/derived.json` | 1.93 | 3.33 | 16.01 | 41,853 |
| `data/trace.json` | 0.94 | 1.92 | 4.97 | 7,210 |
| `data/addresses.json` | 4.34 | 9.02 | 11.43 | 66,404 |
| `data/scene/scene.json` | 1.51 | 3.15 | 4.50 | 16,396 |
| **`data/scene/elevation.bin`** | **17.42** | **26.35** | 113.00 | **812,867** |
| `data/scene/flow.bin` | 7.12 | 10.90 | 160.32 | 305,822 |
| `data/scene/depressions.bin` | 7.32 | 10.85 | 29.50 | 47,328 |
| `data/scene/coverage.bin` | 1.07 | 1.95 | 5.79 | 156 |

All times in milliseconds.

**First visit, every resource at the app's own concurrency:**

| p50 | p95 | max |
|---:|---:|---:|
| 28.6 ms | **34.5 ms** | 40.9 ms |

**Transfer:** 1.37 MB over the wire, expanding to 6.42 MB — a **21%** ratio. The real address index added 65 KB to the wire for 4,087 more addresses.

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
| gzip | required. Without it the first visit is 6.42 MB instead of 1.37 MB |
| `/assets/*` | `max-age=31536000, immutable` — the names are content-hashed |
| `/data/*` | short max-age. These are **not** hashed, and a rebuilt artefact behind a long cache is a map that silently disagrees with itself |

---

## Still to do, and not mine to take

**The log exclusion filter must be configured before the first request, not after.** A filter added later cannot unwrite the lines already stored, and an IP in a log is exactly what AD1 says this product does not keep. This is the one deployment step that is a correctness requirement rather than an operational one.
