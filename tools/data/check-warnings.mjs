#!/usr/bin/env node
/**
 * Does every low-area warning still sit on a low area?
 *
 * The warnings are built from the terrain run (`low_area_warnings.py`), and the
 * outlines they mark are built from the same run into a different file
 * (`derived.py`). Rebuild one and not the other and the map puts a warning sign
 * on a street with no blue under it — a claim about a hollow the map does not
 * show. Nothing in the unit suite reads both files, so this does:
 *
 * - each extent's warnings name that extent and its size, since the site picks
 *   the file by the name of the map that was served and draws it in that frame;
 * - both were built with the same thresholds, so one sign means one thing;
 * - every point lies inside a drawn low area of the matching derived artefact,
 *   by even-odd over all of its rings, so a point in a hole does not count —
 *   or within the outlines' simplification tolerance of one. The deepest cell
 *   of a hollow can be one of its edge cells, and simplifying the outline to a metre can cut the corner that cell sits in:
 *   9 of the council's 764 on 15 September, all within half a metre.
 *
 * A script rather than a test for the reason `check-derived.mjs` gives: it is
 * a claim about published artefacts, which a pipeline run can break without a
 * line of code changing.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const read = async (relative) => JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));

const PAIRS = [
  { name: 'kensington', warnings: 'apps/web/public/data/warnings/kensington.json', derived: 'apps/web/public/data/derived.json' },
  {
    name: 'city-of-melbourne',
    warnings: 'apps/web/public/data/warnings/city-of-melbourne.json',
    derived: 'apps/api/data/city-of-melbourne/derived.json',
  },
];

const problems = [];
const settings = [];

const distanceToRing = (ring, [x, y]) => {
  let nearest = Infinity;
  for (let i = 1; i < ring.length; i += 1) {
    const [ax, ay] = ring[i - 1];
    const [bx, by] = ring[i];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / length, 0), 1);
    nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return nearest;
};

const inside = (ring, [x, y]) => {
  let odd = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) odd = !odd;
  }
  return odd;
};

for (const pair of PAIRS) {
  const warnings = await read(pair.warnings);
  const derived = await read(pair.derived);
  const say = (message) => problems.push(`${pair.name}: ${message}`);

  if (warnings.artefact !== 'low-area-warnings') say(`${pair.warnings} is not a low-area-warnings artefact`);
  if (warnings.basis !== 'derived') say('the warnings do not declare themselves derived');
  if (warnings.extent?.name !== pair.name) say(`the warnings say they are ${JSON.stringify(warnings.extent?.name)}`);
  if (warnings.extent?.width_m !== derived.extent?.width_m || warnings.extent?.height_m !== derived.extent?.height_m) {
    say(`the warnings are ${String(warnings.extent?.width_m)} x ${String(warnings.extent?.height_m)} m and the low areas are ${String(derived.extent?.width_m)} x ${String(derived.extent?.height_m)} m`);
  }
  if (warnings.settings?.min_drawn_depression_m2 !== derived.settings?.min_drawn_depression_m2) {
    say('the warnings and the low areas were built with different drawing thresholds');
  }
  settings.push(JSON.stringify(warnings.settings));

  const points = warnings.points ?? [];
  if (points.length === 0) say('there are no warnings at all');
  if (warnings.counts?.warnings !== points.length) say(`the counts say ${String(warnings.counts?.warnings)} and there are ${String(points.length)} points`);

  const rings = (derived.layers?.['low-point'] ?? []).flatMap((shape) => shape.c);
  const boxes = rings.map((ring) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return [minX, minY, maxX, maxY];
  });
  const tolerance = derived.settings?.simplify_tolerance_m ?? 0;
  let off = 0;
  let onEdge = 0;
  for (const point of points) {
    const [x, y] = point.c;
    if (!(x >= 0 && y >= 0 && x <= warnings.extent.width_m && y <= warnings.extent.height_m)) {
      say(`a warning at (${String(x)}, ${String(y)}) is outside the extent`);
      continue;
    }
    if (!(point.depthM >= warnings.settings.min_depth_m) || !(point.areaM2 >= warnings.settings.min_area_m2)) {
      say(`a warning at (${String(x)}, ${String(y)}) is ${String(point.depthM)} m deep over ${String(point.areaM2)} m², under its own thresholds`);
    }
    let odd = false;
    rings.forEach((ring, i) => {
      const [a, b, c, d] = boxes[i];
      if (x >= a && x <= c && y >= b && y <= d && inside(ring, point.c)) odd = !odd;
    });
    if (!odd && rings.some((ring, i) => {
      const [a, b, c, d] = boxes[i];
      return x >= a - tolerance && x <= c + tolerance && y >= b - tolerance && y <= d + tolerance &&
        distanceToRing(ring, point.c) <= tolerance;
    })) {
      onEdge += 1;
    } else if (!odd) {
      off += 1;
      if (off <= 5) say(`the warning at (${String(x)}, ${String(y)}) is not inside a drawn low area`);
    }
  }
  if (off > 5) say(`and ${String(off - 5)} more warnings are not inside a drawn low area`);
  console.log(`${pair.name}: ${String(points.length)} warnings, ${String(points.length - off - onEdge)} inside a drawn low area and ${String(onEdge)} within ${String(tolerance)} m of its outline`);
}

if (new Set(settings).size > 1) problems.push(`the two extents' warnings were built with different settings: ${settings.join(' / ')}`);

if (problems.length > 0) {
  console.error(`\n${String(problems.length)} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('The warnings sit on the low areas they mark, in the frame of the map each is drawn on.');
