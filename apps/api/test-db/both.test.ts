/**
 * Which extent the database holds, and why it is exactly one.
 *
 * **The two published extents overlap.** Kensington is a square kilometre
 * inside the City of Melbourne, so its 895 pits are 895 of the council's
 * 21,113 — the same physical assets, with the same `asset_number`, which is a
 * global primary key. Loading both raises `duplicate key value violates unique
 * constraint "pit_pkey"`, and the constraint is right: a pit is one asset, and
 * the two extents would store it twice in two different coordinate frames.
 *
 * The schema's "a second pilot area is more rows rather than a second
 * database" still holds. It assumed two *pilot areas*, which do not overlap;
 * a containing extent is a different relationship and the primary key is what
 * says so.
 *
 * **Nothing needs them both, which is why this is a finding rather than a
 * problem.** The database holds `city-of-melbourne`; the container ships
 * `kensington`. When the API answers, the map is the council; when the
 * instance is stopped — the normal state between demos — the map falls back to
 * the square kilometre in the container and the footer says where it came
 * from. Neither copy ever needs the other's extent.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrate } from '../src/migrate.js';
import { BUNDLED, load } from '../src/load.js';
import { mapArtefact, traceArtefact } from '../src/queries.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * The council extent, built into the pipeline's working directory.
 *
 * Not committed: 6.7 MB of map and 693 KB of trace against a repository that
 * commits its artefacts so the frontend runs from a clone. `data/` is ignored
 * for exactly this, and these tests skip when it is not there.
 */
const COUNCIL = {
  dir: path.resolve(HERE, '../../../data/map/council'),
  extent: 'city-of-melbourne',
};

let client: pg.Client;

beforeAll(async () => {
  client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(client);
  await client.query('BEGIN');
  await load(client, COUNCIL);
  await client.query('COMMIT');
}, 300_000);

afterAll(async () => {
  await client.end();
});

const one = async (sql: string, args: unknown[] = []): Promise<string> =>
  (await client.query<{ v: string }>(sql, args)).rows[0]?.v ?? '0';

describe('the council extent in the database', () => {
  it('holds every pit and pipe the council publishes', async () => {
    expect(Number(await one('SELECT count(*)::text AS v FROM pit'))).toBe(21113);
    expect(Number(await one('SELECT count(*)::text AS v FROM pipe'))).toBe(17242);
    expect(Number(await one('SELECT count(*)::text AS v FROM road'))).toBe(4177);
    expect(Number(await one('SELECT count(*)::text AS v FROM street_label'))).toBe(2775);
  });

  it('answers for the extent it was asked about', async () => {
    const artefact = await mapArtefact(client, 'city-of-melbourne');
    expect(artefact.layers.pit.length).toBe(21113);
    expect(artefact.extent.width_m).toBe(8500);
    expect(artefact.extent.height_m).toBe(9000);
  });

  it('has an envelope of its own, keyed by extent', async () => {
    // Migration 002. Keyed on the name alone, one extent's prose would answer
    // for another's rows -- a wrong answer with the right shape.
    expect(
      Number(
        await one(
          "SELECT count(*)::text AS v FROM artefact_envelope WHERE name = 'map' AND extent_id = $1",
          ['city-of-melbourne'],
        ),
      ),
    ).toBe(1);
  });

  it('gives the flood board an extent of its own rather than a NULL', async () => {
    expect(
      await one("SELECT extent_id AS v FROM artefact_envelope WHERE name = 'flood-history'"),
    ).toBe('greater-melbourne');
  });

  it('never leaves the mapped area, which the pilot extent could not manage', async () => {
    // 7 edges left the Kensington square: the council recorded where they go
    // and we clipped it off. At council scale nothing is clipped, so every
    // ending is the record stopping -- the ambiguity that made the offline
    // council-wide resolution necessary is structurally gone.
    const trace = await traceArtefact(client, 'city-of-melbourne');
    expect(Object.keys(trace.links).length).toBe(21113);
    expect(trace.counts['leaves-mapped-area'] ?? 0).toBe(0);
  });

  it('contains the pilot extent, which is why only one of them is loaded', async () => {
    /*
     * The containment, asserted rather than asserted-about. Kensington's pits
     * are a subset of these by `asset_number`, so the two extents cannot both
     * be in the database: the primary key refuses to store one asset twice in
     * two coordinate frames, and it is right to.
     *
     * 1144882 is the pit the guide teaches on. If this ever fails, the two
     * extents have stopped overlapping and the reason this file gives for
     * loading one has stopped being true.
     */
    expect(
      Number(await one('SELECT count(*)::text AS v FROM pit WHERE asset_number = 1144882')),
    ).toBe(1);
  });

  it('refuses to hold the pilot extent as well', async () => {
    // Loudly, on a primary key, rather than by silently storing a second copy
    // of every shared pit at different coordinates.
    await client.query('BEGIN');
    await expect(load(client, BUNDLED)).rejects.toThrow(/pit_pkey|duplicate key/);
    await client.query('ROLLBACK');
  });
});
