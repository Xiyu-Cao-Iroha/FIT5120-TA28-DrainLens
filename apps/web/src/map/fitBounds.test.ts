/**
 * Fitting the comparison's view to an address, a drain and a footprint.
 *
 * Checked by where the points land on the canvas, because that is the whole
 * claim: inside the padding, clear of the panel's strip, and never zoomed to
 * street furniture.
 */

import { describe, expect, it } from 'vitest';

import {
  EDGE_PADDING_PX,
  MIN_FIT_ACROSS_M,
  NARROW_PADDING_PX,
  PANEL_WIDTH_PX,
  fitPadding,
  fitPoints,
} from './fitBounds.js';
import { type Bounds, MAX_SCALE, type Local, scaleToContain, toScreen } from './viewport.js';

const KENSINGTON: Bounds = { widthM: 1000, heightM: 1000 };
const COUNCIL: Bounds = { widthM: 8500, heightM: 9000 };

const inside = (point: readonly [number, number], left: number, top: number, right: number, bottom: number) =>
  point[0] >= left - 1e-6 && point[0] <= right + 1e-6 && point[1] >= top - 1e-6 && point[1] <= bottom + 1e-6;

describe('how much of the frame is kept clear', () => {
  it('reserves the panel’s width on the left in step 1, and 80 px elsewhere', () => {
    expect(fitPadding(1280, true)).toEqual({ top: 80, right: 80, bottom: 80, left: 320 });
    expect(PANEL_WIDTH_PX).toBe(320);
    expect(EDGE_PADDING_PX).toBe(80);
  });

  it('keeps 80 px on every side once the panel is beside the map', () => {
    expect(fitPadding(960, false)).toEqual({ top: 80, right: 80, bottom: 80, left: 80 });
  });

  it('reserves nothing on a phone, where the panel stacks under the map', () => {
    const narrow = fitPadding(375, true);
    expect(narrow).toEqual({
      top: NARROW_PADDING_PX,
      right: NARROW_PADDING_PX,
      bottom: NARROW_PADDING_PX,
      left: NARROW_PADDING_PX,
    });
  });
});

describe('fitting an address and its drain', () => {
  it('puts both inside the padded room, to the right of the panel’s strip', () => {
    const address: Local = [500, 430];
    const drain: Local = [640, 520];
    const padding = fitPadding(1280, true);
    const view = fitPoints(1280, 680, COUNCIL, [address, drain], padding);
    for (const point of [address, drain]) {
      expect(inside(toScreen(view, point), padding.left, padding.top, 1280 - padding.right, 680 - padding.bottom)).toBe(
        true,
      );
    }
  });

  it('touches the room on the tighter axis, so it is a fit and not a guess', () => {
    const view = fitPoints(1280, 680, COUNCIL, [[1000, 1000], [1600, 1100]], fitPadding(1280, true));
    // 600 m across into 1280 - 320 - 80 = 880 px; 180 m minimum tall into 520 px.
    expect(view.scale).toBeCloseTo(Math.min(880 / 600, 520 / 180), 6);
    const [xWest] = toScreen(view, [1000, 1000]);
    const [xEast] = toScreen(view, [1600, 1100]);
    expect(xWest).toBeCloseTo(320, 6);
    expect(xEast).toBeCloseTo(1200, 6);
  });

  it('never zooms a close pair in past the minimum extent', () => {
    const view = fitPoints(1280, 680, COUNCIL, [[3000, 3000], [3012, 3004]], fitPadding(1280, true));
    const acrossM = (1280 - 400) / view.scale;
    expect(acrossM).toBeGreaterThanOrEqual(MIN_FIT_ACROSS_M - 1e-6);
    expect(view.scale).toBeLessThanOrEqual(MAX_SCALE);
  });

  it('centres a single point in the room, for a drain opened from the full map', () => {
    const view = fitPoints(960, 600, COUNCIL, [[4000, 4000]], fitPadding(960, false));
    const [x, y] = toScreen(view, [4000, 4000]);
    expect(x).toBeCloseTo(480, 6);
    expect(y).toBeCloseTo(300, 6);
  });

  it('stays inside the extent near its edge, like every other view', () => {
    const view = fitPoints(1280, 680, KENSINGTON, [[5, 5], [20, 30]], fitPadding(1280, true));
    const halfW = 1280 / 2 / view.scale;
    const halfH = 680 / 2 / view.scale;
    expect(view.centre[0]).toBeGreaterThanOrEqual(halfW - 1e-6);
    expect(view.centre[1]).toBeGreaterThanOrEqual(halfH - 1e-6);
  });

  it('refits to the address, drain and whole footprint when the result returns', () => {
    const footprint: Local[] = [[700, 700], [900, 820]];
    const points: Local[] = [[500, 430], [640, 520], ...footprint];
    const view = fitPoints(960, 680, COUNCIL, points, fitPadding(960, false));
    for (const point of points) {
      expect(inside(toScreen(view, point), 80, 80, 880, 600)).toBe(true);
    }
  });

  it('does not zoom out past the whole extent for a footprint larger than the map', () => {
    const view = fitPoints(800, 800, KENSINGTON, [[-500, -500], [1500, 1500]], fitPadding(800, false));
    expect(view.scale).toBeCloseTo(scaleToContain(800, 800, KENSINGTON), 6);
  });

  it('shrinks padding that would leave almost no room', () => {
    const padding = { top: 80, right: 80, bottom: 80, left: 320 };
    const view = fitPoints(420, 200, COUNCIL, [[2000, 2000], [2100, 2000]], padding);
    const [xWest] = toScreen(view, [2000, 2000]);
    const [xEast] = toScreen(view, [2100, 2000]);
    expect(xWest).toBeGreaterThan(0);
    expect(xEast).toBeLessThan(420);
    expect(xEast - xWest).toBeGreaterThan(0);
  });

  it('shows the whole extent when there is nothing to fit', () => {
    const view = fitPoints(800, 800, KENSINGTON, [], fitPadding(800, false));
    expect(view.centre).toEqual([500, 500]);
    expect(view.scale).toBeCloseTo(0.8, 6);
  });
});
