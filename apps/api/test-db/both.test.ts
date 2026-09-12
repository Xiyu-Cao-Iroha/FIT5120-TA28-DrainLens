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

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrate } from '../src/migrate.js';
import { BUNDLED, COUNCIL, load } from '../src/load.js';
import { derivedArtefact, mapArtefact, traceArtefact } from '../src/queries.js';
import { DATABASE_URL } from './url.js';

/*
 * **These tests used to skip, and no longer can.**
 *
 * The council artefacts were built into `/data`, which is git-ignored, so this
 * file guarded itself with `describe.skipIf(!built)` -- after a first version
 * that only *said* it skipped and turned the database job red on a pull
 * request that changed nothing about the database.
 *
 * They are committed now, under `apps/api/data/city-of-melbourne`, because
 * `/data` is dockerignored as well and the migration job cannot load a file
 * that is not in the image. That removes the reason for the guard: the
 * artefacts are in every clone, so a missing one is a broken checkout and
 * should fail here loudly rather than take seven assertions about the council
 * quietly out of the run.
 */

let client: pg.Client;

beforeAll(async () => {
  client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(client);
  await client.query('BEGIN');
  await load(client, COUNCIL);
  await client.query('COMMIT');
}, 300_000);

afterAll(async () => {
  await client?.end();
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

  it('leaves a pipe the council identified with nothing without a ref, not with ref 0', async () => {
    /*
     * 85 of the council's 17,242 pipes carry no reference number -- geometry
     * the council recorded and identified with nothing. Migration 003 made
     * `ref` nullable for them; the API kept mapping it as `Number(r.ref)`, and
     * `Number(null)` is 0. So the 85 came back carrying **reference number
     * zero**: not missing, not flagged, indistinguishable from an asset id.
     *
     * Every shape check passed. It was found by `verify-api.mjs` comparing the
     * whole response against the artefact, which is the only reason that
     * comparison is deep.
     *
     * **The council records two pipes whose reference number really is 0**,
     * which is what made the invented value dangerous rather than merely
     * wrong: it is a value this dataset uses, so 85 fabrications would have
     * sat indistinguishably beside 2 records. That is why the assertion is a
     * count and not `none of them is zero` -- the bug returning reads as 87.
     */
    const artefact = await mapArtefact(client, 'city-of-melbourne');
    const pipes = artefact.layers.pipe as { ref?: number }[];
    expect(pipes.filter((p) => p.ref === undefined).length).toBe(85);
    expect(pipes.filter((p) => p.ref === 0).length).toBe(2);
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

  it('holds the derived layers in the council frame, not the pilot one', async () => {
    /*
     * Coordinates are metres from the extent's own south-west corner, so the
     * same ground has two coordinates depending on which extent you asked
     * for. Kensington's origin is the council's (1500, 6000).
     *
     * The shapes are reframed at build time -- `pipeline/reframe.py` -- so
     * this artefact is internally consistent and the browser never learns
     * that two frames exist. If this fails, every water path on the council
     * map is 1.5 km west and 6 km south of where it belongs, drawn silently
     * and looking like a map.
     */
    const derived = await derivedArtefact(client, 'city-of-melbourne');
    const first = derived.layers.channel?.[0]?.c[0];
    expect(first?.[0]).toBeGreaterThan(1500);
    expect(first?.[1]).toBeGreaterThan(6000);
    expect(derived.extent.width_m).toBe(8500);
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

  it('refuses to hold the pilot extent as well, and names it', async () => {
    /*
     * It used to refuse on `pit_pkey`, which is the primary key being right
     * and is an awful thing to read: `duplicate key value violates unique
     * constraint "pit_pkey"`, at insert 896 of 21,113, three minutes into a
     * Cloud Run job that had already applied two schema changes. The
     * constraint still stands behind this; the loader just gets there first
     * and says which extent is in the way and what the flag is called.
     */
    await client.query('BEGIN');
    await expect(load(client, BUNDLED)).rejects.toThrow(/holds city-of-melbourne/);
    await expect(load(client, BUNDLED)).rejects.toThrow(/--replace/);
    await client.query('ROLLBACK');
  });

  it('swaps one extent for the other when it is asked to, in either direction', async () => {
    /*
     * The deployment path, which is not the same as the fresh-database path.
     * A running instance already holds an extent, so changing which one it
     * serves is always this operation -- and it failed in *both* directions
     * before `--replace` existed, because the load deletes the extent it is
     * loading and leaves the one that is in the way.
     */
    await client.query('BEGIN');
    const toPilot = await load(client, BUNDLED, { replace: true });
    expect(toPilot['replaced city-of-melbourne']).toBe(1);
    expect(Number(await one('SELECT count(*)::text AS v FROM pit'))).toBe(895);

    const back = await load(client, COUNCIL, { replace: true });
    expect(back['replaced kensington']).toBe(1);
    expect(Number(await one('SELECT count(*)::text AS v FROM pit'))).toBe(21113);

    // Greater Melbourne is not a pilot extent and is never the one replaced:
    // the flood board is the same board whichever city map is loaded.
    expect(back['replaced greater-melbourne']).toBeUndefined();
    expect(
      await one("SELECT extent_id AS v FROM artefact_envelope WHERE name = 'flood-history'"),
    ).toBe('greater-melbourne');
    await client.query('ROLLBACK');
  });
});
