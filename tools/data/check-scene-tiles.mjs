#!/usr/bin/env node
/**
 * Does the scenario tile pack still hold what its index says it does?
 *
 * The comparison fetches four tiles by name for whichever drain somebody
 * chooses, so a tile the index lists and the repository lacks is not a failed
 * build: it is a comparison that fails for one street, on the site, for a
 * person, while every other street works. This walks the whole pack instead.
 *
 * - every tile the index lists has its six files, and nothing else is there;
 * - every inlet's window is four tiles the index lists;
 * - every inlet on the council map is in the index, either with a window or
 *   in `inletsWithoutWindow`, and nothing that is not an inlet is.
 *
 * A script rather than a unit test for the same reason as `check-areas.mjs`.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PACK = path.join(ROOT, 'apps/web/public/data/scene-tiles');

const index = JSON.parse(readFileSync(path.join(PACK, 'index.json'), 'utf8'));
const map = JSON.parse(readFileSync(path.join(ROOT, 'apps/api/data/city-of-melbourne/map.json'), 'utf8'));

const FILES = ['tile.json', ...Object.values(index.arrays).map((a) => a.file)].sort();
const problems = [];

const listed = new Set(index.tiles.map((t) => t.tile));
for (const name of listed) {
  const dir = path.join(PACK, name);
  if (!existsSync(dir)) {
    problems.push(`${name} is listed and not in the repository`);
    continue;
  }
  const present = readdirSync(dir).sort();
  if (JSON.stringify(present) !== JSON.stringify(FILES)) {
    problems.push(`${name} holds ${present.join(', ')}, not ${FILES.join(', ')}`);
  }
}
for (const entry of readdirSync(PACK)) {
  if (entry !== 'index.json' && !listed.has(entry)) problems.push(`${entry} is in the pack and not in the index`);
}

const name = (tx, ty) => `Tile_${tx < 0 ? '-' : '+'}${String(Math.abs(tx)).padStart(3, '0')}_${ty < 0 ? '-' : '+'}${String(Math.abs(ty)).padStart(3, '0')}`;
let brokenWindows = 0;
for (const [asset, [tx, ty]] of Object.entries(index.windows)) {
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    if (!listed.has(name(tx + dx, ty + dy))) {
      brokenWindows += 1;
      if (brokenWindows <= 5) problems.push(`inlet ${asset}'s window needs ${name(tx + dx, ty + dy)}, which is not listed`);
    }
  }
}

// The inlet rule `scene.py` and `scene_tiles.py` state.
const isInlet = (pit) => /entry|grated/.test(String(pit.asset_description ?? '').toLowerCase());
const inlets = new Set((map.layers.pit ?? []).filter(isInlet).map((p) => String(p.asset_number)));
const indexed = new Set([...Object.keys(index.windows), ...(index.inletsWithoutWindow ?? [])]);
const missing = [...inlets].filter((a) => !indexed.has(a));
const extra = [...indexed].filter((a) => !inlets.has(a));
if (missing.length > 0) problems.push(`${missing.length} inlets on the council map are not in the index, e.g. ${missing.slice(0, 3).join(', ')}`);
if (extra.length > 0) problems.push(`${extra.length} indexed drains are not inlets on the council map, e.g. ${extra.slice(0, 3).join(', ')}`);

if (problems.length > 0) {
  console.error(`scene tiles: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `scene tiles: ${listed.size} tiles, each complete; ${Object.keys(index.windows).length} inlets with a window of four listed tiles, ${(index.inletsWithoutWindow ?? []).length} without; every council inlet indexed`,
);
