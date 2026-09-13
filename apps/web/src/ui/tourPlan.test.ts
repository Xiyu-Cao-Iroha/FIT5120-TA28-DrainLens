/**
 * What the tour says, and the one thing it is not allowed to say.
 *
 * The steps are copy that defines the interface for somebody meeting it for
 * the first time, so they are reviewed here rather than read once in a
 * screenshot. Where the card goes is in callout.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { TOUR_STEPS } from './tourPlan.js';

describe('what the steps say', () => {
  it('covers every control the prototype numbered, in that order', () => {
    expect(TOUR_STEPS.map((s) => s.target)).toEqual([
      'address',
      'chips',
      'chip-pit',
      'chip-pipe',
      'chip-channel',
      'chip-lowPoint',
      'layers',
    ]);
  });

  it('does not promise where water will go', () => {
    // The prototype's fifth step said "where it will flow to". This product
    // does not forecast, and a tour is where somebody learns what the words on
    // the screen mean -- so it is the worst place to define them more strongly
    // than the rest of the interface does.
    const forecast = /will flow to|will go|predicts?\b|forecast/i;
    for (const step of TOUR_STEPS) expect(step.body).not.toMatch(forecast);
  });

  it('hedges the two calculated layers where the map hedges them', () => {
    const flow = TOUR_STEPS.find((s) => s.target === 'chip-channel');
    const low = TOUR_STEPS.find((s) => s.target === 'chip-lowPoint');
    expect(flow?.body).toMatch(/likely|tends to/i);
    expect(low?.body).toMatch(/indicative/i);
  });
});
