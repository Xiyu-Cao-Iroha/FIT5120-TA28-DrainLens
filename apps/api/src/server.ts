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
 * The Cloud Run services whose pages may read this API from a browser.
 *
 * `drainlens-iteration1` is deliberately **not** here. It serves the frozen
 * Iteration 1 bundle, which asks for `/api/map/kensington` -- an extent this
 * database no longer holds. Letting it through would give it a 404 and the
 * same fallback it gets now, by accident instead of on purpose. An archive
 * should not depend on a live database that has moved on; it holds its own
 * copies and that is what makes it an archive.
 */
export const ALLOWED_SERVICES = ['drainlens', 'drainlens-dev', 'drainlens-iteration2'] as const;

/**
 * The hash Cloud Run puts in this project's newer URLs.
 *
 * One value for the whole project and region -- all five services share it --
 * so it is a constant rather than something to look up per service.
 */
const RUN_HASH = '6et5y2lpgq-ts';

/**
 * One service, as both the URLs Cloud Run answers on.
 *
 * **A service has two origins and the list kept carrying one.** Cloud Run
 * used to publish `<service>-<project-number>.<region>.run.app` and now
 * publishes `<service>-<hash>.a.run.app`; both resolve, `gcloud run services
 * describe` reports the second, and a browser's `Origin` is whichever one the
 * reader typed. A list holding only the first allows exactly the readers who
 * followed an old link.
 */
const originsFor = (service: string): string[] => [
  `https://${service}-205559161217.australia-southeast1.run.app`,
  `https://${service}-${RUN_HASH}.a.run.app`,
];

/**
 * The origins allowed to read this from a browser.
 *
 * The site and the API are two Cloud Run services and therefore two origins,
 * so without this the browser refuses every response before the page sees it.
 *
 * **A list rather than `*`.** Everything here is published council data and
 * no request carries a credential, so `*` would leak nothing -- but an
 * allow-list is a statement about who this is for, and it is the kind of
 * setting that is easy to widen later and impossible to narrow once something
 * unknown depends on it. `ALLOWED_ORIGINS` adds to it for a preview
 * deployment without a code change -- it adds rather than replaces, for the
 * reason `allowedOrigins` gives.
 *
 * **This list has now been wrong three times, in the same way each time**, and
 * it is generated rather than written out for that reason:
 *
 * - 11 September. Iteration 2 moved to three URLs and the list did not move
 *   with them. The dev origin's every response was dropped and the site fell
 *   back to the square kilometre in its own container. It said so honestly --
 *   *the wider council map needs the database, which is not answering* -- and
 *   the sentence was true from where the browser stood.
 * - 28 September. The Iteration 2 archive was deployed at the freeze and the
 *   same omission dropped its every response, with the same symptom.
 * - 8 October. Cloud Run's URL format changed under all five services. The
 *   list still held the old form, so **the live root, the dev service and the
 *   archive were all serving one square kilometre** to anybody who used the
 *   URL the console and `gcloud` report. Found by opening the dev site in a
 *   browser and reading the footer.
 *
 * What each looked like was the council extent being broken. What each was is
 * this array. **A CORS list is not a feature flag, but it behaves like one**,
 * so the shape of it is now the fix: name a service and it gets both of its
 * origins, because the failure every time was one of them missing.
 */
export const DEFAULT_ORIGINS = [
  ...ALLOWED_SERVICES.flatMap(originsFor),
  // `npm run dev`, from .claude/launch.json.
  'http://localhost:5183',
  'http://127.0.0.1:5183',
];

/**
 * The default list, plus whatever `ALLOWED_ORIGINS` names.
 *
 * **It adds; it does not replace.** Replacing is what it used to do, and on
 * 8 October that undid a fix without anybody being told: the code had just
 * been changed to carry both of Cloud Run's URL forms for every service, the
 * image was deployed at the right commit, and the API went on refusing the
 * new ones -- because an `ALLOWED_ORIGINS` set at some earlier deploy still
 * listed the five old ones and silently won. The image was right and the
 * behaviour was a year-old environment variable.
 *
 * Adding is also what the variable is for. Its purpose is a preview
 * deployment without a code change, and a preview wants its own origin **as
 * well as** the services that already exist, not instead of them. Nothing is
 * lost by widening it: the only thing replacing bought was the ability to
 * take an origin away from a running service without a deploy, which is not
 * something this project has ever done and is one `gcloud run deploy` away
 * if it ever needs to.
 *
 * Duplicates are dropped, so naming an origin the defaults already carry is
 * harmless rather than a repeated header.
 */
export function allowedOrigins(env: string | undefined = process.env.ALLOWED_ORIGINS): string[] {
  const extra =
    env === undefined || env.trim() === ''
      ? []
      : env
          .split(',')
          .map((o) => o.trim())
          .filter((o) => o !== '');
  return [...new Set([...DEFAULT_ORIGINS, ...extra])];
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
