# Deploying DrainLens

Cloud Storage behind an HTTPS load balancer with Cloud CDN. **Fourteen static files, 1.37 MB over the wire.** There is no server: the map, the terrain, the drainage network and the address index are build products, and the scenario engine runs in the browser.

> **These commands have not been run against a real project.** There is no `gcloud` on the machine they were written on, so treat them as a reviewed plan rather than a tested script. Read each one before running it; the verification section exists so that "it seemed to work" is not the standard.

---

## The finding that changes the logging question

The task list carries a **log exclusion filter** as a deployment step, and for Cloud Run it would be mandatory: Cloud Run writes request logs automatically, and every entry carries `httpRequest.remoteIp` — the visitor's IP address. AD1 says this product keeps no IP, so on Cloud Run the promise is false the moment traffic arrives unless a filter is added first.

**On this architecture there is nothing to filter, because nothing is logged by default.**

| | Default | What we do |
|---|---|---|
| Load balancer request logs | **off** — `logConfig.enable` is false on a backend bucket | never enable it |
| Cloud Storage usage/access logs | **off** — opt-in per bucket | never enable it |
| Cloud Monitoring metrics | on, and **carry no IP** — aggregate request counts, error rates, latency | keep, they are useful |

So AD1 is kept here by **not switching something on**, which is a stronger position than switching it on and filtering it afterwards. The exclusion filter becomes necessary again the day `apps/api` reaches Cloud Run, and not before.

**This is not a reason to skip the check.** It is a reason the check is cheap: see *Verify* below, which asserts the absence rather than assuming it.

---

## One-time setup

Read each command. Several are irreversible in the sense that they publish something.

```bash
PROJECT=drainlens-ta28          # your project id
BUCKET=drainlens-ta28-site      # must be globally unique
REGION=australia-southeast1     # Melbourne

gcloud config set project "$PROJECT"

# 1. The bucket. Uniform access, so per-object ACLs cannot drift.
gcloud storage buckets create "gs://$BUCKET" \
  --location="$REGION" \
  --uniform-bucket-level-access \
  --public-access-prevention=inherited
```

**The next command makes the site public.** That is the intent — it is a public information site — but it is the one step to be deliberate about.

```bash
# 2. Public read. Objects only; nobody can list or write.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member=allUsers --role=roles/storage.objectViewer
```

```bash
# 3. A backend bucket with Cloud CDN, and logging left OFF (see above).
gcloud compute backend-buckets create drainlens-backend \
  --gcs-bucket-name="$BUCKET" \
  --enable-cdn \
  --cache-mode=USE_ORIGIN_HEADERS

# 4. The front door.
gcloud compute url-maps create drainlens-map --default-backend-bucket=drainlens-backend
gcloud compute addresses create drainlens-ip --global
gcloud compute ssl-certificates create drainlens-cert --domains=YOUR.DOMAIN --global
gcloud compute target-https-proxies create drainlens-proxy \
  --url-map=drainlens-map --ssl-certificates=drainlens-cert
gcloud compute forwarding-rules create drainlens-fr \
  --address=drainlens-ip --target-https-proxy=drainlens-proxy --global --ports=443
```

`--cache-mode=USE_ORIGIN_HEADERS` matters: it makes the CDN obey the `Cache-Control` that `publish.sh` sets per file, rather than applying one policy to everything. The three classes of file need three different policies, and the reason is in the next section.

---

## Every deploy

```bash
./deploy/publish.sh gs://$BUCKET
```

That script builds, then uploads with the metadata the application actually depends on. Three things it sets, each of which breaks something specific if wrong:

**Content type.** `.js` must be served as `text/javascript`. **A module worker is refused outright at any other type**, and the whole comparison feature goes with it — the map still draws, so this fails quietly. `.bin` must be `application/octet-stream`.

**gzip.** Cloud Storage does not compress on the fly. Files are uploaded with `--gzip-local-all`, which compresses locally and stores `Content-Encoding: gzip` — taking the first visit from **6.42 MB to 1.37 MB**.

> Not `--gzip-in-flight-all`, which sounds like the same thing and is not: it compresses only the upload to Cloud Storage, leaving the stored object unencoded. Choosing it fails silently — the site works and is four times heavier. Check 2 below is what catches it.

**Cache lifetime, in three classes:**

| | Policy | Why |
|---|---|---|
| `/assets/*` | `max-age=31536000, immutable` | Content-hashed by Vite. A new build has a new name, so it can never be stale. |
| `/index.html` | `no-cache` | It names the hashed assets. Cached, it points at files a new deploy has replaced. |
| `/data/*` | `max-age=300` | **Not hashed.** A rebuilt artefact behind a long cache is a map that silently disagrees with the model — the failure this product exists to avoid. |

---

## Take the "after" measurement

The "before" is in [DEPLOYMENT-BASELINE.md](../docs/DEPLOYMENT-BASELINE.md). The comparison is only worth something if both sides are the same script:

```bash
node tools/perf/measure.mjs https://YOUR.DOMAIN 100
```

**Say where you ran it from.** The baseline was taken on a laptop against localhost, which has no network in it and is therefore a floor. W4 asks for a probe from the deployment host, and a laptop figure and a host figure are not interchangeable.

---

## Verify

Four checks. The first two are correctness, the last two are the privacy position.

```bash
# 1. The worker's content type. If this is not a JavaScript type, the
#    comparison feature is dead and the map still looks fine.
curl -sI https://YOUR.DOMAIN/assets/worker-*.js | grep -i content-type

# 2. Compression is actually reaching the browser.
curl -sI -H 'Accept-Encoding: gzip' https://YOUR.DOMAIN/data/scene/elevation.bin \
  | grep -iE 'content-encoding|content-length'
#    Expect: content-encoding: gzip, and ~813 KB rather than 2 MB.

# 3. No request logs exist. Not "we filtered them" — none were made.
gcloud logging read \
  'resource.type="http_load_balancer" AND httpRequest.remoteIp!=""' \
  --limit=5 --freshness=1d
#    Expect: no entries. If any appear, backend logging was enabled
#    somewhere and AD1 is not being kept.

# 4. Confirm it is off rather than merely quiet.
gcloud compute backend-buckets describe drainlens-backend \
  --format='value(cdnPolicy.cacheMode,enableCdn)'
gcloud logging sinks describe _Default --format='value(filter)'
```

Check 3 is the one worth running properly. An empty result during a quiet hour proves nothing on its own, which is why check 4 asks the configuration rather than the data.

---

## What is deliberately not here

**No Cloud Run.** There is no `apps/api` and nothing to containerise. Cloud Run remains a reasonable Iteration 2 target if AI inference moves off the device — but note that AD10 puts the photo classification *on* the device, and `FORBIDDEN_WIRE_KEYS` refuses `photo`, `image` and `imageData` structurally. Moving inference server-side means changing that contract deliberately, as a new declared payload type, not by deleting a key from a list.

**No PMTiles or range requests.** The task list mentions confirming that range requests pass through the CDN. That was written when the map was expected to be tiled. It is not: the whole extent is 1.27 MB gzipped, which was measured, and tiling was dropped. Nothing here needs range requests — which is just as well, because Cloud Storage's gzip transcoding and range requests do not combine.
