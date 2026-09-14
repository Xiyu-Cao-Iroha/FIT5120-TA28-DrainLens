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

export const WATER_FLOW_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'water-flow-on',
    prompt: `Select ${LAYER.paths} to show calculated paths near the address.`,
    hint: 'The map starts with all optional layers turned off.',
    requires: 'water-flow-on',
  },
  {
    kind: 'read',
    id: 'paths-shown',
    prompt:
      'These paths are calculated from ground-height data. They are not council records or flood predictions. The arrows show which way water runs downhill on the calculated ground.',
  },
  {
    kind: 'do',
    id: 'pits-on',
    prompt: `Select ${LAYER.pits} to compare calculated paths with pit locations in council records.`,
    hint: 'Water paths are calculated by DrainLens. Drain pits come from council records.',
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'paths-and-pits',
    prompt:
      'Some calculated paths appear near recorded drain pits. This map does not show how much water a pit can take.',
  },
  {
    kind: 'do',
    id: 'unmeasured-on',
    prompt: `Select ${LAYER.limited} to see where there was not enough reliable ground information.`,
    requires: 'unmeasured-on',
  },
  {
    kind: 'read',
    id: 'gaps-shown',
    prompt:
      'Ground-height data comes from aerial photography. Hatched areas did not have enough reliable measurements, so DrainLens does not show a water path there.',
  },
];

export const WATER_FLOW_DONE: Lesson['finished'] = {
  headline: 'That is where rainwater may move.',
  body: 'You viewed calculated water paths, council drain records and areas with limited ground data.',
  unlocked: `You can now use ${LAYER.paths} on the ${FULL_MAP.toLowerCase()}.`,
};

export const WATER_FLOW: Lesson = {
  steps: WATER_FLOW_STEPS,
  finished: WATER_FLOW_DONE,
  /*
    Likely water paths, then Drain pits at step 2, then Limited ground data at
    step 4.

    `Limited ground data` is behind the Layers button on the unguided map, because
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
};
