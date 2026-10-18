/**
 * The boundary over the map: which frame it is in, and when it is worth drawing.
 *
 * The frame is the one that went wrong before, on the difference layer: an
 * artefact in one extent's metres drawn over another's lands kilometres away,
 * on real streets, looking like a result.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  BOUNDARY_FILL,
  BOUNDARY_STROKE,
  boundaryInMapFrame,
  boundaryInView,
  drawCatchmentBoundary,
} from './catchmentBoundary.js';
import type { Local, Viewport } from './viewport.js';

/** 200 px square, one pixel per metre, centred on (100, 100). */
const VIEW: Viewport = { widthPx: 200, heightPx: 200, scale: 1, centre: [100, 100] };

const COUNCIL = { min_e: 315_000, min_n: 5_808_500 };
const KENSINGTON = { min_e: 316_500, min_n: 5_814_500 };

function recorder() {
  const calls: string[] = [];
  const context = {
    save: vi.fn(() => calls.push('save')),
    restore: vi.fn(() => calls.push('restore')),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn((rule?: string) => calls.push(`fill:${rule ?? ''}`)),
    stroke: vi.fn(() => calls.push('stroke')),
    setLineDash: vi.fn((dash) => calls.push(`dash:${(dash ?? []).join(",")}`)),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls, spy: context };
}

const ring = (e: number, n: number, side: number): readonly (readonly [number, number])[] => [
  [e, n],
  [e + side, n],
  [e + side, n + side],
  [e, n + side],
];

describe('which map the boundary is drawn over', () => {
  it('moves a council-framed boundary onto the Kensington map by the difference', () => {
    // Kensington's corner is the council's (1500, 6000), so a boundary 2000 m
    // east of the council corner is 500 m east of Kensington's.
    const [moved] = boundaryInMapFrame([ring(2_000, 7_000, 10)], COUNCIL, KENSINGTON);
    expect(moved?.[0]).toEqual([500, 1_000]);
  });

  it('leaves it alone on the map it was built for', () => {
    const [same] = boundaryInMapFrame([ring(2_000, 7_000, 10)], COUNCIL, COUNCIL);
    expect(same?.[0]).toEqual([2_000, 7_000]);
  });

  it('keeps every ring, holes included', () => {
    const moved = boundaryInMapFrame([ring(0, 0, 100), ring(40, 40, 20)], COUNCIL, COUNCIL);
    expect(moved).toHaveLength(2);
  });
});

describe('whether it is worth drawing', () => {
  it('draws when the view sits inside an area far larger than it', () => {
    // The common case: a reader in the middle of a 20 km² subcatchment, whose
    // every vertex is off the canvas. Asking whether its points are in view
    // would answer no and draw nothing.
    const big: Local[][] = [[[-5_000, -5_000], [5_000, -5_000], [5_000, 5_000], [-5_000, 5_000]]];
    expect(boundaryInView(big, VIEW)).toBe(true);
  });

  it('does not draw an area entirely off the canvas', () => {
    const far: Local[][] = [[[10_000, 10_000], [10_100, 10_000], [10_100, 10_100]]];
    expect(boundaryInView(far, VIEW)).toBe(false);
  });
});

describe('drawing it', () => {
  it('washes and outlines, and puts back what it changed', () => {
    const r = recorder();
    drawCatchmentBoundary(r.context, [[[0, 0], [100, 0], [100, 100], [0, 100]]], VIEW);
    expect(r.spy.fillStyle).toBe(BOUNDARY_FILL);
    expect(r.spy.strokeStyle).toBe(BOUNDARY_STROKE);
    // Dashed, as the design draws it, and the dash put back for the next layer.
    expect(r.calls).toEqual(['save', 'fill:evenodd', 'dash:7,5', 'stroke', 'dash:', 'restore']);
  });

  it('fills even-odd, so a ring inside another is a hole', () => {
    const r = recorder();
    drawCatchmentBoundary(
      r.context,
      [
        [[0, 0], [100, 0], [100, 100], [0, 100]],
        [[40, 40], [60, 40], [60, 60], [40, 60]],
      ],
      VIEW,
    );
    expect(r.spy.fill).toHaveBeenCalledWith('evenodd');
  });

  it('draws nothing at all for an empty or degenerate boundary', () => {
    const empty = recorder();
    drawCatchmentBoundary(empty.context, [], VIEW);
    const line = recorder();
    drawCatchmentBoundary(line.context, [[[0, 0], [10, 10]]], VIEW);
    // Not even the save/restore pair: a layer with nothing to draw must not
    // touch the context, or it resets what the next layer set.
    expect(empty.spy.save).not.toHaveBeenCalled();
    expect(line.spy.save).not.toHaveBeenCalled();
  });
});
