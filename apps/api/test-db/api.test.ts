/**
 * The API answers with artefacts the frontend already accepts.
 *
 * **This suite imports the frontend's own guards rather than a copy of them.**
 * `assertUsable`, `assertDerived`, `assertTrace` and `assertFloodHistory` are
 * the functions the browser runs before it draws anything, and they refuse an
 * artefact that cannot qualify itself — one naming no source, no reporting
 * period, or no sentence saying what a count is. Running them here is the
 * whole argument that a database can replace a static file without touching a
 * line of the client: if a query drops a field, the guard refuses it and this
 * goes red.
 *
 * A copy of the guards would prove nothing. It would drift, and the copy
 * would keep passing.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { load } from '../src/load.js';
import { createApp } from '../src/server.js';

import { assertUsable } from '../../web/src/map/artefact.js';
import { assertDerived } from '../../web/src/map/derived.js';
import { assertTrace } from '../../web/src/trace/graph.js';
import { assertFloodHistory } from '../../web/src/history/artefact.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const DATA = path.join(ROOT, 'apps/web/public/data');

const URL =
  process.env.DATABASE_URL ??
  'postgres://drainlens:drainlens-local-only@localhost:5433/drainlens';

let pool: pg.Pool;
let app: ReturnType<typeof createApp>;

const get = async (url: string): Promise<{ status: number; body: unknown }> => {
  const response = await app.request(url);
  return { status: response.status, body: await response.json() };
};

const published = async (name: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path.join(DATA, name), 'utf8')) as Record<string, unknown>;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: URL, max: 4 });
  const client = await pool.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await client.query(await readFile(path.join(ROOT, 'db/migrations/001_init.sql'), 'utf8'));
    await client.query('BEGIN');
    await load(client);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  app = createApp(pool);
}, 120_000);

afterAll(async () => {
  await pool.end();
});

describe('the frontend would accept every response', () => {
  it('serves a map artefact its own guard accepts', async () => {
    const { status, body } = await get('/api/map/kensington');
    expect(status).toBe(200);
    expect(() => {
      assertUsable(body);
    }).not.toThrow();
  });

  it('serves derived layers their own guard accepts', async () => {
    const { status, body } = await get('/api/derived/kensington');
    expect(status).toBe(200);
    expect(() => {
      assertDerived(body);
    }).not.toThrow();
  });

  it('serves a trace its own guard accepts', async () => {
    const { status, body } = await get('/api/trace/kensington');
    expect(status).toBe(200);
    expect(() => {
      assertTrace(body);
    }).not.toThrow();
  });

  it('serves a flood history its own guard accepts', async () => {
    // The strictest of the four: it refuses an artefact with no reporting
    // period, no geographic unit, or no sentence saying what a count is.
    const { status, body } = await get('/api/flood-history');
    expect(status).toBe(200);
    expect(() => {
      assertFloodHistory(body);
    }).not.toThrow();
  });
});

describe('the same answers as the published files', () => {
  it('returns every recorded feature, in the same counts', async () => {
    const { body } = await get('/api/map/kensington');
    const served = body as { layers: Record<string, unknown[]> };
    const file = (await published('map.json')) as { layers: Record<string, unknown[]> };

    for (const layer of Object.keys(file.layers)) {
      expect(served.layers[layer]?.length).toBe(file.layers[layer]?.length);
    }
  });

  it('returns a pit identical to the one in the file', async () => {
    const { body } = await get('/api/map/kensington');
    const served = (body as { layers: { pit: { asset_number: number }[] } }).layers.pit;
    const file = ((await published('map.json')) as { layers: { pit: { asset_number: number }[] } })
      .layers.pit;

    const wanted = file[0];
    expect(wanted).toBeDefined();
    expect(served.find((p) => p.asset_number === wanted?.asset_number)).toEqual(wanted);
  });

  it('omits a field the record does not hold, as the file does', async () => {
    const { body } = await get('/api/map/kensington');
    const served = (body as { layers: { pit: Record<string, unknown>[] } }).layers.pit;
    const bare = served.find((p) => !('object_type_lupvalue' in p));
    expect(bare).toBeDefined();
    expect(bare && 'object_type_lupvalue' in bare).toBe(false);
  });

  it('ranks the board exactly as the file does', async () => {
    const { body } = await get('/api/flood-history');
    const served = (body as { areas: { name: string; total: number; tied: boolean }[] }).areas;
    const file = (
      (await published('flood-history.json')) as {
        areas: { name: string; total: number; tied: boolean }[];
      }
    ).areas;

    expect(served.map((a) => [a.name, a.total, a.tied])).toEqual(
      file.map((a) => [a.name, a.total, a.tied]),
    );
  });

  it('keeps the years of each area in the order the file uses', async () => {
    const { body } = await get('/api/flood-history');
    const served = (body as { areas: { name: string; byYear: number[] }[] }).areas;
    const file = (
      (await published('flood-history.json')) as { areas: { name: string; byYear: number[] }[] }
    ).areas;

    for (const area of file) {
      expect(served.find((a) => a.name === area.name)?.byYear).toEqual(area.byYear);
    }
  });
});

/**
 * The tests that would have caught what the spot checks did not.
 *
 * The first version of this file compared layer *counts* and one pit, and
 * passed while the API was returning a trace with 680 keys instead of 895 and
 * thirty-seven links whose destination had become `null` with the reason
 * dropped. Both were shape changes the guards accept and a reader would not
 * survive: the client walks into a pit that does not exist.
 *
 * A deep comparison against the published file is the only check that has no
 * opinion about which fields matter.
 */
describe('byte for byte, against the published files', () => {
  it('rebuilds the trace exactly, empty keys and reasons included', async () => {
    const { body } = await get('/api/trace/kensington');
    const served = body as { links: unknown; terminations: unknown };
    const file = (await published('trace.json')) as { links: unknown; terminations: unknown };

    expect(served.links).toEqual(file.links);
    expect(served.terminations).toEqual(file.terminations);
  });

  it('keeps a pit with nothing leaving it as an empty array, not a missing key', async () => {
    // `traceDownstream` reads an absent key as "a pit we do not carry" and an
    // empty array as "the record says there is no pipe". They render the same
    // today and are different questions; 215 pits are in the second group.
    const { body } = await get('/api/trace/kensington');
    const links = (body as { links: Record<string, unknown[]> }).links;
    expect(Object.keys(links)).toHaveLength(895);
    expect(Object.values(links).filter((v) => v.length === 0)).toHaveLength(215);
  });

  it('gives a link a destination or a reason, never a null destination', async () => {
    // Thirty-seven pipes leave a pit and the record does not say where they
    // go. Sent as `to: null` with the reason dropped, the client stops
    // recognising the ending and walks into a pit that does not exist.
    const { body } = await get('/api/trace/kensington');
    const links = (body as { links: Record<string, { to?: string; ends?: string }[]> }).links;
    const all = Object.values(links).flat();

    expect(all.filter((l) => l.ends !== undefined)).toHaveLength(37);
    expect(all.filter((l) => l.to !== undefined)).toHaveLength(697);
    for (const link of all) {
      expect(link.to === undefined).not.toBe(link.ends === undefined);
      expect(link.to).not.toBeNull();
    }
  });

  it('rebuilds the map exactly', async () => {
    const { body } = await get('/api/map/kensington');
    const served = body as { layers: Record<string, unknown[]> };
    const file = (await published('map.json')) as { layers: Record<string, unknown[]> };

    for (const layer of Object.keys(file.layers)) {
      // Order is fixed in SQL, and the file's order is the pipeline's. Compare
      // as sets of features so a different but complete order is not a
      // failure, and a missing or altered feature is.
      const sort = (list: unknown[]) => [...list].map((f) => JSON.stringify(f)).sort();
      expect(sort(served.layers[layer] ?? [])).toEqual(sort(file.layers[layer] ?? []));
    }
  });

  it('rebuilds the derived layers exactly', async () => {
    const { body } = await get('/api/derived/kensington');
    const served = body as { layers: Record<string, unknown[]> };
    const file = (await published('derived.json')) as { layers: Record<string, unknown[]> };
    expect(served.layers).toEqual(file.layers);
  });

  it('rebuilds every area of the board exactly', async () => {
    const { body } = await get('/api/flood-history');
    const served = (body as { areas: unknown[] }).areas;
    const file = ((await published('flood-history.json')) as { areas: unknown[] }).areas;
    expect(served).toEqual(file);
  });
});

describe('what it does when it cannot answer', () => {
  it('says which extent it does not have, rather than throwing a 500', async () => {
    const { status, body } = await get('/api/map/not-an-extent');
    expect(status).toBe(404);
    expect((body as { error: string }).error).toContain('not-an-extent');
  });

  it('reports health only when the data is in, not merely when the process is up', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'ok', pits: 895, areas: 30 });
  });
});

describe('the same request twice', () => {
  it('returns byte-identical bytes, because the order is fixed in SQL', async () => {
    // An unordered query may return rows in whatever order a vacuum last left
    // them. A map whose bytes change between identical requests defeats
    // caching and makes a diff of two responses unreadable.
    const first = await app.request('/api/map/kensington');
    const second = await app.request('/api/map/kensington');
    expect(await first.text()).toBe(await second.text());
  });
});
