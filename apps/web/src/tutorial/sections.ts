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

import type { MapMode } from '../map/modes.js';
import { LAYER } from '../ui/terms.js';

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
  /**
   * The guide's name in the header, where it is not `label`.
   *
   * The ground height guide's design titles it *Ground height guide*, while
   * its card keeps *The shape of the ground*. A field of its own rather than a
   * renamed label, because the label is the card's and the other three guides
   * are titled by it.
   */
  readonly guideTitle?: string;
}

/** What the header calls a section's guide. */
export const guideTitleOf = (id: SectionId): string => SECTIONS[id].guideTitle ?? SECTIONS[id].label;

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
    guideTitle: `${LAYER.ground} guide`,
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
 * - the map is records and estimates, and not a live flood warning -- the
 *   sentence this product has refused to stop saying;
 * - 215 of 895 pits have no recorded downstream, which is why the third line
 *   exists and why it says *record* rather than *network*;
 * - the paths and low areas are `derived.json`, calculated here and published
 *   by nobody, and drawn only where the ground data allows.
 *
 * **Two said, the rest one link away.** Four lines in front of a button were
 * skipped whole (copy audit v2, #52), so v2 folded the last two behind *More
 * information*. Copy audit v4 (#52) replaces the fold with *More about the map
 * ›*, which opens About the data at *Drains and pipes*; that page says the
 * line stops where the record stops, and that water paths are not shown over
 * ground data gaps, in its own words (`ui/sources.ts`).
 */
export interface LockNotice {
  readonly said: readonly [string, string];
}

export function lockNotice(extentName: string): LockNotice {
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

    The audit's wording is "The map covers the City of Melbourne." It is said
    only when that is the extent on screen; any other extent, including one
    this does not know, gets the narrower Kensington sentence, because claiming
    less ground than is shown is the safe direction to be wrong in.
  */
  const where =
    extentName === 'city-of-melbourne'
      ? 'The map covers the City of Melbourne.'
      : 'The map covers one square kilometre of Kensington, not all of Melbourne.';

  return {
    said: [where, 'It shows records and estimates, not live flood warnings.'],
  };
}
