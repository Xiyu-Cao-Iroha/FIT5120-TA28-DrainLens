/**
 * Which drains a scenario can be calculated for, known before anybody chooses.
 *
 * AC 3.1.1.a and d: identify the drainage locations that support a scenario,
 * and distinguish the ones that do not. Iteration 1 let a person choose any pit
 * and told them afterwards; this answers from the tile index alone, so the map
 * can say so first and the comparison is never started for a drain that
 * cannot have one.
 *
 * AC 3.1.1.e is the sentence that matters most here. A drain we cannot compute
 * a scenario for is a statement about our calculation — whether it is a surface
 * inlet in the record, and whether there is measured ground around it — and not
 * about the drain. The wording below says so every time.
 */

import { useEffect, useState } from 'react';

import { assertTileIndex } from './sceneTiles.js';

export interface ScenarioSupport {
  /** Inlets with a calculation window: these can be compared. */
  readonly supported: ReadonlySet<string>;
  /** Inlets with no window of measured ground around them. */
  readonly withoutGround: ReadonlySet<string>;
}

export type PitSupport = 'supported' | 'not-an-inlet' | 'no-measured-ground';

export function supportOf(support: ScenarioSupport, assetNumber: string): PitSupport {
  if (support.supported.has(assetNumber)) return 'supported';
  return support.withoutGround.has(assetNumber) ? 'no-measured-ground' : 'not-an-inlet';
}

/** Why a drain cannot be compared, and what that does not mean. */
export const UNSUPPORTED_TEXT: Readonly<Record<Exclude<PitSupport, 'supported'>, string>> = {
  'not-an-inlet':
    'This pit cannot be used in the blockage comparison because the council record does not identify it as a surface inlet. This is a data limitation; it does not show whether the pit works or whether the area may flood.',
  'no-measured-ground':
    'This pit cannot be used in the blockage comparison because there is not enough ground data around it for the calculation. This is a data limitation; it does not show whether the pit works or whether the area may flood.',
};

/** The legend line on the comparison map. */
export const SUPPORT_LEGEND =
  'Only teal-ringed drain pits can be used in this comparison. Other pits are missing records or ground data needed by the calculation. This does not show whether those pits work or whether the area may flood.';

/** What the map offers on a drain that can be compared. */
export const COMPARE_HERE = 'Compare a blockage scenario at this drain';

/**
 * The index, fetched once when a screen needs it.
 *
 * 176 KB. The full map fetches it only when opened, the same argument as the
 * scenario worker: a visit that never looks at a drain downloads none of it.
 * Null until loaded, and null if it could not be — the map then offers no
 * comparison rather than one that is bound to fail.
 */
export function useScenarioSupport(enabled: boolean, base = '/data/scene-tiles'): ScenarioSupport | null {
  const [support, setSupport] = useState<ScenarioSupport | null>(null);
  useEffect(() => {
    if (!enabled || support !== null) return;
    let cancelled = false;
    void fetch(`${base}/index.json`)
      .then((response) => response.json())
      .then((index: unknown) => {
        assertTileIndex(index);
        if (cancelled) return;
        setSupport({
          supported: new Set(Object.keys(index.windows)),
          withoutGround: new Set(index.inletsWithoutWindow ?? []),
        });
      })
      .catch(() => {
        // Left null: no comparison offered, rather than one that cannot run.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, base, support]);
  return support;
}
