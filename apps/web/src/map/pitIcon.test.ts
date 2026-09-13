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
    arcTo: note('arcTo'),
    closePath: note('closePath'),
    fill: note('fill'),
    stroke: note('stroke'),
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls, spy: context };
}

describe('the pit marker', () => {
  it('keeps its bars above a pixel at the shipped size', () => {
    // The floor was 1.5 px while the marker was 32. The marker was halved in
    // area on 3 September at the design owner's request, which puts the bars
    // at 1.29 -- thinner than the old floor and deliberately so. 1.0 is the
    // floor that remains: below it a bar is no longer drawn as a bar, and the
    // five of them stop being countable at any distance.
    expect(barWidthPx()).toBeGreaterThan(1);
  });

  it('is the reason the marker is not smaller still', () => {
    // The circle holds the whole artwork, frame included, so the bars are a
    // fixed fraction of the diameter: 5.7% of it. Halving the *diameter* to 16
    // rather than the area was the other reading of the request and it puts
    // them at 0.90 px, where five bars render as one grey smudge and the
    // marker stops looking like the grate it was drawn from.
    expect(barWidthPx(16)).toBeLessThan(1);
    expect(barWidthPx(ICON_DIAMETER_PX)).toBeGreaterThan(1);
  });

  it('halved its area rather than its diameter', () => {
    // Which is what "half the size" turned out to mean. Recorded as a number
    // so that a later change has to decide this again rather than drift.
    const previous = 32;
    expect(ICON_DIAMETER_PX ** 2 / previous ** 2).toBeCloseTo(0.5, 1);
  });

  it('draws the artwork’s own frame, not just the bars', () => {
    // `arcTo` is the rounded rectangle. Without it the marker is a ring with
    // loose bars in it, which is legible but is not this icon.
    const r = recorder();
    drawPitIcon(r.context, 0, 0, '#2f6f62');
    expect(r.calls.filter((c) => c.op === 'arcTo').length).toBeGreaterThanOrEqual(4);
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
    // The frame is a path too, and it uses moveTo and lineTo as well. The
    // bars are what comes after it, so count from the frame's last corner.
    const lastCorner = r.calls.map((c) => c.op).lastIndexOf('arcTo');
    const after = r.calls.slice(lastCorner);
    expect(after.filter((c) => c.op === 'moveTo')).toHaveLength(10);
    expect(after.filter((c) => c.op === 'lineTo')).toHaveLength(10);
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
