/**
 * The two settings that decide whether a browser may read this at all.
 *
 * Everything else in the API is exercised against a real Postgres in
 * `test-db/`. These two are pure and are the ones that fail in a way nobody
 * sees while testing: a wrong origin list produces a working API that the site
 * cannot read, and the browser reports it as a network error with no body.
 */

import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ALLOWED_SERVICES,
  ARTEFACT_CACHE,
  DEFAULT_ORIGINS,
  REBUILT_FOR_MS,
  allowedOrigins,
  createApp,
  createMemo,
} from './server.js';

describe('who may read this from a browser', () => {
  it('allows the deployed site and the local dev server by default', () => {
    expect(allowedOrigins(undefined)).toEqual(DEFAULT_ORIGINS);
    expect(DEFAULT_ORIGINS).toContain(
      'https://drainlens-205559161217.australia-southeast1.run.app',
    );
    expect(DEFAULT_ORIGINS).toContain('http://localhost:5183');
  });

  it('allows the dev service, which is where Iteration 2 is looked at', () => {
    /*
     * **This was missing for a day and nothing failed.** Iteration 2 moved to
     * three URLs on 11 September and this list did not move with them, so the
     * browser dropped every API response on the dev origin and the site fell
     * back to the square kilometre in its own container. It reported that
     * honestly — *the wider council map needs the database, which is not
     * answering* — and the sentence was true from where the browser stood.
     *
     * It read as the council extent being broken. It was an array.
     */
    expect(DEFAULT_ORIGINS).toContain(
      'https://drainlens-dev-205559161217.australia-southeast1.run.app',
    );
  });

  it('leaves the Iteration 1 archive out, so it cannot depend on a database that moved on', () => {
    // It serves the frozen bundle, which asks for an extent this database no
    // longer holds. Its own copies are the point.
    expect(DEFAULT_ORIGINS.join(' ')).not.toContain('drainlens-iteration1');
  });

  it('carries the Iteration 2 archive, which asks for the extent this database holds', () => {
    /*
     * The same omission as the dev origin, found the same way and a fortnight
     * later: deployed at the freeze on 28 September, every API response
     * dropped, the archive URL serving one square kilometre. The team chose
     * an archive that shows the whole council over one that cannot be
     * affected by the database (29 September).
     */
    expect(DEFAULT_ORIGINS).toContain(
      'https://drainlens-iteration2-205559161217.australia-southeast1.run.app',
    );
  });

  it('carries both of the URLs Cloud Run answers on, for every service it allows', () => {
    /*
     * The third time, 8 October, and the one this test exists for.
     *
     * Cloud Run publishes a service at two origins -- the old
     * `<service>-<project-number>.<region>.run.app` and the newer
     * `<service>-<hash>.a.run.app`. Both resolve; `gcloud run services
     * describe` and the console report the second; a browser's `Origin` is
     * whichever one the reader followed. The list held only the first, so the
     * live root, the dev service and the Iteration 2 archive were *all*
     * serving one square kilometre of Kensington to anyone who used the URL
     * the console gives them, and saying so honestly in the footer.
     *
     * Checking the count per service rather than the strings is the point: a
     * service added with one of its two origins fails here, which is the
     * shape all three outages had.
     */
    // The two forms, written out rather than generated, so this says what a
    // complete entry looks like instead of restating the code that makes one.
    const bothFormsOf = (service: string) => [
      `https://${service}-205559161217.australia-southeast1.run.app`,
      `https://${service}-6et5y2lpgq-ts.a.run.app`,
    ];
    for (const service of ALLOWED_SERVICES) {
      for (const origin of bothFormsOf(service)) {
        expect(DEFAULT_ORIGINS, service).toContain(origin);
      }
    }
    // And nothing else: a service with one of its two origins would pass the
    // loop above by having the other one somewhere, and fail here.
    expect(DEFAULT_ORIGINS).toHaveLength(ALLOWED_SERVICES.length * 2 + 2);
  });

  it('is not a wildcard', () => {
    // Nothing here is secret and no request carries a credential, so `*` would
    // leak nothing. It is still a list: this is the kind of setting that is
    // easy to widen and impossible to narrow once something unknown depends
    // on it.
    expect(allowedOrigins(undefined)).not.toContain('*');
  });

  it('takes an override, for a preview deployment without a code change', () => {
    expect(allowedOrigins('https://preview.example, https://other.example')).toEqual([
      'https://preview.example',
      'https://other.example',
    ]);
  });

  it('reads an empty or blank variable as "not set" rather than "nobody"', () => {
    // An unset variable and one set to the empty string arrive the same way
    // through a container's environment, and "no origin may read this" is not
    // a state anybody would choose on purpose.
    expect(allowedOrigins('')).toEqual(DEFAULT_ORIGINS);
    expect(allowedOrigins('   ')).toEqual(DEFAULT_ORIGINS);
  });

  it('drops the empty entry a trailing comma leaves behind', () => {
    expect(allowedOrigins('https://a.example,')).toEqual(['https://a.example']);
  });
});

describe('how long an answer may be reused', () => {
  it('matches the /data tier the site already serves', () => {
    // `deploy/nginx.conf` caches the bundled artefacts for five minutes.
    // Moving a screen from the file to the API should not change how often it
    // is re-fetched, or a performance comparison between the two measures the
    // cache policy instead of the source.
    expect(ARTEFACT_CACHE).toBe('public, max-age=300');
  });
});

describe('remembering a rebuilt artefact', () => {
  it('builds once for everybody who asks within the window, and again after it', async () => {
    let clock = 0;
    let builds = 0;
    const memo = createMemo(1000, () => clock);
    const build = () => Promise.resolve(++builds);
    const [a, b] = await Promise.all([memo.get('map/x', build), memo.get('map/x', build)]);
    expect([a, b, builds]).toEqual([1, 1, 1]);
    clock = 999;
    expect(await memo.get('map/x', build)).toBe(1);
    clock = 1000;
    expect(await memo.get('map/x', build)).toBe(2);
    expect(await memo.get('map/y', build)).toBe(3);
  });

  it('forgets a failed build, so a missing extent is not remembered as missing', async () => {
    const memo = createMemo(60_000, () => 0);
    await expect(memo.get('map/x', () => Promise.reject(new Error('not loaded')))).rejects.toThrow('not loaded');
    expect(await memo.get('map/x', () => Promise.resolve('loaded'))).toBe('loaded');
  });

  it('keeps an answer for ten minutes', () => {
    expect(REBUILT_FOR_MS).toBe(600_000);
  });
});

describe('the defence headers on every answer', () => {
  // A pool that cannot connect: the headers must be on the failure as well,
  // and no test here needs a database to check them.
  const down = { connect: () => Promise.reject(new Error('no database here')) } as unknown as pg.Pool;
  // The server logs the failure it answers with; that log is not this test's.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['/health', '/api/flood-history', '/nowhere'])('sends them on %s, whatever the status', async (route) => {
    const response = await createApp(down).request(route);
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('leaves cross-origin reading to CORS, so the site can still fetch it', async () => {
    const response = await createApp(down).request('/health');
    expect(response.headers.get('cross-origin-resource-policy')).toBeNull();
  });
});
