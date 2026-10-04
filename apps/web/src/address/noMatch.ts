/**
 * What the search box says when it finds nothing.
 *
 * It used to say nothing at all: the list of suggestions simply did not
 * appear, which looks exactly like a box that has stopped working. A teammate
 * reported it on 3 October after typing *parkville* and getting silence — and
 * they were right to, but not for the reason it looked like. The index holds
 * all fourteen suburbs of the council; what they had was the **Kensington
 * fallback**, which is the same index clipped to one square kilometre, so
 * every Parkville address had been dropped before a key was pressed.
 *
 * So there are two different silences and the box now tells them apart:
 * nothing matched what you typed, or nothing of that place is in this map at
 * all. The second one is the product's limit rather than the reader's mistake,
 * and the footer has always said so — but somebody searching is looking at the
 * box, not at the footer.
 */

import { type AddressIndex } from './search.js';
import { suburbsOf } from './suburbs.js';

/** How many suburbs are listed before the sentence gets unreadable. */
const NAMED = 4;

/** The suburbs in the index, as a sentence: *Kensington and Flemington*. */
export function searchable(index: AddressIndex): string {
  const suburbs = suburbsOf(index);
  if (suburbs.length === 0) return 'this map';
  if (suburbs.length === 1) return suburbs[0] ?? 'this map';
  const named = suburbs.slice(0, NAMED);
  const rest = suburbs.length - named.length;
  const list = `${named.slice(0, -1).join(', ')} and ${String(named.at(-1))}`;
  return rest === 0 ? list : `${list}, and ${String(rest)} more`;
}

/**
 * The line under an empty result, or `null` while there is nothing to say.
 *
 * Nothing is said until two characters have been typed, for the same reason
 * the suggestions wait: the first letter of every address matches nothing in
 * particular, and a product that says *no match* on the first keystroke is
 * arguing with somebody who has not finished.
 */
export function noMatch(index: AddressIndex, typed: string, matches: number): string | null {
  if (matches > 0) return null;
  if (typed.trim().length < 2) return null;
  return index.clipped === true
    ? `No match. The full council map is not available right now, so only ${searchable(index)} can be searched.`
    : `No match for “${typed.trim()}”. Try a street name and number, or another address in ${searchable(index)}.`;
}
