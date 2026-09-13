/**
 * The address the product offers when somebody has not got one of their own.
 *
 * Written on 11 September and shipped the same day **with no test at all** —
 * a module whose whole argument is that the offer is named and checkable,
 * unchecked. The self-check that afternoon found it at 0% and this is the
 * repair.
 *
 * What matters here is the fallback. `check-guide.mjs` asserts the named
 * address is in the published index, so the fallback should never fire in
 * production; these are about what happens when it does, because a silent
 * return to "whichever address sorts first" is how this module came to exist.
 */

import { describe, expect, it } from 'vitest';

import { DEMONSTRATION_LABEL, demonstrationAddress } from './demonstration.js';
import type { AddressIndex, IndexedAddress } from './search.js';

const at = (id: string, label: string, e = 500, n = 500): IndexedAddress => {
  const [number = '', ...rest] = label.split(' ');
  return { id, label, number, street: rest.join(' ').split(',')[0] ?? '', suburb: 'Kensington', e, n };
};

const index = (addresses: readonly IndexedAddress[]): AddressIndex => ({
  area: 'kensington',
  addresses,
});

describe('choosing the address to offer', () => {
  it('picks the named one wherever it sits in the index', () => {
    // Not the first. The whole point is that the offer is chosen rather than
    // being whatever the pipeline's sort left at the top.
    const chosen = demonstrationAddress(
      index([
        at('a', '32 Altona Street, Kensington'),
        at('b', '1 Bellair Street, Kensington'),
        at('c', DEMONSTRATION_LABEL),
      ]),
    );
    expect(chosen?.label).toBe(DEMONSTRATION_LABEL);
    expect(chosen?.id).toBe('c');
  });

  it('matches without caring about case', () => {
    const chosen = demonstrationAddress(index([at('a', DEMONSTRATION_LABEL.toUpperCase())]));
    expect(chosen?.id).toBe('a');
  });

  it('falls back to the first address when the named one is gone', () => {
    /*
     * The behaviour to be deliberate about. An index rebuilt from a new
     * release could drop this address, and a screen with no suggestion at all
     * is worse than one suggesting an arbitrary address.
     *
     * It must not be silent, which is why `tools/data/check-guide.mjs`
     * asserts the named address is published and at least 150 m from every
     * boundary. That check fails the build; this fallback keeps the screen
     * working while somebody fixes it.
     */
    const chosen = demonstrationAddress(index([at('a', '32 Altona Street, Kensington')]));
    expect(chosen?.id).toBe('a');
  });

  it('returns nothing for an empty index rather than inventing an address', () => {
    expect(demonstrationAddress(index([]))).toBeUndefined();
  });

  it('names an address in the pilot suburb, not a placeholder', () => {
    // A guard on the constant itself: a label that stopped being a real
    // Kensington address would pass every test above by falling back.
    expect(DEMONSTRATION_LABEL).toMatch(/Kensington$/);
    expect(DEMONSTRATION_LABEL).toMatch(/^\d/);
  });
});
