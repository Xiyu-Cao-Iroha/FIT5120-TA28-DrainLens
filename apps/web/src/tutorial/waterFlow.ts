/**
 * Where rainwater may move, step by step.
 *
 * **The hardest thing this section has to teach is not what the arrows are —
 * it is who drew them.** Everything in the drainage section is the council's
 * record: somebody surveyed a pit and wrote it down. Nothing in this one is.
 * The paths are calculated here, by us, from a ground surface we also
 * calculated, and no authority publishes them or has checked them.
 *
 * So the lesson ends on the layer that admits where the calculation had
 * nothing to work from. That is deliberate: a reader who has just been shown
 * lines running down their street will believe them, and the honest last word
 * is the hatching that says *there was not enough reliable ground data here*.
 *
 * The order — paths, then drains, then the gaps — is the order somebody
 * actually asks about: what is this, where does it go, and how much of it do
 * you know.
 */

import { FULL_MAP, LAYER } from '../ui/terms.js';
import { type Lesson, unlockingChips } from './lesson.js';

/*
  Copy audit v2 of 15 September, #35 to #42. Praise first after a correct
  press, one action per instruction. Who calculated the paths and where the
  pits come from (#38), and that ground height comes from aerial photography
  (#41), are left to the map's More information. The one caveat kept is the small print
  under step two, because a reader who has just seen lines down their street
  is the reader most likely to take them for a warning.
*/
export const WATER_FLOW_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'water-flow-on',
    prompt: `Click ${LAYER.paths} to see where rain may flow.`,
    requires: 'water-flow-on',
  },
  {
    kind: 'read',
    id: 'paths-shown',
    prompt: 'Great! Arrows show which way rain may flow downhill.',
    note: 'These are estimates, not flood warnings.',
  },
  {
    kind: 'do',
    id: 'pits-on',
    prompt: `Now click ${LAYER.pits} to see drains along these paths.`,
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'paths-and-pits',
    prompt: 'Great! Some water paths lead towards street drains.',
  },
  {
    kind: 'do',
    id: 'unmeasured-on',
    prompt: `Click ${LAYER.limited} to see where we cannot map water.`,
    requires: 'unmeasured-on',
  },
  {
    kind: 'read',
    id: 'gaps-shown',
    prompt: 'Good. Striped areas are gaps, so no water paths show there.',
  },
];

export const WATER_FLOW_DONE: Lesson['finished'] = {
  headline: 'Well done! You finished the water paths guide.',
  unlocked: `${LAYER.paths} is also on the ${FULL_MAP.toLowerCase()}.`,
};

export const WATER_FLOW: Lesson = {
  steps: WATER_FLOW_STEPS,
  finished: WATER_FLOW_DONE,
  /*
    Likely water paths, then Drain pits at step 2, then Ground data gaps at
    step 4.

    `Ground data gaps` is behind the Layers button on the unguided map, because
    it is the switch people change least. Here it is a chip, because it is the
    thing this section ends on and a lesson that asked somebody to go looking
    for a control would be teaching the control rather than the point.
  */
  chips: unlockingChips([
    { key: 'channel', at: 0, on: (now) => now.channel },
    { key: 'pit', at: 2, on: (now) => now.pits },
    { key: 'unavailable', at: 4, on: (now) => now.unmeasured },
  ]),
  teachingPit: false,
  previous: true,
};
