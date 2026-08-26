/**
 * Provenance — a record, not a label (System Architecture v5, §5.5).
 *
 * A value that cannot account for itself must be impossible to construct. That
 * is enforced here by making `basis` a required, discriminated member of every
 * provenanced value: there is no shape of `Provenanced<T>` without one, so a
 * value cannot reach the interface unlabelled by omission.
 */

export type DataVersionId = string & { readonly __brand: 'DataVersionId' };
export type DerivationId = string & { readonly __brand: 'DerivationId' };
export type AssumptionId = string & { readonly __brand: 'AssumptionId' };

export const dataVersionId = (v: string): DataVersionId => v as DataVersionId;
export const derivationId = (v: string): DerivationId => v as DerivationId;
export const assumptionId = (v: string): AssumptionId => v as AssumptionId;

export type ProvenanceLabel = Basis['label'];

/**
 * The label lives inside the basis rather than beside it, so the two cannot
 * disagree: there is no way to say `source-provided` while carrying a model
 * version, or `assumed` while carrying nothing at all.
 */
export type Basis =
  | { readonly label: 'source-provided'; readonly dataVersionId: DataVersionId }
  | {
      readonly label: 'derived';
      readonly dataVersionIds: readonly DataVersionId[];
      readonly derivationId: DerivationId;
    }
  | { readonly label: 'assumed'; readonly assumptionId: AssumptionId }
  | { readonly label: 'inferred'; readonly modelVersion: string; readonly confidence: number };

export interface Provenanced<T> {
  readonly value: T;
  readonly unit: string;
  readonly basis: Basis;
}

export class ProvenanceError extends Error {}

/** Read directly from a published source dataset. */
export function sourceProvided<T>(value: T, unit: string, version: DataVersionId): Provenanced<T> {
  return { value, unit, basis: { label: 'source-provided', dataVersionId: version } };
}

/** Computed by a build step from one or more sources. */
export function derived<T>(
  value: T,
  unit: string,
  versions: readonly DataVersionId[],
  derivation: DerivationId,
): Provenanced<T> {
  if (versions.length === 0) {
    throw new ProvenanceError('a derived value must name at least one data version');
  }
  return {
    value,
    unit,
    basis: { label: 'derived', dataVersionIds: [...versions], derivationId: derivation },
  };
}

/** Taken from the assumption register rather than from any source. */
export function assumed<T>(value: T, unit: string, assumption: AssumptionId): Provenanced<T> {
  return { value, unit, basis: { label: 'assumed', assumptionId: assumption } };
}

/** Produced by a model rather than read from a source. */
export function inferred<T>(
  value: T,
  unit: string,
  modelVersion: string,
  confidence: number,
): Provenanced<T> {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new ProvenanceError(`confidence must be within 0..1, received ${String(confidence)}`);
  }
  if (modelVersion.trim() === '') {
    throw new ProvenanceError('an inferred value must name the model version that produced it');
  }
  return { value, unit, basis: { label: 'inferred', modelVersion, confidence } };
}

export const labelOf = <T>(p: Provenanced<T>): ProvenanceLabel => p.basis.label;

/**
 * Runtime guard for values arriving from outside the type system — a parsed
 * artefact, a fetch response, a worker message.
 */
export function isProvenanced(v: unknown): v is Provenanced<unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  if (!('value' in c) || typeof c.unit !== 'string') return false;
  const b = c.basis as Record<string, unknown> | undefined;
  if (typeof b !== 'object' || b === null) return false;
  switch (b.label) {
    case 'source-provided':
      return typeof b.dataVersionId === 'string';
    case 'derived':
      return (
        Array.isArray(b.dataVersionIds) &&
        b.dataVersionIds.length > 0 &&
        typeof b.derivationId === 'string'
      );
    case 'assumed':
      return typeof b.assumptionId === 'string';
    case 'inferred':
      return (
        typeof b.modelVersion === 'string' &&
        typeof b.confidence === 'number' &&
        b.confidence >= 0 &&
        b.confidence <= 1
      );
    default:
      return false;
  }
}

/** One row of the data manifest, as consumed by the provenance labeller. */
export interface DataVersion {
  readonly dataVersionId: DataVersionId;
  readonly sourceName: string;
  readonly publisher: string;
  readonly licenceCode: string;
  readonly capturedDate?: string;
  readonly modifiedDate?: string;
  readonly recordCount?: number;
  readonly coverageNote?: string;
  readonly derivationNote?: string;
  readonly ingestedAt: string;
  readonly artefactChecksum: string;
}
