/**
 * The migration runner, against a real Postgres.
 *
 * The two things worth proving are that it brings an empty database all the
 * way up, and that running it a second time changes nothing. The second is the
 * one that matters in deployment: the job that migrates is run by hand, by
 * somebody who cannot be sure whether it was already run this afternoon, and
 * the only safe answer to that uncertainty is a command they can repeat.
 *
 * Needs Postgres:
 *
 *   docker compose -f db/docker-compose.yml up -d
 *   npm run test:db
 */

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appliedVersions, migrate } from '../src/migrate.js';
import { load } from '../src/load.js';

const URL =
  process.env.DATABASE_URL ??
  'postgres://drainlens:drainlens-local-only@localhost:5433/drainlens';

let client: pg.Client;

const one = async (sql: string): Promise<string> => {
  const result = await client.query<{ v: string }>(sql);
  return result.rows[0]?.v ?? '';
};

beforeEach(async () => {
  client = new pg.Client({ connectionString: URL });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}, 60_000);

afterEach(async () => {
  // Ended per test, not per file: `beforeEach` opens a new one, and a file
  // that only closed the last would leave four sockets open until the process
  // exits -- harmless here, and the habit that exhausts a connection limit.
  await client.end();
});

/** Every migration in `db/migrations`, by version, in order. */
const ON_DISK: number[] = readdirSync(
  path.resolve(fileURLToPath(import.meta.url), '../../../../db/migrations'),
)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => Number(name.split('_')[0]))
  .sort((a, b) => a - b);

describe('migrating an empty database', () => {
  it('reads no ledger as "nothing applied" rather than failing', async () => {
    // The table does not exist yet. Postgres answers 42P01, which is the one
    // error that means "fresh"; anything else is a database that is merely
    // unreachable and must not be read as an invitation to start over.
    expect(await appliedVersions(client)).toEqual(new Set());
  });

  it('applies every migration on disk and records each one', async () => {
    /*
      Read from the directory rather than written down here. A test that names
      the versions has to be edited by whoever adds the next migration, and the
      edit that keeps it green is the same edit whether or not the migration
      actually ran -- so it stops being evidence. This fails if a file is added
      and not applied, which is the thing worth catching.
    */
    expect(await migrate(client)).toEqual(ON_DISK);
    expect(await appliedVersions(client)).toEqual(new Set(ON_DISK));
  });

  it('leaves a schema the loader can fill', async () => {
    await migrate(client);
    await client.query('BEGIN');
    await load(client);
    await client.query('COMMIT');

    expect(Number(await one('SELECT count(*)::text AS v FROM pit'))).toBe(895);
    expect(Number(await one('SELECT count(*)::text AS v FROM flood_area'))).toBe(180);
  });
});

describe('migrating a database that is already current', () => {
  it('applies nothing the second time', async () => {
    expect(await migrate(client)).toEqual(ON_DISK);
    expect(await migrate(client)).toEqual([]);
  });

  it('does not touch the rows already in', async () => {
    await migrate(client);
    await client.query('BEGIN');
    await load(client);
    await client.query('COMMIT');

    const before = await one('SELECT max(applied_at)::text AS v FROM schema_migration');
    expect(await migrate(client)).toEqual([]);

    expect(Number(await one('SELECT count(*)::text AS v FROM pit'))).toBe(895);
    expect(await one('SELECT max(applied_at)::text AS v FROM schema_migration')).toBe(before);
  });
});
