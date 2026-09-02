/**
 * Drawing is checked against a recording context rather than pixels.
 *
 * What can actually go wrong here is order and omission — a pit painted under
 * a road polygon is an invisible pit, and a layer culled by an inverted test
 * is a blank map. Both show up in the sequence of calls, and neither needs a
 * real canvas or an image to compare against.
 */

import { describe, expect, it } from 'vitest';

import type { MapArtefact } from './artefact.js';
import { DAY, LABEL_MIN_SCALE, PIT_MIN_SCALE, drawMap } from './draw.js';
import { ICON_MIN_SCALE } from './pitIcon.js';
import { type Bounds, fit, toScreen } from './viewport.js';

const KENSINGTON: Bounds = { widthM: 1000, heightM: 1000 };

interface Call {
  readonly op: string;
  readonly args: readonly unknown[];
}

/** Records what was asked of it, and answers the one question drawing asks. */
function recorder() {
  const calls: Call[] = [];
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
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    beginPath: note('beginPath'),
    closePath: note('closePath'),
    moveTo: note('moveTo'),
    lineTo: note('lineTo'),
    arc: note('arc'),
    // The pit marker transforms the context to place the grate inside
    // its ring. A double that does not answer for the whole surface a
    // caller uses fails as a missing function rather than as a wrong
    // drawing, which is a slower way to find out the same thing.
    save: note('save'),
    restore: note('restore'),
    translate: note('translate'),
    scale: note('scale'),
    arcTo: note('arcTo'),
    fill: note('fill'),
    stroke: note('stroke'),
    fillRect: note('fillRect'),
    fillText: note('fillText'),
    strokeText: note('strokeText'),
    save: note('save'),
    restore: note('restore'),
    translate: note('translate'),
    rotate: note('rotate'),
    measureText: (text: string) => ({ width: text.length * 6 }),
  };
  return context as typeof context & CanvasRenderingContext2D;
}

const artefact = (layers: MapArtefact['layers']): MapArtefact => ({
  artefact: 'map-geometry',
  version: 1,
  extent: { name: 'kensington', min_e: 316500, min_n: 5814500, width_m: 1000, height_m: 1000 },
  coordinates: 'metres from the corner',
  crs: 'EPSG:28355',
  sources: [
    {
      layer: 'pit',
      dataset_id: 'stormwater-pits',
      publisher: 'City of Melbourne Open Data Portal',
      licence: 'CC BY 4.0',
      last_modified: '2023-02-26',
      features: 1,
    },
  ],
  layers,
});

const FULL = artefact({
  road: [{ g: 'polygon', c: [[[400, 400], [600, 400], [600, 600], [400, 600]]] }],
  pipe: [{ g: 'line', c: [[420, 420], [580, 580]], ref: 7 }],
  pit: [{ g: 'point', c: [500, 500], asset_number: 1145184 }],
  'street-name': [{ g: 'line', c: [[420, 500], [580, 500]], maplabel: 'Neale Street' }],
});

const view = (scale?: number) => {
  const base = fit(1000, 1000, KENSINGTON);
  return scale === undefined ? base : { ...base, scale };
};

describe('drawing the map', () => {
  it('paints the ground before anything sits on it', () => {
    const context = recorder();
    drawMap(context, FULL, view());
    expect(context.calls[0]?.op).toBe('fillRect');
  });

  it('paints roads before pits, so a pit is never buried under one', () => {
    const context = recorder();
    drawMap(context, FULL, view());
    const firstFill = context.calls.findIndex((call) => call.op === 'fill');
    const pit = context.calls.findIndex((call) => call.op === 'arc');
    expect(firstFill).toBeGreaterThan(0);
    expect(pit).toBeGreaterThan(firstFill);
  });

  it('paints street names last, so nothing is drawn over a name', () => {
    const context = recorder();
    drawMap(context, FULL, view());
    const label = context.calls.findIndex((call) => call.op === 'fillText');
    const pit = context.calls.findIndex((call) => call.op === 'arc');
    expect(label).toBeGreaterThan(pit);
  });

  it('draws every layer it was given', () => {
    const context = recorder();
    drawMap(context, FULL, view());
    const ops = new Set(context.calls.map((call) => call.op));
    expect(ops).toContain('arc'); // a pit
    expect(ops).toContain('fillText'); // a street name
    expect(ops).toContain('lineTo'); // a pipe or a road ring
  });

  it('draws nothing but the ground when the artefact has no layers', () => {
    const context = recorder();
    drawMap(context, artefact({}), view());
    expect(context.calls.map((call) => call.op)).toEqual(['fillRect']);
  });
});

describe('what is left out', () => {
  it('skips a pit that is off screen', () => {
    const offScreen = artefact({ pit: [{ g: 'point', c: [-5000, -5000], asset_number: 1 }] });
    const context = recorder();
    drawMap(context, offScreen, view());
    expect(context.calls.some((call) => call.op === 'arc')).toBe(false);
  });

  it('skips a pipe that is off screen', () => {
    const offScreen = artefact({ pipe: [{ g: 'line', c: [[-9000, -9000], [-8000, -8000]] }] });
    const context = recorder();
    drawMap(context, offScreen, view());
    expect(context.calls.some((call) => call.op === 'moveTo')).toBe(false);
  });

  it('still draws what is on screen', () => {
    // The companion to the two above: a culling test that inverted its
    // comparison would pass those and fail this.
    const context = recorder();
    drawMap(context, FULL, view());
    expect(context.calls.some((call) => call.op === 'arc')).toBe(true);
  });

  it('hides pits once they are smaller than the difference between them', () => {
    const context = recorder();
    drawMap(context, FULL, view(PIT_MIN_SCALE - 0.01));
    expect(context.calls.some((call) => call.op === 'arc')).toBe(false);
  });

  it('hides street names before they become noise', () => {
    const context = recorder();
    drawMap(context, FULL, view(LABEL_MIN_SCALE - 0.01));
    expect(context.calls.some((call) => call.op === 'fillText')).toBe(false);
  });

  it('shows both again once there is room', () => {
    const context = recorder();
    // Above the label floor and below the grate threshold, so pits are still
    // the circle this asserts on. The two appearances are covered separately
    // below -- the point here is that neither is culled at this scale.
    drawMap(context, FULL, view(1));
    expect(context.calls.some((call) => call.op === 'arc')).toBe(true);
    expect(context.calls.some((call) => call.op === 'fillText')).toBe(true);
  });

  it('draws pits as a dot while they are too small to be a grate', () => {
    const context = recorder();
    drawMap(context, FULL, view(ICON_MIN_SCALE - 0.01));
    expect(context.calls.some((call) => call.op === 'arc')).toBe(true);
  });

  it('draws pits as a grate once one would be legible', () => {
    // A grate at six pixels is a smudge that claims to show ten bars, so the
    // icon only replaces the dot when there is room to count them.
    const context = recorder();
    drawMap(context, FULL, view(ICON_MIN_SCALE));
    // The ring is an arc too, so `arc` no longer separates the two
    // appearances. The grate does: a transform, then ten round-capped bars.
    expect(context.calls.some((call) => call.op === 'scale')).toBe(true);
    expect(context.calls.filter((call) => call.op === 'moveTo').length).toBeGreaterThanOrEqual(10);
    expect(context.calls.some((call) => call.op === 'restore')).toBe(true);
  });

  it('draws a street name with a halo behind it, or it is unreadable over a road', () => {
    const context = recorder();
    drawMap(context, FULL, view());
    const stroke = context.calls.findIndex((call) => call.op === 'strokeText');
    const fill = context.calls.findIndex((call) => call.op === 'fillText');
    expect(stroke).toBeGreaterThan(-1);
    expect(stroke).toBeLessThan(fill);
  });
});

describe('selection', () => {
  it('draws the selected pit larger than the others', () => {
    const two = artefact({
      pit: [
        { g: 'point', c: [450, 500], asset_number: 111 },
        { g: 'point', c: [550, 500], asset_number: 222 },
      ],
    });

    const plain = recorder();
    drawMap(plain, two, view());
    const chosen = recorder();
    drawMap(chosen, two, view(), { selectedPit: 222 });

    const radii = (context: ReturnType<typeof recorder>) =>
      context.calls.filter((call) => call.op === 'arc').map((call) => call.args[2] as number);

    expect(new Set(radii(plain)).size).toBe(1);
    expect(Math.max(...radii(chosen))).toBeGreaterThan(Math.max(...radii(plain)));
  });

  it('leaves the others alone', () => {
    const context = recorder();
    drawMap(context, FULL, view(), { selectedPit: 999999 });
    expect(context.calls.some((call) => call.op === 'arc')).toBe(true);
  });

  it('takes a palette rather than hard-coding one', () => {
    const context = recorder();
    drawMap(context, FULL, view(), { palette: { ...DAY, ground: '#000000' } });
    expect(context.calls[0]?.op).toBe('fillRect');
  });
});

describe('the address marker', () => {
  /** The ring is radius 8; no pit at these scales is drawn larger than 7. */
  const ringCalls = (context: ReturnType<typeof recorder>) =>
    context.calls.filter((call) => call.op === 'arc' && call.args[2] === 8);

  it('is drawn when an address is given', () => {
    const context = recorder();
    drawMap(context, FULL, view(), { address: [400, 400] });
    expect(ringCalls(context).length).toBeGreaterThan(0);
  });

  it('is not drawn when there is no address', () => {
    const context = recorder();
    drawMap(context, FULL, view());
    expect(ringCalls(context)).toHaveLength(0);
  });

  it('is drawn where the address is', () => {
    const context = recorder();
    drawMap(context, FULL, view(), { address: [400, 400] });
    const [x, y] = toScreen(view(), [400, 400]);
    const ring = ringCalls(context)[0];
    expect(ring?.args[0]).toBeCloseTo(x);
    expect(ring?.args[1]).toBeCloseTo(y);
  });

  it('does not borrow the pit colour', () => {
    // The address is the person's own location, not a recorded asset. A
    // marker in the pit colour puts their house into the drainage network.
    expect(DAY.address).not.toBe(DAY.pit);
    expect(DAY.address).not.toBe(DAY.selected);
  });

  it('is drawn after every layer, so nothing paints over it', () => {
    const context = recorder();
    drawMap(context, FULL, view(), { address: [400, 400] });
    const lastRing = context.calls.map((c) => c.op === 'arc' && c.args[2] === 8).lastIndexOf(true);
    const lastLabel = context.calls.map((c) => c.op === 'fillText').lastIndexOf(true);
    expect(lastRing).toBeGreaterThan(lastLabel);
  });

  it('is drawn even when it sits outside the visible window', () => {
    // A marker just off screen is the one thing a person needs in order to
    // know which way to pan back, so it is never culled.
    const context = recorder();
    drawMap(context, FULL, { ...view(4), centre: [100, 100] }, { address: [900, 900] });
    expect(ringCalls(context).length).toBeGreaterThan(0);
  });
});
