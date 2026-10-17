/**
 * Get ready for heavy rain, step by step - Epic 5's guide.
 *
 * From the team's Figma (file `atD5fleOrhvMjJ5m0pXYGt`): the REVISED E5
 * frames of 17 October, which replaced G1 to G6. The guide turns a map layer
 * into a reminder the reader has agreed to, and every step is about that
 * agreement rather than about the map.
 *
 * **Three steps and a finish page**: open the plan, answer for every place,
 * read what the answers put in the plan. It had six, and the team removed
 * three of them on 17 October with a reason written on each:
 *
 * | Removed | Because |
 * |---|---|
 * | *Why this place?* | the place card already explains why it matters |
 * | the street drain check | it is outside this heavy-rain task |
 * | the drain list reading | the list may stay; pressing Next to acknowledge it may not |
 *
 * **None of those three left the product**, which is the distinction the
 * decision cards draw: the fold is still under every reminder, and the plan
 * still opens the street drains. What went is the guide stopping a reader
 * on them.
 *
 * **The second step waits for every place, not the first one.** It was
 * satisfied by Place 1 until 17 October, which let a reader reach a plan
 * that was still asking them about Place 2; the design's review frame says
 * *3 of 3 reviewed*, so now it means that.
 *
 * **The applies branch is not a branch in the steps.** The design draws two
 * sets of screens, one for *Applies to me* and one for *Doesn't apply to
 * me*, and the difference between them is what the plan shows: a reminder,
 * or a place listed with its status. The steps are the same either way. A
 * guide that forked would be telling the reader their answer was the wrong
 * one.
 *
 * **An address with no places is a branch in the steps**, because the second
 * one has nothing to ask about there. See `HEAVY_RAIN_NO_PLACES_STEPS`.
 *
 * **Step one asks for a press that opens the plan**, not for a layer: the
 * before-rain markers are already drawn when the guide opens, because the
 * address card's *Check before heavy rain (3)* is what AC 5.1.1 asks to be
 * there, and the reader presses that.
 */

import { type LayerKey, NOTHING_ON } from '../map/modes.js';
import { NO_PLACES_MEANS, PLACE_RADIUS_M, checkButton } from '../prepare/places.js';
import { type Lesson } from './lesson.js';

export const HEAVY_RAIN_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'plan-opened',
    prompt: `Select ${checkButton([])}.`,
    hint: 'The plan opens with the places found near this address.',
    requires: 'plan-opened',
  },
  {
    kind: 'do',
    id: 'places-reviewed',
    prompt: 'Choose whether this place applies to you.',
    hint: 'Choose the answer that matches how you use this place.',
    requires: 'places-reviewed',
    /*
      Its own feedback, so the step after it can be an instruction.

      The guides' rule is that a read step straight after a press is praise
      for that press -- *Great! ...* -- and the design's third step is not
      praise, it is *Review the reminder, then select Next*. The press gets
      its sentence here instead, which is also where it happened.
    */
    done: 'Your answers are in the plan.',
  },
  {
    /*
      A reading step, and the design is explicit that it is only that: *no
      checkbox or other choice is needed here*. Next is the only action, and
      a `read` step is the kind that has one.
    */
    kind: 'read',
    id: 'plan-reviewed',
    points: 'plan',
    prompt: 'Review the reminder, then select Next.',
    note: 'Read the highlighted plan panel. No checkbox or other choice is needed here.',
  },
];

/**
 * The same guide at an address with nothing marked near it (Figma G1z, G2z).
 *
 * **This is the majority address, not an edge case.** There are 91 published
 * markers in the council and 200 m is what *near this address* means, so
 * 58.6% of the 62,397 addresses have no place to number (`prepare/places.ts`).
 * At one of those the middle of the guide is unfinishable: the second step
 * waits for a decision about a Place 1 that was never drawn, and the fourth
 * for a fold under a reminder that cannot exist. A reader at 11 Neale Street
 * reached *Decide whether Place 1 applies to you* with nothing on the map to
 * decide about and only Previous to press.
 *
 * **The design's answer is to go straight to the street drain check.** G2z
 * states the absence and then asks for the one press that still means
 * something, and the frame the team marked up is titled *no places nearby,
 * the guide still ends with the street drain check*. The absence is said in
 * the design's words; nothing here invents new copy about risk.
 */
export const HEAVY_RAIN_NO_PLACES_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'plan-opened',
    /*
      The same button and the same step as the guide with places. In a guide
      the full address card is suppressed, so the only way into the plan is
      the callout on the address, which `checkButton` labels and which loses
      its count rather than its name. The two ways on that the design draws
      for an empty address (Figma A8) are on the card, which is not here.
    */
    prompt: `Select ${checkButton([])}.`,
    hint: 'No places were marked near this address, so the plan starts at what every home can do.',
    requires: 'plan-opened',
  },
  {
    /*
      G2z, as a reading rather than a press.

      It used to ask for the street drain check, which was the one press an
      empty address had left. That step is gone from both versions of the
      guide (17 October), so what stands here is the statement it carried:
      why the step the reader was expecting is not there.
    */
    kind: 'read',
    id: 'no-places',
    prompt: 'No places to check near this address.',
    note: `${NO_PLACES_MEANS} None of the published markers fall within ${String(PLACE_RADIUS_M)} m.`,
  },
  {
    /*
      The same reading step as the other version, about what is actually in
      this plan: every home's actions, with no place reminders above them.
      The team's three steps are written for an address with places and the
      design draws no empty-address version of them, so this keeps their
      shape and says what is true here.
    */
    kind: 'read',
    id: 'plan-reviewed',
    points: 'plan',
    prompt: 'Review the plan, then select Next.',
    note: 'Read the highlighted plan panel. No checkbox or other choice is needed here.',
  },
];

const FINISHED: Lesson['finished'] = {
  headline: 'Well done! You finished the heavy rain preparation guide.',
  unlocked:
    'Your before-rain checks and your plan are on the full map, and your answers last until you close this tab.',
};

const FINISHED_NO_PLACES: Lesson['finished'] = {
  headline: 'Well done! You finished the heavy rain preparation guide.',
  // Not "your answers": at this address there was nothing to answer. The plan
  // and the drain list are still there, and they are what the reader leaves
  // with.
  unlocked:
    'Your before-rain checks, your plan and the street drains near you are on the full map.',
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
