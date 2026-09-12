/**
 * Does the deployed API answer with the artefacts, or only with something
 * shaped like them?
 *
 *   node tools/deploy/verify-api.mjs https://drainlens-api-....run.app
 *   node tools/deploy/verify-api.mjs https://drainlens-api-....run.app city-of-melbourne
 *
 * **The extent is an argument because the instance holds one of two.** This was
 * five hardcoded `/api/map/kensington` routes, which against a council-loaded
 * instance is a 404 on the first one — the script dies before printing a
 * single result, having verified nothing, and the deployment it was run to
 * check looks unverified rather than wrong. Each extent is compared against
 * its own published artefacts, in its own coordinate frame.
 *
 * `apps/api/test-db` asks this of a local Postgres and answers it in thirty
 * tests. This asks it of the instance that is actually serving, because a
 * green suite says the code is right and says nothing about which image is
 * running, which database it reached, or whether the migration job ever ran.
 *
 * **A deep comparison, not a shape check.** The frontend's guards accept a
 * trace with keys missing and links whose reason was dropped — four such
 * changes reached a passing test suite before a whole-response comparison
 * caught them. Comparing against the published file is the only check with no
 * opinion about which fields matter.
 *
 * Ordering is compared the way the integration suite compares it, and for the
 * same reason: `map.json`'s layer order is the pipeline's, the API's is the
 * SQL's, and a different but complete order is not a defect. Everything else
 * is compared exactly, order included, because in `trace.json` and
 * `flood-history.json` the order *is* data — a rank and a year.
 *
 * Exits non-zero on the first thing that is wrong, and says which.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Where each published extent's artefacts are, mirroring `apps/api/src/load.ts`. */
const EXTENTS = {
  kensington: path.resolve(HERE, '../../apps/web/public/data'),
  'city-of-melbourne': path.resolve(HERE, '../../apps/api/data/city-of-melbourne'),
};

/**
 * The flood board, which is Greater Melbourne's and not any pilot extent's.
 * One copy, read from the bundled directory whichever extent is being checked
 * — the same rule `load.ts` follows when it puts it in the database.
 */
const SHARED = EXTENTS.kensington;

const BASE = (process.argv[2] ?? '').replace(/\/$/, '');
const EXTENT = process.argv[3] ?? 'kensington';
if (!BASE) {
  console.error(
    'usage: node tools/deploy/verify-api.mjs https://the-deployed-url [extent]\n' +
      `       extent is one of: ${Object.keys(EXTENTS).sort().join(', ')}`,
  );
  process.exit(2);
}
const DATA = EXTENTS[EXTENT];
if (!DATA) {
  // Never a fall back to the default: verifying the wrong extent against a
  // service that answers for it is the one outcome worse than not verifying.
  console.error(
    `${EXTENT} is not a published extent (${Object.keys(EXTENTS).sort().join(', ')})`,
  );
  process.exit(2);
}

const get = async (route) => {
  const response = await fetch(`${BASE}${route}`);
  if (response.status === 401 || response.status === 403) {
    // The failure this exists to refuse to paper over. A run that timed and
    // compared rejections would be fast, plausible, and of nothing.
    throw new Error(
      `${route} answered ${String(response.status)}: this measured the gate, not the API`,
    );
  }
  if (!response.ok) {
    // Read to the end before throwing, rather than left unread or cancelled.
    // An unfinished body holds its socket, and the process then exits over a
    // live handle -- on Windows that is `Assertion failed: !(handle->flags &
    // UV_HANDLE_CLOSING)` and **exit code 127**, which is not the 1 this
    // script means by "checks failed" and not what a caller reading the code
    // would conclude. The 404 body also names the extent, which is the useful
    // half of the message.
    const body = (await response.text()).trim().slice(0, 120);
    throw new Error(`${route} answered ${String(response.status)}${body ? `: ${body}` : ''}`);
  }
  return response.json();
};

/**
 * Fetch now; fail inside whichever check needs the answer.
 *
 * Each of these was a bare top-level `await get(...)`, which was fine while
 * every route answered and a stack trace with no summary the moment one did
 * not — a wrong extent argument 404s on the first map route and the run ends
 * there, having printed one result and looked like a crash rather than a
 * finding. Attaching the handler here also means the rejection is never an
 * unhandled one.
 */
const later = (route) => {
  const settled = get(route).then(
    (value) => () => value,
    (error) => () => {
      throw error;
    },
  );
  return async () => (await settled)();
};

const published = async (name) =>
  JSON.parse(await readFile(path.join(DATA, name), 'utf8'));

const shared = async (name) =>
  JSON.parse(await readFile(path.join(SHARED, name), 'utf8'));

/** Sorted JSON of each element: same features, order not asserted. */
const asSet = (list) => [...list].map((f) => JSON.stringify(f)).sort();

let failed = 0;
// Awaited, and that is not a detail: a synchronous `try` around a call that
// returns a promise reports "ok" whatever the check found, and the rejection
// surfaces as an unhandled one after the summary has already been printed.
const report = async (label, work) => {
  try {
    await work();
    console.log(`  ok      ${label}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAILED  ${label}`);
    console.log(`          ${String(error.message).split('\n')[0]}`);
  }
};

console.log(`\nDrainLens API verification`);
console.log(`  target   ${BASE}`);
console.log(`  extent   ${EXTENT}`);
console.log(`  taken    ${new Date().toISOString()}\n`);

const mapFile = await published('map.json');
const floodFile = await shared('flood-history.json');
const scopeFile = await shared('sa2-areas.json');

// Health first. Everything below it is meaningless against an empty database,
// and an empty database is what a service that started before its migration
// job ran looks like.
//
// The counts are read off the artefacts rather than typed in. 895 and 30 were
// right for one extent and are two more things to remember to change for the
// other -- and a stale expectation here passes against the wrong city.
const health = later('/health');
const map = later(`/api/map/${EXTENT}`);
const derived = later(`/api/derived/${EXTENT}`);
const traced = later(`/api/trace/${EXTENT}`);
const flooded = later('/api/flood-history');

await report('health reports the data is in, not merely that the process is up', async () => {
  const it = await health();
  assert.equal(it.status, 'ok');
  assert.equal(it.pits, mapFile.layers.pit.length, `serving ${String(it.pits)} pits`);
  assert.equal(it.areas, floodFile.areas.length, `serving ${String(it.areas)} areas`);
  /*
    The tables hold every area in the scope and the board is thirty of them,
    so there are two numbers to be wrong about. A job that loaded the board
    and not the scope would keep `areas` right and leave the map with nothing
    to draw — which is the deployment failure this whole script exists for.
  */
  assert.equal(
    it.scopeAreas,
    scopeFile.areas.length,
    `holding ${String(it.scopeAreas)} areas in scope`,
  );
});

await report('map: every recorded feature, in every layer', async () => {
  const it = await map();
  assert.deepEqual(Object.keys(it.layers).sort(), Object.keys(mapFile.layers).sort());
  for (const layer of Object.keys(mapFile.layers)) {
    assert.deepEqual(
      asSet(it.layers[layer]),
      asSet(mapFile.layers[layer]),
      `layer ${layer} differs`,
    );
  }
});

await report('derived: the calculated layers, still labelled as calculated', async () => {
  assert.deepEqual((await derived()).layers, (await published('derived.json')).layers);
});

const traceFile = await published('trace.json');
await report('trace: links and terminations, empty keys and reasons included', async () => {
  const trace = await traced();
  assert.deepEqual(trace.links, traceFile.links);
  assert.deepEqual(trace.terminations, traceFile.terminations);
});
await report('trace: no link has a null destination and no reason', async () => {
  const trace = await traced();
  // Thirty-seven pipes leave a pit and the record does not say where they go.
  // Sent as `to: null`, the client walks into a pit that does not exist.
  for (const [from, links] of Object.entries(trace.links)) {
    for (const link of links) {
      assert.notEqual(link.to, null, `${from} has a link to null`);
      assert.notEqual(
        link.to === undefined,
        link.ends === undefined,
        `${from} has a link with neither a destination nor a reason`,
      );
    }
  }
});

await report('flood history: every area, rank, tie and yearly count', async () => {
  // `floodFile` comes from `shared`, not `published`: there is one flood board
  // and the council directory does not carry a copy of it.
  assert.deepEqual((await flooded()).areas, floodFile.areas);
});

await report('the same request twice returns the same bytes', async () => {
  const [a, b] = await Promise.all([
    fetch(`${BASE}/api/map/${EXTENT}`).then((r) => r.text()),
    fetch(`${BASE}/api/map/${EXTENT}`).then((r) => r.text()),
  ]);
  assert.equal(a, b, 'two identical requests answered differently');
});

await report('an extent it does not have is a 404 naming it, not a 500', async () => {
  const response = await fetch(`${BASE}/api/map/not-an-extent`);
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /not-an-extent/);
});

console.log(
  failed === 0
    ? '\n  Every response matched the published artefact.\n'
    : `\n  ${String(failed)} check(s) failed.\n`,
);
/*
  `process.exitCode`, not `process.exit()`.

  `process.exit()` tears the loop down under whatever is still open. On Windows
  and Node 26 that surfaced as `Assertion failed: !(handle->flags &
  UV_HANDLE_CLOSING)` and **exit code 127** on exactly the runs that had
  something to report -- so a verifier that had just found five real problems
  reported them as a crash, and any caller reading the code saw 127, which
  means "command not found". Setting the code and letting the process end on
  its own gives 1, which is what the summary above says.
*/
process.exitCode = failed === 0 ? 0 : 1;
