/**
 * The five problems a reader can report, and who each one goes to.
 *
 * Epic 6's reporting pathway, as the team's Figma draws it (file
 * `atD5fleOrhvMjJ5m0pXYGt`, screens B3 to B5). AC 6.3.1 names five problems
 * and this module holds exactly those five: a sixth would be this project
 * deciding what somebody's problem is.
 *
 * **The emergency is first and it looks like it.** The design puts it at the
 * top of the list in red, and its own screen is two telephone numbers before
 * anything else. AC 6.3.4 asks for that order; a list that reads blocked
 * drain, grate, property, creek, emergency buries the one that cannot wait
 * under four that can.
 *
 * **DrainLens prepares the report. It does not send it.** AC 6.3.2 says so and
 * `NOT_SUBMITTED` is the sentence; there is no submit button anywhere in Epic
 * 6 and no request leaves the browser.
 *
 * **An organisation is named only after the reader has chosen something.** AC
 * 6.2.3 and 6.3.2 both: nothing is selected for them, no drain is attached to
 * a report because it happens to be nearby, and *Which drain* only names one
 * where the reader picked it on the map.
 *
 * **Nothing here says what will happen next.** No response time, no outcome,
 * no repair. Those pages publish response times and this one does not repeat
 * them: a page that says when somebody will come is making a promise on
 * another organisation's behalf.
 */

import { type ReportPlace, placeLine, placeTitle } from './place.js';
import {
  COUNCIL_FORM,
  COUNCIL_URGENT,
  type Channel,
  LICENSED_PLUMBER,
  MELBOURNE_WATER,
  TRIPLE_ZERO,
  VICSES,
} from './channels.js';

/** The five, as AC 6.3.1 names them and the design labels them. */
export type ProblemId =
  | 'emergency'
  | 'blocked-drain'
  | 'damaged-grate'
  | 'private-property'
  | 'waterway';

export interface ProblemType {
  readonly id: ProblemId;
  /** As the reader picks it, in the design's words. */
  readonly label: string;
  /** Where it goes. The first is the one to use. */
  readonly channels: readonly Channel[];
  /** Why it goes there, said as a boundary rather than as a rule. */
  readonly because: string;
  /** Life safety comes before any of the rest of this (AC 6.3.4). */
  readonly urgent: boolean;
}

/** One line of *What to include*: what it is, and what to have ready. */
export interface IncludeItem {
  readonly id: string;
  readonly title: string;
  /** Filled in for the reader where the product already knows it. */
  readonly detail: string;
}

/** The heading over that list, as the design writes it. */
export const WHAT_TO_INCLUDE = 'What to include';

/**
 * What to have ready, whoever it goes to (AC 6.3.2).
 *
 * `location` carries the reader's address where there is one, because it is
 * the first thing every one of these organisations asks for and the product
 * already knows it.
 */
export function whatToInclude(address: string | null, place: ReportPlace): readonly IncludeItem[] {
  return [
    {
      id: 'location',
      title: 'Location',
      detail: address === null || address === '' ? 'The street address or nearest cross street' : address,
    },
    { id: 'when', title: 'When', detail: 'Date and time you saw it' },
    { id: 'photos', title: 'Photos', detail: 'Taken from a safe place' },
    {
      id: 'drain',
      // AC 6.3.2: only where the reader selected one, and never the nearest.
      title: placeTitle(place),
      detail: placeLine(place),
    },
  ];
}

/** What this product does, and the part it does not do (AC 6.3.2). */
export const NOT_SUBMITTED = 'DrainLens does not send this report. Nothing leaves your browser.';

/** The same thing, said once on the screen where the reader is still choosing. */
export const NOT_SENT_YET = 'DrainLens helps you prepare a report. It does not send it for you.';

/** The five, emergency first (Figma B3, AC 6.3.4). */
export const PROBLEM_TYPES: readonly ProblemType[] = [
  {
    id: 'emergency',
    label: 'Flood or storm emergency',
    channels: [TRIPLE_ZERO, VICSES],
    because: 'An emergency is answered by the emergency services, not by a council form.',
    urgent: true,
  },
  {
    id: 'blocked-drain',
    label: 'Blocked or flooded street drain',
    channels: [COUNCIL_FORM, COUNCIL_URGENT],
    because: 'Pits and drains in public roads are the council’s to maintain.',
    urgent: false,
  },
  {
    id: 'damaged-grate',
    label: 'Damaged or missing drain grate',
    channels: [COUNCIL_URGENT, COUNCIL_FORM],
    because: 'An open pit in a public street is a hazard, and the council holds it.',
    urgent: false,
  },
  {
    id: 'private-property',
    label: 'Drainage problem on my property',
    channels: [LICENSED_PLUMBER],
    because:
      'Stormwater on your property, and the connection from it to the council’s network, is the property owner’s to manage.',
    urgent: false,
  },
  {
    id: 'waterway',
    label: 'Problem with a creek or main drain',
    channels: [MELBOURNE_WATER],
    because: 'Melbourne Water holds the regional drains and waterways.',
    urgent: false,
  },
];

/** One problem type by its id. */
export const problemFor = (id: ProblemId): ProblemType =>
  PROBLEM_TYPES.find((type) => type.id === id) ?? PROBLEM_TYPES[0]!;

/** The heading over the whole pathway, as the design names it. */
export const REPORT_HEADING = 'Report a problem';

/** The step the reader is on first. */
export const CHOOSE_PROBLEM = 'What is the problem?';

/** The way back from a chosen problem to the five. */
export const CHOOSE_ANOTHER = 'Choose another problem';

/** One telephone number, as the emergency screen shows it (Figma B5). */
export interface EmergencyCall {
  readonly label: string;
  readonly when: string;
  /** The first one is the one to ring if the answer is not obvious. */
  readonly first: boolean;
}

/** The two numbers, above everything else on that screen (AC 6.3.4). */
export const EMERGENCY_CALLS: readonly EmergencyCall[] = [
  { label: 'Call 000', when: 'If life is in danger', first: true },
  { label: 'Call VICSES 132 500', when: 'For flood and storm help', first: false },
];

/** And what not to do, in VICSES's own terms. */
export const EMERGENCY_SAFETY: readonly string[] = [
  'Never walk or drive into floodwater.',
  'Do not go near or clear drains during heavy rain.',
];

/** Where current warnings live, which this product is not (AC 6.3.4). */
export const EMERGENCY_WARNINGS = 'For current warnings, check VicEmergency';
