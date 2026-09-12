/**
 * Load the published artefacts into Postgres.
 *
 * **The artefacts are the record and the database is derived from them.** The
 * design first said the pipeline would write rows alongside files; that is two
 * writers and two truths that can disagree, and the disagreement would be
 * invisible until somebody compared a map with a query. Reading the files the
 * pipeline already publishes means there is one derivation, one writer, and a
 * database that can be rebuilt from a checkout at any time.
 *
 * **It refuses rather than guesses.** Every field this reads is one the
 * artefact is contracted to carry, and a missing one throws with the path that
 * was missing. A loader that inserted NULL where it could not find a value
 * would turn "the file changed shape" into "the council recorded nothing",
 * which is the one confusion `PitDetail` exists to prevent.
 *
 * **It is a truncate-and-insert inside one transaction.** A partial load is
 * worse than no load: half a drainage network renders as a map with holes in
 * it and nothing on screen says so. If this throws, the previous rows are
 * still there.
 *
 * Usage, with the local database from `db/docker-compose.yml`:
 *
 *   DATABASE_URL=postgres://drainlens:drainlens-local-only@localhost:5433/drainlens \
 *     node --experimental-strip-types apps/api/src/load.ts
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Where the shipped artefacts live, and the extent they belong to. */
export interface Source {
  readonly dir: string;
  readonly extent: string;
}

/**
 * The container's own copy: Kensington, the extent that ships.
 *
 * A second extent is a second `load` against a different directory, not a
 * second database -- which is what the schema means by "one row per published
 * extent".
 */
export const BUNDLED: Source = {
  dir: path.resolve(HERE, '../../web/public/data'),
  extent: 'kensington',
};

/**
 * The council, committed beside the API because the image is where it is read.
 *
 * **This is the one place in the repository where a built artefact is
 * committed outside `apps/web/public/data`, and it is deliberate.** `/data` is
 * git-ignored *and* dockerignored, so an artefact built there cannot reach the
 * build context at all: the migration job would apply two migrations against a
 * Cloud SQL instance and then load Kensington into it, which is a service
 * answering confidently for a square kilometre after being told to serve a
 * council. The load has to read the file, the file has to be in the image, and
 * the image is built from this repository -- so the file is in this
 * repository.
 *
 * 7.6 MB, 1.3 MB of it as git objects. It is paid once per rebuild of the
 * council extent, which is a pipeline run nobody does casually.
 *
 * `../data` from `apps/api/src` and from `apps/api/dist` are the same
 * directory, which is the same reason the container preserves the layout for
 * `BUNDLED` and for `db/migrations`.
 */
export const COUNCIL: Source = {
  dir: path.resolve(HERE, '../data/city-of-melbourne'),
  extent: 'city-of-melbourne',
};

/** Every extent this can load, by the name it is asked for. */
export const SOURCES: Readonly<Record<string, Source>> = {
  [BUNDLED.extent]: BUNDLED,
  [COUNCIL.extent]: COUNCIL,
};

/** Greater Melbourne, which the flood board covers and no pilot extent does. */
export const FLOOD_EXTENT = 'greater-melbourne';

export class LoadError extends Error {}

/**
 * Read a field, or say which one was missing.
 *
 * The alternative — `?? null` — is how a shape change becomes a silent data
 * change three screens away.
 */
function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new LoadError(`the artefact has no ${what}`);
  return value;
}

interface Artefact {
  readonly sources?: readonly {
    readonly dataset_id: string;
    readonly title?: string;
    readonly publisher: string;
    readonly licence: string;
    readonly last_modified?: string;
  }[];
  readonly source?: {
    readonly dataset_id: string;
    readonly title?: string;
    readonly dataset?: string;
    readonly publisher: string;
    readonly licence?: string;
  };
  readonly geographySource?: Artefact['source'];
  readonly [key: string]: unknown;
}

/** How to treat a pilot extent that is already in the database. */
export interface LoadOptions {
  /**
   * Remove the other pilot extent first, instead of refusing.
   *
   * Off by default, because it deletes rows nobody asked about. It is what a
   * deployment that is changing which extent it serves wants, and it has to be
   * asked for by name.
   */
  readonly replace?: boolean;
}

export async function load(
  client: pg.ClientBase,
  from: Source = BUNDLED,
  options: LoadOptions = {},
): Promise<Record<string, number>> {
  const EXTENT = from.extent;
  const read = async (name: string): Promise<Artefact> =>
    JSON.parse(await readFile(path.join(from.dir, name), 'utf8')) as Artefact;

  const map = await read('map.json');
  const derived = await read('derived.json');
  const trace = await read('trace.json');

  /*
    The flood board is read from the bundled directory whichever extent is
    being loaded, because it is not this extent's.

    It counts SES dispatches by SA2 across Greater Melbourne; it says nothing
    about Kensington or the council in particular and is written against
    `FLOOD_EXTENT` a few lines down regardless of `from`. It was briefly copied
    into the council directory as well, and the copy was byte-identical -- two
    files that must stay equal, with nothing to notice when they stop, in a
    codebase whose argument against two writers is written at the top of this
    one.
  */
  const flood = JSON.parse(
    await readFile(path.join(BUNDLED.dir, 'flood-history.json'), 'utf8'),
  ) as Artefact;

  // The denominator, read from the same place and for the same reason: it is
  // Greater Melbourne's population, not this extent's.
  const population = JSON.parse(
    await readFile(path.join(BUNDLED.dir, 'population.json'), 'utf8'),
  ) as Artefact;

  const counted: Record<string, number> = {};
  const count = (table: string, n: number) => {
    counted[table] = n;
  };

  /*
    This extent's rows go; every other extent's stay, unless asked below.

    It used to TRUNCATE the whole schema, which was right while there was one
    extent and becomes wrong the moment there are two: loading the council
    would silently empty Kensington, and the first anyone would know is the
    container's fallback and the API disagreeing about what exists.

    `extent` cascades to every layer that references it, so one DELETE clears
    the pits, pipes, roads, labels, derived shapes and trace rows belonging to
    this extent and nothing else. The tables that are not extent-scoped --
    `source`, and the Greater Melbourne flood history -- are rewritten below
    rather than deleted here, because they are shared and the last loader to
    run should leave them correct rather than absent.
  */
  await client.query('DELETE FROM extent WHERE id = $1', [EXTENT]);

  /*
    The other pilot extent, if it is there and this load was told to take it.

    **Two published extents cannot be in one database, and the DELETE above is
    not what stops it.** That one removes the extent being *loaded*, so it
    leaves the other one exactly where it was -- and the two overlap, because
    Kensington is a square kilometre inside the council and its 895 pits are
    895 of the council's 21,113 under the same `asset_number`. The insert then
    dies on `pit_pkey`, in both directions, whichever was there first.

    That is the primary key being right. What was wrong was finding out about
    it as `duplicate key value violates unique constraint "pit_pkey"` at pit
    number 896 of a Cloud Run job, three minutes into a migration that had
    already applied two schema changes. So this asks first, and says what to do
    about it in the sentence rather than in a stack trace.

    Replacing is not the default. It deletes rows nobody named, and there is a
    future in which two pilot areas that do not overlap should both be here --
    the schema was written for it. `--replace` is for the deployment that is
    changing which extent it serves, which is a thing somebody is doing on
    purpose.
  */
  const others = await client.query<{ id: string }>(
    'SELECT id FROM extent WHERE id <> $1 AND id <> $2 ORDER BY id',
    [EXTENT, FLOOD_EXTENT],
  );
  if (others.rows.length > 0) {
    const names = others.rows.map((r) => r.id).join(', ');
    if (!options.replace) {
      throw new LoadError(
        `the database holds ${names}, which overlaps ${EXTENT}: the same assets would be ` +
          `stored twice in two coordinate frames, and the insert would fail on pit_pkey. ` +
          `Load with --replace to remove ${names} first.`,
      );
    }
    await client.query('DELETE FROM extent WHERE id <> $1 AND id <> $2', [EXTENT, FLOOD_EXTENT]);
    count(`replaced ${names}`, others.rows.length);
  }

  await client.query(`
    TRUNCATE flood_area_coverage, flood_area, flood_incident, sa1_region,
             population RESTART IDENTITY;
  `);
  await client.query('DELETE FROM artefact_envelope WHERE extent_id = $1', [FLOOD_EXTENT]);

  // --- Provenance -----------------------------------------------------------

  // Title is nullable on purpose. The map artefact names a dataset id, a
  // publisher and a licence per layer and carries no human title; the flood
  // history carries one. Writing the id in to make the column look filled
  // would be inventing a title.
  const sources = new Map<string, [string, string | null, string, string, string | null]>();
  for (const s of map.sources ?? []) {
    sources.set(s.dataset_id, [
      s.dataset_id,
      s.title ?? null,
      s.publisher,
      s.licence,
      // `last_modified` is when the publisher last changed the dataset. It is
      // not when we fetched it, and the column is named for what this is.
      (s as unknown as { last_modified?: string }).last_modified ?? null,
    ]);
  }
  for (const s of [flood.source, flood.geographySource, trace.source, population.source]) {
    if (!s) continue;
    sources.set(s.dataset_id, [
      s.dataset_id,
      s.title ?? s.dataset ?? null,
      s.publisher,
      s.licence ?? 'Not stated in the artefact',
      null,
    ]);
  }
  // The derived layers are calculated by this product from sources already
  // named above, so they carry no dataset of their own — but the rows still
  // need something to point at, and inventing a publisher would be worse.
  sources.set('drainlens-derived', [
    'drainlens-derived',
    'Calculated by DrainLens from a filtered photogrammetric surface',
    'DrainLens',
    'Not published',
    null,
  ]);

  for (const row of sources.values()) {
    await client.query(
      /*
        Upserted, because `source` is shared across extents.

        Two extents cite the same four datasets -- they are the same council
        publishing the same exports -- so the second loader to run meets rows
        the first one wrote. It used to be a plain INSERT after a TRUNCATE of
        the whole schema; with the truncate gone that is a duplicate-key error
        on the second extent, which is a load that fails loudly rather than one
        that corrupts anything, but a failed load is still a load nobody got.
      */
      `INSERT INTO source (dataset_id, title, publisher, licence, last_modified)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (dataset_id) DO UPDATE SET
         title = EXCLUDED.title,
         publisher = EXCLUDED.publisher,
         licence = EXCLUDED.licence,
         last_modified = EXCLUDED.last_modified`,
      row,
    );
  }
  count('source', sources.size);

  // --- Extent ---------------------------------------------------------------

  const extent = need(
    map.extent as { min_e: number; min_n: number; width_m: number; height_m: number } | undefined,
    'an extent',
  );
  await client.query(
    `INSERT INTO extent (id, min_e, min_n, width_m, height_m, crs)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      EXTENT,
      extent.min_e,
      extent.min_n,
      extent.width_m,
      extent.height_m,
      need(map.crs as string | undefined, 'a CRS'),
    ],
  );
  count('extent', 1);

  /*
    Greater Melbourne, which the flood board covers and no pilot extent does.

    **The loader inserts what the loader references.** Migration 002 creates
    this row too, because it has to exist before the envelope's `extent_id` can
    be made NOT NULL on a database that already has data in it. But a migration
    inserting a row the loader depends on is a dependency nobody can see from
    here, and it broke exactly that way: `api.test.ts` drops the schema and
    re-migrates, and any path that reaches `load` without 002's INSERT surviving
    fails on a foreign key three hundred lines later.

    Its bounds are the published ASGS extremes of the Greater Melbourne GCCSA
    in degrees, not local metres, and the CRS column says which -- the flood
    board never asks for a position, so nothing reads them; they are here so
    the row is not four zeroes pretending to be an extent.
  */
  await client.query(
    `INSERT INTO extent (id, min_e, min_n, width_m, height_m, crs)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [FLOOD_EXTENT, 144.5938, -38.5033, 1.1097, 1.103, 'EPSG:4326'],
  );

  // --- The envelope each artefact carries around its data --------------------

  // Everything but the bulk arrays. The guards in the frontend check these
  // fields, and the sentences in them are authored in the pipeline -- retyping
  // them here would be a second copy that drifts without anybody noticing.
  const envelopes: [string, Artefact, readonly string[]][] = [
    ['map', map, ['layers']],
    ['derived', derived, ['layers']],
    ['trace', trace, ['links']],
    ['flood-history', flood, ['areas']],
  ];
  for (const [name, artefact, bulk] of envelopes) {
    const envelope = Object.fromEntries(
      Object.entries(artefact).filter(([key]) => !bulk.includes(key)),
    );
    await client.query(
      `INSERT INTO artefact_envelope (name, extent_id, version, envelope) VALUES ($1, $2, $3, $4)`,
      [
        name,
        // The flood history is Greater Melbourne, which is an extent row of
        // its own since migration 002 -- it was NULL here, which is honest and
        // cannot be part of a primary key.
        name === 'flood-history' ? FLOOD_EXTENT : EXTENT,
        need(artefact.version as number | undefined, `a version on ${name}`),
        JSON.stringify(envelope),
      ],
    );
  }
  count('artefact_envelope', envelopes.length);

  // --- The recorded network -------------------------------------------------

  const layers = need(
    map.layers as Record<string, readonly Record<string, unknown>[]> | undefined,
    'map layers',
  );
  const datasetFor = (layer: string): string =>
    need(
      (map.sources ?? []).find((s) => (s as unknown as { layer?: string }).layer === layer)
        ?.dataset_id,
      `a source for the ${layer} layer`,
    );

  const pits = layers.pit ?? [];
  for (const pit of pits) {
    const c = pit.c as [number, number];
    await client.query(
      `INSERT INTO pit (asset_number, extent_id, e_m, n_m, description, object_type, dataset_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        need(pit.asset_number as number | undefined, 'an asset number on a pit'),
        EXTENT,
        c[0],
        c[1],
        // Absent in the artefact means the council record is empty. It stays
        // NULL here, and the API omits the key again on the way out.
        pit.asset_description ?? null,
        pit.object_type_lupvalue ?? null,
        datasetFor('pit'),
      ],
    );
  }
  count('pit', pits.length);

  const pipes = layers.pipe ?? [];
  for (const pipe of pipes) {
    await client.query(
      `INSERT INTO pipe (ref, extent_id, upstr_pit, dnstr_pit, diameter_mm, material, path, dataset_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        /*
          Nullable since migration 003, and not because the guard was
          inconvenient. 85 of the council's 17,242 pipes carry no reference
          number, no upstream pit and no downstream pit -- geometry the council
          recorded and identified with nothing. `need` was right to refuse
          them against a schema that made `ref` the primary key; the schema was
          what had to change.
        */
        (pipe.ref as number | undefined) ?? null,
        EXTENT,
        pipe.upstr_pit ?? null,
        pipe.dnstr_pit ?? null,
        pipe.diameter ?? null,
        pipe.material ?? null,
        JSON.stringify(pipe.c),
        datasetFor('pipe'),
      ],
    );
  }
  count('pipe', pipes.length);

  const roads = layers.road ?? [];
  for (const road of roads) {
    await client.query(
      `INSERT INTO road (extent_id, str_type, seg_descr, rings, dataset_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [EXTENT, road.str_type ?? null, road.seg_descr ?? null, JSON.stringify(road.c), datasetFor('road')],
    );
  }
  count('road', roads.length);

  const labels = layers['street-name'] ?? [];
  for (const label of labels) {
    await client.query(
      `INSERT INTO street_label (extent_id, name, maplabel, path, dataset_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        EXTENT,
        need(label.name as string | undefined, 'a name on a street label'),
        // The display form. The map draws `maplabel ?? name`, so losing this
        // puts every street in capitals.
        label.maplabel ?? null,
        JSON.stringify(label.c),
        datasetFor('street-name'),
      ],
    );
  }
  count('street_label', labels.length);

  // --- Derived layers -------------------------------------------------------

  const derivedLayers = need(
    derived.layers as Record<string, readonly { g: string; c: unknown }[]> | undefined,
    'derived layers',
  );
  let shapes = 0;
  for (const [layer, list] of Object.entries(derivedLayers)) {
    for (const shape of list) {
      await client.query(
        `INSERT INTO derived_shape (extent_id, layer, geometry, coordinates)
         VALUES ($1, $2, $3, $4)`,
        [EXTENT, layer, shape.g, JSON.stringify(shape.c)],
      );
      shapes += 1;
    }
  }
  count('derived_shape', shapes);

  // --- Trace ----------------------------------------------------------------

  // `links` is a map from a pit to the pipes leaving it, not a list of edges.
  const links = need(
    trace.links as
      | Record<string, readonly { pipe: string; to?: string; ends?: string }[]>
      | undefined,
    'links on the trace artefact',
  );
  let edges = 0;
  for (const [from, outgoing] of Object.entries(links)) {
    for (const [position, edge] of outgoing.entries()) {
      // A link names the pit it reaches, or the reason the record does not.
      // Never both, never neither -- the schema has a CHECK for it, because
      // the first version stored `to` as NULL and dropped `ends`, which made
      // thirty-seven pipes look like they went nowhere named rather than
      // stopping with a reason.
      if ((edge.to === undefined) === (edge.ends === undefined)) {
        throw new LoadError(
          `link ${from} -> ${edge.pipe} has ${edge.to === undefined ? 'neither' : 'both'} a destination and a reason`,
        );
      }
      await client.query(
        `INSERT INTO trace_link (extent_id, from_pit, via_pipe, to_pit, ends, position)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [EXTENT, from, edge.pipe, edge.to ?? null, edge.ends ?? null, position],
      );
      edges += 1;
    }
  }
  count('trace_link', edges);

  // The artefact keys every pit, including the 215 with nothing leaving them,
  // and that set is exactly the pits in this extent -- checked, not assumed.
  // Rebuilding the map is a left join from `pit`, so no table is needed here.
  if (Object.keys(links).length !== pits.length) {
    throw new LoadError(
      `the trace keys ${String(Object.keys(links).length)} pits and the map has ${String(pits.length)}`,
    );
  }

  // `terminations` is the vocabulary of reasons and their sentences, and
  // `counts` is how many pits fall into each. Neither says which pit ends for
  // which reason -- that depends on where a walk started, and is worked out
  // when a path is followed.
  const reasons = need(
    trace.terminations as Record<string, string> | undefined,
    'termination reasons on the trace artefact',
  );
  const occurrences = (trace.counts ?? {}) as Record<string, number>;
  for (const [reason, sentence] of Object.entries(reasons)) {
    await client.query(
      `INSERT INTO trace_reason (extent_id, reason, sentence, occurrences) VALUES ($1, $2, $3, $4)`,
      [EXTENT, reason, sentence, occurrences[reason] ?? null],
    );
  }
  count('trace_reason', Object.keys(reasons).length);

  // --- Flood history, at the grain the artefact publishes --------------------

  const scope = need(
    (flood.geography as { scope?: string } | undefined)?.scope,
    'a geographic scope on the flood history',
  );
  const years = need(
    (flood.reportingPeriod as { years?: readonly string[] } | undefined)?.years,
    'a reporting period on the flood history',
  );
  const incidentType = need(flood.incidentType as string | undefined, 'an incident type');
  const areas = need(
    flood.areas as readonly Record<string, unknown>[] | undefined,
    'areas on the flood history',
  );

  let areaYears = 0;
  for (const area of areas) {
    const name = need(area.name as string | undefined, 'a name on a flood area');
    const byYear = need(area.byYear as readonly number[] | undefined, `byYear for ${name}`);
    if (byYear.length !== years.length) {
      throw new LoadError(
        `${name} has ${String(byYear.length)} yearly counts for ${String(years.length)} years`,
      );
    }

    for (const [index, year] of years.entries()) {
      await client.query(
        `INSERT INTO flood_area (extent_scope, area_name, financial_year, incident_type, count)
         VALUES ($1, $2, $3, $4, $5)`,
        [scope, name, year, incidentType, byYear[index]],
      );
      areaYears += 1;
    }

    await client.query(
      `INSERT INTO flood_area_coverage (extent_scope, area_name, regions, suppressed_regions, complete)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        scope,
        name,
        need(area.regions as number | undefined, `a region count for ${name}`),
        need(area.suppressedRegions as number | undefined, `a suppressed count for ${name}`),
        need(area.complete as boolean | undefined, `a completeness flag for ${name}`),
      ],
    );
  }
  count('flood_area', areaYears);
  count('flood_area_coverage', areas.length);

  // --- The Severity Score's denominator -------------------------------------

  /*
    One row per area per year, which is what `population` was shaped for.

    The table has been declared and empty since the first migration, and its
    comment asked whoever filled it to choose the grain deliberately rather
    than inventing one. The grain is SA2: the score is computed from the
    published rollups, so `flood_incident` stays empty and its own comment
    stays true.

    **A year each, rather than one denominator repeated.** The headline score
    divides by the mid-period figure, but the per-year view divides each year's
    activity by that year's population -- and six numerators over one
    denominator is the numerator again with a constant applied, drawn as though
    it were something else.
  */
  const asAt = need(
    population.asAt as readonly string[] | undefined,
    'the dates on the population artefact',
  );
  const datasetId = need(
    (population.source as { dataset_id?: string } | undefined)?.dataset_id,
    'a source on the population artefact',
  );
  const populationAreas = need(
    population.areas as readonly Record<string, unknown>[] | undefined,
    'areas on the population artefact',
  );

  let populationRows = 0;
  for (const area of populationAreas) {
    const code = need(area.code as string | undefined, 'a code on a population area');
    const persons = need(area.persons as readonly number[] | undefined, `persons for ${code}`);
    if (persons.length !== asAt.length) {
      throw new LoadError(
        `${code} has ${String(persons.length)} figures for ${String(asAt.length)} dates`,
      );
    }
    for (const [index, date] of asAt.entries()) {
      await client.query(
        `INSERT INTO population (area_code, area_level, as_at, persons, dataset_id)
         VALUES ($1, 'SA2', $2, $3, $4)`,
        [code, date, persons[index], datasetId],
      );
      populationRows += 1;
    }
  }
  count('population', populationRows);

  return counted;
}

/** Run it, in one transaction, against `DATABASE_URL`. */
export async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new LoadError('DATABASE_URL is not set');

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    const counted = await load(client);
    await client.query('COMMIT');
    for (const [table, n] of Object.entries(counted)) {
      process.stdout.write(`  ${table.padEnd(22)} ${String(n).padStart(6)}\n`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main();
}
