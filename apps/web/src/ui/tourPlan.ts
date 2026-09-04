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
 * homepage says so under *DrainLens does not provide*, and the card for the
 * same layer says *which way water tends to run, not how much of it or how
 * deep*. A tour is where somebody learns what the words on the screen mean,
 * so it is the worst place to define them more strongly than the rest of the
 * interface does.
 *
 * Steps 3 and 6 were ungrammatical in a way that changed the meaning — *"the
 * recorded pits function as catching the water flow"* and *"low areas where
 * are prone to have water catchments"*. Rewritten to say what those layers
 * are, in the vocabulary the map itself uses.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: 'address',
    body: 'Type an address here and choose it from the list. The search runs in your browser — nothing about the address is sent anywhere.',
  },
  {
    target: 'chips',
    body: 'These switch the map’s layers on and off. Press one to show a layer, press it again to hide it, and combine as many as you find useful.',
  },
  {
    target: 'chip-pit',
    body: 'Pits are the drainage openings the council has recorded — the places surface water can enter the underground network.',
  },
  {
    target: 'chip-pipe',
    body: 'Pipes are the recorded underground network those pits connect to. Following one shows where the record stops, which is not always where the water does.',
  },
  {
    target: 'chip-channel',
    body: 'Water flow shows the paths surface water is likely to take, calculated from the measured ground. It says which way water tends to run, not how much of it or how deep.',
  },
  {
    target: 'chip-lowPoint',
    body: 'Low areas are the places the calculated surface says water can collect. Indicative, and not a statement that any of them has flooded or will.',
  },
  {
    target: 'layers',
    body: 'The ground surface, and anything without a button of its own, is behind Layers.',
  },
];
