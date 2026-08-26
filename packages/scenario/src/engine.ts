/**
 * The scenario engine.
 *
 * Answers one question and refuses the rest: **where does a blocked drain make
 * surface water build up more than it would with every drain clear, at the same
 * accumulated rainfall?**
 *
 * What it does not answer, by design (AD7, AC 2.2.e): how deep the water gets,
 * how far it spreads in absolute terms, when it arrives, or whether a flood will
 * happen. The output is a comparison against a baseline, never a standalone map.
 *
 * Every position is solved **independently from zero** rather than by stepping
 * forward from the previous one. That costs a little arithmetic and buys the
 * property AC 2.2 needs: the same inputs give the same result, and the number of
 * positions the interface chooses to show cannot change any of them.
 */

import { type WaterBalance } from './checks.js';
import {
  LEAVES_WINDOW,
  type DepressionField,
  type FlowField,
  downstreamOf,
  rainfallVolumePerCellM3,
} from './flow.js';
import type { TerrainGrid } from './terrain.js';
import type { BlockageSetting, ComparisonBand } from '@drainlens/schema';

export class EngineError extends Error {}

/** A public drain at a cell, and how much of the water reaching it it takes. */
export interface Drain {
  readonly assetNumber: string;
  readonly cell: number;
}

export interface Assumptions {
  /**
   * Fraction of the water arriving at a clear drain that enters it.
   *
   * An **assumed** value, not a measured one: it stands in for inlet geometry,
   * grate condition and approach flow, none of which the source data records.
   * Its sensitivity is what decides whether the interface may report three
   * comparison bands or two.
   */
  readonly captureFraction: number;
  /**
   * Ponded volume below which a difference is treated as no clear change, in
   * cubic metres per cell. Guards against reporting a millimetre of arithmetic
   * as a result a resident should act on.
   */
  readonly noticeableVolumeM3: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  captureFraction: 0.6,
  noticeableVolumeM3: 0.05,
};

/**
 * How much of its capture fraction a drain retains at each setting.
 *
 * A function rather than a lookup table so the compiler proves every setting is
 * handled: adding a fourth blockage setting should fail to build here, not
 * silently fall through to a default.
 */
export function blockageMultiplier(setting: BlockageSetting): number {
  switch (setting) {
    case 'clear':
      return 1;
    case 'partly-blocked':
      return 0.5;
    case 'fully-blocked':
      return 0;
  }
}

export interface PositionSolution {
  readonly accumulatedRainfallMm: number;
  /** Ponded volume per cell, cubic metres. */
  readonly pondedM3: Float32Array;
  readonly pondedCells: number;
  readonly balance: WaterBalance;
}

export interface SceneInput {
  readonly grid: TerrainGrid;
  readonly flow: FlowField;
  readonly depressions: DepressionField;
  readonly drains: readonly Drain[];
}

function validate(scene: SceneInput, assumptions: Assumptions): void {
  const cells = scene.grid.width * scene.grid.height;
  if (scene.flow.direction.length !== cells) {
    throw new EngineError('the flow field and the terrain grid describe different extents');
  }
  if (scene.depressions.cellDepression.length !== cells) {
    throw new EngineError('the depression field and the terrain grid describe different extents');
  }
  for (const drain of scene.drains) {
    if (drain.cell < 0 || drain.cell >= cells) {
      throw new EngineError(`drain ${drain.assetNumber} sits outside the calculation window`);
    }
  }
  const { captureFraction, noticeableVolumeM3 } = assumptions;
  if (!(captureFraction >= 0 && captureFraction <= 1)) {
    throw new EngineError(`capture fraction must be within 0..1, received ${String(captureFraction)}`);
  }
  if (!(noticeableVolumeM3 >= 0) || !Number.isFinite(noticeableVolumeM3)) {
    throw new EngineError('the noticeable volume must be a non-negative number of cubic metres');
  }
}

/**
 * Cells ordered from highest to lowest, so every cell is processed after
 * everything that can drain into it.
 *
 * Ties break by index, which makes the order total and therefore the whole
 * solve reproducible. Two runs that disagreed only in tie-breaking would still
 * violate AC 2.2.
 */
function descendingByElevation(grid: TerrainGrid): Int32Array {
  const order = new Int32Array(grid.width * grid.height);
  for (let i = 0; i < order.length; i += 1) order[i] = i;
  const elevation = grid.elevationM;
  return order.sort((a, b) => {
    const difference = elevation[b]! - elevation[a]!;
    return difference !== 0 ? difference : a - b;
  });
}

/**
 * Solve one accumulated-rainfall position from zero.
 *
 * Rain falls uniformly on the window. Water moves downslope one cell at a time
 * along the flow field; a drain takes its share of whatever reaches it; a
 * depression holds water up to its capacity and passes the rest to its spill
 * cell. Anything that reaches the boundary leaves.
 */
export function solvePosition(
  scene: SceneInput,
  blockage: BlockageSetting,
  blockedDrainCell: number | null,
  accumulatedRainfallMm: number,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): PositionSolution {
  validate(scene, assumptions);
  if (!Number.isFinite(accumulatedRainfallMm) || accumulatedRainfallMm < 0) {
    throw new EngineError(`accumulated rainfall must be a non-negative number of millimetres`);
  }

  const { grid, flow, depressions, drains } = scene;
  const cells = grid.width * grid.height;
  const perCell = rainfallVolumePerCellM3(grid, accumulatedRainfallMm);

  const arriving = new Float64Array(cells).fill(perCell);
  const pondedM3 = new Float32Array(cells);
  const depressionStore = new Float64Array(depressions.depressions.length);

  const captureAt = new Float64Array(cells).fill(-1);
  for (const drain of drains) {
    const multiplier =
      blockedDrainCell !== null && drain.cell === blockedDrainCell ? blockageMultiplier(blockage) : 1;
    captureAt[drain.cell] = assumptions.captureFraction * multiplier;
  }

  let captured = 0;
  let leftWindow = 0;

  const routeFrom = (start: number, volume: number): void => {
    let cell = start;
    let water = volume;
    // The flow field is acyclic by construction, but a corrupt artefact must
    // not be able to spin here forever.
    for (let step = 0; step <= cells && water > 0; step += 1) {
      if (cell === LEAVES_WINDOW) {
        leftWindow += water;
        return;
      }
      const fraction = captureAt[cell]!;
      if (fraction >= 0) {
        const taken = water * fraction;
        captured += taken;
        water -= taken;
      }
      const depressionId = depressions.cellDepression[cell]!;
      if (depressionId >= 0) {
        depressionStore[depressionId]! += water;
        return;
      }
      cell = downstreamOf(flow, cell);
    }
    if (water > 0) leftWindow += water;
  };

  for (const cell of descendingByElevation(grid)) {
    const water = arriving[cell]!;
    if (water <= 0) continue;
    arriving[cell] = 0;

    const fraction = captureAt[cell]!;
    let remaining = water;
    if (fraction >= 0) {
      const taken = remaining * fraction;
      captured += taken;
      remaining -= taken;
    }
    if (remaining <= 0) continue;

    const depressionId = depressions.cellDepression[cell]!;
    if (depressionId >= 0) {
      depressionStore[depressionId]! += remaining;
      continue;
    }
    const next = downstreamOf(flow, cell);
    if (next === LEAVES_WINDOW) {
      leftWindow += remaining;
    } else {
      arriving[next]! += remaining;
    }
  }

  // Depressions fill, then spill. Deepest spill elevation first, so a
  // depression that overflows into a lower one is resolved before it.
  const bySpill = [...depressions.depressions].sort(
    (a, b) => b.spillElevationM - a.spillElevationM || a.id - b.id,
  );
  for (const depression of bySpill) {
    const store = depressionStore[depression.id]!;
    if (store <= 0) continue;
    const held = Math.min(store, depression.capacityM3);
    const overflow = store - held;
    depressionStore[depression.id] = held;

    const share = depression.cells.length > 0 ? held / depression.cells.length : 0;
    for (const cell of depression.cells) pondedM3[cell] = share;

    if (overflow > 0) routeFrom(depression.spillCell, overflow);
  }

  let pondedVolume = 0;
  let pondedCells = 0;
  for (const volume of pondedM3) {
    if (volume > 0) {
      pondedVolume += volume;
      pondedCells += 1;
    }
  }

  return {
    accumulatedRainfallMm,
    pondedM3,
    pondedCells,
    balance: {
      rainfallVolumeM3: perCell * cells,
      capturedVolumeM3: captured,
      pondedVolumeM3: pondedVolume,
      leftWindowVolumeM3: leftWindow,
    },
  };
}

export interface ScenarioPosition {
  readonly accumulatedRainfallMm: number;
  /** Comparison band per cell. */
  readonly bands: readonly ComparisonBand[];
  readonly band: ComparisonBand;
  readonly cellsHigherThanBaseline: number;
  readonly scenarioBalance: WaterBalance;
  readonly baselineBalance: WaterBalance;
  readonly scenarioPondedCells: number;
  readonly baselinePondedCells: number;
}

export interface ScenarioOptions {
  readonly rainfallPositionsMm: readonly number[];
  readonly assumptions?: Assumptions;
}

/**
 * Run the comparison: the selected blockage against all drains clear, at each
 * accumulated-rainfall position.
 *
 * The result is the difference. No absolute ponding extent is returned, because
 * an absolute-looking layer invites a reading the model cannot support (AD7).
 */
export function runScenario(
  scene: SceneInput,
  blockage: BlockageSetting,
  blockedDrainCell: number,
  options: ScenarioOptions,
): readonly ScenarioPosition[] {
  const assumptions = options.assumptions ?? DEFAULT_ASSUMPTIONS;
  const positions = options.rainfallPositionsMm;

  if (positions.length === 0) {
    throw new EngineError('a scenario must solve at least one rainfall position');
  }
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i]! <= positions[i - 1]!) {
      throw new EngineError('rainfall positions must be strictly ascending');
    }
  }
  if (!scene.drains.some((d) => d.cell === blockedDrainCell)) {
    throw new EngineError(`no drain sits at cell ${String(blockedDrainCell)}`);
  }

  return positions.map((rainfallMm) => {
    const scenario = solvePosition(scene, blockage, blockedDrainCell, rainfallMm, assumptions);
    const baseline = solvePosition(scene, 'clear', blockedDrainCell, rainfallMm, assumptions);

    const bands: ComparisonBand[] = [];
    let higher = 0;
    for (let cell = 0; cell < scenario.pondedM3.length; cell += 1) {
      const difference = scenario.pondedM3[cell]! - baseline.pondedM3[cell]!;
      if (difference > assumptions.noticeableVolumeM3) {
        bands.push('higher-than-baseline');
        higher += 1;
      } else {
        bands.push('no-clear-change');
      }
    }

    return {
      accumulatedRainfallMm: rainfallMm,
      bands,
      band: higher > 0 ? 'higher-than-baseline' : 'no-clear-change',
      cellsHigherThanBaseline: higher,
      scenarioBalance: scenario.balance,
      baselineBalance: baseline.balance,
      scenarioPondedCells: scenario.pondedCells,
      baselinePondedCells: baseline.pondedCells,
    };
  });
}

