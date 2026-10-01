/**
 * Enter and the arrow keys in the map's address search.
 *
 * The case from the 15 September user test is pinned against the published
 * index, because what made Enter matter was a real street with real
 * neighbours in the suggestions, not a fixture.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { addressForEnter, nextActive } from './enter.js';
import { type AddressIndex, type IndexedAddress, type PackedIndex, search, unpack } from './search.js';

const at = (id: string, number: string, street: string, suburb = 'Kensington'): IndexedAddress => ({
  id,
  label: `${number} ${street}, ${suburb}`,
  number,
  street,
  suburb,
  e: 500,
  n: 500,
});

const INDEX: AddressIndex = {
  area: 'kensington',
  addresses: [
    at('a', '46', 'Gatehouse Drive'),
    at('b', '44', 'Gatehouse Drive'),
    at('c', '4', 'Gatehouse Drive'),
    at('d', '10', 'Neale Street'),
    at('e', '10', 'Neale Street', 'Kensington North'),
    at('f', '10', 'Bellair Street'),
  ],
  streets: ['Gatehouse Drive', 'Neale Street', 'Bellair Street', 'Harper Street'],
};

describe('Enter in the map search', () => {
  it('goes to the address the first screen would go to', () => {
    expect(addressForEnter(INDEX, '46 Gatehouse Drive')?.id).toBe('a');
    expect(addressForEnter(INDEX, '46 gatehouse dr')?.id).toBe('a');
  });

  it('takes the top suggestion when it starts with a query that names the street', () => {
    // Both Neale Street labels start with the query, so `resolve` calls it
    // ambiguous; the top suggestion is the shorter label.
    expect(search(INDEX, '10 Neale Street').map((m) => m.address.id)).toEqual(['d', 'e']);
    expect(addressForEnter(INDEX, '10 Neale Street')?.id).toBe('d');
  });

  it('does not guess from a number alone', () => {
    expect(search(INDEX, '10').length).toBeGreaterThan(1);
    expect(addressForEnter(INDEX, '10')).toBeNull();
  });

  it('leaves the list open when the top suggestion does not start with the query', () => {
    // "gatehouse" is in all three, and none of them starts with it.
    expect(search(INDEX, 'gatehouse')).toHaveLength(3);
    expect(addressForEnter(INDEX, 'gatehouse')).toBeNull();
  });

  it('does nothing for an address outside the pilot or no address at all', () => {
    expect(addressForEnter(INDEX, '9 Harper Street')).toBeNull();
    expect(addressForEnter(INDEX, 'nowhere at all')).toBeNull();
    expect(addressForEnter(INDEX, '')).toBeNull();
  });

  it('goes to 10 Lygon Street, Carlton in the published index', () => {
    const file = path.resolve(__dirname, '../../public/data/addresses.json');
    const packed = JSON.parse(readFileSync(file, 'utf8')) as PackedIndex;
    const index = unpack(packed, packed.extent);
    expect(search(index, '10 Lygon Street')[0]?.address.label).toBe('10 Lygon Street, Carlton');
    expect(addressForEnter(index, '10 Lygon Street')?.label).toBe('10 Lygon Street, Carlton');
  });
});

describe('the arrow keys', () => {
  it('go down from the field to the first suggestion and stop at the last', () => {
    expect(nextActive(-1, 3, 'ArrowDown')).toBe(0);
    expect(nextActive(1, 3, 'ArrowDown')).toBe(2);
    expect(nextActive(2, 3, 'ArrowDown')).toBe(2);
  });

  it('go up to the field from the first suggestion', () => {
    expect(nextActive(2, 3, 'ArrowUp')).toBe(1);
    expect(nextActive(0, 3, 'ArrowUp')).toBe(-1);
    expect(nextActive(-1, 3, 'ArrowUp')).toBe(-1);
  });

  it('come back inside a list that got shorter, and to nothing when it is empty', () => {
    expect(nextActive(5, 3, 'ArrowUp')).toBe(2);
    expect(nextActive(5, 3, 'ArrowDown')).toBe(2);
    expect(nextActive(0, 0, 'ArrowDown')).toBe(-1);
  });
});
