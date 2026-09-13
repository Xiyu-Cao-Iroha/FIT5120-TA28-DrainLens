/**
 * What the flood map draws, against a recording context rather than pixels.
 *
 * The same reasoning as `map/drawMap.test.ts`: what goes wrong in drawing is
 * order and omission. Here there is a third thing, and it is the one worth
 * catching — **a shape that makes a claim the data does not**. An area with
 * nothing recorded painted in the palest band, a lower bound drawn as a value,
 * or a dash left set from the previous area all render perfectly.
 */

import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILL,
  FLOOR_HATCH,
  GROUND,
  HATCH_ON_DARK,
  NOTHING_RECORDED,
  NO_SCORE,
  RAMPS,
  areaAt,
  drawAreas,
  fillFor,
  inShape,
  legendFor,
} from './drawAreas.js';
import { type MapArea, completenessOf } from './severity.js';
import { type Bounds, fit, toScreen } from '../map/viewport.js';

const MELBOURNE: Bounds = { widthM: 138_000, heightM: 148_000 };
const viewport = fit(800, 600, MELBOURNE);

/** A square `half` metres either side of a point, as local metres. */
const square = (e: number, n: number, half = 5_000) =>
  Float64Array.from([e - half, n - half, e + half, n - half, e + half, n + half, e - half, n + half]);

const area = (over: Partial<MapArea> = {}): MapArea => {
  const e = over.e ?? 69_000;
  const n = over.n ?? 74_000;
  return {
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
    e,
    n,
    rings: [square(e, n)],
    ...over,
  };
};

interface Call {
  readonly op: string;
  readonly args: readonly unknown[];
  readonly fill: string;
  readonly stroke: string;
  readonly dash: readonly number[];
  readonly width: number;
}

function recorder() {
  const calls: Call[] = [];
  const state = { fillStyle: '', strokeStyle: '', dash: [] as readonly number[], lineWidth: 0 };
  const push = (op: string, args: readonly unknown[]) => {
    calls.push({
      op,
      args,
      fill: state.fillStyle,
      stroke: state.strokeStyle,
      dash: state.dash,
      width: state.lineWidth,
    });
  };
  const note =
    (op: string) =>
    (...args: unknown[]) => {
      push(op, args);
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
    get lineWidth() {
      return state.lineWidth;
    },
    set lineWidth(value: number) {
      state.lineWidth = value;
    },
    lineJoin: 'round' as CanvasLineJoin,
    font: '',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    clearRect: note('clearRect'),
    fillRect: note('fillRect'),
    beginPath: note('beginPath'),
    moveTo: note('moveTo'),
    lineTo: note('lineTo'),
    closePath: note('closePath'),
    fill: note('fill'),
    stroke: note('stroke'),
    save: note('save'),
    restore: note('restore'),
    clip: note('clip'),
    setLineDash: (dash: readonly number[]) => {
      state.dash = dash;
      push('setLineDash', [dash]);
    },
    fillText: note('fillText'),
    strokeText: note('strokeText'),
  };
  return context;
}

const draw = (areas: readonly MapArea[], mode: 'activity' | 'severity', selected: string | null = null) => {
  const context = recorder();
  drawAreas(context as never, {
    areas,
    mode,
    stateOf: (a) => completenessOf(a, mode),
    selected,
    viewport,
    width: 800,
    height: 600,
  });
  return context.calls;
};

const fills = (calls: readonly Call[]) => calls.filter((c) => c.op === 'fill');

describe('what an area says', () => {
  it('paints the ground first, then fills an area that has a value in its band', () => {
    const calls = draw([area({ total: 24 })], 'activity');
    expect(calls.find((c) => c.op === 'fillRect')?.fill).toBe(GROUND);
    expect(fills(calls)).toHaveLength(1);
    expect(fills(calls)[0]!.fill).toBe(RAMPS.activity[1]);
    // Even-odd, so a ring inside a ring is a hole.
    expect(fills(calls)[0]!.args).toEqual(['evenodd']);
  });

  it('does not colour an area with no recorded activity, and outlines it grey', () => {
    /*
      The distinction the whole map turns on. A zero in the palest band says
      the SES went there rarely; they did not go.
    */
    const calls = draw([area({ total: 0 })], 'activity');
    expect(fills(calls)[0]!.fill).toBe(EMPTY_FILL);
    expect(calls.some((c) => c.op === 'stroke' && c.stroke === NOTHING_RECORDED)).toBe(true);
  });

  it('does not colour an area with no score, and dashes its outline', () => {
    const calls = draw([area({ rate: null, persons: null })], 'severity');
    expect(fills(calls)[0]!.fill).toBe(EMPTY_FILL);
    expect(calls.find((c) => c.op === 'stroke' && c.stroke === NO_SCORE)?.dash).toEqual([4, 3]);
  });

  it('hatches a floor over its colour, inside its own shape', () => {
    // 80 of the 281 carry this, so it is the common qualification rather than
    // an edge case, and it has to survive being seen at a glance.
    const calls = draw([area({ complete: false, suppressedRegions: 2 })], 'activity');
    expect(fills(calls)[0]!.fill).toBe(RAMPS.activity[1]);
    const clip = calls.findIndex((c) => c.op === 'clip');
    expect(clip).toBeGreaterThan(-1);
    const after = calls.slice(clip);
    expect(after.some((c) => c.op === 'stroke' && c.stroke.startsWith('rgba(30, 43, 54'))).toBe(true);
    expect(after.some((c) => c.op === 'restore')).toBe(true);
  });

  it('hatches light over the dark bands, where a dark hatch would disappear', () => {
    const calls = draw([area({ total: 120, complete: false, suppressedRegions: 1 })], 'activity');
    expect(calls.some((c) => c.op === 'stroke' && c.stroke === HATCH_ON_DARK)).toBe(true);
  });

  it('clears a dash before every stroke, not only before a dashed one', () => {
    /*
      A dash left set by the previous area draws a solid edge dashed, which
      says "no score" about an area that has one.
    */
    const calls = draw(
      [area({ code: 'a', rate: null, persons: null, total: 0 }), area({ code: 'b', total: 24, e: 90_000 })],
      'severity',
      'b',
    );
    const selection = calls.filter((c) => c.op === 'stroke' && c.stroke === FLOOR_HATCH);
    expect(selection).toHaveLength(1);
    expect(selection[0]!.dash).toEqual([]);
  });

  it('draws nothing for an area that is off the canvas', () => {
    expect(fills(draw([area({ e: -50_000, n: -50_000 })], 'activity'))).toHaveLength(0);
  });
});

describe('the selected area', () => {
  it('is outlined and named, and nothing else is named', () => {
    const calls = draw(
      [area({ code: 'a', name: 'Alpha' }), area({ code: 'b', name: 'Beta', e: 90_000 })],
      'activity',
      'a',
    );
    expect(calls.filter((c) => c.op === 'fillText').map((c) => c.args[0])).toEqual(['Alpha']);
    expect(calls.some((c) => c.op === 'stroke' && c.stroke === FLOOR_HATCH && c.width === 2.5)).toBe(true);
    expect(draw([area()], 'activity').some((c) => c.op === 'fillText')).toBe(false);
  });
});

describe('what a click lands on', () => {
  it('finds the area whose shape holds the point, and nothing outside every area', () => {
    const a = area({ code: 'a' });
    const b = area({ code: 'b', e: 90_000 });
    const [x, y] = toScreen(viewport, [90_000, 74_000]);
    expect(areaAt([a, b], viewport, x, y)?.code).toBe('b');
    expect(areaAt([a, b], viewport, 1, 1)).toBeNull();
  });

  it('treats a ring inside a ring as a hole, as the fill does', () => {
    const holed = area({ rings: [square(69_000, 74_000, 5_000), square(69_000, 74_000, 1_000)] });
    expect(inShape(holed, 69_000, 74_000)).toBe(false);
    expect(inShape(holed, 72_000, 74_000)).toBe(true);
    expect(inShape(holed, 80_000, 74_000)).toBe(false);
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
      expect(legendFor(mode).some((e) => e.hatched)).toBe(true);
    }
  });

  it('has one band entry per break, and each carries its numbers', () => {
    // AC 4.1.2.d. A band named without its range is a judgement with the
    // workings hidden.
    // Four bands, the hatched floor, the withheld zero, and no recorded activity.
    expect(legendFor('activity')).toHaveLength(4 + 3);
    // The two areas published as zero because everything in them was withheld
    // draw hatched over no colour, and had no legend entry for it.
    const withheldZero = legendFor('activity').find((e) => e.label.startsWith('0+'));
    expect(withheldZero?.fill).toBeNull();
    expect(withheldZero?.hatched).toBe(true);
    expect(fillFor(area({ total: 0, complete: false, suppressedRegions: 1 }), 'activity', 'minimum')).toBeNull();
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
