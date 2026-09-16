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

/*
  Copy audit v2 of 15 September, #19 to #31. Each `do` step is one action in
  one sentence, and each `read` step after a correct press starts with praise
  and says what appeared. Where the record comes from, and that nobody checked
  it on site, is left to the map's More information rather than given as the answer to a
  correct press. The optional-layers hint on step one is gone (#20), and so is
  step five's line about connected pipes (#27).
*/
export const DRAINAGE_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'pits-on',
    prompt: `Click ${LAYER.pits} to see street drains near you.`,
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'pits-shown',
    prompt: 'Great! Each dot is a street drain.',
  },
  {
    kind: 'do',
    id: 'pipes-on',
    prompt: `Now click ${LAYER.pipes} to see how the drains connect.`,
    requires: 'pipes-on',
  },
  {
    kind: 'read',
    id: 'pipes-shown',
    prompt: 'Great! The lines are pipes joining the drains underground.',
  },
  {
    kind: 'do',
    id: 'pit-selected',
    prompt: 'Click any drain on the map, such as the one with the orange ring.',
    requires: 'pit-selected',
  },
  {
    kind: 'do',
    id: 'trace-following',
    prompt: 'Nice! Now click Show connected drain pipe to see where water goes.',
    requires: 'trace-following',
  },
];

/** Said once, on the way out. */
export const DRAINAGE_DONE: Lesson['finished'] = {
  headline: 'Well done! You finished the drainage guide.',
  unlocked: `${LAYER.pits} and ${LAYER.pipes} are also on the ${FULL_MAP.toLowerCase()}.`,
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
