import { describe, expect, it } from 'vitest';

import {
  type AddressIndex,
  IndexError,
  type IndexedAddress,
  type PackedIndex,
  MAX_SUGGESTIONS,
  normalise,
  resolve,
  search,
  unpack,
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

describe('unpacking the shipped index', () => {
  /** Kensington's own corner, as `addresses.json` carries it. */
  const KENSINGTON_FRAME = {
    min_e: 316500,
    min_n: 5814500,
    width_m: 1000,
    height_m: 1000,
  } as const;

  /**
   * The council's, which contains it. Kensington's corner is this one's
   * (1500, 6000) — the offset every address has to move by when the API is
   * answering and the map underneath is the whole council.
   */
  const COUNCIL_FRAME = {
    min_e: 315000,
    min_n: 5808500,
    width_m: 8500,
    height_m: 9000,
  } as const;

  const packed = {
    area: 'kensington',
    streets: ['Gatehouse Drive', 'Harper Street'],
    extent: KENSINGTON_FRAME,
    on: ['Gatehouse Drive|Kensington', 'Neale Street|Kensington'],
    at: [
      [
        ['46', 320.5, 640.25],
        ['48', 330, 645],
      ],
      [['13', 140, 480]],
    ],
  } as const;

  it('rebuilds every address', () => {
    expect(unpack(packed, KENSINGTON_FRAME).addresses).toHaveLength(3);
  });

  it('rebuilds the label the pipeline used to ship', () => {
    const [first] = unpack(packed, KENSINGTON_FRAME).addresses;
    expect(first?.label).toBe('46 Gatehouse Drive, Kensington');
    expect(first?.number).toBe('46');
    expect(first?.street).toBe('Gatehouse Drive');
    expect(first?.suburb).toBe('Kensington');
  });

  it('rebuilds the id the session keys on', () => {
    // A different id here means a re-entered address reads as a new one, which
    // silently drops the pit chosen beside the old one.
    expect(unpack(packed, KENSINGTON_FRAME).addresses[0]?.id).toBe('kensington/46-gatehouse-drive-kensington');
  });

  it('carries the street list through, which is a different list', () => {
    // Wider than the streets with addresses on purpose: it is what tells
    // "outside the pilot area" from "no record of that street" (AC 1.1.8).
    expect(unpack(packed, KENSINGTON_FRAME).streets).toEqual(['Gatehouse Drive', 'Harper Street']);
    expect(unpack(packed, KENSINGTON_FRAME).addresses.map((a) => a.street)).not.toContain('Harper Street');
  });

  it('handles an address with no suburb', () => {
    const noSuburb = {
      area: 'x',
      extent: KENSINGTON_FRAME,
      on: ['Some Lane|'],
      at: [[['1', 0, 0] as const]],
    };
    expect(unpack(noSuburb, KENSINGTON_FRAME).addresses[0]?.label).toBe('1 Some Lane');
  });

  it('refuses an index whose groups do not line up', () => {
    // The failure this prevents is an address placed on another street --
    // plausible on screen and wrong in the only way that matters here.
    expect(() => unpack({ ...packed, at: [packed.at[0]] }, KENSINGTON_FRAME)).toThrow(IndexError);
    expect(() => unpack({ ...packed, at: [packed.at[0]] }, KENSINGTON_FRAME)).toThrow(/2 streets and 1 group/);
  });

  it('refuses an index carrying no addresses at all', () => {
    expect(() => unpack({ area: 'x' } as unknown as PackedIndex, KENSINGTON_FRAME)).toThrow(
      IndexError,
    );
  });

  it('moves every address into the frame of the map it will be drawn on', () => {
    /*
     * The defect this exists for, and it was live.
     *
     * The index ships in Kensington's frame and is the one artefact that never
     * comes from the API, so when the API answers with the council the map
     * underneath has a different corner — Kensington's is the council's
     * (1500, 6000). Unshifted, 46 Gatehouse Drive was drawn at (320.5, 640.25)
     * of the council extent: **1.5 km west and 6 km south** of the house
     * somebody typed, on a real street, inside the extent, looking entirely
     * like a map. Nothing on screen could have said otherwise.
     */
    const [first] = unpack(packed, COUNCIL_FRAME).addresses;
    expect([first?.e, first?.n]).toEqual([1820.5, 6640.25]);
  });

  it('leaves them alone when the map is the extent they were measured in', () => {
    // The fallback, which is the normal state between demos. Same extent,
    // zero shift -- and the arithmetic must not introduce a rounding of its own.
    const [first] = unpack(packed, KENSINGTON_FRAME).addresses;
    expect([first?.e, first?.n]).toEqual([320.5, 640.25]);
  });

  it('refuses a map the index does not fit inside, rather than drawing it anyway', () => {
    // A map that does not contain the addressed area is not a map these
    // addresses belong on. Shifting them into it would put houses outside the
    // extent, and every "how far is this pit from your address" would go on
    // answering.
    const tooSmall = { min_e: 316500, min_n: 5814500, width_m: 500, height_m: 500 };
    expect(() => unpack(packed, tooSmall)).toThrow(IndexError);
    expect(() => unpack(packed, tooSmall)).toThrow(/does not fit inside/);
  });

  it('refuses an index that does not say which frame it is in', () => {
    // Rather than assuming it is the map's own, which is true today and is the
    // assumption that produced the defect above.
    const { extent: _dropped, ...frameless } = packed;
    expect(() => unpack(frameless as unknown as PackedIndex, COUNCIL_FRAME)).toThrow(
      /which extent its coordinates are measured from/,
    );
  });

  it('searches what it unpacked', () => {
    // The seam that matters: everything downstream still works on
    // `IndexedAddress`, so unpacking cannot change what a search finds.
    const index = unpack(packed, KENSINGTON_FRAME);
    expect(search(index, '46 gatehouse')[0]?.address.label).toBe(
      '46 Gatehouse Drive, Kensington',
    );
  });
});
