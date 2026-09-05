# Deploying the DrainLens API

**Live:** https://drainlens-api-205559161217.australia-southeast1.run.app/health

Deployed **5 September 2026**. This file was written as a runbook before any of it was run, and it has been corrected in three places since — two PowerShell quoting traps that made commands here fail, and one claim about the instance's addressing that was stronger than what was deployed. Those corrections are in place rather than in a footnote, because a runbook that records what somebody meant to type is worse than no runbook.

A second Cloud Run service, `drainlens-api`, over a Cloud SQL for PostgreSQL instance. Five `GET` routes returning the artefacts the frontend already accepts, rebuilt from rows. Same project `fit5120-504507`, same region `australia-southeast1`, same log exclusion — that last one has to be *verified*, not inherited by assumption, and step 2 is where.

**The site does not depend on this.** `apps/web` still fetches its five JSON files from its own container and does not know the API exists. That is deliberate for one iteration: it means this can be deployed, measured, shown and switched off without the site being down for a minute of it, and it means switching the frontend over later is a URL and a CORS header rather than a release.

---

## What the first deployment measured

| 5 September 2026 | |
|---|---|
| Revision | `drainlens-api-00001-69r`, serving 100% |
| Image | `api:d3ce975` — the same short SHA as `main`'s head. Compared, not assumed |
| Data | `/health` answers `{"status":"ok","pits":895,"areas":30}`. Those are the counts `apps/api/test-db/load.test.ts` asserts, so the migration job reached the database rather than the service starting against an empty one |
| Responses | `tools/deploy/verify-api.mjs` passed **all eight checks** against the deployed URL. Every response deep-equals the published artefact |
| **AD1** | `httpRequest.remoteIp:*` over the whole project, one hour, 150 requests in the window: **no entries**. Positive control in the same window shows `system_event`, `varlog/system`, `stdout` and `activity` writing — and **no `run.googleapis.com/requests` log at all** |
| **Cloud SQL logs** | `postgres.log` is being written and contains only internal maintenance (`automatic analyze of ... heartbeat`, with `db=` and `user=` both empty). **No connection entries**, which is `log_connections=off` doing its job and not a query that matched nothing |
| Failures | **0 of 150 requests** |

Latency, thirty samples per route, from a laptop over a home connection to Sydney — the same caveat as the site's figures: this measures that link as much as the service.

| Route | p50 | p95 | max | Body |
|---|---|---|---|---|
| `/health` | 31.5 ms | 35.0 ms | 343.8 ms | — |
| `/api/flood-history` | 36.6 ms | 56.5 ms | 306.8 ms | 5.4 KB |
| `/api/trace/kensington` | 44.7 ms | 50.0 ms | 54.6 ms | 36.8 KB |
| `/api/derived/kensington` | 50.9 ms | 60.4 ms | 76.0 ms | 135.6 KB |
| `/api/map/kensington` | 71.2 ms | 85.1 ms | 85.8 ms | 315.9 KB |

The two maxima over 300 ms are cold starts — `--min-instances=0` means the first request after an idle period pays for the container and the connector coming up. That is the cost of not paying for an idle instance, and at this stage it is the right trade.

> **`/` answers 404, and that is correct.** There is no root route: this is five `GET`s, not a website. The first thing anybody does with a new URL is open it in a browser, so it is worth saying here rather than discovering it as a fault.

---

## Rehearsed locally first, 5 September 2026

Everything below except the four steps that need Google — the APIs, the instance, the secret and the IAM grants — was run against the image this file describes, before any of it was run against a project that charges for mistakes.

| | |
|---|---|
| Image | `docker build -f deploy/api/Dockerfile .` — built from the repository root, 23 runtime packages resolved from the lockfile |
| Migration job | `node apps/api/dist/migrate.js` against an empty schema: applied migration 1 and loaded all thirteen tables, output below |
| Run twice | Second execution printed `schema  already current` and the same counts. This is the property that matters in deployment: the person running the job cannot always be sure whether somebody ran it this afternoon |
| Service | `node apps/api/dist/server.js`, one line — `listening on 8080` — and a 200 from `/health`. The entry-point path comparison holds for `dist/*.js`, which is the bug that once made this build, start, exit zero and listen on nothing |
| Verification | `tools/deploy/verify-api.mjs` passed all eight checks against the container |
| **And failed when it should** | Three rows deleted from `pit` and thirty-seven links from `trace_link`: three checks went red and it exited 1. A checker that has never failed is not evidence of anything |

What the rehearsal cannot tell you: whether the Cloud SQL connector works, whether the service account can read the secret, and whether the log exclusion holds for a second service. Those are steps 2, 8 and 10, and they are the reason those steps have positive controls.

---

## What it costs, and how to stop paying

**Cloud SQL has no free tier.** The instance is charged for every hour it exists, whether or not anybody visits, and storage is charged even while it is stopped. Cloud Run and Artifact Registry are effectively free at this volume; the database is not.

> **Read the pricing calculator before running step 4.** Nothing in this document is a quote. The smallest shared-core instance with 10 GB of HDD in `australia-southeast1` is the configuration below, and it is the cheapest thing that runs Postgres 16 in this project — but the number changes and this file will not notice.

Two levers, in order of how much they save:

```bash
gcloud sql instances patch drainlens-db --activation-policy=NEVER --project=fit5120-504507
```

Stops the instance. Compute stops being charged; storage does not. `--activation-policy=ALWAYS` starts it again, in a minute or two.

```bash
gcloud sql instances delete drainlens-db --project=fit5120-504507
```

**Deleting it loses nothing.** Every row in this database is derived from `apps/web/public/data/*.json`, which is in the repository; the migration job rebuilds the whole thing from a checkout in one execution. That is also why the instance is created with **no backups** — a backup of a derived database is a copy of something already in git, paid for monthly.

---

## PowerShell rewrites arguments before gcloud sees them

Both failures of the first deployment were this, and neither looked like it. The commands are correct; PowerShell changed them on the way past.

**A comma makes an array.** `--database-flags=a=off,b=off,c=none` is parsed as three elements, which PowerShell then joins with spaces when it hands them to a native command. gcloud received `--database-flags=a=off b=off c=none` and answered `Failed to set log_connections: off log_disconnections=off log_statement=none is not on/off` — a message about a value nobody typed. **Wrap any argument containing a comma in single quotes.**

**Inner double quotes are lost.** `gcloud` on Windows is `gcloud.cmd`, and an argument whose value contains `"` is re-parsed on the way through. A logging filter written `'resource.labels.database_id="fit5120-504507:drainlens-db"'` arrived unquoted, and the parser stopped on the colon: `syntax error at line 1, column 124, token ':'` — for a filter only 95 characters long, because gcloud prepends `timestamp>="..."` from `--freshness`, and 124 lands exactly on that colon.

The fix for filters is not more quoting. It is **filters with no spaces and no quotes in them at all**, which step 10 now uses.

This is the same family as *Quote the hash with single quotes* in [`deploy/README.md`](README.md), where double quotes reduced an apr1 hash to a single character and nginx accepted it. In all three cases the shell edited the value and nothing downstream could tell.

---

## The order, and why it is this order

### 1. Enable the APIs

Individually, and never inferred from a sibling working.

```bash
gcloud services enable sqladmin.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com --project=fit5120-504507
```

### 2. Check the log exclusion covers a service that does not exist yet

**Before the instance, before the image, before anything can receive a request.** AD1 says this product keeps no IP address, and Cloud Run writes `httpRequest.remoteIp` into its request log by default. An exclusion drops entries *before they are written*; one added afterwards cannot unwrite the lines already holding a visitor's address.

The exclusion applied for the site in September filters on `LOG_ID(run.googleapis.com/requests)`, which names the log and not the service — so it should already cover every Cloud Run service in this project, including one created next week. **Should is not a verification.** Read it back:

```bash
gcloud logging sinks describe _Default --project=fit5120-504507 --format="yaml(exclusions)"
```

It must contain an exclusion whose filter is `LOG_ID(run.googleapis.com/requests)`, and which is not disabled. If the filter has been narrowed to a service name at some point, widen it — or add a second exclusion — before continuing.

> **It must be `--add-exclusion`, not the sink's own `--log-filter`.** That mistake has already been made once in this project: `NOT LOG_ID(...)` on the sink filter stored correctly, looked right, and did not stop the logs. Two entries carrying a real client IP were written eleven minutes later. See *What went wrong* in [`deploy/README.md`](README.md).

Step 10 proves it with a positive control. This step only proves the configuration exists.

### 3. Decide the database is allowed to log connections, and say no

Cloud SQL can log every connection, with the connecting address. For a service behind the Cloud SQL connector that address is Google's, not a resident's — but "the IP we log is not a person's" is an argument, and turning the logging off is a fact. Set the flags at creation time so there is no window in which the answer depends on a default nobody checked:

```
--database-flags=log_connections=off,log_disconnections=off,log_statement=none
```

They are in the command below. `log_statement=none` is Postgres's default; it is written out because a flag that is set explicitly can be read back, and a default cannot be distinguished from an oversight.

### 4. Create the instance — this is the step that starts costing money

```bash
gcloud sql instances create drainlens-db --project=fit5120-504507 --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro --region=australia-southeast1 --availability-type=zonal --storage-type=HDD --storage-size=10GB --no-storage-auto-increase --no-backup '--database-flags=log_connections=off,log_disconnections=off,log_statement=none'
```

**The single quotes around `--database-flags` are not decoration** — see *PowerShell rewrites arguments before gcloud sees them* above. Without them this command fails with `off log_disconnections=off log_statement=none is not on/off`.

**Postgres 16 because that is what the tests run against** — `db/docker-compose.yml` and the CI service container are both `postgres:16-alpine`. A migration that applies on 16 and not on 17 is a thing to find out in `npm run test:db`, not in a job execution.

`--no-storage-auto-increase` because 8 MB of artefacts in a 10 GB volume cannot grow into a bill by accident, and a database that silently buys itself more disk is a cost nobody reviews.

The instance keeps its default public IP with **no authorized networks**, which is not the same as being reachable: without an authorized network, the only way in is the Cloud SQL Auth connector, which requires IAM and TLS. Do not add an authorized network to make something work — if a connection fails, it is IAM, and step 8 grants it.

```bash
gcloud sql databases create drainlens --instance=drainlens-db --project=fit5120-504507
```

### 5 and 6. The password, and the secret it goes into — one block, because nobody should have to remember it

The password is needed exactly twice: to create the user, and to build the connection string. After that the job and the service read the secret, and no human touches it again. So it is generated, used twice and discarded inside one block, and is never displayed, never written to a file that outlives the command, and never typed by anybody.

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $pw = ($b | ForEach-Object { $_.ToString('x2') }) -join ''; gcloud sql users create drainlens --instance=drainlens-db --password=$pw --project=fit5120-504507; $f = Join-Path $env:TEMP "dburl.txt"; [IO.File]::WriteAllText($f, "postgresql://drainlens:$pw@localhost/drainlens?host=/cloudsql/fit5120-504507:australia-southeast1:drainlens-db"); gcloud secrets create drainlens-db-url --replication-policy=automatic --data-file="$f" --project=fit5120-504507; Remove-Item $f; Remove-Variable b, pw, f
```

**The connection string is** `postgresql://drainlens:PASSWORD@localhost/drainlens?host=/cloudsql/fit5120-504507:australia-southeast1:drainlens-db`. `localhost` is a placeholder the parser requires and does not use: `host=` names a **directory**, and Cloud Run mounts the connector's unix socket there. There is no TCP connection and no port.

**Hexadecimal, and that is not fussiness.** The password goes inside a URL, where a `#`, `@`, `/` or `?` silently truncates it — the same failure class as the apr1 hash that double quotes reduced to one character and that nginx then accepted. The gate looked like it was working; it was locked against everybody.

**`[IO.File]::WriteAllText`, not `notepad` or `Out-File`.** Notepad may write a BOM and `Out-File` appends a newline, and either would go into the secret: `host=/cloudsql/...drainlens-db\r\n` names a directory that does not exist, and the failure reads as a connection error rather than as three stray bytes. `WriteAllText` writes UTF-8 with no BOM and no trailing newline.

**The one trade in that block is `--password=$pw`.** For the seconds it runs, the password is on the gcloud process's command line, where another process on the machine could read it. What it buys is that the password is *not* in `ConsoleHost_history.txt` — PowerShell records the literal `--password=$pw`, not its value — not echoed to the screen, and not on disk. On a single laptop that is the better side of the trade: a process command line lives for seconds, and the history file survives reboots.

If you would rather it were interactive, `gcloud sql users create drainlens --instance=drainlens-db --prompt-for-password` reads it from the terminal instead — but then you hold it in the clipboard to paste into the secret, which is its own exposure.

Check the secret without printing it:

```bash
(gcloud secrets versions access latest --secret=drainlens-db-url --project=fit5120-504507).Length
```

**171**, exactly: 23 characters of prefix, 64 of hexadecimal password, 84 of suffix. One over is a trailing newline, three over is a BOM, short is a truncated password — all three are fixed with a new version, and none of them requires showing the value.

Nothing needs to remember the password afterwards. To change it: `gcloud sql users set-password drainlens --instance=drainlens-db --prompt-for-password`, then `gcloud secrets versions add drainlens-db-url --data-file=...`. The job and the service both reference `:latest`, so a new version takes effect on the next execution and the next revision — not on the running one.

### 7. Create the image repository, and build

```bash
gcloud artifacts repositories create drainlens --repository-format=docker --location=australia-southeast1 --description="DrainLens API images" --project=fit5120-504507
```

```bash
gcloud builds submit --config=deploy/api/cloudbuild.yaml --substitutions=_TAG=$(git rev-parse --short HEAD) --project=fit5120-504507
```

From the repository root, on `main`, with a clean working tree — the tag is the commit, and a tag that names a commit the image was not built from is worse than no tag.

**`--config`, not `--tag`.** `gcloud builds submit --tag=...` and `gcloud run deploy --source=.` both look for `./Dockerfile`, which belongs to the site. Naming `deploy/api/Dockerfile` explicitly is the only way to build a second service from this repository, and it also removes the failure this project has already shipped once: a `--source=.` that found no Dockerfile fell back to Buildpacks and built something else without erroring.

### 8. Let the service account reach the database and the secret

```bash
gcloud projects add-iam-policy-binding fit5120-504507 --member=serviceAccount:205559161217-compute@developer.gserviceaccount.com --role=roles/cloudsql.client
```

```bash
gcloud secrets add-iam-policy-binding drainlens-db-url --member=serviceAccount:205559161217-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor --project=fit5120-504507
```

`205559161217` is this project's number — it is the same number in the site's Cloud Run hostname, which is how it was read rather than guessed. Confirm with `gcloud projects describe fit5120-504507 --format="value(projectNumber)"` if the default compute service account has been changed.

### 9. Migrate, then serve — in that order

The job and the service are **the same image**. A migration built from a different commit than the server it migrates for is a class of failure nobody can reproduce afterwards.

```bash
gcloud run jobs deploy drainlens-migrate --image=australia-southeast1-docker.pkg.dev/fit5120-504507/drainlens/api:$(git rev-parse --short HEAD) --region=australia-southeast1 --project=fit5120-504507 --command=node --args=apps/api/dist/migrate.js --set-cloudsql-instances=fit5120-504507:australia-southeast1:drainlens-db --set-secrets=DATABASE_URL=drainlens-db-url:latest --memory=512Mi --task-timeout=10m --max-retries=0
```

```bash
gcloud run jobs execute drainlens-migrate --region=australia-southeast1 --project=fit5120-504507 --wait
```

`--max-retries=0` on purpose. The load is one transaction and a retry is harmless, but a job that quietly succeeds on its third attempt hides the two failures, and the two failures are the information.

Read the execution log before continuing. It prints a line per table, and the numbers are the ones `apps/api/test-db/load.test.ts` asserts. This is the output of the rehearsal below, copied rather than composed:

```
  schema                 applied 1
  source                      8
  extent                      1
  artefact_envelope           4
  pit                       895
  pipe                      893
  road                      220
  street_label              163
  derived_shape             394
  trace_link                734
  trace_reason                4
  flood_area                180
  flood_area_coverage        30
```

A second execution prints `schema  already current` and the same table counts: the migrations are skipped once recorded and the load is a truncate-and-insert.

Then the service:

```bash
gcloud run deploy drainlens-api --image=australia-southeast1-docker.pkg.dev/fit5120-504507/drainlens/api:$(git rev-parse --short HEAD) --region=australia-southeast1 --project=fit5120-504507 --port=8080 --memory=512Mi --max-instances=2 --min-instances=0 --set-cloudsql-instances=fit5120-504507:australia-southeast1:drainlens-db --set-secrets=DATABASE_URL=drainlens-db-url:latest --allow-unauthenticated
```

**`--allow-unauthenticated` is the one line to be deliberate about**, and it is a different decision from the site's. The site is behind a password because the studio requires the deployed website to be. This is not the website: it is five `GET` routes over published council data, it holds no identity, it takes no body, and nothing links to it. Publishing it is what lets a mentor open `/health` in a browser, which is the point of deploying it at all.

`--max-instances=2` is the cost ceiling that goes with that decision. An open endpoint in front of a shared-core database can be asked a great many questions by somebody who is not a mentor; two instances is the most that can be asked at once.

If that trade is not wanted, deploy with `--no-allow-unauthenticated` and reach it through a proxy instead — no other step changes:

```bash
gcloud run services proxy drainlens-api --region=australia-southeast1 --project=fit5120-504507
```

### 10. Verify — and the AD1 check needs a positive control

```bash
node tools/deploy/verify-api.mjs https://drainlens-api-205559161217.australia-southeast1.run.app
```

That fetches all five routes and compares each response against the published artefact it is supposed to reproduce — **deeply**, not by shape. The frontend's guards accept a trace with keys missing and links whose reason was dropped; four such changes reached a passing test suite before a whole-response comparison caught them. A shape check here would find none of them either.

Then the log check, which is two questions and not one. **Run the verifier first**, so the window has traffic in it — a log check over an hour in which nobody visited proves nothing whichever way it comes out.

```bash
gcloud logging read httpRequest.remoteIp:* --limit=20 --freshness=1h --project=fit5120-504507
```

Expected: **nothing**. `field:*` is the existence test, and this filter is deliberately one token with no spaces and no quotes — see *PowerShell rewrites arguments* above. It is also **stronger than scoping it to the service**: it asks whether any log entry anywhere in this project, from either Cloud Run service, carries a client address.

```bash
gcloud logging read 'resource.type="cloud_run_revision"' --limit=10 --freshness=1h --project=fit5120-504507 --format="value(logName)"
```

**Zero results from the first query proves nothing on its own.** It is the same result you get from a stale freshness window, a service nobody has visited, or a filter that is quietly wrong. This one — the positive control — has to come back non-empty before the first one means what it says. On 5 September it returned `cloudaudit/system_event`, `run/varlog/system`, `run/stdout` and `cloudaudit/activity` — and **no `run.googleapis.com/requests`**, which is the entry the exclusion drops.

Do the same for the database, once:

```bash
gcloud logging read resource.type=cloudsql_database --limit=20 --freshness=1h --project=fit5120-504507
```

The instance name is not in the filter because there is one instance in this project, and adding it would put a colon inside quotes — which is the argument PowerShell destroys. **This query carries its own positive control**: `postgres.log` comes back non-empty, full of internal maintenance lines with `db=` and `user=` empty, and not one connection entry. Logging works, and connections are not in it.

---

## What must still be true afterwards

| | |
|---|---|
| **AD1** | No log entry from either service carries a client address, and the positive control shows that logging is happening at all |
| **The frontend is unchanged** | `apps/web` fetches its own files. Switching it to the API is a separate decision that needs a CORS header this server does not send, and it should not be made inside a deployment |
| **`FORBIDDEN_WIRE_KEYS`** | Still nothing on the wire that names a person. Every route is a `GET` with no body; there is no path that could carry one |
| **The database is derived** | Nothing is written here that is not in the repository. If that stops being true — Epic 4's drain checks would be the first — this document is wrong and `--no-backup` is wrong with it |
| **The tag on the image** | Names the commit it was built from. Compare it against `git rev-parse --short HEAD`; do not assume it |

---

## What will probably go wrong first

| Symptom | What it is |
|---|---|
| `permission denied for schema public` in the job log | Postgres 15 removed the implicit `CREATE` grant on `public`. Connect as the `postgres` user and `GRANT ALL ON SCHEMA public TO drainlens;`, then re-run the job |
| The job succeeds, `/health` answers 404 | The service is on a revision that started before the job ran, or against a different database. `/health` refuses to report ok on an empty database on purpose — a 200 over no rows is a service that looks healthy and serves an empty map |
| `ENOENT ... /app/apps/web/public/data/map.json` | The image was flattened. `load.ts` resolves the artefacts relative to its own file and `migrate.ts` resolves the migrations the same way; the layout under `/app` in `deploy/api/Dockerfile` is load-bearing, and it breaks at run time rather than at build time |
| The build says `Building using Buildpacks` | Wrong command. This one is `gcloud builds submit --config=deploy/api/cloudbuild.yaml`; `--source=.` cannot see this Dockerfile |
| Cloud Build cannot push, or cannot write logs | Newer projects build as the compute service account, which may need `roles/artifactregistry.writer` and `roles/logging.logWriter`. The error names the missing permission; grant that one rather than a wider role |
| A connection error naming a socket path | The service or job is missing `--set-cloudsql-instances`, or the account is missing `roles/cloudsql.client`. Do not fix it by adding an authorized network — that opens the instance to the internet to solve an IAM problem |
