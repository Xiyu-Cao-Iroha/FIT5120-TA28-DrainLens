/**
 * What the flood map's area panel says about its own evidence, on its face.
 *
 * Written as data rather than inline in the map, for the same reason as
 * `scenario/outcome.ts`: these are the sentences that decide whether a count
 * reads as a flood, a rate reads as a risk, or an empty events list reads as
 * a clean history. They are asserted in `evidence.test.ts`.
 *
 * **The long explanations left this file** (copy audit v4, #83, #85, #87).
 * Where the counts come from, the years, the privacy withholding, how the rate
 * is worked out and the three things it is not were about fifteen paragraphs
 * under *More information* in the panel. They are the *Flood history*,
 * *Emergency responses per 1,000 people* and *Checked flood events* sections
 * of About the data now (`ui/sources.ts`), which the panel links to. AC 4.3.1
 * to 4.3.4 ask for them "when the user opens the evidence explanation", and
 * that page is the explanation. What stays here is what the panel shows
 * without being opened.
 */

import type { SourceLinkId } from '../ui/sources.js';
import { FLOOD } from '../ui/terms.js';

/**
 * The one safety line across the top of the map, in both modes (4.1.1.e,
 * 4.1.2.g, 4.3.4.d).
 *
 * Copy audit v2 and v4, #81: *past data only, not a forecast*, after
 * `FLOOD.explain`.
 */
export const NOT_A_FORECAST = 'Past data only, not a forecast.';

/**
 * The ⓘ beside an area's total (copy audit v4, #86): what one count is, and
 * that it is not one flood. Built from `FLOOD.explain` so the two cannot drift.
 */
export const TOTAL_TIP = `${FLOOD.explain.replace(/\.$/, '')}, not one flood.`;

/**
 * The ⓘ beside an area's population (copy audit v4, #87; AC 4.1.3, 4.1.4):
 * the rate is ours, made from two published sources, and the population is
 * what it is divided by, not who was affected.
 */
export const RATE_TIP =
  'Our calculation, from SES records and Australian Bureau of Statistics population figures. The population is not the number of people affected.';

/**
 * AC 4.3.4: the three kinds of information in the area panel, kept apart.
 *
 * Each section of the panel is labelled by a grey link rather than a coloured
 * badge (copy audit v4, #85): *Past records ›* over the counts, *Our
 * calculation ›* over the rate and *Checked by our team ›* over the events,
 * each opening its own section of About the data.
 */
export const AREA_KINDS: Readonly<Record<'recorded' | 'calculated' | 'checked', SourceLinkId>> = {
  recorded: 'pastRecords',
  calculated: 'calculation',
  checked: 'checked',
};
