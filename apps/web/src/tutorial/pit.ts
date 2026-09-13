/**
 * Which pit the guide asks somebody to press.
 *
 * **The guide cannot let the reader pick freely here, and the reason is a
 * number rather than a preference.** 215 of the 895 pits in this extent have
 * no recorded downstream at all, and only 472 are inlets. A step that says
 * *now you can see how water flows underground* over a pit whose record stops
 * at the pit is not a lesson, it is a bug the reader has no way to diagnose —
 * they pressed what they were told to press and nothing happened.
 *
 * So the guide chooses one and points at it. What it chooses is measured:
 *
 * - **a recorded inlet**, by `surfaceEntryOf` — the same classifier the pit
 *   card uses, so "water enters here" means one thing in both places;
 * - **with a downstream path**, so pressing *Show connected pipe* draws
 *   something;
 * - **the longest such path within reach**, because a one-pipe trace teaches
 *   less than a nine-pipe one, and 48 of the 378 candidates are one hop.
 *
 * **Every one of the 4,089 published addresses has a candidate.** Measured
 * across the whole index rather than sampled: the furthest any address sits
 * from an inlet with a downstream is 182.9 m, which is what
 * `TEACHING_RADIUS_M` is set from. The fallback below it exists anyway,
 * because a radius chosen from today's artefact is a radius that a new
 * artefact can invalidate in silence.
 */

import type { Pit } from '../map/artefact.js';
import type { Local } from '../map/viewport.js';
import { type TraceArtefact, traceDownstream } from '../trace/graph.js';
import { surfaceEntryOf } from '../crosssection/section.js';

/**
 * How far the guide will look before it stops preferring a long path.
 *
 * 200 m, from the measurement above: the furthest address is 182.9 m from a
 * candidate, so this covers the index with room. It is not a claim about how
 * far a person would walk — it is the radius at which the choice stops being
 * "the best one near you" and becomes "the only one there is".
 */
export const TEACHING_RADIUS_M = 200;

export interface TeachingPit {
  readonly pit: Pit;
  /** Metres from the address, for the sentence that names it. */
  readonly distanceM: number;
  /** How many pipes deep the path goes. Never zero. */
  readonly steps: number;
}

const distance = (from: Local, to: Local): number =>
  Math.hypot(from[0] - to[0], from[1] - to[1]);

/**
 * The pit the guide will ask for, or null if the artefact holds none.
 *
 * Null is a real answer rather than a thrown error: an artefact with no inlet
 * that leads anywhere is a data problem, and the screen that asks for this can
 * say so far better than a stack trace can.
 */
export function chooseTeachingPit(
  address: Local,
  pits: readonly Pit[],
  trace: TraceArtefact,
  radiusM: number = TEACHING_RADIUS_M,
): TeachingPit | null {
  const candidates: TeachingPit[] = [];
  let fallback: TeachingPit | null = null;

  for (const pit of pits) {
    if (pit.asset_number === undefined) continue;
    if (surfaceEntryOf(pit) !== 'recorded-inlet') continue;

    const steps = traceDownstream(trace, String(pit.asset_number)).steps;
    if (steps < 1) continue;

    const found: TeachingPit = { pit, distanceM: distance(address, pit.c), steps };

    // Kept whatever the radius says, so a future artefact that pushes every
    // candidate past 200 m degrades to "the nearest one" rather than to
    // "there isn't one" -- which is the failure that would look like a bug.
    if (fallback === null || found.distanceM < fallback.distanceM) fallback = found;
    if (found.distanceM <= radiusM) candidates.push(found);
  }

  if (candidates.length === 0) return fallback;

  // The longest path wins; the nearest breaks the tie. Deliberately in that
  // order: within a couple of hundred metres the walk is the same walk, and
  // what differs is how much of the network the person gets to see.
  return candidates.reduce((best, found) => {
    if (found.steps !== best.steps) return found.steps > best.steps ? found : best;
    return found.distanceM < best.distanceM ? found : best;
  });
}
