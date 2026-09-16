/**
 * What the result screen says, for each thing the engine can return.
 *
 * Written as data rather than as branches inside a component, because the
 * wording is the product here. Every line below was argued over: which of the
 * four reasons a person is looking at decides what they should do next, and
 * offering the wrong next step sends them round a loop they cannot get out of.
 *
 * The sharpest case is `terrain_unavailable`. "Choose another drainage pit" is
 * the right action for an unusable inlet and the wrong one here — every pit in
 * that area fails for the same reason, so the person picks another, waits, and
 * gets the same screen. The copy says so outright.
 */

import type { ComparisonBand, InsufficiencyReason } from '@drainlens/schema';

import { SOURCE } from '../ui/terms.js';

export type Action =
  | 'change-scenario'
  | 'choose-another-pit'
  | 'change-address'
  | 'return-to-map'
  | 'try-again'
  | 'review-scenario';

/**
 * The words on the result's buttons, in the Blockage Flow prototype's voice.
 *
 * *Return to the map* no longer says *full map*: from a comparison that began
 * with an address it goes back to step 1, the map around that address, and
 * only a comparison opened from the full map returns there.
 */
export const ACTION_LABELS: Readonly<Record<Action, string>> = {
  'change-scenario': 'Change the test',
  'choose-another-pit': 'Choose another drain',
  'change-address': 'Try another address',
  'return-to-map': 'Return to the map',
  'try-again': 'Try again',
  'review-scenario': 'Review your choices',
};

export interface Presentation {
  /** The heading over the whole result. */
  readonly title: string;
  /** The small label above the finding. */
  readonly band: string;
  /**
   * A bold line under the heading, or null when the heading already says it.
   *
   * Null on both bands. Their heading *is* the band's name, and in the
   * 15 September user test *No clear difference* was on one result five
   * times -- heading, this line, the body, the callout and the summary -- which
   * read as insisting rather than informing. The insufficient states keep
   * theirs, because their heading is only *Insufficient information* and this
   * line is what says which kind.
   */
  readonly finding: string | null;
  /** One plain sentence, which must not repeat the heading. */
  readonly body: string;
  /** What goes in the summary's Comparison field. */
  readonly comparison: string;
  readonly actions: readonly Action[];
  /** Whether a difference is drawn on the map at all. */
  readonly showsDifference: boolean;
}

const COMPARISON_TITLE = 'Compared with the clear-drain setting';

/**
 * The heading over every result that could not be calculated.
 *
 * "Insufficient information" is AC 3.1.4.a's own wording. It was "Comparison
 * unavailable", which is true and which a person could also read as the
 * service being down.
 */
const INSUFFICIENT_TITLE = 'Insufficient information';

export const BANDS: Readonly<Record<ComparisonBand, Presentation>> = {
  'higher-than-baseline': {
    title: COMPARISON_TITLE,
    band: 'More water than with a clear drain',
    finding: null,
    // Not "near the highlighted low area": the comparison's map no longer
    // draws low areas, and the purple has its own line beside this one.
    body: 'With your drain setting, less water enters the selected drain, so more stays on the ground nearby.',
    comparison: 'More water than with a clear drain',
    actions: ['change-scenario', 'return-to-map'],
    showsDifference: true,
  },
  'no-clear-change': {
    title: COMPARISON_TITLE,
    // Plain words from the 14 September copy review, over AC 3.1.3.e's band names.
    band: 'No visible difference nearby',
    finding: null,
    // What the heading means, in other words. What it does not mean is
    // `NO_CLEAR_CHANGE_MEANS`, which the screen shows beside this.
    body: 'At this total rainfall, the model found no extra surface water nearby large enough to show on the map.',
    comparison: 'No clear difference',
    actions: ['change-scenario', 'return-to-map'],
    showsDifference: false,
  },
};

/**
 * The four reasons a comparison could not be made.
 *
 * Each gets its own words and its own way out. Collapsing them into one
 * message was the state of the design until it was reviewed, and the cost was
 * that somebody in an area with no terrain would be told to choose another
 * pit — which cannot help them, because the terrain is missing for all of them.
 */
export const INSUFFICIENT: Readonly<Record<InsufficiencyReason, Presentation>> = {
  terrain_unavailable: {
    title: INSUFFICIENT_TITLE,
    band: 'Terrain unavailable',
    finding: 'Terrain data is unavailable for this area',
    body: 'Changing the drainage pit will not fix this. There is not enough reliable ground data to calculate water paths in this area. Return to the map or choose another supported address.',
    comparison: 'Not calculated',
    actions: ['change-address', 'return-to-map'],
    showsDifference: false,
  },
  invalid_inlet: {
    title: INSUFFICIENT_TITLE,
    band: 'Drain record unavailable',
    finding: 'This pit is missing information needed for the comparison',
    body: 'Choose another recorded drainage pit. The official identifier for this one remains visible; the fields we do not hold stay marked unavailable rather than being filled in.',
    comparison: 'Not calculated',
    actions: ['choose-another-pit', 'review-scenario'],
    showsDifference: false,
  },
  scenario_calculation_failed: {
    title: INSUFFICIENT_TITLE,
    band: 'Calculation failed',
    finding: 'We could not complete this comparison',
    body: 'Your drain setting and total rainfall are still here. Try again, or review the scenario.',
    comparison: 'Failed',
    actions: ['try-again', 'review-scenario'],
    showsDifference: false,
  },
  comparison_not_comparable: {
    title: INSUFFICIENT_TITLE,
    band: 'Results not comparable',
    finding: 'These two drain settings cannot be compared',
    body: 'The two drain settings could not be compared using the same data. Review your settings and run the comparison again with the same total rainfall.',
    comparison: 'Not comparable',
    actions: ['review-scenario', 'return-to-map'],
    showsDifference: false,
  },
};

export type Outcome =
  | { readonly status: 'successful'; readonly band: ComparisonBand }
  | { readonly status: 'insufficient-information'; readonly reason: InsufficiencyReason };

export const presentationFor = (outcome: Outcome): Presentation =>
  outcome.status === 'successful' ? BANDS[outcome.band] : INSUFFICIENT[outcome.reason];

/**
 * The line that travels with every result.
 *
 * Arrival time is named because it is the thing people most want a flood map
 * to tell them and the thing this model is least able to: it compares
 * accumulated water between two assumptions and knows nothing about when.
 */
export const RESULT_DISCLAIMER =
  'This comparison does not predict flooding. It does not show flood depth or when water may arrive.';

/**
 * The short line under *Run comparison*, before anything has run.
 *
 * AC 3.1.3.g said at the moment of asking rather than only on the answer: the
 * comparison is between two settings, not an inspection of the drain and not
 * a forecast. The full disclaimer follows on the result.
 */
export const REVIEW_DISCLAIMER =
  'Most drains show no visible change nearby. This is a model comparison, not the drain’s current condition or a flood forecast.';

/**
 * The purple, named once, for the legend and the note beside the finding.
 *
 * **One purple, one line, no magnitude.** The engine returns a yes or no per
 * cell against a fixed 0.05 m³ threshold, so there is nothing a light and a
 * dark purple could honestly mean. See `DIFFERENCE_FILL` in `map/difference.ts`.
 */
export const DIFFERENCE_LEGEND = 'Area with more surface water in the model';

/** What the purple is not, beside the legend line. */
export const DIFFERENCE_LEGEND_NOTE =
  'Purple marks changes large enough to report. It is not water depth, and its edge follows the area the model found rather than a circle around the drain.';

/** The three parts of a run, as the progress names them while it waits. */
export const COMPARING_STEPS: readonly string[] = [
  'Every drain clear',
  'Your drain condition',
  'Finding the difference',
];

/**
 * Why "no clear difference" is the usual answer here, in the person's terms.
 *
 * Shown with every `no-clear-change` result, because a comparison that always
 * answers "nothing" and never says why reads as a product that did not work.
 * It did work. The measurement is the finding.
 *
 * Every figure below was measured on this extent: blocking one inlet frees a
 * median of 0.036 m³; blocking the hundred inlets nearest a point raises water
 * by 5.6 mm and puts no cell over the reporting threshold; the water a blocked
 * inlet rejects is taken by the drains below it or spreads across a hollow
 * large enough to absorb it.
 *
 * We do not report the millimetres. The ground surface is derived from aerial
 * photography and is quoted at about 25 cm accuracy, so a computed rise of a
 * millimetre is far finer than the data's own error bar — putting it on screen
 * would be presenting noise as a finding.
 */
export const WHY_NO_CLEAR_CHANGE: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'The model may send the water elsewhere',
    body: 'Other nearby drains may take it in, or it may keep flowing downhill.',
  },
  {
    title: 'The model does not show small changes',
    body: 'Small or spread-out changes are not shown on the map.',
  },
  {
    title: 'Why small changes are left out',
    body: 'Ground height comes from aerial photographs and is accurate to about 25 centimetres, so a smaller calculated change is below what the data can support.',
  },
];

/**
 * What the rainfall control does, and the thing it must not be read as.
 *
 * AC 2.2.2.d (Aug-27 set). The model's independent variable is accumulated rainfall, not
 * time: it knows how much water has fallen, never how long that took. So a
 * control that slides left to right looks exactly like a timeline and is not
 * one, and this sentence is the only thing standing between the two readings.
 */
export const RAINFALL_CONTROL_NOTE =
  'Each button is an amount of total rainfall, not a point in time. A change need not grow steadily with rainfall: it can appear at one amount and not at the next, as low areas fill and overflow.';

/**
 * What total rainfall is in this model, where an amount is chosen.
 *
 * AC 3.2.3.d and e: no intensity or duration, and not a forecast. How the
 * water is added (evenly, from dry ground) is in `HOW_IT_WAS_PRODUCED`.
 */
export const RAINFALL_EXPLAINED =
  'The same amount is used for both drain settings. It is not a forecast and does not include rainfall duration or intensity.';

/**
 * What "No clear difference" means, said outright beside the finding.
 *
 * AC 3.3.2.h and 3.1.3.f. This is the sentence that makes a null result honest
 * rather than reassuring, which is why it is not inside a collapsed section:
 * the audit on 13 September found it was not on the screen at all.
 */
export const NO_CLEAR_CHANGE_MEANS =
  'This does not mean the area cannot flood, or that a blockage here would not matter.';

/**
 * Everything the comparison cannot tell a person, AC 3.3.2 a to i, in order.
 *
 * Kept as one list so the criteria can be checked against it line by line.
 */
export const LIMITATIONS: readonly string[] = [
  'The drain setting is one you chose, not an observation of the drain.',
  'The total rainfall is an amount you chose, not a weather observation or forecast.',
  'The model does not work out the rainfall amount at which a drain would fail.',
  'How much water the pipes can carry is not modelled.',
  'The result does not show flood depth or water depth.',
  'It does not estimate when floodwater would arrive.',
  'It does not give a flood probability or a risk score.',
  // The full sentence, not `NO_CLEAR_CHANGE_MEANS`: the note beside the finding
  // is the short form, and AC 3.3.2.h still needs saying in full here.
  'No clear difference means this simplified calculation did not find a clear difference from the clear-drain setting. It does not show whether this drain is blocked now, or that a blockage would have no effect in a real flood.',
  'It only shows differences from the clear-drain setting, within the area of ground data around the selected drain.',
];

/**
 * How strongly to read a result, AC 3.3.3.d.
 */
export const HOW_STRONGLY_TO_READ_IT =
  'Read this as a comparison between two drain settings on estimated ground height. More water than with a clear drain says where, in this model, the blockage leaves more water on the ground — not how much, and not that it would flood. No clear difference says the model could not separate the two settings — not that the drain does not matter.';

/**
 * The three kinds of thing on this screen, and their colours.
 *
 * AC 2.3.1.c (Aug-27 set). A person deciding what to do about their street needs to know
 * which of these came from the council, which the model worked out, and which
 * they themselves supposed — because only the first is a fact about the world,
 * and the last is a fact about them.
 */
export type Basis = 'recorded' | 'derived' | 'assumption';

export const BASIS_LABELS: Readonly<Record<Basis, string>> = {
  recorded: SOURCE.recorded,
  derived: SOURCE.derived,
  assumption: SOURCE.setting,
};

export const BASIS_COLOURS: Readonly<Record<Basis, { background: string; color: string }>> = {
  recorded: { background: '#dcece6', color: '#1f5b4e' },
  derived: { background: '#dde8f2', color: '#2a5678' },
  assumption: { background: '#f6ecd8', color: '#7a5a1e' },
};

/**
 * What is missing or uncertain in every comparison this product makes.
 *
 * AC 2.3.1.e (Aug-27 set). Each line is a limitation of the data or the model that a
 * reasonable person would want to know before acting, and each is measured
 * rather than hedged — a caveat with no number in it is decoration.
 */
/**
 * The ground-surface limitation, with the measured share of *this* window.
 *
 * It said 52.1% for every comparison, which is Kensington's figure; across the
 * council a window runs from mostly measured parkland to mostly interpolated
 * towers. Null when the share is not known says so rather than borrowing one.
 */
export function groundUncertainty(measuredShare: number | null): { readonly title: string; readonly body: string } {
  const how =
    measuredShare === null
      ? 'so part of this area was measured directly'
      : `so ${(measuredShare * 100).toFixed(1)}% of the ground in this one-kilometre calculation window was measured directly`;
  return {
    title: 'Ground height is estimated from aerial photographs, not surveyed',
    body: `It is photogrammetric — calculated from overlapping aerial photographs rather than a laser or ground survey — ${how}, and the rest, under roofs and tree canopy, is interpolated from the nearest measured ground.`,
  };
}

export const WHAT_IS_UNCERTAIN: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'How much water a drain takes is set by the model',
    body: 'The model sets a clear drain to take in 60% of the water reaching it. The council record does not describe the pit opening or grate condition, so this figure is a model setting and not a measurement.',
  },
  groundUncertainty(null),
  {
    title: 'The recorded drainage network has gaps',
    body: 'Some pipes stop without the record saying where they go. Those gaps are shown as gaps rather than joined up, so a path that ends may be the end of the record rather than the end of the drainage.',
  },
  {
    title: 'Pipe depth is not used at all',
    body: 'Depth is missing for almost every pit in this area, so nothing here models what happens underground: not pipe capacity, not a blockage below the surface, and not whether a pipe is adequate.',
  },
];

/** How the comparison was produced, in the order it happened. */
export const HOW_IT_WAS_PRODUCED: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Your selections',
    body: 'The drainage pit, the drain setting and the total rainfall you chose.',
  },
  {
    title: 'Local information used',
    body: 'Ground height estimated from aerial imagery, the low areas calculated from it, and the drain pits and pipes in council records.',
  },
  {
    title: 'How the two settings are compared',
    body: 'The same total rainfall is calculated twice — once with every drain clear, once with your drain setting — and only the difference is shown.',
  },
  {
    title: 'How to read it',
    body: 'Only places where more water remains than with a clear drain are highlighted. Nothing here is a depth.',
  },
  {
    // AC 3.3.1.e: the simplifications, with their numbers.
    title: 'How the model simplifies things',
    body: 'The total rainfall is added evenly across the area, with no duration or intensity, and runs downhill over the estimated ground. A clear drain takes 60% of the water reaching it, a partly blocked one half of that, and a fully blocked one none; only the selected drain changes. Each rainfall amount is calculated from dry ground, and a change smaller than 0.05 m³ in a one-metre square is not reported.',
  },
];
