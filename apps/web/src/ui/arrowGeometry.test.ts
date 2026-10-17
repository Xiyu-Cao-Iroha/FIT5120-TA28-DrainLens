import { describe, expect, it } from 'vitest';

import {
  type Box,
  arrowBetween,
  bowOf,
  centreOf,
  edgePoint,
  headAngle,
  headPoints,
  onScreen,
  pathOf,
} from './arrowGeometry.js';

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });

/** A square 100 wide at the origin, which most of these point at or from. */
const unit = box(0, 0, 100, 100);

describe('edgePoint', () => {
  it('lands on the edge facing the other thing, not in the middle of it', () => {
    const right = edgePoint(unit, { x: 500, y: 50 });
    expect(right).toEqual({ x: 100, y: 50 });

    const below = edgePoint(unit, { x: 50, y: 900 });
    expect(below).toEqual({ x: 50, y: 100 });
  });

  it('leaves the gap it is given, outside the box', () => {
    expect(edgePoint(unit, { x: 500, y: 50 }, 10).x).toBe(110);
  });

  it('meets the side it reaches first on a diagonal', () => {
    // A wide, short box: a target up and to the right leaves by the top.
    const wide = box(0, 0, 400, 40);
    const out = edgePoint(wide, { x: 220, y: -500 });
    expect(out.y).toBe(0);
    expect(out.x).toBeGreaterThan(200);
    expect(out.x).toBeLessThan(210);
  });

  it('answers the centre when there is nowhere to go', () => {
    expect(edgePoint(unit, centreOf(unit))).toEqual({ x: 50, y: 50 });
  });

  it('answers the centre of a box with no size', () => {
    const none = box(70, 70, 70, 70);
    expect(edgePoint(none, { x: 0, y: 0 })).toEqual({ x: 70, y: 70 });
  });
});

describe('bowOf', () => {
  it('leaves the straight line, so the arrow does not read as a rule', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    const control = bowOf(start, end);
    expect(control.x).toBe(50);
    expect(control.y).not.toBe(0);
  });

  it('bows the same side whichever way it is travelling', () => {
    const outward = bowOf({ x: 0, y: 0 }, { x: 100, y: 0 });
    const back = bowOf({ x: 100, y: 0 }, { x: 0, y: 0 });
    // Mirrored about the line, which is what "the same side of travel" means.
    expect(Math.sign(outward.y)).toBe(-Math.sign(back.y));
  });

  it('scales with the distance rather than being a fixed sag', () => {
    const near = bowOf({ x: 0, y: 0 }, { x: 100, y: 0 });
    const far = bowOf({ x: 0, y: 0 }, { x: 400, y: 0 });
    expect(Math.abs(far.y)).toBeGreaterThan(Math.abs(near.y) * 3);
  });
});

describe('headAngle', () => {
  it('is the curve at its end, not the line between the ends', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    const control = bowOf(start, end);
    const straight = Math.atan2(end.y - start.y, end.x - start.x);
    expect(headAngle(control, end)).not.toBeCloseTo(straight, 5);
  });

  it('points along the direction of travel', () => {
    expect(headAngle({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0, 10);
    expect(headAngle({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2, 10);
  });
});

describe('headPoints', () => {
  it('puts the tip at the end and the corners behind it', () => {
    const points = headPoints({ x: 100, y: 50 }, 0, 10).split(' ');
    expect(points).toHaveLength(3);
    expect(points[0]).toBe('100,50');
    for (const corner of points.slice(1)) {
      const x = Number(corner.split(',')[0]);
      expect(x).toBeLessThan(100);
    }
  });

  it('turns with the angle', () => {
    const east = headPoints({ x: 0, y: 0 }, 0, 10);
    const south = headPoints({ x: 0, y: 0 }, Math.PI / 2, 10);
    expect(east).not.toBe(south);
  });
});

describe('arrowBetween', () => {
  it('runs from the words to the edge of the target', () => {
    const arrow = arrowBetween(box(600, 100, 900, 160), box(100, 300, 180, 340));
    expect(arrow).not.toBeNull();
    // Leaves the instruction on the side the target is, and stops short of it.
    expect(arrow?.start.x).toBeLessThan(760);
    expect(arrow?.end.x).toBeGreaterThan(180);
  });

  it('draws nothing when the target is all but under the words', () => {
    expect(arrowBetween(box(100, 100, 300, 140), box(110, 110, 290, 130))).toBeNull();
  });

  it('draws nothing when the two centres are a few pixels apart', () => {
    expect(arrowBetween(box(0, 0, 100, 100), box(10, 10, 110, 110))).toBeNull();
  });

  it('points the head at the target, whichever side it is on', () => {
    const left = arrowBetween(box(600, 100, 900, 160), box(100, 300, 180, 340));
    const right = arrowBetween(box(100, 100, 400, 160), box(800, 300, 880, 340));
    expect(Math.cos(left?.angle ?? 0)).toBeLessThan(0);
    expect(Math.cos(right?.angle ?? 0)).toBeGreaterThan(0);
  });
});

describe('onScreen', () => {
  it('is false for a target scrolled out of sight', () => {
    expect(onScreen(box(10, -80, 110, -20), 1200, 800)).toBe(false);
    expect(onScreen(box(10, 900, 110, 960), 1200, 800)).toBe(false);
    expect(onScreen(box(-200, 10, -100, 60), 1200, 800)).toBe(false);
  });

  it('is false for a control that is not being rendered at all', () => {
    expect(onScreen(box(0, 0, 0, 0), 1200, 800)).toBe(false);
  });

  it('is true for one partly in view', () => {
    expect(onScreen(box(-20, 10, 60, 60), 1200, 800)).toBe(true);
  });
});

describe('pathOf', () => {
  it('is a quadratic through the control point', () => {
    const arrow = arrowBetween(box(600, 100, 900, 160), box(100, 300, 180, 340));
    expect(arrow).not.toBeNull();
    expect(pathOf(arrow!)).toMatch(/^M [\d.-]+ [\d.-]+ Q [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+$/);
  });

  it('rounds, so a sub-pixel wobble is not a redraw', () => {
    const a = arrowBetween(box(600, 100, 900, 160), box(100, 300, 180, 340));
    const b = arrowBetween(box(600.02, 100.01, 900.02, 160.01), box(100, 300, 180, 340));
    expect(pathOf(a!)).toBe(pathOf(b!));
  });
});
