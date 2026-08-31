/**
 * Where the blocked run leaves more surface water than the all-clear one.
 *
 * This layer is the product's headline claim made visible. Without it the
 * result screen says "highlighted areas show where..." over a map with
 * nothing highlighted, which is what a teammate reported and what a
 * self-audit then traced to the worker: the engine computes a band for every
 * cell, and only a count of them ever crossed back to the interface.
 *
 * **It is a difference, never a depth.** AD7 and AC 2.2.1.c allow one output
 * and one only — where the two runs disagree. Nothing here encodes how much
 * water, and the fill is deliberately flat for that reason: a ramp would
 * invite reading a quantity off a legend this product does not publish.
 *
 * The cells arrive already converted to local metres. That conversion belongs
 * in the worker, beside the grid it is derived from — the one time this
 * repository moved a cell index across a boundary and rebuilt the coordinate
 * on the other side, all 895 drains disagreed with the scene and every
 * comparison returned `invalid_inlet`.
 */
import { type Local, type Viewport, toScreen } from './viewport.js';

/**
 * Violet, at just over half opacity.
 *
 * Not red: this is a comparison between two assumptions, not a hazard rating,
 * and a red wash over somebody's street reads as a warning the product
 * explicitly does not make. Not blue or blue-grey either — both are taken, by
 * the surface-water paths and by the ground-surface ramp, and an overlay that
 * resembles the terrain under it cannot be seen against it.
 */
export const DIFFERENCE_FILL = 'rgba(124, 58, 237, 0.55)';

/**
 * A cell is one square of the calculation grid, keyed by its south-west
 * corner in local metres.
 */
export interface DifferenceArea {
  readonly cells: readonly Local[];
  readonly cellSizeM: number;
}

/**
 * The smallest a cell may be drawn, in pixels.
 *
 * At the full-extent view the scale is about one pixel per metre, so a
 * one-metre cell is one pixel and a 652-cell patch is a scatter of specks
 * that antialiasing washes out. Widening each cell to a floor keeps the patch
 * visible when zoomed out, at the cost of overstating its edges by under a
 * metre — an honest trade for a layer whose whole job is *where*, not *how
 * much*, and one the caption already covers by calling the comparison
 * indicative.
 */
export const MIN_CELL_PX = 3;

export function drawDifference(
  context: CanvasRenderingContext2D,
  area: DifferenceArea,
  viewport: Viewport,
): void {
  if (area.cells.length === 0) return;

  const side = Math.max(area.cellSizeM * viewport.scale, MIN_CELL_PX);
  // Cells are keyed by their south-west corner, and canvas y grows downward,
  // so the corner to draw from is the *north*-west one — half a cell up.
  const lift = Math.max(area.cellSizeM * viewport.scale, MIN_CELL_PX);

  context.save();
  context.fillStyle = DIFFERENCE_FILL;
  for (const cell of area.cells) {
    const [x, y] = toScreen(viewport, cell);
    // Skip anything off-canvas: a comparison window can sit largely outside a
    // zoomed-in view, and filling thousands of invisible rectangles is the
    // difference between a layer that draws and one that stutters.
    if (x < -side || y < -lift || x > viewport.widthPx + side || y > viewport.heightPx + lift) {
      continue;
    }
    context.fillRect(x, y - lift, side, lift);
  }
  context.restore();
}
