/**
 * Falling back to the copy in the container, and saying so.
 *
 * **The branches here were the least-tested load-bearing code in the app**,
 * and the reason to care is not hypothetical: on 11 September the whole
 * Iteration 2 URL served a square kilometre for a day, because the API's CORS
 * list had not learned about the dev service. Every response was dropped by
 * the browser, this code did exactly what it exists for, and the footer said
 * so in plain words. The mechanism worked; nothing proved it did.
 *
 * What these cover is the *decision*: when to reach for the API, when to give
 * up on it, whether a guard refusing an artefact counts as a failure, and what
 * the screen is told about where the data came from.
 *
 * `fetchTogether` matters more than its size suggests. The three artefacts it
 * takes describe one place in one coordinate frame, and taking two from the
 * API and one from the container would draw a kilometre and a half off.
 */

import { describe, expect, it, vi } from 'vitest';

import { fetchArtefact, fetchTogether, served } from './source.js';

/** A fetch that answers with one body, or refuses. */
const answering = (body: unknown) =>
  vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as unknown as Response),
  );

const refusing = (message = 'network down') => vi.fn(() => Promise.reject(new Error(message)));

const pass = (v: unknown) => v as { n: number };

describe('one artefact, with a copy to fall back to', () => {
  it('takes the API when it answers', async () => {
    const fetchImpl = answering({ n: 1 });
    const got = await fetchArtefact({
      api: '/api/map/x',
      bundled: '/data/map.json',
      guard: pass,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(got.from).toBe('api');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not ask the API at all when there is no API to ask', async () => {
    // `API_BASE` is empty in a checkout, so `at()` hands null. A developer
    // running `npm run dev` should not reach across the internet to a
    // production database because they opened a page.
    const fetchImpl = answering({ n: 2 });
    const got = await fetchArtefact({
      api: null,
      bundled: '/data/map.json',
      guard: pass,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(got.from).toBe('bundled');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/data/map.json');
  });

  it('treats an empty API origin the same as none', async () => {
    const fetchImpl = answering({ n: 3 });
    const got = await fetchArtefact({
      api: '',
      bundled: '/data/map.json',
      guard: pass,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(got.from).toBe('bundled');
  });

  it('falls back to the container copy when the API does not answer', async () => {
    let call = 0;
    const fetchImpl = vi.fn(() => {
      call += 1;
      return call === 1
        ? Promise.reject(new Error('CORS'))
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ n: 4 }) } as unknown as Response);
    });

    const got = await fetchArtefact({
      api: '/api/map/x',
      bundled: '/data/map.json',
      guard: pass,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(got.from).toBe('bundled');
  });

  it('says why, to a console rather than only to the footer', async () => {
    // The footer tells a visitor which source answered; this tells whoever is
    // looking at a console *why*, which the footer cannot.
    const onFallback = vi.fn();
    let call = 0;
    const fetchImpl = vi.fn(() => {
      call += 1;
      return call === 1
        ? Promise.reject(new Error('the database is stopped'))
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ n: 5 }) } as unknown as Response);
    });

    await fetchArtefact({
      api: '/api/map/x',
      bundled: '/data/map.json',
      guard: pass,
      onFallback,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback.mock.calls[0]?.[1]).toContain('the database is stopped');
  });

  it('falls back when the API answers with something the guard refuses', async () => {
    /*
     * A 200 carrying the wrong shape is worse than a refused connection: it
     * looks like success. The guard is the frontend's own, so an API that
     * drops a field falls back to the copy that has it rather than drawing a
     * map with a hole in it.
     */
    let call = 0;
    const fetchImpl = vi.fn(() => {
      call += 1;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(call === 1 ? { wrong: true } : { n: 6 }),
      } as unknown as Response);
    });
    const guard = (v: unknown) => {
      if ((v as { n?: number }).n === undefined) throw new Error('no n');
      return v as { n: number };
    };

    const got = await fetchArtefact({
      api: '/api/map/x',
      bundled: '/data/map.json',
      guard,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(got.from).toBe('bundled');
    expect(got.value.n).toBe(6);
  });

  it('throws when the container copy fails too, because there is nothing left', async () => {
    await expect(
      fetchArtefact({
        api: null,
        bundled: '/data/map.json',
        guard: pass,
        fetchImpl: refusing('disk gone') as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
  });
});

describe('three artefacts that describe one place', () => {
  const three = (fetchImpl: unknown) =>
    [1, 2, 3].map((n) => ({
      api: `/api/${String(n)}`,
      bundled: `/data/${String(n)}.json`,
      guard: pass,
      fetchImpl: fetchImpl as typeof fetch,
    }));

  it('takes all three from the API when the API answers', async () => {
    const got = await fetchTogether(three(answering({ n: 1 })));
    expect(got.from).toBe('api');
    expect(got.values).toHaveLength(3);
  });

  it('takes all three from the container when any one of them fails', async () => {
    /*
     * The whole point. The API's extent is the council and the container's is
     * the pilot square kilometre, so two from one side and one from the other
     * would put the derived layers 1.5 km west and 6 km south of the streets
     * they belong to — silently, and looking like a map.
     */
    let call = 0;
    const fetchImpl = vi.fn(() => {
      call += 1;
      // The second API request fails; the rest answer.
      return call === 2
        ? Promise.reject(new Error('timeout'))
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ n: call }) } as unknown as Response);
    });

    const got = await fetchTogether(three(fetchImpl));
    expect(got.from).toBe('bundled');
  });

  it('reports the failure once for the set, not once per artefact', async () => {
    // They failed as a set. Three lines in a console would suggest three
    // faults.
    const onFallback = vi.fn();
    let call = 0;
    const fetchImpl = vi.fn(() => {
      call += 1;
      return call <= 3
        ? Promise.reject(new Error('CORS'))
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ n: call }) } as unknown as Response);
    });

    const list = three(fetchImpl).map((r, i) => (i === 0 ? { ...r, onFallback } : r));
    await fetchTogether(list);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback.mock.calls[0]?.[0]).toBe('the API');
  });

  it('goes straight to the container when there is no API configured', async () => {
    const fetchImpl = answering({ n: 1 });
    const got = await fetchTogether(
      [1, 2, 3].map((n) => ({
        api: null,
        bundled: `/data/${String(n)}.json`,
        guard: pass,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })),
    );
    expect(got.from).toBe('bundled');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('saying where a screenful came from', () => {
  it('names the one source when they agree', () => {
    expect(served(['api', 'api'])).toBe('api');
    expect(served(['bundled', 'bundled'])).toBe('bundled');
  });

  it('says mixed rather than picking a winner', () => {
    // A real state, not a rounding error: the API can answer three requests
    // and time out on the fourth. Reporting that as "the database" would be a
    // claim about data that did not come from it.
    expect(served(['api', 'bundled'])).toBe('mixed');
    expect(served(['bundled', 'api'])).toBe('mixed');
  });

  it('reads nothing at all as the container copy', () => {
    // The honest default: with no evidence that a server answered, the claim
    // that one did should not be made.
    expect(served([])).toBe('bundled');
  });
});
