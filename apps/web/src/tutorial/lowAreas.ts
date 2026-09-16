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
 * The 0.25 m floor is the reason there are not thousands: the ground surface
 * is quoted at about 25 cm accuracy and the median untrimmed hollow is 5 cm,
 * which is the surface's own noise. Step two used to say so; since copy audit
 * v2 (#44) it says only what the blue is.
 *
 * **The warning sign comes straight after the shapes**, while the reader is
 * still looking at blue, because it is a mark on those shapes and means
 * nothing without them. A `read` step rather than a `do`: the guide opens
 * 300 m across on 46 Gatehouse Drive, and the nearest sign is on the street
 * 18 m east and 181 m north of it -- just outside that view, and signs only
 * draw once the map is zoomed in. A step that waited for a press on it would
 * wait for a zoom and a drag the reader was never asked to make. Copy audit
 * v2 (#45) cut the step to two short sentences and suggested zooming the
 * guide to a sign and making the step a press; that needs the guide to move
 * the map's view to a sign and the map to report an opened sign, and is not
 * built yet. Kensington has 2 signs; see
 * `map/warnings.ts` for which hollows get one and from what zoom.
 */

import { FULL_MAP, LAYER } from '../ui/terms.js';
import { type Lesson, unlockingChips } from './lesson.js';

/*
  Copy audit v2 of 15 September, #43 to #51. Praise first after a correct
  press, one action per instruction. The 25 cm floor, the outlet level and the
  ground data's uncertainty (#44), and that a recorded pit says nothing about
  whether the drain is clear (#49), are left to the map's More information. The one
  safety line kept is the small print on the last step (#50).
*/
export const LOW_AREAS_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'low-areas-on',
    prompt: `Click ${LAYER.lowAreas} to see dips where water may pool.`,
    requires: 'low-areas-on',
  },
  {
    kind: 'read',
    id: 'hollows-shown',
    prompt: 'Great! Blue areas are dips where rainwater may pool.',
  },
  {
    kind: 'read',
    id: 'deep-hollow-sign',
    prompt: 'Warning signs mark the deepest spots. Zoom in to find one.',
  },
  {
    kind: 'do',
    id: 'water-flow-on',
    prompt: `Now click ${LAYER.paths} to see where water flows into these dips.`,
    requires: 'water-flow-on',
  },
  {
    kind: 'read',
    id: 'paths-into-hollows',
    prompt: 'Great! Where many arrows meet, more water can pool.',
  },
  {
    kind: 'do',
    id: 'pits-on',
    prompt: `Now click ${LAYER.pits} to find drains inside the blue areas.`,
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'what-this-is-not',
    prompt: 'Great! Now you can see drains inside the low areas.',
    note: 'This is not a flood forecast.',
  },
];

export const LOW_AREAS_DONE: Lesson['finished'] = {
  headline: 'Well done! You finished the low areas guide.',
  unlocked: `${LAYER.lowAreas} is also on the ${FULL_MAP.toLowerCase()}.`,
};

export const LOW_AREAS: Lesson = {
  steps: LOW_AREAS_STEPS,
  finished: LOW_AREAS_DONE,
  // Low areas, then Likely water paths at step 3, then Drain pits at step 5.
  chips: unlockingChips([
    { key: 'lowPoint', at: 0, on: (now) => now.lowPoints },
    { key: 'channel', at: 3, on: (now) => now.channel },
    { key: 'pit', at: 5, on: (now) => now.pits },
  ]),
  teachingPit: false,
  previous: true,
};
