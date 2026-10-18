/**
 * The drainage area's boundary, drawn over the map that is already there.
 *
 * AC 6.1.1 asks for the complete subcatchment boundary on the map. Complete is
 * the word that shapes this file: the boundary is not clipped to the extent,
 * so most of them run off the edge of the view, and one of them — Yarra River
 * (Mouth to Merri) — is 20.8 km² against the council's 76.5. What the map can
 * show is the part that fits, and the line must read as *a boundary that
 * continues* rather than as an area that stops where the drawing does.
 *
 * **A line and a wash, not a fill.** The map underneath is the thing being
 * explained — the streets, the pits, the pipes — and an opaque area over it
 * would hide what the boundary is about. The wash is 6% and the line is the
 * same violet family as the rest of the calculated layers, which is the
 * palette's way of saying this came from a record rather than from the street.
 *
 * **It does not take presses.** Nothing about the boundary is pressable: the
 * area's own card is already open when it is drawn, and a second way to open
 * the same card over the whole map would swallow presses meant for the pits
 * underneath it.
 */

import type { Local, Viewport } from './viewport.js';
import { toScreen } from './viewport.js';

/**
 * The outline, dashed, in the teal the design draws it in (Figma D2).
 *
 * Dashed because the boundary continues past the map on all but six of the
 * thirty-five areas, and a solid line would read as an edge where the area
 * stops rather than as one the view cuts off.
 */
export const BOUNDARY_STROKE = '#2f6f68';

/** The wash inside it, light enough to read a street name through. */
export const BOUNDARY_FILL = 'rgba(47, 111, 104, 0.10)';

/** How wide the outline is drawn, in pixels, at any zoom. */
export const BOUNDARY_WIDTH_PX = 2;

/** The dash pattern, in pixels. */
export const BOUNDARY_DASH: readonly number[] = [7, 5];

/**
 * The rings in the frame of the map they are drawn over.
 *
 * The areas are published in the council extent's frame; the map underneath is
 * the council's when the database answers and Kensington's when it does not,
 * and Kensington's corner is 1.5 km east and 6 km north of the council's. Drawn
 * unshifted on the fallback, a boundary lands kilometres from the address it
 * belongs to — on real streets, looking like a result. The same arithmetic as
 * `intoMapFrame` in `difference.ts`, for the same reason.
 */
export function boundaryInMapFrame(
  rings: readonly (readonly (readonly [number, number])[])[],
  artefactExtent: { readonly min_e: number; readonly min_n: number },
  mapExtent: { readonly min_e: number; readonly min_n: number },
): Local[][] {
  const de = artefactExtent.min_e - mapExtent.min_e;
  const dn = artefactExtent.min_n - mapExtent.min_n;
  return rings.map((ring) => ring.map(([east, north]) => [east + de, north + dn] as Local));
}

/**
 * Is any of this boundary near enough to the view to be worth drawing?
 *
 * A boundary whose every vertex is far outside the canvas still crosses it if
 * the view sits inside the area — the common case for a reader standing in the
 * middle of a 20 km² subcatchment — so this asks whether the ring's box misses
 * the view entirely, not whether its points are in it.
 */
export function boundaryInView(rings: readonly Local[][], viewport: Viewport): boolean {
  for (const ring of rings) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of ring) {
      const [x, y] = toScreen(viewport, point);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (maxX >= 0 && minX <= viewport.widthPx && maxY >= 0 && minY <= viewport.heightPx) return true;
  }
  return false;
}

/** The boundary, washed and outlined, under everything that can be pressed. */
export function drawCatchmentBoundary(
  context: CanvasRenderingContext2D,
  rings: readonly Local[][],
  viewport: Viewport,
): void {
  const drawable = rings.filter((ring) => ring.length >= 3);
  if (drawable.length === 0) return;

  context.save();
  context.beginPath();
  for (const ring of drawable) {
    ring.forEach((point, index) => {
      const [x, y] = toScreen(viewport, point);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
  }
  // Even-odd, so a ring inside another is a hole rather than a second wash:
  // the published boundaries carry their holes as further rings.
  context.fillStyle = BOUNDARY_FILL;
  context.fill('evenodd');
  context.strokeStyle = BOUNDARY_STROKE;
  context.lineWidth = BOUNDARY_WIDTH_PX;
  context.lineJoin = 'round';
  // Dashed, as the design draws it.
  context.setLineDash(BOUNDARY_DASH);
  context.stroke();
  context.setLineDash([]);
  context.restore();
}
