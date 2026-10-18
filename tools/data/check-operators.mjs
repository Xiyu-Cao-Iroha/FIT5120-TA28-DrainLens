#!/usr/bin/env node
/**
 * Does the pipe record still hold only the operator values we can explain?
 *
 * AC 6.2.2 gives a selected pipe three possible sentences, and each is a claim
 * about what the council published:
 *
 * - `City of Melbourne` — named, because the record names it.
 * - absent — *Operator not recorded*, because the field is empty.
 * - `4` — *Operator code not yet identified*, because the portal publishes the
 *   code and does not publish what it stands for.
 *
 * **A fourth value would be shown as an unidentified code by default, and
 * that is a guess about which the interface would be silent.** A new value
 * could be another unexplained code, or it could be a second organisation
 * whose pipes the product would then be attributing to nobody. The difference
 * matters to a resident deciding who to report a blockage to, and it cannot be
 * decided by a fallback branch.
 *
 * So this fails the build when the artefacts carry a value the operator
 * mapping does not name, and prints what it found. The fix is a decision —
 * look the code up, add it to the mapping with what it was found to mean, or
 * record that it remains unexplained — not a wider default.
 *
 * Both copies are checked, because the site reads whichever is answering: the
 * council artefact the database is loaded from, and the Kensington copy the
 * container falls back to.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/**
 * The values the operator mapping explains, and what the interface says.
 *
 * Kept here as data rather than imported from the browser bundle, for the
 * reason `check-guide.mjs` records: this is a plain node script asking a
 * question of the artefact, and the tie between the two is that both are
 * asserted rather than shared.
 */
const KNOWN = new Map([
  ['City of Melbourne', 'named on screen'],
  ['4', 'a code the published data does not explain'],
]);

const FILES = [
  'apps/api/data/city-of-melbourne/map.json',
  'apps/web/public/data/map.json',
];

const problems = [];
let checked = 0;

for (const file of FILES) {
  const map = JSON.parse(await readFile(path.join(ROOT, file), 'utf8'));
  const pipes = map.layers?.pipe ?? [];
  if (pipes.length === 0) {
    problems.push(`${file} carries no pipes at all`);
    continue;
  }
  const counts = new Map();
  for (const pipe of pipes) {
    const value = pipe.operator ?? null;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  checked += pipes.length;

  for (const [value, n] of counts) {
    if (value === null || KNOWN.has(value)) continue;
    problems.push(
      `${file} has ${String(n)} pipe(s) whose operator is ${JSON.stringify(value)}, which the ` +
        `operator mapping does not explain. Decide what it means before the interface shows it: ` +
        `an organisation is named, a code is called not yet identified, and the difference is the ` +
        `one a resident acts on. tools/data/check-operators.mjs and the subcatchment classification ` +
        `register are where the decision is recorded.`,
    );
  }

  // Said out loud rather than assumed: a copy where every pipe has lost the
  // field looks exactly like a copy where the council never recorded one.
  if (!counts.has('City of Melbourne')) {
    problems.push(
      `${file} has no pipe operated by City of Melbourne, which the published record has on most ` +
        `of them. The field was probably dropped when the artefact was rebuilt (network.py keeps it).`,
    );
  }

  const parts = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([value, n]) => `${value === null ? 'not recorded' : JSON.stringify(value)} ${String(n)}`);
  console.log(`${file}: ${String(pipes.length)} pipe(s) — ${parts.join(', ')}`);
}

if (problems.length > 0) {
  console.error(`pipe operators: ${String(problems.length)} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `pipe operators: ${String(checked)} pipe(s) across ${String(FILES.length)} artefact(s), every ` +
    `value one the mapping explains`,
);
