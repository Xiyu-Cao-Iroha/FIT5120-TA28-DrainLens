/**
 * Can this address have a blocked-drain comparison, and at which drain?
 *
 * **Asked once, straight after the address resolves, and before anything is
 * set up.** The comparison used to open its setup screen for any address and
 * let the person choose a drain, a condition and an amount of rain before the
 * engine said `terrain_unavailable` — three choices made for a question that
 * could never be answered. An address with no comparable drain near it now
 * stops here, and never reaches a drain, an assumption or a rainfall control.
 *
 * "Comparable" is the worker's list and nothing else: an inlet the scene tile
 * index gives a calculation window. Reading it off the asset description or the
 * map geometry was tried twice, and both times offered drains the engine then
 * refused.
 */

import type { Pit } from '../map/artefact.js';
import type { Local } from '../map/viewport.js';

/**
 * How far from an address a drain still counts as "near this address".
 *
 * **200 m, measured rather than chosen.** Across all 62,397 addresses in the
 * council index against the 9,239 inlets the scene tile index can calculate
 * (each placed at its tile cell), the distance to the nearest one is a median
 * of 24 m, 71 m at the 90th percentile and 155 m at the 99th. 334 addresses —
 * 0.5% — are further than 200 m, and they are the docks, Webb Dock and the
 * rail yards off Mackenzie Road, up to 873 m out. On the bundled Kensington
 * square kilometre, measured against the pits the map actually draws, the
 * 99th percentile is 178 m and 18 of 4,104 addresses are beyond it, all on
 * Epsom Road beside the racecourse.
 *
 * It is also the guide's `TEACHING_RADIUS_M`, set from the same kind of
 * measurement, so "a drain near your address" means one distance across the
 * product. Beyond it, a drain is somebody else's street: offering it would
 * answer a question about a place the person did not ask about.
 */
export const COMPARISON_RADIUS_M = 200;

/** One drain the comparison can use, and how far it is from the address. */
export interface ComparableDrain {
  /** The asset number, as the worker and the session name it. */
  readonly assetNumber: string;
  readonly at: Local;
  readonly distanceM: number;
}

export interface Eligibility {
  /** The nearest comparable drain within the radius, or null: nothing to compare here. */
  readonly nearest: ComparableDrain | null;
  /**
   * The other comparable drains within the radius, nearest first.
   *
   * This is the keyboard order of step 1 after the highlighted drain, so it is
   * decided here and tested rather than left to whatever order the artefact
   * happens to list pits in.
   */
  readonly others: readonly ComparableDrain[];
}

/**
 * The comparable drains near an address.
 *
 * A pit listed twice under one asset number counts once, at its nearer
 * position. Ties are broken on the asset number, so the same address always
 * highlights the same drain rather than whichever the artefact listed first.
 */
export function comparableNear(
  address: Local,
  pits: readonly Pit[],
  supported: ReadonlySet<string>,
  radiusM: number = COMPARISON_RADIUS_M,
): Eligibility {
  const byAsset = new Map<string, ComparableDrain>();
  for (const pit of pits) {
    if (pit.asset_number === undefined) continue;
    const assetNumber = String(pit.asset_number);
    if (!supported.has(assetNumber)) continue;
    const distanceM = Math.hypot(pit.c[0] - address[0], pit.c[1] - address[1]);
    if (distanceM > radiusM) continue;
    const held = byAsset.get(assetNumber);
    if (held === undefined || distanceM < held.distanceM) {
      byAsset.set(assetNumber, { assetNumber, at: pit.c, distanceM });
    }
  }
  const ordered = [...byAsset.values()].sort(
    (a, b) => a.distanceM - b.distanceM || a.assetNumber.localeCompare(b.assetNumber),
  );
  const [nearest = null, ...others] = ordered;
  return { nearest, others };
}

/**
 * A distance as the sentence says it: "about 70 m".
 *
 * To the nearest ten metres, because the address point is a property's centre
 * and the pit is a council record to a decimetre — a figure to the metre would
 * claim a precision the two positions do not share. Never "about 0 m".
 */
export function aboutMetres(distanceM: number): number {
  return Math.max(10, Math.round(distanceM / 10) * 10);
}
