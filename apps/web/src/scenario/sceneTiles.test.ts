/**
 * Stitching four tiles into a calculation window, on tiles two cells wide.
 *
 * Every rule at a window's edge is a way to lose or invent water without the
 * mass balance noticing: a flow direction that points out of the window, a
 * hollow the window cuts in half, a spill cell that is not in the window at
 * all. Each is checked here cell by cell.
 */

import { LEAVES_WINDOW } from '@drainlens/scenario';
import { describe, expect, it } from 'vitest';

import type { LoadedScene } from './scene.js';
import { type TileArrays, type TileIndex, gunzipOnce, loadIndex, loadWindow, stitchWindow, tileName } from './sceneTiles.js';
import { runForAsset, unsupportedReason } from './worker.js';

// A council grid of 6 x 6 cells at 250 m, tiles of 2 x 2 cells (500 m), so
// tiles tx 0..2, ty 0..2 with tile (0, 2) at the north-west. The window (0, 0)
// is tiles (0,0) (1,0) (0,1) (1,1): the south-west four, rows 2..5, cols 0..3.
const INDEX: TileIndex = {
  artefact: 'scene-tiles',
  version: 1,
  extent: { name: 'test', min_e: 1000, min_n: 2000, width_m: 1500, height_m: 1500 },
  grid: { rows: 6, cols: 6, cellSizeM: 250 },
  tileGrid: { originE: 1000, originN: 2000, sizeM: 500, cells: 2 },
  window: { tiles: 2 },
  arrays: {
    elevation: { file: 'elevation.bin.gz', scale: 100 },
    flow: { file: 'flow.bin.gz' },
    depressions: { file: 'depressions.bin.gz' },
    'rim-depth': { file: 'rim-depth.bin.gz', scale: 100 },
    measured: { file: 'measured.bin.gz' },
  },
  tiles: [0, 1, 2].flatMap((tx) =>
    [0, 1, 2].map((ty) => ({ tile: tileName(tx, ty), tx, ty, origin: [(2 - ty) * 2, tx * 2] as [number, number] })),
  ),
  windows: { 'inlet-a': [0, 0] },
  inletsWithoutWindow: ['inlet-bare'],
  note: 'a fixture',
};

function tile(tx: number, ty: number, over: Partial<TileArrays> & { meta?: Partial<TileArrays['meta']> } = {}): TileArrays {
  const origin: [number, number] = [(2 - ty) * 2, tx * 2];
  return {
    elevation: Int16Array.from([100 * (tx + 1), 100 * (tx + 1), 100 * (ty + 1), 100 * (ty + 1)]),
    flow: Int8Array.from([LEAVES_WINDOW, LEAVES_WINDOW, LEAVES_WINDOW, LEAVES_WINDOW]),
    depressions: Int16Array.from([-1, -1, -1, -1]),
    rimDepth: Int16Array.from([0, 0, 0, 0]),
    measured: Uint8Array.from([0b11110000]),
    ...over,
    meta: { tile: tileName(tx, ty), origin, depressions: [], drains: [], ...over.meta },
  };
}

const WINDOW = [0, 0] as const;
const windowTiles = (overrides: Record<string, Partial<TileArrays> & { meta?: Partial<TileArrays['meta']> }> = {}) =>
  new Map(
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ].map(([tx, ty]) => [tileName(tx!, ty!), tile(tx!, ty!, overrides[tileName(tx!, ty!)])] as const),
  );

describe('stitching a window', () => {
  it('lays the four tiles out north-up, with the northern tiles in the top rows', () => {
    const scene = stitchWindow(INDEX, WINDOW, windowTiles());
    expect(scene.grid.width).toBe(4);
    expect(scene.grid.height).toBe(4);
    // Tile (1, 1) is the north-east of the window: rows 0..1, cols 2..3. Its
    // first two cells carry (tx + 1) m = 2 m; its last two (ty + 1) m = 2 m.
    expect(scene.grid.elevationM[0 * 4 + 2]).toBeCloseTo(2);
    // Tile (0, 0) is the south-west: rows 2..3, cols 0..1, first cells 1 m.
    expect(scene.grid.elevationM[2 * 4 + 0]).toBeCloseTo(1);
  });

  it('puts the window where it is, in metres', () => {
    // North-west tile (0, 1) starts at council row 2, col 0. With a 250 m cell
    // and 6 rows, the window's south-west corner is (1000, 2000).
    const scene = stitchWindow(INDEX, WINDOW, windowTiles());
    expect(scene.header.extent.min_e).toBe(1000);
    expect(scene.header.extent.min_n).toBe(2000);
    expect(scene.header.extent.width_m).toBe(1000);
  });

  it('keeps a flow direction that stays inside the window, and makes one that leaves it leave', () => {
    // In tile (1, 1), the north-east: cell 1 (window row 0, col 3) pointing
    // east (code 0) leaves; cell 0 (row 0, col 2) pointing east stays.
    const scene = stitchWindow(
      INDEX,
      WINDOW,
      windowTiles({ [tileName(1, 1)]: { flow: Int8Array.from([0, 0, 6, 2]) } }),
    );
    expect(scene.flow.direction[0 * 4 + 2]).toBe(0);
    expect(scene.flow.direction[0 * 4 + 3]).toBe(LEAVES_WINDOW);
    // Cell 2 (row 1, col 2) pointing north (code 6) stays inside, to row 0.
    expect(scene.flow.direction[1 * 4 + 2]).toBe(6);
    // Cell 3 (row 1, col 3) pointing south (code 2) goes to row 2: still inside.
    expect(scene.flow.direction[1 * 4 + 3]).toBe(2);
  });

  it('keeps a whole hollow, with its spill cell moved into window cells', () => {
    const depression = { id: 7, cellCount: 2, capacityM3: 3, spillElevationM: 1.5, spill: [3, 1] as [number, number] };
    const scene = stitchWindow(
      INDEX,
      WINDOW,
      windowTiles({
        [tileName(0, 0)]: { depressions: Int16Array.from([7, 7, -1, -1]), meta: { depressions: [depression] } },
      }),
    );
    expect(scene.depressions.depressions).toHaveLength(1);
    const kept = scene.depressions.depressions[0]!;
    expect(kept.cells).toEqual([2 * 4 + 0, 2 * 4 + 1]);
    // Council (3, 1) is window row 1, col 1.
    expect(kept.spillCell).toBe(1 * 4 + 1);
    expect(scene.depressions.cellDepression[2 * 4 + 0]).toBe(0);
  });

  it('numbers the hollows it keeps from zero, because the engine indexes its stores by id', () => {
    // Council ids run past 21,000. Kept as they were, they wrote past the end of
    // the engine's per-depression arrays and 70% of the rain vanished.
    const first = { id: 12000, cellCount: 1, capacityM3: 1, spillElevationM: 1, spill: [0, 0] as [number, number] };
    const second = { id: 21000, cellCount: 1, capacityM3: 2, spillElevationM: 1, spill: [0, 0] as [number, number] };
    const renumbered = stitchWindow(
      INDEX,
      WINDOW,
      windowTiles({
        [tileName(0, 0)]: { depressions: Int16Array.from([12000, -1, -1, 21000]), meta: { depressions: [first, second] } },
      }),
    );
    expect(renumbered.depressions.depressions.map((d) => d.id)).toEqual([0, 1]);
    expect(renumbered.depressions.depressions.map((d) => d.capacityM3)).toEqual([1, 2]);
    expect(renumbered.depressions.cellDepression[2 * 4 + 0]).toBe(0);
    expect(renumbered.depressions.cellDepression[3 * 4 + 1]).toBe(1);
  });

  it('drops a hollow the window cuts, rather than giving part of it the whole capacity', () => {
    // Four cells in the council, two of them in this window.
    const depression = { id: 9, cellCount: 4, capacityM3: 10, spillElevationM: 1, spill: [0, 0] as [number, number] };
    const scene = stitchWindow(
      INDEX,
      WINDOW,
      windowTiles({
        [tileName(1, 0)]: { depressions: Int16Array.from([-1, 9, -1, 9]), meta: { depressions: [depression] } },
      }),
    );
    expect(scene.depressions.depressions).toEqual([]);
    expect([...scene.depressions.cellDepression].every((id) => id === -1)).toBe(true);
  });

  it('sends a spill outside the window out of the calculation', () => {
    const depression = { id: 4, cellCount: 1, capacityM3: 1, spillElevationM: 1, spill: [0, 5] as [number, number] };
    const scene = stitchWindow(
      INDEX,
      WINDOW,
      windowTiles({ [tileName(1, 1)]: { depressions: Int16Array.from([4, -1, -1, -1]), meta: { depressions: [depression] } } }),
    );
    expect(scene.depressions.depressions[0]?.spillCell).toBe(LEAVES_WINDOW);
  });

  it('places drains in window cells and leaves out any outside it', () => {
    const scene = stitchWindow(
      INDEX,
      WINDOW,
      windowTiles({
        [tileName(1, 0)]: {
          meta: {
            drains: [
              { assetNumber: 'inside', cell: [4, 3], isInlet: true },
              { assetNumber: 'snapped-away', cell: [4, 4], isInlet: true },
            ],
          },
        },
      }),
    );
    expect(scene.header.drains).toEqual([{ assetNumber: 'inside', cell: 2 * 4 + 3, isInlet: true }]);
  });

  it('refuses a window with a tile missing, or a tile of the wrong size', () => {
    const three = windowTiles();
    three.delete(tileName(1, 0));
    expect(() => stitchWindow(INDEX, WINDOW, three)).toThrow(/not loaded/);
    expect(() =>
      stitchWindow(INDEX, WINDOW, windowTiles({ [tileName(0, 0)]: { flow: Int8Array.from([0]) } })),
    ).toThrow(/flow holds 1 cells/);
  });

  it('marks every cell covered and carries rim depth in metres', () => {
    const scene = stitchWindow(
      INDEX,
      WINDOW,
      windowTiles({ [tileName(0, 0)]: { rimDepth: Int16Array.from([25, 0, 0, 0]) } }),
    );
    expect([...scene.coverage].every((c) => c === 1)).toBe(true);
    expect(scene.rimDepthM?.[2 * 4 + 0]).toBeCloseTo(0.25);
  });
});

describe('running a comparison for a drain by asset number', () => {
  const request = (assetNumber: string) =>
    ({ type: 'run-asset', id: 5, assetNumber, blockage: 'fully-blocked', rainfallPositionsMm: [20, 40, 60] }) as const;

  it('says why a drain has no scenario before downloading anything', () => {
    expect(unsupportedReason(INDEX, 'inlet-a')).toBeNull();
    expect(unsupportedReason(INDEX, 'inlet-bare')).toBe('terrain_unavailable');
    expect(unsupportedReason(INDEX, 'a-junction')).toBe('invalid_inlet');
  });

  it('never loads a window for a drain that has none', async () => {
    let loads = 0;
    const reply = await runForAsset(request('inlet-bare'), INDEX, async () => {
      loads += 1;
      throw new Error('should not load');
    });
    expect(loads).toBe(0);
    expect(reply).toEqual({ type: 'result', id: 5, status: 'insufficient-information', reason: 'terrain_unavailable' });
  });

  it('reports a window that will not load as a failed calculation, not a crash', async () => {
    const reply = await runForAsset(request('inlet-a'), INDEX, () => Promise.reject(new Error('offline')));
    expect(reply).toMatchObject({ status: 'insufficient-information', reason: 'scenario_calculation_failed' });
  });

  it('reports a drain the window does not place as an invalid inlet', async () => {
    const scene = stitchWindow(INDEX, WINDOW, windowTiles());
    const reply = await runForAsset(request('inlet-a'), INDEX, async () => scene);
    expect(reply).toMatchObject({ status: 'insufficient-information', reason: 'invalid_inlet' });
  });

  it('answers with the window origin, so the difference lands on the right map', async () => {
    const scene: LoadedScene = stitchWindow(
      INDEX,
      WINDOW,
      windowTiles({
        [tileName(0, 1)]: {
          flow: Int8Array.from([0, 2, 2, 2]),
          meta: { drains: [{ assetNumber: 'inlet-a', cell: [2, 1], isInlet: true }] },
        },
      }),
    );
    const reply = await runForAsset(request('inlet-a'), INDEX, async () => scene);
    expect(reply.type).toBe('result');
    if (reply.type !== 'result' || reply.status !== 'successful') throw new Error(JSON.stringify(reply));
    expect(reply.origin).toEqual({ minE: 1000, minN: 2000 });
    expect(reply.positions.map((p) => p.rainfallMm)).toEqual([20, 40, 60]);
  });
});

describe('decompressing a tile exactly once', () => {
  it('decompresses gzip bytes and passes through bytes a server already decoded', async () => {
    const { gzipSync } = await import('node:zlib');
    const raw = Uint8Array.from([1, 2, 3, 4, 5]);
    const zipped = gzipSync(raw);
    const fromGzip = await gunzipOnce(zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength));
    expect([...new Uint8Array(fromGzip)]).toEqual([1, 2, 3, 4, 5]);
    const already = await gunzipOnce(raw.buffer);
    expect([...new Uint8Array(already)]).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('loading a window over the wire', () => {
  const files = () => {
    const served = new Map<string, unknown>();
    served.set('/tiles/index.json', INDEX);
    for (const [tx, ty] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const t = tile(tx, ty);
      const dir = `/tiles/${tileName(tx, ty)}`;
      served.set(`${dir}/tile.json`, t.meta);
      served.set(`${dir}/elevation.bin.gz`, t.elevation.buffer);
      served.set(`${dir}/flow.bin.gz`, t.flow.buffer);
      served.set(`${dir}/depressions.bin.gz`, t.depressions.buffer);
      served.set(`${dir}/rim-depth.bin.gz`, t.rimDepth.buffer);
      served.set(`${dir}/measured.bin.gz`, t.measured.buffer);
    }
    const asked: string[] = [];
    const fetcher = {
      json: async (url: string) => {
        asked.push(url);
        if (!served.has(url)) throw new Error(`404 ${url}`);
        return served.get(url);
      },
      gunzip: async (url: string) => {
        asked.push(url);
        if (!served.has(url)) throw new Error(`404 ${url}`);
        return served.get(url) as ArrayBuffer;
      },
    };
    return { fetcher, asked };
  };

  it('reads the index, then exactly the four tiles of the window', async () => {
    const { fetcher, asked } = files();
    const index = await loadIndex('/tiles', fetcher);
    const scene = await loadWindow('/tiles', index, WINDOW, fetcher);
    expect(scene.grid.width).toBe(4);
    const tilesAsked = new Set(asked.filter((u) => u.includes('Tile_')).map((u) => u.split('/')[2]));
    expect([...tilesAsked].sort()).toEqual([tileName(0, 0), tileName(0, 1), tileName(1, 0), tileName(1, 1)].sort());
    expect(asked.filter((u) => u.endsWith('.bin.gz'))).toHaveLength(20);
  });

  it('refuses a window whose tiles the index does not list', async () => {
    const { fetcher } = files();
    const index = await loadIndex('/tiles', fetcher);
    await expect(loadWindow('/tiles', index, [2, 2], fetcher)).rejects.toThrow(/which the index does not have/);
  });

  it('refuses an index that is not one', async () => {
    const fetcher = { json: async () => ({ artefact: 'scene' }), gunzip: async () => new ArrayBuffer(0) };
    await expect(loadIndex('/tiles', fetcher)).rejects.toThrow(/scene tile index/);
    const wrongVersion = { json: async () => ({ ...INDEX, version: 2 }), gunzip: async () => new ArrayBuffer(0) };
    await expect(loadIndex('/tiles', wrongVersion)).rejects.toThrow(/version 2/);
  });
});
