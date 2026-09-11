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
 * is the hatching that says *the ground under here was never measured*.
 *
 * The order — paths, then drains, then the gaps — is the order somebody
 * actually asks about: what is this, where does it go, and how much of it do
 * you know.
 */

import { type Lesson, unlockingChips } from './lesson.js';

export const WATER_FLOW_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'water-flow-on',
    prompt: 'Press Water flow to show the paths rainwater may take near your address.',
    hint: 'The map opens with nothing on it. Everything you see from here is something you turned on.',
    requires: 'water-flow-on',
  },
  {
    kind: 'read',
    id: 'paths-shown',
    prompt:
      'Those lines are not a record of anything. They are calculated here, from the shape of the ground, and they show which way water runs downhill — arrowheads and all.',
  },
  {
    kind: 'do',
    id: 'pits-on',
    prompt: 'Now press Pits to see where those paths meet the council’s drains.',
    hint: 'One is what we worked out. The other is what somebody surveyed. It is worth seeing them together.',
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'paths-and-pits',
    prompt:
      'Where a path runs into a pit, the water has somewhere to go. Where it runs past one, it keeps going downhill. Neither is a prediction of a flood — it is the slope of the ground and the drains that are recorded on it.',
  },
  {
    kind: 'do',
    id: 'unmeasured-on',
    prompt: 'Press No ground data to see where the ground was never measured.',
    hint: 'The paths stop being a calculation there and start being nothing at all.',
    requires: 'unmeasured-on',
  },
  {
    kind: 'read',
    id: 'gaps-shown',
    prompt:
      'The ground surface comes from aerial photography, and a camera cannot see through a tree or a roof. Under the hatching we have not worked out where water goes, and we do not guess.',
  },
];

export const WATER_FLOW_DONE: Lesson['finished'] = {
  headline: 'That is where rainwater may move.',
  body: 'You turned on paths we calculated, put the council’s drains underneath them, and saw where the calculation runs out of ground to stand on. The same three controls work anywhere on the map.',
  unlocked: 'Water flow is now yours on the whole map.',
};

export const WATER_FLOW: Lesson = {
  steps: WATER_FLOW_STEPS,
  finished: WATER_FLOW_DONE,
  /*
    Water flow, then Pits at step 2, then No ground data at step 4.

    `No ground data` is behind the Layers button on the unguided map, because
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
