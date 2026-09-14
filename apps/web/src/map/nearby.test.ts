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
  VERY_NEAR_M,
  bearingFrom,
  describeWaterNearby,
  nearestOnLines,
  nearestOnRings,
  waterNearby,
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

  it('gives the nearest point itself, so the direction is to where the distance was measured', () => {
    /*
      The defect this replaced: the direction was taken to the segment's
      middle. Here the nearest point is due north at (0, 10), and the middle of
      the segment, (40, 10), is north-east — a different compass point for the
      same path.
    */
    const near = nearestOnLines([line([[-20, 10], [100, 10]])], [0, 0]);
    expect(near?.at[0]).toBeCloseTo(0);
    expect(near?.at[1]).toBeCloseTo(10);
    expect(bearingFrom([0, 0], near!.at)).toBe('north');
  });

  it('uses an end of the segment when the foot of the perpendicular is past it', () => {
    const near = nearestOnLines([line([[30, 40], [90, 40]])], [0, 0]);
    expect(near?.at).toEqual([30, 40]);
    expect(near?.distanceM).toBeCloseTo(50);
  });
});

describe('nearestOnRings', () => {
  it('measures to the nearest edge, not the nearest corner', () => {
    // A square whose corners are all over 28 m away and whose bottom edge is 20 m.
    const square = ring([[-40, 20], [40, 20], [40, 60], [-40, 60]]);
    const near = nearestOnRings([square], [0, 0]);
    expect(near?.distanceM).toBeCloseTo(20);
    expect(near?.at).toEqual([0, 20]);
  });

  it('includes the edge that closes the ring', () => {
    // The only near edge runs from the last vertex back to the first.
    const open = ring([[-10, 5], [-10, 50], [10, 50], [10, 5]]);
    expect(nearestOnRings([open], [0, 0])?.distanceM).toBeCloseTo(5);
  });

  it('says when the address is inside, rather than measuring to its own boundary', () => {
    const around = ring([[-10, -10], [10, -10], [10, 10], [-10, 10]]);
    const near = nearestOnRings([ring([[100, 100], [110, 100], [110, 110]]), around], [0, 0]);
    expect(near?.inside).toBe(true);
    expect(near?.distanceM).toBe(0);
  });

  it('treats a ring inside a ring as a hole', () => {
    const holed = {
      g: 'polygon' as const,
      c: [
        [[-20, -20], [20, -20], [20, 20], [-20, 20]] as Local[],
        [[-10, -10], [10, -10], [10, 10], [-10, 10]] as Local[],
      ],
    };
    const near = nearestOnRings([holed], [0, 0]);
    expect(near?.inside).toBeUndefined();
    expect(near?.distanceM).toBeCloseTo(10);
  });

  it('returns nothing when there are no low areas', () => {
    expect(nearestOnRings([], [0, 0])).toBeNull();
  });
});

describe('describeWaterNearby', () => {
  const at: Local = [500, 500];

  it('names the path and the low area as two separate facts', () => {
    const derived = derivedWith({
      channel: [line([[520, 500], [540, 500]])],
      'low-point': [ring([[500, 560], [510, 560]])],
    });
    const sentence = describeWaterNearby(derived, at)!;
    expect(sentence).toContain('about 20 m to the east');
    expect(sentence).toContain('about 60 m to the north');
    // Nothing measured says the path runs into that low area.
    expect(sentence).not.toMatch(/towards/);
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

  it('gives no distance or direction for a path closer than the very-near limit', () => {
    const derived = derivedWith({ channel: [line([[501, 400], [501, 600]])] });
    const sentence = describeWaterNearby(derived, at)!;
    expect(sentence).toContain('at or very near this address');
    expect(sentence).not.toMatch(/about \d+ m to the/);
  });

  it('gives a distance again at the very-near limit, rounded to ten metres', () => {
    const derived = derivedWith({ channel: [line([[500 + VERY_NEAR_M, 400], [500 + VERY_NEAR_M, 600]])] });
    expect(describeWaterNearby(derived, at)).toContain(`about ${String(DISTANCE_ROUNDING_M)} m to the east`);
  });

  it('says an address inside a low area is inside it', () => {
    const derived = derivedWith({ 'low-point': [ring([[480, 480], [520, 480], [520, 520], [480, 520]])] });
    const near = waterNearby(derived, at);
    expect(near?.low).toEqual({ kind: 'inside' });
    expect(describeWaterNearby(derived, at)).toContain('This address is within a mapped low area');
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
    expect(describeWaterNearby(derived, at)).toMatch(/No mapped low area .* is within 150 m/);
  });

  it('describes a low area on its own when no path is near', () => {
    const derived = derivedWith({ 'low-point': [ring([[500, 540], [510, 540]])] });
    const sentence = describeWaterNearby(derived, at)!;
    expect(sentence).toMatch(/nearest mapped low area, where water may collect/);
    expect(sentence).toContain('to the north');
    expect(sentence).toMatch(/No mapped path .* is within 150 m/);
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
