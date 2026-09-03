/**
 * A plain-English sentence about where water near one address may move.
 *
 * AC 1.1.7.c. The temptation is to write one sentence and show it to
 * everybody, which is not an explanation — it is a caption. So this measures
 * against the derived layers the person can see on the map beside it: the
 * nearest surface-water path, and the nearest low area it runs towards.
 *
 * Three constraints on the wording, all of them the same constraint:
 *
 * **"May", never "will".** The layers are derived from a filtered
 * photogrammetric surface. They describe where water runs downhill on that
 * surface, which is not a forecast of what happens in a storm.
 *
 * **Distances are rounded to ten metres.** The surface is quoted at about
 * 25 cm vertical accuracy and the paths were simplified to a one-metre
 * tolerance; "37 m" would claim a precision neither supports, and "about 40 m"
 * says the same useful thing without it.
 *
 * **Nothing is said when nothing is near.** A sentence about a path 400 m away
 * tells the person nothing about their street, and inventing relevance is the
 * failure this whole product is built to avoid.
 */

import type { DerivedArtefact } from './derived.js';
import type { Local } from './viewport.js';

/** Beyond this, a derived path is not about this address any more. */
export const RELEVANT_RADIUS_M = 150;

/** Distances are rounded to this, because the data cannot support finer. */
export const DISTANCE_ROUNDING_M = 10;

/** Compass points, in the map frame: east is +x, north is +y. */
const COMPASS = [
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
  'south',
  'south-east',
] as const;

export type Compass = (typeof COMPASS)[number];

/** Which way `to` lies from `from`, to the nearest eighth. */
export function bearingFrom(from: Local, to: Local): Compass {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const eighths = Math.round((angle / (Math.PI * 2)) * 8);
  return COMPASS[((eighths % 8) + 8) % 8]!;
}

const distance = (a: Local, b: Local): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Squared distance from a point to a segment, without the square root. */
function toSegment(point: Local, from: Local, to: Local): number {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, from);
  let t = ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return distance(point, [from[0] + t * dx, from[1] + t * dy]);
}

export interface Nearest {
  readonly distanceM: number;
  readonly at: Local;
}

/** The closest point on any derived line to `at`, or null when there is none. */
export function nearestOnLines(
  lines: readonly { readonly c: readonly Local[] }[],
  at: Local,
): Nearest | null {
  let best: Nearest | null = null;
  for (const line of lines) {
    for (let i = 1; i < line.c.length; i += 1) {
      const from = line.c[i - 1]!;
      const to = line.c[i]!;
      const d = toSegment(at, from, to);
      if (best === null || d < best.distanceM) {
        // The midpoint is close enough to give a direction from, and avoids
        // solving for the foot of the perpendicular a second time.
        best = { distanceM: d, at: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] };
      }
    }
  }
  return best;
}

/** The closest vertex of any derived polygon ring to `at`. */
export function nearestOnRings(
  polygons: readonly { readonly c: readonly (readonly Local[])[] }[],
  at: Local,
): Nearest | null {
  let best: Nearest | null = null;
  for (const polygon of polygons) {
    for (const ring of polygon.c) {
      for (const vertex of ring) {
        const d = distance(at, vertex);
        if (best === null || d < best.distanceM) best = { distanceM: d, at: vertex };
      }
    }
  }
  return best;
}

const roughly = (metres: number): number =>
  Math.max(DISTANCE_ROUNDING_M, Math.round(metres / DISTANCE_ROUNDING_M) * DISTANCE_ROUNDING_M);

/**
 * The sentence, or null when nothing derived is near enough to be about here.
 *
 * Returning null rather than a hedge is deliberate: the follow view can show
 * its next-step instruction on its own, and a paragraph that says "there may
 * be water somewhere" is worse than no paragraph.
 */
export function describeWaterNearby(derived: DerivedArtefact, at: Local): string | null {
  const channels = derived.layers.channel ?? [];
  const lowPoints = derived.layers['low-point'] ?? [];

  const channel = nearestOnLines(channels, at);
  const low = nearestOnRings(lowPoints, at);

  const nearChannel = channel !== null && channel.distanceM <= RELEVANT_RADIUS_M;
  const nearLow = low !== null && low.distanceM <= RELEVANT_RADIUS_M;

  if (!nearChannel && !nearLow) return null;

  if (nearChannel && nearLow) {
    return (
      `Surface water near this address may run along a path about ${roughly(channel.distanceM)} m ` +
      `to the ${bearingFrom(at, channel.at)}, towards a low area about ${roughly(low.distanceM)} m ` +
      `to the ${bearingFrom(at, low.at)} where water may collect.`
    );
  }

  if (nearChannel) {
    return (
      `Surface water near this address may run along a path about ${roughly(channel.distanceM)} m ` +
      `to the ${bearingFrom(at, channel.at)}. No low area where water collects was measured nearby.`
    );
  }

  return (
    `A low area where surface water may collect was measured about ${roughly(low!.distanceM)} m ` +
    `to the ${bearingFrom(at, low!.at)} of this address.`
  );
}

/**
 * The label that must sit beside the sentence.
 *
 * Every clause above comes from a calculated surface rather than from the
 * council's record, and AC 1.1.4.g requires the two never to look alike.
 */
export const NEARBY_BASIS = 'System-derived result';
