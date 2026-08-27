/**
 * What the person just tapped.
 *
 * Hit testing is done in **screen pixels, not metres**, because the target a
 * finger has to hit is a fixed size on the glass whatever the zoom. Testing in
 * metres would give a target that shrinks as the map zooms out, which is
 * exactly when a pit is hardest to hit.
 */

import type { Pipe, Pit } from './artefact.js';
import { type Local, type Screen, type Viewport, toScreen } from './viewport.js';

/**
 * How near a tap has to land, in pixels.
 *
 * Nine millimetres on a typical phone. The published guidance for a touch
 * target is around that, and a drainage pit drawn to scale at a readable zoom
 * is a few pixels across — far too small to hit — so the target is deliberately
 * larger than the thing it selects.
 */
export const TAP_RADIUS_PX = 18;

export type Hit =
  | { readonly kind: 'pit'; readonly feature: Pit; readonly distancePx: number }
  | { readonly kind: 'pipe'; readonly feature: Pipe; readonly distancePx: number };

/** Distance from a point to a line segment, all in screen pixels. */
export function distanceToSegment(point: Screen, from: Screen, to: Screen): number {
  const [px, py] = point;
  const [ax, ay] = from;
  const [bx, by] = to;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);

  // How far along the segment the nearest point sits, clamped to its ends so a
  // tap beyond the end measures to the end rather than to the infinite line.
  const along = Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0), 1);
  return Math.hypot(px - (ax + along * dx), py - (ay + along * dy));
}

const distanceToPath = (point: Screen, path: readonly Local[], viewport: Viewport): number => {
  let nearest = Infinity;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (!from || !to) continue;
    nearest = Math.min(
      nearest,
      distanceToSegment(point, toScreen(viewport, from), toScreen(viewport, to)),
    );
  }
  return nearest;
};

/**
 * The nearest thing within reach of a tap, or nothing.
 *
 * Pits win ties with pipes. A pit is what the interface can say something
 * about — it has a record, a downstream path and a scenario — while a pipe is
 * mostly the line between two of them, and a pit always sits on the end of
 * one, so pipes would otherwise shadow every pit on the map.
 */
export function pick(
  point: Screen,
  viewport: Viewport,
  layers: { readonly pit?: readonly Pit[]; readonly pipe?: readonly Pipe[] },
  radiusPx: number = TAP_RADIUS_PX,
): Hit | null {
  let best: Hit | null = null;

  for (const feature of layers.pit ?? []) {
    const [x, y] = toScreen(viewport, feature.c);
    const distancePx = Math.hypot(point[0] - x, point[1] - y);
    if (distancePx <= radiusPx && (best === null || distancePx < best.distancePx)) {
      best = { kind: 'pit', feature, distancePx };
    }
  }
  if (best !== null) return best;

  for (const feature of layers.pipe ?? []) {
    const distancePx = distanceToPath(point, feature.c, viewport);
    if (distancePx <= radiusPx && (best === null || distancePx < best.distancePx)) {
      best = { kind: 'pipe', feature, distancePx };
    }
  }
  return best;
}
