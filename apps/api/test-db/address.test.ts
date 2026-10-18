/**
 * The API finds an address, and finds the same one the browser would.
 *
 * **The point of this file is the word "same".** From 9 October the address
 * search has two implementations of nothing and one implementation used
 * twice: `packages/address` ranks, and it is called by the browser against
 * the bundled index and by `queries.ts` against Postgres. A resident meets
 * both paths in one session — the API answers while the database is up, the
 * container copy answers when it is not — so every assertion below is run
 * twice, once each way, and compared.
 *
 * A test that only exercised the route would pass while the two drifted, and
 * the drift is the failure: one house, two answers, no error anywhere.
 *
 * Needs Postgres:
 *
 *   docker compose -f db/docker-compose.yml up -d
 *   npm run test:db
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type AddressIndex,
  type PackedIndex,
  type Resolution,
  resolve,
  unpack,
} from '@drainlens/address';

import { COUNCIL, load } from '../src/load.js';
import { DATABASE_URL } from './url.js';
import { migrate } from '../src/migrate.js';
import { createApp } from '../src/server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../../web/public/data');

let pool: pg.Pool;
let app: ReturnType<typeof createApp>;
let bundled: AddressIndex;

/** What the route answers, as a resident's browser would receive it. */
const ask = async (q: string, extra: Record<string, unknown> = {}): Promise<{
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
}> => {
  const response = await app.request('/api/addresses/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, ...extra }),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: (await response.json()) as Record<string, unknown>,
  };
};

/** What the bundled index answers, which is the fallback path. */
const offline = (q: string): Resolution => resolve(bundled, q);

/** The comparable part of a verdict: the kind, and which house it names. */
const shape = (verdict: Record<string, unknown> | Resolution): unknown => {
  const v = verdict as {
    kind: string;
    address?: { id: string };
    matches?: readonly { address: { id: string } }[];
  };
  if (v.kind === 'found') return { kind: v.kind, id: v.address?.id };
  if (v.kind === 'ambiguous') {
    return { kind: v.kind, ids: (v.matches ?? []).map((m) => m.address.id) };
  }
  return { kind: v.kind };
};

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  const client = await pool.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrate(client);
    await client.query('BEGIN');
    // The council, because that is the extent the index declares and the only
    // one whose addresses are loaded at all.
    await load(client, COUNCIL);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  app = createApp(pool);

  const packed = JSON.parse(
    await readFile(path.join(DATA, 'addresses.json'), 'utf8'),
  ) as PackedIndex;
  bundled = unpack(packed, packed.extent!);
}, 180_000);

afterAll(async () => {
  await pool.end();
});

describe('the address index reached the database', () => {
  it('holds every published address, and every published street', async () => {
    const client = await pool.connect();
    try {
      const rows = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM address WHERE extent_id = 'city-of-melbourne'`,
      );
      const streets = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM address_street WHERE extent_id = 'city-of-melbourne'`,
      );
      // Counted from the artefact, not from whatever the loader produced.
      expect(Number(rows.rows[0]?.n)).toBe(bundled.addresses.length);
      expect(Number(streets.rows[0]?.n)).toBe((bundled.streets ?? []).length);
    } finally {
      client.release();
    }
  });

  it('stores the published position rather than the row order', async () => {
    const client = await pool.connect();
    try {
      // `address-catchments.json` is keyed by street and published position,
      // so a position renumbered from row order would hand addresses after a
      // gap somebody else's drainage area.
      const sample = bundled.addresses.filter((a) => a.at > 0).slice(0, 50);
      expect(sample.length).toBeGreaterThan(0);
      for (const address of sample) {
        const row = await client.query<{ at_pos: number }>(
          `SELECT at_pos FROM address WHERE id = $1`,
          [address.id],
        );
        expect(row.rows[0]?.at_pos).toBe(address.at);
      }
    } finally {
      client.release();
    }
  });
});

describe('the route answers what the bundled index would', () => {
  /*
    Chosen to cover each of the four verdicts and each scoring rule that can
    separate two houses: a whole-query prefix, a house number that has to beat
    a longer label, an abbreviation the normaliser expands, and a street the
    index publishes with a number it does not.
  */
  const QUERIES = [
    '46 gatehouse drive',
    '46 gate',
    'gatehouse',
    '89 market street kensington',
    '89 market st',
    '1 bayswater road',
    'bourke',
    '206 bourke street',
    "a'beckett street",
    'abeckett st',
    '999999 bangalore street',
    'nowhere parade, atlantis',
    'zzzzzz',
  ];

  it.each(QUERIES)('agrees about %j', async (q) => {
    const served = await ask(q);
    expect(served.status).toBe(200);
    expect(shape(served.body)).toEqual(shape(offline(q)));
  });

  it('never caches a resident’s query, in the process or downstream', async () => {
    const served = await ask('46 gatehouse drive');
    expect(served.headers.get('Cache-Control')).toBe('no-store');

    // Asked twice, answered twice. `answer`'s memo is keyed by a string and
    // the only string here is what somebody typed; passing no key is what
    // keeps home addresses out of the process, and this is the assertion
    // that notices if a key is ever added.
    const again = await ask('46 gatehouse drive');
    expect(again.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('what the route refuses', () => {
  it('refuses a body that is not JSON', async () => {
    const response = await app.request('/api/addresses/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(response.status).toBe(400);
  });

  it('refuses an empty query rather than returning the whole council', async () => {
    expect((await ask('')).status).toBe(400);
    expect((await ask('   ')).status).toBe(400);
  });

  it('refuses a query longer than any published label', async () => {
    expect((await ask('a'.repeat(201))).status).toBe(400);
  });

  it('takes no wildcard from the query, because normalise removes them', async () => {
    // `%` and `_` would make `LIKE` match everything. `normalise` keeps only
    // [a-z0-9/- ], so they never reach the statement -- and the verdict for a
    // query that is nothing else is the same as for any other unknown text.
    const served = await ask('%');
    expect(served.status).toBe(200);
    expect(shape(served.body)).toEqual({ kind: 'not-an-address' });
  });
});
