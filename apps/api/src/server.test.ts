/**
 * The two settings that decide whether a browser may read this at all.
 *
 * Everything else in the API is exercised against a real Postgres in
 * `test-db/`. These two are pure and are the ones that fail in a way nobody
 * sees while testing: a wrong origin list produces a working API that the site
 * cannot read, and the browser reports it as a network error with no body.
 */

import { describe, expect, it } from 'vitest';

import { ARTEFACT_CACHE, DEFAULT_ORIGINS, allowedOrigins } from './server.js';

describe('who may read this from a browser', () => {
  it('allows the deployed site and the local dev server by default', () => {
    expect(allowedOrigins(undefined)).toEqual(DEFAULT_ORIGINS);
    expect(DEFAULT_ORIGINS).toContain(
      'https://drainlens-205559161217.australia-southeast1.run.app',
    );
    expect(DEFAULT_ORIGINS).toContain('http://localhost:5183');
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
