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
const DATA = path.resolve(HERE, '../../web/public/data');

/** The extent every row in these artefacts belongs to. */
const EXTENT = 'kensington';

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

const read = async (name: string): Promise<Artefact> =>
  JSON.parse(await readFile(path.join(DATA, name), 'utf8')) as Artefact;

export async function load(client: pg.ClientBase): Promise<Record<string, number>> {
  const map = await read('map.json');
  const derived = await read('derived.json');
  const trace = await read('trace.json');
  const flood = await read('flood-history.json');

  const counted: Record<string, number> = {};
  const count = (table: string, n: number) => {
    counted[table] = n;
  };

  // Order matters: everything references `source`, and `extent` is referenced
  // by every layer. Deleting runs the other way for the same reason.
  await client.query(`
    TRUNCATE flood_area_coverage, flood_area, flood_incident, sa1_region,
             trace_reason, trace_link, derived_shape, street_label,
             road, pipe, pit, extent, population, source RESTART IDENTITY;
  `);

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
  for (const s of [flood.source, flood.geographySource, trace.source]) {
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
      `INSERT INTO source (dataset_id, title, publisher, licence, last_modified)
       VALUES ($1, $2, $3, $4, $5)`,
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
        need(pipe.ref as number | undefined, 'a ref on a pipe'),
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
      `INSERT INTO street_label (extent_id, name, path, dataset_id) VALUES ($1, $2, $3, $4)`,
      [
        EXTENT,
        need(label.name as string | undefined, 'a name on a street label'),
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
    trace.links as Record<string, readonly { pipe: string; to: string }[]> | undefined,
    'links on the trace artefact',
  );
  let edges = 0;
  for (const [from, outgoing] of Object.entries(links)) {
    for (const edge of outgoing) {
      await client.query(
        `INSERT INTO trace_link (extent_id, from_pit, to_pit, via_pipe) VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [EXTENT, from, edge.to, edge.pipe],
      );
      edges += 1;
    }
  }
  count('trace_link', edges);

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
