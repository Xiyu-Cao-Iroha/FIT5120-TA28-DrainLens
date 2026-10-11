/**
 * The addresses looked up in this tab, newest first.
 *
 * **It is held in the session object and written nowhere else.** That is not
 * a default anybody can drift off: `session.ts` states the rule -- not
 * `localStorage`, not `sessionStorage`, not the URL, not `history.state` --
 * and `session.test.ts` runs a whole session against traps in place of both
 * storages, `history` and `document.cookie`. A recent-address list is exactly
 * the thing that rule exists for. An address written to a device is an
 * identity sitting on a shared machine after the person has walked away, and
 * five of them is five times the same problem.
 *
 * So this list lives as long as the tab and no longer. What it buys is the
 * trip it was asked for: somebody checking their own street, then their
 * mother's, then their own again, who would otherwise retype the first one.
 * Closing the tab is the whole of the clearing mechanism, which is why there
 * is no *Clear history* control here -- a control implies there is something
 * to clear later, and there is not.
 *
 * **Nothing here is a judgement about the addresses.** No count, no
 * timestamp, no record of what was done at each one. It is the labels, in the
 * order they were chosen, which is the least that answers the question.
 */

import type { AddressIndex, IndexedAddress } from '@drainlens/address';

import type { SupportedAddress } from '../session.js';

/**
 * How many to keep.
 *
 * Long enough for the handful of places one person checks -- home, a
 * relative's, work -- and short enough that the list under the field stays a
 * list rather than a scroll. On a phone the field is near the top of the
 * screen and everything below it is the list, so this is also the number that
 * keeps the page's own content visible.
 */
export const MAX_RECENT = 5;

/** Said above the list, on both screens that show one. */
export const RECENT_LABEL = 'Recently searched in this tab';

/**
 * Put an address at the front, or leave the list exactly as it was.
 *
 * **It returns the same array when nothing changed, and that is load-bearing.**
 * `reduce` calls this after every event, because recording on each branch that
 * can set an address is three places to keep in step and one to forget. A new
 * array on every keystroke would then invalidate the `useMemo` that resolves
 * these against the index -- a pass over 62,397 addresses, repeated on every
 * pan of the map. Identity is the signal that there is nothing to redo.
 *
 * A null address is not a gap in the list: clearing the address on the map
 * leaves what was searched for, because the person has not unsearched it.
 */
export function remember(
  recent: readonly SupportedAddress[],
  address: SupportedAddress | null,
): readonly SupportedAddress[] {
  if (address === null) return recent;
  if (recent[0]?.id === address.id) return recent;
  return [address, ...recent.filter((held) => held.id !== address.id)].slice(0, MAX_RECENT);
}

/**
 * The same list as full index entries, for the screens that offer it.
 *
 * **The session holds `SupportedAddress`, and a suggestion list needs more
 * than that.** An id, a label and a pair of metres is everything the rest of
 * the product needs about where somebody lives; what it is missing is the
 * number, street and suburb that the two search fields already hand to their
 * callers. Rather than widen what the session carries -- more about an
 * address held for longer, which is the wrong direction -- this reads the
 * index that is on the screen anyway.
 *
 * **An id the index does not hold drops out, and that is the right answer.**
 * When the API cannot be reached the product falls back to a smaller bundled
 * index, and an address outside it cannot be put on the map. Offering a row
 * that would fail on the press is worse than a shorter list.
 *
 * `except` takes the address the screen is already showing. The map is
 * centred on it and names it in the field's placeholder, so a row that
 * re-chooses it is a row that does nothing.
 */
export function recall(
  index: AddressIndex,
  recent: readonly SupportedAddress[],
  except: string | null = null,
): readonly IndexedAddress[] {
  if (recent.length === 0) return [];

  // Built from the wanted ids rather than from the index, so the one pass
  // over the index stops at five rather than filling a map of 62,397.
  const wanted = new Set(recent.map((held) => held.id));
  wanted.delete(except ?? '');

  const found = new Map<string, IndexedAddress>();
  for (const address of index.addresses) {
    if (wanted.has(address.id)) found.set(address.id, address);
    if (found.size === wanted.size) break;
  }

  return recent.flatMap((held) => {
    const address = found.get(held.id);
    return address === undefined ? [] : [address];
  });
}
