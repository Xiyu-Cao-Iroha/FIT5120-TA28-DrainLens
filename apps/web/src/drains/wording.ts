/**
 * Every sentence the street-drains panel says (Figma S1–S4).
 *
 * Kept away from the screen for the reason the other registers are: these are
 * claims about a public dataset and about what is safe to do at a drain, and a
 * reviewer has to be able to read them without reading React.
 */

import { DRAIN_RADIUS_M, STREET_MATCH_M } from './nearby.js';

export const STREET_DRAINS_HEADING = 'Street drains near you';

/** The step this is, in the plan it was opened from. */
export const STREET_DRAINS_STEP = 'Step 3 of 3';

export const BACK_TO_PLAN = 'Back to my plan';

/**
 * The count, and the sentence that stops it being read as a shortlist.
 *
 * *This is every recorded drain nearby, not a selection* is the whole reason
 * the panel can show a list at all: a list of drains with no such line reads
 * as the drains that matter, which is a judgement nothing here has made.
 */
export const drainCount = (total: number, address: string): string =>
  `${String(total)} recorded street drain${total === 1 ? '' : 's'} within ${String(DRAIN_RADIUS_M)} m of ${address}. This is every recorded drain nearby, not a selection.`;

/** Where the records come from, said on the drain itself (Figma S2). */
export const DRAIN_SOURCE = 'Recorded in the City of Melbourne Stormwater Pits dataset.';

export const DRAIN_BLOCKED_QUESTION = 'Looks blocked or damaged?';
export const REPORT_THIS_DRAIN = 'Report this drain';

/**
 * What a resident may safely do at a grate, and the four things they may not.
 *
 * Folded, because it is advice about a thing the reader may not have decided
 * to do yet; its first line is the offer and the rest is the boundary. Both
 * halves are the design's own words. The prohibitions are the same ones the
 * plan's safety boundary carries -- never lift a cover, never stand in the
 * road -- said here where somebody is looking at a particular grate.
 */
export const SWEEP_SUMMARY = 'Leaves or litter on top of the grate? You can sweep them away…';

/**
 * The rest of the sentence, not the sentence again.
 *
 * It opened by repeating the summary word for word, so the fold read as the
 * same note printed twice. The summary ends on an ellipsis and this picks it
 * up: what is already on the screen is not said a second time.
 */
export const SWEEP_DETAIL =
  'Sweep them when it is dry and you can stay on the footpath. Never lift the cover, reach inside, or stand in the road. If it still looks blocked, report it.';

/** When no drain carries the reader's own street name (Figma S3). */
export const noOwnStreet = (street: string): string =>
  `No recorded drain is labelled with ${street}, so the street with the most drains is shown first.`;

/** When the ring holds no recorded drain at all (Figma S4). */
export const noDrains = (address: string): string =>
  `No recorded street drain was found within ${String(DRAIN_RADIUS_M)} m of ${address}.`;

export const NO_DRAINS_STILL = 'Your home checklist still applies. Go back to your plan to keep preparing.';

/** The group that holds the drains no address was near enough to name. */
export const OTHER_DRAINS = 'Other drains near you';

export const OTHER_DRAINS_WHY = `Other drains near you have no street name within ${String(STREET_MATCH_M)} m. Tap a drain to report it.`;

/** The roll-up over every street the panel does not name. */
export const moreStreets = (count: number): string =>
  `${String(count)} more street${count === 1 ? '' : 's'}, largest first`;
