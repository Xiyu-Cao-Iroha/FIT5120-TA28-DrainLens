/**
 * Local drainage pits and pipes, step by step.
 *
 * The first section written, and the one that taught the rest their shape.
 *
 * **The machinery moved out on 11 September.** `Step`, `MapNow`, `satisfied`,
 * `stepIndex` and `finished` lived here while drainage was the only section;
 * they are in `lesson.ts` now, because a second lesson importing them from a
 * file called *drainage* is a file telling you something untrue about itself.
 * What is left here is what the name says.
 *
 * **This is the only section that points at one particular feature.** The
 * other two ask for a layer; this one asks the reader to press a pit and then
 * follow the water out of it, which only works on a pit the record carries a
 * downstream from — 215 of the 895 pits in this extent have none. `pit.ts`
 * chooses it.
 */

import { FULL_MAP, LAYER } from '../ui/terms.js';
import { type Lesson, unlockingChips } from './lesson.js';

export const DRAINAGE_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'pits-on',
    prompt: `Select ${LAYER.pits} to show nearby pits listed in council records.`,
    hint: 'The map starts with all optional layers turned off.',
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'pits-shown',
    prompt:
      'These symbols mark features in council records. They may be kerb grates, footpath lids or pipe junctions.',
  },
  {
    kind: 'do',
    id: 'pipes-on',
    prompt: `Select ${LAYER.pipes} to show the underground connections listed in council records.`,
    requires: 'pipes-on',
  },
  {
    kind: 'read',
    id: 'pipes-shown',
    prompt:
      'These pits and pipes come from council records. DrainLens has not checked them on site.',
  },
  {
    kind: 'do',
    id: 'pit-selected',
    prompt: 'Select the pit marked on the map.',
    hint: 'This pit has a connected pipe in the council data. Some pits do not.',
    requires: 'pit-selected',
  },
  {
    kind: 'do',
    id: 'trace-following',
    prompt: 'Select Show connected drain pipe to follow the recorded pipes downstream.',
    requires: 'trace-following',
  },
];

/** Said once, on the way out. */
export const DRAINAGE_DONE: Lesson['finished'] = {
  headline: 'That is the drainage layer.',
  body: 'You turned on the council’s record, followed one path downstream, and saw where the record stops. The same two controls work anywhere on the map.',
  unlocked: `You can now use ${LAYER.pits} and ${LAYER.pipes} on the ${FULL_MAP.toLowerCase()}.`,
};

export const DRAINAGE: Lesson = {
  steps: DRAINAGE_STEPS,
  finished: DRAINAGE_DONE,
  // Pits from the start, Pipes from the step that asks for it.
  chips: unlockingChips([
    { key: 'pit', at: 0, on: (now) => now.pits },
    { key: 'pipe', at: 2, on: (now) => now.pipes },
  ]),
  teachingPit: true,
};
