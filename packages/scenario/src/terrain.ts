/**
 * Terrain grids, and the synthetic surfaces the engine is verified against.
 *
 * The production surfaces come from the offline pipeline: a bare-earth DTM
 * derived from the point cloud, and a separately conditioned surface for
 * routing. Nothing here replaces them. What these fixtures provide is terrain
 * whose correct answer is known in advance, so the engine can be developed and
 * checked before any real artefact exists, and so a regression in the engine
 * shows up as a wrong number rather than as a plausible-looking map.
 */

/** A regular grid of ground elevations, row-major, north-west origin. */
export interface TerrainGrid {
  readonly width: number;
  readonly height: number;
  /** Side length of one cell, in metres. */
  readonly cellSizeM: number;
  /** Elevation in metres, length `width * height`. */
  readonly elevationM: Float32Array;
}

export class TerrainError extends Error {}

export const cellAreaM2 = (grid: TerrainGrid): number => grid.cellSizeM * grid.cellSizeM;

export const cellCount = (grid: TerrainGrid): number => grid.width * grid.height;

export function elevationAt(grid: TerrainGrid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
    throw new TerrainError(`(${String(x)}, ${String(y)}) is outside the grid`);
  }
  return grid.elevationM[y * grid.width + x]!;
}

function validateExtent(width: number, height: number, cellSizeM: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new TerrainError('grid extent must be whole numbers of at least one cell');
  }
  if (!(cellSizeM > 0) || !Number.isFinite(cellSizeM)) {
    throw new TerrainError('cell size must be a positive number of metres');
  }
}

export interface PlanarSlopeSpec {
  readonly width: number;
  readonly height: number;
  readonly cellSizeM: number;
  /** Fall per metre travelled east. 0.01 is a 1% grade. */
  readonly gradient: number;
  /** Elevation of the western edge, in metres. */
  readonly baseElevationM?: number;
}

/**
 * A uniform plane falling to the east.
 *
 * The known answer: there is nowhere for water to collect, so with every drain
 * clear nothing ponds anywhere, and all rainfall either enters a drain or
 * leaves the window at the eastern edge. An engine that reports ponding on this
 * surface has a defect, and the defect is in the routing rather than in the
 * data.
 */
export function planarSlope(spec: PlanarSlopeSpec): TerrainGrid {
  const { width, height, cellSizeM, gradient } = spec;
  validateExtent(width, height, cellSizeM);
  if (!Number.isFinite(gradient) || gradient <= 0) {
    throw new TerrainError('a planar slope needs a positive gradient, or it is not a slope');
  }
  const base = spec.baseElevationM ?? 100;
  const elevationM = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      elevationM[y * width + x] = base - gradient * x * cellSizeM;
    }
  }
  return { width, height, cellSizeM, elevationM };
}

export interface BowlSpec {
  readonly width: number;
  readonly height: number;
  readonly cellSizeM: number;
  /** Depth of the depression below the surrounding plane, in metres. */
  readonly depthM: number;
  /** Width and height of the depression, in cells. */
  readonly pitWidth: number;
  readonly pitHeight: number;
  readonly baseElevationM?: number;
}

export interface BowlFixture {
  readonly grid: TerrainGrid;
  /** Cell indices inside the depression. */
  readonly depressionCells: readonly number[];
  /**
   * Exactly how much water the depression holds before it spills, in cubic
   * metres. Rectangular and flat-bottomed on purpose: the volume is a product
   * of three numbers rather than something the test has to approximate.
   */
  readonly capacityM3: number;
  /** Elevation at which the depression overflows, in metres. */
  readonly spillElevationM: number;
}

/**
 * A flat plane with one rectangular, flat-bottomed depression in the middle.
 *
 * The known answer: rainfall accumulates in the depression until `capacityM3`
 * is reached, and only then does any of it leave. This is the fixture that
 * catches the fork-order defect described in the architecture — if depressions
 * were characterised on a conditioned surface rather than the raw one, the
 * storage volume disappears and this fixture reports zero.
 */
export function bowl(spec: BowlSpec): BowlFixture {
  const { width, height, cellSizeM, depthM, pitWidth, pitHeight } = spec;
  validateExtent(width, height, cellSizeM);
  if (!(depthM > 0) || !Number.isFinite(depthM)) {
    throw new TerrainError('a bowl needs a positive depth');
  }
  if (pitWidth < 1 || pitHeight < 1 || pitWidth > width - 2 || pitHeight > height - 2) {
    throw new TerrainError('the depression must fit inside the grid with a rim on every side');
  }

  const base = spec.baseElevationM ?? 100;
  const elevationM = new Float32Array(width * height).fill(base);

  const x0 = Math.floor((width - pitWidth) / 2);
  const y0 = Math.floor((height - pitHeight) / 2);
  const depressionCells: number[] = [];
  for (let y = y0; y < y0 + pitHeight; y += 1) {
    for (let x = x0; x < x0 + pitWidth; x += 1) {
      const i = y * width + x;
      elevationM[i] = base - depthM;
      depressionCells.push(i);
    }
  }

  return {
    grid: { width, height, cellSizeM, elevationM },
    depressionCells,
    capacityM3: depressionCells.length * cellSizeM * cellSizeM * depthM,
    spillElevationM: base,
  };
}
