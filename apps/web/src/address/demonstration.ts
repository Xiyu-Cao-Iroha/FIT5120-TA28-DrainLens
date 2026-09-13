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
 * path is the other half: *press Show connected pipe* draws a walk across the
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
export function demonstrationAddress(index: AddressIndex): IndexedAddress | undefined {
  const wanted = DEMONSTRATION_LABEL.toLowerCase();
  return index.addresses.find((a) => a.label.toLowerCase() === wanted) ?? index.addresses[0];
}
