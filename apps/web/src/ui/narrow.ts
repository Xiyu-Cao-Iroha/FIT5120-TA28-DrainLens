/**
 * Whether this is a phone-width screen, for the few decisions CSS cannot make.
 *
 * **Most of the phone layout is in `base.css` and should stay there.** A
 * media query does not re-render, cannot be wrong about the order effects
 * run in, and is the right tool for hiding a tagline or letting a row
 * scroll. This exists for the one kind of decision a stylesheet cannot
 * reach: what a component's state should *start* as.
 *
 * The map's layer chips are the case it was written for. On a 375 px screen
 * the six of them wrap to four rows and take the top half of the map, so
 * they start folded there and expanded everywhere else. That is a different
 * initial value, not a different style, and no amount of CSS produces it.
 *
 * **The number is `NARROW_FRAME_PX` and is deliberately not a new one.**
 * `fitBounds` already uses 560 as the width below which the map stops
 * reserving room for a panel beside it. Two breakpoints a hundred pixels
 * apart would be two rules nobody can hold in their head at once, and the
 * same 560 is what `base.css` queries on.
 */

import { NARROW_FRAME_PX } from '../map/fitBounds.js';

export const NARROW_PX = NARROW_FRAME_PX;

/** The media query `base.css` uses, as a string, so the two cannot drift. */
export const NARROW_QUERY = `(max-width: ${String(NARROW_PX)}px)`;

/**
 * Whether a width is phone width.
 *
 * Inclusive of the breakpoint itself, because `base.css` writes
 * `max-width: 560px` and a boundary that belongs to the phone in CSS and to
 * the desktop here is the kind of disagreement that shows up once, on one
 * device, and is never reproduced.
 */
export const isNarrow = (widthPx: number): boolean => widthPx <= NARROW_PX;

/**
 * Whether the window is phone width right now, or `false` where there is no
 * window to ask.
 *
 * Read once, when a component decides its opening state. It does not
 * subscribe: a reader who rotates a phone mid-session gets the layout the
 * stylesheet gives them, and the one piece of state this governs is theirs
 * to change with the control that governs it.
 */
export function narrowNow(view: { readonly innerWidth: number } | undefined = globalThis.window): boolean {
  return view === undefined ? false : isNarrow(view.innerWidth);
}
