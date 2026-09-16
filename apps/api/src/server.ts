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
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import pg from 'pg';

import {
  NotFound,
  derivedArtefact,
  floodHistoryArtefact,
  loaded,
  mapArtefact,
  traceArtefact,
} from './queries.js';

/**
 * The origins allowed to read this from a browser.
 *
 * The site and the API are two Cloud Run services and therefore two origins,
 * so without this the browser refuses every response before the page sees it.
 *
 * **A list rather than `*`.** Everything here is published council data and
 * no request carries a credential, so `*` would leak nothing — but an
 * allow-list is a statement about who this is for, and it is the kind of
 * setting that is easy to widen later and impossible to narrow once something
 * unknown depends on it. `ALLOWED_ORIGINS` overrides it for a preview
 * deployment without a code change.
 */
export const DEFAULT_ORIGINS = [
  'https://drainlens-205559161217.australia-southeast1.run.app',
  /*
    The dev service, and the reason this list is a thing that can be wrong
    without anybody being told.

    Iteration 2 moved to three URLs on 11 September -- root, archive, dev --
    and this list was not one of the things that moved. The dev service is a
    different origin, so the browser dropped every response from this API
    before the page saw it, and `fetchTogether` did exactly what it is for:
    fell back to the copy in the container. The footer said so in plain words
    -- *the wider council map needs the database, which is not answering* --
    and it was right, from where the browser was standing.

    What it looked like was the council extent not working. What it was is
    this array. **A CORS list is not a feature flag, but it behaves like one**:
    the whole Iteration 2 URL had been serving one square kilometre for a day.
  */
  'https://drainlens-dev-205559161217.australia-southeast1.run.app',
  // `npm run dev`, from .claude/launch.json.
  'http://localhost:5183',
  'http://127.0.0.1:5183',
];

/*
  `drainlens-iteration1` is deliberately **not** here.

  It serves the frozen Iteration 1 bundle, which asks for `/api/map/kensington`
  -- an extent this database no longer holds. Letting it through would give it
  a 404 and the same fallback it gets now, by accident instead of on purpose.
  An archive should not depend on a live database that has moved on; it holds
  its own copies and that is what makes it an archive.
*/

export function allowedOrigins(env: string | undefined = process.env.ALLOWED_ORIGINS): string[] {
  if (env === undefined || env.trim() === '') return DEFAULT_ORIGINS;
  return env
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '');
}

/**
 * How long a browser may reuse an answer.
 *
 * These artefacts change when the migration job runs and at no other time, so
 * a visitor who opens the map twice in five minutes should not fetch 316 KB
 * twice. It matches the `/data` tier in `deploy/nginx.conf`, so moving a
 * screen from the bundled copy to the API does not change how often it is
 * re-fetched.
 */
export const ARTEFACT_CACHE = 'public, max-age=300';

/**
 * How long a process keeps an artefact it has already rebuilt from rows.
 *
 * The user test of 15 September timed the map and derived routes at 2.5 and
 * 3.0 seconds on the deployed site. Part of that is a cold instance, which no
 * code here can help; the rest is rebuilding 21,113 pits and 17,242 pipes from
 * rows on every request, for an answer that only changes when the migration
 * job runs. Ten minutes bounds how stale a warm instance can be after a load,
 * and an instance rarely lives that long between visits anyway.
 */
export const REBUILT_FOR_MS = 10 * 60 * 1000;

export interface Memo {
  /** The value for `key`, building it at most once per `ttlMs` however many ask at once. */
  get<T>(key: string, build: () => Promise<T>): Promise<T>;
}

/**
 * A small in-process memo for rebuilt artefacts.
 *
 * Concurrent requests for the same key share one build, so the first visitors
 * after a cold start do not each rebuild the council map. A build that fails
 * is forgotten at once: a 404 for an extent that has not been loaded yet, or a
 * database that was briefly unreachable, must not be remembered as the answer.
 */
export function createMemo(ttlMs: number, now: () => number = Date.now): Memo {
  const held = new Map<string, { readonly at: number; readonly value: Promise<unknown> }>();
  return {
    get<T>(key: string, build: () => Promise<T>): Promise<T> {
      const found = held.get(key);
      if (found !== undefined && now() - found.at < ttlMs) return found.value as Promise<T>;
      const value = build();
      held.set(key, { at: now(), value });
      value.catch(() => {
        if (held.get(key)?.value === value) held.delete(key);
      });
      return value;
    },
  };
}

export function createApp(pool: pg.Pool, memo: Memo = createMemo(REBUILT_FOR_MS)): Hono {
  const app = new Hono();

  app.use('*', cors({ origin: allowedOrigins() }));

  /*
    Defence headers on every answer, including the errors (penetration test
    P02, P08, and the plan's "equivalent headers on the backend").

    The API only ever returns JSON to `fetch`, so its policy is the tightest
    there is: nothing may load, nothing may frame it. HSTS without
    includeSubDomains, for the same reason as the site's: the run.app host is
    not this project's to make promises for. Cross-origin resource policy is
    left at the middleware's default of off, because the site reads these
    responses from another origin by design and CORS already decides who may.
  */
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      strictTransportSecurity: 'max-age=31536000',
      xFrameOptions: 'DENY',
      referrerPolicy: 'no-referrer',
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: 'same-origin',
    }),
  );

  /*
    Compression, which stopped being optional when the extent became a council.

    The map went out as **6,942,917 bytes with no `Content-Encoding` at all**:
    p50 749.6 ms, p95 1556.5 ms, against 55 ms for the derived layers. At
    Kensington's 316 KB nobody had to think about it. The same JSON gzips to
    1.22 MB, and the site's own nginx has been compressing its bundled copies
    all along -- so the *offline* fallback was the fast path and the API was
    the slow one, which is the wrong way round for the source of truth.

    Measured through this middleware, against a local database holding the
    council extent — bytes on the wire, not `fetch`'s decoded length, which
    reported 6,942,917 for a body that had travelled as 1.2 MB:

    ==============================  ===========  ===========  =====
    route                           uncompressed  gzip         ratio
    ==============================  ===========  ===========  =====
    /api/map/city-of-melbourne        6,942,917    1,220,733   5.7x
    /api/trace/city-of-melbourne        709,800      126,950   5.6x
    /api/derived/city-of-melbourne      166,503       41,781   4.0x
    /api/flood-history                    5,526        1,770   3.1x
    ==============================  ===========  ===========  =====

    The level is the default, gzip 6. On this laptop level 1 gives 1.46 MB for
    65 ms and level 9 gives 1.19 MB for 278 ms; 6 is 1.22 MB for 161 ms, and
    the last 30 KB is not worth 117 ms of a one-CPU instance.

    `Vary: Accept-Encoding` matters here and the middleware sets it: these
    responses carry `Cache-Control: public`, and without the header a shared
    cache is free to hand a gzipped body to a client that never asked for one.

    **`/api/*` rather than `*`, because the middleware's own threshold does not
    protect `/health`.** It skips compression below 1 KB by reading
    `Content-Length` — and `c.json()` does not set one, so the check is
    skipped rather than passed, and the 39-byte health body came back gzipped
    into 59. Measured, after this comment had already claimed the opposite;
    scoping the middleware is the fix that does not depend on a header nothing
    here sends. `/health` is `no-store` and is polled, which is the one route
    where a wrapper costs something every time and saves nothing ever.
  */
  app.use('/api/*', compress());

  /**
   * Answer, or say plainly what is missing.
   *
   * A 500 with a stack trace tells an attacker about the schema and tells a
   * teammate nothing they can act on. A `NotFound` becomes a 404 with the
   * sentence the query threw; anything else is logged server-side and becomes
   * a bare 500, because the details of an unexpected failure are ours.
   */
  const withClient = async (work: (client: pg.PoolClient) => Promise<unknown>) => {
    const client = await pool.connect();
    try {
      return await work(client);
    } finally {
      client.release();
    }
  };

  const answer = async (
    c: Context,
    work: (client: pg.PoolClient) => Promise<unknown>,
    cache: string = ARTEFACT_CACHE,
    // Rebuilt artefacts are memoised by route; `/health` passes none, because
    // a health check answered from memory is a health check of the memory.
    key?: string,
  ) => {
    try {
      const body = (await (key === undefined
        ? withClient(work)
        : memo.get(key, () => withClient(work)))) as Record<string, unknown>;
      // Only on an answer. A 404 cached for five minutes is a missing extent
      // that stays missing after the migration job has put it there.
      c.header('Cache-Control', cache);
      return c.json(body);
    } catch (error) {
      if (error instanceof NotFound) return c.json({ error: error.message }, 404);
      console.error(error);
      return c.json({ error: 'the request could not be answered' }, 500);
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
      // Never cached. A health check answered from a cache is a health check
      // of the cache.
    }, 'no-store'),
  );

  app.get('/api/map/:extent', (c) =>
    answer(c, (client) => mapArtefact(client, c.req.param('extent')), ARTEFACT_CACHE, `map/${c.req.param('extent')}`),
  );

  app.get('/api/derived/:extent', (c) =>
    answer(c, (client) => derivedArtefact(client, c.req.param('extent')), ARTEFACT_CACHE, `derived/${c.req.param('extent')}`),
  );

  app.get('/api/trace/:extent', (c) =>
    answer(c, (client) => traceArtefact(client, c.req.param('extent')), ARTEFACT_CACHE, `trace/${c.req.param('extent')}`),
  );

  app.get('/api/flood-history', (c) =>
    answer(c, (client) => floodHistoryArtefact(client), ARTEFACT_CACHE, 'flood-history'),
  );

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
