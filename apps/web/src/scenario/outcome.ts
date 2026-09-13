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

export type Action =
  | 'change-scenario'
  | 'choose-another-pit'
  | 'change-address'
  | 'return-to-map'
  | 'try-again'
  | 'review-scenario';

export const ACTION_LABELS: Readonly<Record<Action, string>> = {
  'change-scenario': 'Change scenario',
  'choose-another-pit': 'Choose another pit',
  'change-address': 'Change address',
  'return-to-map': 'Return to full map',
  'try-again': 'Try again',
  'review-scenario': 'Review scenario',
};

export interface Presentation {
  /** The heading over the whole result. */
  readonly title: string;
  /** The small label above the finding. */
  readonly band: string;
  readonly finding: string;
  readonly body: string;
  /** What goes in the summary's Comparison field. */
  readonly comparison: string;
  readonly actions: readonly Action[];
  /** Whether a difference is drawn on the map at all. */
  readonly showsDifference: boolean;
}

const COMPARISON_TITLE = 'Difference from the all-clear baseline';

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
    band: 'HIGHER THAN BASELINE',
    finding: 'Higher surface water build-up appears near the selected low point',
    body: 'In this comparison, less water enters the selected drain and more remains on the surface near the highlighted low area.',
    comparison: 'Higher than baseline',
    actions: ['change-scenario', 'return-to-map'],
    showsDifference: true,
  },
  'no-clear-change': {
    title: COMPARISON_TITLE,
    // "No clear change", not "No clear difference": AC 3.1.3.e names the two
    // bands, and the words on screen should be the words in the criteria and
    // in the explanation beside them.
    band: 'NO CLEAR CHANGE',
    finding: 'No clear change under these assumptions',
    body: 'At this accumulated rainfall amount, the selected assumptions do not produce a clear change from the all-clear baseline.',
    comparison: 'No clear change',
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
    band: 'TERRAIN UNAVAILABLE',
    finding: 'Terrain data is unavailable for this area',
    body: 'Changing the drainage pit will not fix this. Too little ground was measured around here to route water over. Return to the map or choose another supported address.',
    comparison: 'Not calculated',
    actions: ['change-address', 'return-to-map'],
    showsDifference: false,
  },
  invalid_inlet: {
    title: INSUFFICIENT_TITLE,
    band: 'DRAIN RECORD UNAVAILABLE',
    finding: 'Required inlet records are missing or invalid',
    body: 'Choose another recorded drainage pit. The official identifier for this one remains visible; the fields we do not hold stay marked unavailable rather than being filled in.',
    comparison: 'Not calculated',
    actions: ['choose-another-pit', 'review-scenario'],
    showsDifference: false,
  },
  scenario_calculation_failed: {
    title: INSUFFICIENT_TITLE,
    band: 'CALCULATION FAILED',
    finding: 'We could not complete this comparison',
    body: 'Your selected rainfall and blockage assumptions are still here. Try again, or review the scenario.',
    comparison: 'Failed',
    actions: ['try-again', 'review-scenario'],
    showsDifference: false,
  },
  comparison_not_comparable: {
    title: INSUFFICIENT_TITLE,
    band: 'RESULTS NOT COMPARABLE',
    finding: 'These two scenario runs cannot be compared',
    body: 'The blocked and all-clear runs were not produced from the same usable inputs. Review the assumptions and run the comparison again at the same accumulated rainfall.',
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
  'This is an indicative comparison between two assumptions. It is not a live flood prediction, and it does not show measured flood depth or when water would reach a location.';

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
    title: 'The drains below this one take the water instead',
    body: 'The recorded network here has enough inlets that water passing one blocked drain is captured within the next few. Blocking a single drain moves very little water.',
  },
  {
    title: 'What does get past spreads out',
    body: 'Water that reaches a low area spreads across all of it. A blocked drain can add real volume and still raise the surface by less than a millimetre, which is not something to act on.',
  },
  {
    title: 'We will not report a difference finer than the ground data',
    body: 'The ground surface is measured from aerial photography to about 25 centimetres. A calculated change smaller than that is below what the data can support, so it is reported as no clear difference rather than as a number.',
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
  'This shows how the comparison changes as rainfall accumulates. It does not show when water would reach a location. A change need not grow steadily with rainfall: it can appear at one amount and not at the next, as low areas fill and overflow.';

/**
 * What accumulated rainfall is in this model, wherever an amount is chosen.
 *
 * AC 3.2.3.c, d and e: a simplified total, no intensity or duration, and not
 * a forecast of any storm. The model adds one depth of water evenly over the
 * area and routes it; how hard it fell and for how long are not inputs at all.
 */
export const RAINFALL_EXPLAINED =
  'Accumulated rainfall here is a simplified total: the same depth of water added evenly across the area. The scenario does not model how intense the rain is or how long it lasts, and 20, 40 and 60 mm are comparison amounts, not a weather forecast or a prediction of a future storm.';

/**
 * What "No clear change" means, said outright beside the finding.
 *
 * AC 3.3.2.h and 3.1.3.f. This is the sentence that makes a null result honest
 * rather than reassuring, which is why it is not inside a collapsed section:
 * the audit on 13 September found it was not on the screen at all.
 */
export const NO_CLEAR_CHANGE_MEANS =
  'No clear change means this simplified calculation did not identify a clear difference from the all-clear baseline. It does not mean the selected drain has no blockage or flood concern, or that a blockage would have no effect in a real flood.';

/**
 * Everything the comparison cannot tell a person, AC 3.3.2 a to i, in order.
 *
 * Kept as one list so the criteria can be checked against it line by line.
 */
export const LIMITATIONS: readonly string[] = [
  'The blockage condition is an assumption you chose, not an observation of the drain.',
  'Accumulated rainfall is an input you chose, not a weather observation or forecast.',
  'The model does not work out the rainfall amount at which a drain would fail.',
  'Actual pipe hydraulic capacity is not modelled.',
  'The result does not show a validated flood depth or water depth.',
  'It does not estimate when floodwater would arrive.',
  'It does not give a flood probability or a risk score.',
  NO_CLEAR_CHANGE_MEANS,
  'It only shows differences from the all-clear baseline, within the area the ground surface covers around the selected drain.',
];

/**
 * How strongly to read a result, AC 3.3.3.d.
 */
export const HOW_STRONGLY_TO_READ_IT =
  'Read this as a comparison between two assumptions on an approximate ground surface. Higher than baseline says where, in this model, the blockage leaves more water on the surface — not how much, and not that it would flood. No clear change says the model could not separate the two runs — not that the drain does not matter.';

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
  recorded: 'Official recorded data',
  derived: 'System-derived result',
  assumption: 'Your assumption',
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
    title: 'The ground surface is derived from imagery, not survey',
    body: `It is photogrammetric — calculated from overlapping aerial photographs rather than a laser or ground survey — ${how}, and the rest, under roofs and tree canopy, is interpolated from the nearest measured ground.`,
  };
}

export const WHAT_IS_UNCERTAIN: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'How much water a drain takes is assumed',
    body: 'The model assumes a clear drain captures 60% of the water reaching it. The council record does not describe inlet geometry or grate condition, so this figure is an assumption and not a measurement.',
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
    body: 'The drainage pit, the blockage assumption and the accumulated rainfall amount you chose.',
  },
  {
    title: 'Local information used',
    body: 'A ground surface derived from aerial imagery, the low points measured on it, and the recorded public drainage network.',
  },
  {
    title: 'Controlled comparison',
    body: 'The same rainfall is run twice — once with every drain clear, once with your blockage assumption — and only the difference is shown.',
  },
  {
    title: 'How to read it',
    body: 'Only locations where more water remains than in the all-clear baseline are highlighted. Nothing here is a depth.',
  },
  {
    // AC 3.3.1.e: the simplifications, with their numbers.
    title: 'Simplified assumptions',
    body: 'Rain is added evenly across the area and runs downhill over the ground surface. A clear drain takes 60% of the water reaching it, a partly blocked one half of that, and a fully blocked one none; only the selected drain changes. Each rainfall amount is calculated from dry ground, and a change smaller than 0.05 m³ in a one-metre square is not reported.',
  },
];
