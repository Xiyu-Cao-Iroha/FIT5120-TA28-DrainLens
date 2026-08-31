/**
 * Loading the packed terrain and turning it back into what the engine takes.
 *
 * The arrays arrive as separate files rather than one blob on purpose. A
 * single packed buffer is one byte-offset mistake away from reading the
 * elevation grid as flow directions, and nothing about that failure looks
 * wrong until water runs uphill in a screenshot somebody has already shown a
 * room.
 *
 * Elevation comes back as centimetres in an int16 and is scaled here, once.
 * The scale lives in the header rather than in this file so a change to the
 * packing cannot leave the reader believing the old one.
 */

import type { Depression, DepressionField, FlowField, TerrainGrid } from '@drainlens/scenario';

export interface SceneHeader {
  readonly artefact: 'scene';
  readonly version: number;
  readonly grid: {
    readonly rows: number;
    readonly cols: number;
    readonly cellSizeM: number;
    readonly origin: string;
  };
  readonly extent: {
    readonly name: string;
    readonly min_e: number;
    readonly min_n: number;
    readonly width_m: number;
    readonly height_m: number;
  };
  readonly arrays: {
    readonly elevation: { readonly file: string; readonly scale: number };
    readonly flow: { readonly file: string };
    readonly depressions: { readonly file: string };
    readonly coverage: { readonly file: string };
  };
  readonly depressions: readonly {
    readonly id: number;
    readonly cellCount: number;
    readonly capacityM3: number;
    readonly spillElevationM: number;
    readonly spillCell: number;
  }[];
  readonly drains: readonly {
    readonly assetNumber: string;
    readonly cell: number;
    readonly isInlet: boolean;
  }[];
  readonly note: string;
}

export class SceneError extends Error {}

export interface LoadedScene {
  readonly header: SceneHeader;
  readonly grid: TerrainGrid;
  readonly flow: FlowField;
  readonly depressions: DepressionField;
  readonly coverage: Uint8Array;
}

/** Expand a bitmask, most significant bit first, to one byte per cell. */
export function unpackBits(packed: Uint8Array, cells: number): Uint8Array {
  const out = new Uint8Array(cells);
  for (let index = 0; index < cells; index += 1) {
    const byte = packed[index >> 3];
    if (byte === undefined) break;
    out[index] = (byte >> (7 - (index & 7))) & 1;
  }
  return out;
}

/**
 * Rebuild the per-cell depression index the engine wants.
 *
 * The pipeline ships an int16 raster because 486 depressions fit and it halves
 * the payload; the engine's field is Int32Array. Widening here rather than
 * shipping wide keeps a megabyte off the wire for a number that never exceeds
 * a few hundred.
 */
export function depressionFieldFrom(
  labels: Int16Array,
  table: SceneHeader['depressions'],
  cells: number,
): DepressionField {
  if (labels.length !== cells) {
    throw new SceneError(`the depression raster has ${labels.length} cells, not ${cells}`);
  }

  const byId = new Map<number, number[]>();
  for (let cell = 0; cell < cells; cell += 1) {
    const id = labels[cell]!;
    if (id < 0) continue;
    const held = byId.get(id);
    if (held === undefined) byId.set(id, [cell]);
    else held.push(cell);
  }

  const depressions: Depression[] = [];
  for (const entry of table) {
    const cellsIn = byId.get(entry.id);
    // A hollow the raster does not place is dropped rather than given an empty
    // footprint. An empty depression would advertise storage at no location,
    // and the engine would fill it forever.
    if (cellsIn === undefined || cellsIn.length === 0) continue;
    depressions.push({
      id: entry.id,
      cells: cellsIn,
      capacityM3: entry.capacityM3,
      spillElevationM: entry.spillElevationM,
      spillCell: entry.spillCell,
    });
  }

  const cellDepression = new Int32Array(cells);
  cellDepression.fill(-1);
  for (const depression of depressions) {
    for (const cell of depression.cells) cellDepression[cell] = depression.id;
  }
  return { cellDepression, depressions };
}

export function assertScene(value: unknown): asserts value is SceneHeader {
  const header = value as Partial<SceneHeader> | null;
  if (!header || typeof header !== 'object') throw new SceneError('the scene header is not an object');
  if (header.artefact !== 'scene') {
    throw new SceneError(`expected a scene artefact, got ${String(header.artefact)}`);
  }
  const grid = header.grid;
  if (!grid || !(grid.rows > 0) || !(grid.cols > 0) || !(grid.cellSizeM > 0)) {
    throw new SceneError('the scene declares a grid with no area');
  }
  const scale = header.arrays?.elevation?.scale;
  if (typeof scale !== 'number' || !(scale > 0)) {
    // Without it, centimetres are read as metres and the extent becomes a
    // three-kilometre cliff that still routes water perfectly well.
    throw new SceneError('the scene does not say how to scale its elevations');
  }
  if (!Array.isArray(header.drains) || header.drains.length === 0) {
    throw new SceneError('the scene carries no drains, so no blockage scenario can be set');
  }
}

export interface Fetcher {
  (url: string): Promise<ArrayBuffer>;
}

const fetchBuffer: Fetcher = (url) => fetch(url).then((response) => response.arrayBuffer());

/** Load the scene, one request per array so nothing depends on packing order. */
export async function loadScene(
  base: string,
  {
    fetchJson = (url: string) => fetch(url).then((r) => r.json()),
    fetchBinary = fetchBuffer,
  }: {
    fetchJson?: (url: string) => Promise<unknown>;
    fetchBinary?: Fetcher;
  } = {},
): Promise<LoadedScene> {
  const header = await fetchJson(`${base}/scene.json`);
  assertScene(header);

  const cells = header.grid.rows * header.grid.cols;
  const [elevationRaw, flowRaw, depressionRaw, coverageRaw] = await Promise.all([
    fetchBinary(`${base}/${header.arrays.elevation.file}`),
    fetchBinary(`${base}/${header.arrays.flow.file}`),
    fetchBinary(`${base}/${header.arrays.depressions.file}`),
    fetchBinary(`${base}/${header.arrays.coverage.file}`),
  ]);

  const centimetres = new Int16Array(elevationRaw);
  if (centimetres.length !== cells) {
    throw new SceneError(
      `the elevation array holds ${centimetres.length} cells but the grid is ${cells}`,
    );
  }

  const scale = header.arrays.elevation.scale;
  const elevationM = new Float32Array(cells);
  for (let cell = 0; cell < cells; cell += 1) elevationM[cell] = centimetres[cell]! / scale;

  const direction = new Int8Array(flowRaw);
  if (direction.length !== cells) {
    throw new SceneError(`the flow array holds ${direction.length} cells but the grid is ${cells}`);
  }

  return {
    header,
    grid: {
      width: header.grid.cols,
      height: header.grid.rows,
      cellSizeM: header.grid.cellSizeM,
      elevationM,
    },
    flow: { width: header.grid.cols, height: header.grid.rows, direction },
    depressions: depressionFieldFrom(new Int16Array(depressionRaw), header.depressions, cells),
    coverage: unpackBits(new Uint8Array(coverageRaw), cells),
  };
}
