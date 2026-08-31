/**
 * Tests for the ground-surface layer.
 *
 * The shading is relative to the extent's own range, so the assertions are
 * about that relativity rather than about particular colours — and about the
 * failures that would produce a plausible-looking surface rather than an
 * error, which is the class of defect this whole map is careful about.
 */

import { describe, expect, it } from 'vitest';

import {
  BARRIER_FLOOR_M,
  TERRAIN_ALPHA,
  TerrainError,
  drawTerrain,
  groundRange,
  loadTerrain,
  rasterise,
  shade,
} from './terrain.js';
import { fit } from './viewport.js';
import { drawMap } from './draw.js';
import type { MapArtefact } from './artefact.js';

const HEADER = {
  grid: { rows: 2, cols: 2 },
  arrays: { elevation: { file: 'elevation.bin', scale: 100 } },
};

function fixtures(overrides: { header?: unknown; elevation?: Int16Array } = {}) {
  const elevation = overrides.elevation ?? Int16Array.from([1000, 1100, 1200, 1300]);
  return loadTerrain('/scene', {
    fetchJson: async () => overrides.header ?? HEADER,
    fetchBinary: async () => elevation.buffer,
  });
}

describe('shade', () => {
  it('puts low ground and high ground at opposite ends', () => {
    expect(shade(0, 0, 10)).not.toEqual(shade(10, 0, 10));
  });

  it('ramps monotonically between them', () => {
    const low = shade(0, 0, 10);
    const mid = shade(5, 0, 10);
    const high = shade(10, 0, 10);
    for (let channel = 0; channel < 3; channel += 1) {
      const rising = high[channel]! > low[channel]!;
      expect(rising ? mid[channel]! > low[channel]! : mid[channel]! < low[channel]!).toBe(true);
    }
  });

  it('clamps rather than running off the ramp', () => {
    // Both ends stay on the ramp, but the high end has to be tested below
    // BARRIER_FLOOR_M: above it a cell is a raised building rather than
    // ground, and is drawn as one instead of as the top of the ramp.
    expect(shade(-100, 0, 10)).toEqual(shade(0, 0, 10));
    expect(shade(49, 0, 10)).toEqual(shade(10, 0, 10));
  });

  it('shades a flat extent uniformly instead of dividing by zero', () => {
    // A uniform surface is uniformly shaded, which is the truthful picture.
    const colour = shade(5, 5, 5);
    expect(colour.every(Number.isFinite)).toBe(true);
    expect(shade(5, 5, 5)).toEqual(shade(5, 5, 5));
  });

  it('returns whole numbers a canvas can store', () => {
    for (const value of shade(3.3, 0, 10)) expect(Number.isInteger(value)).toBe(true);
  });
});

describe('loadTerrain', () => {
  it('scales centimetres back to metres', async () => {
    const terrain = await fixtures();
    expect(terrain.elevationM[0]).toBeCloseTo(10);
    expect(terrain.elevationM[3]).toBeCloseTo(13);
  });

  it('reports the range actually present, for the ramp to use', async () => {
    const terrain = await fixtures();
    expect(terrain.minM).toBeCloseTo(10);
    expect(terrain.maxM).toBeCloseTo(13);
  });

  it('refuses an array of the wrong length', async () => {
    // The failure that produces a terrain rather than an error: a short array
    // leaves the rest at zero, which is a cliff along the seam.
    await expect(fixtures({ elevation: Int16Array.from([1, 2, 3]) })).rejects.toThrow(
      /elevation array/,
    );
  });

  it('refuses a scene that does not say how to scale its elevations', async () => {
    const header = { ...HEADER, arrays: { elevation: { file: 'e.bin', scale: 0 } } };
    await expect(fixtures({ header })).rejects.toThrow(TerrainError);
  });

  it('refuses a grid with no area', async () => {
    await expect(fixtures({ header: { ...HEADER, grid: { rows: 0, cols: 2 } } })).rejects.toThrow(
      /no area/,
    );
  });

  it('refuses a scene that does not name its elevation array', async () => {
    await expect(fixtures({ header: { ...HEADER, arrays: {} } })).rejects.toThrow(/name/);
  });
});

/** A canvas stub that records what was drawn into it. */
function stubCanvas(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  const calls: { op: string; args: unknown[] }[] = [];
  const context = {
    createImageData: (w: number, h: number) => ({ data, width: w, height: h }),
    putImageData: (...args: unknown[]) => calls.push({ op: 'putImageData', args }),
    drawImage: (...args: unknown[]) => calls.push({ op: 'drawImage', args }),
    save: () => calls.push({ op: 'save', args: [] }),
    restore: () => calls.push({ op: 'restore', args: [] }),
    set globalAlpha(value: number) {
      calls.push({ op: 'globalAlpha', args: [value] });
    },
    set imageSmoothingEnabled(value: boolean) {
      calls.push({ op: 'smoothing', args: [value] });
    },
  };
  return { data, calls, canvas: { width, height, getContext: () => context } };
}

describe('rasterise', () => {
  it('paints every cell opaque', async () => {
    const terrain = await fixtures();
    const stub = stubCanvas(2, 2);
    rasterise(terrain, () => stub.canvas as unknown as HTMLCanvasElement);
    for (let cell = 0; cell < 4; cell += 1) expect(stub.data[cell * 4 + 3]).toBe(255);
  });

  it('paints the lowest and highest cells differently', async () => {
    const terrain = await fixtures();
    const stub = stubCanvas(2, 2);
    rasterise(terrain, () => stub.canvas as unknown as HTMLCanvasElement);
    const first = [stub.data[0], stub.data[1], stub.data[2]];
    const last = [stub.data[12], stub.data[13], stub.data[14]];
    expect(first).not.toEqual(last);
  });

  it('refuses a canvas that gives no context rather than drawing nothing', async () => {
    const terrain = await fixtures();
    const noContext = { width: 2, height: 2, getContext: () => null };
    expect(() => rasterise(terrain, () => noContext as unknown as HTMLCanvasElement)).toThrow(
      TerrainError,
    );
  });
});

describe('drawTerrain', () => {
  const extent = { widthM: 1000, heightM: 1000 };

  it('places the raster over the whole extent, corner to corner', () => {
    const stub = stubCanvas(800, 600);
    const context = stub.canvas.getContext() as unknown as CanvasRenderingContext2D;
    const viewport = fit(800, 600, extent);
    drawTerrain(context, {} as HTMLCanvasElement, viewport, extent);

    const drawn = stub.calls.find((c) => c.op === 'drawImage');
    const [, left, top, width, height] = drawn!.args as number[];
    // The whole square kilometre, at the scale that fills the canvas.
    expect(width).toBeCloseTo(extent.widthM * viewport.scale);
    expect(height).toBeCloseTo(extent.heightM * viewport.scale);
    // Row 0 is the northern edge, so the image's top-left is the NW corner.
    expect(left! + width! / 2).toBeCloseTo(400);
    expect(top! + height! / 2).toBeCloseTo(300);
  });

  it('draws it translucently, as context rather than as the subject', () => {
    const stub = stubCanvas(800, 600);
    const context = stub.canvas.getContext() as unknown as CanvasRenderingContext2D;
    drawTerrain(context, {} as HTMLCanvasElement, fit(800, 600, extent), extent);
    expect(stub.calls.some((c) => c.op === 'globalAlpha' && c.args[0] === TERRAIN_ALPHA)).toBe(true);
    expect(TERRAIN_ALPHA).toBeLessThan(1);
  });

  it('restores the context it saved, so the alpha does not leak into the network', () => {
    const stub = stubCanvas(800, 600);
    const context = stub.canvas.getContext() as unknown as CanvasRenderingContext2D;
    drawTerrain(context, {} as HTMLCanvasElement, fit(800, 600, extent), extent);
    expect(stub.calls.filter((c) => c.op === 'save')).toHaveLength(
      stub.calls.filter((c) => c.op === 'restore').length,
    );
  });
});


/**
 * `elevation.bin` is the routing surface, not the ground. Conditioning raises
 * every building by BARRIER_RAISE_M — a hundred metres — so 26.1% of the real
 * extent sits above 100 m. A ramp fitted to that array's own extremes spends
 * itself on an artefact and draws the ground people stand on as one flat
 * colour, which is what a teammate reported as "the button does nothing".
 */
describe('the conditioned surface, which is not the ground', () => {

  it('draws a barrier as a building, not as the highest ground', () => {
    const highGround = shade(29, 1, 28);
    const barrier = shade(120, 1, 28);
    expect(barrier).not.toEqual(highGround);
  });

  it('treats everything above the floor as a barrier', () => {
    expect(shade(BARRIER_FLOOR_M, 1, 28)).toEqual(shade(129, 1, 28));
  });

  it('leaves real ground on the ramp', () => {
    // Kensington's highest real ground is 29.84 m, well under the floor.
    expect(shade(29.84, 1, 28)).not.toEqual(shade(120, 1, 28));
  });

  it('fits the range to ground only, ignoring the raised buildings', () => {
    // A quarter barrier cells, as the real extent has.
    const cells = new Float32Array(400);
    for (let i = 0; i < 300; i += 1) cells[i] = 1 + (i / 300) * 29; // 1..30 m
    for (let i = 300; i < 400; i += 1) cells[i] = 120; // raised buildings
    const { minM, maxM } = groundRange(cells);
    expect(maxM).toBeLessThan(BARRIER_FLOOR_M);
    expect(maxM).toBeGreaterThan(20);
  });

  it('is robust to a single spike, which was the other way to flatten it', () => {
    const cells = new Float32Array(1000);
    for (let i = 0; i < 999; i += 1) cells[i] = 2 + (i / 999) * 8; // 2..10 m
    cells[999] = 49; // under the barrier floor, so not excluded — just extreme
    expect(groundRange(cells).maxM).toBeLessThan(20);
  });

  it('gives the ground a visible spread once fitted', () => {
    const cells = new Float32Array(1000);
    for (let i = 0; i < 750; i += 1) cells[i] = 1 + (i / 750) * 28;
    for (let i = 750; i < 1000; i += 1) cells[i] = 120;
    const { minM, maxM } = groundRange(cells);
    const low = shade(minM, minM, maxM);
    const high = shade(maxM, minM, maxM);
    const widest = Math.max(...low.map((v, i) => Math.abs(v - high[i]!)));
    // The defect was a spread of almost nothing across the ground.
    expect(widest).toBeGreaterThan(60);
  });

  it('survives an artefact with no ground at all rather than dividing by zero', () => {
    const allBarrier = new Float32Array(10).fill(120);
    const { minM, maxM } = groundRange(allBarrier);
    expect(maxM).toBeGreaterThan(minM);
  });
});


/**
 * The defect a unit test on `drawMap` alone would have missed.
 *
 * The terrain was drawn first and `drawMap` opened by filling the whole
 * canvas, so the layer was computed, drawn, and erased before a single road
 * went over it. Toggling it changed 0.1% of the screen. Every test passed:
 * `shade` was right, `groundRange` was right, `drawTerrain` issued its
 * `drawImage`. Nothing asserted that what it drew was still there afterwards.
 */
describe('the terrain survives the layers drawn over it', () => {
  const artefact = {
    artefact: 'map-geometry',
    version: 1,
    extent: { name: 't', min_e: 0, min_n: 0, width_m: 1000, height_m: 1000 },
    coordinates: 'metres',
    crs: 't',
    sources: [
      { layer: 'pit', dataset_id: 'd', publisher: 'p', licence: 'l', last_modified: '2023-01-01', features: 0 },
    ],
    layers: {},
  } as unknown as MapArtefact;

  const extent = { widthM: 1000, heightM: 1000 };

  /** Records the operations that can cover the whole canvas. */
  function recorder() {
    const calls: { op: string; args: unknown[] }[] = [];
    const note = (op: string) => (...args: unknown[]) => calls.push({ op, args });
    const context = {
      calls,
      save: note('save'), restore: note('restore'),
      beginPath: note('beginPath'), moveTo: note('moveTo'), lineTo: note('lineTo'),
      closePath: note('closePath'), stroke: note('stroke'), fill: note('fill'),
      arc: note('arc'), rect: note('rect'), clip: note('clip'),
      fillRect: note('fillRect'), drawImage: note('drawImage'),
      translate: note('translate'), rotate: note('rotate'), setTransform: note('setTransform'),
      measureText: () => ({ width: 10 }), fillText: note('fillText'), strokeText: note('strokeText'),
      setLineDash: note('setLineDash'),
      fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
      font: '', textAlign: '', textBaseline: '', globalAlpha: 1, imageSmoothingEnabled: true,
    };
    return context as typeof context & CanvasRenderingContext2D;
  }

  it('does not repaint the whole canvas after the terrain is drawn', () => {
    const context = recorder();
    const viewport = fit(800, 600, extent);

    drawTerrain(context, {} as HTMLCanvasElement, viewport, extent);
    drawMap(context, artefact, viewport, { groundAlreadyDrawn: true });

    const terrainAt = context.calls.findIndex((c) => c.op === 'drawImage');
    expect(terrainAt).toBeGreaterThanOrEqual(0);

    const coveringFillAfter = context.calls.findIndex(
      (c, i) =>
        i > terrainAt &&
        c.op === 'fillRect' &&
        Number(c.args[2]) >= viewport.widthPx &&
        Number(c.args[3]) >= viewport.heightPx,
    );
    expect(coveringFillAfter).toBe(-1);
  });

  it('still paints the ground when there is no terrain to stand in for it', () => {
    // The flag is not "never fill" — without a terrain layer the flat ground
    // is the only thing keeping the map off a transparent canvas.
    const context = recorder();
    const viewport = fit(800, 600, extent);
    drawMap(context, artefact, viewport, {});
    const covering = context.calls.filter(
      (c) => c.op === 'fillRect' && Number(c.args[2]) >= viewport.widthPx,
    );
    expect(covering.length).toBeGreaterThan(0);
  });
});
