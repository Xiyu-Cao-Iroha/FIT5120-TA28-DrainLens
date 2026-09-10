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
const addresses = index.addresses ?? [];

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

const summary =
  `${String(addresses.length)} addresses, ${String(pits.length)} pits, ` +
  `${String(candidates.length)} of them a recorded inlet that leads somewhere. ` +
  `Furthest any address sits from one: ${furthest.toFixed(1)} m of ${String(RADIUS_M)} m allowed.`;

if (problems.length > 0) {
  console.error(summary);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`guide data ok — ${summary}`);
