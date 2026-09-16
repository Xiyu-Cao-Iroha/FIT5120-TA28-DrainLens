import { describe, expect, it } from 'vitest';

import type { AddressIndex, IndexedAddress } from './search.js';
import { suburbsOf } from './suburbs.js';

const at = (suburb: string, id: string): IndexedAddress => ({
  id,
  label: `1 Any Street, ${suburb}`,
  number: '1',
  street: 'Any Street',
  suburb,
  e: 0,
  n: 0,
});

const indexOf = (...addresses: IndexedAddress[]): AddressIndex => ({ area: 'test', addresses });

describe('the suburbs under the address box', () => {
  it('names each suburb once, alphabetically', () => {
    const index = indexOf(at('Kensington', 'a'), at('Carlton', 'b'), at('Kensington', 'c'), at('Carlton North', 'd'));
    expect(suburbsOf(index)).toEqual(['Carlton', 'Carlton North', 'Kensington']);
  });

  it('leaves out an address with no suburb rather than listing a blank', () => {
    expect(suburbsOf(indexOf(at('', 'a'), at('  ', 'b'), at('Docklands', 'c')))).toEqual(['Docklands']);
  });

  it('follows the index it is given, so a clipped index lists fewer', () => {
    // The fallback map is one square kilometre of Kensington; a hand-typed
    // list would go on naming Southbank.
    const council = indexOf(at('Kensington', 'a'), at('Southbank', 'b'));
    const clipped = indexOf(at('Kensington', 'a'));
    expect(suburbsOf(council)).toEqual(['Kensington', 'Southbank']);
    expect(suburbsOf(clipped)).toEqual(['Kensington']);
  });

  it('answers the same array for the same index', () => {
    const index = indexOf(at('Parkville', 'a'));
    expect(suburbsOf(index)).toBe(suburbsOf(index));
  });
});
