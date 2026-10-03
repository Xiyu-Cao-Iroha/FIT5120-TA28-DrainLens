/**
 * Get ready for heavy rain, step by step — Epic 5's guide.
 *
 * From the team's Figma (file `atD5fleOrhvMjJ5m0pXYGt`, screens G1 to G5, with
 * the *doesn't apply* branch at G3-no to G4b-no). The guide turns a map layer
 * into a reminder the reader has agreed to, and every step is about that
 * agreement rather than about the map.
 *
 * **Five steps, in the design's order**: press the button, decide, read what
 * the decision put in the plan, open *Why this place?* on it, finish. The
 * fourth is a press rather than a sentence because the fold is the one part of
 * the plan a reader would otherwise never see, and AC 5.3.1 is about what it
 * says.
 *
 * **The branch is not a branch in the steps.** The design draws two sets of
 * screens, one for *Applies to me* and one for *Doesn't apply to me*, and the
 * difference between them is what the plan shows — a reminder, or a place
 * listed with its status. The steps are the same five either way. A guide that
 * forked would be telling the reader their answer was the wrong one.
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
    kind: 'do',
    id: 'place-reviewed',
    prompt: 'Decide whether Place 1 applies to you.',
    hint: 'If you never park or leave bins here, choose Doesn’t apply to me.',
    requires: 'place-reviewed',
    /*
      Its own feedback, so the step after it can be an instruction.

      The guides' rule is that a read step straight after a press is praise
      for that press -- *Great! …* -- and the design's third step is not
      praise, it is *Review the reminder added to your plan*. The press gets
      its sentence here instead, which is also where it happened.
    */
    done: 'Your answer is in the plan.',
  },
  {
    kind: 'read',
    id: 'plan-updated',
    prompt: 'Review the reminder added to your plan.',
    note: 'Only places that apply to you create a reminder. Other places remain listed with their review status.',
  },
  {
    kind: 'do',
    id: 'why-shown',
    prompt: 'Open Why this place?',
    hint: 'Each reminder explains why DrainLens picked that place.',
    requires: 'why-opened',
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
