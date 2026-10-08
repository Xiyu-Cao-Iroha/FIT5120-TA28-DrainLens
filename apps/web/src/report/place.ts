/**
 * Where the problem is: a recorded drain the reader tapped, or a pin they put.
 *
 * Epic 6's *Which drain* row, as the design resolves it (Figma R1 to R4, and
 * the details screens B4c to B4e). A report is only as useful as the place it
 * names, and the two honest ways to name one are the council's own identifier
 * for a drain that is on the map, and a point with a sentence for one that is
 * not.
 *
 * **Both are the reader's.** AC 6.3.2 allows a recorded pit on a report *only
 * if the reader selected it*, so neither of these is ever filled in from
 * what happens to be nearest. Reporting without either stays allowed, and is
 * what the row says by default.
 *
 * **The pin is a point and a sentence, and the sentence is the useful half.**
 * A council officer reading *outside number 50, near the corner* can stand
 * where the reader stood; a pair of coordinates alone sends them to a dot in
 * a street. The coordinates go with it as a map link, built here and written
 * into the reader's own clipboard or printed page (AC 6.3.3).
 */

import { type Mga, mapLink } from '../map/mga.js';

/** A drain the reader tapped, with what the record calls it. */
export interface PickedDrain {
  /** The council's asset number, which AC 6.3.2 asks to be shown. */
  readonly assetNumber: string;
  /** The street the record puts it in, where it has one. */
  readonly street: string | null;
  /** How far from the reader's address, rounded, where there is one. */
  readonly distanceM: number | null;
}

/**
 * The drains the reader tapped: one, or several.
 *
 * **A list since 9 October, because one problem is often several drains.** A
 * blocked street floods at the two or three inlets that take it, and a report
 * naming one of them sends a council to a third of the problem. The reader
 * taps each one and the report carries all of them; it is still only ever the
 * ones they tapped (AC 6.3.2), and never the nearest.
 *
 * Empty is not a state this models: no drain at all is `null`, which is what
 * the row already says *Not chosen* for.
 */
export interface PickedDrains {
  readonly kind: 'drain';
  readonly drains: readonly PickedDrain[];
}

/** A point the reader put, with the words that make it findable. */
export interface PinnedPlace {
  readonly kind: 'pin';
  readonly note: string;
  readonly at: Mga;
}

/** Where the problem is, or `null` where the reader has not said. */
export type ReportPlace = PickedDrains | PinnedPlace | null;

/** The label AC 6.3.2 asks for on a recorded drain. */
export const SELECTED_DRAIN = 'Selected recorded drain';

/** And for several, which is the same claim in the plural. */
export const SELECTED_DRAINS = 'Selected recorded drains';

/** The heading on the row, which changes with what is in it. */
export const placeTitle = (place: ReportPlace): string => {
  if (place?.kind === 'pin') return 'Drain location';
  return place !== null && place.drains.length > 1 ? 'Which drains' : 'Which drain';
};

/**
 * The button that ends the picking, which never counts out loud.
 *
 * *Use these 2 drains* was the first draft and the team cut the number: it is
 * on the screen already, as the rows above the button, and a count in a label
 * is a thing that can disagree with what is beside it.
 */
export const useDrains = (count: number): string =>
  count === 1 ? 'Use this drain' : 'Use these drains';

/** How far a tapped drain is, in the design's words (Figma R2). */
export const distanceLine = (place: PickedDrain, address: string | null): string =>
  place.distanceM === null || address === null
    ? 'On the map'
    : `About ${String(place.distanceM)} m from ${address}`;

/** What a tapped drain is called, where the record gives a street (Figma R2). */
export const drainTitle = (place: PickedDrain): string =>
  place.street === null ? `Drain ${place.assetNumber}` : `Drain on ${place.street}`;

/** One drain, as the row names it. */
const drainLine = (drain: PickedDrain): string =>
  drain.street === null ? drain.assetNumber : `${drain.assetNumber} · ${drainTitle(drain)}`;

/** The row's own line, whichever way the reader answered. */
export function placeLine(place: ReportPlace): string {
  if (place === null) return NO_PLACE;
  if (place.kind === 'pin') return `Pinned on the map · ${place.note}`;
  const label = place.drains.length > 1 ? SELECTED_DRAINS : SELECTED_DRAIN;
  return `${label}: ${place.drains.map(drainLine).join('; ')}`;
}

/** Said where the reader has named no place, so an empty row is not a gap. */
export const NO_PLACE = 'Not chosen. Nothing is chosen for you';

/** The way into picking one, and the way to change it afterwards. */
export const PICK_ON_MAP = 'Pick the drain on the map';
export const CHANGE_PLACE = 'Change';

/** Said under the two buttons once a pin carries coordinates (Figma B4d). */
export const COPIED_WITH_LINK =
  'The copied text also includes the pinned location as a map link.';

/** The notice at the head of the details, once a place has been named. */
export function placeNotice(place: ReportPlace): string | null {
  if (place === null) return null;
  if (place.kind === 'pin') return 'Location pinned on the map.';
  return place.drains.length > 1 ? 'Drains picked on the map.' : 'Drain picked on the map.';
}

/** The extra line a pin puts in the copied and printed copy. */
export const pinnedLink = (place: ReportPlace): string | null =>
  place?.kind === 'pin' ? mapLink(place.at) : null;

/* ---- picking it, on the map ------------------------------------------- */

/** The banner over the map while a drain is being tapped (Figma R1). */
export const PICK_DRAIN = {
  title: 'Tap the drain that is blocked.',
  near: (address: string | null): string =>
    address === null ? 'Only drains near this map are shown.' : `Only drains near ${address} are shown.`,
  cancel: 'Cancel',
  notOnMap: "The drain isn't on the map",
} as const;

/** And while a point is being put instead (Figma R3). */
export const PIN_PLACE = {
  title: 'Tap where the drain is.',
  then: 'Then add a few words so council can find it.',
  card: 'Pinned location',
  placeholder: 'Outside number 50, near the corner',
  use: 'Use this location',
  back: 'Back',
} as const;

/**
 * How far from the address a drain is still one of "the drains near" it.
 *
 * 150 m rather than the 200 m that *near this address* means everywhere else,
 * because this one is a list to tap rather than a list to read: at 200 m the
 * pilot square's own density puts enough circles on the screen that finding
 * the right one is the hard part. The banner promises only the drains near
 * the address are shown, and that has to be true of what is drawn.
 */
export const PICK_RADIUS_M = 150;
