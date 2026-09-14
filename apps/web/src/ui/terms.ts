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

/** Where a piece of information comes from. */
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
  limited: 'Limited ground data',
} as const;

export const FULL_MAP = 'Full map';

/**
 * What the site covers, said once.
 *
 * The drainage record, the calculated layers and the ground height cover the
 * City of Melbourne when the database answers, and the Kensington square
 * kilometre bundled with the site when it does not. The address search is
 * Kensington's. The flood history is Greater Melbourne.
 */
export const COVERAGE = {
  map: 'This map covers the City of Melbourne. It does not cover the rest of Greater Melbourne.',
  addresses: 'Address search covers Kensington only.',
  history: 'Flood history covers Greater Melbourne.',
} as const;

export const TOTAL_RAINFALL = 'Total rainfall';

/** The flood map's two views. */
export const FLOOD = {
  callouts: 'Recorded SES flood call-outs',
  rate: 'SES flood call-outs per 1,000 residents',
  /** The unit written beside a count, once the heading has said whose call-outs. */
  unit: 'call-outs',
  unitOne: 'call-out',
  /** The unit written beside a rate. */
  rateUnit: 'call-outs per 1,000 residents',
} as const;

/** Words the review asked to be gone from what a resident reads. */
export const RETIRED_TERMS: readonly string[] = [
  'Official recorded data',
  'System-derived result',
  'all-clear baseline capture',
  'Indicative local information',
  'totals are floors',
  'Severity Score',
];
