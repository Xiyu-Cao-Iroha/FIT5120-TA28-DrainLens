#!/usr/bin/env node
/**
 * Is the council's copy of the derived layers still the pilot copies, moved?
 *
 * The derived layers exist in more than one place. `apps/web/public/data/derived.json`
 * is Kensington, in Kensington's frame, and is what the site draws when the
 * database is not answering. `apps/api/data/city-of-melbourne/derived.json` is
 * what the migration job loads — so it is what the site draws when the
 * database *is* answering — and it is built by `pipeline/reframe.py` from
 * every measured area: Kensington, and since 13 September the central city.
 *
 * **They drifted on 13 September.** The coverage-gap thresholds changed, the
 * Kensington copy was rebuilt, and the council copy was not: every test
 * passed, the database loaded without complaint, and the deployed map kept
 * hatching 46 gaps at the old 0.35 threshold while the bundled fallback drew
 * 14. Nothing looked at both files, because nothing had to.
 *
 * This does, three ways:
 *
 * - the council copy names exactly the measured areas below, where geo.py
 *   puts them;
 * - its Kensington shapes are the bundled shapes moved by (1500, 6000), point
 *   by point, and come first in every layer — `combine` writes them in the
 *   order it was given;
 * - every other shape lies inside the central city's box, and the settings
 *   match the bundled copy's, so one legend entry means one thing.
 *
 * The central city has no bundled copy to compare against — it is served only
 * from the database — so for it this checks placement and settings, not
 * shape.
 *
 * It is a script rather than a unit test for the same reason as
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
 * Each measured area in the council's frame: its south-west corner and size.
 *
 * Kensington is 316,500 / 5,814,500 and the central city 319,000 / 5,811,500,
 * less the council's 315,000 / 5,808,500 — the extents in
 * `pipeline/src/drainlens_pipeline/geo.py`. Written here rather than read from
 * the file, because reading them from the file would accept any placement the
 * file happened to claim.
 */
const AREAS = [
  { name: 'kensington', e: 1500, n: 6000, width_m: 1000, height_m: 1000 },
  { name: 'melbourne-cbd', e: 4000, n: 3000, width_m: 3000, height_m: 2500 },
];
const [KENSINGTON, CBD] = AREAS;
const OFFSET = [KENSINGTON.e, KENSINGTON.n];

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

if (JSON.stringify(council.areas) !== JSON.stringify(AREAS)) {
  problems.push(`the council copy's areas are ${JSON.stringify(council.areas)}, not ${JSON.stringify(AREAS)}`);
}

const inside = (area, [e, n]) =>
  e >= area.e - 0.051 && e <= area.e + area.width_m + 0.051 && n >= area.n - 0.051 && n <= area.n + area.height_m + 0.051;

const layers = new Set([...Object.keys(bundled.layers ?? {}), ...Object.keys(council.layers ?? {})]);
for (const layer of layers) {
  const from = bundled.layers?.[layer] ?? [];
  const to = council.layers?.[layer] ?? [];
  if (to.length < from.length) {
    problems.push(`${layer}: ${String(from.length)} Kensington shapes in the bundled copy, only ${String(to.length)} shapes in the council copy`);
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
  if (wrong > 0) problems.push(`${layer}: ${String(wrong)} of ${String(moved)} Kensington points are not the bundled point moved by (1500, 6000)`);

  let points = 0;
  let astray = 0;
  const each = (value) => {
    if (typeof value[0] === 'number') {
      points += 1;
      if (!inside(CBD, value)) astray += 1;
      return;
    }
    value.forEach(each);
  };
  to.slice(from.length).forEach((shape) => each(shape.c));
  if (astray > 0) problems.push(`${layer}: ${String(astray)} of ${String(points)} points after the Kensington shapes lie outside the central city`);
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
console.log(`derived layers: Kensington moved by (1500, 6000), the rest inside the central city — ${counts}`);
