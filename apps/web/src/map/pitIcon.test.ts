/**
 * The pit marker's proportions.
 *
 * The icon exists to be recognised as a grate, which means the bars have to
 * stay countable. That is arithmetic, not taste: below about a pixel and a
 * half they merge into a block and the marker becomes a picture of a grate
 * rather than one. These pin the sizes that keep it on the right side of that.
 */
import { describe, expect, it, vi } from 'vitest';

import { ICON_DIAMETER_PX, ICON_MIN_SCALE, RING_WIDTH_PX, barWidthPx, drawPitIcon } from './pitIcon.js';

function recorder() {
  const calls: { op: string; args: unknown[] }[] = [];
  const note =
    (op: string) =>
    (...args: unknown[]) => {
      calls.push({ op, args });
    };
  const context = {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    save: note('save'),
    restore: note('restore'),
    translate: note('translate'),
    scale: note('scale'),
    beginPath: note('beginPath'),
    moveTo: note('moveTo'),
    lineTo: note('lineTo'),
    arc: note('arc'),
    fill: note('fill'),
    stroke: note('stroke'),
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls, spy: context };
}

describe('the pit marker', () => {
  it('keeps its bars wide enough to count at the shipped size', () => {
    expect(barWidthPx()).toBeGreaterThanOrEqual(1.5);
  });

  it('would not, inside the artwork’s own frame at this size', () => {
    // Why the round frame replaces the rounded rectangle rather than holding
    // it: the supplied artwork is 168 units wide and its bars are 11 of them,
    // so fitting the whole thing in a 26px circle puts a bar under a pixel.
    const insideTheOldFrame = (26 * 0.873 * 11) / 168;
    expect(insideTheOldFrame).toBeLessThan(1.5);
  });

  it('grows its bars with the marker', () => {
    expect(barWidthPx(52)).toBeCloseTo(barWidthPx(26) * 2, 6);
  });

  it('draws the ring before the grate, so nothing shows between the bars', () => {
    const r = recorder();
    drawPitIcon(r.context, 100, 100, '#2f6f62');
    const fill = r.calls.findIndex((c) => c.op === 'fill');
    const firstBar = r.calls.findIndex((c) => c.op === 'moveTo');
    expect(fill).toBeGreaterThan(-1);
    expect(fill).toBeLessThan(firstBar);
  });

  it('draws ten bars', () => {
    const r = recorder();
    drawPitIcon(r.context, 0, 0, '#2f6f62');
    expect(r.calls.filter((c) => c.op === 'moveTo')).toHaveLength(10);
    expect(r.calls.filter((c) => c.op === 'lineTo')).toHaveLength(10);
  });

  it('leaves the context as it found it', () => {
    // It transforms to place the grate. A transform left behind moves every
    // layer drawn after it, which on this map is the address marker.
    const r = recorder();
    drawPitIcon(r.context, 0, 0, '#2f6f62');
    expect(r.calls.filter((c) => c.op === 'save')).toHaveLength(1);
    expect(r.calls.filter((c) => c.op === 'restore')).toHaveLength(1);
    expect(r.calls[r.calls.length - 1]?.op).toBe('restore');
  });

  it('centres the ring on the point it is given', () => {
    const r = recorder();
    drawPitIcon(r.context, 40, 70, '#2f6f62');
    const ring = r.calls.find((c) => c.op === 'arc');
    expect(ring?.args.slice(0, 3)).toEqual([40, 70, ICON_DIAMETER_PX / 2 - RING_WIDTH_PX / 2]);
  });

  it('takes the colour it is given rather than the artwork’s', () => {
    // The supplied file is #202544, a few percent from the pipe colour. Pits
    // and pipes are separate layers answering different questions, so the
    // marker takes the pit's own colour and the caller decides what that is.
    const r = recorder();
    drawPitIcon(r.context, 0, 0, '#0f766e');
    expect(r.spy.strokeStyle).toBe('#0f766e');
  });

  it('replaces the dot only where a grate is legible', () => {
    // A sanity floor rather than a restatement: at the threshold the map is
    // showing roughly half a kilometre across, which is where 26px markers
    // stop burying the streets.
    expect(ICON_MIN_SCALE).toBeGreaterThan(1);
    expect(ICON_MIN_SCALE).toBeLessThan(4);
  });
});
