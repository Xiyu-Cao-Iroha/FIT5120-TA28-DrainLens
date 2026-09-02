/**
 * Controlled vocabularies shared by the frontend, the backend and the model output.
 *
 * The two obstruction-related vocabularies in this file are deliberately kept
 * apart. See `visibleConditionIsNotABlockageSetting` at the bottom for why, and
 * do not add a conversion between them.
 */

/**
 * The scenario setting a resident chooses in Epic 2. Required verbatim by AC 2.1.
 *
 * This is a *hydraulic* setting: it tells the scenario worker how to treat the
 * selected pit when routing surface water.
 */
export const BLOCKAGE_SETTINGS = ['clear', 'partly-blocked', 'fully-blocked'] as const;
export type BlockageSetting = (typeof BLOCKAGE_SETTINGS)[number];

/**
 * What a photograph of a grate can support, and the vocabulary used by Epic 4.
 *
 * This is a statement about the *visible surface* of an inlet at one moment. It
 * cannot establish that a drain is hydraulically blocked and says nothing about
 * the pipe below.
 */
export const VISIBLE_CONDITIONS = [
  'no-visible-obstruction',
  'some-visible-obstruction',
  'extensive-visible-obstruction',
  'cannot-determine',
] as const;
export type VisibleCondition = (typeof VISIBLE_CONDITIONS)[number];

export const DEBRIS_TYPES = ['leaf-litter', 'rubbish', 'sediment', 'other'] as const;
export type DebrisType = (typeof DEBRIS_TYPES)[number];

/**
 * How one area compares with the all-clear baseline, **within a comparison that
 * succeeded**.
 *
 * "Insufficient information" is deliberately not a member. A calculation that
 * ran and found no difference is `no-clear-change`; a calculation that could not
 * be made at all is a run-level status, not a band. Collapsing the two would let
 * "we found nothing" and "we could not look" print the same words on the map.
 */
export const COMPARISON_BANDS = ['no-clear-change', 'higher-than-baseline'] as const;
export type ComparisonBand = (typeof COMPARISON_BANDS)[number];

/** Whether a comparison could be made at all. */
export const RESULT_STATUSES = ['successful', 'insufficient-information'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

/**
 * Why a comparison could not be made.
 *
 * Each reason is something the interface must explain in its own words
 * (AC 2.3.2.b (Aug-27 set)), so the set is small and each member names a distinct cause
 * rather than a severity.
 */
export const INSUFFICIENCY_REASONS = [
  'terrain_unavailable',
  'invalid_inlet',
  'scenario_calculation_failed',
  'comparison_not_comparable',
] as const;
export type InsufficiencyReason = (typeof INSUFFICIENCY_REASONS)[number];

/**
 * A missing downstream connection is a limitation of the recorded network, not
 * a reason the surface comparison is unusable: the surface calculation does not
 * depend on where a pipe leads. Reported alongside a successful result, never
 * instead of one.
 */
export const NETWORK_LIMITATIONS = [
  'missing_downstream_connection',
  'trace_reached_data_boundary',
] as const;
export type NetworkLimitation = (typeof NETWORK_LIMITATIONS)[number];

export const isComparisonBand = (v: unknown): v is ComparisonBand =>
  typeof v === 'string' && (COMPARISON_BANDS as readonly string[]).includes(v);

export const isInsufficiencyReason = (v: unknown): v is InsufficiencyReason =>
  typeof v === 'string' && (INSUFFICIENCY_REASONS as readonly string[]).includes(v);

export const isBlockageSetting = (v: unknown): v is BlockageSetting =>
  typeof v === 'string' && (BLOCKAGE_SETTINGS as readonly string[]).includes(v);

export const isVisibleCondition = (v: unknown): v is VisibleCondition =>
  typeof v === 'string' && (VISIBLE_CONDITIONS as readonly string[]).includes(v);

export const isDebrisType = (v: unknown): v is DebrisType =>
  typeof v === 'string' && (DEBRIS_TYPES as readonly string[]).includes(v);

/**
 * A deliberate non-implementation, kept as an exported constant so that the
 * decision is visible in the code and is covered by a test.
 *
 * An earlier draft aligned the two vocabularies so that a resident's photograph
 * could feed a scenario without translation. That alignment was wrong: it
 * silently upgrades "leaves on the grate" into "this drain is not accepting
 * water". If a future iteration wants a path from an observation to a scenario,
 * it must be an explicit step the resident takes, with its own wording — never
 * a function in this package.
 */
export const visibleConditionIsNotABlockageSetting = true as const;
