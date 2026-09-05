/**
 * Does the deployed API answer with the artefacts, or only with something
 * shaped like them?
 *
 *   node tools/deploy/verify-api.mjs https://drainlens-api-....run.app
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
const DATA = path.resolve(HERE, '../../apps/web/public/data');

const BASE = (process.argv[2] ?? '').replace(/\/$/, '');
if (!BASE) {
  console.error('usage: node tools/deploy/verify-api.mjs https://the-deployed-url');
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
  if (!response.ok) throw new Error(`${route} answered ${String(response.status)}`);
  return response.json();
};

const published = async (name) =>
  JSON.parse(await readFile(path.join(DATA, name), 'utf8'));

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
console.log(`  taken    ${new Date().toISOString()}\n`);

// Health first. Everything below it is meaningless against an empty database,
// and an empty database is what a service that started before its migration
// job ran looks like.
const health = await get('/health');
await report('health reports the data is in, not merely that the process is up', () => {
  assert.equal(health.status, 'ok');
  assert.equal(health.pits, 895, `serving ${String(health.pits)} pits`);
  assert.equal(health.areas, 30, `serving ${String(health.areas)} areas`);
});

const map = await get('/api/map/kensington');
const mapFile = await published('map.json');
await report('map: every recorded feature, in every layer', () => {
  assert.deepEqual(Object.keys(map.layers).sort(), Object.keys(mapFile.layers).sort());
  for (const layer of Object.keys(mapFile.layers)) {
    assert.deepEqual(
      asSet(map.layers[layer]),
      asSet(mapFile.layers[layer]),
      `layer ${layer} differs`,
    );
  }
});

const derived = await get('/api/derived/kensington');
await report('derived: the calculated layers, still labelled as calculated', async () => {
  assert.deepEqual(derived.layers, (await published('derived.json')).layers);
});

const trace = await get('/api/trace/kensington');
const traceFile = await published('trace.json');
await report('trace: links and terminations, empty keys and reasons included', () => {
  assert.deepEqual(trace.links, traceFile.links);
  assert.deepEqual(trace.terminations, traceFile.terminations);
});
await report('trace: no link has a null destination and no reason', () => {
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

const flood = await get('/api/flood-history');
await report('flood history: every area, rank, tie and yearly count', async () => {
  assert.deepEqual(flood.areas, (await published('flood-history.json')).areas);
});

await report('the same request twice returns the same bytes', async () => {
  const [a, b] = await Promise.all([
    fetch(`${BASE}/api/map/kensington`).then((r) => r.text()),
    fetch(`${BASE}/api/map/kensington`).then((r) => r.text()),
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
process.exit(failed === 0 ? 0 : 1);
