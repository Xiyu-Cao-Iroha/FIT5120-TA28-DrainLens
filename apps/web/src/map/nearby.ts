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

/** One thing found near an address, as the interface reports it. */
export interface NearbyThing {
  /** Already rounded, because the drawing must not claim more than the words. */
  readonly distanceM: number;
  readonly bearing: Compass;
}

/**
 * What was measured near an address, or null when nothing was.
 *
 * The same two facts the sentence is built from, before they become a
 * sentence. The figure needs them separately -- it has to point somewhere --
 * and deriving the picture from the prose by parsing it back apart would be a
 * second implementation of the same measurement.
 *
 * **Distances here are the rounded ones.** A figure drawn from the unrounded
 * distance beside a label reading "about 30 m" would be a picture claiming a
 * precision the caption disclaims.
 */
export interface WaterNearby {
  readonly channel: NearbyThing | null;
  readonly low: NearbyThing | null;
}

export function waterNearby(derived: DerivedArtefact, at: Local): WaterNearby | null {
  const channel = nearestOnLines(derived.layers.channel ?? [], at);
  const low = nearestOnRings(derived.layers['low-point'] ?? [], at);

  const nearChannel = channel !== null && channel.distanceM <= RELEVANT_RADIUS_M;
  const nearLow = low !== null && low.distanceM <= RELEVANT_RADIUS_M;
  if (!nearChannel && !nearLow) return null;

  return {
    channel: nearChannel ? { distanceM: roughly(channel.distanceM), bearing: bearingFrom(at, channel.at) } : null,
    low: nearLow ? { distanceM: roughly(low.distanceM), bearing: bearingFrom(at, low.at) } : null,
  };
}

/**
 * The sentence, or null when nothing derived is near enough to be about here.
 *
 * Returning null rather than a hedge is deliberate: the follow view can show
 * its next-step instruction on its own, and a paragraph that says "there may
 * be water somewhere" is worse than no paragraph.
 */
export function describeWaterNearby(derived: DerivedArtefact, at: Local): string | null {
  const near = waterNearby(derived, at);
  if (near === null) return null;
  return describe(near);
}

/**
 * The same three sentences, from the structure rather than from the artefact.
 *
 * Separated so the figure and the wording are two readings of one measurement.
 * It is also what a screen reader is given for the figure, which is the case
 * that would otherwise quietly lose the low area when the drawing gained it.
 */
export function describe(near: WaterNearby): string {
  const { channel, low } = near;

  if (channel !== null && low !== null) {
    return (
      `Surface water near this address may run along a path about ${channel.distanceM} m ` +
      `to the ${channel.bearing}, towards a low area about ${low.distanceM} m ` +
      `to the ${low.bearing} where water may collect.`
    );
  }

  if (channel !== null) {
    return (
      `Surface water near this address may run along a path about ${channel.distanceM} m ` +
      `to the ${channel.bearing}. No low area where water collects was measured nearby.`
    );
  }

  return (
    `A low area where surface water may collect was measured about ${low!.distanceM} m ` +
    `to the ${low!.bearing} of this address.`
  );
}

/**
 * Where a compass point lies, as an angle in the map frame.
 *
 * **The figure points at the reported eighth, not at the true bearing.** The
 * sentence says "to the north-west" because the direction is rounded to an
 * eighth before anybody sees it; an arrow drawn at the unrounded angle beside
 * that label would be a picture asserting a precision the words disclaim, and
 * the two would disagree by up to 22 degrees for no gain.
 */
export const COMPASS_ANGLE: Record<Compass, number> = {
  east: 0,
  'north-east': 45,
  north: 90,
  'north-west': 135,
  west: 180,
  'south-west': 225,
  south: 270,
  'south-east': 315,
};

/**
 * The label that must sit beside the sentence.
 *
 * Every clause above comes from a calculated surface rather than from the
 * council's record, and AC 1.1.4.g requires the two never to look alike.
 */
export const NEARBY_BASIS = 'System-derived result';
