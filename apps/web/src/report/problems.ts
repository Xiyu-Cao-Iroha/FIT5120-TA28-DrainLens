/**
 * The five problems a reader can report, and who each one goes to.
 *
 * AC 6.3.1 names the five and this module holds exactly those five: a sixth
 * would be this project deciding what somebody's problem is. Each carries one
 * official channel from `channels.ts`, what to prepare before contacting
 * them, and the boundary that explains why it goes there rather than
 * somewhere else.
 *
 * **DrainLens prepares the report. It does not send it.** AC 6.3.2 says so and
 * `NOT_SUBMITTED` is the sentence; there is no submit button anywhere in Epic
 * 6 and no request leaves the browser. What the reader gets is a summary they
 * carry to the organisation themselves.
 *
 * **An organisation is named only after the reader has chosen something.** AC
 * 6.2.3 and 6.3.2 both: nothing is selected for them, no drain is attached to
 * a report because it happens to be nearby, and *Selected recorded drain* only
 * appears where the reader picked one on the map.
 *
 * **Nothing here says what will happen next.** No response time, no outcome,
 * no repair. Those pages publish response times and this one does not repeat
 * them: a page that says when somebody will come is making a promise on
 * another organisation's behalf.
 */

import {
  COUNCIL_FORM,
  COUNCIL_URGENT,
  type Channel,
  LICENSED_PLUMBER,
  MELBOURNE_WATER,
  TRIPLE_ZERO,
  VICSES,
} from './channels.js';

/** The five, as AC 6.3.1 names them. */
export type ProblemId =
  | 'blocked-drain'
  | 'damaged-grate'
  | 'private-property'
  | 'waterway'
  | 'emergency';

export interface ProblemType {
  readonly id: ProblemId;
  /** As the reader picks it. */
  readonly label: string;
  /** One line, so a reader can tell two of them apart before choosing. */
  readonly describes: string;
  /** Where it goes. The first is the one to use. */
  readonly channels: readonly Channel[];
  /** Why it goes there, said as a boundary rather than as a rule. */
  readonly because: string;
  /** Life safety comes before any of the rest of this (AC 6.3.4). */
  readonly urgent: boolean;
}

/** What to have ready, whoever it goes to (AC 6.3.2). */
export const PREPARE: readonly string[] = [
  'Where it is: the street address or the nearest cross street.',
  'When you saw it: the date and the time.',
  'Photos, taken from a safe place, if you have them.',
];

/** The one thing a reader may add from the map, and only by choosing it. */
export const SELECTED_DRAIN = 'Selected recorded drain';

/** How that line reads once they have chosen one. */
export const selectedDrainLine = (assetNumber: string): string =>
  `${SELECTED_DRAIN}: ${assetNumber}`;

/** Said wherever a drain could be added, so an empty one is not a gap. */
export const NO_DRAIN_NEEDED =
  'You can report without choosing a drain. Nothing is chosen for you.';

/** What this product does, and the part it does not do (AC 6.3.2). */
export const NOT_SUBMITTED =
  'DrainLens prepares your report. It does not send it, and it does not tell you what will happen next.';

/** The five. Order is the criterion's order; the emergency leads its own screen. */
export const PROBLEM_TYPES: readonly ProblemType[] = [
  {
    id: 'blocked-drain',
    label: 'Blocked or flooded street drain',
    describes: 'A drain in a public street that is blocked, or water pooling around one.',
    channels: [COUNCIL_FORM, COUNCIL_URGENT],
    because: 'Pits and drains in public roads are the council’s to maintain.',
    urgent: false,
  },
  {
    id: 'damaged-grate',
    label: 'Damaged or missing grate',
    describes: 'A broken, loose or missing cover over a street drain.',
    channels: [COUNCIL_URGENT, COUNCIL_FORM],
    because: 'An open pit in a public street is a hazard, and the council holds it.',
    urgent: false,
  },
  {
    id: 'private-property',
    label: 'Private property',
    describes: 'Drainage inside your property, or between you and a neighbour.',
    channels: [LICENSED_PLUMBER],
    because:
      'Stormwater on your property, and the connection from it to the council’s network, is the property owner’s to manage.',
    urgent: false,
  },
  {
    id: 'waterway',
    label: 'Regional drain or waterway',
    describes: 'A main drain, creek or river rather than a street drain.',
    channels: [MELBOURNE_WATER],
    because: 'Melbourne Water holds the regional drains and waterways.',
    urgent: false,
  },
  {
    id: 'emergency',
    label: 'Flood or storm emergency',
    describes: 'Water entering a building, or anything putting someone in danger now.',
    channels: [TRIPLE_ZERO, VICSES],
    because: 'An emergency is answered by the emergency services, not by a council form.',
    urgent: true,
  },
];

/** One problem type by its id. */
export const problemFor = (id: ProblemId): ProblemType =>
  PROBLEM_TYPES.find((type) => type.id === id) ?? PROBLEM_TYPES[0]!;

/** The heading over the whole pathway, as every screen names it. */
export const REPORT_HEADING = 'Report a drainage problem';

/** The step the reader is on first. */
export const CHOOSE_PROBLEM = 'What is the problem?';

/** What an emergency reads before anything else (AC 6.3.4). */
export const EMERGENCY_FIRST =
  'If anyone is in danger, call Triple Zero (000) now. For flood or storm assistance, call VICSES on 132 500.';

/** And what not to do while waiting, in VICSES’s terms. */
export const EMERGENCY_SAFETY =
  'Never enter floodwater, and do not approach drains or open pits in heavy rain.';

/** That the checklist is for later, not now (AC 6.3.4). */
export const EMERGENCY_CHECKLIST_LATER =
  'Once everyone is safe, the details below help when you report the drain itself.';
