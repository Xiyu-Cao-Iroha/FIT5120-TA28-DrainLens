/**
 * Loading the packed scene, and the failures that would not look like failures.
 *
 * An array read at the wrong width or a bitmask expanded the wrong way round
 * does not throw. It produces a terrain, and the engine routes water over it,
 * and every answer after that is wrong in a way no screenshot reveals. So the
 * shapes and the endianness of the unpacking are asserted against values known
 * by construction.
 */

import { describe, expect, it } from 'vitest';

import {
  type SceneHeader,
  SceneError,
  assertScene,
  depressionFieldFrom,
  loadScene,
  unpackBits,
} from './scene.js';
import { handle } from './worker.js';

const HEADER: SceneHeader = {
  artefact: 'scene',
  version: 1,
  grid: { rows: 4, cols: 4, cellSizeM: 1, origin: 'north-west' },
  extent: { name: 'test', min_e: 0, min_n: 0, width_m: 4, height_m: 4 },
  arrays: {
    elevation: { file: 'elevation.bin', scale: 100 },
    flow: { file: 'flow.bin' },
    depressions: { file: 'depressions.bin' },
    coverage: { file: 'coverage.bin' },
  },
  depressions: [
    { id: 0, cellCount: 2, capacityM3: 3, spillElevationM: 10, spillCell: 7 },
    { id: 1, cellCount: 0, capacityM3: 9, spillElevationM: 12, spillCell: 3 },
  ],
  drains: [{ assetNumber: '1145184', cell: 5, isInlet: true }],
  note: 'derived, not recorded',
};

describe('unpacking the coverage bitmask', () => {
  it('reads the most significant bit first', () => {
    // Reversed, the coverage mask is the negative of itself and the engine
    // decides the measured half of the extent is the unmeasured half.
    expect([...unpackBits(new Uint8Array([0b10000000]), 8)]).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect([...unpackBits(new Uint8Array([0b00000001]), 8)]).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('spans byte boundaries', () => {
    const bits = unpackBits(new Uint8Array([0b00000001, 0b10000000]), 16);
    expect(bits[7]).toBe(1);
    expect(bits[8]).toBe(1);
    expect(bits[9]).toBe(0);
  });

  it('gives exactly as many cells as asked for', () => {
    expect(unpackBits(new Uint8Array([0xff]), 5)).toHaveLength(5);
  });
});

describe('rebuilding the depression field', () => {
  const labels = () => Int16Array.from([-1, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]);

  it('collects the cells of each hollow', () => {
    const field = depressionFieldFrom(labels(), HEADER.depressions, 16);
    expect(field.depressions).toHaveLength(1);
    expect(field.depressions[0]?.cells).toEqual([1, 2]);
    expect(field.depressions[0]?.capacityM3).toBe(3);
  });

  it('marks every other cell as belonging to none', () => {
    const field = depressionFieldFrom(labels(), HEADER.depressions, 16);
    expect(field.cellDepression[0]).toBe(-1);
    expect(field.cellDepression[1]).toBe(0);
    expect(field.cellDepression[15]).toBe(-1);
  });

  it('drops a hollow the raster does not place', () => {
    // An empty depression advertises storage at no location, and the engine
    // fills it forever: water goes in and never reaches the cells below.
    const field = depressionFieldFrom(labels(), HEADER.depressions, 16);
    expect(field.depressions.map((d) => d.id)).not.toContain(1);
  });

  it('refuses a raster of the wrong size rather than reading past it', () => {
    expect(() => depressionFieldFrom(Int16Array.from([0, 0]), HEADER.depressions, 16)).toThrow(
      SceneError,
    );
  });
});

describe('the scene header contract', () => {
  it('accepts what the pipeline writes', () => {
    expect(() => assertScene(HEADER)).not.toThrow();
  });

  it('refuses one that does not say how to scale its elevations', () => {
    // Without the scale, centimetres are read as metres and the extent becomes
    // a three-kilometre cliff that still routes water perfectly well.
    const broken = { ...HEADER, arrays: { ...HEADER.arrays, elevation: { file: 'e.bin', scale: 0 } } };
    expect(() => assertScene(broken)).toThrow(/scale/);
  });

  it('refuses one with no drains, because no scenario could be set', () => {
    expect(() => assertScene({ ...HEADER, drains: [] })).toThrow(/no drains/);
  });

  it('refuses a grid with no area', () => {
    expect(() => assertScene({ ...HEADER, grid: { ...HEADER.grid, rows: 0 } })).toThrow(/no area/);
  });

  it('refuses a different artefact that happens to be JSON', () => {
    expect(() => assertScene({ artefact: 'map-geometry' })).toThrow(/scene artefact/);
  });
});

describe('loading', () => {
  const cells = 16;

  function fixtures(overrides: Partial<Record<string, ArrayBuffer>> = {}) {
    const elevation = Int16Array.from({ length: cells }, (_, i) => 1000 + i); // 10.00 m up
    const flow = Int8Array.from({ length: cells }, () => 0);
    const depressions = Int16Array.from({ length: cells }, (_, i) => (i === 1 || i === 2 ? 0 : -1));
    const coverage = new Uint8Array([0xff, 0xff]);

    const files: Record<string, ArrayBuffer> = {
      'elevation.bin': elevation.buffer,
      'flow.bin': flow.buffer,
      'depressions.bin': depressions.buffer,
      'coverage.bin': coverage.buffer,
      ...overrides,
    };

    return loadScene('/scene', {
      fetchJson: async () => HEADER,
      fetchBinary: async (url) => {
        const name = url.split('/').pop()!;
        const found = files[name];
        if (!found) throw new Error(`no fixture for ${name}`);
        return found;
      },
    });
  }

  it('scales centimetres back to metres', async () => {
    const scene = await fixtures();
    expect(scene.grid.elevationM[0]).toBeCloseTo(10.0);
    expect(scene.grid.elevationM[15]).toBeCloseTo(10.15);
  });

  it('builds a grid the engine can index', async () => {
    const scene = await fixtures();
    expect(scene.grid.width).toBe(4);
    expect(scene.grid.height).toBe(4);
    expect(scene.grid.elevationM).toHaveLength(cells);
    expect(scene.flow.direction).toHaveLength(cells);
    expect(scene.coverage).toHaveLength(cells);
  });

  it('refuses an elevation array of the wrong length', async () => {
    // The failure that produces a terrain rather than an error: a short array
    // read into a grid leaves the rest at zero, which is a cliff at the seam.
    await expect(fixtures({ 'elevation.bin': Int16Array.from([1, 2, 3]).buffer })).rejects.toThrow(
      /elevation array/,
    );
  });

  it('refuses a flow array of the wrong length', async () => {
    await expect(fixtures({ 'flow.bin': Int8Array.from([1, 2]).buffer })).rejects.toThrow(/flow array/);
  });
});

describe('the worker turns outcomes into replies', () => {
  it('reports that nothing can run before the scene is loaded', () => {
    const reply = handle(
      { type: 'run', id: 1, drainCell: 5, blockage: 'clear', rainfallPositionsMm: [40] },
      null,
    );
    expect(reply).toEqual({ type: 'failed', id: 1, message: 'the scene has not been loaded' });
  });

  it('turns a thrown engine error into a failed calculation, not a blank screen', async () => {
    // The engine throws for caller mistakes — an empty position list is one.
    // That is a defect, and a defect that reaches a resident should still be a
    // screen that says what happened and offers a retry.
    const scene = await (async () => {
      const elevation = Int16Array.from({ length: 16 }, () => 1000);
      return loadScene('/scene', {
        fetchJson: async () => HEADER,
        fetchBinary: async (url) =>
          url.endsWith('elevation.bin')
            ? elevation.buffer
            : url.endsWith('flow.bin')
              ? new Int8Array(16).buffer
              : url.endsWith('depressions.bin')
                ? new Int16Array(16).fill(-1).buffer
                : new Uint8Array([0xff, 0xff]).buffer,
      });
    })();

    const reply = handle(
      { type: 'run', id: 2, drainCell: 5, blockage: 'clear', rainfallPositionsMm: [] },
      scene,
    );
    expect(reply).toEqual({
      type: 'result',
      id: 2,
      status: 'insufficient-information',
      reason: 'scenario_calculation_failed',
    });
  });
});
