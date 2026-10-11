/**
 * Get ready for heavy rain, step by step — Epic 5's guide.
 *
 * From the team's Figma (file `atD5fleOrhvMjJ5m0pXYGt`): G1 to G5 for the
 * guide, G3-no to G4b-no for the *doesn't apply* branch, G6 and G6b for the
 * street drain check, and G1z and G2z for an address with nothing marked near
 * it. The guide turns a map layer into a reminder the reader has agreed to,
 * and every step is about that agreement rather than about the map.
 *
 * **Five steps and a finish page, in the design's order**: press the button,
 * decide, read what the decision put in the plan, open *Why this place?* on
 * it, check the street drains, finish. The fourth is a press rather than a
 * sentence because the fold is the one part of the plan a reader would
 * otherwise never see, and AC 5.3.1 is about what it says.
 *
 * **The press states are steps of their own here, not in the design.** G4b
 * and G6b carry the same step number as G4 and G6 and show what the press
 * revealed. A `do` step's `done` line is one sentence, and both of those
 * frames carry a heading and a paragraph worth keeping, so each becomes the
 * read step that follows its press. That is already the guides' own rule for
 * what comes after a press.
 *
 * **The applies branch is not a branch in the steps.** The design draws two
 * sets of screens, one for *Applies to me* and one for *Doesn't apply to me*,
 * and the difference between them is what the plan shows — a reminder, or a
 * place listed with its status. The steps are the same either way. A guide
 * that forked would be telling the reader their answer was the wrong one.
 *
 * **An address with no places is a branch in the steps**, because two of
 * these have nothing to point at there. See `HEAVY_RAIN_NO_PLACES_STEPS`.
 *
 * **Step one asks for a press that opens the plan**, not for a layer: the
 * before-rain markers are already drawn when the guide opens, because the
 * address card's *Check before heavy rain (3)* is what AC 5.1.1 asks to be
 * there, and the reader presses that.
 */

import { type LayerKey, NOTHING_ON } from '../map/modes.js';
import {
  CHECK_STREET_DRAINS,
  NO_PLACES_MEANS,
  PLACE_RADIUS_M,
  checkButton,
} from '../prepare/places.js';
import { type Lesson, type Step } from './lesson.js';

/**
 * The street drain check, which every address gets (Figma G6 and G6b).
 *
 * Shared by both versions of the guide, and the reason the empty address
 * still has somewhere to go: the slide the team marked this up on says it in
 * as many words, *no places nearby, the guide still ends with the street
 * drain check*.
 */
const STREET_DRAIN_STEPS: readonly Step[] = [
  {
    kind: 'do',
    id: 'drains-shown',
    prompt: `Click ${CHECK_STREET_DRAINS}.`,
    hint: 'Every address gets this check, even when no places are found nearby.',
    requires: 'drains-opened',
  },
  {
    kind: 'read',
    id: 'drains-read',
    prompt: 'These are the recorded street drains near you, grouped by street.',
    note: 'Your street comes first. Look from the footpath before heavy rain, and report any drain that looks blocked.',
  },
];

export const HEAVY_RAIN_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'plan-opened',
    prompt: `Click ${checkButton([])}.`,
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
    // Figma G4b, the state after the press. It was lost while this was the
    // last step: the fold opened and the guide went straight to well done.
    done: 'This is why Place 1 is on your list.',
  },
  ...STREET_DRAIN_STEPS,
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
    prompt: `Click ${checkButton([])}.`,
    hint: 'It opens your plan. No places were marked near this address, so the plan starts at what every home can do.',
    requires: 'plan-opened',
  },
  {
    /*
      G2z. A statement for a heading and the instruction under it, which is
      the design's own shape here: what the reader needs first is why the
      step they were expecting is not there.
    */
    kind: 'do',
    id: 'no-places',
    prompt: 'No places to check near this address.',
    hint: `${NO_PLACES_MEANS} None of the published markers fall within ${String(PLACE_RADIUS_M)} m. Every address still gets the street drain check.`,
    requires: 'drains-opened',
  },
  // G6b, the same reading as the other version gets.
  ...STREET_DRAIN_STEPS.slice(1),
];

const FINISHED: Lesson['finished'] = {
  headline: 'Well done! You finished the heavy rain guide.',
  unlocked:
    'Your before-rain checks and your plan are on the full map, and your answers last until you close this tab.',
};

const FINISHED_NO_PLACES: Lesson['finished'] = {
  headline: 'Well done! You finished the heavy rain guide.',
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

    The street drain step turns the recorded pits on and offers no chip for
    them, which is what G6b draws: one chip, and the drains under it.
  */
  chips: (): readonly LayerKey[] => ['beforeRain'],
  // The markers are there from the start, which is what the first step's
  // button belongs to.
  opensWith: { ...NOTHING_ON, beforeRain: true },
  teachingPit: false,
  previous: true,
};
