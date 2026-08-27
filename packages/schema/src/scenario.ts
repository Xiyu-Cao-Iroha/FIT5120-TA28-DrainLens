/**
 * Scenario inputs, results, and the provenance block a run carries with it.
 *
 * A scenario run is never written to the server (AD1, §4.1). This block lives in
 * the session and is exportable, which is what lets a resident quote a result to
 * a council without us storing anything about who produced it.
 */

import type {
  BlockageSetting,
  ComparisonBand,
  InsufficiencyReason,
  NetworkLimitation,
  ResultStatus,
} from './vocabulary.js';
import type { DataVersionId } from './provenance.js';

export type AssetNumber = string & { readonly __brand: 'AssetNumber' };
export type StationId = string & { readonly __brand: 'StationId' };

export const assetNumber = (v: string): AssetNumber => v as AssetNumber;
export const stationId = (v: string): StationId => v as StationId;

/** Supported accumulated-rainfall range, in millimetres. */
export const RAINFALL_RANGE_MM = { min: 0, max: 120 } as const;

export const isSupportedRainfall = (mm: number): boolean =>
  Number.isFinite(mm) && mm >= RAINFALL_RANGE_MM.min && mm <= RAINFALL_RANGE_MM.max;

/**
 * Where the accumulated rainfall figure came from.
 *
 * `manual` is the MVP path and is complete on its own. `observation` is the
 * conditional extension (AD12), and carries everything the interface is required
 * to display alongside the number — including the distance from the address,
 * because one gauge describes one point and must never be presented as the
 * rainfall on the resident's own street.
 */
export type RainfallSource =
  | { readonly kind: 'manual' }
  | {
      readonly kind: 'observation';
      readonly stationId: StationId;
      readonly stationName: string;
      readonly observedFrom: string;
      readonly observedTo: string;
      readonly upstreamUpdatedAt: string;
      readonly distanceFromAddressM: number;
    };

export interface ScenarioInputs {
  readonly pitAssetNumber: AssetNumber;
  readonly blockage: BlockageSetting;
  readonly accumulatedRainfallMm: number;
  readonly rainfallSource: RainfallSource;
}

export interface ScenarioWindow {
  /** Side length of the square calculation window, in metres. */
  readonly metresSquare: number;
}

export interface PositionResult {
  readonly accumulatedRainfallMm: number;
  readonly band: ComparisonBand;
}

/**
 * Everything needed to explain or reproduce a result. Built with the result, not
 * attached to it afterwards.
 */
export interface ScenarioRunProvenance {
  readonly inputs: ScenarioInputs;
  readonly window: ScenarioWindow;
  readonly dataVersionIds: readonly DataVersionId[];
  readonly engineVersion: string;
  readonly assumptionSetVersion: string;
  readonly positions: readonly PositionResult[];
  /** Whether a comparison could be made at all. */
  readonly resultStatus: ResultStatus;
  /** Present only when `resultStatus` is `insufficient-information`. */
  readonly insufficiencyReason: InsufficiencyReason | null;
  /**
   * Limitations of the recorded drainage network that do not prevent the
   * surface comparison. Reported with a successful result, never instead of one.
   */
  readonly networkLimitations: readonly NetworkLimitation[];
}

export class ScenarioError extends Error {}

/**
 * Builds the provenance block, refusing anything that would make a result
 * unexplainable or a comparison unsound.
 */
export interface RunProvenanceParts {
  readonly inputs: ScenarioInputs;
  readonly window: ScenarioWindow;
  readonly dataVersionIds: readonly DataVersionId[];
  readonly engineVersion: string;
  readonly assumptionSetVersion: string;
  readonly positions: readonly PositionResult[];
  readonly resultStatus: ResultStatus;
  readonly insufficiencyReason?: InsufficiencyReason | null;
  readonly networkLimitations?: readonly NetworkLimitation[];
}

export function buildRunProvenance(parts: RunProvenanceParts): ScenarioRunProvenance {
  const { inputs, window, dataVersionIds, engineVersion, assumptionSetVersion, positions } = parts;
  const { resultStatus } = parts;
  const insufficiencyReason = parts.insufficiencyReason ?? null;

  if (!isSupportedRainfall(inputs.accumulatedRainfallMm)) {
    throw new ScenarioError(
      `accumulated rainfall ${String(inputs.accumulatedRainfallMm)} mm is outside the supported range`,
    );
  }
  if (dataVersionIds.length === 0) {
    throw new ScenarioError('a run must record the data version of every artefact it consumed');
  }

  // A run that could not be compared still carries provenance — it has to
  // explain itself to the resident — but it holds no positions and must name
  // the reason it could not be produced.
  if (resultStatus === 'insufficient-information') {
    if (insufficiencyReason === null) {
      throw new ScenarioError('an insufficient result must name the reason it could not be produced');
    }
    if (positions.length > 0) {
      throw new ScenarioError('an insufficient result cannot also carry comparison positions');
    }
  } else {
    if (insufficiencyReason !== null) {
      throw new ScenarioError('a successful result cannot carry an insufficiency reason');
    }
    if (positions.length === 0) {
      throw new ScenarioError('a successful run must record at least one position');
    }
    const rainfalls = positions.map((p) => p.accumulatedRainfallMm);
    const ascending = rainfalls.every((mm, i) => i === 0 || mm > rainfalls[i - 1]!);
    if (!ascending) {
      throw new ScenarioError('positions must be strictly ascending in accumulated rainfall');
    }
  }

  return {
    inputs,
    window,
    dataVersionIds: [...dataVersionIds],
    engineVersion,
    assumptionSetVersion,
    positions: [...positions],
    resultStatus,
    insufficiencyReason,
    networkLimitations: [...(parts.networkLimitations ?? [])],
  };
}
