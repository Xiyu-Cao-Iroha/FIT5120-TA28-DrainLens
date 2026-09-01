/**
 * Structural check for the repository's markdown.
 *
 * This exists because of a defect that shipped to `main`: a paragraph was
 * inserted into the middle of a table, which stranded the last row below it.
 * The row still looked like a row in the source, and every check in use at the
 * time was a `grep` for a string — so nothing noticed, and the table rendered
 * with a line of raw pipes under it.
 *
 * That is the shape of the problem this catches. Prose is checked by reading
 * it; structure is checked by a machine, because structure fails in ways that
 * survive proofreading of the words.
 *
 *   node tools/docs/check.mjs
 *
 * Exits non-zero if anything is wrong, so CI can gate on it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SEPARATOR = /^\s*\|[\s:|-]+\|\s*$/;
const ROW = /^\s*\|.*\|\s*$/;

/**
 * A row belongs to a table only if a separator precedes it, or one follows it
 * — the second case being the header. Anything else is a row that is not in a
 * table, which is exactly the defect above.
 */
function problems(text) {
  const lines = text.split('\n');
  const found = [];
  let fenced = false;
  let inTable = false;
  let columns = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      inTable = false;
      continue;
    }
    if (fenced) continue;

    if (line.trim() === '') {
      inTable = false;
      continue;
    }
    if (SEPARATOR.test(line)) {
      inTable = true;
      columns = (line.match(/\|/g) ?? []).length - 1;
      continue;
    }
    if (ROW.test(line)) {
      const isHeader = i + 1 < lines.length && SEPARATOR.test(lines[i + 1]);
      if (isHeader) continue;
      if (!inTable) {
        found.push([i + 1, `table row outside a table: ${line.trim().slice(0, 60)}`]);
      } else {
        const cells = (line.match(/\|/g) ?? []).length - 1;
        if (cells !== columns) {
          found.push([i + 1, `row has ${String(cells)} columns, header has ${String(columns)}`]);
        }
      }
      continue;
    }
    inTable = false;
  }

  if (fenced) found.push([0, 'unclosed code fence']);
  return found;
}

/** Relative links only. An http link's target is not ours to promise. */
function brokenLinks(file, text) {
  const here = dirname(file);
  const broken = [];
  for (const match of text.matchAll(/\]\((\.\.?\/[^)#]+)\)/g)) {
    if (!existsSync(join(here, match[1]))) broken.push([0, `broken link -> ${match[1]}`]);
  }
  return broken;
}

const files = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' }).split('\n').filter(Boolean);

let total = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const [line, message] of [...problems(text), ...brokenLinks(file, text)]) {
    console.log(`${file}${line ? `:${String(line)}` : ''}  ${message}`);
    total += 1;
  }
}

console.log(`checked ${String(files.length)} markdown files, ${String(total)} problem(s)`);
process.exit(total === 0 ? 0 : 1);
