/**
 * What the street-drains list is allowed to claim.
 *
 * Two of these are the panel's whole honesty. **Every drain inside the ring is
 * in the list**, because its first sentence says so and a list that quietly
 * dropped one would be the shortlist it promises not to be. And **a drain is
 * named only from an address within 30 m**, because *Drain near 30 Gatehouse
 * Drive* is this product joining two records and the join has to be one a
 * reader could check by standing there.
 */

import { describe, expect, it } from 'vitest';

import {
  DRAIN_RADIUS_M,
  NAMED_GROUPS,
  STREET_MATCH_M,
  hasOwnStreet,
  streetDrains,
} from './nearby.js';
import type { AddressIndex, IndexedAddress } from '../address/search.js';
import type { MapArtefact } from '../map/artefact.js';
import type { Local } from '../map/viewport.js';

const HOME: Local = [500, 500];

const pit = (assetNumber: number, c: Local) => ({ kind: 'point' as const, c, asset_number: assetNumber });

const mapOf = (pits: readonly ReturnType<typeof pit>[]): MapArtefact =>
  ({
    artefact: 'map-geometry',
    version: 1,
    extent: { name: 'test', min_e: 0, min_n: 0, width_m: 2000, height_m: 2000 },
    coordinates: 'metres from the corner',
    crs: 'EPSG:28355',
    sources: [],
    layers: { pit: pits },
  }) as unknown as MapArtefact;

const at = (number: string, street: string, e: number, n: number): IndexedAddress => ({
  id: `${number}-${street}`,
  label: `${number} ${street}, Kensington`,
  number,
  street,
  suburb: 'Kensington',
  e,
  n,
  at: 0,
});

const indexOf = (addresses: readonly IndexedAddress[]): AddressIndex =>
  ({ area: 'test', addresses }) as AddressIndex;

describe('which drains are in the list', () => {
  it('holds every recorded drain inside the ring and none outside it', () => {
    const found = streetDrains(
      mapOf([
        pit(1, [510, 500]),
        pit(2, [500, 500 + DRAIN_RADIUS_M - 1]),
        pit(3, [500, 500 + DRAIN_RADIUS_M + 1]),
      ]),
      indexOf([]),
      HOME,
      null,
    );
    expect(found.total).toBe(2);
    expect(found.groups.flatMap((group) => group.drains).map((drain) => drain.id)).toEqual(['1', '2']);
  });

  it('leaves out a drain with no asset number, which nothing could report', () => {
    const nameless = { kind: 'point' as const, c: [505, 500] as Local };
    const found = streetDrains(
      mapOf([pit(1, [510, 500]), nameless as ReturnType<typeof pit>]),
      indexOf([]),
      HOME,
      null,
    );
    expect(found.total).toBe(1);
  });
});

describe('what a drain is called', () => {
  const index = indexOf([at('30', 'Gatehouse Drive', 510, 500), at('3', 'Westbourne Road', 700, 500)]);

  it('takes the street of the address it is nearest to', () => {
    const found = streetDrains(mapOf([pit(1, [512, 500])]), index, HOME, 'Gatehouse Drive');
    expect(found.groups[0]?.drains[0]?.label).toBe('Drain near 30 Gatehouse Drive');
    expect(found.groups[0]?.street).toBe('Gatehouse Drive');
  });

  it('takes no street at all past 30 m, and keeps its own record instead', () => {
    // The nearest house is then across a back fence or on the next street,
    // and the name would be wrong in a way the reader cannot check.
    const found = streetDrains(mapOf([pit(9001, [510 + STREET_MATCH_M + 5, 500])]), index, HOME, null);
    const drain = found.groups[0]?.drains[0];
    expect(drain?.street).toBeNull();
    expect(drain?.label).toBe('Recorded drain 9001');
  });

  it('puts the unnamed drains in their own group, last', () => {
    const found = streetDrains(
      mapOf([pit(1, [512, 500]), pit(2, [640, 640])]),
      index,
      HOME,
      'Gatehouse Drive',
    );
    expect(found.groups.at(-1)?.street).toBeNull();
    expect(found.groups.at(-1)?.drains).toHaveLength(1);
  });
});

describe('the order the groups are read in', () => {
  const index = indexOf([
    at('30', 'Gatehouse Drive', 510, 500),
    at('3', 'Westbourne Road', 600, 500),
    at('7', 'Westbourne Road', 610, 500),
    at('11', 'Westbourne Road', 620, 500),
    at('2', 'Moylan Lane', 560, 560),
  ]);

  const found = streetDrains(
    mapOf([pit(1, [511, 500]), pit(2, [601, 500]), pit(3, [611, 500]), pit(4, [621, 500]), pit(5, [561, 560])]),
    index,
    HOME,
    'Gatehouse Drive',
  );

  it('puts the reader’s own street first, whatever its size', () => {
    // Westbourne Road has three drains to Gatehouse Drive's one, and the
    // reader is not looking for the biggest street.
    expect(found.groups[0]?.street).toBe('Gatehouse Drive');
    expect(found.groups[0]?.yours).toBe(true);
    expect(hasOwnStreet(found)).toBe(true);
  });

  it('then the streets with the most drains, which is where a name helps', () => {
    expect(found.groups.slice(1).map((group) => group.street)).toEqual(['Westbourne Road', 'Moylan Lane']);
  });

  it('puts the largest first where the reader’s street holds none', () => {
    const none = streetDrains(
      mapOf([pit(2, [601, 500]), pit(3, [611, 500]), pit(5, [561, 560])]),
      index,
      HOME,
      'Gatehouse Drive',
    );
    expect(hasOwnStreet(none)).toBe(false);
    expect(none.groups[0]?.street).toBe('Westbourne Road');
  });

  it('reads a street in house-number order, so it can be walked', () => {
    const westbourne = found.groups.find((group) => group.street === 'Westbourne Road');
    expect(westbourne?.drains.map((drain) => drain.number)).toEqual([3, 7, 11]);
  });
});

describe('the roll-up', () => {
  it('names four streets and rolls the rest up', () => {
    // Four is what the design draws: one open and three closed. The number is
    // exported so the panel and this test cannot disagree about it.
    expect(NAMED_GROUPS).toBe(4);
  });
});
