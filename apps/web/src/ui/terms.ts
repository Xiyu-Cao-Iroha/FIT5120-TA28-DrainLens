/**
 * One name for each thing, everywhere it is named.
 *
 * The front-end copy review of 14 September found the same concept under two or
 * three names across the site — *Official recorded data* on a badge and
 * *recorded by the council* in the legend beside it, *Water flow* on a chip and
 * *surface-water paths* in the guide, *the whole map*, *Full map* and *Whole
 * Map* for one button. A reader cannot tell whether two names are one thing.
 *
 * Badges, buttons, legends, body text and aria-labels read these. A test holds
 * the old names out of the source.
 */

/**
 * Where a piece of information comes from, as the blocked-drain comparison
 * groups its result.
 *
 * **Not a badge on the map's cards any more.** Copy audit v2 (15 September,
 * #30, #60, #61, #63, #85) removed the coloured badges: seven on one screen
 * were the noise the audit found. Copy audit v4 brought the distinction back
 * on screen, because AC 1.1.4, 1.1.7, 1.2.1, 1.3.1, 4.1.3 and 4.3.4 ask for
 * recorded and calculated information to be told apart where it is shown, but
 * as quiet grey links rather than badges: *From council records ›* and
 * *Estimated by DrainLens ›* on the map legend's groups and the popups, *Past
 * records ›*, *Our calculation ›* and *Checked by our team ›* in the flood
 * area panel. Those labels are `SOURCE_LINKS` in `ui/sources.ts`, and each
 * opens its section of About the data. The comparison, which was outside both
 * audits, still uses these three.
 */
export const SOURCE = {
  recorded: 'Council record',
  derived: 'Calculated by DrainLens',
  setting: 'Your setting',
} as const;

/** The map's layers, as buttons and the legend name them. */
export const LAYER = {
  pits: 'Drain pits',
  pipes: 'Drain pipes',
  paths: 'Likely water paths',
  lowAreas: 'Low areas',
  ground: 'Ground height',
  limited: 'Ground data gaps',
} as const;

/**
 * Where the map's information comes from, as a sentence.
 *
 * The map legend said these under *About this data* after copy audit v2; its
 * source groups replaced them in v4 (#61). The pit card's technical details
 * still open with the first.
 */
export const PROVENANCE = {
  recorded: 'Drain and pipe locations come from City of Melbourne records.',
  derived: 'Water paths, low areas and ground height are estimated by DrainLens.',
} as const;

export const FULL_MAP = 'Full map';

/**
 * What the site covers, said once.
 *
 * The drainage record, the calculated layers, the ground height and the
 * address search cover the City of Melbourne when the database answers, and the
 * Kensington square kilometre bundled with the site when it does not. The flood
 * history is Greater Melbourne.
 */
export const COVERAGE = {
  map: 'Current map scope: City of Melbourne',
  addresses: 'Address search covers the City of Melbourne.',
  /** When the map fell back to Kensington, the addresses beyond it went with it. */
  addressesFallback:
    'The full council map is not available right now, so address search covers only one square kilometre of Kensington.',
  history: 'Flood history covers Greater Melbourne.',
} as const;

export const TOTAL_RAINFALL = 'Total rainfall';

/**
 * The flood history's words.
 *
 * **Emergency responses, not call-outs** (copy audit v2, appendix B). The
 * audit found *call-outs* was not a word residents use, and *SES* was never
 * spelled out. Each page writes `ses` the first time it names the service and
 * `explain` beside the first count.
 *
 * **`explain` is copy audit v4's sentence**, and it is accurate. v2's audit
 * suggested *each crew sent counts as one emergency response*, and the
 * publisher's data quality statement says the opposite: the figures *preclude
 * multiple crew attendances at any one incident*, so a job that drew four
 * crews counts once (docs/FLOOD-HISTORY-DATA.md). v2 therefore wrote a longer
 * sentence spelling that out. v4's *a time the SES was sent to help* is one
 * dispatch to one job, which is what one count is, and it says nothing about
 * how many crews went, so it cannot be read as one count per crew.
 */
export const FLOOD = {
  /** The view and ranking toggles. */
  callouts: 'Total emergency responses',
  rate: 'Emergency responses per 1,000 people',
  /** The unit written beside a count. */
  unit: 'emergency responses',
  unitOne: 'emergency response',
  /** The unit written beside a rate. */
  rateUnit: 'emergency responses per 1,000 people',
  /** The service, in full, the first time a page names it. */
  ses: 'Victoria State Emergency Service (SES)',
  explain: 'Each one is a time the SES was sent to help.',
  /** The six financial years, as a resident reads a span. */
  period: '2009 to 2015',
  /** The legend's title, once the page has spelled the SES out. */
  legend: 'SES emergency responses, 2009 to 2015',
  /** A total some of whose parts were withheld. */
  atLeast: 'At least this many (some counts hidden)',
} as const;

/** Words the review asked to be gone from what a resident reads. */
export const RETIRED_TERMS: readonly string[] = [
  'Official recorded data',
  'System-derived result',
  'all-clear baseline capture',
  'Indicative local information',
  'totals are floors',
  'Severity Score',
  // Copy audit v2, 15 September.
  'call-out',
  'Call-out',
  'Limited ground data',
  'Minimum total',
  'exact count not published',
  'Waiting for you to try it',
];
