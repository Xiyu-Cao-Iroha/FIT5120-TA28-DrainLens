/**
 * The four things the guide teaches, and what finishing one means.
 *
 * **These are not new categories.** They are the four `MapMode`s the homepage
 * has offered since 3 September, with the same four cards and the same four
 * openings — AC 1.1.2 names them. The guide adds an order and a gate; it does
 * not add a fifth way of thinking about the map, and a section whose id did
 * not match a mode would be one.
 *
 * **Until all four are done, the full map opens through a short notice**,
 * which is the mentor's point put into the product: the user journey was
 * somebody arriving at the map with four layers and no basemap and being left
 * to it. The notice — see `lockNotice` — is a disclosure, not a lock: its
 * button works at once, and the guides are optional.
 */

import { COVERAGE } from '../ui/terms.js';

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
  /** Shown on a card whose guide has not been finished yet. */
  readonly locked: string;
}

export const SECTIONS: Record<SectionId, Section> = {
  drainage: {
    id: 'drainage',
    label: 'Local drainage pits and pipes',
    locked: 'Start guide',
  },
  'water-flow': {
    id: 'water-flow',
    label: 'Where rainwater may move',
    locked: 'Start guide',
  },
  'low-areas': {
    id: 'low-areas',
    label: 'Low areas where water may collect',
    locked: 'Start guide',
  },
  terrain: {
    id: 'terrain',
    label: 'The shape of the ground',
    locked: 'Start guide',
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
 * What somebody is told before the full map opens without the guide.
 *
 * **Four disclosures, not four reasons to stay.** This is the one moment in
 * the product where a person is about to read the data without having been
 * told what it is. Each line is a claim this repository can back:
 *
 * - the extent is the served map's own;
 * - 215 of 895 pits have no recorded downstream, which is why the second line
 *   exists and why it says *record* rather than *network*;
 * - the paths and low areas are `derived.json`, calculated here and published
 *   by nobody, and drawn only where the ground data allows;
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
      ? COVERAGE.map
      : 'This is one square kilometre of Kensington, not all of Melbourne.';

  return [
    where,
    'Drain pits and pipes come from council records. A line that ends may mean the council record ends there.',
    'Calculated water paths and low areas are shown only where enough ground data is available.',
    'It is not a flood warning and not a forecast.',
  ];
}
