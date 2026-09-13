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

import { type Lesson, unlockingChips } from './lesson.js';

export const DRAINAGE_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'pits-on',
    prompt: 'Press Pits to show the drainage pits near your address.',
    hint: 'The map opens with nothing on it. Everything you see from here is something you turned on.',
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'pits-shown',
    prompt:
      'Those are the structures the council has a record of — a grate in the kerb, a lid in the footpath, or a join where pipes meet.',
  },
  {
    kind: 'do',
    id: 'pipes-on',
    prompt: 'Now press Pipes to show what connects them underground.',
    requires: 'pipes-on',
  },
  {
    kind: 'read',
    id: 'pipes-shown',
    prompt:
      'That is the recorded network. Nothing here is measured by us: it is what the council published, drawn as published.',
  },
  {
    kind: 'do',
    id: 'pit-selected',
    prompt: 'Press the pit marked on the map.',
    hint: 'We picked this one because the record carries a path onward from it. Not every pit does.',
    requires: 'pit-selected',
  },
  {
    kind: 'do',
    id: 'trace-following',
    prompt: 'Press Show connected pipe to follow the water downstream.',
    requires: 'trace-following',
  },
];

/** Said once, on the way out. */
export const DRAINAGE_DONE: Lesson['finished'] = {
  headline: 'That is the drainage layer.',
  body: 'You turned on the council’s record, followed one path downstream, and saw where the record stops. The same two controls work anywhere on the map.',
  unlocked: 'Recorded drainage is now yours on the whole map.',
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
