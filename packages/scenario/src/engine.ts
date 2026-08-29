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

import { type WaterBalance, checkMassBalance } from './checks.js';
import {
  LEAVES_WINDOW,
  type DepressionField,
  type FlowField,
  downstreamOf,
  rainfallVolumePerCellM3,
} from './flow.js';
import type { TerrainGrid } from './terrain.js';
import type {
  BlockageSetting,
  ComparisonBand,
  InsufficiencyReason,
  NetworkLimitation,
} from '@drainlens/schema';

export class EngineError extends Error {}

/** A public drain at a cell, and how much of the water reaching it it takes. */
export interface Drain {
  readonly assetNumber: string;
  readonly cell: number;
  /**
   * Whether this asset is a place surface water enters the network.
   *
   * Only an inlet can carry a blockage scenario: setting a Junction or a
   * Submerged node to "blocked" would answer a question about a pipe the
   * surface model does not represent. Defaults to true so fixtures stay terse.
   */
  readonly isInlet?: boolean;
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
  /**
   * How much of the calculation window must be covered by terrain artefacts
   * before a comparison is attempted.
   *
   * Defaults to 1: the whole window. A comparison over a partly covered window
   * is not comparable with one over a full window, and lowering this is an
   * assumption that belongs in the register rather than in a caller's head.
   */
  readonly minimumCoveredFraction: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  captureFraction: 0.6,
  noticeableVolumeM3: 0.05,
  minimumCoveredFraction: 1,
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
  /**
   * 1 where a terrain artefact covers the cell, 0 where none does. Absent means
   * the whole window is covered, which is what every fixture assumes.
   */
  readonly coverage?: Uint8Array;
  /**
   * Limitations the traversal service found in the recorded network. They
   * travel with a successful result and never turn one into an insufficiency:
   * where a pipe leads has no bearing on the surface calculation.
   */
  readonly networkLimitations?: readonly NetworkLimitation[];
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
 * Cells ordered so that every one is solved before whatever it drains into.
 *
 * Taken from the flow field itself, not from the elevations. Sorting by
 * elevation is a proxy for this and it holds only while the surface strictly
 * decreases along every flow path — which a conditioned surface tries to
 * guarantee with a nudge of a hundredth of a millimetre per step, and which no
 * finite representation of that surface can keep. On the real Kensington
 * artefact at single precision, 509 of a million cells ended up exactly level
 * with the cell they drain into. Each is a place where the order is arbitrary
 * and water passed downstream lands on a cell already solved, where it is
 * never read again: 27% of the rainfall disappeared, and only the mass-balance
 * check stood between that and a plausible-looking map.
 *
 * The flow field is a forest of paths to the boundary, so Kahn's algorithm on
 * it is exact by construction and needs no tolerance. Cells with nothing
 * upstream come first, in index order, which keeps the whole solve
 * reproducible — two runs disagreeing only in tie-breaking would still violate
 * AC 2.2.
 */
export function upstreamFirst(flow: FlowField): Int32Array {
  const cells = flow.width * flow.height;
  const upstreamCount = new Int32Array(cells);
  for (let cell = 0; cell < cells; cell += 1) {
    const next = downstreamOf(flow, cell);
    if (next !== LEAVES_WINDOW) upstreamCount[next]! += 1;
  }

  const order = new Int32Array(cells);
  const queue = new Int32Array(cells);
  let head = 0;
  let tail = 0;
  for (let cell = 0; cell < cells; cell += 1) {
    if (upstreamCount[cell] === 0) queue[tail++] = cell;
  }

  let written = 0;
  while (head < tail) {
    const cell = queue[head++]!;
    order[written++] = cell;
    const next = downstreamOf(flow, cell);
    if (next !== LEAVES_WINDOW && --upstreamCount[next]! === 0) queue[tail++] = next;
  }

  // A cycle would leave cells unqueued. The field is acyclic by construction
  // and the pipeline checks it, but a corrupt artefact must not silently drop
  // the cells it strands — they are appended so every cell is still solved,
  // and the mass balance is left to notice if the routing was nonsense.
  if (written < cells) {
    for (let cell = 0; cell < cells; cell += 1) {
      if (upstreamCount[cell]! > 0) order[written++] = cell;
    }
  }
  return order;
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

  for (const cell of upstreamFirst(flow)) {
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

  // Depressions fill, then spill — and what spills can reach another
  // depression, which may already have been resolved. A single pass ordered by
  // rim height assumes those chains always run downhill in rim terms, and on
  // real terrain they do not: a deep pit in low ground can have a higher rim
  // than the shallow hollow feeding it. Water landing in an already-resolved
  // store was then stranded there, counted as neither ponded nor passed on.
  // That leak was 27% of the rainfall on the Kensington artefact.
  //
  // So the passes repeat until nothing moves. `held` accumulates separately
  // from the unresolved inflow, so a depression revisited with more water
  // fills further rather than being counted twice. The bound is one pass per
  // depression plus one: each pass either resolves at least one store or ends
  // the loop, and a corrupt field that somehow cycled cannot spin here.
  const bySpill = [...depressions.depressions].sort(
    (a, b) => b.spillElevationM - a.spillElevationM || a.id - b.id,
  );
  const heldM3 = new Float64Array(depressions.depressions.length);

  for (let pass = 0; pass <= depressions.depressions.length; pass += 1) {
    let moved = false;
    for (const depression of bySpill) {
      const arrivingHere = depressionStore[depression.id]!;
      if (arrivingHere <= 0) continue;
      depressionStore[depression.id] = 0;
      moved = true;

      const room = Math.max(depression.capacityM3 - heldM3[depression.id]!, 0);
      const taken = Math.min(arrivingHere, room);
      heldM3[depression.id]! += taken;

      const overflow = arrivingHere - taken;
      if (overflow > 0) routeFrom(depression.spillCell, overflow);
    }
    if (!moved) break;
  }

  // Anything still unresolved after the bound would be a cycle in the spill
  // graph. It leaves the window rather than vanishing: the balance must
  // account for every drop, and an honest overflow is better than a silent
  // loss that only the mass-balance check would catch.
  for (let id = 0; id < depressionStore.length; id += 1) {
    if (depressionStore[id]! > 0) {
      leftWindow += depressionStore[id]!;
      depressionStore[id] = 0;
    }
  }

  for (const depression of depressions.depressions) {
    const held = heldM3[depression.id]!;
    if (held <= 0 || depression.cells.length === 0) continue;
    const share = held / depression.cells.length;
    for (const cell of depression.cells) pondedM3[cell] = share;
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
 * The outcome of a comparison.
 *
 * Either the comparison was made, or it could not be — and the second case
 * carries the reason rather than a shrug. `no-clear-change` and
 * `insufficient-information` are deliberately different things: the first means
 * the calculation ran and found no difference, the second means it could not be
 * made at all. A resident acting on "no clear change" is reasonable; a resident
 * acting on it when we never looked is not.
 */
export type ComparisonOutcome =
  | {
      readonly status: 'successful';
      readonly positions: readonly ScenarioPosition[];
      readonly networkLimitations: readonly NetworkLimitation[];
    }
  | { readonly status: 'insufficient-information'; readonly reason: InsufficiencyReason };

const insufficient = (reason: InsufficiencyReason): ComparisonOutcome => ({
  status: 'insufficient-information',
  reason,
});

/**
 * Fraction of the window a terrain artefact covers. No coverage mask means the
 * artefacts cover everything, which is what fixtures assume.
 */
function coveredFraction(scene: SceneInput): number {
  const cells = scene.grid.width * scene.grid.height;
  if (scene.coverage === undefined) return 1;
  if (scene.coverage.length !== cells) return 0;
  let covered = 0;
  for (const flag of scene.coverage) if (flag !== 0) covered += 1;
  return cells === 0 ? 0 : covered / cells;
}

/**
 * Run the comparison: the selected blockage against all drains clear, at each
 * accumulated-rainfall position.
 *
 * The result is the difference. No absolute ponding extent is returned, because
 * an absolute-looking layer invites a reading the model cannot support (AD7).
 *
 * Before computing anything it applies a **data-sufficiency gate**. The gate
 * runs in a deliberate order, cheapest and most decisive first, so the reason a
 * resident sees is the one that actually stopped the comparison rather than
 * whichever check happened to run first.
 */
export function runScenario(
  scene: SceneInput,
  blockage: BlockageSetting,
  blockedDrainCell: number,
  options: ScenarioOptions,
): ComparisonOutcome {
  const assumptions = options.assumptions ?? DEFAULT_ASSUMPTIONS;
  const positions = options.rainfallPositionsMm;

  // Caller errors, not data insufficiency: an empty or unordered position list
  // is a defect in the code that built it, and hiding it behind a friendly
  // status would let it ship.
  if (positions.length === 0) {
    throw new EngineError('a scenario must solve at least one rainfall position');
  }
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i]! <= positions[i - 1]!) {
      throw new EngineError('rainfall positions must be strictly ascending');
    }
  }

  // 1. Terrain. Without a covered window there is nothing to route water over.
  if (coveredFraction(scene) < assumptions.minimumCoveredFraction) {
    return insufficient('terrain_unavailable');
  }

  // 2. The selected asset. A pit that is not an inlet cannot carry a surface
  //    blockage scenario, and neither can a cell with no drain at all.
  const selected = scene.drains.find((d) => d.cell === blockedDrainCell);
  if (selected === undefined || selected.isInlet === false) {
    return insufficient('invalid_inlet');
  }

  // 3. The calculation itself.
  let solved: readonly { scenario: PositionSolution; baseline: PositionSolution }[];
  try {
    solved = positions.map((rainfallMm) => ({
      scenario: solvePosition(scene, blockage, blockedDrainCell, rainfallMm, assumptions),
      baseline: solvePosition(scene, 'clear', blockedDrainCell, rainfallMm, assumptions),
    }));
  } catch {
    return insufficient('scenario_calculation_failed');
  }

  // 4. Comparability. Both conditions solved, but a result that does not
  //    conserve water cannot be honestly set beside another one.
  for (const { scenario, baseline } of solved) {
    if (!checkMassBalance(scenario.balance).ok || !checkMassBalance(baseline.balance).ok) {
      return insufficient('comparison_not_comparable');
    }
  }

  const results = solved.map(({ scenario, baseline }) => {
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
      accumulatedRainfallMm: scenario.accumulatedRainfallMm,
      bands,
      band: higher > 0 ? ('higher-than-baseline' as const) : ('no-clear-change' as const),
      cellsHigherThanBaseline: higher,
      scenarioBalance: scenario.balance,
      baselineBalance: baseline.balance,
      scenarioPondedCells: scenario.pondedCells,
      baselinePondedCells: baseline.pondedCells,
    };
  });

  return {
    status: 'successful',
    positions: results,
    networkLimitations: [...(scene.networkLimitations ?? [])],
  };
}
