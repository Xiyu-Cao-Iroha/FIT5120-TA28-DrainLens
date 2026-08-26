/**
 * Verification checks for the scenario engine.
 *
 * Written before the engine, deliberately. These are the checks the
 * architecture commits to in its validation section, and they exist here as
 * ordinary functions with their own tests — each one is exercised against
 * results that are correct and against results broken in one specific way, so
 * that when the engine arrives the check can be trusted to fail for the right
 * reason.
 *
 * What these establish and what they do not: they verify the engine **through
 * internal consistency and controlled test cases** — that it behaves as
 * designed. They do not establish real-world flood prediction accuracy, and no
 * claim of that kind is made anywhere in this project.
 */

export type CheckResult = { readonly ok: true } | { readonly ok: false; readonly failures: readonly string[] };

export const passed: CheckResult = { ok: true };

export const failed = (...failures: readonly string[]): CheckResult => ({ ok: false, failures });

/**
 * Where the water in one solved position ended up.
 *
 * Every position is solved independently from zero, so this accounts for a
 * single position and never for a running total across the slider.
 */
export interface WaterBalance {
  /** Rain that fell on the calculation window. */
  readonly rainfallVolumeM3: number;
  /** Entered a drain. */
  readonly capturedVolumeM3: number;
  /** Standing on the surface at the end of the position. */
  readonly pondedVolumeM3: number;
  /** Flowed out across the boundary of the window. */
  readonly leftWindowVolumeM3: number;
}

export interface MassBalanceOptions {
  /** Permitted discrepancy, as a fraction of the rainfall volume. */
  readonly toleranceFraction?: number;
}

/**
 * Every drop is accounted for: what fell equals what was captured, what is
 * standing, and what left the window.
 *
 * A tolerance is allowed because the routing works in floating point over tens
 * of thousands of cells, and accumulated rounding is not a defect. A systematic
 * loss is — which is why the tolerance is a fraction of the input rather than a
 * fixed volume that a large window could hide a real leak inside.
 */
export function checkMassBalance(balance: WaterBalance, options: MassBalanceOptions = {}): CheckResult {
  const tolerance = options.toleranceFraction ?? 0.01;
  const failures: string[] = [];

  const entries = Object.entries(balance) as readonly (readonly [keyof WaterBalance, number])[];
  for (const [name, value] of entries) {
    if (!Number.isFinite(value)) {
      failures.push(`${name} is not a finite number (${String(value)})`);
    } else if (value < 0) {
      failures.push(`${name} is negative (${value.toFixed(3)} m³); no term in the balance can be`);
    }
  }
  if (failures.length > 0) return { ok: false, failures };

  const { rainfallVolumeM3, capturedVolumeM3, pondedVolumeM3, leftWindowVolumeM3 } = balance;
  const accounted = capturedVolumeM3 + pondedVolumeM3 + leftWindowVolumeM3;
  const discrepancy = accounted - rainfallVolumeM3;

  // With no rain, nothing may appear from nowhere; a fraction of zero is zero,
  // so this case needs stating rather than inheriting the tolerance.
  if (rainfallVolumeM3 === 0) {
    return accounted === 0
      ? passed
      : failed(`no rain fell, but ${accounted.toFixed(3)} m³ is accounted for`);
  }

  const allowed = rainfallVolumeM3 * tolerance;
  if (Math.abs(discrepancy) > allowed) {
    const direction = discrepancy > 0 ? 'more water than fell' : 'less water than fell';
    return failed(
      `${direction}: ${rainfallVolumeM3.toFixed(3)} m³ fell, ${accounted.toFixed(3)} m³ accounted for ` +
        `(${discrepancy > 0 ? '+' : ''}${discrepancy.toFixed(3)} m³, tolerance ±${allowed.toFixed(3)} m³)`,
    );
  }
  return passed;
}

/** One solved position: how much rain had fallen, and how far water spread. */
export interface PositionExtent {
  readonly accumulatedRainfallMm: number;
  /** Number of cells with standing water at this position. */
  readonly pondedCells: number;
}

/**
 * Ponding must not shrink as accumulated rainfall increases.
 *
 * This matters more than it looks. Each position is solved independently from
 * zero rather than by stepping forward from the last one, so nothing in the
 * arithmetic forces the sequence to be consistent — a defect in the routing
 * could produce a slider that goes backwards as the storm gets heavier, which
 * would be both wrong and obviously wrong to a resident.
 */
export function checkMonotonicity(positions: readonly PositionExtent[]): CheckResult {
  if (positions.length === 0) {
    return failed('a scenario must solve at least one position');
  }

  const failures: string[] = [];
  for (const [i, position] of positions.entries()) {
    if (!Number.isFinite(position.accumulatedRainfallMm) || position.accumulatedRainfallMm < 0) {
      failures.push(`position ${String(i)} has an impossible rainfall (${String(position.accumulatedRainfallMm)} mm)`);
    }
    if (!Number.isInteger(position.pondedCells) || position.pondedCells < 0) {
      failures.push(`position ${String(i)} has an impossible ponded-cell count (${String(position.pondedCells)})`);
    }
  }
  if (failures.length > 0) return { ok: false, failures };

  for (let i = 1; i < positions.length; i += 1) {
    const previous = positions[i - 1]!;
    const current = positions[i]!;
    if (current.accumulatedRainfallMm <= previous.accumulatedRainfallMm) {
      failures.push(
        `positions must ascend in rainfall: position ${String(i)} is ${current.accumulatedRainfallMm} mm, ` +
          `after ${previous.accumulatedRainfallMm} mm`,
      );
    } else if (current.pondedCells < previous.pondedCells) {
      failures.push(
        `ponding shrank as rainfall rose: ${previous.pondedCells} cells at ${previous.accumulatedRainfallMm} mm, ` +
          `${current.pondedCells} cells at ${current.accumulatedRainfallMm} mm`,
      );
    }
  }
  return failures.length > 0 ? { ok: false, failures } : passed;
}

/** Collect several checks into one result, keeping every failure. */
export function allOf(...results: readonly CheckResult[]): CheckResult {
  const failures = results.flatMap((r) => (r.ok ? [] : [...r.failures]));
  return failures.length > 0 ? { ok: false, failures } : passed;
}
