/**
 * Reading the drainage area off the published answer, not working it out.
 *
 * The browser has the boundaries and the address and could test one against
 * the other. It would be wrong for the 287 addresses nearest a boundary, which
 * is why the answer is published and this module only looks it up — and why
 * the lookup is keyed by the published position rather than by counting what
 * survived the Kensington clip.
 */

import { describe, expect, it } from 'vitest';

import {
  type AddressCatchmentsArtefact,
  type SubcatchmentsArtefact,
  CatchmentError,
  areaFor,
  areaNumberFor,
  assertAddressCatchments,
  assertSubcatchments,
  loadCatchments,
  streetKey,
} from './artefact.js';
import type { IndexedAddress } from '../address/search.js';

const address = (over: Partial<IndexedAddress> = {}): IndexedAddress => ({
  id: 'com:46-gatehouse-drive-kensington',
  label: '46 Gatehouse Drive, Kensington',
  number: '46',
  street: 'Gatehouse Drive',
  suburb: 'Kensington',
  e: 307,
  n: 649,
  at: 0,
  ...over,
});

const areas = (over: Partial<SubcatchmentsArtefact> = {}): SubcatchmentsArtefact => ({
  artefact: 'subcatchments',
  version: 1,
  note: 'areas',
  extent: { min_e: 315_000, min_n: 5_808_500 },
  source: { publisher: 'Melbourne Water Corporation', licence: 'CC BY 4.0', dataset: 'Subcatchments' },
  coverage: 'City of Melbourne data only.',
  areas: [
    {
      number: '4312',
      name: 'ARDEN ST DRAIN',
      displayName: 'Arden Street Drain',
      class: 'unclassified',
      rings: [[[0, 0], [10, 0], [10, 10]]],
      lastUpdated: '2013-11-20',
      areaSqKm: 2.49,
      summary: { pits: 1679, pipeLengthM: 30_200, lowAreas: 532, coverage: 0.998 },
    },
    {
      number: '4400',
      name: 'YARRA RIVER (MOUTH TO MERRI)',
      displayName: 'Yarra River (Mouth to Merri)',
      class: 'unclassified',
      rings: [[[0, 0], [20, 0], [20, 20]]],
    },
  ],
  ...over,
});

const assignment = (over: Partial<AddressCatchmentsArtefact> = {}): AddressCatchmentsArtefact => ({
  artefact: 'address-catchments',
  version: 1,
  numbers: ['4312', '4400'],
  streets: {
    'Gatehouse Drive|Kensington': { n: 3, a: 0 },
    'Long Road|Kensington': { n: 3, a: [0, -1, 1] },
  },
  ...over,
});

describe('reading an address’s drainage area', () => {
  it('uses the street and the published position', () => {
    const at = (position: number) =>
      areaNumberFor(assignment(), address({ street: 'Long Road', at: position }));
    expect(at(0)).toBe('4312');
    expect(at(2)).toBe('4400');
  });

  it('gives the same area to every address on a street wholly inside one', () => {
    for (const at of [0, 1, 2]) {
      expect(areaNumberFor(assignment(), address({ at }))).toBe('4312');
    }
  });

  it('answers null where no recorded area contains the address', () => {
    // 5 Webb Dock is the council's one, and AC 6.1.5 forbids substituting the
    // nearest area for it.
    expect(areaNumberFor(assignment(), address({ street: 'Long Road', at: 1 }))).toBeNull();
  });

  it('answers null for a street the assignment has never heard of', () => {
    expect(areaNumberFor(assignment(), address({ street: 'Nowhere Street' }))).toBeNull();
  });

  it('answers null with no address or no assignment', () => {
    expect(areaNumberFor(assignment(), null)).toBeNull();
    expect(areaNumberFor(null, address())).toBeNull();
  });

  it('finds the area itself, with its name and record date', () => {
    const found = areaFor(areas(), assignment(), address());
    expect(found?.displayName).toBe('Arden Street Drain');
    expect(found?.lastUpdated).toBe('2013-11-20');
  });

  it('is null where the area number names an area the file does not carry', () => {
    expect(areaFor(areas(), assignment({ numbers: ['9999', '4400'] }), address())).toBeNull();
  });

  it('keys streets the way both files write them', () => {
    expect(streetKey(address())).toBe('Gatehouse Drive|Kensington');
  });
});

describe('refusing a file that is not what it claims', () => {
  it('refuses areas with a receiving class that is not one of the four', () => {
    const broken = areas({
      areas: [{ ...areas().areas[0]!, class: 'melbourne-water' as never }],
    });
    expect(() => {
      assertSubcatchments(broken);
    }).toThrow(CatchmentError);
  });

  it('refuses areas with no boundary or no name', () => {
    expect(() => {
      assertSubcatchments(areas({ areas: [{ ...areas().areas[0]!, rings: [] }] }));
    }).toThrow(CatchmentError);
    expect(() => {
      assertSubcatchments(areas({ areas: [{ ...areas().areas[0]!, displayName: '' }] }));
    }).toThrow(CatchmentError);
  });

  it('refuses a file that does not say what its counts cover', () => {
    // AC 6.1.3 asks for that sentence, and a card without it reads as a
    // complete count of an area we hold part of.
    expect(() => {
      assertSubcatchments(areas({ coverage: '' }));
    }).toThrow(CatchmentError);
  });

  it('refuses an assignment with no areas or no streets', () => {
    expect(() => {
      assertAddressCatchments(assignment({ numbers: [] }));
    }).toThrow(CatchmentError);
    expect(() => {
      assertAddressCatchments({ artefact: 'address-catchments', version: 1, numbers: ['1'] });
    }).toThrow(CatchmentError);
  });
});

describe('against the published files', () => {
  const published = async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { unpack } = await import('../address/search.js');
    const read = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const data = (name: string) => read(path.resolve(__dirname, '../../public/data', name));
    // The council map, which is the frame the published assignment was built in.
    const map = read(path.resolve(__dirname, '../../../api/data/city-of-melbourne/map.json')) as {
      extent: { min_e: number; min_n: number; width_m: number; height_m: number };
    };
    const index = unpack(data('addresses.json') as never, map.extent);
    const areasFile = data('subcatchments.json');
    const assignmentFile = data('address-catchments.json');
    assertSubcatchments(areasFile);
    assertAddressCatchments(assignmentFile);
    return { index, areasFile, assignmentFile };
  };

  it('gives every published address an area or an honest none', async () => {
    const { index, areasFile, assignmentFile } = await published();
    let none = 0;
    for (const entry of index.addresses) {
      const found = areaFor(areasFile, assignmentFile, entry);
      if (found === null) none += 1;
    }
    // 5 Webb Dock, Port Melbourne is the one the pipeline found inside no
    // recorded area, and it is published as having none.
    expect(none).toBe(1);
  }, 30_000);

  it('reads the demonstration addresses’ own areas', async () => {
    const { index, areasFile, assignmentFile } = await published();
    const find = (label: string) => index.addresses.find((a) => a.label === label) ?? null;
    const gatehouse = areaFor(areasFile, assignmentFile, find('46 Gatehouse Drive, Kensington'));
    const market = areaFor(areasFile, assignmentFile, find('89 Market Street, Kensington'));
    const dock = areaFor(areasFile, assignmentFile, find('5 Webb Dock, Port Melbourne'));
    // Both Kensington addresses are in 4220, confirmed against the pipeline's
    // own containment test over the service geometry rather than read off this
    // lookup — the point of the published answer is that it can be checked.
    expect(gatehouse?.number).toBe('4220');
    expect(gatehouse?.displayName).toBe('Maribyrnong River (Lower)');
    expect(market?.number).toBe('4220');
    expect(dock).toBeNull();
    // Nothing is approved yet, so every address reads the unconfirmed sentence.
    expect(gatehouse?.class).toBe('unclassified');
  }, 30_000);
});

describe('loading both files', () => {
  it('returns them when both are what they claim', async () => {
    const loaded = await loadCatchments('a', 'b', async (url) =>
      url === 'a' ? areas() : assignment(),
    );
    expect(loaded?.areas.areas).toHaveLength(2);
    expect(loaded?.assignment.numbers).toEqual(['4312', '4400']);
  });

  it('is null when either is missing or broken, rather than throwing', async () => {
    // The rest of the product works without a drainage area; a map that fails
    // to load because one file is late is a worse answer than no area.
    expect(await loadCatchments('a', 'b', () => Promise.reject(new Error('offline')))).toBeNull();
    expect(
      await loadCatchments('a', 'b', async (url) => (url === 'a' ? areas() : { artefact: 'nope' })),
    ).toBeNull();
  });
});
