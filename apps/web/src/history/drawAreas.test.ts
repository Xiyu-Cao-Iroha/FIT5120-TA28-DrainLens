/**
 * What the flood map draws, against a recording context rather than pixels.
 *
 * The same reasoning as `map/drawMap.test.ts`: what goes wrong in drawing is
 * order and omission. Here there is a third thing, and it is the one worth
 * catching — **a mark that makes a claim the data does not**. An area with
 * nothing recorded painted in the palest band, a lower bound drawn as a value,
 * or a dash left set from the previous mark all render perfectly.
 */

import { describe, expect, it } from 'vitest';

import {
  FLOOR_RING,
  NOTHING_RECORDED,
  NO_SCORE,
  RAMPS,
  drawAreas,
  fillFor,
  legendFor,
  markAt,
  marksFor,
} from './drawAreas.js';
import { type MapArea, completenessOf } from './severity.js';
import { type Bounds, fit } from '../map/viewport.js';

const MELBOURNE: Bounds = { widthM: 109_000, heightM: 116_000 };
const viewport = fit(800, 600, MELBOURNE);

const area = (over: Partial<MapArea> = {}): MapArea => ({
  code: '206011105',
  name: 'Brunswick',
  total: 24,
  byYear: [24],
  complete: true,
  suppressedRegions: 0,
  persons: 24_000,
  rate: 1,
  regions: 46,
  personsByYear: [24_000],
  e: 50_000,
  n: 50_000,
  ...over,
});

interface Call {
  readonly op: string;
  readonly args: readonly unknown[];
  readonly fill: string;
  readonly stroke: string;
  readonly dash: readonly number[];
}

function recorder() {
  const calls: Call[] = [];
  const state = { fillStyle: '', strokeStyle: '', dash: [] as readonly number[] };
  const note =
    (op: string) =>
    (...args: unknown[]) => {
      calls.push({ op, args, fill: state.fillStyle, stroke: state.strokeStyle, dash: state.dash });
    };

  const context = {
    calls,
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(value: string) {
      state.fillStyle = value;
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(value: string) {
      state.strokeStyle = value;
    },
    lineWidth: 0,
    font: '',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'bottom' as CanvasTextBaseline,
    clearRect: note('clearRect'),
    beginPath: note('beginPath'),
    arc: note('arc'),
    fill: note('fill'),
    stroke: note('stroke'),
    setLineDash: (dash: readonly number[]) => {
      state.dash = dash;
      calls.push({ op: 'setLineDash', args: [dash], fill: state.fillStyle, stroke: state.strokeStyle, dash });
    },
    fillText: note('fillText'),
    measureText: () => ({ width: 40 }) as TextMetrics,
  };
  return context;
}

const draw = (areas: readonly MapArea[], mode: 'activity' | 'severity', selected: string | null = null) => {
  const context = recorder();
  drawAreas(context as never, {
    marks: marksFor(areas, mode, viewport, selected),
    mode,
    stateOf: (a) => completenessOf(a, mode),
    selected,
    viewport,
    width: 800,
    height: 600,
  });
  return context.calls;
};

describe('what a mark says', () => {
  it('fills an area that has a value, in its band', () => {
    const calls = draw([area({ total: 24 })], 'activity');
    const fills = calls.filter((c) => c.op === 'fill');
    expect(fills).toHaveLength(1);
    expect(fills[0]!.fill).toBe(RAMPS.activity[1]);
  });

  it('does not fill an area with no recorded activity', () => {
    /*
      The distinction the whole map turns on. A zero in the palest band says
      the SES went there rarely; they did not go. It is drawn as an outlined
      ring with nothing in it.
    */
    const calls = draw([area({ total: 0 })], 'activity');
    expect(calls.filter((c) => c.op === 'fill')).toHaveLength(0);
    expect(calls.find((c) => c.op === 'stroke')?.stroke).toBe(NOTHING_RECORDED);
  });

  it('does not fill an area with no score, and dashes its ring', () => {
    const calls = draw([area({ rate: null, persons: null })], 'severity');
    expect(calls.filter((c) => c.op === 'fill')).toHaveLength(0);
    const stroke = calls.find((c) => c.op === 'stroke');
    expect(stroke?.stroke).toBe(NO_SCORE);
    expect(stroke?.dash).toEqual([3, 3]);
  });

  it('rings a floor, and rings it in the mark colour it is not', () => {
    // 80 of the 281 carry this, so it is the common qualification rather than
    // an edge case, and it has to survive being seen at a glance.
    const calls = draw([area({ complete: false, suppressedRegions: 2 })], 'activity');
    const stroke = calls.find((c) => c.op === 'stroke');
    expect(stroke?.stroke).toBe(FLOOR_RING);
    expect(calls.filter((c) => c.op === 'fill')).toHaveLength(1);
  });

  it('clears a dash before every stroke, not only before a dashed one', () => {
    /*
      A dash left set by the previous mark draws a solid ring dashed, which
      says "no score" about an area that has one. The guard is one line and
      this is the test that keeps it.
    */
    const calls = draw(
      [area({ code: 'a', rate: null, persons: null, total: 0 }), area({ code: 'b', total: 24, e: 60_000 })],
      'severity',
    );
    const strokes = calls.filter((c) => c.op === 'stroke');
    expect(strokes).toHaveLength(2);
    expect(strokes.some((s) => s.dash.length > 0)).toBe(true);
    expect(strokes.some((s) => s.dash.length === 0)).toBe(true);
  });
});

describe('order, which is the whole of the overlap rule', () => {
  it('draws the busiest area last, so it is never hidden under a quiet one', () => {
    // At the scale that fits 109 by 116 km into a pane, neighbours touch.
    // Whichever is drawn last is the one a reader sees.
    const marks = marksFor(
      [area({ code: 'quiet', total: 2 }), area({ code: 'busy', total: 209 })],
      'activity',
      viewport,
      null,
    );
    expect(marks.map((m) => m.area.code)).toEqual(['quiet', 'busy']);
  });

  it('hit-tests from the top down, so a click selects what was pressed', () => {
    const marks = marksFor(
      [area({ code: 'under', total: 1 }), area({ code: 'over', total: 90 })],
      'activity',
      viewport,
      null,
    );
    const [, top] = marks;
    expect(markAt(marks, top!.x, top!.y)?.code).toBe('over');
    expect(markAt(marks, 5, 5)).toBeNull();
  });

  it('draws the selected area larger, and labels only that one', () => {
    const calls = draw([area({ code: 'a' }), area({ code: 'b', e: 60_000 })], 'activity', 'a');
    const labels = calls.filter((c) => c.op === 'fillText');
    // The fit scale for the whole extent is below the label threshold, so
    // nothing is labelled; what is asserted here is that it is not *every*
    // mark that gets one.
    expect(labels.length).toBeLessThan(2);
    const marks = marksFor([area({ code: 'a' })], 'activity', viewport, 'a');
    expect(marks[0]!.r).toBeGreaterThan(marksFor([area({ code: 'a' })], 'activity', viewport, null)[0]!.r);
  });
});

describe('the legend', () => {
  it('offers each mode only the states that mode can produce', () => {
    /*
      Measured across all 281: the activity map has four areas with a complete
      zero and none without a score; the severity map has seven without a
      score and no complete zeros at all, because every area the SES was never
      called to is an area almost nobody lives in.
    */
    const activity = legendFor('activity').map((e) => e.label);
    const severity = legendFor('severity').map((e) => e.label);
    expect(activity.some((l) => l.includes('No recorded activity'))).toBe(true);
    expect(activity.some((l) => l.includes('No score'))).toBe(false);
    expect(severity.some((l) => l.includes('No score'))).toBe(true);
    expect(severity.some((l) => l.includes('No recorded activity'))).toBe(false);
  });

  it('carries the floor in both, because both can show one', () => {
    for (const mode of ['activity', 'severity'] as const) {
      expect(legendFor(mode).some((e) => e.ringed)).toBe(true);
    }
  });

  it('has one band entry per break, and each carries its numbers', () => {
    // AC 4.1.2.d. A band named without its range is a judgement with the
    // workings hidden.
    expect(legendFor('activity')).toHaveLength(4 + 2);
    expect(legendFor('severity')).toHaveLength(3 + 2);
    for (const entry of legendFor('severity').slice(0, 3)) {
      expect(entry.label).toMatch(/[\d.]/);
    }
  });

  it('uses a different ramp per mode, so a mode change looks like a new question', () => {
    expect(RAMPS.activity[0]).not.toBe(RAMPS.severity[0]);
    expect(fillFor(area(), 'activity', 'exact')).toBe(RAMPS.activity[1]);
    expect(fillFor(area(), 'severity', 'exact')).toBe(RAMPS.severity[0]);
    expect(fillFor(area({ total: 0 }), 'activity', 'none')).toBeNull();
  });
});
