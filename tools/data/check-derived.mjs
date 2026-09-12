#!/usr/bin/env node
/**
 * Do the two copies of the derived layers still describe what they claim to?
 *
 * The derived layers exist twice, built separately:
 *
 * - `apps/web/public/data/derived.json` is Kensington, in Kensington's frame,
 *   and is what the site draws when the database is not answering.
 * - `apps/api/data/city-of-melbourne/derived.json` is the whole City of
 *   Melbourne, built from one terrain run over every point-cloud tile the
 *   archive has, and is what the migration job loads.
 *
 * **They drifted once.** On 13 September the coverage-gap thresholds changed,
 * the Kensington copy was rebuilt, and the council copy was not: every test
 * passed, the database loaded without complaint, and the deployed map kept
 * hatching at the old threshold while the fallback drew the new one. Nothing
 * looked at both files, because nothing had to. This does:
 *
 * - both were built with the same settings, so one legend entry means one
 *   thing whichever copy is on screen;
 * - the council copy names the tiles it is missing, those are tiles of its
 *   extent, and no shape has a point inside one — where nothing was measured,
 *   nothing may be drawn;
 * - every point lies inside the extent, and the council copy still says in
 *   words that nothing is claimed where the ground was not measured.
 *
 * The two copies are not compared shape for shape. A catchment that runs past
 * Kensington's edge is cut off in the pilot build and whole in the council
 * one, so the water paths legitimately differ at the edges.
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
 * The council extent and the point-cloud tile grid, from
 * `pipeline/src/drainlens_pipeline/geo.py`. Written here rather than read from
 * the file, so a file that moved its own extent cannot vouch for itself.
 */
const EXTENT = { minE: 315000, minN: 5808500, width: 8500, height: 9000 };
const TILE = { originE: 313000, originN: 5807000, size: 500 };
const MISSING_EXPECTED = 95;

const problems = [];

if (bundled.extent?.name !== 'kensington') {
  problems.push(`the bundled copy says it is ${JSON.stringify(bundled.extent?.name)}, not kensington`);
}
if (council.extent?.name !== 'city-of-melbourne') {
  problems.push(`the council copy says it is ${JSON.stringify(council.extent?.name)}, not city-of-melbourne`);
}
if (council.extent?.width_m !== EXTENT.width || council.extent?.height_m !== EXTENT.height) {
  problems.push(`the council copy is ${String(council.extent?.width_m)} x ${String(council.extent?.height_m)} m, not ${String(EXTENT.width)} x ${String(EXTENT.height)}`);
}

// The thresholds are what drifted; say so by name before anything else.
if (JSON.stringify(bundled.settings) !== JSON.stringify(council.settings)) {
  problems.push(
    `the settings differ — bundled ${JSON.stringify(bundled.settings)}, council ${JSON.stringify(council.settings)}. ` +
      'Rebuild whichever is older (the commands are in pipeline/README.md).',
  );
}

// Every tile of the extent, by the name the archive uses.
const tileName = (tx, ty) =>
  `Tile_${tx < 0 ? '-' : '+'}${String(Math.abs(tx)).padStart(3, '0')}_${ty < 0 ? '-' : '+'}${String(Math.abs(ty)).padStart(3, '0')}`;
const tx0 = Math.floor((EXTENT.minE - TILE.originE) / TILE.size);
const ty0 = Math.floor((EXTENT.minN - TILE.originN) / TILE.size);
const across = EXTENT.width / TILE.size;
const up = EXTENT.height / TILE.size;
const tiles = new Set();
for (let ty = ty0; ty < ty0 + up; ty += 1) for (let tx = tx0; tx < tx0 + across; tx += 1) tiles.add(tileName(tx, ty));

const missing = council.missing_tiles;
if (!Array.isArray(missing)) {
  problems.push('the council copy does not list the tiles it is missing');
} else {
  const strangers = missing.filter((name) => !tiles.has(name));
  if (strangers.length > 0) problems.push(`the council copy lists tiles outside its extent: ${strangers.join(', ')}`);
  if (missing.length !== MISSING_EXPECTED) {
    problems.push(`the council copy is missing ${String(missing.length)} tiles; the archive lacks ${String(MISSING_EXPECTED)} of this extent's ${String(tiles.size)}`);
  }
}

if (typeof council.covers !== 'string' || !council.covers.includes('nothing is claimed')) {
  problems.push('the council copy no longer says that nothing is claimed where the ground was not measured');
}

// Local metres -> tile name, for points strictly inside a tile. A point on a
// tile edge belongs to both neighbours, and an outline traced along the edge of
// the measured area sits exactly there.
const EDGE = 0.051;
const missingSet = new Set(Array.isArray(missing) ? missing : []);
const insideMissing = ([e, n]) => {
  const fx = (EXTENT.minE + e - TILE.originE) / TILE.size;
  const fy = (EXTENT.minN + n - TILE.originN) / TILE.size;
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  const offE = (fx - tx) * TILE.size;
  const offN = (fy - ty) * TILE.size;
  if (offE < EDGE || offE > TILE.size - EDGE || offN < EDGE || offN > TILE.size - EDGE) return false;
  return missingSet.has(tileName(tx, ty));
};
const outsideExtent = ([e, n]) => e < -EDGE || n < -EDGE || e > EXTENT.width + EDGE || n > EXTENT.height + EDGE;

for (const [layer, shapes] of Object.entries(council.layers ?? {})) {
  let points = 0;
  let onMissing = 0;
  let outside = 0;
  const walk = (value) => {
    if (typeof value[0] === 'number') {
      points += 1;
      if (outsideExtent(value)) outside += 1;
      else if (insideMissing(value)) onMissing += 1;
      return;
    }
    value.forEach(walk);
  };
  shapes.forEach((shape) => walk(shape.c));
  if (outside > 0) problems.push(`${layer}: ${String(outside)} of ${String(points)} points lie outside the council extent`);
  if (onMissing > 0) problems.push(`${layer}: ${String(onMissing)} of ${String(points)} points lie inside a tile the archive does not have`);
}

if (problems.length > 0) {
  console.error(`derived layers: ${String(problems.length)} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const counts = Object.entries(council.layers)
  .map(([name, shapes]) => `${String(shapes.length)} ${name}`)
  .join(', ');
console.log(
  `derived layers: same settings in both copies; the council copy covers ${String(tiles.size - missing.length)} of ${String(tiles.size)} tiles and draws nothing on the other ${String(missing.length)} — ${counts}`,
);
