/**
 * Asking the API for an address, and answering locally when it cannot.
 *
 * **This is the half of the 9 October decision that a resident can see.** The
 * mentor's observation was that the address search had no API; it did not,
 * deliberately, and `packages/address` carries what that cost to change. What
 * is here is the request, the fallback, and the one rule that keeps the two
 * honest: both ends run the same matcher, so the fallback is the same answer
 * arriving by a different route rather than a lesser one.
 *
 * **The index is still in the browser and this does not save a byte.** It is
 * worth being plain about that, because it is the obvious thing to claim. The
 * bundled index is loaded for the drains panel, the demonstration addresses,
 * the suburb list and `searchable()`, none of which this route answers, so
 * moving the search to the API removed nothing from the page. What it bought
 * is an address search backed by the same Postgres the rest of the product is
 * served from, and a product that keeps working when that Postgres does not.
 *
 * **Suggestions do not come through here.** They are drawn from the index in
 * memory on every keystroke, and that is not a leftover: a request per
 * character would send somebody's home address to a server one letter at a
 * time to answer a question that is already answered locally, and the answer
 * would be identical because it is the same function over the same rows. The
 * request happens once, when a search is submitted.
 */

import { type AddressIndex, type Resolution, resolve } from '@drainlens/address';

import { API_BASE, API_TIMEOUT_MS, type Origin } from '../data/source.js';

/** Where the search is sent. Empty in a checkout, which skips the API. */
export const SEARCH_URL = API_BASE === '' ? null : `${API_BASE}/api/addresses/search`;

export interface LookedUp {
  readonly answer: Resolution;
  readonly from: Origin;
}

export interface LookupRequest {
  readonly index: AddressIndex;
  readonly typed: string;
  readonly url?: string | null;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  /** Told why the API was not used, so a caller can log it. */
  readonly onFallback?: (reason: string) => void;
}

/**
 * A verdict from the API, checked hard enough to be refused.
 *
 * The same rule `fetchArtefact` follows: a payload the browser would not
 * accept from a file is not accepted from the database either, and refusing
 * it is what makes the fallback happen. Here that matters more than usual --
 * a malformed `found` with no address would put a pin nowhere and say
 * nothing.
 */
function assertResolution(value: unknown): asserts value is Resolution {
  if (typeof value !== 'object' || value === null) {
    throw new Error('the search answered with something that is not a verdict');
  }
  const verdict = value as { kind?: unknown; address?: unknown; matches?: unknown };
  if (verdict.kind === 'found') {
    const address = verdict.address as { id?: unknown; label?: unknown } | undefined;
    if (typeof address?.id !== 'string' || typeof address.label !== 'string') {
      throw new Error('the search found an address with no id or label');
    }
    return;
  }
  if (verdict.kind === 'ambiguous') {
    if (!Array.isArray(verdict.matches)) {
      throw new Error('the search called the query ambiguous and offered nothing');
    }
    return;
  }
  if (verdict.kind === 'outside-pilot' || verdict.kind === 'not-an-address') return;
  throw new Error(`the search answered with an unknown verdict`);
}

/**
 * Resolve what somebody typed: the API first, the bundled index after.
 *
 * Any failure falls back, for the reason `fetchArtefact` gives: a 500, a
 * timeout, a CORS rejection, an absent network, unparseable JSON and a
 * refused payload are one fact to the person waiting -- the database cannot
 * answer this right now -- and sorting them into those that may show a broken
 * screen and those that may not is a choice nobody should have to make at a
 * search box.
 *
 * Unlike `fetchArtefact` this cannot throw: the fallback is a pure function
 * over an index already in memory, so there is always an answer.
 */
export async function lookupAddress(request: LookupRequest): Promise<LookedUp> {
  const url = request.url === undefined ? SEARCH_URL : request.url;
  const local = (): LookedUp => ({
    answer: resolve(request.index, request.typed),
    from: 'bundled',
  });

  if (url === null || url === '') return local();

  try {
    const response = await (request.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The query, and nothing else. No address id, no map state, no
      // identifier of any kind -- there is none to send.
      body: JSON.stringify({ q: request.typed }),
      signal: AbortSignal.timeout(request.timeoutMs ?? API_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`answered ${String(response.status)}`);
    const value: unknown = await response.json();
    assertResolution(value);
    return { answer: value, from: 'api' };
  } catch (error) {
    request.onFallback?.(error instanceof Error ? error.message : String(error));
    return local();
  }
}
