#!/usr/bin/env node
/**
 * Is the council's copy of the derived layers still the Kensington copy, moved?
 *
 * The derived layers exist twice. `apps/web/public/data/derived.json` is
 * Kensington, in Kensington's frame, and is what the site draws when the
 * database is not answering. `apps/api/data/city-of-melbourne/derived.json` is
 * the same shapes moved into the council's frame by `pipeline/reframe.py`, and
 * is what the migration job loads — so it is what the site draws when the
 * database *is* answering.
 *
 * **They drifted on 13 September.** The coverage-gap thresholds changed, the
 * Kensington copy was rebuilt, and the council copy was not: every test
 * passed, the database loaded without complaint, and the deployed map kept
 * hatching 46 gaps at the old 0.35 threshold while the bundled fallback drew
 * 14. Nothing looked at both files, because nothing had to.
 *
 * This does. It is a script rather than a unit test for the same reason as
 * `check-areas.mjs`: it is a claim about published artefacts, which a pipeline
 * run can break without a line of code changing.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const read = async (relative) => JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));

const bundled = await read('apps/web/public/data/derived.json');
const council = await read('apps/api/data/city-of-melbourne/derived.json');

/**
 * Kensington's south-west corner in the council's frame.
 *
 * 316,500 / 5,814,500 less 315,000 / 5,808,500 — the two extents in
 * `pipeline/src/drainlens_pipeline/geo.py`. Written here rather than inferred
 * from the files, because inferring it from the files would accept any offset
 * the two happened to share.
 */
const OFFSET = [1500, 6000];

const problems = [];

if (bundled.extent?.name !== 'kensington') {
  problems.push(`the bundled copy says it is ${JSON.stringify(bundled.extent?.name)}, not kensington`);
}
if (council.extent?.name !== 'city-of-melbourne') {
  problems.push(`the council copy says it is ${JSON.stringify(council.extent?.name)}, not city-of-melbourne`);
}

// The thresholds are what drifted; say so by name before comparing shapes.
if (JSON.stringify(bundled.settings) !== JSON.stringify(council.settings)) {
  problems.push(
    `the settings differ — bundled ${JSON.stringify(bundled.settings)}, council ${JSON.stringify(council.settings)}. ` +
      'Rebuild the council copy with pipeline/reframe.py (the command is in pipeline/README.md).',
  );
}

const layers = new Set([...Object.keys(bundled.layers ?? {}), ...Object.keys(council.layers ?? {})]);
for (const layer of layers) {
  const from = bundled.layers?.[layer] ?? [];
  const to = council.layers?.[layer] ?? [];
  if (from.length !== to.length) {
    problems.push(`${layer}: ${String(from.length)} shapes in the bundled copy, ${String(to.length)} in the council copy`);
    continue;
  }

  let moved = 0;
  let wrong = 0;
  const walk = (a, b) => {
    if (typeof a[0] === 'number') {
      moved += 1;
      // reframe rounds to a decimetre after adding the offset.
      if (Math.abs(a[0] + OFFSET[0] - b[0]) > 0.051 || Math.abs(a[1] + OFFSET[1] - b[1]) > 0.051) wrong += 1;
      return;
    }
    if (a.length !== b.length) {
      wrong += 1;
      return;
    }
    a.forEach((item, index) => walk(item, b[index]));
  };
  from.forEach((shape, index) => walk(shape.c, to[index].c));
  if (wrong > 0) problems.push(`${layer}: ${String(wrong)} of ${String(moved)} points are not the bundled point moved by (1500, 6000)`);
}

if (typeof council.covers !== 'string' || council.covers.length === 0) {
  problems.push('the council copy has lost its `covers` sentence');
}

if (problems.length > 0) {
  console.error(`derived layers: ${String(problems.length)} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const counts = Object.entries(council.layers)
  .map(([name, shapes]) => `${String(shapes.length)} ${name}`)
  .join(', ');
console.log(`derived layers: the council copy is the bundled copy moved by (1500, 6000) — ${counts}`);
