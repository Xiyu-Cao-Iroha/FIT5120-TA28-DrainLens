/**
 * Whether the flood map's key is open, and how much of the map it may cover.
 *
 * **The team review asked for it to fold, and to be tested by narrowing the
 * window.** It sat over the top-right corner at 260 px wide and as tall as its
 * rows, with no way to put it away, and the map beside a 380 px panel is not
 * wide to begin with, so the narrower the window the more of the map was key.
 * The criterion was a small window that does not block the map.
 *
 * So the key folds, to its title and the control rather than to nothing — the
 * same reasoning as the drainage map's legend: a key that disappears is one
 * nobody finds again, and the title still says what the colours count.
 *
 * **It opens folded on a narrow frame and open on a wide one, until somebody
 * chooses.** Before a choice it follows the frame, so narrowing the window puts
 * it away and widening it brings it back. After a choice the choice wins: a
 * key that reopened itself on every resize would be arguing with the person
 * who closed it.
 *
 * **Open on a narrow frame, it stays a corner.** Its width and height are
 * capped and the rows scroll inside it, so opening it to check one band does
 * not trade the map for the key. On every frame it stops short of the zoom
 * buttons in the corner below it, which it used to be able to cover.
 */

/** Below this map width the key starts folded, and is capped when opened. */
export const LEGEND_NARROW_FRAME_PX = 720;

/** The key's width on a wide frame, which is what it always was. */
export const LEGEND_WIDTH_PX = 260;

/** The most it may take across a narrow frame. */
export const LEGEND_NARROW_WIDTH_PX = 220;

/** The share of a narrow frame's width the key may take, on a phone. */
export const LEGEND_NARROW_WIDTH_SHARE = 0.6;

/** The share of a narrow frame's height an open key may take before it scrolls. */
export const LEGEND_NARROW_HEIGHT_SHARE = 0.4;

/** Gap between the key and the frame's edge. */
export const LEGEND_INSET_PX = 16;

/**
 * Kept clear at the bottom of the frame for the zoom buttons, which share the
 * key's right-hand edge: their 16 px inset, two 32 px buttons, the 8 px between
 * them and 8 px so the key does not touch the top one.
 */
export const ZOOM_CLEARANCE_PX = 96;

/** Never shorter than this, so an open key always shows its title and a row or two. */
export const LEGEND_MIN_HEIGHT_PX = 96;

/**
 * Whether the frame is narrow. An unmeasured frame counts as narrow: the first
 * measurement lands before the first paint, and folded is the safe side to be
 * wrong on for the frame that never gets one.
 */
export function isNarrowFrame(frameWidthPx: number | null): boolean {
  return frameWidthPx === null || frameWidthPx < LEGEND_NARROW_FRAME_PX;
}

/** Open or folded: the person's choice if they have made one, the frame's if not. */
export function legendOpen(frameWidthPx: number | null, choice: boolean | null): boolean {
  return choice ?? !isNarrowFrame(frameWidthPx);
}

export interface LegendBox {
  readonly maxWidth: number;
  /** Null until the frame is measured; the key is folded then anyway. */
  readonly maxHeight: number | null;
}

/** The most of the map the key may cover, for a frame of this size. */
export function legendBox(frameWidthPx: number | null, frameHeightPx: number | null): LegendBox {
  const narrow = isNarrowFrame(frameWidthPx);
  const maxWidth =
    narrow && frameWidthPx !== null
      ? Math.min(LEGEND_NARROW_WIDTH_PX, Math.floor(frameWidthPx * LEGEND_NARROW_WIDTH_SHARE))
      : narrow
        ? LEGEND_NARROW_WIDTH_PX
        : LEGEND_WIDTH_PX;

  if (frameHeightPx === null) return { maxWidth, maxHeight: null };

  const clearOfZoom = frameHeightPx - LEGEND_INSET_PX - ZOOM_CLEARANCE_PX;
  const allowed = narrow ? Math.min(clearOfZoom, Math.floor(frameHeightPx * LEGEND_NARROW_HEIGHT_SHARE)) : clearOfZoom;
  return { maxWidth, maxHeight: Math.max(LEGEND_MIN_HEIGHT_PX, allowed) };
}
