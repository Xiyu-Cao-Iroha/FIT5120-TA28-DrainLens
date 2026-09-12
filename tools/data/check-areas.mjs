#!/usr/bin/env node
/**
 * Do the four artefacts that describe Greater Melbourne still agree?
 *
 * There are four files about the same 281 statistical areas, and they are four
 * on purpose:
 *
 * * `flood-history.json` — the board's **thirty**, ranked. AC 2.2.1.b caps it
 *   there, and the cap is recorded as being *"enforced where the data is, not
 *   where it is drawn"*. Publishing 281 into it would hand that back.
 * * `sa2-areas.json` — **every** area in scope, with its ASGS code. A map of
 *   thirty implies the other 251 are empty, and 245 of them are not.
 * * `population.json` — the Severity Score's denominator, by the same code.
 * * `sa2-points.json` — where each one is drawn, in metres from an extent
 *   corner. Built from a 121 MB boundary file that is not published, so this
 *   is the only evidence the placement was done against the same 281.
 *
 * **Two files that must stay equal, with nothing to notice when they stop, is
 * the failure this repository has already had once** — a byte-identical copy
 * of the flood board in two directories. The answer taken there was to delete
 * one. It cannot be taken here, because the two files answer different
 * questions, so the answer is this instead: a script that fails when they
 * disagree.
 *
 * It is a script rather than a unit test for the same reason as
 * `check-guide.mjs` and `tools/docs/check.mjs` — it is a claim about published
 * artefacts, which a new pipeline run can break without a line of code
 * changing.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../../apps/web/public/data');

const read = async (name) => JSON.parse(await readFile(path.join(DATA, name), 'utf8'));

const problems = [];
const fail = (message) => problems.push(message);

const board = await read('flood-history.json');
const scope = await read('sa2-areas.json');
const population = await read('population.json');
const points = await read('sa2-points.json');

const byName = new Map(scope.areas.map((a) => [a.name, a]));
const byCode = new Map(scope.areas.map((a) => [a.code, a]));

// --- the scope list describes itself correctly ----------------------------

if (byCode.size !== scope.areas.length) fail('two areas share an ASGS code');
if (byName.size !== scope.areas.length) fail('two areas share a name, so a join by name is ambiguous');
for (const area of scope.areas) {
  if (!/^\d{9}$/.test(area.code)) fail(`${area.name} has code ${area.code}, which is not nine digits`);
  if (area.byYear.reduce((t, n) => t + n, 0) !== area.total) {
    fail(`${area.name}'s yearly counts do not add up to its total`);
  }
  if (area.complete !== (area.suppressedRegions === 0)) {
    fail(`${area.name} is marked ${area.complete ? 'complete' : 'incomplete'} against ${area.suppressedRegions} withheld regions`);
  }
}

const counted = {
  areas: scope.areas.length,
  withIncidents: scope.areas.filter((a) => a.total > 0).length,
  incomplete: scope.areas.filter((a) => !a.complete).length,
  incidents: scope.areas.reduce((t, a) => t + a.total, 0),
};
for (const [key, value] of Object.entries(counted)) {
  if (scope.counts[key] !== value) {
    fail(`sa2-areas says ${key} is ${String(scope.counts[key])}; the areas say ${String(value)}`);
  }
}

// --- the board is a view of the scope list, not a second copy of it --------

if (board.counts.areasInScope !== scope.areas.length) {
  fail(
    `the board says ${String(board.counts.areasInScope)} areas are in scope; ` +
      `the scope list holds ${String(scope.areas.length)}`,
  );
}
if (board.counts.areasWithIncidents !== counted.withIncidents) {
  fail('the board and the scope list disagree about how many areas recorded an incident');
}

/*
  The board's own order, recomputed from the scope list.

  `rank` sorts by total descending and breaks ties by name, so the thirty are
  a function of the 281 rather than an independent list. Recomputing it here is
  the point: a board built from a different run of the pipeline, or from an
  older workbook, stops being the top of this list and nothing else would say
  so.
*/
const expected = [...scope.areas]
  .filter((a) => a.total > 0)
  .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  .slice(0, board.areas.length);

for (const [index, area] of board.areas.entries()) {
  const mine = expected[index];
  if (mine === undefined || mine.name !== area.name) {
    fail(`board rank ${String(index + 1)} is ${area.name}; the scope list ranks ${mine?.name ?? 'nothing'} there`);
    continue;
  }
  const full = byName.get(area.name);
  for (const field of ['total', 'regions', 'suppressedRegions', 'complete']) {
    if (full[field] !== area[field]) {
      fail(`${area.name}: ${field} is ${String(area[field])} on the board and ${String(full[field])} in the scope list`);
    }
  }
  if (full.byYear.join(',') !== area.byYear.join(',')) {
    fail(`${area.name}: the yearly series differs between the board and the scope list`);
  }
}

// --- the denominator covers the same areas --------------------------------

const missing = scope.areas.filter((a) => !population.areas.some((p) => p.code === a.code));
if (missing.length > 0) {
  fail(`${String(missing.length)} areas have no population row (first: ${missing[0].name})`);
}
const extra = population.areas.filter((p) => !byCode.has(p.code));
if (extra.length > 0) {
  fail(`${String(extra.length)} population rows belong to no area (first: ${extra[0].name})`);
}
for (const p of population.areas) {
  const area = byCode.get(p.code);
  if (area !== undefined && area.name !== p.name) {
    fail(`SA2 ${p.code} is ${area.name} in the scope list and ${p.name} in the population`);
  }
}

const scored = population.areas.filter(
  (p) => p.persons[population.asAt.indexOf(population.denominator)] >= population.minimumResidents,
).length;
if (scored !== population.counts.scored) {
  fail(`population says ${String(population.counts.scored)} areas are scorable; the rows say ${String(scored)}`);
}

// --- every area has somewhere to be drawn ---------------------------------

const placed = new Map(points.areas.map((p) => [p.code, p]));
const unplaced = scope.areas.filter((a) => !placed.has(a.code));
if (unplaced.length > 0) {
  fail(`${String(unplaced.length)} areas have no point (first: ${unplaced[0].name})`);
}
const strays = points.areas.filter((p) => !byCode.has(p.code));
if (strays.length > 0) {
  fail(`${String(strays.length)} points belong to no area (first: ${strays[0].name})`);
}
for (const p of points.areas) {
  const area = byCode.get(p.code);
  if (area !== undefined && area.name !== p.name) {
    fail(`SA2 ${p.code} is ${area.name} in the scope list and ${p.name} in the points`);
  }
}

/*
  Every point inside the extent it is measured from.

  The coordinates are metres from that extent's own south-west corner, which
  is the convention every artefact here follows and the reason the browser
  carries no projection. A point outside the rectangle means the extent was
  computed from a different set of areas than the one published — the same
  class of mistake that put every address pin 1.5 km from the house.
*/
const { width_m: width, height_m: height } = points.extent;
for (const p of points.areas) {
  if (p.e < 0 || p.n < 0 || p.e > width || p.n > height) {
    fail(`${p.name} is at ${String(p.e)},${String(p.n)} in a ${String(width)} by ${String(height)} extent`);
  }
}

// --- say what was checked -------------------------------------------------

const summary =
  `${String(scope.areas.length)} areas in scope, ${String(counted.withIncidents)} with a recorded ` +
  `dispatch and ${String(counted.incomplete)} whose total is a floor. The board's ` +
  `${String(board.areas.length)} are the top of them. ${String(population.areas.length)} have a ` +
  `population; ${String(scored)} of those are above the ${String(population.minimumResidents)} ` +
  `residents a score needs. All ${String(points.areas.length)} have a point inside the ${String(Math.round(points.extent.width_m/1000))} by ${String(Math.round(points.extent.height_m/1000))} km extent.`;

if (problems.length > 0) {
  console.error(summary);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`area data ok — ${summary}`);
