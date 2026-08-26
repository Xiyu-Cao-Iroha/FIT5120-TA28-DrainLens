/**
 * D8 flow directions and depression storage — the two terrain artefacts the
 * engine consumes.
 *
 * In production both are produced offline by the pipeline: the flow field from
 * a hydrologically conditioned surface with building footprints as barriers,
 * and the depression tables from the *raw* bare-earth surface, because
 * conditioning removes exactly the storage volumes this engine needs.
 *
 * `d8FromElevations` in this file is for fixtures only. It is not the
 * production routing and is not a substitute for it.
 */

import { type TerrainGrid, TerrainError, cellAreaM2 } from './terrain.js';

/** Water leaves the calculation window from this cell. */
export const LEAVES_WINDOW = -1;

/** Offsets for the eight D8 codes, in order: E, SE, S, SW, W, NW, N, NE. */
export const D8_OFFSETS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export interface FlowField {
  readonly width: number;
  readonly height: number;
  /** D8 code 0–7 per cell, or `LEAVES_WINDOW`. */
  readonly direction: Int8Array;
}

/**
 * A depression, characterised on the raw surface.
 *
 * `capacityM3` is how much it holds before it spills; `spillCell` is where the
 * overflow goes. A depression that spills out of the window has
 * `spillCell === LEAVES_WINDOW`.
 */
export interface Depression {
  readonly id: number;
  readonly cells: readonly number[];
  readonly capacityM3: number;
  readonly spillElevationM: number;
  readonly spillCell: number;
}

export interface DepressionField {
  /** Depression id per cell, or -1 where the cell is not in one. */
  readonly cellDepression: Int32Array;
  readonly depressions: readonly Depression[];
}

/**
 * Steepest-descent D8 for a synthetic surface. **Fixtures only.**
 *
 * Ties are broken by the lowest direction code so the result is deterministic —
 * a fixture that routed differently between runs would make every test built on
 * it untrustworthy.
 */
export function d8FromElevations(grid: TerrainGrid): FlowField {
  const { width, height, elevationM, cellSizeM } = grid;
  const direction = new Int8Array(width * height).fill(LEAVES_WINDOW);
  const diagonal = Math.SQRT2 * cellSizeM;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const here = y * width + x;
      const z = elevationM[here]!;
      let bestCode = LEAVES_WINDOW;
      let bestDrop = 0;

      for (const [code, [dx, dy]] of D8_OFFSETS.entries()) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const distance = dx !== 0 && dy !== 0 ? diagonal : cellSizeM;
        const drop = (z - elevationM[ny * width + nx]!) / distance;
        if (drop > bestDrop) {
          bestDrop = drop;
          bestCode = code;
        }
      }
      direction[here] = bestCode;
    }
  }
  return { width, height, direction };
}

/**
 * Where water on `cell` goes next, or `LEAVES_WINDOW`.
 *
 * A direction that would step outside the grid also means the water leaves —
 * the window boundary is an exit, not a wall.
 */
export function downstreamOf(flow: FlowField, cell: number): number {
  const code = flow.direction[cell];
  if (code === undefined || code === LEAVES_WINDOW) return LEAVES_WINDOW;
  const offset = D8_OFFSETS[code];
  if (offset === undefined) return LEAVES_WINDOW;
  const [dx, dy] = offset;
  const x = (cell % flow.width) + dx;
  const y = Math.floor(cell / flow.width) + dy;
  if (x < 0 || y < 0 || x >= flow.width || y >= flow.height) return LEAVES_WINDOW;
  return y * flow.width + x;
}

/**
 * Build a depression field from a set of cells with a known capacity.
 *
 * In production this comes from the pipeline's elevation–volume tables. Here it
 * exists so a fixture can state its own answer.
 */
export function depressionFieldFrom(
  grid: TerrainGrid,
  depressions: readonly Depression[],
): DepressionField {
  const cellDepression = new Int32Array(grid.width * grid.height).fill(-1);
  for (const depression of depressions) {
    for (const cell of depression.cells) {
      if (cell < 0 || cell >= cellDepression.length) {
        throw new TerrainError(`depression ${String(depression.id)} names a cell outside the grid`);
      }
      cellDepression[cell] = depression.id;
    }
  }
  return { cellDepression, depressions };
}

/** Volume of rain falling on one cell, in cubic metres. */
export const rainfallVolumePerCellM3 = (grid: TerrainGrid, rainfallMm: number): number =>
  (rainfallMm / 1000) * cellAreaM2(grid);
