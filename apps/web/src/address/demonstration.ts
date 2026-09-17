/**
 * Which address the product offers when somebody has not got one of their own.
 *
 * **It was `index.addresses[0]` — whichever address sorted first.** The
 * pipeline sorts by street, then by house number, so the offer was the lowest
 * number on the alphabetically first street: 32 Altona Street. Nothing chose
 * it, and it is the worst address in the index for the job it was doing.
 *
 * 32 Altona Street sits at (985.9, 25.7) of a 1000 m square — fifteen metres
 * from two boundaries. The map clamps its view to the extent, so it cannot
 * centre an address already in the corner; the guide's teaching pit rendered
 * at (1068, 751) of a 1080×775 canvas, under the zoom buttons, and the
 * instruction *press the pit marked on the map* pointed at something with a
 * control sitting on top of it.
 *
 * So the offer is named, and the reasons are numbers. Measured across all
 * 4,089 published addresses:
 *
 * =========================  =========  =========  =======
 * address                    from edge  to its pit  path
 * =========================  =========  =========  =======
 * 32 Altona Street                 15 m       23 m  1 pipe
 * 46 Gatehouse Drive              307 m       24 m  22 pipes
 * =========================  =========  =========  =======
 *
 * 307 metres is more than the guide's 300-metre opening view needs, so the
 * address centres and its pit sits near the middle of the frame. The 22-pipe
 * path is the other half: *press Show connected drain pipe* draws a walk across the
 * neighbourhood rather than a single hop into a dead end.
 *
 * It is also already the demonstration address everywhere else — `pit.test.ts`
 * walks it, `search.test.ts` resolves it, and `pipeline/addresses.py` records
 * the dataset change that was found because it was missing. This makes the
 * screens agree with the tests.
 */

import type { AddressIndex, IndexedAddress } from './search.js';

/**
 * The label to offer, matched case-insensitively against the index.
 *
 * A label rather than a coordinate or an id: a coordinate would be a second
 * copy of something the index already holds, and would go on pointing at a
 * patch of ground after the address there was renumbered.
 */
export const DEMONSTRATION_LABEL = '46 Gatehouse Drive, Kensington';

/**
 * The address to offer, or the first in the index when the named one is gone.
 *
 * **The fallback is deliberate and is not silent.** An index rebuilt from a
 * new release could drop this address, and a screen with no suggestion at all
 * is worse than a screen suggesting an arbitrary one. What must not happen is
 * nobody noticing: `tools/data/check-guide.mjs` asserts the named address is
 * in the published index and is far enough from the extent's edges, and fails
 * the build rather than letting the offer quietly go back to being whatever
 * sorts first.
 */
export function demonstrationAddress(
  index: AddressIndex,
  label: string = DEMONSTRATION_LABEL,
): IndexedAddress | undefined {
  const find = (wanted: string) => index.addresses.find((a) => a.label.toLowerCase() === wanted.toLowerCase());
  return find(label) ?? find(DEMONSTRATION_LABEL) ?? index.addresses[0];
}

/**
 * The address the blocked-drain comparison offers, which is not the guide's.
 *
 * 46 Gatehouse Drive has no drain within 200 m that the model shows a
 * difference for, so a first comparison from it always says *No clear
 * difference* (census of 16 September, `public/data/scenario-differences.json`).
 * 89 Market Street, Kensington is 13 m from drain 1363588, which shows one at
 * every rainfall amount when fully blocked and at 40 and 60 mm when partly
 * blocked, and it is inside the bundled Kensington square as well as the
 * council map. `check-guide.mjs` does not hold it; `demonstration.test.ts`
 * does.
 */
export const COMPARE_DEMONSTRATION_LABEL = '89 Market Street, Kensington';

/**
 * The example addresses the guides and the full map offer, first one first.
 *
 * **Three, from team feedback on 17 September**, so there is a choice rather
 * than one address everybody tries. Each is inside the bundled Kensington
 * square, at least 150 m from its edges (the guide's opening view centres on
 * it), and near a teaching pit with a long path onward:
 *
 * ==============================  ==========  =========  ======
 * address                         from edge   to pit     pipes
 * ==============================  ==========  =========  ======
 * 46 Gatehouse Drive                  307 m       24 m      22
 * 11 Neale Street                     426 m        3 m      18
 * 2 Balmer Street                     188 m        4 m      16
 * ==============================  ==========  =========  ======
 *
 * `tools/data/check-guide.mjs` holds all three to the same rules.
 */
export const DEMONSTRATION_LABELS: readonly string[] = [
  DEMONSTRATION_LABEL,
  '11 Neale Street, Kensington',
  '2 Balmer Street, Kensington',
];

/**
 * The example addresses the comparison offers: three suburbs, each a few
 * metres from a drain the model shows a difference for.
 *
 * ================================  ======  =========  ==================
 * address                           drain   to drain   difference at
 * ================================  ======  =========  ==================
 * 89 Market Street, Kensington      1363588     13 m   fully 20/40/60 mm
 * 35 Poplar Road, Parkville         1146558     17 m   both, every amount
 * 93 Dudley Street, West Melbourne  1139969      4 m   fully 20/40/60 mm
 * 89 Epsom Road, Kensington         1363621     15 m   both, every amount
 * ================================  ======  =========  ==================
 *
 * The first three are offered. Parkville and West Melbourne are outside the
 * bundled Kensington square, so when the council map is unavailable they are
 * not in the index and Epsom Road takes their place (`demonstrationAddresses`).
 */
export const COMPARE_DEMONSTRATION_LABELS: readonly string[] = [
  COMPARE_DEMONSTRATION_LABEL,
  '35 Poplar Road, Parkville',
  '93 Dudley Street, West Melbourne',
  '89 Epsom Road, Kensington',
];

/** How many example addresses a screen offers. */
export const EXAMPLE_COUNT = 3;

/**
 * The example addresses to offer: the named ones the index holds, in order,
 * up to `EXAMPLE_COUNT`.
 *
 * A name the index does not hold is skipped rather than replaced by an
 * arbitrary address. If none is held, the single fallback of
 * `demonstrationAddress` applies, so a screen always has something to offer
 * while there is any address at all.
 */
export function demonstrationAddresses(
  index: AddressIndex,
  labels: readonly string[] = DEMONSTRATION_LABELS,
): IndexedAddress[] {
  const byLabel = new Map(index.addresses.map((a) => [a.label.toLowerCase(), a]));
  const found = labels
    .map((label) => byLabel.get(label.toLowerCase()))
    .filter((a): a is IndexedAddress => a !== undefined)
    .slice(0, EXAMPLE_COUNT);
  if (found.length > 0) return found;
  const fallback = demonstrationAddress(index, labels[0]);
  return fallback === undefined ? [] : [fallback];
}
