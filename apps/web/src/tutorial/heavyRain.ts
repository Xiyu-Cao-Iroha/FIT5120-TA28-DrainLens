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
import {
  FOR_EVERY_HOME,
  NO_PLACES_MEANS,
  PLACE_RADIUS_M,
  checkButton,
} from '../prepare/places.js';
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

/**
 * The same guide at an address with nothing marked near it.
 *
 * **This is the majority address, not an edge case.** There are 91 published
 * markers in the council and 200 m is what *near this address* means, so
 * 58.6% of the 62,397 addresses have no place to number (`prepare/places.ts`).
 * At one of those the five steps above are unfinishable: the second waits for
 * a decision about a Place 1 that was never drawn, and the fourth for a fold
 * under a reminder that cannot exist. A reader at 11 Neale Street reached
 * *Decide whether Place 1 applies to you* with nothing on the map to decide
 * about and only Previous to press.
 *
 * **It is the plan's own answer, walked through.** Nothing here is new copy
 * about risk: the plan already says what AC 5.1.3 asks it to say, and these
 * steps take the reader to it and then to the actions every home gets. The
 * absence is stated once, with what it does not mean beside it, in the
 * product's words rather than the guide's.
 *
 * **No Figma frame for it.** The design draws G1 to G5 and the *doesn't
 * apply* branch, all of them at an address with places. This follows the
 * frames that do exist -- the address card's two ways on (A8) and the plan's
 * empty state -- rather than inventing a screen.
 */
export const HEAVY_RAIN_NO_PLACES_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'plan-opened',
    /*
      The same button as the guide with places, and for the same reason it
      is the same step: in a guide the full address card is suppressed, and
      the only way into the plan is the callout on the address, which is
      labelled by `checkButton` and loses its count rather than its name.
      The two ways on the design draws for an empty address (Figma A8, *See
      what every home can do*) are on the card, which is not here.
    */
    prompt: `Click ${checkButton([])}.`,
    hint: 'It opens your plan. No places were marked near this address, so the plan starts at what every home can do.',
    requires: 'plan-opened',
  },
  {
    kind: 'read',
    id: 'no-places',
    // The heading points at the panel and the note says why; the panel's own
    // sentence (`NO_PLACES`) is two inches away and does not need repeating.
    prompt: 'Read why there is nothing to review here.',
    note: `${NO_PLACES_MEANS} None of the published pooling markers fall within ${String(PLACE_RADIUS_M)} m of this address, and those markers are the only thing this layer numbers.`,
  },
  {
    kind: 'read',
    id: 'every-home',
    prompt: `Read the actions ${FOR_EVERY_HOME.toLowerCase()}.`,
    note: 'These actions are the same for every address, whether or not a place was marked near it. Each one opens to show where it came from, and the plan can be printed or saved from the bottom of the panel.',
  },
];

const FINISHED: Lesson['finished'] = {
  headline: 'Well done! You finished the heavy rain guide.',
  unlocked:
    'Your before-rain checks and your plan are on the full map, and your answers last until you close this tab.',
};

const FINISHED_NO_PLACES: Lesson['finished'] = {
  headline: 'Well done! You finished the heavy rain guide.',
  // Not "your answers": at this address there was nothing to answer. The plan
  // is still there, and it is what the reader leaves with.
  unlocked:
    'Your before-rain checks and your plan are on the full map, and the plan can be printed from there.',
};

/**
 * Which version of the guide this address gets.
 *
 * A null count is the markers not loaded yet, and it takes the version with
 * places: it is the one the first step is written for either way, and an
 * address that turns out to have none switches before that step is satisfied.
 */
export const heavyRainFor = (placeCount: number | null): Pick<Lesson, 'steps' | 'finished'> =>
  placeCount === 0
    ? { steps: HEAVY_RAIN_NO_PLACES_STEPS, finished: FINISHED_NO_PLACES }
    : { steps: HEAVY_RAIN_STEPS, finished: FINISHED };

export const HEAVY_RAIN: Lesson = {
  steps: HEAVY_RAIN_STEPS,
  finished: FINISHED,
  withPlaces: heavyRainFor,
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
