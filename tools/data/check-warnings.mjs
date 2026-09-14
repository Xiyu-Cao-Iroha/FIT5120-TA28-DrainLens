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
 *   9 of the council's 764 on 15 September, all within half a metre, and 3 of
 *   its 91 once the signs moved to the streets;
 * - every point is inside the road corridor of a street — one of the classes
 *   the artefact names in `settings.street_types`, none of them a freeway, a
 *   rail reserve or a river — by even-odd over that corridor's rings, so a
 *   traffic island in a hole is not street. No distance is allowed outside a
 *   corridor: the sign says not to park there, and the live test of
 *   15 September found signs in courtyards and backyards. The pipeline puts
 *   the sign on a cell centre it tested with the same rule on the same outlines;
 * - no point is on a building, read from the terrain run's `barriers.npy` when
 *   this checkout has one. `/data/` is a build product and is not in git, so
 *   CI says the building check was skipped rather than passing it silently;
 * - no two points are closer than `settings.spacing_m`.
 *
 * **Both tests prove themselves before they are trusted.** Each extent names
 * points where the first version of the file put a sign in the middle of a
 * block, 20 to 40 m from the nearest corridor — two of them in the Carlton
 * view of the live test. If the street test calls one of those a street, it is
 * broken and a pass would mean nothing. (Address points will not do for this:
 * 10 Lygon Street's is geocoded inside the Lygon Street corridor.) Likewise
 * the first building cell in the grid is fed to the building test, which has
 * to call it a building.
 *
 * A script rather than a test for the reason `check-derived.mjs` gives: it is
 * a claim about published artefacts, which a pipeline run can break without a
 * line of code changing.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const read = async (relative) => JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));

const PAIRS = [
  {
    name: 'kensington',
    warnings: 'apps/web/public/data/warnings/kensington.json',
    derived: 'apps/web/public/data/derived.json',
    map: 'apps/web/public/data/map.json',
    buildings: 'data/terrain/barriers.npy',
    // Two of the 13 September signs, 24 m and 22 m inside their blocks.
    offStreet: [[383.5, 917.5], [397.5, 267.5]],
  },
  {
    name: 'city-of-melbourne',
    warnings: 'apps/web/public/data/warnings/city-of-melbourne.json',
    derived: 'apps/api/data/city-of-melbourne/derived.json',
    map: 'apps/api/data/city-of-melbourne/map.json',
    buildings: 'data/terrain-council/barriers.npy',
    // Two of the 13 September signs in the view around 10 Lygon Street,
    // Carlton, 37 m and 22 m inside their blocks.
    offStreet: [[5876.5, 5340.5], [5789.5, 4972.5]],
  },
];

/** Corridor classes that are never a street anyone parks in. */
const NOT_STREETS = ['Citylink', 'Citylink2', 'Freeway', 'Lease/Reserve', 'Parks Victoria', 'Rail/Tram', 'River', 'Undetermined'];

/**
 * A boolean `.npy` grid, north-up, read as `at([x, y])` for a point in local
 * metres. Just enough of the format for the one file the pipeline writes.
 */
const readMask = async (relative) => {
  const bytes = await readFile(path.join(ROOT, relative));
  const major = bytes[6];
  const length = major === 1 ? bytes.readUInt16LE(8) : bytes.readUInt32LE(8);
  const start = (major === 1 ? 10 : 12) + length;
  const header = bytes.subarray(start - length, start).toString('latin1');
  const shape = /'shape':\s*\((\d+),\s*(\d+)\)/.exec(header);
  if (!header.includes("'|b1'") || header.includes("'fortran_order': True") || shape === null) {
    throw new Error(`${relative} is not a north-up boolean grid: ${header.trim()}`);
  }
  const rows = Number(shape[1]);
  const cols = Number(shape[2]);
  return {
    rows,
    cols,
    first: () => {
      const index = bytes.indexOf(1, start) - start;
      return index < 0 ? null : [(index % cols) + 0.5, rows - 1 - Math.floor(index / cols) + 0.5];
    },
    at: ([x, y]) => bytes[start + (rows - 1 - Math.floor(y)) * cols + Math.floor(x)] === 1,
  };
};

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
  const geometry = await read(pair.map);
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

  const types = warnings.settings?.street_types;
  if (!Array.isArray(types) || types.length === 0) say('the warnings do not say which road corridors count as streets');
  for (const type of NOT_STREETS) if (types?.includes(type)) say(`the warnings count ${type} corridors as streets`);
  if (geometry.extent?.width_m !== warnings.extent?.width_m || geometry.extent?.height_m !== warnings.extent?.height_m) {
    say(`${pair.map} is not the extent the warnings are for`);
  }
  const streets = (geometry.layers?.road ?? [])
    .filter((road) => types?.includes(road.str_type))
    .map((road) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const ring of road.c) {
        for (const [x, y] of ring) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
      return { rings: road.c, box: [minX, minY, maxX, maxY] };
    });
  // Even-odd over one corridor's rings together, so its holes are not street.
  const onStreet = (point) =>
    streets.some(({ rings, box: [a, b, c, d] }) =>
      point[0] >= a && point[0] <= c && point[1] >= b && point[1] <= d &&
      rings.reduce((odd, ring) => (inside(ring, point) ? !odd : odd), false));

  for (const probe of pair.offStreet) {
    if (onStreet(probe)) say(`the street test calls the address point (${String(probe)}) a street, so its pass cannot be trusted`);
  }
  let offStreet = 0;
  for (const point of points) {
    if (onStreet(point.c)) continue;
    offStreet += 1;
    if (offStreet <= 5) say(`the warning at (${String(point.c)}) is not in a street's road corridor`);
  }
  if (offStreet > 5) say(`and ${String(offStreet - 5)} more warnings are not in a street's road corridor`);

  let buildingNote = `building check skipped: ${pair.buildings} is not in this checkout`;
  if (existsSync(path.join(ROOT, pair.buildings))) {
    const buildings = await readMask(pair.buildings);
    if (buildings.cols !== warnings.extent.width_m || buildings.rows !== warnings.extent.height_m) {
      say(`${pair.buildings} is ${String(buildings.cols)} x ${String(buildings.rows)} cells, not this extent's metre grid`);
    } else {
      const probe = buildings.first();
      if (probe === null || !buildings.at(probe)) say(`the building test does not find the building cell it was given in ${pair.buildings}`);
      const onBuilding = points.filter((point) => buildings.at(point.c));
      for (const point of onBuilding.slice(0, 5)) say(`the warning at (${String(point.c)}) is on a building`);
      if (onBuilding.length > 5) say(`and ${String(onBuilding.length - 5)} more warnings are on a building`);
      buildingNote = `${String(points.length - onBuilding.length)} off a building`;
    }
  }

  const spacing = warnings.settings?.spacing_m;
  if (!(spacing > 0)) say('the warnings do not say how far apart the signs stand');
  let crowded = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const gap = Math.hypot(points[i].c[0] - points[j].c[0], points[i].c[1] - points[j].c[1]);
      if (gap < spacing) {
        crowded += 1;
        if (crowded <= 5) say(`the warnings at (${String(points[i].c)}) and (${String(points[j].c)}) are ${gap.toFixed(1)} m apart, under ${String(spacing)} m`);
      }
    }
  }

  console.log(`${pair.name}: ${String(points.length - offStreet)} in a street's road corridor, ${buildingNote}`);
  console.log(`${pair.name}: ${String(points.length)} warnings, ${String(points.length - off - onEdge)} inside a drawn low area and ${String(onEdge)} within ${String(tolerance)} m of its outline`);
}

if (new Set(settings).size > 1) problems.push(`the two extents' warnings were built with different settings: ${settings.join(' / ')}`);

if (problems.length > 0) {
  console.error(`\n${String(problems.length)} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('The warnings sit on the low areas they mark, on streets, in the frame of the map each is drawn on.');
