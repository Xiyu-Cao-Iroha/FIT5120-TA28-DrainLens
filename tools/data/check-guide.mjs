#!/usr/bin/env node
/**
 * Does the published record still support the guide's promises?
 *
 * The guide tells every visitor to press a drainage pit and then follow the
 * water downstream from it. That only works where the council's record carries
 * an inlet with a path onward, and **whether one exists near a given address
 * is a fact about the artefact, not about our code**. A new release of
 * `map.json` or `trace.json` can take it away without a single test failing.
 *
 * So this is checked here rather than in the unit suite, for two reasons. It
 * is an artefact claim, which is the same reason `tools/docs/check.mjs` is a
 * script rather than a test. And it costs four and a half seconds over 4,089
 * addresses, in a suite the runner already times at six against a five-second
 * gate — buying the assurance at twice the price of the thing it protects.
 *
 * The rule it enforces is `apps/web/src/tutorial/pit.ts`'s, restated rather
 * than imported, because that module is TypeScript in a browser bundle and
 * this is a plain node script. **Restating it is a real cost**: the two can
 * drift, and the drift would be silent in the direction that matters least
 * (this script passing while the app picks differently). The numbers below are
 * the tie: they are asserted exactly, so a change in either place has to be
 * looked at.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../../apps/web/public/data');

/** The same expression `surfaceEntryOf` uses. Kept identical on purpose. */
const INLET = /grated|side entry|inlet|gsep|kerbside/;

/** The same radius `TEACHING_RADIUS_M` holds. */
const RADIUS_M = 200;

const read = async (name) => JSON.parse(await readFile(path.join(DATA, name), 'utf8'));

/**
 * Is there a pipe to follow from this pit?
 *
 * `traceDownstream(...).steps >= 1` in the application, and this is the whole
 * of what that means at the first hop: at least one link out of the pit names
 * a pit to go to. A link with no `to` is a *termination* — the record saying
 * the path stops here — and 215 pits in this extent have nothing else.
 *
 * **This was written as a walk down `links[id][0]` first, and it was wrong by
 * three pits.** `traceDownstream` takes the deepest branch, not the first, so
 * a pit whose first link terminates and whose second leads onward came out as
 * a dead end here and as teachable in the app. The unit test that pins the
 * count against this script found it on the first run, which is the only
 * reason a restated rule is allowed to exist at all.
 */
const leadsOnward = (links, start) =>
  (links[String(start)] ?? []).some((link) => link.to !== undefined);

const problems = [];
const note = (message) => problems.push(message);

const map = await read('map.json');
const trace = await read('trace.json');
const index = await read('addresses.json');

const pits = map.layers?.pit ?? [];
const links = trace.links ?? {};
/*
 * The index ships grouped by street: `on` holds "Street|Suburb" and `at` holds
 * a `[number, e, n]` triple per address. Only the positions matter here, so
 * this flattens rather than rebuilding the labels the browser rebuilds.
 *
 * **This script caught the shape change on the first run after it landed**,
 * reporting "0 addresses" and exiting 1 rather than passing over an empty
 * list. That is the whole reason it is a check and not a comment: a script
 * that read the new shape leniently would have reported success about nothing.
 */
const addresses = (index.on ?? []).flatMap((key, group) =>
  (index.at?.[group] ?? []).map(([number, e, n]) => ({ label: `${number} ${key}`, e, n })),
);
if ((index.on ?? []).length !== (index.at ?? []).length) {
  note(
    `addresses.json has ${String((index.on ?? []).length)} streets and ` +
      `${String((index.at ?? []).length)} groups of addresses; they must correspond`,
  );
}

if (pits.length === 0) note('map.json carries no pits at all');
if (addresses.length === 0) note('addresses.json carries no addresses at all');

const candidates = pits.filter(
  (pit) =>
    pit.asset_number !== undefined &&
    INLET.test(String(pit.object_type_lupvalue ?? '').toLowerCase()) &&
    leadsOnward(links, pit.asset_number),
);

/*
 * The tie to the application, asserted rather than trusted. `pit.test.ts`
 * checks the same number through `surfaceEntryOf` and `traceDownstream`, so a
 * change to either rule fails in one place or the other and cannot pass in
 * both while meaning different things.
 */
const EXPECTED_CANDIDATES = 368;
if (candidates.length !== EXPECTED_CANDIDATES) {
  note(
    `${String(candidates.length)} teachable pits, and this script expects ` +
      `${String(EXPECTED_CANDIDATES)}. Either the artefact changed or this rule has drifted from ` +
      `the one in apps/web/src/tutorial/pit.ts. pit.test.ts pins the same number; check both.`,
  );
}

if (candidates.length === 0) {
  note('no pit in the extent is both a recorded inlet and leads anywhere');
}

let furthest = 0;
let furthestLabel = '';
let unreachable = 0;
let firstUnreachable = '';

for (const address of addresses) {
  let nearest = Infinity;
  for (const pit of candidates) {
    const d = Math.hypot(address.e - pit.c[0], address.n - pit.c[1]);
    if (d < nearest) nearest = d;
  }
  if (nearest > furthest) {
    furthest = nearest;
    furthestLabel = address.label;
  }
  if (nearest > RADIUS_M) {
    unreachable += 1;
    if (firstUnreachable === '') firstUnreachable = address.label;
  }
}

if (unreachable > 0) {
  note(
    `${String(unreachable)} of ${String(addresses.length)} addresses have no teachable pit within ` +
      `${String(RADIUS_M)} m — the first is ${firstUnreachable}, and the furthest anywhere is ` +
      `${furthest.toFixed(1)} m. The guide would point at something off the reader's screen. ` +
      `Re-measure before raising TEACHING_RADIUS_M: a change here means the record moved.`,
  );
}

/*
 * The address the product offers when somebody has not got one of their own.
 *
 * It used to be `index.addresses[0]` — whichever sorted first, which was 32
 * Altona Street, fifteen metres from two boundaries of a one-kilometre square.
 * The map cannot centre an address already in the corner, so the guide's
 * teaching pit landed under the zoom buttons and the step *press the pit
 * marked on the map* pointed at something with a control on top of it.
 *
 * `apps/web/src/address/demonstration.ts` names one instead, and falls back to
 * the first if it is gone. **This is what stops the fallback being silent**:
 * a rebuilt index that drops this address, or moves it, fails here rather
 * than quietly going back to offering whatever sorts first.
 */
const DEMONSTRATION = '46 Gatehouse Drive, Kensington';

/**
 * How far the offered address must sit from the nearest boundary.
 *
 * The guide opens 300 m across, so half of that is what it takes for the view
 * to centre rather than clamp. 46 Gatehouse Drive has 307 m.
 */
const DEMONSTRATION_MARGIN_M = 150;

/*
 * Compared on the label the *browser* rebuilds, not the one this script
 * flattens to. `addresses` above joins the group key straight on, so its
 * labels read "46 Gatehouse Drive|Kensington" — and comparing those against
 * the product's "46 Gatehouse Drive, Kensington" matches nothing, which this
 * check reported as the address being missing from the index. A check that
 * fails for its own reasons is worse than no check: the message named a real
 * failure that was not happening.
 */
const asProductLabel = (label) => label.replace('|', ', ').toLowerCase();
const offered = addresses.find((a) => asProductLabel(a.label) === DEMONSTRATION.toLowerCase());
if (offered === undefined) {
  note(
    `${DEMONSTRATION} is not in the published index, so the address the product offers ` +
      `has silently gone back to whichever one sorts first. Pick another and name it in ` +
      `apps/web/src/address/demonstration.ts.`,
  );
} else {
  const margin = Math.min(
    offered.e,
    offered.n,
    index.extent.width_m - offered.e,
    index.extent.height_m - offered.n,
  );
  if (margin < DEMONSTRATION_MARGIN_M) {
    note(
      `${DEMONSTRATION} is ${margin.toFixed(1)} m from the edge of the extent, under the ` +
        `${String(DEMONSTRATION_MARGIN_M)} m the guide needs to centre on it. Its teaching pit ` +
        `will be drawn against the frame, where the map keeps its controls.`,
    );
  }
  let nearest = Infinity;
  for (const pit of candidates) {
    const d = Math.hypot(offered.e - pit.c[0], offered.n - pit.c[1]);
    if (d < nearest) nearest = d;
  }
  if (nearest > RADIUS_M) {
    note(`${DEMONSTRATION} has no teachable pit within ${String(RADIUS_M)} m`);
  }
}

/*
 * And the same promise on the map the API serves, which is a different map.
 *
 * **The address index is the one artefact that never comes from the API**, so
 * it always arrives in the pilot extent's frame while the map underneath may
 * be the council's — whose corner is 1.5 km west and 6 km south of
 * Kensington's. It went out that way: every pin 1.5 km and 6 km from the house
 * somebody typed, on a real street, inside the extent, looking like a map.
 * `unpack` now shifts the index into whichever map was served, and this is the
 * check that the shift lands the addresses where the guide can still work.
 *
 * Restated arithmetic again, and deliberately: this script exists to ask
 * questions of the artefacts that the application's own code cannot be trusted
 * to ask about itself.
 */
const council = JSON.parse(
  await readFile(path.resolve(HERE, '../../apps/api/data/city-of-melbourne/map.json'), 'utf8'),
);

const east = index.extent.min_e - council.extent.min_e;
const north = index.extent.min_n - council.extent.min_n;
if (
  east < 0 ||
  north < 0 ||
  east + index.extent.width_m > council.extent.width_m ||
  north + index.extent.height_m > council.extent.height_m
) {
  note(
    `the address index does not sit inside ${String(council.extent.name)}: ` +
      `${String(index.extent.width_m)}x${String(index.extent.height_m)} m at ` +
      `(${String(east)}, ${String(north)}). Every address would be drawn outside the map.`,
  );
}

const councilCandidates = (council.layers?.pit ?? []).filter(
  (pit) =>
    pit.asset_number !== undefined &&
    INLET.test(String(pit.object_type_lupvalue ?? '').toLowerCase()),
);

let councilFurthest = 0;
let councilFurthestLabel = '';
for (const address of addresses) {
  const e = address.e + east;
  const n = address.n + north;
  let nearest = Infinity;
  for (const pit of councilCandidates) {
    const d = Math.hypot(e - pit.c[0], n - pit.c[1]);
    if (d < nearest) nearest = d;
  }
  if (nearest > councilFurthest) {
    councilFurthest = nearest;
    councilFurthestLabel = address.label;
  }
}

if (councilFurthest > RADIUS_M) {
  note(
    `shifted into ${String(council.extent.name)}, ${councilFurthestLabel} is ` +
      `${councilFurthest.toFixed(1)} m from the nearest inlet, past the ${String(RADIUS_M)} m the ` +
      `guide allows. If this is a few hundred metres out, the shift is wrong rather than the data.`,
  );
}

const summary =
  `${String(addresses.length)} addresses, ${String(pits.length)} pits, ` +
  `${String(candidates.length)} of them a recorded inlet that leads somewhere. ` +
  `Furthest any address sits from one: ${furthest.toFixed(1)} m of ${String(RADIUS_M)} m allowed. ` +
  `Shifted into the council frame, furthest is ${councilFurthest.toFixed(1)} m.`;

if (problems.length > 0) {
  console.error(summary);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`guide data ok — ${summary}`);
