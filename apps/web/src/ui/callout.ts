/**
 * Putting a card beside a thing on screen, without covering it or leaving the
 * window.
 *
 * Two callers, and they are the same problem seen twice: the guided tour puts
 * a card beside the control it is explaining, and the map puts one beside the
 * pit somebody pressed. Both have a small target at a known position, a card
 * of a known size, and a box neither may escape.
 *
 * It lives on its own because it is arithmetic, and arithmetic that is only
 * ever looked at is arithmetic nobody checked. Every rule below is a case that
 * was got wrong once: a card over the thing it points at, a card off the right
 * edge, a caret still centred after the card was clamped sideways, and a
 * clamp whose maximum goes negative in a window narrower than the card.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Breathing room around the highlighted control, in pixels. */
export const SPOTLIGHT_PADDING = 6;

/** Between the spotlight and the card. */
export const CARD_GAP = 14;

/** Between the card and the edge of the window. */
export const EDGE_MARGIN = 16;

/**
 * The hole in the overlay: the control's own box, grown a little.
 *
 * Grown rather than exact, because a cutout flush to a control's border reads
 * as a rendering fault rather than as a highlight.
 */
export function spotlightFor(target: Box, padding: number = SPOTLIGHT_PADDING): Box {
  return {
    x: target.x - padding,
    y: target.y - padding,
    width: target.width + padding * 2,
    height: target.height + padding * 2,
  };
}

export interface Placement {
  readonly left: number;
  readonly top: number;
  /** Which side of the card the caret is on, so it points back at the hole. */
  readonly caret: 'top' | 'bottom' | 'none';
}

/**
 * Where the card goes: beside the hole, never over it, never off screen.
 *
 * Below the spotlight by preference, above it when there is no room below,
 * and — when the window is too short for either — centred with no caret,
 * because a caret pointing at something the card is covering is worse than
 * no caret at all. Horizontally it is centred on the hole and then clamped,
 * which is why the caret's own offset is computed from the final position
 * rather than assumed to be the middle.
 */
export function placeCard(spot: Box, card: Box, view: { width: number; height: number }): Placement {
  const below = spot.y + spot.height + CARD_GAP;
  const above = spot.y - CARD_GAP - card.height;

  const fitsBelow = below + card.height + EDGE_MARGIN <= view.height;
  const fitsAbove = above >= EDGE_MARGIN;

  let top: number;
  let caret: Placement['caret'];
  if (fitsBelow) {
    top = below;
    caret = 'top';
  } else if (fitsAbove) {
    top = above;
    caret = 'bottom';
  } else {
    top = Math.max(EDGE_MARGIN, (view.height - card.height) / 2);
    caret = 'none';
  }

  const centred = spot.x + spot.width / 2 - card.width / 2;
  const widest = view.width - card.width - EDGE_MARGIN;
  // Math.min first, so a card wider than the window is pinned to the left edge
  // rather than pushed off the left of it by a negative maximum.
  const left = Math.max(EDGE_MARGIN, Math.min(centred, widest));

  return { left, top, caret };
}

/**
 * How far along the card's edge the caret sits, as a fraction.
 *
 * Clamped away from the corners: a caret on the rounded corner of a card is a
 * notch in the outline rather than a pointer.
 */
export function caretAt(spot: Box, placement: Placement, card: Box): number {
  const middle = spot.x + spot.width / 2 - placement.left;
  const fraction = middle / card.width;
  return Math.min(0.9, Math.max(0.1, fraction));
}
