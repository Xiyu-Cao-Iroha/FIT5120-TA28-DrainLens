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

describe('migrating an empty database', () => {
  it('reads no ledger as "nothing applied" rather than failing', async () => {
    // The table does not exist yet. Postgres answers 42P01, which is the one
    // error that means "fresh"; anything else is a database that is merely
    // unreachable and must not be read as an invitation to start over.
    expect(await appliedVersions(client)).toEqual(new Set());
  });

  it('applies the initial migration and records it', async () => {
    expect(await migrate(client)).toEqual([1]);
    expect(await appliedVersions(client)).toEqual(new Set([1]));
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
    expect(await migrate(client)).toEqual([1]);
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
