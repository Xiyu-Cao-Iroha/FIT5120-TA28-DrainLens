# Deploying DrainLens

**Live:** https://drainlens-205559161217.australia-southeast1.run.app — **Iteration 1, and holding there.** From 10 September 2026 this URL is the *published iteration* rather than the newest good code: it serves `iteration-1-frozen`, and Iteration 2 goes to `drainlens-dev` until it is finished. See [Preserving each iteration](#preserving-each-iteration).

**This file is about the site.** The API over the database is a second Cloud Run service, live since 5 September 2026 at https://drainlens-api-205559161217.australia-southeast1.run.app/health, with its own runbook, its own image and its own cost: [`deploy/API-DEPLOYMENT.md`](API-DEPLOYMENT.md). **Since 5 September the site reads four of its five artefacts from it**, falling back to the copies in this container when it cannot answer — so a change to the API does not need the site redeployed, and the API being stopped does not take the site down.

Cloud Run, `australia-southeast1`, project `fit5120-504507`. nginx serving **twenty static files** — twelve artefacts, `index.html`, three hashed bundles, the self-hosted font and its licence, and `robots.txt`. This container runs no application server of its own: everything it serves is a build product, and the scenario engine — when it is reachable at all — runs in the browser. Since 5 September the *browser* also reads four of those artefacts from the API instead, and the files here are what it falls back to.

**What a visit actually fetches has changed, and mostly downwards.** The homepage takes the five JSON artefacts; opening the map adds `scene.json` and `elevation.bin` for the ground surface. **Five of the six binary arrays are now fetched on no reachable path at all** — `flow`, `depressions`, `coverage`, `rim-depth` and `measured`, **5.25 MB between them** — because the only thing that read them was the scenario worker, and the comparison is out of the Iteration 1 interface. Measured with the network panel rather than reasoned about.

Deployed **31 August 2026**, redeployed **1 September 2026** for the difference layer, again on **3 September 2026** to put the access gate in front of it, and three times on **5 September 2026** — with the mentor review's changes, again that afternoon so the map tour opens by itself, again so the site reads its artefacts from the database, and twice on **7 September 2026** — with the team's own review list, and again with the pit card redrawn to the design and a spinner on the loading screen. **That last one is the last.** Iteration 1 was frozen on 8 September and Iteration 2 began on 10 September, so this service is not redeployed again until Iteration 2 is complete. Everything below was run, not planned, and every command was run by the team on their own machine.

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

### 5 September, later: the tour opens by itself

The map tour now opens once for a visitor who has not been shown it, which is the first change to `apps/web` since the morning's deployment.

| Redeployed 5 September | |
|---|---|
| Revision | `drainlens-00012-skx`, serving 100% |
| Bundle | `index-BxMtDgV4.js`, matching a local build of `main` at `c9e2dfc` — checked against the built file, not assumed |
| Build | First line said `Building using Dockerfile`. It is worth reading every time; the alternative fails silently |
| Gate | **401** without credentials, and the credentials carried over untouched — `gcloud run deploy` inherits environment variables you do not name, so the apr1 hash never had to be quoted a second time |
| Transfer | **1.03 MB over the wire, expanding to 3.52 MB (29%)** |
| First visit, p95 | **286.2 ms** from a laptop · p50 260.1 ms · max 920.8 ms |
| Fetch failures | **0 of 1,000** |

> **p95 went from 217.5 ms to 286.2 ms and that is not attributable to this change.** The wire figure is identical at 1.03 MB and the decoded total moved by 10 KB, which is the size of the code that was added — there is no payload here to explain a 69 ms difference. The same link moved 185 ms between two runs on consecutive days with nothing deployed in between, which is the measurement this document already records and the reason it leans on the transfer figure rather than the latency. Two runs cannot separate a link from a build, and pretending otherwise would make the number worse than useless.
>
> `elevation.bin` remains the slowest single resource — 788 KB, p95 170.3 ms, still 76% of a visit.

### 5 September, later still: the site reads the database

The map, the derived layers, the drainage graph and the flood board are fetched from the API. Each falls back to the copy in this container if the API cannot answer, and the footer of every screen names which source answered — see [`API-DEPLOYMENT.md`](API-DEPLOYMENT.md) and `apps/web/src/data/source.ts`.

**The API was deployed first, deliberately.** In the other order the site's first request is refused by CORS, it falls back to its bundled copies, and the result looks exactly like a working deployment that is not using the database.

| Redeployed 5 September, both services | |
|---|---|
| Site revision | `drainlens-00013-lgj`, serving 100% |
| API revision | `drainlens-api-00002-lkb`, serving 100% |
| Bundle | `index-BLGM03Nj.js` — see the trap below before comparing it |
| Build | `Building using Dockerfile` |
| CORS | `access-control-allow-origin` echoing the site's origin, with `vary: Origin` — the second half matters: without it a cache can hand one origin's permission to another |
| Cache | `cache-control: public, max-age=300` on artefacts, matching the `/data` tier nginx already serves |
| Gate | 401 without credentials, unchanged; the credentials carried over again |
| **Live footer** | **"Served from the DrainLens database."** — read on the deployed site, which is the only check that proves the database is load-bearing rather than merely reachable |
| First visit, p95 | **not re-measured.** The two attempts ran without `DRAINLENS_BASIC_AUTH` and `measure.mjs` refused, correctly. Carrying 5 September's figure forward as if it were this deployment's would be the thing this file exists to prevent |

> **Comparing the bundle now needs the variable, and getting that wrong proves the opposite of what it looks like.** `VITE_API_BASE` is inlined at build time, so a plain `npm run build` produces a *different* bundle from the container's: `index-B6zjlpI5.js` against `index-BLGM03Nj.js` on this commit. Compare against a build that sets it:
>
> ```bash
> VITE_API_BASE=https://drainlens-api-205559161217.australia-southeast1.run.app npm run build --workspace @drainlens/web
> ```
>
> The failure this guards against is the quiet one. If the `ARG` in the Dockerfile ever stopped taking effect, the deployed site would be the no-API build: it would load, draw, and answer every check in this file, with a footer saying it was served from the bundled copies — which is also what a working site looks like on a day the database is stopped. The bundle hash is what tells the two apart.

### 7 September: the team's review list, and two readability passes

Eight changes, all in `apps/web`: the six items on the team's own review list, then a readability pass over them and a second over the palette underneath. The API, the schema and the loader were untouched, so only this service was redeployed.

| Redeployed 7 September | |
|---|---|
| Bundle | `index-Cpom7AqE.js`, matching a local build of `main` **with `VITE_API_BASE` set** — the caveat below, needed for the second deployment running |
| Transfer | **1.03 MB over the wire, expanding to 3.52 MB (29%)** — unchanged to three figures |
| First visit, p95 | **273.6 ms** from a laptop · p50 199.9 ms · max 597.1 ms |
| Slowest resource | `elevation.bin` again: 788 KB, p95 131.2 ms, 76% of the visit |
| Fetch failures | **0 of 1,000** |
| Also served | `/quality.html`, a standalone page for the I2 deck — no scripts, no external requests, `noindex`, behind the same gate, outside the application build |

> **Nothing here is a performance claim.** The transfer is identical to 5 September's to three significant figures, because the changes were arrowheads, folds and colours. p95 moved 286.2 ms to 273.6 ms, which is a twelfth of the 185 ms this link has moved between two runs with nothing deployed at all. It is recorded because the measurement is taken every time, not because it means anything.

> **The record of the 5 September afternoon deployment was written on 5 September and reached this file on 7 September, because the commit carrying it was never pushed.** Two sessions were working in one checkout; a branch was switched under a running command, the commit landed on a local `main` instead of on the branch that was pushed, and the pull request that was opened for it therefore merged an empty diff. Nothing failed, and the pull request looked exactly like every other one.
>
> **The check that would have caught it is one line**: after pushing, confirm the remote branch contains the commit — `git branch -r --contains HEAD` — rather than reading the pull request URL as proof. A pull request is evidence that a branch was merged, not evidence of what was on it.

### 7 September, later: the pit card as designed

| Redeployed 7 September | |
|---|---|
| Revision | `drainlens-00015-lxc`, serving 100% |
| Bundle | `index-DFGygy6v.js`, matching a local build of `main` at `639fd2e` **with `VITE_API_BASE` set** |
| Transfer | **1.04 MB over the wire, expanding to 3.53 MB (29%)** |
| First visit, p95 | **283.3 ms** from a laptop · p50 254.4 ms · max 616.6 ms |
| Fetch failures | **0 of 1,000** |

> **This is the first redeployment whose transfer figure moved and could be accounted for.** 1.03 MB to 1.04 MB: the JavaScript bundle grew 631 bytes gzipped for three inline SVG icons, and `base.css` gained a container query and a keyframe, which is a new hashed stylesheet. Ten kilobytes, spent on a card that says what the data does not show and on a mark that says the page is working rather than broken.
>
> The p95 moved 273.6 ms to 283.3 ms and is **not** part of that. Ten kilobytes do not cost ten milliseconds on a link that has moved 185 ms between two runs with nothing deployed at all. The rule this file has used since 1 September holds: the transfer figure is the one to read, and the latency is recorded rather than interpreted.

> **The revision id for the earlier deployment on this day was not captured**, which is why that row has none. `gcloud run revisions list --service=drainlens --region=australia-southeast1` still holds it; it is recorded here as missing rather than filled in from a guess about the numbering.

| Still true of every deployment | |
|---|---|
| Bundle | Changes with every build. Compare it, do not assume it. |
| Credentials | The container refuses to start without them. A deployment that quietly loses its gate looks exactly like one that never had it. |
| Measuring behind the gate | `measure.mjs` refuses to run without `DRAINLENS_BASIC_AUTH`. It used to time the 401s instead — fast, plausible, and of nothing. |

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

**The tags, and why there are two.** A tag must point at code somebody ran;
that rule is what produced the second one rather than a rewrite of the first.

| Tag | Commit | Marks |
|---|---|---|
| `iteration-1-final` | `0a0a4d6` | the **5 September** deployment, `drainlens-00011-pzw`, bundle `index-etSUqsfy.js` |
| `iteration-1-frozen` | `main` at the freeze | the **7 September** deployment, `drainlens-00015-lxc`, bundle `index-DFGygy6v.js` -- what is live |

```bash
git tag -a iteration-1-frozen <commit> -m "Iteration 1 frozen, 8 September 2026"
git push origin iteration-1-frozen
```

> **`iteration-1-final` was not moved onto the newer commit, and the reason is
> not sentiment.** Its annotation carries that deployment's measured figures --
> the revision, the bundle hash, the test counts, 1.03 MB and a p95 of 217.5 ms
> -- and `git tag -f` replaces the annotation along with the target. Moving it
> would delete a dated measurement to make one label tidy, which is the house
> rule this repository breaks least often: **a figure is either re-measured or
> dated, never adjusted by hand to look current.** Two tags with two dates say
> what happened. One tag pointed at the newer commit would say the 5 September
> deployment never had its own figures.

**What the freeze verified, on the day.** Every gate re-run rather than read
off the last record: 683 Node tests across 37 files at 92.56%, 377 Python at
91.79%, `tsc --build --force` clean, `tools/docs/check.mjs` clean, and a local
build **with `VITE_API_BASE` set** reproducing `index-DFGygy6v.js` -- the
bundle the live container serves. That last one is the check that the tag and
the running service are the same code; the rest is the code being fit to
freeze.

> **Freezing the site does not freeze what it reads.** The Dockerfile's
> `VITE_API_BASE` defaults to the shared API, so `drainlens-iteration1` will
> point at the same service `drainlens` does. If the API changes, both change;
> if it is stopped, both fall back to the artefacts baked into their own
> images and say so in the footer. That is the designed behaviour rather than
> an oversight -- but it means the frozen URL is frozen in its *code*, not in
> everything it can show.

**The URL.** Cloud Run gives every *service* its own hostname, so a service per
role is the closest thing available to the subdomain pattern the studio draws:

| Role | The studio's shape | Service | Built from | Holds |
|---|---|---|---|---|
| **Dev** | `dev.example.com` -- the iteration being built | `drainlens-dev` | `develop` | Iteration 2, as it is built |
| **Live root** | `example.com` -- the latest **completed** iteration | `drainlens` | `main` | **Iteration 1**, and not moving |
| **Archive** | `iteration1.example.com`, `iteration2.…` -- each completed iteration | `drainlens-iteration1` | tag `iteration-1-frozen` | deployed once, then left alone |

> **`drainlens` filled two of those roles at once until 10 September, and the
> freeze is what stopped that being safe.** It had been redeployed eight times
> as work continued, which is the *dev* behaviour -- correct while there was no
> completed iteration to protect, and that is the studio's own first case: at
> the start there is no previous version, so the root can carry the work.
>
> **Iteration 2 began on 10 September**, and from that moment the root must
> keep showing Iteration 1 while Iteration 2 is built.

### What changed for the branches on 10 September

**`develop` no longer flows to `main` at the end of a change.** Every pull
request until now ended with a second one merging `develop` into `main`,
because `main` was the thing that got deployed. `main` is now the *published
iteration* rather than the newest good code, so it holds at
`iteration-1-frozen` until Iteration 2 is finished.

| | Until 8 September | From 10 September |
|---|---|---|
| Branch off | `develop` | `develop`, unchanged |
| Feature PR into | `develop` | `develop`, unchanged |
| Then | a second PR, `develop` into `main` | **nothing** -- work stops on `develop` |
| Deployed to | `drainlens`, the root | `drainlens-dev` |
| `main` moves | every release | **once**, when Iteration 2 is complete |

> **The one that will be got wrong is the third row**, because two pull
> requests in a row is the habit this repository has had since 26 August and a
> `develop` into `main` merge is one click away at any time. The check is the
> same one the empty-diff incident produced: after merging, read where the
> commit landed rather than trusting the routine. `git rev-parse origin/main`
> must still be `138a002` for the whole of Iteration 2.

**Completing Iteration 2** is then one pass, and it is the same shape as the
Iteration 1 freeze: merge `develop` into `main`, re-run every gate rather than
citing the last recorded numbers, tag `iteration-2-frozen`, deploy that tag to
**both** `drainlens` and a new `drainlens-iteration2`, and check the served
bundle hash against a local build on each. `drainlens-iteration1` is not
touched, then or ever.

> **The dev service is the one place a deployment is allowed to be routine.**
> It exists so that Iteration 2 can be shown to the team on a real URL without
> that showing anything to a marker reading the root. It carries the same
> access gate: an unlisted URL is not a gate, and a half-built iteration is
> exactly what should not be found by accident.

A subdirectory (`/iteration1`) is **not** an option here and the reason is
already recorded above: every path this app fetches is absolute from `/`, which
is the same constraint that ruled out serving it from a Cloud Storage
sub-path. Reaching a subdirectory layout would mean an HTTPS load balancer,
which needs a domain, which the team does not have.

No iteration *branch* is needed. The studio says to create one only when the
hosting platform requires a branch to deploy from; `gcloud run deploy --source`
takes whatever is checked out, so a tag is enough.

```bash
git checkout iteration-1-frozen
gcloud run deploy drainlens-iteration1 --project=fit5120-504507 --source=. \
  --region=australia-southeast1 --allow-unauthenticated --port=8080 \
  --memory=512Mi --max-instances=1 \
  --set-env-vars 'BASIC_AUTH_USER=<user>,BASIC_AUTH_HASH=<hash>'
git checkout main
```

> **Two things to read from the build output, in this order.** The first line
> must say `Building using Dockerfile` -- `--source=.` falls back to Buildpacks
> without erroring, and this repository has already shipped that failure once.
> Then check the served bundle is `index-DFGygy6v.js`: the frozen service is
> only frozen if it built the tag's code, and a container that quietly built
> something else looks identical from the outside.
>
> Single quotes around `--set-env-vars` are not optional on PowerShell. A comma
> makes an array there, which is rejoined with spaces, so the variables arrive
> as a value nobody typed. That is recorded in full in
> [`API-DEPLOYMENT.md`](API-DEPLOYMENT.md); it bit a `--database-flags` first.

> `--allow-unauthenticated` stays on all of them. It governs Cloud Run's own
> IAM, which is a different gate from the one in nginx: leaving it off would
> demand a Google identity and a signed request, which is not something a
> mentor can do from a browser. The password prompt is the gate; IAM is not
> being used as one.

**The dev service**, created when Iteration 2 began and redeployed as often as
the work needs it. Same image, same gate, same flags -- the only differences
are the service name and that it is built from `develop` rather than a tag.

```bash
git checkout develop
gcloud run deploy drainlens-dev --project=fit5120-504507 --source=. \
  --region=australia-southeast1 --allow-unauthenticated --port=8080 \
  --memory=512Mi --max-instances=1 \
  --set-env-vars 'BASIC_AUTH_USER=<user>,BASIC_AUTH_HASH=<hash>'
```

> **`--max-instances=1` is what makes four services cost about what one does.**
> Cloud Run scales each of them to zero when nobody is asking, so an idle
> archive is free and the dev service costs only while it is being looked at.
> The instance cap also means a runaway loop cannot quietly scale out; the
> always-on cost in this project is the Cloud SQL instance, and that is stopped
> between demos.
>
> **The environment variables have to be given the first time.** `gcloud run
> deploy` inherits variables you do not name, but only from a service that
> already exists -- and the container refuses to start without them, which is
> the fail-closed behaviour verified above. Read them off the running root
> rather than retyping the hash: `gcloud run services describe drainlens
> --region=australia-southeast1 --project=fit5120-504507 --format=yaml`. Keep
> `--format=yaml` as one unquoted token; `gcloud.cmd` strips inner double
> quotes, which is what broke the logging filters in
> [`API-DEPLOYMENT.md`](API-DEPLOYMENT.md).

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
