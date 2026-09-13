/**
 * Low areas where water can collect, step by step.
 *
 * **The sentence this section exists to prevent is "so this is where it
 * floods".** A hollow is a place water *can* collect. Whether it does depends
 * on how much rain falls, what the drains do with it, and how much of it got
 * there — none of which a shape on a map says.
 *
 * The teaching order is a hollow, then what runs into it, then what is there
 * to take the water away. That is three layers the reader has already met in
 * the other two sections, doing one job together, and it is the closest this
 * product comes to a claim about anywhere in particular — which is why the
 * last step is the one that says how strongly to read it.
 *
 * Counted on the published artefact: the `low-point` layer draws **310
 * shapes** over the pilot square kilometre. That is the drawn layer rather
 * than the hollow census — the pipeline's own count is recorded in
 * `pipeline/README.md` and the two are not the same number, so this one is
 * named for what it is.
 *
 * The 0.25 m floor in step two is the reason there are not thousands: the
 * ground surface is quoted at about 25 cm accuracy and the median untrimmed
 * hollow is 5 cm, which is the surface's own noise.
 */

import { type Lesson, unlockingChips } from './lesson.js';

export const LOW_AREAS_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'low-areas-on',
    prompt: 'Press Low areas to show the dips in the ground near your address.',
    hint: 'The map opens with nothing on it. Everything you see from here is something you turned on.',
    requires: 'low-areas-on',
  },
  {
    kind: 'read',
    id: 'hollows-shown',
    prompt:
      'Each shape is a hollow deep enough to hold water — at least 25 cm, because that is about as finely as the ground was measured. Shallower dips are left out rather than drawn as if we were sure of them.',
  },
  {
    kind: 'do',
    id: 'water-flow-on',
    prompt: 'Press Water flow to see what runs into them.',
    requires: 'water-flow-on',
  },
  {
    kind: 'read',
    id: 'paths-into-hollows',
    prompt:
      'A hollow with paths running into it collects water from further away than its own footprint. That is the difference between a dip in a road and the low corner of a neighbourhood.',
  },
  {
    kind: 'do',
    id: 'pits-on',
    prompt: 'Now press Pits to see which hollows have a drain in them.',
    hint: 'A hollow with a drain has a way out. One without has whatever the ground gives it.',
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'what-this-is-not',
    prompt:
      'This is not a flood map. A hollow is somewhere water can collect, not somewhere it will — how much arrives depends on the rain and on what the drains do with it, and neither of those is on this screen.',
  },
];

export const LOW_AREAS_DONE: Lesson['finished'] = {
  headline: 'That is where water can collect.',
  body: 'You turned on hollows measured from the ground surface, saw what runs into them, and saw which of them have a drain. It is the shape of the ground and the council’s record together — not a forecast of either.',
  unlocked: 'Low areas are now yours on the whole map.',
};

export const LOW_AREAS: Lesson = {
  steps: LOW_AREAS_STEPS,
  finished: LOW_AREAS_DONE,
  // Low areas, then Water flow at step 2, then Pits at step 4.
  chips: unlockingChips([
    { key: 'lowPoint', at: 0, on: (now) => now.lowPoints },
    { key: 'channel', at: 2, on: (now) => now.channel },
    { key: 'pit', at: 4, on: (now) => now.pits },
  ]),
  teachingPit: false,
};
