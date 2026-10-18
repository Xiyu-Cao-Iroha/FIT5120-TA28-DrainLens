/**
 * What the drainage-area card says, and the four sentences it chooses between.
 *
 * AC 6.1.2 gives one sentence per receiving class and forbids the fifth
 * sentence — the one that names a Melbourne Water drain because the area is
 * named after one. The choice is made from the published class, which the
 * pipeline's register leaves at `unclassified` until a team member has
 * approved the row, so until then every address reads the fourth sentence.
 * That is the criterion working, not a gap to fill in the interface.
 *
 * **Nothing here computes anything.** The numbers come from the artefact and
 * are formatted; the dates are read as they were published. AC 6.1.4 forbids
 * presenting either date as a survey date or the portal's metadata date as the
 * record's own, so each is labelled where it is shown and nothing is merged.
 */

import type { ReceivingClass, Subcatchment } from './artefact.js';

/** The heading, and what the whole card is about. */
export const DRAINAGE_AREA = 'Recorded subcatchment area';

/** The two chips Epic 6's guide asks the reader to press (Figma D1, D3). */
export const CATCHMENT_CHIP = 'Recorded subcatchment area';
export const HELP_CHIP = 'Who can help';

/** Who recorded the areas, said on the card (AC 6.1.1). */
export const AREA_SOURCE = 'Official record · Melbourne Water';

/**
 * What receives this area's water.
 *
 * The three classed sentences name the area; the fourth says the type is not
 * confirmed, which is what an unapproved classification means and what most
 * addresses read today.
 */
export function receivingLine(area: Subcatchment): string {
  switch (area.class) {
    case 'main-drain':
      return `This area is associated with the ${area.displayName}, a Melbourne Water drain.`;
    case 'waterway-section':
      return `This area drains to ${area.displayName}, a section of the waterway.`;
    case 'council-direct':
      return 'This area is recorded as council drainage discharging directly to a receiving waterway or bay.';
    case 'unclassified':
      return `This area is recorded as ${area.displayName}. The type of drain or waterway that receives its water has not been confirmed.`;
  }
}

/**
 * The sentence every class carries, whatever the area is.
 *
 * AC 6.1.2's last line: a subcatchment boundary says water from the area
 * reaches a destination, not that the pipe outside one house runs there. The
 * trace layer is where a single pipe's path is answered, and it answers it
 * pit by pit rather than by area.
 */
export const NOT_EVERY_PIPE =
  'This does not mean every pipe from this address connects directly to that drain or waterway.';

/** What sharing an area does not mean (AC 6.1.3). */
export const NOT_THE_SAME_RISK =
  'Sharing a drainage area does not mean sharing the same flood risk or the same local pipes.';

/** What the boundary is not (AC 6.1.4). */
export const BOUNDARY_LIMITS =
  'The boundary does not show a flood extent, individual pipe connections or who owns an asset.';

/** Why the record may be behind (AC 6.1.4). */
export const MAY_NOT_REFLECT_DEVELOPMENT =
  'The recorded drainage area may not reflect recent development.';

/** The address no recorded area contains (AC 6.1.5). */
export const NO_AREA_FOUND =
  'We could not find a recorded subcatchment area for this address. The records cover the City of Melbourne area.';

/**
 * And what is still worth doing (Figma B1-none).
 *
 * The card said the area could not be identified and stopped. The frame
 * offers the one thing an address with no recorded area can still do, which
 * is the same shape as the before-rain card's answer for an address with no
 * places: say the absence, then say what is left.
 */
export const NO_AREA_STILL = 'You can still report a drainage problem near this address.';

/**
 * What the card says before there is an address to answer about.
 *
 * Reported on 8 October: with the layer on and nothing searched, the card
 * said *could not be confidently identified for this address*, which is a
 * sentence about an address nobody had given. Two different absences --
 * nothing asked, and asked but not found -- and only one of them is the
 * product's limit.
 */
export const NO_ADDRESS_YET = 'Search for an address to see the area it drains with.';

/**
 * Why that is not a reason to offer the nearest one.
 *
 * The criterion forbids substituting it, and a screen that only says "could
 * not be identified" invites the next person to add the substitution as a
 * helpful touch.
 */
export const NO_AREA_MEANS =
  'The nearest area is not shown instead: it would name a drain this address is not recorded as draining to.';

/** The two dates, labelled apart (AC 6.1.4). */
export const RECORD_UPDATED = 'Record last updated';
export const LAYER_EDITED = 'Dataset layer last edited';

/**
 * When the published layer itself was last edited, from the portal's metadata.
 *
 * Shown beside the record's own date and never as it: they are different
 * things, the criterion says so twice, and this one moves when any area in
 * Melbourne Water's region changes.
 */
export const LAYER_EDITED_ON = '2025-02-10';

/** The year the card states, from the matched record's own date. */
export function recordYear(area: Subcatchment): string | null {
  const date = area.lastUpdated;
  if (date === undefined || !/^\d{4}-/.test(date)) return null;
  return date.slice(0, 4);
}

/** *This drainage-area record was last updated in 2013* (AC 6.1.4). */
export function updatedLine(area: Subcatchment): string | null {
  const year = recordYear(area);
  return year === null ? null : `This drainage-area record was last updated in ${year}.`;
}

/** A date as the panel writes it: 20 November 2013. */
export function dateLine(date: string | undefined): string | null {
  if (date === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? null;
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${String(day)} ${months[month - 1] ?? ''} ${String(year)}`;
}

/** An area in square kilometres, as the record has it. */
export function areaLine(area: Subcatchment): string | null {
  const size = area.areaSqKm;
  if (size === undefined) return null;
  return `${size.toFixed(2)} km²`;
}

/**
 * A pipe length, in the unit that keeps it readable.
 *
 * Kilometres to one decimal over a kilometre, metres below it. 96.4 km and
 * 940 m are both answers a person can picture; 96,432 m is not.
 */
export function pipeLengthLine(metres: number): string {
  if (metres >= 1_000) return `${(metres / 1_000).toFixed(1)} km`;
  return `${String(Math.round(metres))} m`;
}

/**
 * How much of the area the counts cover, in words, or null where they cover it.
 *
 * Only said when it matters: an area wholly inside the data needs no sentence,
 * and one two-thirds inside needs the reader to know before reading a pit
 * count as the area's total.
 */
export function coverageLine(area: Subcatchment): string | null {
  const share = area.summary?.coverage;
  if (share === undefined || share >= 0.995) return null;
  return `These counts cover about ${String(Math.round(share * 100))}% of this drainage area — the part inside the City of Melbourne data.`;
}

/** The counts' standing limitation, said whatever the coverage (AC 6.1.3). */
export const COUNTS_COVER =
  'Recorded pits, pipe length and low areas are from City of Melbourne data only.';

/** Whether any supported low area is inside (AC 6.1.3), in the card's words. */
export function lowAreasLine(area: Subcatchment): string {
  const count = area.summary?.lowAreas ?? 0;
  if (count === 0) return 'No low areas in the available coverage';
  if (count === 1) return '1 low area in the available coverage';
  return `${count.toLocaleString('en-AU')} low areas in the available coverage`;
}

/** The names of the wider catchments, for *More information* (AC 6.1.1). */
export function widerNames(area: Subcatchment): readonly { readonly label: string; readonly value: string }[] {
  return [
    ['Major catchment', area.majorName],
    ['Primary catchment', area.primaryName],
    ['River basin', area.basinName],
  ]
    .filter((pair): pair is [string, string] => typeof pair[1] === 'string' && pair[1] !== '')
    .map(([label, value]) => ({ label, value: titleCase(value) }));
}

/** `YARRA RIVER MAIN STREAM` as a reader would write it. */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map((word) => (word === 'to' || word === 'of' ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/**
 * The fold on the area card that says who looks after which part.
 *
 * Here rather than in the component because Epic 6's guide names it: its
 * third step is *Now open Why are there different organisations?* (Figma D3),
 * and a step that quotes a control has to quote the control.
 */
export const WHY_ORGANISATIONS = 'Why are there different organisations?';

/** What a class is called where the register's state is shown, not the sentence. */
export const CLASS_NAME: Readonly<Record<ReceivingClass, string>> = {
  'main-drain': 'Melbourne Water main drain',
  'waterway-section': 'Waterway section',
  'council-direct': 'Council drainage, direct to a waterway or bay',
  unclassified: 'Not confirmed',
};
