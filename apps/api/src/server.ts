/**
 * The read-only interface over the database.
 *
 * **Every route is a `GET`, takes no body, and names no person.** An extent id
 * and an area name are the only things any of them accept, and both are
 * published. There is no `POST` here and none is planned for this iteration:
 * Epic 4's drain checks would be the first write path and they need a decision
 * about moderation before they need an endpoint.
 *
 * **AD1 does not weaken because a server exists.** This is a second Cloud Run
 * service, and Cloud Run writes request logs carrying `httpRequest.remoteIp`
 * by default — the exclusion applied to the site's service does not cover this
 * one, and it has to be applied and verified with a positive control before
 * this is deployed. That is in `docs/DATABASE-DESIGN.md` under "What must
 * still be true afterwards", and it is a correctness requirement rather than
 * an operational one.
 *
 * The responses are the artefact shapes the frontend already has. Nothing on
 * the browser side changes, which means a rollback is a URL and not a release.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { type Context, Hono } from 'hono';
import pg from 'pg';

import {
  NotFound,
  derivedArtefact,
  floodHistoryArtefact,
  loaded,
  mapArtefact,
  traceArtefact,
} from './queries.js';

export function createApp(pool: pg.Pool): Hono {
  const app = new Hono();

  /**
   * Answer, or say plainly what is missing.
   *
   * A 500 with a stack trace tells an attacker about the schema and tells a
   * teammate nothing they can act on. A `NotFound` becomes a 404 with the
   * sentence the query threw; anything else is logged server-side and becomes
   * a bare 500, because the details of an unexpected failure are ours.
   */
  const answer = async (
    c: Context,
    work: (client: pg.PoolClient) => Promise<unknown>,
  ) => {
    const client = await pool.connect();
    try {
      return c.json((await work(client)) as Record<string, unknown>);
    } catch (error) {
      if (error instanceof NotFound) return c.json({ error: error.message }, 404);
      console.error(error);
      return c.json({ error: 'the request could not be answered' }, 500);
    } finally {
      client.release();
    }
  };

  // Whether the process is up *and* the data is in, which are different
  // questions. A container that starts against an empty database is not
  // healthy; it is a 200 that serves an empty map.
  app.get('/health', (c) =>
    answer(c, async (client) => {
      const counts = await loaded(client);
      if (counts.pits === 0) throw new NotFound('the database holds no drainage network');
      return { status: 'ok', ...counts };
    }),
  );

  app.get('/api/map/:extent', (c) =>
    answer(c, (client) => mapArtefact(client, c.req.param('extent'))),
  );

  app.get('/api/derived/:extent', (c) =>
    answer(c, (client) => derivedArtefact(client, c.req.param('extent'))),
  );

  app.get('/api/trace/:extent', (c) =>
    answer(c, (client) => traceArtefact(client, c.req.param('extent'))),
  );

  app.get('/api/flood-history', (c) => answer(c, (client) => floodHistoryArtefact(client)));

  return app;
}

/** Start it, against `DATABASE_URL`, on `PORT`. */
export function start(): void {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // The same rule the site's entrypoint follows: refuse to start rather than
    // start wrong. A server answering 500 to everything looks like a bug in
    // the database rather than a missing variable.
    throw new Error('DATABASE_URL is not set, so this would serve nothing but errors');
  }

  const pool = new pg.Pool({ connectionString, max: 5 });
  const port = Number(process.env.PORT ?? 8080);
  serve({ fetch: createApp(pool).fetch, port });
  process.stdout.write(`listening on ${String(port)}\n`);
}

/**
 * Start only when this file *is* the program.
 *
 * Compared as a path rather than by extension. The first version tested
 * `endsWith('server.ts')`, which is true of the source and false of
 * `dist/server.js` -- the file that actually ships. The server built, started,
 * exited zero and listened on nothing, and every test still passed, because
 * the tests import `createApp` and never run this line. It was only visible by
 * running the build.
 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start();
}
