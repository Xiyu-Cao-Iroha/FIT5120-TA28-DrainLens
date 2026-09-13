#!/usr/bin/env node
/**
 * Does the verified-events file still say what it claims to?
 *
 * The events are written by hand, so nothing upstream rebuilds them and
 * nothing downstream notices when one drifts. The guard in
 * `apps/web/src/history/events.ts` checks the shape when the site loads the
 * file; this checks what the guard cannot see from inside the browser:
 *
 * - every area an event names is one of the map's 281, under the same name —
 *   an event tied to a code the map does not have is shown nowhere, and
 *   silently;
 * - every source link is https and no two events share an id;
 * - a check is recorded as a name and a date together, never one of them.
 *
 * It does not fetch the links. CI's network is not the thing being tested,
 * and a source going offline is a reason for a teammate to re-check the event,
 * not a reason for an unrelated pull request to fail.
 *
 * It prints how many events are waiting for a check, because those are on
 * nobody's screen and the number is otherwise invisible.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const read = async (relative) => JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));

const events = await read('apps/web/public/data/flood-events.json');
const scope = await read('apps/web/public/data/sa2-areas.json');
const names = new Map(scope.areas.map((area) => [area.code, area.name]));

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const problems = [];

if (events.artefact !== 'flood-events') problems.push(`the file says it is ${JSON.stringify(events.artefact)}`);
if (!Array.isArray(events.events)) problems.push('the file carries no list of events');

const ids = new Set();
let waiting = 0;
for (const event of events.events ?? []) {
  const label = event.id ?? '(no id)';
  if (ids.has(event.id)) problems.push(`${label} appears twice`);
  ids.add(event.id);
  for (const area of event.areas ?? []) {
    const known = names.get(area.code);
    if (known === undefined) problems.push(`${label} names area ${area.code}, which is not on the map`);
    else if (known !== area.name) problems.push(`${label} calls area ${area.code} "${area.name}"; the map calls it "${known}"`);
  }
  if ((event.areas ?? []).length === 0) problems.push(`${label} names no area`);
  const sources = event.sources ?? [];
  if (sources.length < 2) problems.push(`${label} has ${String(sources.length)} source(s); an event needs two`);
  for (const source of sources) {
    if (typeof source.url !== 'string' || !source.url.startsWith('https://')) {
      problems.push(`${label} has a source that is not an https link: ${String(source.url)}`);
    }
  }
  const byWhom = event.checkedBy ?? null;
  const when = event.checkedOn ?? null;
  if ((byWhom === null) !== (when === null)) {
    problems.push(`${label} records half a check: checkedBy and checkedOn are filled in together`);
  } else if (byWhom === null) {
    waiting += 1;
  } else if (typeof byWhom !== 'string' || byWhom.trim() === '' || !DAY.test(when) || when < event.draftedOn) {
    problems.push(`${label} has a check that is not a name and a date on or after ${String(event.draftedOn)}`);
  }
}

if (problems.length > 0) {
  console.error(`flood events: ${String(problems.length)} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const total = (events.events ?? []).length;
console.log(
  `flood events: ${String(total)} event(s), ${String(total - waiting)} checked and shown, ${String(waiting)} waiting for a team member's check`,
);
