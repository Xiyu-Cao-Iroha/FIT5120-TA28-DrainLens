/**
 * The suburbs an address can be searched in, as the line under the box says.
 *
 * **Read off the index the search is about to use, not written down.** The
 * review of 15 September asked for the supported suburbs under the address
 * box; a typed list would be right on the day and wrong the first time the map
 * fell back to Kensington, when `unpack` clips the index to one square
 * kilometre and most of these suburbs have no address left in it. Derived, the
 * line and the search cannot disagree.
 *
 * Measured on the council index of 14 September: fourteen named suburbs, from
 * Melbourne's 14,234 addresses to South Wharf's 149. 730 addresses carry no
 * suburb and are left out of the line, not listed as a blank.
 */

import type { AddressIndex } from './search.js';

/** Held per index: the council index is 62,397 addresses, and this runs on render. */
const SUBURBS = new WeakMap<AddressIndex, readonly string[]>();

/** Every named suburb in the index, once each, alphabetically. */
export function suburbsOf(index: AddressIndex): readonly string[] {
  const held = SUBURBS.get(index);
  if (held !== undefined) return held;
  const named = new Set<string>();
  for (const address of index.addresses) {
    const suburb = address.suburb.trim();
    if (suburb !== '') named.add(suburb);
  }
  const suburbs = [...named].sort((a, b) => a.localeCompare(b));
  SUBURBS.set(index, suburbs);
  return suburbs;
}
