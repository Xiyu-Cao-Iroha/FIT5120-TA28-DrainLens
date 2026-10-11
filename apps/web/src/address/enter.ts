/**
 * What the keyboard does in the map's address search.
 *
 * In the 15 September user test, typing "10 Lygon Street" into the full map's
 * search offered "10 Lygon Street, Carlton" first, and Enter did nothing: the
 * field had no form and no key handler, so only a click chose. The first
 * screen's search goes somewhere on Enter, and the same words in the same box
 * on the map have to do the same thing.
 *
 * Kept out of the component so the rule can be tested without a browser.
 */

import {
  type AddressIndex,
  type IndexedAddress,
  type Resolution,
  namesAKnownStreet,
  normalise,
  resolve,
} from '@drainlens/address';

/**
 * The address Enter goes to, or null to leave the suggestions open.
 *
 * **The first screen's rule, `resolve`, first.** `found` is the address. Where
 * `resolve` calls it `ambiguous` — several suggestions start with everything
 * typed, so nothing is ahead on score — the top suggestion is taken only if it
 * starts with the whole query *and* the query names a street the index holds.
 * The second half is what keeps Enter from guessing: "10" is a whole-query
 * prefix of hundreds of addresses, and the first of them alphabetically is not
 * an answer to anything. "10 Lygon Street" names the street, and the top
 * suggestion is the shortest label that starts with it.
 *
 * Anything else — no match, a street outside the pilot, a partial word — does
 * nothing on the map. The first screen explains those cases on a page of its
 * own; here the list, or its absence, already says it.
 */
export function addressForEnter(index: AddressIndex, typed: string): IndexedAddress | null {
  return addressFrom(index, typed, resolve(index, typed));
}

/**
 * The same rule, over a verdict somebody else reached.
 *
 * **Lifted off `resolve` on 11 October, when the map's search started asking
 * the API.** The decision above is about what Enter does with a verdict, and
 * the verdict can now arrive from Postgres as easily as from the index in
 * memory -- both ends run the same matcher, so the two are the same four
 * kinds by different routes. Splitting them is what lets the map await one
 * without this rule being written twice.
 *
 * **The street guard still reads the local index**, and deliberately. The
 * published index and the `address` table are loaded from the same file, so
 * in practice they know the same streets; where they could ever differ, this
 * asks the smaller of the two and Enter leaves the suggestions open rather
 * than guessing. Cautious is the safe direction for a key that moves the map.
 */
export function addressFrom(
  index: AddressIndex,
  typed: string,
  answer: Resolution,
): IndexedAddress | null {
  if (answer.kind === 'found') return answer.address;
  if (answer.kind !== 'ambiguous') return null;
  const [best] = answer.matches;
  const query = normalise(typed);
  if (best === undefined || !normalise(best.address.label).startsWith(query)) return null;
  return namesAKnownStreet(index, query) ? best.address : null;
}

/**
 * The suggestion the arrow keys land on, as an index into the list, or -1 for
 * none — the typed text itself.
 *
 * Down from the field goes to the first suggestion and stops at the last; up
 * from the first goes back to the field, the way a browser's own address bar
 * does, so there is always a way back to editing what was typed.
 */
export function nextActive(current: number, count: number, key: 'ArrowDown' | 'ArrowUp'): number {
  if (count <= 0) return -1;
  if (key === 'ArrowDown') return Math.min(Math.max(current, -1) + 1, count - 1);
  return current <= 0 ? -1 : Math.min(current, count) - 1;
}
