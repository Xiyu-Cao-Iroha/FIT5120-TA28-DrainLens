import { describe, expect, it, vi } from 'vitest';

import { DIFFERENCE_FILL, MIN_CELL_PX, drawDifference } from './difference.js';
import type { Local, Viewport } from './viewport.js';

/** 200 px square, one pixel per metre, centred on (100, 100). */
const VIEW: Viewport = { widthPx: 200, heightPx: 200, scale: 1, centre: [100, 100] };

function recorder() {
  const rects: [number, number, number, number][] = [];
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => rects.push([x, y, w, h])),
    fillStyle: '',
  };
  return { context: context as unknown as CanvasRenderingContext2D, rects, spy: context };
}

const at = (cells: readonly Local[], cellSizeM = 1, viewport = VIEW) => {
  const r = recorder();
  drawDifference(r.context, { cells, cellSizeM }, viewport);
  return r;
};

describe('drawing where the two runs disagree', () => {
  it('draws nothing at all when nothing differs', () => {
    const r = at([]);
    expect(r.rects).toHaveLength(0);
    // Not even the save/restore pair: a layer with no cells must not touch
    // the context, or it would reset a fillStyle the next layer set.
    expect(r.spy.save).not.toHaveBeenCalled();
  });

  it('uses the difference fill and restores what it changed', () => {
    const r = at([[100, 100]]);
    expect(r.spy.fillStyle).toBe(DIFFERENCE_FILL);
    expect(r.spy.save).toHaveBeenCalledTimes(1);
    expect(r.spy.restore).toHaveBeenCalledTimes(1);
  });

  it('puts a cell at the centre of the view at the centre of the canvas', () => {
    // The cell is keyed by its south-west corner, so it is drawn upward from
    // there: the rectangle's top edge is one cell north of the key.
    expect(at([[100, 100]], 10).rects[0]).toEqual([100, 90, 10, 10]);
  });

  it('draws north of the key, never south of it', () => {
    // A cell further north must land *higher* on the canvas. Reversing the
    // northing mirrors the whole layer about the middle of the extent, which
    // on a square grid looks entirely plausible and is wrong everywhere.
    const north = at([[100, 150]], 10).rects[0]!;
    const south = at([[100, 50]], 10).rects[0]!;
    expect(north[1]).toBeLessThan(south[1]);
  });

  it('draws east of the key to the right', () => {
    const east = at([[150, 100]], 10).rects[0]!;
    const west = at([[50, 100]], 10).rects[0]!;
    expect(east[0]).toBeGreaterThan(west[0]);
  });

  it('scales a cell with the viewport', () => {
    const zoomed: Viewport = { ...VIEW, scale: 4 };
    expect(at([[100, 100]], 10, zoomed).rects[0]!.slice(2)).toEqual([40, 40]);
  });

  it('never draws a cell smaller than the floor', () => {
    // At the full-extent view a one-metre cell is one pixel, and a 652-cell
    // patch of single pixels is a scatter antialiasing washes out.
    const [, , w, h] = at([[100, 100]], 1).rects[0]!;
    expect(w).toBe(MIN_CELL_PX);
    expect(h).toBe(MIN_CELL_PX);
  });

  it('draws one rectangle per cell', () => {
    expect(at([[90, 90], [100, 100], [110, 110]], 10).rects).toHaveLength(3);
  });

  it('skips cells outside the canvas', () => {
    // A comparison window can sit largely outside a zoomed-in view. Filling
    // thousands of invisible rectangles is the difference between a layer
    // that draws and one that stutters.
    const rects = at([[100, 100], [10000, 10000], [-10000, -10000]], 10).rects;
    expect(rects).toHaveLength(1);
    expect(rects[0]![0]).toBe(100);
  });

  it('keeps a cell that straddles the edge', () => {
    // Culling on the centre rather than the extent would clip the patch a
    // pixel early at every border, which reads as a straight-edged result.
    expect(at([[200, 100]], 10, VIEW).rects).toHaveLength(1);
  });
});
