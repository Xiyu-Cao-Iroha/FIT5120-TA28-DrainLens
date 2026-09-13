/**
 * The figure and the sentence are two readings of one measurement, and these
 * are the checks that keep them from becoming two measurements.
 *
 * The failure worth preventing is not a wrong arrow — a wrong arrow is
 * obvious. It is an arrow that is right and a caption that is right about
 * something slightly different: an unrounded bearing under a rounded word, or
 * a raw distance beside a label reading "about 30 m".
 */

import { describe, expect, it } from 'vitest';

import {
  COMPASS_ANGLE,
  DISTANCE_ROUNDING_M,
  RELEVANT_RADIUS_M,
  type WaterNearby,
  describe as sentence,
  waterNearby,
} from './nearby.js';
import type { DerivedArtefact } from './derived.js';

const artefact = (
  channels: readonly (readonly [number, number])[][],
  lows: readonly (readonly [number, number])[][],
): DerivedArtefact =>
  ({
    layers: {
      channel: channels.map((c) => ({ g: 'line', c })),
      'low-point': lows.map((ring) => ({ g: 'polygon', c: [ring] })),
    },
  }) as unknown as DerivedArtefact;

describe('the angles the figure draws', () => {
  it('has one for every compass point the sentence can say', () => {
    expect(Object.keys(COMPASS_ANGLE)).toHaveLength(8);
  });

  it('puts north up and east right, in the map frame', () => {
    expect(COMPASS_ANGLE.east).toBe(0);
    expect(COMPASS_ANGLE.north).toBe(90);
    expect(COMPASS_ANGLE.west).toBe(180);
    expect(COMPASS_ANGLE.south).toBe(270);
  });

  it('spaces them evenly, so an eighth is an eighth', () => {
    const angles = Object.values(COMPASS_ANGLE).sort((a, b) => a - b);
    expect(angles).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });
});

describe('what the figure is given', () => {
  it('carries the rounded distance, not the measured one', () => {
    // 34 m becomes "about 30 m" in the sentence. A figure handed 34 would
    // label an arrow with a number the caption says we do not have.
    const near = waterNearby(artefact([[[34, 0], [34, 10]]], []), [0, 0]);
    expect(near?.channel?.distanceM).toBe(30);
    expect(near?.channel?.distanceM! % DISTANCE_ROUNDING_M).toBe(0);
  });

  it('never reports zero metres for something a metre away', () => {
    // `roughly` floors at the rounding step: "0 m away" would read as being
    // on top of it, and the measurement cannot support that.
    const near = waterNearby(artefact([[[1, 0], [1, 4]]], []), [0, 0]);
    expect(near?.channel?.distanceM).toBe(DISTANCE_ROUNDING_M);
  });

  it('carries the bearing as one of the eight, so the arrow has an angle', () => {
    const near = waterNearby(artefact([[[0, 40], [10, 40]]], []), [0, 0]);
    expect(near?.channel?.bearing).toBeDefined();
    expect(COMPASS_ANGLE[near!.channel!.bearing]).toBeTypeOf('number');
  });

  it('says nothing at all when nothing is within the radius', () => {
    const far = RELEVANT_RADIUS_M + 50;
    expect(waterNearby(artefact([[[far, 0], [far, 10]]], []), [0, 0])).toBeNull();
  });

  it('reports one side when only one is near', () => {
    const near = waterNearby(artefact([[[20, 0], [20, 10]]], []), [0, 0]);
    expect(near?.channel).not.toBeNull();
    expect(near?.low).toBeNull();
  });
});

describe('the sentence and the figure agree', () => {
  const both: WaterNearby = {
    channel: { distanceM: 30, bearing: 'north-west' },
    low: { distanceM: 40, bearing: 'south-east' },
  };

  it('reads the same numbers the arrows are drawn with', () => {
    const said = sentence(both);
    expect(said).toContain('30 m');
    expect(said).toContain('north-west');
    expect(said).toContain('40 m');
    expect(said).toContain('south-east');
  });

  it('still says a low area was not found when there is no second arrow', () => {
    const said = sentence({ channel: both.channel, low: null });
    expect(said).toContain('No low area');
  });

  it('describes a low area on its own when there is no path', () => {
    const said = sentence({ channel: null, low: both.low });
    expect(said).toContain('low area');
    expect(said).toContain('40 m');
  });
});
