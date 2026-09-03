import { describe, expect, it } from 'vitest';

import {
  type AddressIndex,
  type IndexedAddress,
  MAX_SUGGESTIONS,
  normalise,
  resolve,
  search,
} from './search.js';

const at = (id: string, number: string, street: string, e = 500, n = 500): IndexedAddress => ({
  id,
  label: `${number} ${street}, Kensington`,
  number,
  street,
  suburb: 'Kensington',
  e,
  n,
});

const KENSINGTON: AddressIndex = {
  area: 'kensington',
  addresses: [
    at('a', '46', 'Gatehouse Drive', 320, 640),
    at('b', '44', 'Gatehouse Drive', 316, 638),
    at('c', '4', 'Gatehouse Drive', 280, 610),
    at('d', '13', 'Neale Street', 140, 480),
    at('e', '2', 'Neale Street', 120, 470),
    at('f', '46', 'Bellair Street', 700, 300),
    at('g', '1', 'Kirk Street', 210, 120),
  ],
};

describe('normalising what was typed', () => {
  it('ignores case and punctuation', () => {
    expect(normalise('46 Gatehouse Dr.')).toBe(normalise('46 gatehouse dr'));
    expect(normalise("O'Shea Court")).toBe('o shea court');
  });

  it('expands the abbreviation people actually type', () => {
    // An index that only matches the published spelling tells somebody their
    // own address does not exist.
    expect(normalise('46 gatehouse dr')).toBe('46 gatehouse drive');
    expect(normalise('13 neale st')).toBe('13 neale street');
    expect(normalise('9 the cres')).toBe('9 the crescent');
  });

  it('collapses runs of whitespace', () => {
    expect(normalise('  46   gatehouse    drive ')).toBe('46 gatehouse drive');
  });

  it('keeps the characters a unit number needs', () => {
    expect(normalise('2/46 Gatehouse Drive')).toBe('2/46 gatehouse drive');
    expect(normalise('46-48 Bellair Street')).toBe('46-48 bellair street');
  });
});

describe('searching', () => {
  it('finds an address from its beginning', () => {
    const [best] = search(KENSINGTON, '46 gatehouse');
    expect(best?.address.id).toBe('a');
  });

  it('finds it from an abbreviation', () => {
    expect(search(KENSINGTON, '46 gatehouse dr')[0]?.address.id).toBe('a');
  });

  it('puts the exact house number first', () => {
    // "4 gatehouse" must not offer number 44 or 46 ahead of number 4.
    expect(search(KENSINGTON, '4 gatehouse')[0]?.address.number).toBe('4');
  });

  it('offers every house on a street when only the street is typed', () => {
    const streets = search(KENSINGTON, 'gatehouse').map((m) => m.address.number);
    expect(streets.sort()).toEqual(['4', '44', '46']);
  });

  it('matches words in any order', () => {
    expect(search(KENSINGTON, 'gatehouse 46')[0]?.address.id).toBe('a');
  });

  it('finds nothing for a street the pilot does not cover', () => {
    expect(search(KENSINGTON, 'Collins Street')).toEqual([]);
  });

  it('returns nothing for an empty query rather than everything', () => {
    expect(search(KENSINGTON, '')).toEqual([]);
    expect(search(KENSINGTON, '   ')).toEqual([]);
  });

  it('caps the list so it is read rather than scrolled', () => {
    const many: AddressIndex = {
      area: 'kensington',
      addresses: Array.from({ length: 40 }, (_, i) => at(`x${i}`, String(i + 1), 'Long Street')),
    };
    expect(search(many, 'long street')).toHaveLength(MAX_SUGGESTIONS);
  });

  it('orders the same way every time, so the list does not shuffle while typing', () => {
    const once = search(KENSINGTON, 'gatehouse').map((m) => m.address.id);
    const again = search(KENSINGTON, 'gatehouse').map((m) => m.address.id);
    expect(once).toEqual(again);
  });
});

describe('resolving a submitted address', () => {
  it('takes a single match', () => {
    expect(resolve(KENSINGTON, '13 Neale Street')).toEqual({
      kind: 'found',
      address: KENSINGTON.addresses[3],
    });
  });

  it('takes an exact address even when others share its prefix', () => {
    const found = resolve(KENSINGTON, '46 Gatehouse Drive, Kensington');
    expect(found.kind).toBe('found');
    expect(found.kind === 'found' && found.address.id).toBe('a');
  });

  it('asks rather than guesses when several fit', () => {
    const answer = resolve(KENSINGTON, 'gatehouse');
    expect(answer.kind).toBe('ambiguous');
    expect(answer.kind === 'ambiguous' && answer.matches.length).toBe(3);
  });

  it('says a known street with an unknown number is outside the covered part', () => {
    // The distinction AC 1.1.8 turns on. This is a real address on a street
    // the pilot covers, at a number the pilot does not.
    const answer = resolve(KENSINGTON, '999 Gatehouse Drive');
    expect(answer.kind).toBe('outside-pilot');
  });

  it('uses the published street list, not the streets the addresses happen to name', () => {
    // The bug this test exists for. The artefact publishes every street in the
    // pilot area; the addresses cover only some of them, and while the index
    // is a stand-in they cover two. Scanning the addresses told somebody on a
    // street the pilot demonstrably reaches that we had no record of it.
    const sparse: AddressIndex = {
      area: 'kensington',
      streets: ['Gatehouse Drive', 'Bangalore Street', 'Altona Street'],
      addresses: [at('a', '46', 'Gatehouse Drive')],
    };

    expect(resolve(sparse, '999 Bangalore Street').kind).toBe('outside-pilot');
    expect(resolve(sparse, '12 Altona Street').kind).toBe('outside-pilot');
    expect(resolve(sparse, '1 Collins Street').kind).toBe('not-an-address');
  });

  it('recognises a street from the abbreviation somebody typed', () => {
    const sparse: AddressIndex = {
      area: 'kensington',
      streets: ['Bangalore Street'],
      addresses: [at('a', '46', 'Gatehouse Drive')],
    };
    expect(resolve(sparse, '999 bangalore st').kind).toBe('outside-pilot');
  });

  it('falls back to the addresses when no street list is published', () => {
    // Older artefacts, and the smallest possible index. Worse, but not wrong.
    const noList: AddressIndex = { area: 'k', addresses: [at('a', '46', 'Gatehouse Drive')] };
    expect(resolve(noList, '999 Gatehouse Drive').kind).toBe('outside-pilot');
    expect(resolve(noList, '1 Collins Street').kind).toBe('not-an-address');
  });

  it('says an unknown street is something it cannot speak about', () => {
    expect(resolve(KENSINGTON, '1 Collins Street, Melbourne').kind).toBe('not-an-address');
  });

  it('never answers with a different address than the one asked about', () => {
    // Offering number 44 to somebody who asked about 999 is precisely the
    // failure the criterion exists to prevent.
    const answer = resolve(KENSINGTON, '999 Gatehouse Drive');
    expect(answer.kind).not.toBe('found');
    expect(JSON.stringify(answer)).not.toContain('"44"');
  });

  it('carries back what was typed, so the screen can say it', () => {
    const answer = resolve(KENSINGTON, '1 Example Road, Outside Pilot');
    expect(answer.kind === 'not-an-address' && answer.typed).toBe('1 Example Road, Outside Pilot');
  });
});

describe('the search is local', () => {
  it('never reaches the network', async () => {
    // Every keystroke of a home address would otherwise be sent somewhere. The
    // whole reason the index ships with the site.
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (...args: unknown[]) => {
      calls.push(String(args[0]));
      throw new Error('the address search must not take a network');
    };
    try {
      search(KENSINGTON, '46 gatehouse drive');
      resolve(KENSINGTON, '46 gatehouse drive');
      resolve(KENSINGTON, '1 Collins Street');
    } finally {
      globalThis.fetch = original;
    }
    expect(calls).toEqual([]);
  });
});
