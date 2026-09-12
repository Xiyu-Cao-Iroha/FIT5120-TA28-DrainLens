/**
 * The four things the guide teaches, and what finishing one means.
 *
 * **These are not new categories.** They are the four `MapMode`s the homepage
 * has offered since 3 September, with the same four cards and the same four
 * openings — AC 1.1.2 names them. The guide adds an order and a gate; it does
 * not add a fifth way of thinking about the map, and a section whose id did
 * not match a mode would be one.
 *
 * **The whole map is locked until all four are done**, which is the mentor's
 * point put into the product: the user journey was somebody arriving at a
 * square kilometre with four layers and no basemap and being left to it.
 * There is a way past the lock — see `LOCK_NOTICE` — because a product that
 * cannot be entered is not a product, and because the five seconds it costs
 * are spent on a disclosure rather than on a nag.
 */

import type { MapMode } from '../map/modes.js';

/** A section of the guide. One per map mode, and the ids are the modes. */
export type SectionId = MapMode;

/** In the order they are offered, which is the order the cards already sit in. */
export const SECTION_ORDER: readonly SectionId[] = [
  'drainage',
  'water-flow',
  'low-areas',
  'terrain',
];

export interface Section {
  readonly id: SectionId;
  /** The name under the card. */
  readonly label: string;
  /** Shown on a card nobody has unlocked yet. */
  readonly locked: string;
}

export const SECTIONS: Record<SectionId, Section> = {
  drainage: {
    id: 'drainage',
    label: 'Local drainage pits and pipes',
    locked: 'Finish the guide to unlock this',
  },
  'water-flow': {
    id: 'water-flow',
    label: 'Where rainwater may move',
    locked: 'Finish the guide to unlock this',
  },
  'low-areas': {
    id: 'low-areas',
    label: 'Low areas where water can collect',
    locked: 'Finish the guide to unlock this',
  },
  terrain: {
    id: 'terrain',
    label: 'The shape of the ground',
    locked: 'Finish the guide to unlock this',
  },
};

/** What has been finished. Four booleans and nothing else. */
export type Learned = Readonly<Record<SectionId, boolean>>;

export const NOTHING_LEARNED: Learned = {
  drainage: false,
  'water-flow': false,
  'low-areas': false,
  terrain: false,
};

export const allLearned = (learned: Learned): boolean =>
  SECTION_ORDER.every((id) => learned[id]);

export const countLearned = (learned: Learned): number =>
  SECTION_ORDER.filter((id) => learned[id]).length;

/**
 * The next section to offer, or null when there is none left.
 *
 * Offered in `SECTION_ORDER` rather than "the one after the one just finished",
 * so somebody who takes them out of order is still pointed at something they
 * have not done rather than at the end of the list.
 */
export function nextSection(learned: Learned): SectionId | null {
  return SECTION_ORDER.find((id) => !learned[id]) ?? null;
}

/**
 * What somebody is told before the whole map opens without the guide.
 *
 * **Four disclosures, not four reasons to stay.** The five-second wait in
 * front of this is only defensible if the wait buys the reader something, and
 * what it buys is the one moment in the product where a person is about to
 * read the data without having been told what it is. Each line is a claim this
 * repository can back:
 *
 * - the extent is `map.json`'s own, one square kilometre;
 * - 215 of 895 pits have no recorded downstream, which is why the second line
 *   exists and why it says *record* rather than *network*;
 * - the paths and low areas are `derived.json`, calculated here and published
 *   by nobody, which is also what the footer's CC BY notice has to say;
 * - and the fourth is the sentence this product has refused to stop saying.
 */
export function lockNotice(extentName: string): readonly string[] {
  /*
    The first line depends on which extent is on screen, and it has to.

    It read "This is one square kilometre of Kensington" for as long as that
    was the only extent there was. The database now holds the whole council, so
    on the day the API answered, a screen whose entire purpose is to disclose
    what the reader is about to look at opened by telling them it was
    seventy-five times smaller than it is.

    Getting that wrong is worse here than anywhere else on the site. Every
    other sentence in this product is hedged; these four are the ones that say
    plainly what the thing is, and a plain sentence that is false is not a
    smaller error than a hedged one.
  */
  const where =
    extentName === 'city-of-melbourne'
      ? 'This is the City of Melbourne — about 76 square kilometres, and not the rest of Greater Melbourne.'
      : 'This is one square kilometre of Kensington, not all of Melbourne.';

  const ground =
    extentName === 'city-of-melbourne'
      ? 'The water paths and low areas are calculated here from measured ground, and that ground was measured in two places: one square kilometre of Kensington, and the central city from Spencer Street to Spring Street. Everywhere else on this map, nothing is claimed about where water goes.'
      : 'The water paths and low areas are calculated here from measured ground. Nobody publishes them.';

  return [
    where,
    'The drainage is the council’s record. Where it stops, the map stops — that is not a loading failure.',
    ground,
    'It is not a flood warning and not a forecast.',
  ];
}

/** How long the notice stands before the way in is offered. */
export const LOCK_NOTICE_SECONDS = 5;
