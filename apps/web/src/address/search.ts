/**
 * Finding an address in the pilot area, without asking anyone.
 *
 * The index ships with the site and the search runs against it in memory. That
 * is not a performance decision: a search box that calls a server sends every
 * keystroke of somebody's home address to it, and AD1 says this product has no
 * identity and wants none. **Nothing in this file may take a network.**
 *
 * The other half of the job is telling two failures apart. "We have no record
 * of that address" and "that address is real but outside the pilot area" are
 * different things to a resident, and AC 1.1.4 requires the second to be
 * explained rather than dressed up as the first — or worse, answered with a
 * nearby address they did not ask for.
 */

/** One address the pilot area covers. */
export interface IndexedAddress {
  readonly id: string;
  /** As published: "46 Gatehouse Drive, Kensington". */
  readonly label: string;
  /** House number, kept separate so "46 gate" ranks the right one first. */
  readonly number: string;
  readonly street: string;
  readonly suburb: string;
  /** Local metres, the frame the map works in. */
  readonly e: number;
  readonly n: number;
}

export interface AddressIndex {
  readonly area: string;
  readonly addresses: readonly IndexedAddress[];
}

/**
 * Street-type abbreviations, expanded before matching.
 *
 * Somebody typing "46 gatehouse dr" means Gatehouse Drive, and an index that
 * only matches the published spelling tells them their own address does not
 * exist. Expanding rather than stripping, so "st" cannot swallow "street" and
 * "saint" at once.
 */
const STREET_TYPES: Readonly<Record<string, string>> = {
  st: 'street',
  rd: 'road',
  dr: 'drive',
  ave: 'avenue',
  av: 'avenue',
  ln: 'lane',
  ct: 'court',
  cres: 'crescent',
  pde: 'parade',
  pl: 'place',
  tce: 'terrace',
  hwy: 'highway',
  cl: 'close',
  wy: 'way',
  sq: 'square',
  gr: 'grove',
  gve: 'grove',
  esp: 'esplanade',
  blvd: 'boulevard',
};

/** Lower-case, punctuation out, abbreviations expanded, spaces collapsed. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,'’`]/g, ' ')
    .replace(/[^a-z0-9/\- ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => STREET_TYPES[word] ?? word)
    .join(' ');
}

export interface Match {
  readonly address: IndexedAddress;
  /** Higher is better. Only meaningful against other matches for one query. */
  readonly score: number;
}

/**
 * How many suggestions to offer.
 *
 * Enough that the right one is nearly always among them, few enough that the
 * list is read rather than scrolled. A longer list on a phone pushes the map
 * off the screen, which is the thing the person came for.
 */
export const MAX_SUGGESTIONS = 6;

function scoreOne(address: IndexedAddress, query: string, words: readonly string[]): number {
  const label = normalise(address.label);
  const street = normalise(address.street);

  // Whole-query prefix beats everything: the person has typed the address.
  if (label.startsWith(query)) return 1000 - label.length;

  // Every word has to appear, or this is not the address they mean.
  for (const word of words) {
    if (!label.includes(word)) return -1;
  }

  let score = 500 - label.length;
  const first = words[0];
  if (first !== undefined && address.number === first) score += 200;
  if (first !== undefined && street.startsWith(first)) score += 60;
  for (const word of words.slice(1)) {
    if (street.startsWith(word)) score += 40;
  }
  return score;
}

/** Best matches for what has been typed, in order. */
export function search(
  index: AddressIndex,
  typed: string,
  limit: number = MAX_SUGGESTIONS,
): Match[] {
  const query = normalise(typed);
  if (query.length === 0) return [];

  const words = query.split(' ');
  const matches: Match[] = [];
  for (const address of index.addresses) {
    const score = scoreOne(address, query, words);
    if (score >= 0) matches.push({ address, score });
  }

  // Ties broken by label, so the same query always offers the same list.
  matches.sort((a, b) => b.score - a.score || a.address.label.localeCompare(b.address.label));
  return matches.slice(0, limit);
}

export type Resolution =
  | { readonly kind: 'found'; readonly address: IndexedAddress }
  | { readonly kind: 'ambiguous'; readonly matches: readonly Match[] }
  | { readonly kind: 'outside-pilot'; readonly typed: string }
  | { readonly kind: 'not-an-address'; readonly typed: string };

/**
 * Decide what to do with what somebody has typed and submitted.
 *
 * The two failures are kept apart on a deliberate signal: a query that names a
 * street the index knows, with a number the index does not, is an address in a
 * covered street and outside the covered part of it. A query naming no street
 * we hold is not something this product can say anything about at all.
 *
 * Neither case is ever resolved to a nearby address. AC 1.1.4 asks the product
 * to explain, and answering "did you mean number 44?" when somebody asked
 * about 46 is the failure the criterion exists to prevent.
 */
export function resolve(index: AddressIndex, typed: string): Resolution {
  const matches = search(index, typed);
  if (matches.length === 1) return { kind: 'found', address: matches[0]!.address };
  if (matches.length > 1) {
    const [best, second] = matches;
    // An exact whole-query prefix that nothing else ties with is the address.
    if (best && second && best.score >= 1000 && second.score < 1000) {
      return { kind: 'found', address: best.address };
    }
    return { kind: 'ambiguous', matches };
  }

  const query = normalise(typed);
  const knownStreet = index.addresses.some((address) => {
    const street = normalise(address.street);
    return query.includes(street) || street.split(' ').every((word) => query.includes(word));
  });
  return knownStreet
    ? { kind: 'outside-pilot', typed }
    : { kind: 'not-an-address', typed };
}
