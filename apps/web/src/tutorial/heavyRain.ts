/**
 * Get ready for heavy rain, step by step — Epic 5's guide.
 *
 * From the team's Figma (file `atD5fleOrhvMjJ5m0pXYGt`, screens G1 to G5, with
 * the *doesn't apply* branch at G3-no to G4b-no). The guide turns a map layer
 * into a reminder the reader has agreed to, and every step is about that
 * agreement rather than about the map.
 *
 * **The branch is not a branch in the steps.** The design draws two sets of
 * screens, one for *Applies to me* and one for *Doesn't apply to me*, and the
 * difference between them is what the plan shows — a reminder, or a place
 * listed with its status. The steps are the same four either way: open the
 * place, see why it is listed, decide, and read what the decision did. A guide
 * that forked would be telling the reader their answer was the wrong one.
 *
 * **Step one asks for a press that opens the plan**, not for a layer: the
 * before-rain markers are already drawn when the guide opens, because the
 * address card's *Check before heavy rain (3)* is what AC 5.1.1 asks to be
 * there, and the reader presses that.
 */

import { type LayerKey, NOTHING_ON } from '../map/modes.js';
import { type Lesson } from './lesson.js';

export const HEAVY_RAIN_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'plan-opened',
    prompt: 'Click Check before heavy rain.',
    hint: 'Place 1 opens straight away. The other places are numbered on the map.',
    requires: 'plan-opened',
  },
  {
    kind: 'read',
    id: 'why-shown',
    prompt: 'Great! Why this place? explains what put this spot on your list.',
    note: 'It describes the street near your address, not your property.',
  },
  {
    kind: 'do',
    id: 'place-reviewed',
    prompt: 'Decide whether Place 1 applies to you.',
    hint: 'If you never park or leave bins here, choose Doesn’t apply to me.',
    requires: 'place-reviewed',
  },
  {
    kind: 'read',
    id: 'plan-updated',
    prompt: 'Great! Your plan now shows what you decided.',
    note: 'Only places that apply to you create a reminder. The others keep their review status.',
  },
];

export const HEAVY_RAIN: Lesson = {
  steps: HEAVY_RAIN_STEPS,
  finished: {
    headline: 'Well done! You finished the heavy rain guide.',
    unlocked:
      'Your before-rain checks and your plan are on the full map, and your answers last until you close this tab.',
  },
  /*
    One chip, on from the start.

    Unlike the other guides, this one does not open on an empty map: AC 5.1.1
    puts the numbered markers and the count on the address card as soon as an
    address is chosen, and the first step asks for the button that opens the
    plan. The chip stays offered so the layer can be taken off again.
  */
  chips: (): readonly LayerKey[] => ['beforeRain'],
  // The markers are there from the start, which is what the first step's
  // button belongs to.
  opensWith: { ...NOTHING_ON, beforeRain: true },
  teachingPit: false,
  previous: true,
};
