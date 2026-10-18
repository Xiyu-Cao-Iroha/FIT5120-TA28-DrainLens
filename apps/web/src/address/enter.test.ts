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

import { addressForEnter, addressFrom, nextActive } from './enter.js';
import {
  type AddressIndex,
  type IndexedAddress,
  type PackedIndex,
  resolve,
  search,
  unpack,
} from '@drainlens/address';

const at = (id: string, number: string, street: string, suburb = 'Kensington'): IndexedAddress => ({
  id,
  label: `${number} ${street}, ${suburb}`,
  number,
  street,
  suburb,
  e: 500,
  n: 500,
  at: 0,
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

/*
  The map's search sends what was typed to `POST /api/addresses/search` and
  gets back one of these four. There is no browser here to press Enter in, so
  what is pinned is the half that decides: given a verdict, which address the
  map moves to.
*/
describe('a verdict that came from the API', () => {
  it('takes an address the browser\u2019s own index has never heard of', () => {
    /*
      **The point of the whole exercise, in one assertion.** The published
      index in the container and the `address` table are loaded from the same
      file today, so almost any case would pass whichever side answered. This
      one cannot: 8 Macaulay Road is in no fixture here, and Enter reaching it
      is only possible if the verdict is used rather than recomputed locally.
    */
    const fromDatabase = at('db', '8', 'Macaulay Road');
    expect(search(INDEX, '8 Macaulay Road')).toHaveLength(0);
    expect(addressFrom(INDEX, '8 Macaulay Road', { kind: 'found', address: fromDatabase })).toBe(
      fromDatabase,
    );
  });

  it('still refuses to guess when the API calls it ambiguous', () => {
    // The same rule as the local path, applied to somebody else's matches:
    // a whole-query prefix on a street the index knows is taken, and the bare
    // number that is a prefix of hundreds of labels is not.
    const matches = search(INDEX, '10 Neale Street');
    expect(addressFrom(INDEX, '10 Neale Street', { kind: 'ambiguous', matches })?.id).toBe('d');
    expect(addressFrom(INDEX, '10', { kind: 'ambiguous', matches: search(INDEX, '10') })).toBeNull();
  });

  it('does nothing with the two failures', () => {
    const typed = '9 Harper Street';
    expect(addressFrom(INDEX, typed, { kind: 'outside-pilot', typed })).toBeNull();
    expect(addressFrom(INDEX, typed, { kind: 'not-an-address', typed })).toBeNull();
  });

  it('agrees with the local path when handed the local verdict', () => {
    // `addressForEnter` is this function over `resolve`, and the equality is
    // what keeps the fallback from being a lesser answer than the request.
    for (const typed of ['46 Gatehouse Drive', '10 Neale Street', '10', 'gatehouse', '']) {
      expect(addressFrom(INDEX, typed, resolve(INDEX, typed))).toEqual(addressForEnter(INDEX, typed));
    }
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
