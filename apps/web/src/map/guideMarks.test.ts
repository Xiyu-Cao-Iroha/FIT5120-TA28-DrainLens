/**
 * Where the guide's marks land on the canvas, including when their point has
 * been dragged off it.
 */

import { describe, expect, it } from 'vitest';

import { linePath, placeMarker } from './guideMarks.js';
import type { Viewport } from './viewport.js';

const view: Viewport = { widthPx: 400, heightPx: 200, scale: 2, centre: [100, 100] };

describe('a marker', () => {
  it('stands on its point while the point is on the canvas', () => {
    expect(placeMarker(view, [100, 100], 10)).toEqual({ x: 200, y: 100, inside: true, towards: 0 });
    expect(placeMarker(view, [0, 50], 10)).toEqual({ x: 0, y: 200, inside: true, towards: 0 });
  });

  it('is pinned inside the edge the point went past, pointing at it', () => {
    // Far off the right edge, level with the centre.
    expect(placeMarker(view, [300, 100], 10)).toEqual({ x: 390, y: 100, inside: false, towards: 0 });
    // Due north, off the top.
    const north = placeMarker(view, [100, 400], 10);
    expect(north.inside).toBe(false);
    expect(north.x).toBeCloseTo(200);
    expect(north.y).toBeCloseTo(10);
    expect(north.towards).toBeCloseTo(-Math.PI / 2);
    // Off a corner: whichever inset edge the ray meets first.
    const corner = placeMarker(view, [400, -200], 10);
    expect(corner.inside).toBe(false);
    expect(corner.x).toBeLessThanOrEqual(390);
    expect(corner.y).toBeCloseTo(190);
  });

  it('stays on the canvas when the inset is larger than the canvas', () => {
    const tiny: Viewport = { ...view, widthPx: 10, heightPx: 10 };
    expect(placeMarker(tiny, [300, 100], 20)).toMatchObject({ x: 5, y: 5, inside: false });
  });
});

describe('a line', () => {
  it('is a path through the projected points', () => {
    expect(
      linePath(view, [
        [100, 100],
        [110, 95],
      ]),
    ).toBe('M200.0 100.0 L220.0 110.0');
    expect(linePath(view, [])).toBe('');
  });
});
