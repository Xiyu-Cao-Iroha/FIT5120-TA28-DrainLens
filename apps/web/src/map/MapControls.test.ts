/**
 * The scale bar's arithmetic.
 *
 * A bar is only worth drawing if the number on it is one somebody can carry
 * across the map by eye, so it snaps to a round distance that fits rather than
 * reporting whatever width was available. These check that it picks the
 * largest such distance, never overflows, and still draws something when the
 * view is so wide that even the smallest step does not fit.
 */
import { describe, expect, it } from 'vitest';

import { MAX_BAR_PX_FOR_TEST, scaleBar } from './MapControls.js';

describe('choosing a scale bar', () => {
  it('picks the largest round distance that fits', () => {
    // At 1 px/m, 100 m is 100 px and 200 m would be 200 — over the limit.
    expect(scaleBar(1)).toEqual({ metres: 100, widthPx: 100 });
  });

  it('never draws wider than the limit', () => {
    for (const scale of [0.4, 0.9, 1, 1.7, 2.5, 4, 9.3]) {
      expect(scaleBar(scale).widthPx).toBeLessThanOrEqual(MAX_BAR_PX_FOR_TEST);
    }
  });

  it('shortens the distance as the map zooms in', () => {
    // Zoomed in, a hundred metres no longer fits, so a smaller step is used.
    expect(scaleBar(4).metres).toBeLessThan(scaleBar(1).metres);
    expect(scaleBar(1).metres).toBeLessThanOrEqual(scaleBar(0.5).metres);
  });

  it('only ever reports a round number', () => {
    const round = new Set([5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]);
    for (let scale = 0.05; scale < 12; scale += 0.07) {
      expect(round.has(scaleBar(scale).metres)).toBe(true);
    }
  });

  it('still draws a bar when even the smallest step overflows', () => {
    // A view so zoomed in that 5 m is wider than the bar may be. Drawing a
    // slightly long bar labelled honestly beats drawing nothing.
    const tight = scaleBar(1000);
    expect(tight.metres).toBe(5);
    expect(tight.widthPx).toBe(5000);
  });

  it('scales the width with the viewport, not just the label', () => {
    const near = scaleBar(2);
    expect(near.widthPx).toBeCloseTo(near.metres * 2, 6);
  });
});
