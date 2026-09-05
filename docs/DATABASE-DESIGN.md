# The database, and what it is allowed to hold

DrainLens · TA28 · **proposed and built, 5 September 2026**

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

## Built and verified, 5 September

The schema and the loader exist and were run. Against Postgres 16:

| Table | Rows | Matches |
|---|---:|---|
| `pit` · `pipe` · `road` · `street_label` | 895 · 893 · 220 · 163 | `map.json` exactly |
| `derived_shape` | 394 | 38 channels + 310 low points + 46 unavailable |
| `trace_link` · `trace_reason` | 734 · 4 | `trace.json` exactly |
| `flood_area` · `flood_area_coverage` | 180 · 30 | thirty areas over six years |
| `flood_incident` · `population` | 0 · 0 | empty on purpose, see above |

**Two design decisions stopped being assertions and became measurements.**
Sixty-nine of the 893 pipes name a downstream pit that is not in this extent —
a foreign key on `dnstr_pit` would have rejected sixty-nine rows the council
record actually contains. And twenty-two of the 895 pits have no recorded
object type, which is the nullable column doing the work AC 1.1.7.f needs.

The board rebuilds from rows: Bacchus Marsh 209, Croydon 196, Eltham 179,
Boronia - The Basin 160 (incomplete), Dandenong 133 (incomplete) — **and the
query finds the Dandenong/Gisborne tie at 133** rather than silently ordering
one above the other.

Twelve integration tests assert all of it, behind `npm run test:db` with its
own CI job and a Postgres service container. They are not in the five-second
suite, because tests that need a container do not fail without one — they
refuse to start, and nobody could then test anything.

---

## Schema

**`db/migrations/001_init.sql` is the schema. This section is not a copy of
it** — a second copy drifts, and the one in a design document drifts silently.
Read the migration; it carries a comment per decision.

### Three things the draft got wrong, found by running it

The first draft of this section was written from the artefacts as I understood
them. Loading the real files broke it three times, and each break was the
schema claiming something the data does not say.

**`source.title NOT NULL`.** The map artefact names a dataset id, a publisher
and a licence per layer and carries **no human title**. The load failed on the
first row. Writing the id into the column to fill it would have invented a
title; the column is nullable now.

**`retrieved date`.** The artefacts record `last_modified` — when the
*publisher* last changed the dataset. That is not when we fetched it. A column
named for one fact holding the other is a lie that survives every future
reader, so the column is `last_modified`.

**`trace_termination (pit, reason)`.** This was fiction. The artefact does not
say which pit ends for which reason: it publishes the four reasons, the
sentence shown for each, and how many pits fall into each. Which reason applies
to a given pit depends on where the walk started and is worked out when a path
is followed. It is `trace_reason` — a vocabulary — now.

The third is the one worth remembering. It would have loaded without error
against a plausible-looking artefact, and produced a table that answered
questions confidently and wrongly.

### Four things the deep comparison caught that the guards did not

The API's first version passed `assertUsable`, `assertDerived`, `assertTrace`
and `assertFloodHistory`, and passed spot checks on layer counts and one pit.
It was still wrong in four ways, all found by comparing a whole response with
the file it replaces.

**Thirty-seven links lost their reason.** 697 of the 734 name the pit a pipe
reaches; the other 37 name the pipe and a reason the destination is unknown —
the record has the pipe and not its end. Stored as `to_pit NULL` with `ends`
dropped, they came back as `{ pipe, to: null }`. `traceDownstream` tests
`link.to === undefined`, which `null` is not, **so the client would have walked
into a pit that does not exist** instead of stopping and saying why. There is a
CHECK constraint on it now: a link has a destination or a reason, never both
and never neither.

**Two hundred and fifteen pits lost their key.** The artefact carries an empty
array for a pit with nothing leaving it, and `traceDownstream` documents the
difference: an absent key is *a pit we do not carry*, an empty array is *the
record says there is no pipe*. They render alike today and are different
questions. Rebuilding is a left join from `pit` now.

**Every street lost its display name.** The artefact carries `name`
(`SMITHFIELD  ROAD`) and `maplabel` (`Smithfield  Road`), and `draw.ts` reads
`maplabel ?? name`. The column did not exist, so all 163 streets would have
been drawn in capitals.

**Twenty-two pits had their links reordered**, because the query sorted by pipe
id and the artefact uses the pipeline's order. `traceDownstream` walks them in
the order it is given, so which path a resident is shown first would have
depended on an id. `trace_link.position` keeps it.

> **The lesson is about the tests, not the schema.** Guards check that an
> artefact can qualify itself; they do not check that it says the same thing as
> the one it replaces. Counts and spot checks miss a dropped field on every row.
> Only a comparison with no opinion about which fields matter finds these, and
> it found four.

### Two decisions that became measurements

**No foreign key on `pipe.dnstr_pit`.** Sixty-nine of the 893 pipes name a
downstream pit that is not in this extent. A constraint would have rejected
sixty-nine rows the council record actually contains — the database editing the
record rather than storing it. It is also the same fact a resident already sees
on the map, as a path that stops because the record stops.

**`pit.object_type` nullable.** Twenty-two of the 895 pits have none. NULL is
"the council record has no value here", which `PitDetail` renders as *Not
recorded*; an empty string would print as a value.

## What the API serves

Built, running, and answering on every route. `apps/api`, Hono on Node, with
`pg` and a pool of five.


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

**Changed on 5 September, while building it.** This section first said the
pipeline would gain a `--to-database` flag and write rows alongside files. That
is two writers and two truths that can disagree, and the disagreement would be
invisible until somebody compared a map with a query.

The loader reads the **published artefacts** instead. There is one derivation,
one writer, one language touching the connection, and a database that can be
rebuilt from a checkout at any time.

```
pipeline  ──derives──>  JSON artefacts  ──loader──>  Postgres
                        (the record)
```

`apps/api/src/load.ts`, in one transaction, truncating before it inserts so a
re-run replaces rather than doubles. A load that throws leaves the previous
rows in place rather than a half-populated map, and every field it reads is one
the artefact is contracted to carry — a missing one throws with its name rather
than becoming a NULL that reads as "the council recorded nothing".

**What this costs is the SA1 grain.** The published artefact holds the
thirty-area rollup; the 13,339 regions underneath it are computed by the
pipeline and discarded at build time. Loading them means the pipeline emitting
the full grain as a file, which means re-fetching the VICSES and ABS sources,
which are downloaded per run and not kept in the repository. Until then
`flood_incident` is declared and empty — as is `population` — because inventing
SA1 codes to make a table look loaded would be fabricating the identifiers this
product refuses to fabricate.

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
