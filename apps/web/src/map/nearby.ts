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

/**
 * Closer than this, no distance and no direction are given.
 *
 * `roughly` used to floor every distance at ten metres, so a path through the
 * front garden read as "about 10 m to the south-east". At a couple of metres
 * the bearing is also the least stable thing about the measurement: a metre of
 * simplification moves it by tens of degrees. Measured on the 4,089 pilot
 * addresses, 8.3% have a path and 29.2% a low area inside this distance.
 */
export const VERY_NEAR_M = 5;

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

/** The point on a segment closest to `point`: the foot of the perpendicular, or an end. */
function closestOnSegment(point: Local, from: Local, to: Local): Local {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return from;
  let t = ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return [from[0] + t * dx, from[1] + t * dy];
}

export interface Nearest {
  readonly distanceM: number;
  /** The closest point itself, which is what a direction is taken to. */
  readonly at: Local;
  /** True when the address is inside the polygon, so there is no direction to give. */
  readonly inside?: boolean;
}

/**
 * The closest point on any derived line to `at`, or null when there is none.
 *
 * **The direction is taken to the same point the distance is measured to.**
 * It used to be taken to the middle of the nearest segment, to save solving
 * for the foot of the perpendicular twice. A simplified path's segments are
 * tens of metres long, so the middle can be on the other side of the address
 * from the nearest point: measured over the 4,089 pilot addresses, that
 * reported a different compass point for **25.3%** of them, and up to 89.8°
 * out.
 */
export function nearestOnLines(
  lines: readonly { readonly c: readonly Local[] }[],
  at: Local,
): Nearest | null {
  let best: Nearest | null = null;
  for (const line of lines) {
    for (let i = 1; i < line.c.length; i += 1) {
      const foot = closestOnSegment(at, line.c[i - 1]!, line.c[i]!);
      const d = distance(at, foot);
      if (best === null || d < best.distanceM) best = { distanceM: d, at: foot };
    }
  }
  return best;
}

/** Even-odd across every ring of one polygon, so a ring inside a ring is a hole. */
function insidePolygon(rings: readonly (readonly Local[])[], at: Local): boolean {
  let hit = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [x1, y1] = ring[i]!;
      const [x2, y2] = ring[j]!;
      if (y1 > at[1] !== y2 > at[1] && at[0] < ((x2 - x1) * (at[1] - y1)) / (y2 - y1) + x1) hit = !hit;
    }
  }
  return hit;
}

/**
 * The closest point on any derived polygon's edge to `at`, or `inside`.
 *
 * **Two defects, both fixed here.** It compared vertices only, so the distance
 * was to the nearest corner rather than the nearest edge; and it never asked
 * whether the address was inside the low area at all, which is not an edge
 * case: **20.9%** of the pilot addresses are. An address inside one is given
 * no distance and no direction, because "the nearest low area is 3 m to the
 * west" about a house standing in it points at its own boundary.
 *
 * Every edge includes the one that closes the ring back to its first vertex;
 * a ring that already repeats its first vertex just adds a zero-length edge.
 */
export function nearestOnRings(
  polygons: readonly { readonly c: readonly (readonly Local[])[] }[],
  at: Local,
): Nearest | null {
  let best: Nearest | null = null;
  for (const polygon of polygons) {
    if (insidePolygon(polygon.c, at)) return { distanceM: 0, at, inside: true };
    for (const ring of polygon.c) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const foot = closestOnSegment(at, ring[j]!, ring[i]!);
        const d = distance(at, foot);
        if (best === null || d < best.distanceM) best = { distanceM: d, at: foot };
      }
    }
  }
  return best;
}

const roughly = (metres: number): number =>
  Math.max(DISTANCE_ROUNDING_M, Math.round(metres / DISTANCE_ROUNDING_M) * DISTANCE_ROUNDING_M);

/**
 * One thing found near an address, as the interface reports it.
 *
 * Three shapes, because there are three different things to say: it lies some
 * way off in a direction; it is at or very near, where neither a distance nor
 * a direction is worth giving; or the address is inside it.
 */
export type NearbyThing =
  | {
      readonly kind: 'direction';
      /** Already rounded, because the words must not claim more than the data. */
      readonly distanceM: number;
      /** The eighth the words name. */
      readonly bearing: Compass;
      /**
       * The true direction to the nearest point, degrees in the map frame (0 east,
       * 90 north). The figure draws the line to where the thing actually is; the
       * label carries the rounded distance and the words the rounded direction.
       */
      readonly angleDeg: number;
    }
  | { readonly kind: 'very-near' }
  | { readonly kind: 'inside' };

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

function report(near: Nearest | null, at: Local): NearbyThing | null {
  if (near === null || near.distanceM > RELEVANT_RADIUS_M) return null;
  if (near.inside === true) return { kind: 'inside' };
  if (near.distanceM < VERY_NEAR_M) return { kind: 'very-near' };
  const angleDeg = (Math.atan2(near.at[1] - at[1], near.at[0] - at[0]) * 180) / Math.PI;
  return {
    kind: 'direction',
    distanceM: roughly(near.distanceM),
    bearing: bearingFrom(at, near.at),
    angleDeg: (angleDeg + 360) % 360,
  };
}

export function waterNearby(derived: DerivedArtefact, at: Local): WaterNearby | null {
  const channel = report(nearestOnLines(derived.layers.channel ?? [], at), at);
  const low = report(nearestOnRings(derived.layers['low-point'] ?? [], at), at);
  if (channel === null && low === null) return null;
  return { channel, low };
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
 * The sentences, from the structure rather than from the artefact.
 *
 * Separated so the figure and the wording are two readings of one measurement.
 * It is also what a screen reader is given for the figure, which is the case
 * that would otherwise quietly lose the low area when the drawing gained it.
 *
 * **Two separate facts, not one sentence joining them.** It used to read *"may
 * run along a path … towards a low area …"*, and nothing measured says the
 * path runs towards that low area: they are the nearest of each, found
 * independently, and often lie in different directions.
 */
export function describe(near: WaterNearby): string {
  const { channel, low } = near;
  const path =
    channel === null
      ? `No mapped path where surface water may run is within ${String(RELEVANT_RADIUS_M)} m.`
      : channel.kind === 'direction'
        ? `The nearest mapped path where surface water may run is about ${String(channel.distanceM)} m to the ${channel.bearing}.`
        : 'A mapped path where surface water may run passes at or very near this address.';
  const hollow =
    low === null
      ? `No mapped low area where water may collect is within ${String(RELEVANT_RADIUS_M)} m.`
      : low.kind === 'inside'
        ? 'This address is within a mapped low area, where water may collect.'
        : low.kind === 'very-near'
          ? 'A mapped low area, where water may collect, is at or very near this address.'
          : `The nearest mapped low area, where water may collect, is about ${String(low.distanceM)} m to the ${low.bearing}.`;
  return `${path} ${hollow}`;
}

/**
 * Where a compass point lies, as an angle in the map frame.
 *
 * Used for the ground's arrow, which claims one of eight directions and nothing
 * finer, so it is drawn at the eighth it names. The dashed lines to a water path
 * and a low area are not: they point at where the thing is (`angleDeg`), with
 * the distance left to the label. Terrain handover §3.2: the graphic carries
 * position, the words carry the rounded figure.
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
export const NEARBY_BASIS = 'Calculated by DrainLens';
