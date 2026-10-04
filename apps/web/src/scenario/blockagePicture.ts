/**
 * What the three drain conditions look like, and what the picture may claim.
 *
 * The team asked on 4 October for the comparison's three settings to be shown
 * rather than only named: *what does 0, 50 and 100 actually look like?* It is
 * a fair question — somebody choosing *Partly blocked* is being asked to
 * picture a grate, and the words alone leave them to imagine one.
 *
 * **They are drawings, and they say so.** The request was for photographs.
 * This repository has one photograph already whose origin and licence are not
 * recorded (`docs/DATASETS.md` flags it for submission), and three more taken
 * from somewhere unnamed would turn one unanswered question into four. A
 * drawing of a grate half covered in leaves also has the advantage of being
 * honest about what it is: nothing here is a photograph of *this* drain, and
 * `NOT_THIS_DRAIN` says so under the pictures.
 *
 * **The percentages are the model's, not a measurement.** 0, 50 and 100 are
 * how much surface water the engine lets the pit take — `clear`, half, and
 * none. They are not a measured blockage, and AD13 forbids implying that a
 * reader could tell them apart by looking at a real grate.
 */

import type { BlockageSetting } from '@drainlens/schema';

/** One picture, with what it is a picture of. */
export interface BlockagePicture {
  readonly setting: BlockageSetting;
  /** The model's intake, as a share of the clear setting. */
  readonly takesPercent: number;
  readonly title: string;
  /** What a grate in that state looks like, in one line. */
  readonly looksLike: string;
  /** What the model does with it, in the engine's own terms. */
  readonly modelDoes: string;
}

export const BLOCKAGE_PICTURES: readonly BlockagePicture[] = [
  {
    setting: 'clear',
    takesPercent: 100,
    title: 'Clear',
    looksLike: 'The grate is open. Water runs through the bars.',
    modelDoes: 'The pit takes surface water at the model’s normal rate.',
  },
  {
    setting: 'partly-blocked',
    takesPercent: 50,
    title: 'Partly blocked',
    looksLike: 'About half the grate is covered — leaves, silt or a bag over one side.',
    modelDoes: 'The pit takes half as much surface water as the clear setting.',
  },
  {
    setting: 'fully-blocked',
    takesPercent: 0,
    title: 'Fully blocked',
    looksLike: 'The grate is covered. Water stands on it instead of going in.',
    modelDoes: 'The pit takes no surface water at all.',
  },
];

/** The control that opens them, and the title it opens under. */
export const SEE_WHAT_IT_LOOKS_LIKE = 'What these look like';

/** Said under the three pictures, before anything else is read into them. */
export const NOT_THIS_DRAIN =
  'Drawings, not photographs, and not of this drain. DrainLens does not know whether this drain is blocked now.';

/** How the share is written beside each picture. */
export const takesLine = (picture: BlockagePicture): string =>
  picture.takesPercent === 0
    ? 'Takes none of the surface water'
    : `Takes ${String(picture.takesPercent)}% of the surface water`;
