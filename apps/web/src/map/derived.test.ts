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
  type DerivedArtefact,
  DerivedError,
  HATCH_SPACING_PX,
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
