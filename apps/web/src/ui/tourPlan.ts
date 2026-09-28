/**
 * The guided tour of the map, as data and arithmetic.
 *
 * Two things live here rather than in the component: **what the steps say**,
 * and **where the card goes**. The first because a sentence that makes a claim
 * about certainty is reviewable in one place and is not reviewable scattered
 * through JSX — the same rule `scenario/outcome.ts` and `screens/PitDetail.tsx`
 * follow. The second because placing a card beside a hole in an overlay is
 * geometry, and geometry that is only ever seen is geometry nobody checked.
 */

import { LAYER } from './terms.js';

/**
 * The control a step is about.
 *
 * Matched against `data-tour` in the DOM rather than threaded down as refs.
 * A ref for each of seven controls would put the tour's shape into the props
 * of five components that are not otherwise part of it, and a control that
 * quietly stops being rendered — the way the chips do when the panel is
 * suppressed — would still have to hand back a ref for nothing.
 */
export type TourTarget =
  | 'address'
  | 'chips'
  | 'chip-pit'
  | 'chip-pipe'
  | 'chip-channel'
  | 'chip-lowPoint'
  | 'layers';

export interface TourStep {
  readonly target: TourTarget;
  readonly body: string;
}

/**
 * Seven steps, in the order the prototype numbered them.
 *
 * **Three of them are not what the prototype said, and the differences are
 * deliberate.**
 *
 * Step 5 was *"a picture of the water flow on the surface and where it will
 * flow to"*. That is a prediction, and this product does not make one — the
 * homepage says so under *DrainLens does not provide*. A tour is where
 * somebody learns what the words on the screen mean, so it is the worst place
 * to define them more strongly than the rest of the interface does.
 *
 * Steps 3 and 6 were ungrammatical in a way that changed the meaning — *"the
 * recorded pits function as catching the water flow"* and *"low areas where
 * are prone to have water catchments"*. Rewritten to say what those layers
 * are, in the vocabulary the map itself uses.
 *
 * **Steps 3 to 5 were cut again by copy audit v2** (#54, #55, #56): each had a
 * second sentence about the data's source or limits, and a coach mark is
 * there to say how to read one control. The limits are said beside the
 * layers, in More information.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: 'address',
    /*
      **The second sentence is gone, and it was true.** It said the search runs
      in the browser and that nothing about the address is sent anywhere. The
      address screen says it where an address is actually typed, and the
      homepage says it again under *Find a street*; here it was the longer half
      of a coach mark that exists to point at a search box.

      A promise repeated in three places is not three times as trusted. It is
      three copies to keep true, and the two that remain are the ones a person
      is reading at the moment it matters.
    */
    body: 'Search for an address, then select a result.',
  },
  {
    target: 'chips',
    body: 'Use these buttons to show or hide map layers. You can turn on more than one.',
  },
  {
    target: 'chip-pit',
    body: `${LAYER.pits} are street drains. Rain from the road flows into them.`,
  },
  {
    target: 'chip-pipe',
    body: `${LAYER.pipes} are the underground pipes that join the drains.`,
  },
  {
    target: 'chip-channel',
    body: 'Arrows show which way rain may flow downhill.',
  },
  {
    target: 'chip-lowPoint',
    body: `${LAYER.lowAreas} are calculated places where water may collect. They do not show where flooding has happened or will happen.`,
  },
  {
    target: 'layers',
    body: `Open Layers to show ${LAYER.ground} and ${LAYER.limited}.`,
  },
];
