/**
 * Low areas where water may collect, step by step.
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

import { FULL_MAP, LAYER } from '../ui/terms.js';
import { type Lesson, unlockingChips } from './lesson.js';

export const LOW_AREAS_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'low-areas-on',
    prompt: `Select ${LAYER.lowAreas} to show calculated dips in the ground near the address.`,
    hint: 'The map starts with all optional layers turned off.',
    requires: 'low-areas-on',
  },
  {
    kind: 'read',
    id: 'hollows-shown',
    prompt:
      'Each blue shape is a calculated dip at least 25 cm below its estimated outlet level. Water may collect there. Shallower changes are not shown because they are within the uncertainty of the ground-height data.',
  },
  {
    kind: 'do',
    id: 'water-flow-on',
    prompt: `Select ${LAYER.paths} to compare them with calculated low areas.`,
    requires: 'water-flow-on',
  },
  {
    kind: 'read',
    id: 'paths-into-hollows',
    prompt:
      'A low area connected to several calculated paths may receive water from a wider area.',
  },
  {
    kind: 'do',
    id: 'pits-on',
    prompt: `Select ${LAYER.pits} to see where council records show a pit inside a calculated low area.`,
    hint: 'A recorded pit does not show whether the drain is clear or how much water it can take.',
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'what-this-is-not',
    prompt:
      'Blue areas show where water may collect. They do not predict flooding. Rainfall and drain performance are not included in this view.',
  },
];

export const LOW_AREAS_DONE: Lesson['finished'] = {
  headline: 'That is where water can collect.',
  body: 'You viewed calculated low areas, likely water paths and pit locations from council records. These layers do not predict flooding.',
  unlocked: `You can now use ${LAYER.lowAreas} on the ${FULL_MAP.toLowerCase()}.`,
};

export const LOW_AREAS: Lesson = {
  steps: LOW_AREAS_STEPS,
  finished: LOW_AREAS_DONE,
  // Low areas, then Likely water paths at step 2, then Drain pits at step 4.
  chips: unlockingChips([
    { key: 'lowPoint', at: 0, on: (now) => now.lowPoints },
    { key: 'channel', at: 2, on: (now) => now.channel },
    { key: 'pit', at: 4, on: (now) => now.pits },
  ]),
  teachingPit: false,
};
