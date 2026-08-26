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

/** Output of a scenario comparison at one accumulated-rainfall position. */
export const COMPARISON_BANDS = [
  'no-clear-change',
  'higher-than-baseline',
  'insufficient-data',
] as const;
export type ComparisonBand = (typeof COMPARISON_BANDS)[number];

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
