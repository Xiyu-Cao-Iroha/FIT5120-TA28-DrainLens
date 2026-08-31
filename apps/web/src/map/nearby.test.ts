/**
 * Tests for the sentence about where water near an address may move.
 *
 * The wording is the subject. Every assertion below is about a claim the
 * sentence would be making — the modality, the precision, and whether it says
 * anything at all when there is nothing near enough to say it about.
 */

import { describe, expect, it } from 'vitest';

import type { DerivedArtefact } from './derived.js';
import type { Local } from './viewport.js';
import {
  DISTANCE_ROUNDING_M,
  NEARBY_BASIS,
  RELEVANT_RADIUS_M,
  bearingFrom,
  describeWaterNearby,
  nearestOnLines,
  nearestOnRings,
} from './nearby.js';

function derivedWith(layers: Partial<DerivedArtefact['layers']>): DerivedArtefact {
  return {
    artefact: 'derived-layers',
    version: 1,
    basis: 'derived',
    extent: { name: 'test', width_m: 1000, height_m: 1000 },
    coordinates: 'metres',
    note: 'derived from a filtered photogrammetric surface',
    layers: { channel: [], 'low-point': [], unavailable: [], ...layers },
  } as unknown as DerivedArtefact;
}

const line = (c: Local[]) => ({ g: 'line' as const, c });
const ring = (c: Local[]) => ({ g: 'polygon' as const, c: [c] });

describe('bearingFrom', () => {
  it('reads north as up the map, not down the canvas', () => {
    // The frame is the artefact's: east is +x and north is +y. Getting this
    // backwards sends every reader in the opposite direction.
    expect(bearingFrom([0, 0], [0, 10])).toBe('north');
    expect(bearingFrom([0, 0], [0, -10])).toBe('south');
    expect(bearingFrom([0, 0], [10, 0])).toBe('east');
    expect(bearingFrom([0, 0], [-10, 0])).toBe('west');
  });

  it('gives the diagonals', () => {
    expect(bearingFrom([0, 0], [10, 10])).toBe('north-east');
    expect(bearingFrom([0, 0], [-10, -10])).toBe('south-west');
  });

  it('rounds to the nearest eighth rather than inventing a finer one', () => {
    expect(bearingFrom([0, 0], [10, 1])).toBe('east');
    expect(bearingFrom([0, 0], [10, 7])).toBe('north-east');
  });
});

describe('nearestOnLines', () => {
  it('measures to the segment, not only to its vertices', () => {
    // A path running past an address at 5 m is 5 m away even when both of its
    // vertices are 50 m off.
    const near = nearestOnLines([line([[-50, 5], [50, 5]])], [0, 0]);
    expect(near?.distanceM).toBeCloseTo(5);
  });

  it('finds the closest of several paths', () => {
    const near = nearestOnLines([line([[0, 100], [10, 100]]), line([[0, 20], [10, 20]])], [0, 0]);
    expect(near?.distanceM).toBeCloseTo(20);
  });

  it('returns nothing when there are no paths', () => {
    expect(nearestOnLines([], [0, 0])).toBeNull();
    expect(nearestOnLines([line([[1, 1]])], [0, 0])).toBeNull();
  });

  it('survives a segment of zero length', () => {
    expect(nearestOnLines([line([[3, 4], [3, 4]])], [0, 0])?.distanceM).toBeCloseTo(5);
  });
});

describe('nearestOnRings', () => {
  it('finds the closest vertex of the closest ring', () => {
    const near = nearestOnRings([ring([[0, 30], [10, 30]]), ring([[0, 12], [4, 14]])], [0, 0]);
    expect(near?.distanceM).toBeCloseTo(12);
  });

  it('returns nothing when there are no low areas', () => {
    expect(nearestOnRings([], [0, 0])).toBeNull();
  });
});

describe('describeWaterNearby', () => {
  const at: Local = [500, 500];

  it('names both the path and the low area it runs towards', () => {
    const derived = derivedWith({
      channel: [line([[520, 500], [540, 500]])],
      'low-point': [ring([[500, 560], [510, 560]])],
    });
    const sentence = describeWaterNearby(derived, at)!;
    expect(sentence).toContain('to the east');
    expect(sentence).toContain('to the north');
    expect(sentence).toMatch(/low area/);
  });

  it('says "may", never "will"', () => {
    // These layers are derived from a filtered surface. They say where water
    // runs downhill on it, which is not a forecast.
    const derived = derivedWith({ channel: [line([[520, 500], [540, 500]])] });
    const sentence = describeWaterNearby(derived, at)!;
    expect(sentence).toMatch(/\bmay\b/);
    expect(sentence).not.toMatch(/\bwill\b|\bgoes\b|\bflows to\b/);
  });

  it('rounds distances to ten metres rather than claiming a finer figure', () => {
    const derived = derivedWith({ channel: [line([[537, 500], [560, 500]])] });
    const sentence = describeWaterNearby(derived, at)!;
    expect(sentence).toContain('about 40 m');
    expect(sentence).not.toContain('37');
  });

  it('never rounds a nearby path down to zero metres', () => {
    const derived = derivedWith({ channel: [line([[501, 500], [520, 500]])] });
    expect(describeWaterNearby(derived, at)).toContain(`about ${DISTANCE_ROUNDING_M} m`);
  });

  it('says nothing at all when nothing derived is near enough', () => {
    // A sentence about a path 400 m away is about somebody else's street.
    const derived = derivedWith({ channel: [line([[900, 900], [950, 950]])] });
    expect(describeWaterNearby(derived, at)).toBeNull();
  });

  it('says nothing when the artefact carries no derived layers', () => {
    expect(describeWaterNearby(derivedWith({}), at)).toBeNull();
  });

  it('admits it when a path is near but no low area was measured', () => {
    const derived = derivedWith({ channel: [line([[520, 500], [540, 500]])] });
    expect(describeWaterNearby(derived, at)).toMatch(/No low area .* was measured nearby/);
  });

  it('describes a low area on its own when no path is near', () => {
    const derived = derivedWith({ 'low-point': [ring([[500, 540], [510, 540]])] });
    const sentence = describeWaterNearby(derived, at)!;
    expect(sentence).toMatch(/low area where surface water may collect/);
    expect(sentence).toContain('to the north');
  });

  it('treats the relevance radius as the boundary it claims to be', () => {
    const inside = derivedWith({ channel: [line([[500 + RELEVANT_RADIUS_M - 1, 500], [700, 500]])] });
    const outside = derivedWith({ channel: [line([[500 + RELEVANT_RADIUS_M + 1, 500], [700, 500]])] });
    expect(describeWaterNearby(inside, at)).not.toBeNull();
    expect(describeWaterNearby(outside, at)).toBeNull();
  });

  it('claims nothing about depth, timing or flooding', () => {
    const derived = derivedWith({
      channel: [line([[520, 500], [540, 500]])],
      'low-point': [ring([[500, 560], [510, 560]])],
    });
    const sentence = describeWaterNearby(derived, at)!.toLowerCase();
    expect(sentence).not.toMatch(/flood|deep|depth|hours|minutes|during|when it rains/);
  });

  it('is labelled as derived, not as recorded', () => {
    expect(NEARBY_BASIS).toBe('System-derived result');
  });
});
