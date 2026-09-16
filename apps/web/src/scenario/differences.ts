/**
 * Which drains the comparison shows a difference for, worked out in advance.
 *
 * **Why this exists.** The team's testers found that every drain they tried
 * came back *No clear difference*, and a census of the model on 16 September
 * found why: in this model the extra water from a blocked drain is mostly
 * taken by the next drains downstream or leaves the calculation window, and
 * most hollows it reaches are already full. A difference above the 5 cm
 * threshold appears only for some drains, at some settings. The team asked
 * for the comparison to open on one of those where there is one near the
 * address, so a first try shows what the comparison can show.
 *
 * **It is the model's own answer, not a guess.** `scripts/scenario-differences.ts`
 * runs the same engine the worker runs, over every drain with a calculation
 * window, at both blockage settings and the three validated rainfall amounts,
 * and records how many cells come out *More water than with a clear drain*.
 * The comparison is still run in the browser when the person asks; this file
 * only decides which drain is highlighted first and what the hint says.
 */

import type { BlockageSetting } from '@drainlens/schema';

/** Blockage settings the census ran; `clear` is the baseline and never differs. */
export type TestedBlockage = Exclude<BlockageSetting, 'clear'>;

export interface DifferencesArtefact {
  readonly artefact: 'scenario-differences';
  readonly version: 1;
  /** The rainfall amounts each count is for, in order. */
  readonly rainfallMm: readonly number[];
  /** Cells counted as more water, per drain, per setting, per rainfall amount. Only drains with any. */
  readonly drains: Readonly<Record<string, Readonly<Partial<Record<TestedBlockage, readonly number[]>>>>>;
}

export class DifferencesError extends Error {}

const SETTINGS: readonly TestedBlockage[] = ['partly-blocked', 'fully-blocked'];

export function assertDifferences(value: unknown): asserts value is DifferencesArtefact {
  const a = value as Partial<DifferencesArtefact> | null;
  if (a === null || typeof a !== 'object' || a.artefact !== 'scenario-differences') {
    throw new DifferencesError('the differences file is not one');
  }
  if (!Array.isArray(a.rainfallMm) || a.rainfallMm.some((mm) => !Number.isFinite(mm))) {
    throw new DifferencesError('the differences file does not say which rainfall amounts it counted');
  }
  if (a.drains === null || typeof a.drains !== 'object') {
    throw new DifferencesError('the differences file lists no drains');
  }
  for (const [asset, settings] of Object.entries(a.drains)) {
    for (const [setting, counts] of Object.entries(settings)) {
      if (!SETTINGS.includes(setting as TestedBlockage)) {
        throw new DifferencesError(`drain ${asset} names a setting the census did not run: ${setting}`);
      }
      if (!Array.isArray(counts) || counts.length !== a.rainfallMm.length) {
        throw new DifferencesError(`drain ${asset} has the wrong number of counts for ${setting}`);
      }
    }
  }
}

/** The drains that show a difference at any setting. */
export function differingDrains(artefact: DifferencesArtefact | null): ReadonlySet<string> {
  if (artefact === null) return new Set();
  return new Set(
    Object.entries(artefact.drains)
      .filter(([, settings]) => Object.values(settings).some((counts) => counts.some((n) => n > 0)))
      .map(([asset]) => asset),
  );
}

/** Where a drain shows a difference: each setting with the rainfall amounts that do. */
export function differenceSettings(
  artefact: DifferencesArtefact | null,
  asset: string | null,
): readonly { readonly blockage: TestedBlockage; readonly rainfallMm: readonly number[] }[] {
  if (artefact === null || asset === null) return [];
  const settings = artefact.drains[asset];
  if (settings === undefined) return [];
  return SETTINGS.flatMap((blockage) => {
    const counts = settings[blockage];
    if (counts === undefined) return [];
    const amounts = artefact.rainfallMm.filter((_, i) => (counts[i] ?? 0) > 0);
    return amounts.length === 0 ? [] : [{ blockage, rainfallMm: amounts }];
  });
}

const SETTING_NAME: Record<TestedBlockage, string> = {
  'partly-blocked': 'Partly blocked',
  'fully-blocked': 'Fully blocked',
};

/**
 * The hint on step 2, or null when the drain has no recorded difference.
 *
 * "In this model", because the census is of the model: it says where the
 * calculation separates the two settings, not where a real blockage floods.
 */
export function differenceHint(artefact: DifferencesArtefact | null, asset: string | null): string | null {
  const settings = differenceSettings(artefact, asset);
  if (settings.length === 0) return null;
  const parts = settings.map(
    (s) => `${SETTING_NAME[s.blockage]} at ${s.rainfallMm.map((mm) => `${String(mm)} mm`).join(' or ')}`,
  );
  return `In this model, a blockage at this drain shows a difference with: ${parts.join('; ')}.`;
}

/** Fetch and check it. A failure is an empty list, not a broken comparison. */
export async function loadDifferences(
  url: string,
  get: (url: string) => Promise<unknown> = async (u) => (await fetch(u)).json() as Promise<unknown>,
): Promise<DifferencesArtefact | null> {
  try {
    const value = await get(url);
    assertDifferences(value);
    return value;
  } catch {
    return null;
  }
}
