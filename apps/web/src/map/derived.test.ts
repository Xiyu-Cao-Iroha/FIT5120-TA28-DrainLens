/**
 * The rule under test is not cosmetic.
 *
 * Pits and pipes are published records. Water paths, low points and the
 * unavailable areas are calculated from a filtered photogrammetric surface. If
 * the map draws them the same way, a derivation borrows the authority of a
 * record simply by being next to one — and this product's entire position is
 * that it does not overstate what it knows.
 *
 * So: recorded is solid, derived is not. That is asserted here against a
 * recording context, because it is a property of the calls, not of the pixels.
 */

import { describe, expect, it } from 'vitest';

import type { MapArtefact } from './artefact.js';
import {
  ARROW_MIN_PATH_PX,
  ARROW_SPACING_PX,
  type DerivedArtefact,
  DerivedError,
  HATCH_SPACING_PX,
  arrowsAlong,
  assertDerived,
  drawDerived,
} from './derived.js';
import { drawMap } from './draw.js';
import { type Bounds, fit } from './viewport.js';

const KENSINGTON: Bounds = { widthM: 1000, heightM: 1000 };
const view = fit(1000, 1000, KENSINGTON);

interface Call {
  readonly op: string;
  readonly args: readonly unknown[];
  /** The dash pattern in force when the call was made. */
  readonly dash: readonly number[];
}

function recorder() {
  const calls: Call[] = [];
  let dash: readonly number[] = [];

  const note =
    (op: string) =>
    (...args: unknown[]) => {
      calls.push({ op, args, dash: [...dash] });
    };

  const context = {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    setLineDash: (pattern: number[]) => {
      dash = [...pattern];
    },
    getLineDash: () => [...dash],
    beginPath: note('beginPath'),
    closePath: note('closePath'),
    moveTo: note('moveTo'),
    lineTo: note('lineTo'),
    arc: note('arc'),
    fill: note('fill'),
    stroke: note('stroke'),
    fillRect: note('fillRect'),
    fillText: note('fillText'),
    strokeText: note('strokeText'),
    clip: note('clip'),
    save: note('save'),
    restore: note('restore'),
    translate: note('translate'),
    rotate: note('rotate'),
    measureText: (text: string) => ({ width: text.length * 6 }),
  };
  return context as typeof context & CanvasRenderingContext2D;
}

const line = (points: readonly (readonly [number, number])[]) =>
  ({ g: 'line', c: points }) as const;
const polygon = (ring: readonly (readonly [number, number])[]) =>
  ({ g: 'polygon', c: [ring] }) as const;

const BOX = [
  [400, 400],
  [600, 400],
  [600, 600],
  [400, 600],
  [400, 400],
] as const;

const derived = (layers: DerivedArtefact['layers']): DerivedArtefact => ({
  artefact: 'derived-layers',
  version: 1,
  extent: { name: 'kensington', width_m: 1000, height_m: 1000 },
  coordinates: 'metres from the corner',
  basis: 'derived',
  note: 'Calculated from a filtered photogrammetric surface, not recorded.',
  layers,
  settings: {},
});

const ALL = derived({
  channel: [line([[100, 100], [500, 500], [900, 900]])],
  'low-point': [polygon(BOX)],
  unavailable: [polygon([[100, 800], [300, 800], [300, 950], [100, 950], [100, 800]])],
});

describe('the artefact contract', () => {
  it('accepts what the pipeline writes', () => {
    expect(() => assertDerived(ALL)).not.toThrow();
  });

  it('refuses an artefact that claims to be recorded data', () => {
    // Everything downstream styles these as a derivation and labels them so.
    // An artefact declaring another basis must not be drawn through this path.
    expect(() => assertDerived({ ...ALL, basis: 'sourceProvided' })).toThrow(DerivedError);
    expect(() => assertDerived({ ...ALL, basis: 'sourceProvided' })).toThrow(/labels them so/);
  });

  it('refuses one with no note saying what its layers are not', () => {
    expect(() => assertDerived({ ...ALL, note: '' })).toThrow(/no note/);
  });

  it('refuses a different artefact that happens to be JSON', () => {
    expect(() => assertDerived({ artefact: 'map-geometry' })).toThrow(/derived-layers/);
    expect(() => assertDerived(null)).toThrow(/not an object/);
  });
});

describe('derived layers are never drawn solid', () => {
  it('dashes the surface water paths', () => {
    const context = recorder();
    drawDerived(context, derived({ channel: [line([[100, 100], [900, 900]])] }), view);
    const strokes = context.calls.filter((call) => call.op === 'stroke');
    expect(strokes.length).toBeGreaterThan(0);
    for (const stroke of strokes) {
      expect(stroke.dash.length).toBeGreaterThan(0);
    }
  });

  it('the hatch is solid, and that is the point', () => {
    // Each derived layer signals itself differently: channels and low-point
    // edges by a dash, unavailable areas by hatching. The hatch strokes are
    // solid lines *inside a clip*, which reads as texture rather than as a
    // feature — so this is the one place a solid stroke is correct, and the
    // broader claim is per layer rather than over every stroke on the canvas.
    const context = recorder();
    drawDerived(context, derived({ unavailable: [polygon(BOX)] }), view);
    const strokes = context.calls.filter((call) => call.op === 'stroke');
    expect(strokes).not.toHaveLength(0);
    for (const stroke of strokes) {
      expect(stroke.dash).toEqual([]);
    }
    expect(context.calls.some((call) => call.op === 'clip')).toBe(true);
  });

  it('dashes the edge of a low point too', () => {
    const context = recorder();
    drawDerived(context, derived({ 'low-point': [polygon(BOX)] }), view);
    const strokes = context.calls.filter((call) => call.op === 'stroke');
    expect(strokes).not.toHaveLength(0);
    for (const stroke of strokes) {
      expect(stroke.dash.length).toBeGreaterThan(0);
    }
  });

  it('leaves no dash set behind for whatever draws next', () => {
    // A dash left in force would make the next layer — possibly a recorded
    // one — look derived, which is the exact confusion this file prevents.
    const context = recorder();
    drawDerived(context, ALL, view);
    expect(context.getLineDash()).toEqual([]);
  });

  it('and the recorded network is drawn solid, for contrast', () => {
    const map: MapArtefact = {
      artefact: 'map-geometry',
      version: 1,
      extent: { name: 'kensington', min_e: 0, min_n: 0, width_m: 1000, height_m: 1000 },
      coordinates: '',
      crs: '',
      sources: [
        {
          layer: 'pipe',
          dataset_id: 'drainpipes',
          publisher: 'City of Melbourne Open Data Portal',
          licence: 'CC BY 4.0',
          last_modified: '2023-02-26',
          features: 1,
        },
      ],
      layers: { pipe: [{ g: 'line', c: [[400, 400], [600, 600]], ref: 1 }] },
    };

    const context = recorder();
    drawMap(context, map, view);
    for (const stroke of context.calls.filter((call) => call.op === 'stroke')) {
      expect(stroke.dash).toEqual([]);
    }
  });
});

describe('the unavailable areas', () => {
  it('are hatched inside a clip rather than tinted', () => {
    // A tint reads as another quantity on a map that already uses tints for
    // water. Hatching reads as absence, which is what the layer means.
    const context = recorder();
    drawDerived(context, derived({ unavailable: [polygon(BOX)] }), view);
    const ops = context.calls.map((call) => call.op);
    expect(ops).toContain('clip');
    expect(ops.filter((op) => op === 'save')).not.toHaveLength(0);
    expect(ops.filter((op) => op === 'restore')).not.toHaveLength(0);
  });

  it('restore every save, or the clip leaks into the next layer', () => {
    const context = recorder();
    drawDerived(context, ALL, view);
    const saves = context.calls.filter((call) => call.op === 'save').length;
    const restores = context.calls.filter((call) => call.op === 'restore').length;
    expect(saves).toBe(restores);
  });

  it('draw enough hatch lines to cover the canvas', () => {
    const context = recorder();
    drawDerived(context, derived({ unavailable: [polygon(BOX)] }), view);
    const strokesInClip = context.calls.filter((call) => call.op === 'moveTo').length;
    expect(strokesInClip).toBeGreaterThan(view.widthPx / HATCH_SPACING_PX / 2);
  });

  it('are skipped entirely when the layer is empty', () => {
    const context = recorder();
    drawDerived(context, derived({}), view);
    expect(context.calls.some((call) => call.op === 'clip')).toBe(false);
  });
});

describe('what is drawn and what is not', () => {
  it('draws each layer only when it is turned on', () => {
    const only = (show: { channel: boolean; lowPoint: boolean; unavailable: boolean }) => {
      const context = recorder();
      drawDerived(context, ALL, view, { show });
      return context.calls.map((call) => call.op);
    };

    expect(only({ channel: true, lowPoint: false, unavailable: false })).not.toContain('clip');
    expect(only({ channel: false, lowPoint: false, unavailable: true })).toContain('clip');
    expect(only({ channel: false, lowPoint: false, unavailable: false })).toEqual([]);
  });

  it('skips a shape that is off screen', () => {
    const away = derived({ channel: [line([[-9000, -9000], [-8000, -8000]])] });
    const context = recorder();
    drawDerived(context, away, view);
    expect(context.calls.some((call) => call.op === 'stroke')).toBe(false);
  });

  it('keeps a shape that spans the view without a vertex inside it', () => {
    // A channel crossing the whole extent has its vertices outside a zoomed
    // view. Testing vertices alone would drop exactly the longest ones.
    const zoomed = { ...view, scale: 4, centre: [500, 500] as const };
    const crossing = derived({ channel: [line([[0, 500], [1000, 500]])] });
    const context = recorder();
    drawDerived(context, crossing, zoomed);
    expect(context.calls.some((call) => call.op === 'stroke')).toBe(true);
  });

  it('draws low points beneath the channels that feed them', () => {
    const context = recorder();
    drawDerived(context, ALL, view);
    const firstFill = context.calls.findIndex((call) => call.op === 'fill');
    const lastStroke = context.calls.map((call) => call.op).lastIndexOf('stroke');
    expect(firstFill).toBeGreaterThan(-1);
    expect(lastStroke).toBeGreaterThan(firstFill);
  });
});

/**
 * The arrows on the surface-water paths.
 *
 * These are the one mark on this map that makes a claim a dashed line does
 * not: *which way*. An arrow pointing the wrong way is worse than no arrow,
 * because a person can act on it — so what is tested here is the heading, not
 * that arrowheads exist.
 */
describe('which way the water runs', () => {
  const horizontal = (length: number) =>
    [
      [0, 0],
      [length, 0],
    ] as const;

  it('points along the vertex order, which is downstream', () => {
    // `trace_channels` walks head to outlet, so later vertices are further
    // down. Both directions are checked: a bug that ignores the order
    // entirely would pass one of them by luck.
    const east = arrowsAlong(horizontal(400));
    for (const arrow of east) expect(Math.cos(arrow.angle)).toBeGreaterThan(0.99);

    const west = arrowsAlong([
      [400, 0],
      [0, 0],
    ]);
    for (const arrow of west) expect(Math.cos(arrow.angle)).toBeLessThan(-0.99);
  });

  it('turns with the path rather than pointing at the outlet', () => {
    // A path that runs east and then south is not one heading averaged; the
    // arrow on each leg belongs to that leg.
    const bend = arrowsAlong(
      [
        [0, 0],
        [200, 0],
        [200, 200],
      ],
      50,
    );
    const headings = bend.map((a) => Math.round((a.angle * 180) / Math.PI));
    expect(headings).toContain(0);
    expect(headings).toContain(90);
  });

  it('spaces them evenly along the line', () => {
    const arrows = arrowsAlong(horizontal(400), 100);
    const gaps = arrows.slice(1).map((a, i) => a.x - (arrows[i]?.x ?? 0));
    for (const gap of gaps) expect(gap).toBeCloseTo(100);
  });

  it('keeps the spacing in screen pixels, so density does not change with zoom', () => {
    // The same channel drawn twice as large gets twice as many arrows. The
    // alternative — spacing in metres — is a solid row of heads when zoomed
    // out and none at all when zoomed in.
    const near = arrowsAlong(horizontal(400));
    const far = arrowsAlong(horizontal(800));
    // Within one, not exactly double: both ends are inset by half a spacing,
    // so the count is the length over the spacing give or take the tail.
    expect(Math.abs(far.length - near.length * 2)).toBeLessThanOrEqual(1);
  });

  it('gives a short path one arrow rather than none', () => {
    // A path shorter than the spacing would otherwise fall between two marks
    // and be the only unlabelled line on the screen.
    const length = (ARROW_MIN_PATH_PX + ARROW_SPACING_PX) / 2;
    const short = arrowsAlong(horizontal(length));
    expect(short).toHaveLength(1);
    expect(short[0]?.x).toBeCloseTo(length / 2);
  });

  it('leaves a path too short to read unmarked', () => {
    expect(arrowsAlong(horizontal(ARROW_MIN_PATH_PX - 1))).toHaveLength(0);
    expect(arrowsAlong([[0, 0]])).toHaveLength(0);
    expect(arrowsAlong([])).toHaveLength(0);
  });

  it('ignores a repeated vertex instead of dividing by zero', () => {
    const arrows = arrowsAlong([
      [0, 0],
      [0, 0],
      [400, 0],
    ]);
    expect(arrows.length).toBeGreaterThan(0);
    for (const arrow of arrows) expect(Number.isFinite(arrow.angle)).toBe(true);
  });

  it('draws them downhill on the canvas, with northing-up already flipped', () => {
    // The one place the sign can go wrong. A channel running from high
    // northing to low is running south, which on a canvas is *down* the
    // screen, and the arrow has to agree with the line it sits on.
    const context = recorder();
    drawDerived(
      context,
      derived({ channel: [line([[500, 900], [500, 100]])] }),
      view,
      { show: { channel: true, lowPoint: false, unavailable: false } },
    );

    const heads = context.calls.filter((call) => call.op === 'moveTo' && call.dash.length === 0);
    expect(heads.length).toBeGreaterThan(0);

    // Each arrowhead is moveTo(nose) then two lineTo(corners). The nose is
    // below both corners when the arrow points down the screen.
    for (const head of heads) {
      const at = context.calls.indexOf(head);
      const corners = context.calls.slice(at + 1, at + 3);
      expect(corners.every((c) => c.op === 'lineTo')).toBe(true);
      const noseY = head.args[1] as number;
      for (const corner of corners) expect(noseY).toBeGreaterThan(corner.args[1] as number);
    }
  });

  it('fills the heads rather than stroking them, so they stay solid under a dashed line', () => {
    const context = recorder();
    drawDerived(
      context,
      derived({ channel: [line([[100, 100], [900, 900]])] }),
      view,
      { show: { channel: true, lowPoint: false, unavailable: false } },
    );
    // The line's own strokes keep their dash — the rule the whole file is
    // about — and the heads are fills with no dash in force.
    for (const call of context.calls.filter((c) => c.op === 'stroke')) {
      expect(call.dash.length).toBeGreaterThan(0);
    }
    const fills = context.calls.filter((c) => c.op === 'fill');
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(fill.dash).toHaveLength(0);
  });
});
