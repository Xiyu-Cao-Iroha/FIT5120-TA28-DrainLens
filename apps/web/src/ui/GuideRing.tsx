/**
 * The ring the guide draws around the thing it is asking you to press.
 *
 * **One ring, one colour, everywhere.** The map's layer chips have pulsed in
 * the amber of the teaching pit's ring since the copy audit replaced *Waiting
 * for you to try it* (`.chip--pulse` in `base.css`). The controls that live
 * inside a card -- the plan's *Check the street drains near you*, the *Why
 * this place?* fold, *Report a problem*, the problem list -- grew their own
 * two pixels of brand green instead, each written out again at the place it
 * was needed. Green is the product's own colour and sits on half the
 * interface already: a reader cannot tell a green edge that means *press this
 * now* from a green edge that means *this is a button*. The team asked for
 * the amber (11 October, items 1 and 2), which is what the chips were already
 * using, so this points every one of them at that class.
 *
 * **And it scrolls the thing into view.** The plan is taller than the card it
 * is in, and step five's button sits under the places, the general actions
 * and a heading: the same report, also 11 October, is that the step said
 * *Click Check the street drains near you* beside a panel that was not
 * showing it. A ring nobody can see is not a ring.
 *
 * `block: 'nearest'` because the element is usually already somewhere on
 * screen and only the card it is in needs to move; `nearest` leaves every
 * scrollable ancestor that already holds it alone, where `center` would heave
 * the whole page about to centre a fold.
 */

import { useEffect, useRef } from 'react';

/** The class that draws it. Shared with the map chips rather than copied. */
export const GUIDE_RING = 'chip--pulse';

/** `className` for something that is ringed only while a step waits on it. */
export const ringClass = (on: boolean): string | undefined => (on ? GUIDE_RING : undefined);

/**
 * A ref to put on the ringed element, which scrolls itself into view.
 *
 * Only when the ring comes on, and never otherwise: a step that keeps pulling
 * the card back would take the scroll away from a reader who had chosen to
 * look somewhere else in it.
 */
export function useRingIntoView<T extends HTMLElement>(on: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!on) return;
    const node = ref.current;
    if (node === null || typeof node.scrollIntoView !== 'function') return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [on]);

  return ref;
}
