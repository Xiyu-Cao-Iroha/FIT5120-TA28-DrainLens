# The database, and what it is allowed to hold

DrainLens · TA28 · **proposed 5 September 2026, not yet built**

Iteration 1 shipped with no application server and no database, and that was a
recorded decision. It is being reversed for Iteration 2. This document says
what the database holds, what it deliberately does not, and what has to stay
true afterwards.

---

## What was recorded, and why it was too broad

The technical-choices table in
[PRE-DEPLOYMENT-WALKTHROUGH.md](./PRE-DEPLOYMENT-WALKTHROUGH.md) reads:

| Choice | Instead of | Why |
|---|---|---|
| Static artefacts | REST API + database | AD1. No endpoint that receives an address can leak one. |

**The reason supports a narrower conclusion than the one it was used for.** It
argues against one thing: an endpoint that receives a resident's address. The
drainage network, the terrain and the flood history are published council and
State Emergency Service data. They contain nothing about anybody. Storing them
in a database breaks no promise this product has made.

AD1 itself says the product has **no accounts and no identity**. It does not
say "no database", and the two are not the same claim. The table conflated
them, and this document is the correction.

---

## The line that does not move

**The address index stays in the browser.** Not because AD1's wording forbids
otherwise, but because two things already visible to a resident say so:

- The guided tour, step one: *"The search runs in your browser — nothing about
  the address is sent anywhere."*
- This repository's interface contract: *"the cheapest way to keep a promise
  about data is to never receive it."*

An address search that calls a server sends every keystroke of somebody's home
address to that server, and a log line is storage. Moving `addresses.json`
behind an API would make both of those sentences false, and they would have to
be removed from the interface in the same change — which is a decision about
what the product promises, not a decision about where data lives. It is not
part of this one.

At 4,089 addresses and 66 KB over the wire there is no technical reason to move
it either.

---

## What goes in, and what stays a file

| | Where | Why |
|---|---|---|
| Flood incidents, **all 13,339 SA1 regions** | **Database** | The artefact publishes 30 areas. The pipeline computes 281 in scope and reads 13,339 regions, and throws the rest away at build time. |
| ABS population by area | **Database** | New. The join it enables is the whole reason the mentor asked for this. |
| Drainage pits, pipes, roads, street labels | **Database** | Tabular and modest: 895 + 893 + 220 + 163 rows. Geometry stored as coordinate arrays, exactly as the artefact holds it. |
| Downstream links and their termination reasons | **Database** | 893 edges with a reason each — a graph, which is a thing databases are good at. |
| Surface-water paths, low points, unavailable areas | **Database** | 38 + 310 + 46 shapes. |
| The address index | **File** | See above. |
| `scene/*.bin` — elevation, flow, depressions, coverage | **File** | A 1000 × 1000 `Int16Array` is not a table. Storing a million cells as rows to serve them back as a typed array is a worse version of a file, and the client reads them into `ArrayBuffer`s anyway. |

**The pipeline stays the source of truth for derivation.** Nothing is computed
in the database. `drainlens_pipeline` still does the D8 routing, the SMRF
filtering, the ABS join and the suppression handling; what changes is that it
writes rows as well as files. A backend that tried to *derive* these per
request would be rebuilding a pipeline that already exists and can be checked
offline — which is what the interface contract says, and it is still right.

---

## Schema

Written against the artefacts as they exist today, not invented. Coordinates
are metres east and north of the extent's south-west corner, to a decimetre —
the same frame every artefact uses, so nothing is reprojected on the way in.

```sql
-- Reference data: one row per published extent, so a second pilot area does
-- not mean a second database.
CREATE TABLE extent (
  id            text PRIMARY KEY,          -- 'kensington'
  min_e         double precision NOT NULL,
  min_n         double precision NOT NULL,
  width_m       double precision NOT NULL,
  height_m      double precision NOT NULL,
  crs           text NOT NULL,             -- 'EPSG:28355'
  built_at      timestamptz NOT NULL
);

-- Every dataset the product redistributes, so provenance is a row and not a
-- string repeated in five artefacts. AC 1.1.4.g and the CC BY attribution both
-- read from here.
CREATE TABLE source (
  dataset_id    text PRIMARY KEY,
  title         text NOT NULL,
  publisher     text NOT NULL,
  licence       text NOT NULL,
  retrieved     date NOT NULL
);

CREATE TABLE pit (
  asset_number  bigint PRIMARY KEY,
  extent_id     text NOT NULL REFERENCES extent(id),
  e_m           double precision NOT NULL,
  n_m           double precision NOT NULL,
  description   text,                      -- NULL means the record is empty,
  object_type   text,                      -- not that we chose not to show it
  dataset_id    text NOT NULL REFERENCES source(dataset_id)
);

CREATE TABLE pipe (
  ref           bigint PRIMARY KEY,
  extent_id     text NOT NULL REFERENCES extent(id),
  upstr_pit     bigint REFERENCES pit(asset_number),
  dnstr_pit     bigint REFERENCES pit(asset_number),
  diameter_mm   integer,
  material      text,
  path          double precision[][] NOT NULL,
  dataset_id    text NOT NULL REFERENCES source(dataset_id)
);

-- Why a path ends, kept beside the edge rather than derived in the client.
CREATE TABLE trace_termination (
  pit           bigint PRIMARY KEY REFERENCES pit(asset_number),
  reason        text NOT NULL              -- 'no-recorded-connection', ...
);

-- Flood incidents, at the grain the source publishes them: one row per SA1
-- region per financial year. 13,339 regions x 6 years, with NULL where the
-- publisher withheld the count for privacy.
CREATE TABLE flood_incident (
  sa1_code_2011 char(7) NOT NULL,
  financial_year char(7) NOT NULL,         -- '2009-10'
  incident_type text NOT NULL,             -- 'Flood'
  count         integer,                   -- NULL = withheld, not zero
  PRIMARY KEY (sa1_code_2011, financial_year, incident_type)
);

CREATE TABLE sa1_region (
  sa1_code_2011 char(7) PRIMARY KEY,
  sa2_name      text NOT NULL,             -- the name the board ranks by
  greater_capital text NOT NULL            -- 'Greater Melbourne'
);

-- New, and the reason this database exists. Grain to be fixed once the
-- dataset is verified -- see Open questions.
CREATE TABLE population (
  area_code     text NOT NULL,
  area_level    text NOT NULL,             -- 'SA1' or 'SA2'
  as_at         date NOT NULL,
  persons       integer NOT NULL,
  dataset_id    text NOT NULL REFERENCES source(dataset_id),
  PRIMARY KEY (area_code, area_level, as_at)
);
```

**`count` is nullable and that is load-bearing.** The publisher withholds
counts for privacy in 144 of the 13,339 regions. A withheld count is not zero,
and a schema that stored it as zero would produce a ranking that is quietly
wrong. Nine of the thirty published areas contain one, which is why the board
shows those totals as floors with a `+`.

---

## What the API serves

`apps/api` — Node, TypeScript, Hono, on Cloud Run beside the existing service.

| Method | Path | Answers |
|---|---|---|
| `GET` | `/api/flood-history` | The board as it exists today, assembled from rows |
| `GET` | `/api/flood-history/areas?per=capita` | Ranked by incidents per thousand residents — the mentor's fifth point |
| `GET` | `/api/flood-history/areas/:name` | One area, all six years, with its region count and how many were withheld |
| `GET` | `/api/map/:extent` | Pits, pipes, roads, labels — the shape `map.json` has now |
| `GET` | `/api/derived/:extent` | Channels, low points, unavailable areas |
| `GET` | `/api/trace/:extent` | Links and terminations |

**Every one of them is a `GET` with no body and no identifier for a person.**
There is no `POST` in Iteration 2's scope: Epic 4's drain checks would add one,
and that needs its own decision about moderation and abuse before a write path
exists at all.

**The response shapes do not change.** The frontend's `assertUsable`,
`assertDerived`, `assertTrace` and `assertFloodHistory` stay exactly as they
are, and keep refusing an artefact that cannot qualify itself. What changes is
where the bytes come from. That is deliberate: it means the whole frontend test
suite is still testing the thing that ships, and a rollback is a URL change.

---

## Getting the data in

`drainlens_pipeline` gains a `--to-database` flag alongside its file output. It
does not replace the file output — the two run from one pass so they cannot
disagree, and the files remain the artefact of record for a build.

```
pipeline  ──derives──>  rows  ──>  Cloud SQL
              │
              └────────>  JSON artefacts (unchanged)
```

Loading is `COPY` from the pipeline's own output, inside one transaction, into
a schema created by a numbered migration. A load that fails leaves the previous
rows in place rather than a half-populated table.

---

## What must still be true afterwards

1. **No endpoint receives an address.** Every route above takes an extent id or
   an area name, both of which are public.
2. **The Cloud Run request-log exclusion stays applied to the API service too.**
   It is per-service. A new service is a new place for `httpRequest.remoteIp`
   to be written, and the exclusion has to be verified against the API the same
   way it was verified against the site — with a positive control, because an
   empty log during a quiet hour proves nothing.
3. **Cloud SQL logs are a second place IPs can appear.** `log_connections` and
   `log_disconnections` record client addresses. They are off by default on
   Cloud SQL; that has to be checked rather than assumed, and checked again
   after any flag change.
4. **The database is reachable only from the API**, over the Cloud SQL
   connector with no public IP. A student project with an open Postgres port is
   found by scanners in hours.
5. **`FORBIDDEN_WIRE_KEYS` still applies.** Adding a server does not make
   `photo`, `image` or `imageData` acceptable on the wire; AD10 keeps the
   classification on the device.

---

## Cost, honestly

Cloud SQL is not free and has no free tier. The smallest shared-core instance
(`db-f1-micro`, 10 GB HDD) is roughly **AUD 12–15 a month** in
`australia-southeast1`, billed whether or not anything queries it. Firestore
would have been near-zero at this traffic, and was not chosen.

**That is a real trade and it should be said out loud in the handover**: the
relational engine was chosen because the flood-and-population question is a
join, and a join is what the alternative could not do without duplicating the
answer at write time. Stopping the instance between demonstrations is the
mitigation, and it costs a cold start.

---

## Open questions, in the order they block work

1. **The population dataset does not exist in this repository yet**, and
   nothing can be joined until it does. It has to be located, downloaded,
   reconciled against its own documentation and matched to ABS ASGS 2011 — the
   same discipline the VICSES file went through in
   [FLOOD-HISTORY-DATA.md](./FLOOD-HISTORY-DATA.md), where the file reconciled
   exactly (13,339 rows, 144 suppressed) and the join was 13,339 of 13,339.
   **This is the critical path, and it is data work rather than database work.**

2. **Which population, and at which grain.** The flood counts are per SA1 for
   2011 boundaries. ABS publishes Estimated Resident Population by SA2 annually
   and Census counts by SA1 for a census year. A count spanning 2009–2015
   divided by a population from one year is a rate with a date on it, and the
   board will have to say which year and why.

3. **Per capita of what.** Incidents per resident is not obviously the right
   normalisation for flooding — dwellings, or area, may be better, and the
   mentor's phrasing (*"受灾人口/flood"*) is closer to *people affected*, which
   is a quantity neither dataset holds. This needs to be settled before it is
   built, because a ranking normalised the wrong way is more confidently wrong
   than the unnormalised one it replaces.

4. **Whether Iteration 2 has a budget** for a continuously running instance.

---

## What this replaces

When this is built, the technical-choices table's *"Static artefacts | REST API
+ database"* row is rewritten rather than deleted: the reasoning was sound for
Iteration 1 and the row should say what changed and when, not pretend the
decision was always this one.
