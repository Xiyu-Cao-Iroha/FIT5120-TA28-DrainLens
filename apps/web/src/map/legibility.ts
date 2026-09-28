/**
 * When there are too many pits on screen to be pits.
 *
 * The pilot extent never needed this. 895 drains over a square kilometre is a
 * legible map at any zoom the product offers. The council extent is 21,113
 * over 76.5 km², and at the full view **18,840 of them land on one screen**,
 * which is not a drainage network — it is a texture that happens to be made of
 * drains.
 *
 * **The rule is about what is on screen, not about the zoom.** A scale
 * threshold was the obvious first answer and it is wrong, because density is
 * not uniform: the median occupied square kilometre holds 225 pits and the
 * densest holds 1,905. Any scale strict enough for the CBD hides Kensington's
 * 895 at a zoom where they are perfectly readable, and any scale loose enough
 * for Kensington leaves the CBD a smear. Counting what is actually in view
 * gets both right without knowing which one it is looking at.
 *
 * Measured on the council artefact, sliding a 1080 × 775 window over the whole
 * extent and taking the worst window at each zoom:
 *
 * | view across | pits in the worst window | pixels between neighbours |
 * |------------:|-------------------------:|--------------------------:|
 * |     8,308 m |                   18,840 |                      7 px |
 * |     2,160 m |                    5,288 |                     13 px |
 * |     1,080 m |                    1,950 |                     21 px |
 * |       540 m |                      609 |                     37 px |
 *
 * A tap target is `TAP_RADIUS_PX` × 2 = 36 pixels across. Below about 24
 * pixels apart, neighbouring pits sit inside one another's targets: pressing
 * one is a coin toss, and the map is claiming a precision the screen cannot
 * carry. On a 1080 × 775 map that is **1,400 pits** — and it puts Kensington's
 * 895, at 31 pixels apart, comfortably on the drawn side of the line, which is
 * the test any threshold here has to pass.
 */

import type { Local, Viewport } from './viewport.js';
import { toScreen } from './viewport.js';

/** Roughly the closest two point marks can sit and still be told apart. */
export const LEGIBLE_SPACING_PX = 24;

/** Counted rather than assumed — see the table above. */
export function pitLimitFor(viewport: Viewport): number {
  return Math.round((viewport.widthPx * viewport.heightPx) / LEGIBLE_SPACING_PX ** 2);
}

/**
 * How many of these points fall inside the view.
 *
 * Screen-space rather than metres, because the question is about pixels: two
 * pits a metre apart are distinguishable at one zoom and not at another, and
 * only the transform knows which.
 */
export function countInView(points: readonly Local[], viewport: Viewport): number {
  let n = 0;
  for (const point of points) {
    const [x, y] = toScreen(viewport, point);
    if (x >= 0 && x <= viewport.widthPx && y >= 0 && y <= viewport.heightPx) n += 1;
  }
  return n;
}

export interface Legibility {
  /** False when there are more pits in view than the screen can separate. */
  readonly drawPits: boolean;
  /** How many are in view, for the sentence that says why they are not drawn. */
  readonly inView: number;
  readonly limit: number;
}

/**
 * Whether the pits on screen can be drawn as pits.
 *
 * **It says so rather than simply not drawing them.** A layer whose switch is
 * on and whose marks are absent reads as a broken map, and this repository has
 * already recorded the same mistake in the other direction — a control that
 * vanishes reads as a control that was never there. The count is returned so
 * the interface can say *how* many, which is the difference between "something
 * is wrong" and "there are eighteen thousand of them here".
 */
export function legibility(
  points: readonly Local[],
  viewport: Viewport | null,
): Legibility {
  if (viewport === null) return { drawPits: true, inView: 0, limit: 0 };
  const limit = pitLimitFor(viewport);
  const inView = countInView(points, viewport);
  return { drawPits: inView <= limit, inView, limit };
}
