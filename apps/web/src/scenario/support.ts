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
    'A blockage comparison cannot be calculated for this drain: the council record does not describe it as a surface inlet — a side-entry or grated pit — which is the only kind a surface blockage applies to. That is about what our calculation can use. It does not mean this drain has no drainage or flood concern.',
  'no-measured-ground':
    'A blockage comparison cannot be calculated for this drain: there is not a full kilometre of measured ground around it to route water over. That is about the ground data we hold. It does not mean this drain has no drainage or flood concern.',
};

/** The legend line on the comparison map. */
export const SUPPORT_LEGEND =
  'Drains ringed in teal can be compared. Other drains cannot be compared here — either the record does not describe them as surface inlets, or there is not enough measured ground around them. That is about our calculation, not about the drains, and it does not mean they have no drainage or flood concern.';

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
