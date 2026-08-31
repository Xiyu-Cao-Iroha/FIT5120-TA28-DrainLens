# Deploying DrainLens

**Live:** https://drainlens-205559161217.australia-southeast1.run.app

Cloud Run, `australia-southeast1`, project `fit5120-504507`. nginx serving **fourteen static files** — eleven artefacts, `index.html` and two hashed bundles. A first visit fetches four of them (**1.36 MB over the wire**, expanding to 6.43 MB); the scene arrays load when the scenario worker starts, and two published arrays are not fetched at all on the demonstration path. There is no application server: the map, the terrain, the drainage network and the address index are build products, and the scenario engine runs in the browser.

Deployed **31 August 2026**, redeployed **1 September 2026** for the difference layer. Everything below was run, not planned, and the verification was repeated in full after the second deployment rather than assumed to still hold.

| Redeployed 1 September | |
|---|---|
| Bundle | `index-DPqqSve1.js`, matching a local build of `main` — which is also how you know it built from the Dockerfile and not from Buildpacks |
| Worker content type | `text/javascript`, exactly one header |
| gzip, three cache tiers, `/data` 404 | unchanged |
| **AD1** | positive control shows system, system_event and stderr writing; **0 entries carrying a client IP**, no `requests` log |
| Transfer | **1.36 MB over the wire, expanding to 6.43 MB (21%)** |
| First visit, p95 | **692.4 ms** from a laptop, against the 34.5 ms localhost floor |

---

## Why Cloud Run and not something simpler

Three constraints, and only one option survives all of them.

| | |
|---|---|
| **Not Firebase Hosting** | The first System Architecture used it and that was rejected in a meeting with the teacher. |
| **No domain** | Rules out Cloud Storage behind an HTTPS load balancer, which needs one for a certificate. |
| **Must be served at a root URL** | Every path the app fetches is absolute from `/`. Served from a sub-path such as `storage.googleapis.com/BUCKET/`, `/data/map.json` resolves to the bucket's parent and 404s. |

Cloud Run gives a root URL with managed HTTPS and no domain. It is also where `apps/api` would go if AI inference ever moved off the device — but note AD10 puts the photo classification *on* the device, and `FORBIDDEN_WIRE_KEYS` refuses `photo`, `image` and `imageData` structurally, so moving inference server-side means changing that contract deliberately rather than deleting a key from a list.

**This reverses what was written here before.** On Cloud Storage there is nothing to filter, because nothing is logged by default. **Cloud Run writes request logs carrying `httpRequest.remoteIp` by default**, so the exclusion is mandatory and has to be applied before the first request.

---

## The order, and why it is this order

**1. Enable the APIs.** Individually — never inferred from a sibling working.

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project=fit5120-504507
```

**2. Exclude the request logs — before deploying, not after.**

```bash
gcloud logging sinks update _Default --project=fit5120-504507 '--add-exclusion=name=cloud-run-request-logs,filter=LOG_ID(run.googleapis.com/requests)'
```

An exclusion drops entries **before they are written**. One added afterwards cannot unwrite the lines already holding a visitor's IP, and an IP in a log is exactly what AD1 says this product does not keep — a promise the landing page makes to residents in those words.

> **It must be `--add-exclusion`, not the sink's own `--log-filter`.** Setting `NOT LOG_ID(...)` on the sink filter looked right, stored correctly, and **did not stop the logs**: two entries carrying a real client IP were written eleven minutes after it was applied. The two fields are not interchangeable. See *What went wrong*.

**3. Deploy.** From the repository root, not from your home directory.

```bash
gcloud run deploy drainlens --project=fit5120-504507 --source=. --region=australia-southeast1 --allow-unauthenticated --port=8080 --memory=512Mi --max-instances=3
```

`--allow-unauthenticated` is the one step to be deliberate about: it publishes the site. That is the intent — it is a public information site — but it is worth a pause.

Watch the first line of output. It must say **`Building using Dockerfile`**. If it says `Building using Buildpacks`, stop — see *What went wrong*.

**4. Take the "after" measurement, and say where you ran it from.**

```bash
node tools/perf/measure.mjs https://drainlens-205559161217.australia-southeast1.run.app 100
```

---

## What the container gets right, and how each fails if it does not

Verified against the live URL, not only locally.

| | Verified | If wrong |
|---|---|---|
| **Module worker content type** | `text/javascript`, one header | A module worker is refused outright at any other type. **The map still draws, so losing the entire comparison feature looks like nothing happening.** |
| **gzip** | `content-encoding: gzip` on `.bin` and `.json` | The first visit is 6.42 MB instead of 1.36 MB. The site works; it is four times heavier. |
| **Cache, in three classes** | `immutable` / `max-age=300` / `no-cache` | `/data` is not content-hashed. A rebuilt artefact behind a long cache is a map that silently disagrees with the model it was built beside. |
| **`/data/*` returns 404** | A missing artefact 404s | Otherwise the single-page rewrite returns `index.html`, which reaches `assertUsable` as a parse error rather than as a missing file. |

The content types are set with a `types` block, not `add_header`. `add_header` **appends**, so the first version sent every response with two `Content-Type` headers — caught by `curl -I` before it went anywhere.

---

## Verify — assert the absence, do not assume it

Configuration saying the right thing is not evidence.

```bash
curl -sI https://drainlens-205559161217.australia-southeast1.run.app/assets/worker-*.js | grep -i content-type

curl -sI -H 'Accept-Encoding: gzip' https://drainlens-205559161217.australia-southeast1.run.app/data/scene/elevation.bin | grep -i content-encoding
```

**The logging check is the one that matters, and it only counts after real traffic.**

```bash
# 1. Generate some. An empty log during a quiet hour proves nothing.
for i in 1 2 3 4 5; do curl -s -o /dev/null https://drainlens-205559161217.australia-southeast1.run.app/data/map.json; done
sleep 90

# 2. Did any of them store a client IP?
gcloud logging read 'httpRequest.remoteIp:*' --project=fit5120-504507 --limit=10 --freshness=1h --format='value(timestamp,httpRequest.remoteIp)'
#    Expect: nothing.

# 3. Prove logging is not simply switched off altogether.
gcloud logging read 'resource.labels.service_name="drainlens"' --project=fit5120-504507 --limit=4 --freshness=2h --format='table(timestamp,logName.segment(-1))'
#    Expect: system, system_event and stderr entries — and no `requests`.
```

Result on 31 August: **25 real requests, 0 request-log entries, 0 entries carrying an IP**, with system and stderr logging intact.

---

## What went wrong, twice, and both avoidably

**The Dockerfile was in the wrong place.** It lived under `deploy/`, and `--source=.` looks only for `./Dockerfile`. The first deployment fell back to Buildpacks **without failing** — it would have shipped none of the content types, gzip settings or cache policy above, and the site would have looked fine. It is at the repository root now with a comment saying it must stay there.

**The log exclusion went onto the wrong field, and was then "verified" by a query that could not match.** `NOT LOG_ID(...)` was written to the sink's own filter instead of `--add-exclusion`. The check used `logName:"run.googleapis.com%2Frequests"`, got zero, and zero was read as success. A differently-phrased query then found **two stored entries, each carrying a real IPv6 client address**, written eleven minutes after the filter was applied. They were deleted:

```bash
gcloud logging logs delete "run.googleapis.com%2Frequests" --project=fit5120-504507
```

The lesson is one this repository has written down before and had to learn again in practice: **a query returning nothing is evidence only when you know it would have returned something.** That is why the verification above generates traffic first.

---

## Cost and rollback

Cloud Run scales to zero, so no requests means no charge, and `--max-instances=3` bounds an accident. To remove the service entirely:

```bash
gcloud run services delete drainlens --region=australia-southeast1 --project=fit5120-504507
```
