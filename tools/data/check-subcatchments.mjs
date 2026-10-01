#!/usr/bin/env node
/**
 * Do the drainage-area artefacts still describe the addresses they are keyed to?
 *
 * Three files have to agree before a screen can say *your address is in this
 * drainage area*:
 *
 * - `addresses.json` — the streets and the addresses on them.
 * - `subcatchments.json` — the areas, their names and their record dates.
 * - `address-catchments.json` — which area each address is in, worked out in
 *   the pipeline against Melbourne Water's own geometry.
 *
 * **The third is keyed to the first, and nothing in the file system says so.**
 * Rebuilding the address index without rebuilding the assignment leaves every
 * file valid on its own: the streets are all there, the areas are all there,
 * and some number of people are told about a drainage area belonging to a
 * street they do not live on. The index is rebuilt whenever the council
 * publishes addresses again, which is a data task nobody would think to pair
 * with a drainage one.
 *
 * So this checks the join rather than the files: every street in the index has
 * an entry, every entry covers exactly as many addresses as the index has on
 * that street, every area index points at an area that exists, and the counts
 * the artefact claims are the counts it carries.
 *
 * It also holds the two answers AC 6.1.5 is about. An address in no recorded
 * area is published as `-1` and is allowed; an address in two is not published
 * at all, because no rule for choosing between them has been approved. The
 * pipeline refuses to build one, and this would catch a file that carried one
 * anyway.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../../apps/web/public/data');

const read = async (name) => JSON.parse(await readFile(path.join(DATA, name), 'utf8'));

const problems = [];
const note = (message) => problems.push(message);

const index = await read('addresses.json');
const areas = await read('subcatchments.json');
const assignment = await read('address-catchments.json');

if (assignment.artefact !== 'address-catchments') note(`address-catchments.json says it is ${String(assignment.artefact)}`);
if (areas.artefact !== 'subcatchments') note(`subcatchments.json says it is ${String(areas.artefact)}`);

/* The areas the assignment names must be areas the map can draw. */
const drawn = new Set((areas.areas ?? []).map((area) => String(area.number)));
const numbers = assignment.numbers ?? [];
for (const number of numbers) {
  if (!drawn.has(String(number))) {
    note(`address-catchments.json assigns addresses to area ${String(number)}, which subcatchments.json does not carry`);
  }
}

/* Every area carries what the card and More information read off it. */
for (const area of areas.areas ?? []) {
  const label = `subcatchment ${String(area.number)}`;
  if (typeof area.name !== 'string' || area.name.trim() === '') note(`${label} has no name`);
  if (!Array.isArray(area.rings) || area.rings.length === 0) note(`${label} has no boundary`);
  // AC 6.1.4 shows this year on the card. An area without one would show a
  // sentence with a hole in it.
  if (typeof area.lastUpdated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(area.lastUpdated)) {
    note(`${label} has no record date, which the card states`);
  }
}

/* The join: street by street, against the index itself. */
const streets = assignment.streets ?? {};
let addresses = 0;
let unmatched = 0;
const used = new Set();

for (const [key, group] of (index.on ?? []).map((key, at) => [key, index.at?.[at] ?? []])) {
  const entry = streets[key];
  if (entry === undefined) {
    note(`${key} is in the address index and has no drainage area; rebuild address-catchments.json`);
    continue;
  }
  if (entry.n !== group.length) {
    note(
      `${key} has ${String(group.length)} address(es) in the index and ${String(entry.n)} in the ` +
        `assignment. One of the two was rebuilt without the other, and the areas after this ` +
        `street are somebody else's.`,
    );
    continue;
  }
  const values = Array.isArray(entry.a) ? entry.a : Array.from({ length: entry.n }, () => entry.a);
  if (values.length !== group.length) {
    note(`${key} carries ${String(values.length)} area(s) for ${String(group.length)} address(es)`);
    continue;
  }
  for (const value of values) {
    addresses += 1;
    if (value === -1) {
      unmatched += 1;
      continue;
    }
    if (!Number.isInteger(value) || value < 0 || value >= numbers.length) {
      note(`${key} names area index ${String(value)}, which is not one of the ${String(numbers.length)} published`);
      continue;
    }
    used.add(value);
  }
}

for (const key of Object.keys(streets)) {
  if (!(index.on ?? []).includes(key)) {
    note(`${key} has a drainage area and is not in the address index`);
  }
}

/* The artefact's own arithmetic, checked rather than read. */
const counts = assignment.counts ?? {};
if (counts.addresses !== addresses) note(`counts.addresses says ${String(counts.addresses)}; the file carries ${String(addresses)}`);
if (counts.unmatched !== unmatched) note(`counts.unmatched says ${String(counts.unmatched)}; the file carries ${String(unmatched)}`);
if (counts.areasUsed !== used.size) note(`counts.areasUsed says ${String(counts.areasUsed)}; the file uses ${String(used.size)}`);

if (problems.length > 0) {
  console.error(`drainage areas: ${String(problems.length)} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `drainage areas: ${String((areas.areas ?? []).length)} area(s) published, ${String(addresses)} address(es) ` +
    `assigned across ${String(Object.keys(streets).length)} street(s) — ${String(used.size)} area(s) used, ` +
    `${String(unmatched)} address(es) in no recorded area`,
);
