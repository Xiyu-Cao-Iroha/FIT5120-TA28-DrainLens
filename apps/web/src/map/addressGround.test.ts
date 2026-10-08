/**
 * Which way the ground falls around an address, and how the card says it.
 *
 * The wording is the claim. These check that the ground, the water path and the
 * low area stay three separate facts, that "unclear" and "too near the edge"
 * are told apart, and that the figure writes down whatever it cannot point at.
 */

import { describe, expect, it } from 'vitest';

import {
  AddressGroundError,
  type GroundTrend,
  STEEP_FALL_M,
  assertAddressGround,
  describeAddress,
  describeGround,
  groundAt,
  isSteep,
  loadAddressGround,
  metresOf,
  trendOf,
} from './addressGround.js';
import { COMPASS_ANGLE, type NearbyThing, type WaterNearby } from './nearby.js';

const artefact = {
  artefact: 'address-ground' as const,
  version: 2 as const,
  area: 'kensington',
  settings: { areaAcrossM: 150, fallRoundingM: 0.5 },
  on: ['A Street|Kensington', 'No Suburb Lane'],
  at: [['1=NW2', '2=u', '3=x', '4=UP2', '5=bad'], ['7=S5']],
};

describe('reading the artefact', () => {
  it('gives each address its trend, and nothing for an address it does not hold', () => {
    expect(groundAt(artefact, 'kensington/1-a-street-kensington')).toEqual({ kind: 'falls', bearing: 'north-west', fallM: 1 });
    expect(groundAt(artefact, 'kensington/2-a-street-kensington')).toEqual({ kind: 'unclear' });
    expect(groundAt(artefact, 'kensington/3-a-street-kensington')).toEqual({ kind: 'edge' });
    expect(groundAt(artefact, 'nowhere')).toBeNull();
  });

  it('rebuilds the id the address index builds, suburb or none', () => {
    expect(groundAt(artefact, 'kensington/7-no-suburb-lane')).toEqual({ kind: 'falls', bearing: 'south', fallM: 2.5 });
  });

  it('treats a direction that is not a compass point as unclear, not as a direction', () => {
    expect(groundAt(artefact, 'kensington/4-a-street-kensington')).toEqual({ kind: 'unclear' });
    expect(groundAt(artefact, 'kensington/5-a-street-kensington')).toEqual({ kind: 'unclear' });
    expect(trendOf('SE1')).toEqual({ kind: 'falls', bearing: 'south-east', fallM: 0.5 });
    expect(trendOf('NN3', 0.5)).toEqual({ kind: 'unclear' });
  });

  it('refuses something that is not the artefact', async () => {
    expect(() => {
      assertAddressGround({ artefact: 'derived-layers' });
    }).toThrow(AddressGroundError);
    expect(() => {
      assertAddressGround({ ...artefact, version: 1 });
    }).toThrow(/version 1/);
    expect(() => {
      assertAddressGround({ ...artefact, on: [], at: [] });
    }).toThrow(/no addresses/);
    expect(() => {
      assertAddressGround({ ...artefact, at: [[]] });
    }).toThrow(/2 streets and 1 groups/);
    expect(() => {
      assertAddressGround({ ...artefact, area: '' });
    }).toThrow(/which area/);
    expect(() => {
      assertAddressGround({ ...artefact, settings: {} });
    }).toThrow(/how wide/);
    await expect(loadAddressGround('/x', () => Promise.resolve(artefact))).resolves.toBe(artefact);
    await expect(loadAddressGround('/x', () => Promise.resolve({}))).rejects.toThrow(AddressGroundError);
  });
});

describe('what the card says', () => {
  it('says a gentle slope in plain words, and a steep one as steep', () => {
    expect(describeGround({ kind: 'falls', bearing: 'north-west', fallM: 1 })).toBe(
      'The ground around this address slopes gently down to the north-west. The ground level changes by about 1 m across the surrounding 150 m-wide area.',
    );
    expect(describeGround({ kind: 'falls', bearing: 'east', fallM: 8.5 })).toBe(
      'The ground around this address slopes down to the east, and the slope is steep. The ground level changes by about 8.5 m across the surrounding 150 m-wide area.',
    );
  });

  it('calls a slope steep from 1 in 20 across the 150 m area, and not before', () => {
    expect(STEEP_FALL_M / 150).toBe(1 / 20);
    expect(isSteep(7)).toBe(false);
    expect(isSteep(7.5)).toBe(true);
    expect(metresOf(4)).toBe('4');
    expect(metresOf(12.5)).toBe('12.5');
  });

  it('never says "over the next 150 m", which would be a walk rather than an area', () => {
    for (const fallM of [2.5, 15]) {
      const said = describeGround({ kind: 'falls', bearing: 'south', fallM });
      expect(said).not.toMatch(/over the next|towards/);
    }
  });

  it('tells an unclear ground from an address too near the edge of the data', () => {
    expect(describeGround({ kind: 'unclear' })).toBe('No clear downhill direction could be found around this address.');
    expect(describeGround({ kind: 'edge' })).toMatch(/too close to the edge of the measured ground/);
  });

  it('keeps the ground and the water as separate sentences, and joins no cause', () => {
    const water: WaterNearby = {
      channel: { kind: 'direction', distanceM: 10, bearing: 'north-east', angleDeg: 40 },
      low: { kind: 'direction', distanceM: 30, bearing: 'south', angleDeg: 270 },
    };
    const said = describeAddress({ kind: 'falls', bearing: 'north-west', fallM: 1 }, water)!;
    expect(said.startsWith('The ground around this address slopes gently down to the north-west.')).toBe(true);
    expect(said).toContain('about 10 m to the north-east');
    expect(said).toContain('about 30 m to the south');
    expect(said).not.toMatch(/towards/);
    expect(describeAddress(null, null)).toBeNull();
    expect(describeAddress({ kind: 'unclear' }, null)).toMatch(/^No clear downhill direction/);
  });
});
