/**
 * The council terrain tiles: which level is drawn, which tiles are fetched,
 * and that no square is shaded twice.
 */

import { describe, expect, it } from 'vitest';

import {
  TILES_KEPT,
  TILE_SCALE_MIN,
  TerrainTiles,
  TerrainTilesError,
  assertTerrainTileIndex,
  decodeContour,
  drawTerrainColour,
  drawTerrainShade,
  loadTerrainTiles,
  marksInView,
  offsetInto,
  visibleTiles,
} from './terrainTiles.js';
import type { Viewport } from './viewport.js';

const INDEX = {
  artefact: 'terrain-tiles' as const,
  extent: { name: 'city-of-melbourne', min_e: 315000, min_n: 5808500, width_m: 1000, height_m: 1000 },
  tileGrid: { sizeM: 500 },
  tiles: [
    { tile: 'Tile_A', tx: 0, ty: 0, e: 0, n: 0 },
    { tile: 'Tile_B', tx: 1, ty: 0, e: 500, n: 0 },
    { tile: 'Tile_C', tx: 0, ty: 1, e: 0, n: 500 },
  ],
  overview: { colour: 'overview-colour.webp', shade: 'overview-shade.webp', cellM: 4, width: 250, height: 250 },
};

/** A view of the extent's south-west quarter: Tile_A only. */
const zoomedIn: Viewport = { widthPx: 400, heightPx: 400, scale: 1, centre: [250, 250] };
/** The whole extent, below tile scale. */
const zoomedOut: Viewport = { widthPx: 400, heightPx: 400, scale: 0.4, centre: [500, 500] };

function loaders(fail: readonly string[] = []) {
  const asked: string[] = [];
  return {
    asked,
    image: (url: string) => {
      asked.push(url);
      return fail.some((f) => url.includes(f))
        ? Promise.reject(new Error('404'))
        : Promise.resolve({ url } as unknown as CanvasImageSource);
    },
    json: (url: string) => {
      asked.push(url);
      if (url.endsWith('index.json')) return Promise.resolve(INDEX);
      return Promise.resolve({
        unitM: 0.5,
        contours: [{ m: 5, major: true, d: [20, 20, 20, 20] }],
        spots: [{ id: url, tier: 'a', e: 1, n: 1, heightM: 2, priority: 1 }],
      });
    },
  };
}

function recorder() {
  const calls: { op: string; args: unknown[]; composite: string }[] = [];
  const state = { composite: 'source-over' };
  const c = {
    calls,
    save: () => calls.push({ op: 'save', args: [], composite: state.composite }),
    restore: () => {
      state.composite = 'source-over';
      calls.push({ op: 'restore', args: [], composite: state.composite });
    },
    drawImage: (...args: unknown[]) => calls.push({ op: 'drawImage', args, composite: state.composite }),
    set globalCompositeOperation(v: string) {
      state.composite = v;
    },
    get globalCompositeOperation() {
      return state.composite;
    },
    imageSmoothingEnabled: true,
  };
  return c as typeof c & CanvasRenderingContext2D;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const drawnUrls = (ctx: ReturnType<typeof recorder>) =>
  ctx.calls.filter((x) => x.op === 'drawImage').map((x) => (x.args[0] as { url: string }).url);

describe('the index', () => {
  it('accepts a sound one and refuses what the map cannot place', () => {
    expect(() => {
      assertTerrainTileIndex(INDEX);
    }).not.toThrow();
    expect(() => {
      assertTerrainTileIndex({ ...INDEX, artefact: 'scene-tiles' });
    }).toThrow(TerrainTilesError);
    expect(() => {
      assertTerrainTileIndex({ ...INDEX, extent: undefined });
    }).toThrow(/where it is/);
    expect(() => {
      assertTerrainTileIndex({ ...INDEX, tiles: [{ tile: 'x' }] });
    }).toThrow(/name or corner/);
    expect(() => {
      assertTerrainTileIndex({ ...INDEX, overview: undefined });
    }).toThrow(/overview/);
    expect(() => {
      assertTerrainTileIndex({ ...INDEX, tileGrid: {} });
    }).toThrow(/how big/);
  });

  it('places the council index into the Kensington map frame', () => {
    // Kensington's corner is 1,500 m east and 6,000 m north of the council's.
    expect(offsetInto(INDEX.extent, { min_e: 316500, min_n: 5814500 })).toEqual([-1500, -6000]);
  });

  it('finds the tiles on screen, and only those', () => {
    expect(visibleTiles(INDEX, zoomedIn, {}).map((t) => t.tile)).toEqual(['Tile_A']);
    expect(
      visibleTiles(INDEX, zoomedOut, {})
        .map((t) => t.tile)
        .sort(),
    ).toEqual(['Tile_A', 'Tile_B', 'Tile_C']);
  });
});

describe('what is drawn', () => {
  it('draws only the overview below tile scale, and fetches no tile', async () => {
    const l = loaders();
    const tiles = await loadTerrainTiles('/t', () => undefined, l);
    const ctx = recorder();
    drawTerrainColour(ctx, tiles, zoomedOut, {});
    drawTerrainShade(ctx, tiles, zoomedOut, {});
    expect(zoomedOut.scale).toBeLessThan(TILE_SCALE_MIN);
    expect(drawnUrls(ctx)).toEqual(['/t/overview-colour.webp', '/t/overview-shade.webp']);
    expect(l.asked.some((u) => u.includes('Tile_'))).toBe(false);
    expect(marksInView(tiles, zoomedOut, {})).toBeNull();
  });

  it('fetches the tiles in view at tile scale and redraws when they arrive', async () => {
    const l = loaders();
    let changes = 0;
    const tiles = await loadTerrainTiles(
      '/t',
      () => {
        changes += 1;
      },
      l,
    );
    drawTerrainColour(recorder(), tiles, zoomedIn, {});
    await flush();
    expect(l.asked.filter((u) => u.includes('Tile_A'))).toHaveLength(3);
    expect(l.asked.some((u) => u.includes('Tile_B'))).toBe(false);
    expect(changes).toBeGreaterThanOrEqual(2); // the overview, then the tile
  });

  it('shades a loaded tile with its own shade and never with the overview as well', async () => {
    const tiles = await loadTerrainTiles('/t', () => undefined, loaders());
    tiles.request('Tile_A');
    await flush();
    const ctx = recorder();
    drawTerrainShade(ctx, tiles, zoomedIn, {});
    const multiplied = ctx.calls.filter((x) => x.op === 'drawImage');
    expect(multiplied.map((x) => (x.args[0] as { url: string }).url)).toEqual(['/t/Tile_A/shade.webp']);
    expect(multiplied.every((x) => x.composite === 'multiply')).toBe(true);
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });

  it('keeps the overview under a tile still loading, for both colour and shade', async () => {
    const tiles = await loadTerrainTiles('/t', () => undefined, loaders());
    const colour = recorder();
    drawTerrainColour(colour, tiles, zoomedIn, {});
    expect(drawnUrls(colour)).toEqual(['/t/overview-colour.webp']);
    const shade = recorder();
    drawTerrainShade(shade, tiles, zoomedIn, {});
    expect(drawnUrls(shade)).toEqual(['/t/overview-shade.webp']);
    // Only the tile's own square of the overview: a source rectangle, nine arguments.
    expect(shade.calls.find((x) => x.op === 'drawImage')!.args).toHaveLength(9);
  });

  it('does not retry a tile that failed, and leaves the overview there', async () => {
    const l = loaders(['Tile_A/colour']);
    const tiles = await loadTerrainTiles('/t', () => undefined, l);
    tiles.request('Tile_A');
    await flush();
    tiles.request('Tile_A');
    await flush();
    expect(l.asked.filter((u) => u.includes('Tile_A/colour'))).toHaveLength(1);
    expect(tiles.tile('Tile_A')).toBeUndefined();
  });

  it('gathers the marks of the loaded tiles in view', async () => {
    const tiles = await loadTerrainTiles('/t', () => undefined, loaders());
    tiles.request('Tile_A');
    tiles.request('Tile_B');
    await flush();
    const marks = marksInView(tiles, zoomedIn, {})!;
    expect(marks.contours).toHaveLength(1);
    expect(marks.contours[0]!.c).toEqual([
      [10, 10],
      [20, 20],
    ]);
    expect(marks.spots.map((s) => s.id)).toEqual(['/t/Tile_A/marks.json']);
    expect(marks.extent).toBe(INDEX.extent);
  });

  it('forgets the least recently used tiles beyond the limit', async () => {
    const many = {
      ...INDEX,
      tiles: Array.from({ length: TILES_KEPT + 2 }, (_, i) => ({ tile: `T${String(i)}`, tx: i, ty: 0, e: i * 500, n: 0 })),
    };
    const base = loaders();
    const l = {
      image: base.image,
      json: (url: string) => (url.endsWith('index.json') ? Promise.resolve(many) : Promise.resolve({})),
    };
    const tiles = await loadTerrainTiles('/t', () => undefined, l);
    for (const t of many.tiles) tiles.request(t.tile);
    await flush();
    expect(tiles.tile('T0')).toBeUndefined();
    expect(tiles.tile(`T${String(TILES_KEPT + 1)}`)).toBeDefined();
  });

  it('draws nothing before the overview has arrived', () => {
    const tiles = new TerrainTiles('/t', INDEX, () => undefined, loaders());
    const ctx = recorder();
    drawTerrainColour(ctx, tiles, zoomedIn, {});
    drawTerrainShade(ctx, tiles, zoomedIn, {});
    expect(ctx.calls).toHaveLength(0);
    expect(tiles.ready).toBe(false);
  });
});

describe('the contour encoding', () => {
  it('adds half-metre steps back up to positions', () => {
    expect(decodeContour({ m: 3, major: false, d: [20, 40, 1, 0, 3, 2] }, 0.5).c).toEqual([
      [10, 20],
      [10.5, 20],
      [12, 21],
    ]);
  });
});
