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
  /*
    The gaps used to be a switch, and this step used to be the press.

    They are always drawn from 4 October, so there is nothing to press and
    the sentence the press was there to earn is said on its own. It stays in
    the guide because the striped areas are on the map in front of the reader
    and an unexplained hatch is worse than no hatch.
  */
  {
    kind: 'read',
    id: 'gaps-shown',
    prompt: `Striped areas are ${LAYER.limited.toLowerCase()}: no water paths show there.`,
    note: 'The stripes are where the ground was never measured, not where water does not go.',
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
    Likely water paths, then Drain pits at step 2.

    `Ground data gaps` used to be the third, offered at step 4 so that the
    lesson could ask for the press. It is not a switch any more (4 October):
    the stripes are always drawn, so the last step reads them instead of
    turning them on.
  */
  chips: unlockingChips([
    { key: 'channel', at: 0, on: (now) => now.channel },
    { key: 'pit', at: 2, on: (now) => now.pits },
  ]),
  teachingPit: false,
  previous: true,
};
