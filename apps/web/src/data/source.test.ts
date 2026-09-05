/**
 * The fallback, in every way the API can fail to answer.
 *
 * These are not hypotheticals. The Cloud SQL instance behind the API is
 * expected to be stopped between demonstrations, so "the API does not answer"
 * is a state the product is planned to be in — and the only way to find out
 * what the site does then, short of stopping a database, is here.
 */

import { describe, expect, it, vi } from 'vitest';

import { fetchArtefact, served } from './source.js';

const ok = (body: unknown): Response =>
  ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;

const status = (code: number): Response =>
  ({
    ok: false,
    status: code,
    json: () => Promise.reject(new Error('no body')),
  }) as unknown as Response;

/**
 * Answers per URL, and records what was asked.
 *
 * The fake honours `init.signal` the way a browser's `fetch` does, which is
 * what makes the timeout test mean something: if the signal ever stopped being
 * passed, the hanging request would hang here too and that test would go red
 * rather than quietly passing on a race this code did not run.
 */
function server(answers: Record<string, (init?: RequestInit) => Promise<Response>>) {
  const asked: string[] = [];
  const impl = ((url: string, init?: RequestInit) => {
    asked.push(url);
    const answer = answers[url];
    if (!answer) return Promise.reject(new Error(`nothing serves ${url}`));
    const signal = init?.signal;
    if (!signal) return answer(init);
    return Promise.race([
      answer(init),
      new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }),
    ]);
  }) as unknown as typeof fetch;
  return { impl, asked };
}

const passes = () => undefined;

describe('when the API answers', () => {
  it('uses it, and says so', async () => {
    const { impl, asked } = server({ '/api/map': () => Promise.resolve(ok({ a: 1 })) });
    const got = await fetchArtefact({
      api: '/api/map',
      bundled: '/data/map.json',
      guard: passes,
      fetchImpl: impl,
    });

    expect(got).toEqual({ value: { a: 1 }, from: 'api' });
    expect(asked).toEqual(['/api/map']);
  });

  it('does not fetch the bundled copy as well', async () => {
    // The point of reading from the database is not to download both.
    const { impl, asked } = server({ '/api/map': () => Promise.resolve(ok({})) });
    await fetchArtefact({ api: '/api/map', bundled: '/data/map.json', guard: passes, fetchImpl: impl });
    expect(asked).not.toContain('/data/map.json');
  });
});

describe('when the API cannot answer', () => {
  const bundled = { '/data/map.json': () => Promise.resolve(ok({ from: 'file' })) };

  it('falls back on a 500', async () => {
    const { impl } = server({ '/api/map': () => Promise.resolve(status(500)), ...bundled });
    const got = await fetchArtefact({
      api: '/api/map',
      bundled: '/data/map.json',
      guard: passes,
      fetchImpl: impl,
    });
    expect(got).toEqual({ value: { from: 'file' }, from: 'bundled' });
  });

  it('falls back on a 404, which is what a database with no rows produces', async () => {
    const { impl } = server({ '/api/map': () => Promise.resolve(status(404)), ...bundled });
    const got = await fetchArtefact({
      api: '/api/map',
      bundled: '/data/map.json',
      guard: passes,
      fetchImpl: impl,
    });
    expect(got.from).toBe('bundled');
  });

  it('falls back when the network is not there at all', async () => {
    const { impl } = server({
      '/api/map': () => Promise.reject(new TypeError('Failed to fetch')),
      ...bundled,
    });
    const got = await fetchArtefact({
      api: '/api/map',
      bundled: '/data/map.json',
      guard: passes,
      fetchImpl: impl,
    });
    expect(got.from).toBe('bundled');
  });

  it('falls back when it hangs, rather than waiting for it', async () => {
    // The stopped-instance case. Cloud Run does not refuse the request; it
    // waits on a database that is not running, and so would the visitor.
    const { impl } = server({
      '/api/map': () => new Promise<Response>(() => undefined),
      ...bundled,
    });
    const got = await fetchArtefact({
      api: '/api/map',
      bundled: '/data/map.json',
      guard: passes,
      fetchImpl: impl,
      timeoutMs: 20,
    });
    expect(got.from).toBe('bundled');
  }, 10_000);

  it('falls back when the guard refuses what the API sent', async () => {
    // The case that matters most and is easiest to leave out. A query that
    // drops a field returns 200 with a body the browser cannot draw; the
    // guard is what turns that into a fallback instead of a broken map.
    const { impl } = server({ '/api/map': () => Promise.resolve(ok({ half: 'an artefact' })), ...bundled });
    const got = await fetchArtefact({
      api: '/api/map',
      bundled: '/data/map.json',
      guard: (value) => {
        if ((value as { half?: unknown }).half !== undefined) throw new Error('not usable');
      },
      fetchImpl: impl,
    });
    expect(got.from).toBe('bundled');
  });

  it('says why, so the reason is not lost', async () => {
    const onFallback = vi.fn();
    const { impl } = server({ '/api/map': () => Promise.resolve(status(503)), ...bundled });
    await fetchArtefact({
      api: '/api/map',
      bundled: '/data/map.json',
      guard: passes,
      fetchImpl: impl,
      onFallback,
    });
    expect(onFallback).toHaveBeenCalledWith('/api/map', 'answered 503');
  });
});

describe('when there is no API configured', () => {
  it('goes straight to the bundled copy without a failed request', async () => {
    // What `npm run dev` does. A checkout should not reach a production
    // database because somebody opened it.
    const { impl, asked } = server({ '/data/map.json': () => Promise.resolve(ok({})) });
    const got = await fetchArtefact({
      api: '',
      bundled: '/data/map.json',
      guard: passes,
      fetchImpl: impl,
    });
    expect(got.from).toBe('bundled');
    expect(asked).toEqual(['/data/map.json']);
  });
});

describe('when nothing can answer', () => {
  it('throws, because there is nothing left to draw', async () => {
    const { impl } = server({});
    await expect(
      fetchArtefact({ api: '/api/map', bundled: '/data/map.json', guard: passes, fetchImpl: impl }),
    ).rejects.toThrow(/\/data\/map\.json/);
  });
});

describe('describing where a screenful came from', () => {
  it('names the one source when they agree', () => {
    expect(served(['api', 'api', 'api'])).toBe('api');
    expect(served(['bundled', 'bundled'])).toBe('bundled');
  });

  it('refuses to call three out of four "the database"', () => {
    // The API can answer three requests and time out on the fourth. Calling
    // that "served from the database" is a claim about data that was not.
    expect(served(['api', 'api', 'api', 'bundled'])).toBe('mixed');
  });

  it('treats nothing at all as bundled rather than throwing', () => {
    expect(served([])).toBe('bundled');
  });
});
