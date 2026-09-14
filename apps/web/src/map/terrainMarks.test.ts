/**
 * Contours and spot heights: the rules that keep labels still and legible.
 *
 * The failure worth catching is a label that moves because the map moved, or a
 * pile of labels in one corner. Every rule below is from Terrain V1.1 §2.4–2.5.
 */

import { describe, expect, it } from 'vitest';

import {
  CONTOUR_LABEL_MAX,
  type ContourLine,
  SPOT_MAX,
  type SpotHeight,
  drawTerrainMarks,
  placeContourLabels,
  placeSpots,
  projector,
  spotLabel,
} from './terrainMarks.js';
import type { Local } from './viewport.js';

const identity = ([e, n]: Local) => [e, n] as const;
const measure = (text: string) => text.length * 6;

const spot = (id: string, e: number, n: number, priority = 0.9, heightM = 2.5): SpotHeight => ({
  id,
  tier: 'a',
  e,
  n,
  heightM,
  priority,
});

describe('choosing spot heights', () => {
  it('takes at most one per cell of a 3 x 2 screen grid, the best in each', () => {
    const spots = [
      spot('sp-a', 50, 50, 0.5),
      spot('sp-b', 60, 60, 0.9), // same top-left cell, higher priority
      spot('sp-c', 250, 50, 0.7),
    ];
    const placed = placeSpots(spots, identity, 600, 400, measure);
    expect(placed.map((p) => p.spot.id).sort()).toEqual(['sp-b', 'sp-c']);
  });

  it('never takes more than five', () => {
    const spots = [
      spot('1', 50, 50),
      spot('2', 250, 50),
      spot('3', 450, 50),
      spot('4', 50, 300),
      spot('5', 250, 300),
      spot('6', 450, 300),
    ];
    expect(placeSpots(spots, identity, 600, 400, measure).length).toBeLessThanOrEqual(SPOT_MAX);
  });

  it('breaks a tie by id, so the same view always shows the same point', () => {
    const one = placeSpots([spot('sp-2', 50, 50), spot('sp-1', 60, 60)], identity, 600, 400, measure);
    const other = placeSpots([spot('sp-1', 60, 60), spot('sp-2', 50, 50)], identity, 600, 400, measure);
    expect(one[0]!.spot.id).toBe('sp-1');
    expect(other[0]!.spot.id).toBe('sp-1');
  });

  it('keeps a label where it was when the map pans, as long as its cell does not change', () => {
    // Nothing is re-selected from the distribution of what is in view.
    const spots = [spot('sp-a', 100, 100), spot('sp-b', 400, 300)];
    const before = placeSpots(spots, identity, 600, 400, measure);
    const after = placeSpots(spots, ([e, n]) => [e + 10, n + 5] as const, 600, 400, measure);
    expect(after.map((p) => p.spot.id)).toEqual(before.map((p) => p.spot.id));
    expect(after[0]!.textX - after[0]!.x).toBe(before[0]!.textX - before[0]!.x);
  });

  it('moves a label to another side when the first collides with a dot', () => {
    // sp-b's dot sits 8 px right of sp-a, so sp-a's label goes on its left.
    const placed = placeSpots([spot('sp-a', 390, 100, 0.9), spot('sp-b', 405, 100, 0.8)], identity, 600, 400, measure);
    const a = placed.find((p) => p.spot.id === 'sp-a')!;
    expect(a.textX).toBeLessThan(a.x);
    expect(a.leader).toBe(false);
  });

  it('lifts a label diagonally, with a leader, when right and left are both taken', () => {
    // Left is off the screen; right runs into sp-b's dot. Upper right is free.
    const wide = () => 190;
    const placed = placeSpots([spot('sp-a', 12, 100, 0.8), spot('sp-b', 205, 100, 0.9)], identity, 600, 400, wide);
    const a = placed.find((p) => p.spot.id === 'sp-a')!;
    expect(a.leader).toBe(true);
    expect(a.textY).toBeLessThan(a.y);
  });

  it('never lets a label overlap another label or any dot, however crowded', () => {
    // A labelled dot is placed or dropped; it is never stacked. Checked over
    // many crowded arrangements rather than one hand-built case.
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let trial = 0; trial < 50; trial += 1) {
      const spots = Array.from({ length: 30 }, (_, i) =>
        spot(`sp-${String(i)}`, 150 + random() * 300, 120 + random() * 160, random()),
      );
      const placed = placeSpots(spots, identity, 600, 400, () => 40 + random() * 60);
      expect(placed.length).toBeLessThanOrEqual(5);
      for (const a of placed) {
        expect(a.box.left).toBeGreaterThanOrEqual(0);
        expect(a.box.right).toBeLessThanOrEqual(600);
        for (const b of placed) {
          const dot = { left: b.x - 4, right: b.x + 4, top: b.y - 4, bottom: b.y + 4 };
          const hits = (r: typeof dot) => a.box.left < r.right && a.box.right > r.left && a.box.top < r.bottom && a.box.bottom > r.top;
          expect(hits(dot)).toBe(false);
          if (a !== b) expect(hits(b.box)).toBe(false);
        }
      }
    }
  });

  it('writes the height to half a metre with ≈', () => {
    expect(spotLabel(spot('x', 0, 0, 1, 2.5))).toBe('≈ 2.5 m');
    expect(spotLabel(spot('x', 0, 0, 1, 3))).toBe('≈ 3.0 m');
  });
});

describe('labelling contours', () => {
  const line = (m: number, y: number, major = m % 5 === 0): ContourLine => ({
    m,
    major,
    c: [
      [30, y],
      [200, y],
      [400, y],
      [570, y],
    ],
  });

  it('labels only the 5 m lines when any is in view', () => {
    const labels = placeContourLabels([line(3, 100), line(5, 300)], identity, 600, 400, true, []);
    expect(labels.map((l) => l.text)).toEqual(['5 m']);
  });

  it('falls back to the finest lines drawn when no 5 m line is in view', () => {
    // The river flats: 53.4% of the ground is between 2 and 4 m.
    const labels = placeContourLabels([line(2, 100), line(3, 300)], identity, 600, 400, true, []);
    expect(labels.length).toBeGreaterThan(0);
    expect(placeContourLabels([line(2, 100)], identity, 600, 400, false, [])).toHaveLength(0);
  });

  it('labels each value once, at most two, and keeps them 175 px apart', () => {
    const labels = placeContourLabels(
      [line(5, 60), { ...line(5, 340), c: line(5, 340).c }, line(10, 120), line(15, 250)],
      identity,
      600,
      400,
      true,
      [],
    );
    // 5 m at y 60 first; the second 5 m repeats a value; 10 m at y 120 is 60 px
    // away; 15 m at y 250 is 190 px away and takes the second place.
    expect(labels.map((l) => l.text)).toEqual(['5 m', '15 m']);
    expect(labels.length).toBeLessThanOrEqual(CONTOUR_LABEL_MAX);
    expect(Math.hypot(labels[0]!.x - labels[1]!.x, labels[0]!.y - labels[1]!.y)).toBeGreaterThanOrEqual(175);
  });

  it('gives way to a spot height within 46 px', () => {
    const near = { x: 400, y: 110 } as never; // where the label would go is (400, 100)
    expect(placeContourLabels([line(5, 100)], identity, 600, 400, true, [near])).toHaveLength(0);
  });

  it('never writes a label upside down', () => {
    const backwards: ContourLine = { m: 5, major: true, c: [[570, 100], [400, 100], [200, 100], [30, 100]] };
    const [label] = placeContourLabels([backwards], identity, 600, 400, true, []);
    expect(Math.abs(label!.angle)).toBeLessThanOrEqual(Math.PI / 2);
  });
});

describe('the frame', () => {
  it('offsets Kensington into the council map', () => {
    const project = projector(
      { min_e: 316500, min_n: 5814500, width_m: 1000, height_m: 1000 },
      { min_e: 315000, min_n: 5808500 },
      { widthPx: 100, heightPx: 100, scale: 1, centre: [0, 0] },
    );
    expect(project([0, 0])).toEqual([50 + 1500, 50 - 6000]);
  });
});

describe('drawing', () => {
  function recorder() {
    const calls: { op: string; stroke: string; width: number }[] = [];
    const state = { strokeStyle: '', lineWidth: 0 };
    const note = (op: string) => () => calls.push({ op, stroke: state.strokeStyle, width: state.lineWidth });
    const context = {
      calls,
      save: note('save'), restore: note('restore'), beginPath: note('beginPath'), moveTo: note('moveTo'),
      lineTo: note('lineTo'), stroke: note('stroke'), fill: note('fill'), arc: note('arc'),
      translate: note('translate'), rotate: note('rotate'), fillText: note('fillText'), strokeText: note('strokeText'),
      measureText: (t: string) => ({ width: t.length * 6 }),
      get strokeStyle() {
        return state.strokeStyle;
      },
      set strokeStyle(v: string) {
        state.strokeStyle = v;
      },
      get lineWidth() {
        return state.lineWidth;
      },
      set lineWidth(v: number) {
        state.lineWidth = v;
      },
      fillStyle: '', lineJoin: '', lineCap: '', font: '', textAlign: '', textBaseline: '',
    };
    return context as typeof context & CanvasRenderingContext2D;
  }
  const marks = {
    extent: { min_e: 0, min_n: 0, width_m: 1000, height_m: 1000 },
    contours: [
      { m: 3, major: false, c: [[0, 500], [1000, 500]] as Local[] },
      { m: 5, major: true, c: [[0, 600], [1000, 600]] as Local[] },
    ],
    spots: [spot('sp-0', 500, 520)],
  };

  it('draws the 1 m lines only when zoomed in far enough, and the 5 m lines always', () => {
    const far = recorder();
    drawTerrainMarks(far, marks, { widthPx: 800, heightPx: 800, scale: 0.8, centre: [500, 500] }, {});
    const near = recorder();
    drawTerrainMarks(near, marks, { widthPx: 800, heightPx: 800, scale: 2, centre: [500, 500] }, {});
    const contourStrokes = (c: ReturnType<typeof recorder>) => c.calls.filter((x) => x.op === 'stroke' && x.stroke.startsWith('rgba('));
    expect(contourStrokes(far)).toHaveLength(1);
    expect(contourStrokes(near)).toHaveLength(2);
    expect(near.calls.filter((x) => x.op === 'fillText').length).toBeGreaterThan(0);
    expect(near.calls.filter((x) => x.op === 'save').length).toBe(near.calls.filter((x) => x.op === 'restore').length);
  });
});
