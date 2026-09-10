/**
 * When there are too many pits on screen to be pits.
 *
 * The threshold has to pass one test above all others: Kensington's 895 drains
 * over a square kilometre are legible today, and any rule that hides them is
 * a rule that broke the shipped product to fix the CBD.
 */

import { describe, expect, it } from 'vitest';

import { LEGIBLE_SPACING_PX, countInView, legibility, pitLimitFor } from './legibility.js';
import { type Bounds, type Local, fit } from './viewport.js';

const KENSINGTON: Bounds = { widthM: 1000, heightM: 1000 };
/** A laptop's map area, which is what the measurements were taken against. */
const view = { ...fit(1080, 775, KENSINGTON), widthPx: 1080, heightPx: 775 };

/**
 * `n` points spread evenly across what is actually on screen.
 *
 * Across the *view*, not across the extent. `fit` covers rather than
 * letterboxes -- its scale is the larger of the two ratios -- so a 1000 m
 * square in a 1080 x 775 window is cropped top and bottom, and points laid out
 * over the extent would put a third of themselves off screen. A helper that
 * quietly did that would make every count here a different number from the one
 * being reasoned about.
 */
const spread = (n: number): Local[] => {
  const side = Math.ceil(Math.sqrt(n));
  // The view covers 1000 m across and 775/1.08 = 718 m down, centred on 500.
  const halfN = 775 / view.scale / 2;
  return Array.from({ length: n }, (_, i) => [
    ((i % side) + 0.5) * (1000 / side),
    500 - halfN + ((Math.floor(i / side) + 0.5) * (2 * halfN)) / side,
  ]);
};

describe('how many marks a screen can separate', () => {
  it('is the screen divided by the closest two marks can sit', () => {
    expect(pitLimitFor(view)).toBe(Math.round((1080 * 775) / LEGIBLE_SPACING_PX ** 2));
  });

  it('comes to about 1,400 on a laptop map', () => {
    // The number the table in `legibility.ts` was read against. If this moves,
    // the measurements beside it no longer describe what the code does.
    expect(pitLimitFor(view)).toBe(1453);
  });

  it('scales with the map, because a phone is not a laptop', () => {
    expect(pitLimitFor({ ...view, widthPx: 375, heightPx: 600 })).toBeLessThan(pitLimitFor(view));
  });
});

describe('counting what is in view', () => {
  it('counts a point inside the frame', () => {
    expect(countInView([[500, 500]], view)).toBe(1);
  });

  it('does not count what is off the edge', () => {
    // The whole point of counting in screen space: the same pit is in view at
    // one pan position and not at another.
    expect(countInView([[-5000, -5000]], view)).toBe(0);
  });

  it('counts nothing from an empty layer', () => {
    expect(countInView([], view)).toBe(0);
  });
});

describe('whether the pits can be drawn as pits', () => {
  it('draws Kensington, which is the test any threshold here has to pass', () => {
    // 895 drains over a square kilometre, 31 pixels apart. They are legible
    // today and a rule that hid them would have broken the shipped product.
    const kensington = legibility(spread(895), view);
    expect(kensington.drawPits).toBe(true);
    expect(kensington.inView).toBe(895);
    expect(kensington.inView).toBeLessThan(kensington.limit);
  });

  it('refuses the CBD at the same zoom, which is the case it exists for', () => {
    // 1,950 in the densest square kilometre: 21 pixels apart, inside one
    // another's 36-pixel tap targets. Pressing one would be a coin toss.
    expect(legibility(spread(1950), view).drawPits).toBe(false);
  });

  it('refuses the full council view outright', () => {
    expect(legibility(spread(18_840), view).drawPits).toBe(false);
  });

  it('reports the count, not just the refusal', () => {
    // "There are eighteen thousand of them here" and "something is wrong" are
    // different things to be told, and only one of them is true.
    const crowded = legibility(spread(5288), view);
    expect(crowded.inView).toBe(5288);
    expect(crowded.limit).toBeGreaterThan(0);
    expect(crowded.drawPits).toBe(false);
  });

  it('draws them while there is no viewport yet', () => {
    // Before the first layout there is nothing to count and nothing on screen
    // either. Refusing here would flash an explanation at somebody about a map
    // that has not been drawn.
    expect(legibility(spread(50_000), null).drawPits).toBe(true);
  });

  it('decides on what is in view rather than on how many exist', () => {
    // 21,113 pits in the artefact and three on screen is a drawable map. A
    // rule that counted the layer would have hidden them.
    const far: Local[] = [...spread(3), ...Array.from({ length: 21_110 }, () => [-9e5, -9e5] as Local)];
    expect(legibility(far, view).drawPits).toBe(true);
    expect(legibility(far, view).inView).toBe(3);
  });
});
