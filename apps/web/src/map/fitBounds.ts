/**
 * A view that holds a few particular things, clear of whatever covers the map.
 *
 * The blocked-drain comparison opens on two points — the searched address and
 * the drain it will ask about — and returns with a third thing, the area the
 * model found. **A fixed zoom centred on the address was the wrong answer for
 * both.** At the guide's three pixels per metre a drain 150 m away is off a
 * laptop pane, and a drain 20 m away is a pair of markers touching each other
 * in the middle of a street's worth of empty map.
 *
 * So the view is fitted to the things themselves, with room kept for the panel
 * that slides in beside the map, and never tighter than a minimum extent.
 */

import { type Bounds, MAX_SCALE, type Viewport, clamp, scaleToContain } from './viewport.js';
import type { Local } from './viewport.js';

/** Pixels kept clear on each side of the fitted points. */
export interface Padding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * The narrowest the fitted view may be, in metres.
 *
 * 180 m, from the prototype's annotation. An address and a drain 15 m apart
 * fitted exactly would open at the map's maximum zoom — street furniture — with
 * no street name, no neighbouring pit and nothing to say where on the map the
 * person is. 180 m is about a block each way in the council's grid.
 */
export const MIN_FIT_ACROSS_M = 180;

/** Room kept for the step-2 panel, which is this wide. */
export const PANEL_WIDTH_PX = 320;

/** Room kept on every other side, so no marker sits against an edge or a control. */
export const EDGE_PADDING_PX = 80;

/**
 * Below this frame width the panel stacks under the map rather than beside it,
 * so nothing slides in from the left and there is no room worth reserving.
 */
export const NARROW_FRAME_PX = 560;

/** Padding on a phone-width frame: enough for the pin's head and a label. */
export const NARROW_PADDING_PX = 32;

/**
 * How much of the frame to keep clear.
 *
 * `reservePanel` is true on step 1, where the map is full width and the panel
 * has not arrived yet: the points are fitted to the right of where it will
 * be, so selecting a drain does not put either marker behind it. From step 2
 * the panel is beside the map rather than over it, and the map has already
 * narrowed.
 */
export function fitPadding(frameWidthPx: number, reservePanel: boolean): Padding {
  if (frameWidthPx < NARROW_FRAME_PX) {
    return { top: NARROW_PADDING_PX, right: NARROW_PADDING_PX, bottom: NARROW_PADDING_PX, left: NARROW_PADDING_PX };
  }
  return {
    top: EDGE_PADDING_PX,
    right: EDGE_PADDING_PX,
    bottom: EDGE_PADDING_PX,
    left: reservePanel ? PANEL_WIDTH_PX : EDGE_PADDING_PX,
  };
}

/**
 * The view that holds every point inside the padded frame.
 *
 * The points' box is widened to `minAcrossM` on each axis about its own centre,
 * scaled to the room left inside the padding, and centred on that room rather
 * than on the canvas — which is what keeps a point off the reserved strip.
 * The scale stops at `MAX_SCALE` and at the scale that shows the whole extent,
 * and the centre is clamped as every other view is.
 *
 * Padding that leaves less than a quarter of either side is shrunk in
 * proportion rather than honoured: a 320 px reserve on a 400 px frame would
 * fit two points into eighty pixels.
 */
export function fitPoints(
  widthPx: number,
  heightPx: number,
  bounds: Bounds,
  points: readonly Local[],
  padding: Padding,
  minAcrossM: number = MIN_FIT_ACROSS_M,
): Viewport {
  const floor = scaleToContain(widthPx, heightPx, bounds);
  if (points.length === 0) {
    return clamp({ widthPx, heightPx, scale: floor, centre: [bounds.widthM / 2, bounds.heightM / 2] }, bounds);
  }

  let minE = Infinity;
  let minN = Infinity;
  let maxE = -Infinity;
  let maxN = -Infinity;
  for (const [east, north] of points) {
    minE = Math.min(minE, east);
    maxE = Math.max(maxE, east);
    minN = Math.min(minN, north);
    maxN = Math.max(maxN, north);
  }
  const centreE = (minE + maxE) / 2;
  const centreN = (minN + maxN) / 2;
  const spanE = Math.max(maxE - minE, minAcrossM);
  const spanN = Math.max(maxN - minN, minAcrossM);

  const shrinkX = Math.min(1, (widthPx * 0.75) / Math.max(padding.left + padding.right, 1));
  const shrinkY = Math.min(1, (heightPx * 0.75) / Math.max(padding.top + padding.bottom, 1));
  const left = padding.left * shrinkX;
  const right = padding.right * shrinkX;
  const top = padding.top * shrinkY;
  const bottom = padding.bottom * shrinkY;
  const roomX = widthPx - left - right;
  const roomY = heightPx - top - bottom;

  const scale = Math.min(Math.max(Math.min(roomX / spanE, roomY / spanN), floor), MAX_SCALE);

  // The room's centre, in canvas pixels, and how far it sits from the canvas's.
  const offsetX = left + roomX / 2 - widthPx / 2;
  const offsetY = top + roomY / 2 - heightPx / 2;
  return clamp(
    {
      widthPx,
      heightPx,
      scale,
      // Canvas y runs down and northing up, so the vertical offset adds.
      centre: [centreE - offsetX / scale, centreN + offsetY / scale],
    },
    bounds,
  );
}
