/**
 * What every home can do, and the safety boundary around all of it.
 *
 * AC 5.2.3 asks for three to four general actions, each one short specific
 * sentence, and the Epic 5 definition of done asks for them to be traceable to
 * official guidance recorded in a register. So each one here carries the
 * sentence it came from, the publisher, the page and the date it was read —
 * **nothing in this file is advice this project invented**, and the quotes are
 * what a reviewer checks it against.
 *
 * Read from the Victoria State Emergency Service's own pages on 2 October
 * 2026. The design (Figma, *Get ready for heavy rain*) shows a fourth,
 * *Move valuable items above floor level*; no official page was found carrying
 * it on the day, so it is not here. Three is within what the criterion asks
 * for, and the register records the fourth as waiting for a source rather than
 * shipping it on the strength of a mock-up.
 *
 * **These are not a flood plan.** AC 5.3.3 sets the boundary and `SAFETY`
 * carries it: not a warning service, not a forecast, and never a reason to
 * enter floodwater or lift a drain cover.
 */

/** One general action, with where its wording comes from. */
export interface GeneralAction {
  readonly id: string;
  /** One short sentence, as the plan shows it. */
  readonly text: string;
  /** The sentence it was taken from, for the register and for review. */
  readonly quote: string;
  readonly publisher: string;
  readonly page: string;
  /** When the page was read, `YYYY-MM-DD`. */
  readonly checked: string;
}

const VICSES_STORM = 'https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/storm';

export const GENERAL_ACTIONS: readonly GeneralAction[] = [
  {
    id: 'gutters',
    text: 'Clean gutters, downpipes and drains when it is safe to do so.',
    quote: 'Clean your gutters, downpipes and drains to ensure they are not blocked.',
    publisher: 'Victoria State Emergency Service',
    page: VICSES_STORM,
    checked: '2026-10-02',
  },
  {
    id: 'loose-items',
    text: 'Secure loose outdoor items, such as furniture and umbrellas.',
    quote:
      'Check that loose items such as outdoor furniture, umbrellas and trampolines are safely secured.',
    publisher: 'Victoria State Emergency Service',
    page: VICSES_STORM,
    checked: '2026-10-02',
  },
  {
    id: 'parking',
    text: 'Park under cover or away from trees.',
    quote: 'Park your car under cover or away from trees.',
    publisher: 'Victoria State Emergency Service',
    page: VICSES_STORM,
    checked: '2026-10-02',
  },
];

/** The heading over the plan itself, as the design writes it. */
export const PREPARE_HEADING = 'Prepare for heavy rain';

/**
 * The safety boundary, said in full wherever the plan is read (AC 5.3.3).
 *
 * Six statements, in the criterion's own order. The last two are the numbers,
 * and they are the only numbers in this product a person might need in a
 * hurry: they are never folded away.
 */
export const SAFETY: readonly string[] = [
  'DrainLens is not a live flood warning or a weather forecast.',
  'The map information does not determine whether a property will flood.',
  'Monitor VicEmergency and official weather information when heavy rain is expected.',
  'Never enter floodwater, lift drain covers or interfere with public drainage.',
  'Call VICSES on 132 500 for flood and storm assistance.',
  'Call Triple Zero (000) in a life-threatening emergency.',
];

/** Where current warnings live, which this product is not (AC 5.2.3). */
export const VICEMERGENCY = {
  label: 'VicEmergency',
  href: 'https://emergency.vic.gov.au/respond/',
} as const;

/**
 * What the reviewed count is not (AC 5.4.1, AC 5.2.3).
 *
 * A number that counts decisions can be read as a score for how safe somebody
 * is, and the criteria forbid presenting it as one twice. Saying so is
 * cheaper than hoping the layout carries it.
 */
export const NOT_A_SCORE =
  'This counts the places you have reviewed. It is not a safety or readiness score.';

/** Reporting is its own path, not a preparation action (AC 5.2.3, 5.3.2). */
/**
 * The *Ask about getting ready* slot, at the foot of the plan (Figma AI1).
 *
 * The prompt is the design's. `ASK_COMING` is what stands where the control
 * will go: the assistant is being built separately, against the retrieval
 * prototype in `assistant/`, and until there is a panel behind it a link
 * that opens nothing would be worse than saying so.
 */
export const ASK_PROMPT = 'Have a question about getting ready?';
export const ASK_COMING = 'Coming soon';

export const REPORT_PATHWAY = 'Report a drainage problem';

/*
  There is no *Who can help* line against a nearby place, and there is no
  constant for one.

  AC 6.2.3 says a preparation action is the reader's own and never an
  organisation's, which read like an instruction to write *You or your
  household* under each reminder -- and that is what the plan did for a day.
  AC 5.2.3 and AC 5.3.2 both forbid exactly that line against a nearby place.
  Naming nobody satisfies all three: no organisation is named because a pit
  happens to be nearby, and the reader is not told that the thing they just
  agreed to do is theirs to do.
*/
