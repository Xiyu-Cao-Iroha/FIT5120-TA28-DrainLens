# Deploying DrainLens

**Live:** https://drainlens-205559161217.australia-southeast1.run.app

Cloud Run, `australia-southeast1`, project `fit5120-504507`. nginx serving **twenty static files** — twelve artefacts, `index.html`, three hashed bundles, the self-hosted font and its licence, and `robots.txt`. There is no application server: the map, the terrain, the drainage network, the address index and the flood history are build products, and the scenario engine — when it is reachable at all — runs in the browser.

**What a visit actually fetches has changed, and mostly downwards.** The homepage takes the five JSON artefacts; opening the map adds `scene.json` and `elevation.bin` for the ground surface. **Five of the six binary arrays are now fetched on no reachable path at all** — `flow`, `depressions`, `coverage`, `rim-depth` and `measured`, **5.25 MB between them** — because the only thing that read them was the scenario worker, and the comparison is out of the Iteration 1 interface. Measured with the network panel rather than reasoned about.

Deployed **31 August 2026**, redeployed **1 September 2026** for the difference layer, again on **3 September 2026** to put the access gate in front of it, and again on **5 September 2026** with the mentor review's changes. Everything below was run, not planned, and every command was run by the team on their own machine.

| Redeployed 1 September | |
|---|---|
| Bundle | `index-DPqqSve1.js`, matching a local build of `main` — which is also how you know it built from the Dockerfile and not from Buildpacks |
| Worker content type | `text/javascript`, exactly one header |
| gzip, three cache tiers, `/data` 404 | unchanged |
| **AD1** | positive control shows system, system_event and stderr writing; **0 entries carrying a client IP**, no `requests` log |
| Transfer | **1.36 MB over the wire, expanding to 6.43 MB (21%)** |
| First visit, p95 | **692.4 ms** from a laptop, against the 34.5 ms localhost floor |

### 3 September: the gate, and the failure that only shows for the right password

The access gate went up. It answered a request with no credentials with a clean **401** and a request with the **correct** password with **500**.

nginx opens `auth_basic_user_file` in a worker, and workers drop to an unprivileged user, while `entrypoint.sh` runs as root and wrote the file `600`. The worker got EACCES. The shape of that failure is what makes it worth recording: a request without credentials never opens the file, so it still gets a correct 401 and the gate looks like it is working — **it fails only for the person who actually has the password, and only after they type it correctly.** The file is `444` now, and the container log named it in one line.

> **The lesson generalises past this bug.** The gate passed every local check written for it — four misconfigurations, the hash's shape, the CRLF, the quoting trap — and none of them tested that it lets the right person *in*, because that needs a running container and a real password. A 401 is only half the check. Both sides are in *Verify* below, and the 200 is the half that carries new information.

### 5 September: re-measured, and the arrays that stopped being fetched

| Redeployed 5 September | |
|---|---|
| Revision | `drainlens-00011-pzw`, serving 100% |
| Bundle | `index-etSUqsfy.js`, matching a local build of `main` — checked, not assumed |
| Gate | **401** without credentials, **200** with them. The 200 is the half that carries new information; see 3 September above for why |
| **AD1** | positive control shows system, system_event and stderr writing; **0 entries carrying a client IP**, no `requests` log |
| Transfer | **1.03 MB over the wire, expanding to 3.51 MB (29%)** |
| First visit, p95 | **217.5 ms** from a laptop · p50 191.4 ms · max 535.0 ms |
| Fetch failures | **0 of 1,000** |

> **The transfer fell because five arrays stopped being fetched, not because anything got smaller.** `flow`, `depressions`, `coverage`, `rim-depth` and `measured` — about 4.5 MB — are still published and are now read by nothing: `loadScene` runs in the scenario worker, and `useScenario` is enabled only on the scenario and result screens, neither of which is on any route in the Iteration 1 interface. They are still in the image because the comparison returns in Iteration 2.
>
> **The compression ratio got worse and that is not a regression either.** 21% to 29% means the arrays that left compressed better than what remains. `elevation.bin` is now 788 KB of a 1.03 MB visit — 76% of it — and the slowest single resource at a p95 of 126 ms.
>
> **The p95 comparison is the one to be careful with.** 692.4 ms on 1 September and 217.5 ms now are both from a laptop over a home connection to Sydney, and that link moved 185 ms between two runs on consecutive days in September with nothing deployed in between. Some of this improvement is 4.5 MB that is no longer requested. How much is the link and how much is the payload, one pair of runs cannot say — which is why the transfer figure, not the latency, is the one this document leans on.
>
> **0 of 1,000 requests failed**, which also means not one of them was answered 401. The gate and the credentials held for the whole run, which is a stronger statement than a single 200.

| Still true of every deployment | |
|---|---|
| Bundle | Changes with every build. Compare it, do not assume it. |
| Credentials | The container refuses to start without them. A deployment that quietly loses its gate looks exactly like one that never had it. |

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
gcloud run deploy drainlens --project=fit5120-504507 --source=. \
  --region=australia-southeast1 --allow-unauthenticated --port=8080 \
  --memory=512Mi --max-instances=3 \
  --set-env-vars 'BASIC_AUTH_USER=<user>,BASIC_AUTH_HASH=<hash>'
```

**Single quotes.** The hash contains `$` signs and double quotes destroy it —
see *Quote the hash with single quotes* below, which is not a style preference.

`--allow-unauthenticated` is the one step to be deliberate about: it publishes the site. That is the intent — it is a public information site — but it is worth a pause.

Watch the first line of output. It must say **`Building using Dockerfile`**. If it says `Building using Buildpacks`, stop — see *What went wrong*.

**4. Take the "after" measurement, and say where you ran it from.**

```bash
node tools/perf/measure.mjs https://drainlens-205559161217.australia-southeast1.run.app 100
```

---

## The access gate

Required by the Week 6 studio, and stated again in Rana's email of 2 September:
put a password in front of the **whole deployed website**, before a user can
reach the application at all. DrainLens is a self-managed container behind
nginx, so this is the Nginx Basic Authentication case the email names.

**It is not a product login and never will be.** AD1 says this product holds no
identity, so there is no account system to reuse and website-level protection
is the only kind available to it -- which is exactly the distinction the slides
draw. The landing page's promise that "no account is required" is about the
product; the gate is about the deployment.

### The password is never in this repository

`entrypoint.sh` builds the htpasswd file at start-up from two environment
variables. `BASIC_AUTH_HASH` is already a hash, generated on somebody's own
machine, so nothing in the image or the repository can be turned back into a
password.

Generate it yourself, on your machine, and do not paste the password anywhere.

**`htpasswd` is not on Windows.** It ships with Apache, not with Git or with
PowerShell, and `htpasswd -nBC 10 mentor` fails with `CommandNotFoundException`.
Git for Windows does ship OpenSSL, which is enough:

```bash
# Prompts twice, prints only the hash. Run it in Git Bash.
openssl passwd -apr1
```

```powershell
# The same thing from PowerShell, naming Git's copy explicitly.
& "C:\Program Files\Git\usr\bin\openssl.exe" passwd -apr1
```

Never pass the password as an argument (`openssl passwd -apr1 mypassword`) —
that lands in shell history. Let it prompt.

**Use `-apr1`, not bcrypt, for this image.** nginx implements apr1 itself, in
`ngx_crypt.c`, so it works regardless of what the container's libc offers. For
`$2y$` it hands off to the platform's `crypt()`, which is a dependency on musl
in `nginx:1.27-alpine` rather than on nginx — a needless thing to be right
about when apr1 is guaranteed. The gate is website-level protection on a
student project, not a credential store.

Put the **hash** in the deploy command below and the **password** in the PGP
Team Info document beside the URLs, which is where the slides say operational
credentials belong.

### Quote the hash with single quotes, or it is destroyed silently

An apr1 hash looks like `$apr1$vVu0PpL1$IPCDVqdCLwY7X7qdPiwaI.` — three `$`
signs. In **double** quotes, bash and PowerShell both expand `$apr1`, `$vVu0PpL1`
and `$IPCDVqdCLwY7X7qdPiwaI` to nothing before `gcloud` ever runs:

```bash
H='$apr1$vVu0PpL1$IPCDVqdCLwY7X7qdPiwaI.'
eval "echo \"$H\""      # prints: .
```

One character. **Short, wrong, and not empty** — so the fail-closed guard used
to pass it, nginx started, and the site was locked against everybody including
whoever held the password. That is worse than a failed deploy, because it looks
like a working one until somebody tries the gate.

`entrypoint.sh` now checks the *shape* of the hash as well as its presence and
refuses anything that is not a format nginx reads. But the fix is to quote it
correctly in the first place: **single quotes around the whole `--set-env-vars`
value.**

### It fails closed, on purpose

Without both variables the container **exits and never serves**. Cloud Run then
keeps the previous revision running, so the cost is a failed deploy you can see
rather than an unprotected site you cannot.

This is not caution for its own sake. This repository has already shipped two
failures of exactly that shape -- `--source=.` falling back to Buildpacks
without erroring, and a log exclusion written to a field that stored it happily
and filtered nothing. A gate that silently disappears is the same bug a third
time.

Verified before deploying, by running the entrypoint's guard directly:

| Environment | Result |
|---|---|
| Neither variable set | exits 1, refuses to start |
| `BASIC_AUTH_USER` only | exits 1 |
| `BASIC_AUTH_HASH=""` | exits 1 -- an empty value is not a configured one |
| `BASIC_AUTH_HASH="."` | exits 1 -- what double quotes leave behind, and the case the presence check alone let through |
| Both set, hash well formed | exits 0, writes the htpasswd, substitutes `$PORT` |

---

## Preserving each iteration

The studio asks for a Git tag per iteration, an accessible deployed version of
each, and clear iteration URLs.

**The tag.** `iteration-1-final` marks the commit that was demonstrated and
deployed -- not the current `main`, which has moved on. A tag that points at
code nobody ran is a worse record than no tag.

```bash
git tag -a iteration-1-final <commit> -m "Iteration 1 as demonstrated, 1 September 2026"
git push origin iteration-1-final
```

**The URL.** Cloud Run gives every *service* its own hostname, so a second
service is the closest thing available to the subdomain pattern:

| | |
|---|---|
| `drainlens` | the current build, redeployed as work continues |
| `drainlens-iteration1` | deployed once from the tag, then left alone |

A subdirectory (`/iteration1`) is **not** an option here and the reason is
already recorded above: every path this app fetches is absolute from `/`, which
is the same constraint that ruled out serving it from a Cloud Storage
sub-path. Reaching a subdirectory layout would mean an HTTPS load balancer,
which needs a domain, which the team does not have.

No iteration *branch* is needed. The studio says to create one only when the
hosting platform requires a branch to deploy from; `gcloud run deploy --source`
takes whatever is checked out, so a tag is enough.

```bash
git checkout iteration-1-final
gcloud run deploy drainlens-iteration1 --project=fit5120-504507 --source=. \
  --region=australia-southeast1 --allow-unauthenticated --port=8080 \
  --memory=512Mi --max-instances=1 \
  --set-env-vars 'BASIC_AUTH_USER=<user>,BASIC_AUTH_HASH=<hash>'
git checkout main
```

> `--allow-unauthenticated` stays on both. It governs Cloud Run's own IAM,
> which is a different gate from the one in nginx: leaving it off would demand
> a Google identity and a signed request, which is not something a mentor can
> do from a browser. The password prompt is the gate; IAM is not being used as
> one.

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
# The gate first, and from both sides. A check that only confirms the site
# still works cannot tell a protected deployment from an open one.
curl -s -o /dev/null -w '%{http_code}\n' https://drainlens-205559161217.australia-southeast1.run.app/
#    Expect: 401.

curl -s -o /dev/null -w '%{http_code}\n' -u '<user>:<password>' https://drainlens-205559161217.australia-southeast1.run.app/
#    Expect: 200. Without this line the 401 above could be a broken container.

curl -sI -u '<user>:<password>' https://drainlens-205559161217.australia-southeast1.run.app/assets/worker-*.js | grep -i content-type

curl -sI -u '<user>:<password>' -H 'Accept-Encoding: gzip' https://drainlens-205559161217.australia-southeast1.run.app/data/scene/elevation.bin | grep -i content-encoding
```

**The logging check is the one that matters, and it only counts after real traffic.**

```bash
# 1. Generate some. An empty log during a quiet hour proves nothing.
for i in 1 2 3 4 5; do curl -s -o /dev/null -u '<user>:<password>' https://drainlens-205559161217.australia-southeast1.run.app/data/map.json; done
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
