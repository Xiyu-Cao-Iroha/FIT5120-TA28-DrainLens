#!/usr/bin/env node
/**
 * Does the Terrain tile pack still hold what its index says, over the ground the council has?
 *
 * The map fetches a tile by name when its square comes into view. A tile the
 * index lists and the repository lacks is not a failed build: it is one square
 * of the council whose ground never draws, keeping the blurry overview, with
 * nothing on screen to say why. So this walks the pack:
 *
 * - every tile the index lists has its three files, and every file is non-empty;
 * - the overview images exist and the overview covers the extent at its cell size;
 * - the tiles are exactly the scenario pack's tiles — both are cut from the same
 *   point-cloud archive, so a tile in one and not the other means one of them
 *   was built from a different run;
 * - each tile's corner is where the tile grid says it is, in the extent's frame;
 * - every contour vertex and spot height lies inside the extent.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PACK = path.join(ROOT, 'apps/web/public/data/terrain-tiles');

const index = JSON.parse(readFileSync(path.join(PACK, 'index.json'), 'utf8'));
const scene = JSON.parse(readFileSync(path.join(ROOT, 'apps/web/public/data/scene-tiles/index.json'), 'utf8'));
const FILES = ['colour.webp', 'marks.json', 'shade.webp'];
const problems = [];

if (index.artefact !== 'terrain-tiles') problems.push(`the index says it is ${JSON.stringify(index.artefact)}`);
const { extent, tileGrid, overview } = index;

for (const file of [overview.colour, overview.shade]) {
  if (!existsSync(path.join(PACK, file)) || statSync(path.join(PACK, file)).size === 0) {
    problems.push(`the overview image ${file} is missing or empty`);
  }
}
if (overview.width * overview.cellM !== Math.floor(extent.width_m / overview.cellM) * overview.cellM ||
    overview.height * overview.cellM !== Math.floor(extent.height_m / overview.cellM) * overview.cellM) {
  problems.push(`the overview is ${overview.width} x ${overview.height} cells of ${overview.cellM} m for a ${extent.width_m} x ${extent.height_m} m extent`);
}

const listed = new Set(index.tiles.map((t) => t.tile));
const sceneTiles = new Set(scene.tiles.map((t) => t.tile));
const onlyTerrain = [...listed].filter((t) => !sceneTiles.has(t));
const onlyScene = [...sceneTiles].filter((t) => !listed.has(t));
if (onlyTerrain.length > 0) problems.push(`${onlyTerrain.length} terrain tiles are not in the scenario pack (first: ${onlyTerrain[0]})`);
if (onlyScene.length > 0) problems.push(`${onlyScene.length} scenario tiles have no terrain tile (first: ${onlyScene[0]})`);

const onDisk = new Set(readdirSync(PACK, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));
for (const name of onDisk) if (!listed.has(name)) problems.push(`${name} is on disk but not in the index`);

let vertices = 0;
let spots = 0;
for (const tile of index.tiles) {
  const folder = path.join(PACK, tile.tile);
  for (const file of FILES) {
    const at = path.join(folder, file);
    if (!existsSync(at) || statSync(at).size === 0) problems.push(`${tile.tile}/${file} is missing or empty`);
  }
  const e = tileGrid.originE + tile.tx * tileGrid.sizeM - extent.min_e;
  const n = tileGrid.originN + tile.ty * tileGrid.sizeM - extent.min_n;
  if (e !== tile.e || n !== tile.n) problems.push(`${tile.tile} is placed at ${tile.e},${tile.n}; the tile grid puts it at ${e},${n}`);
  if (!existsSync(path.join(folder, 'marks.json'))) continue;

  const marks = JSON.parse(readFileSync(path.join(folder, 'marks.json'), 'utf8'));
  const unit = marks.unitM;
  for (const line of marks.contours) {
    let x = 0;
    let y = 0;
    for (let i = 0; i + 1 < line.d.length; i += 2) {
      x = i === 0 ? line.d[0] : x + line.d[i];
      y = i === 0 ? line.d[1] : y + line.d[i + 1];
      vertices += 1;
      if (x * unit < 0 || y * unit < 0 || x * unit > extent.width_m || y * unit > extent.height_m) {
        problems.push(`${tile.tile} has a contour vertex at ${x * unit},${y * unit}, outside the extent`);
        break;
      }
    }
  }
  for (const spot of marks.spots) {
    spots += 1;
    if (spot.e < 0 || spot.n < 0 || spot.e > extent.width_m || spot.n > extent.height_m) {
      problems.push(`${tile.tile} has spot height ${spot.id} outside the extent`);
    }
  }
}

if (problems.length > 0) {
  console.error(`terrain tiles: ${String(problems.length)} problem(s)`);
  for (const problem of problems.slice(0, 30)) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `terrain tiles ok — ${String(index.tiles.length)} tiles, the same as the scenario pack; ` +
    `${vertices.toLocaleString('en-AU')} contour vertices and ${spots.toLocaleString('en-AU')} spot heights inside the extent.`,
);
