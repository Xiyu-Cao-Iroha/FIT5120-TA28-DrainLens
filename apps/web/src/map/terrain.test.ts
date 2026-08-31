/**
 * Tests for the ground-surface layer.
 *
 * The shading is relative to the extent's own range, so the assertions are
 * about that relativity rather than about particular colours — and about the
 * failures that would produce a plausible-looking surface rather than an
 * error, which is the class of defect this whole map is careful about.
 */

import { describe, expect, it } from 'vitest';

import { TERRAIN_ALPHA, TerrainError, drawTerrain, loadTerrain, rasterise, shade } from './terrain.js';
import { fit } from './viewport.js';

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
    expect(shade(-100, 0, 10)).toEqual(shade(0, 0, 10));
    expect(shade(999, 0, 10)).toEqual(shade(10, 0, 10));
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
