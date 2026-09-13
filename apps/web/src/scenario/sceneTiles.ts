/**
 * The council's scenario terrain, as a window stitched from four tiles.
 *
 * `scene.ts` loads Kensington's square kilometre whole. The council's measured
 * ground is fifty times that, so the pipeline cuts it on the point cloud's
 * 500 m grid (`drainlens_pipeline.scene_tiles`) and this file fetches the four
 * tiles around the chosen drain and puts them back together as one kilometre
 * — the window size every measurement of this model was made on.
 *
 * Three things change at a window's edge, and each is handled here rather
 * than left to the engine to trip over:
 *
 * - **A flow direction pointing out of the window becomes "leaves".** The
 *   council-wide flow field routes water on into the next tile; the window
 *   stops following it there, exactly as Kensington's edge always did.
 * - **A depression the window cuts is not a depression in it.** Its capacity
 *   is the whole hollow's, and handing the engine that capacity over a part of
 *   its cells would store water that is not there. Its cells become ordinary
 *   ground, which is the conservative reading.
 * - **A spill cell outside the window becomes "leaves".**
 */

import { LEAVES_WINDOW } from '@drainlens/scenario';
import type { Depression, DepressionField } from '@drainlens/scenario';

import { type LoadedScene, type SceneHeader, SceneError, unpackBits } from './scene.js';

export interface TileIndex {
  readonly artefact: 'scene-tiles';
  readonly version: number;
  readonly extent: {
    readonly name: string;
    readonly min_e: number;
    readonly min_n: number;
    readonly width_m: number;
    readonly height_m: number;
  };
  readonly grid: { readonly rows: number; readonly cols: number; readonly cellSizeM: number };
  readonly tileGrid: {
    readonly originE: number;
    readonly originN: number;
    readonly sizeM: number;
    readonly cells: number;
  };
  readonly window: { readonly tiles: number };
  readonly arrays: {
    readonly elevation: { readonly file: string; readonly scale: number };
    readonly flow: { readonly file: string };
    readonly depressions: { readonly file: string };
    readonly 'rim-depth': { readonly file: string; readonly scale: number };
    readonly measured: { readonly file: string };
  };
  readonly tiles: readonly {
    readonly tile: string;
    readonly tx: number;
    readonly ty: number;
    readonly origin: readonly [number, number];
  }[];
  /** Asset number → the south-west tile (tx, ty) of the window it is calculated in. */
  readonly windows: Readonly<Record<string, readonly [number, number]>>;
  /** Inlets with no window of four measured tiles around them. */
  readonly inletsWithoutWindow?: readonly string[];
  readonly note: string;
}

export interface TileMeta {
  readonly tile: string;
  readonly origin: readonly [number, number];
  readonly depressions: readonly {
    readonly id: number;
    readonly cellCount: number;
    readonly capacityM3: number;
    readonly spillElevationM: number;
    readonly spill: readonly [number, number];
  }[];
  readonly drains: readonly {
    readonly assetNumber: string;
    readonly cell: readonly [number, number];
    readonly isInlet: boolean;
  }[];
}

export function assertTileIndex(value: unknown): asserts value is TileIndex {
  const index = value as Partial<TileIndex> | null;
  if (!index || typeof index !== 'object' || index.artefact !== 'scene-tiles') {
    throw new SceneError('expected the scene tile index');
  }
  if (index.version !== 1) throw new SceneError(`scene tile index version ${String(index.version)} is not understood`);
  if (!index.tileGrid || !(index.tileGrid.cells > 0) || !index.window || index.window.tiles !== 2) {
    throw new SceneError('the scene tile index does not describe its tiles');
  }
  if (!Array.isArray(index.tiles) || !index.windows || typeof index.windows !== 'object') {
    throw new SceneError('the scene tile index lists no tiles or windows');
  }
}

/** The name the archive, the pipeline and the files all use for a tile. */
export const tileName = (tx: number, ty: number): string =>
  `Tile_${tx < 0 ? '-' : '+'}${String(Math.abs(tx)).padStart(3, '0')}_${ty < 0 ? '-' : '+'}${String(Math.abs(ty)).padStart(3, '0')}`;

/** A window's key, for caching and for asking the worker about it. */
export const windowKey = (window: readonly [number, number]): string => `${String(window[0])},${String(window[1])}`;

/** D8 offsets as (column step, row step), matching `@drainlens/scenario`. */
const D8: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export interface TileArrays {
  readonly meta: TileMeta;
  readonly elevation: Int16Array;
  readonly flow: Int8Array;
  readonly depressions: Int16Array;
  readonly rimDepth: Int16Array;
  readonly measured: Uint8Array;
}

/**
 * Stitch four tiles into the window a scenario is calculated in.
 *
 * Pure, so the edge rules can be tested on tiles a few cells wide. `tiles`
 * maps a tile name to its arrays; all four must be present.
 */
export function stitchWindow(
  index: TileIndex,
  window: readonly [number, number],
  tiles: ReadonlyMap<string, TileArrays>,
): LoadedScene {
  const size = index.tileGrid.cells;
  const span = index.window.tiles;
  const width = size * span;
  const height = size * span;
  const cells = width * height;
  const [tx0, ty0] = window;

  const elevationM = new Float32Array(cells);
  const direction = new Int8Array(cells);
  const labels = new Int32Array(cells).fill(-1);
  const rimDepthM = new Float32Array(cells);
  const measured = new Uint8Array(cells);

  // The window's north-west corner on the council grid.
  const northWest = tiles.get(tileName(tx0, ty0 + span - 1))?.meta.origin;
  if (northWest === undefined) throw new SceneError(`tile ${tileName(tx0, ty0 + span - 1)} is not loaded`);
  const [windowRow, windowCol] = northWest;

  const inWindow = (row: number, col: number): boolean =>
    row >= windowRow && row < windowRow + height && col >= windowCol && col < windowCol + width;

  const elevationScale = index.arrays.elevation.scale;
  const rimScale = index.arrays['rim-depth'].scale;
  const cellsById = new Map<number, number[]>();
  const table = new Map<number, TileMeta['depressions'][number]>();
  const drains: { assetNumber: string; cell: number; isInlet: boolean }[] = [];

  for (let i = 0; i < span; i += 1) {
    for (let j = 0; j < span; j += 1) {
      const name = tileName(tx0 + i, ty0 + j);
      const tile = tiles.get(name);
      if (tile === undefined) throw new SceneError(`tile ${name} is not loaded`);
      const [tileRow, tileCol] = tile.meta.origin;
      const offsetRow = tileRow - windowRow;
      const offsetCol = tileCol - windowCol;
      if (offsetRow < 0 || offsetCol < 0 || offsetRow + size > height || offsetCol + size > width) {
        throw new SceneError(`tile ${name} does not sit inside window ${windowKey(window)}`);
      }
      const expected = size * size;
      for (const [label, array] of [
        ['elevation', tile.elevation],
        ['flow', tile.flow],
        ['depressions', tile.depressions],
        ['rim-depth', tile.rimDepth],
      ] as const) {
        if (array.length !== expected) {
          throw new SceneError(`tile ${name} ${label} holds ${String(array.length)} cells, not ${String(expected)}`);
        }
      }
      const bits = unpackBits(tile.measured, expected);

      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          const from = r * size + c;
          const row = offsetRow + r;
          const col = offsetCol + c;
          const to = row * width + col;
          elevationM[to] = tile.elevation[from]! / elevationScale;
          rimDepthM[to] = tile.rimDepth[from]! / rimScale;
          measured[to] = bits[from]!;

          const code = tile.flow[from]!;
          if (code === LEAVES_WINDOW) {
            direction[to] = LEAVES_WINDOW;
          } else {
            const [dc, dr] = D8[code] ?? [0, 0];
            const nr = row + dr;
            const nc = col + dc;
            direction[to] = nr >= 0 && nr < height && nc >= 0 && nc < width ? code : LEAVES_WINDOW;
          }

          const id = tile.depressions[from]!;
          if (id >= 0) {
            const held = cellsById.get(id);
            if (held === undefined) cellsById.set(id, [to]);
            else held.push(to);
          }
        }
      }

      for (const entry of tile.meta.depressions) table.set(entry.id, entry);
      for (const drain of tile.meta.drains) {
        const [row, col] = drain.cell;
        if (!inWindow(row, col)) continue;
        drains.push({
          assetNumber: drain.assetNumber,
          cell: (row - windowRow) * width + (col - windowCol),
          isInlet: drain.isInlet,
        });
      }
    }
  }

  /*
    **Renumbered 0..n-1 in the window.** The engine indexes its depression
    stores by id, as offsets into arrays sized to the depression count. The
    council's ids run past 21,000 and a window keeps a few hundred, so the
    council ids wrote past the end of those arrays -- where a typed array
    silently drops the write -- and 70% of the rain in the first window tried
    vanished. The mass-balance check refused the comparison, which is the only
    reason it was an error message and not a map.
  */
  const depressions: Depression[] = [];
  const headerDepressions: SceneHeader['depressions'][number][] = [];
  const whole = [...cellsById]
    .filter(([id, cellsIn]) => {
      const entry = table.get(id);
      // Whole hollows only. See the note at the top of this file.
      return entry !== undefined && cellsIn.length === entry.cellCount;
    })
    .sort(([a], [b]) => a - b);
  for (const [local, [id, cellsIn]] of whole.entries()) {
    const entry = table.get(id)!;
    const [spillRow, spillCol] = entry.spill;
    const spillCell = inWindow(spillRow, spillCol)
      ? (spillRow - windowRow) * width + (spillCol - windowCol)
      : LEAVES_WINDOW;
    depressions.push({
      id: local,
      cells: cellsIn,
      capacityM3: entry.capacityM3,
      spillElevationM: entry.spillElevationM,
      spillCell,
    });
    headerDepressions.push({
      id: local,
      cellCount: entry.cellCount,
      capacityM3: entry.capacityM3,
      spillElevationM: entry.spillElevationM,
      spillCell,
    });
    for (const cell of cellsIn) labels[cell] = local;
  }

  const cellSizeM = index.grid.cellSizeM;
  const minE = index.extent.min_e + windowCol * cellSizeM;
  const minN = index.extent.min_n + (index.grid.rows - windowRow - height) * cellSizeM;

  const header: SceneHeader = {
    artefact: 'scene',
    version: 1,
    grid: { rows: height, cols: width, cellSizeM, origin: 'north-west' },
    extent: {
      name: `window ${windowKey(window)}`,
      min_e: minE,
      min_n: minN,
      width_m: width * cellSizeM,
      height_m: height * cellSizeM,
    },
    arrays: {
      elevation: { file: index.arrays.elevation.file, scale: elevationScale },
      flow: { file: index.arrays.flow.file },
      depressions: { file: index.arrays.depressions.file },
      coverage: { file: '' },
    },
    depressions: headerDepressions,
    drains,
    note: index.note,
  };

  const field: DepressionField = { cellDepression: labels, depressions };
  let measuredCells = 0;
  for (let cell = 0; cell < cells; cell += 1) measuredCells += measured[cell]!;
  return {
    header,
    grid: { width, height, cellSizeM, elevationM },
    flow: { width, height, direction },
    depressions: field,
    // Every tile in a window is a tile the archive has, or the window would
    // not have been offered.
    coverage: new Uint8Array(cells).fill(1),
    rimDepthM,
    measuredShare: measuredCells / cells,
  };
}

export interface TileFetcher {
  readonly json: (url: string) => Promise<unknown>;
  /** The decompressed bytes of a gzipped file. */
  readonly gunzip: (url: string) => Promise<ArrayBuffer>;
}

/**
 * The bytes of a gzipped file, decompressed exactly once.
 *
 * Whether the browser has already done it depends on the server. nginx sends
 * the tiles as `application/gzip` and they arrive compressed; the Vite dev
 * server labels them `Content-Encoding: gzip`, the browser undoes that itself,
 * and decompressing again fails. So the magic number decides, not the server.
 */
export async function gunzipOnce(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

const browserFetcher: TileFetcher = {
  json: (url) => fetch(url).then((response) => response.json()),
  gunzip: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new SceneError(`${url} answered ${String(response.status)}`);
    return gunzipOnce(await response.arrayBuffer());
  },
};

export async function loadIndex(base: string, fetcher: TileFetcher = browserFetcher): Promise<TileIndex> {
  const index = await fetcher.json(`${base}/index.json`);
  assertTileIndex(index);
  return index;
}

export async function loadWindow(
  base: string,
  index: TileIndex,
  window: readonly [number, number],
  fetcher: TileFetcher = browserFetcher,
): Promise<LoadedScene> {
  const names: string[] = [];
  for (let i = 0; i < index.window.tiles; i += 1) {
    for (let j = 0; j < index.window.tiles; j += 1) names.push(tileName(window[0] + i, window[1] + j));
  }
  const known = new Set(index.tiles.map((t) => t.tile));
  const missing = names.filter((name) => !known.has(name));
  if (missing.length > 0) throw new SceneError(`window ${windowKey(window)} needs ${missing.join(', ')}, which the index does not have`);

  const loaded = await Promise.all(
    names.map(async (name): Promise<[string, TileArrays]> => {
      const dir = `${base}/${name}`;
      const [meta, elevation, flow, depressions, rimDepth, measured] = await Promise.all([
        fetcher.json(`${dir}/tile.json`),
        fetcher.gunzip(`${dir}/${index.arrays.elevation.file}`),
        fetcher.gunzip(`${dir}/${index.arrays.flow.file}`),
        fetcher.gunzip(`${dir}/${index.arrays.depressions.file}`),
        fetcher.gunzip(`${dir}/${index.arrays['rim-depth'].file}`),
        fetcher.gunzip(`${dir}/${index.arrays.measured.file}`),
      ]);
      return [
        name,
        {
          meta: meta as TileMeta,
          elevation: new Int16Array(elevation),
          flow: new Int8Array(flow),
          depressions: new Int16Array(depressions),
          rimDepth: new Int16Array(rimDepth),
          measured: new Uint8Array(measured),
        },
      ];
    }),
  );
  return stitchWindow(index, window, new Map(loaded));
}
