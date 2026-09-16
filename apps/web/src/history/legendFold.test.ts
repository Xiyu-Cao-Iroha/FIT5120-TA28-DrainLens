/**
 * The flood map's key: folded or open, and how much of the map it may cover.
 *
 * Checked at both ends of the range and on the boundary, because the claim is
 * about narrowing the window: a phone, the width where it changes, one pixel
 * either side of it, and a desktop.
 */

import { describe, expect, it } from 'vitest';

import {
  LEGEND_INSET_PX,
  LEGEND_MIN_HEIGHT_PX,
  LEGEND_NARROW_FRAME_PX,
  LEGEND_NARROW_WIDTH_PX,
  LEGEND_WIDTH_PX,
  ZOOM_CLEARANCE_PX,
  isNarrowFrame,
  legendBox,
  legendOpen,
} from './legendFold.js';

describe('whether the key starts open', () => {
  it('starts folded on a narrow frame and open on a wide one', () => {
    expect(legendOpen(375, null)).toBe(false);
    expect(legendOpen(LEGEND_NARROW_FRAME_PX - 1, null)).toBe(false);
    expect(legendOpen(LEGEND_NARROW_FRAME_PX, null)).toBe(true);
    expect(legendOpen(1540, null)).toBe(true);
  });

  it('counts an unmeasured frame as narrow', () => {
    expect(isNarrowFrame(null)).toBe(true);
    expect(legendOpen(null, null)).toBe(false);
  });

  it('follows the frame until somebody chooses, then keeps the choice', () => {
    // Narrowing the window with no choice made folds it, widening reopens it.
    expect([1200, 500, 1200].map((w) => legendOpen(w, null))).toEqual([true, false, true]);
    // Closed by hand on a wide frame, it stays closed however wide.
    expect([1200, 500, 1600].map((w) => legendOpen(w, false))).toEqual([false, false, false]);
    // Opened by hand on a narrow frame, it stays open.
    expect([375, 719, null].map((w) => legendOpen(w, true))).toEqual([true, true, true]);
  });
});

describe('how much of the map an open key may cover', () => {
  it('keeps its old width on a wide frame', () => {
    expect(legendBox(1200, 800).maxWidth).toBe(LEGEND_WIDTH_PX);
    expect(legendBox(LEGEND_NARROW_FRAME_PX, 800).maxWidth).toBe(LEGEND_WIDTH_PX);
  });

  it('is narrower on a narrow frame, and never more than 60% of a phone', () => {
    expect(legendBox(LEGEND_NARROW_FRAME_PX - 1, 800).maxWidth).toBe(LEGEND_NARROW_WIDTH_PX);
    expect(legendBox(375, 600).maxWidth).toBe(220);
    expect(legendBox(300, 600).maxWidth).toBe(180);
    expect(legendBox(null, null)).toEqual({ maxWidth: LEGEND_NARROW_WIDTH_PX, maxHeight: null });
  });

  it('stops short of the zoom buttons on a wide frame', () => {
    expect(legendBox(1200, 800).maxHeight).toBe(800 - LEGEND_INSET_PX - ZOOM_CLEARANCE_PX);
  });

  it('takes at most 40% of a narrow frame’s height', () => {
    expect(legendBox(500, 800).maxHeight).toBe(320);
    expect(legendBox(500, 300).maxHeight).toBe(120);
  });

  it('never covers more than its share, at every width and height', () => {
    for (let width = 240; width <= 2000; width += 40) {
      for (let height = 260; height <= 1400; height += 60) {
        const box = legendBox(width, height);
        expect(box.maxWidth).toBeLessThanOrEqual(LEGEND_WIDTH_PX);
        expect(box.maxHeight).not.toBeNull();
        const maxHeight = box.maxHeight ?? 0;
        expect(maxHeight + LEGEND_INSET_PX + ZOOM_CLEARANCE_PX).toBeLessThanOrEqual(height);
        if (isNarrowFrame(width)) {
          expect(box.maxWidth).toBeLessThanOrEqual(width * 0.6);
          expect(maxHeight).toBeLessThanOrEqual(height * 0.4);
        }
      }
    }
  });

  it('keeps a floor on a very short frame, so an open key still shows a row', () => {
    expect(legendBox(1200, 120).maxHeight).toBe(LEGEND_MIN_HEIGHT_PX);
    expect(legendBox(400, 120).maxHeight).toBe(LEGEND_MIN_HEIGHT_PX);
  });
});
