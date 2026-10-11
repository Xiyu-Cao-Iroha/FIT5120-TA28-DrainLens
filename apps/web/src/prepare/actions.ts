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
  /**
   * The photograph in the expanded tip, under `public/actions/`.
   *
   * The team's own, which is why there is one at all: the objection recorded
   * here until 8 October was to an **unlicensed** image of somebody's gutter,
   * and these are not that. `docs/IMAGE-CREDITS.md` is the record.
   */
  readonly photo: string;
}

const VICSES_STORM = 'https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/storm';
const VICSES_FLOOD = 'https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/flood';
const MELBOURNE_WATER_FLOODING =
  'https://www.melbournewater.com.au/water-and-environment/flooding-and-drainage/prepare-flooding';

/**
 * The four the design draws, each with the sentence it was taken from.
 *
 * **These were three until 8 October, and two of those three are gone.**
 * *Secure loose outdoor items* and *Park under cover or away from trees* are
 * storm advice, taken from the VICSES storm page when the design's own four
 * could not all be sourced; the design's set is about water in the house, and
 * the team chose it. Each of the three new ones carries an official sentence
 * now, so the reason the fourth was dropped on 2 October -- *no official page
 * was found carrying it* -- no longer holds.
 *
 * `GUIDANCE-CONTENT-REGISTER.md` §2 records the swap, and says plainly that
 * the three new ones are not covered by the 4 October approval.
 */
/*
  The four lines are Figma's (A5, F1-5, G3 to G6), re-read on 11 October.

  **Each is still a paraphrase of the quotation beside it**, which is what
  the register approves: the quotation and the publisher did not change, only
  how short the line on screen is. *Keep an emergency kit ready* drops the
  three days the quotation gives, and the fold under it still shows the
  sentence that says three days, so the detail is one press away rather than
  gone.

  **The design also draws a second line under each action on the printed
  page** -- "Torch, portable radio, spare batteries...", "listen to ABC local
  radio" and two more. Those are not in any approved quotation and no
  publisher is named for them, which is the one thing this register exists to
  stop, so they are not here. They need a source and an approval, not a
  copy-paste.
*/
export const GENERAL_ACTIONS: readonly GeneralAction[] = [
  {
    id: 'gutters',
    text: 'Clean gutters and downpipes when it is safe.',
    quote: 'Clean your gutters, downpipes and drains to ensure they are not blocked.',
    publisher: 'Victoria State Emergency Service',
    page: VICSES_STORM,
    checked: '2026-10-02',
    photo: '/actions/gutter.webp',
  },
  {
    id: 'raise-items',
    /*
      The one of the four that stays the product's.

      Figma says *Move valuable items above floor level*, and that wording
      was rejected on 2 October because no official page carries it: VICSES
      says *Lift it: Lift your valuables up high*, and *above floor level*
      is a specific the publisher does not give. The design re-proposed it
      on 11 October and the reason has not changed. `actions.test.ts` holds
      this line.
    */
    text: 'Lift valuables up high.',
    quote: 'Lift it: Lift your valuables up high',
    publisher: 'Victoria State Emergency Service',
    page: VICSES_FLOOD,
    checked: '2026-10-08',
    photo: '/actions/raise-items.webp',
  },
  {
    id: 'emergency-kit',
    text: 'Keep an emergency kit ready.',
    quote:
      "Pack an emergency flood kit with at least three days' worth of essentials, in case you lose power or need to evacuate.",
    publisher: 'Melbourne Water',
    page: MELBOURNE_WATER_FLOODING,
    checked: '2026-10-08',
    photo: '/actions/emergency-kit.webp',
  },
  {
    id: 'warnings',
    text: 'Know where to find current warnings.',
    quote:
      'Stay informed – monitor weather warnings and forecasts at the Bureau of Meteorology website, and warnings through the VicEmergency app, website and hotline (1800 226 226).',
    publisher: 'Victoria State Emergency Service',
    page: VICSES_FLOOD,
    checked: '2026-10-08',
    photo: '/actions/warnings.webp',
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
 * The prompt over *Ask about getting ready*, at the foot of the plan.
 *
 * `ASK_COMING` stood beside it from 8 October, while the slot was a slot: a
 * link that opens nothing is worse than saying so. The panel landed the next
 * day and took the stand-in with it.
 */
export const ASK_PROMPT = 'Have a question about getting ready?';

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
