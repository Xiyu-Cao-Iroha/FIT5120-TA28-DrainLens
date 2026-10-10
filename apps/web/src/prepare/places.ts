/**
 * The places to check before heavy rain, and what a reader may do about them.
 *
 * Epic 5 turns a map layer into a reminder, and the whole of AC 5.1 and 5.2 is
 * about not turning it into more than that. The places are the **pooling
 * warning markers already published** — the lowest street cell of a hollow at
 * least a metre below its spill level, on a hollow of at least 100 m², no two
 * within 150 m (`map/warnings.ts`, `pipeline/low_area_warnings.py`). Nothing
 * new is calculated here and nothing else qualifies: not the nearest pit, not
 * a mapped pipe, not a blockage-scenario result, not the area's flood history.
 * AC 5.2.2 forbids each of those by name.
 *
 * **Three parameters, decided by the team on 29 September and measured first.**
 * 200 m, because that is what "near this address" already means across the
 * product; at most three places; numbered nearest first. The measurement that
 * mattered: there are 91 markers in the council, so at 200 m **41.4% of the
 * 62,397 addresses have one and 58.6% have none**. The address with nothing to
 * number is the common case, which is why AC 5.1.3 exists and why this module
 * returns an empty list rather than widening its search.
 *
 * **Numbering is distance and says so.** AC 5.1.1 forbids implying that the
 * number is risk, severity or priority. Nearest first is the one ordering a
 * reader can check against the map, and `NUMBERING_NOTE` is the sentence that
 * says what it is.
 */

import type { WarningPoint } from '../map/warnings.js';
import type { Local } from '../map/viewport.js';

/** How far from the address a marker still counts as a place to check. */
export const PLACE_RADIUS_M = 200;

/** At most this many places are numbered (AC 5.1.1, AC 5.2.2). */
export const MAX_PLACES = 3;

/** One numbered place near the address. */
export interface Place {
  /** 1, 2 or 3 — the number on the marker and in the plan. */
  readonly number: number;
  readonly at: Local;
  readonly distanceM: number;
  /** The published marker this place is, unchanged. */
  readonly marker: WarningPoint;
}

/** What the reader has said about a place. `null` is not reviewed yet. */
export type Relevance = 'applies' | 'does-not-apply' | null;

/**
 * The places for an address: the nearest qualifying markers, numbered.
 *
 * Ties broken on easting then northing, so one address always numbers the same
 * markers the same way rather than however the artefact listed them.
 */
export function placesNear(
  address: Local | null,
  markers: readonly WarningPoint[],
  radiusM: number = PLACE_RADIUS_M,
  limit: number = MAX_PLACES,
): readonly Place[] {
  if (address === null) return [];
  return markers
    .map((marker) => ({
      marker,
      at: marker.c,
      distanceM: Math.hypot(marker.c[0] - address[0], marker.c[1] - address[1]),
    }))
    .filter((found) => found.distanceM <= radiusM)
    .sort(
      (a, b) =>
        a.distanceM - b.distanceM || a.marker.c[0] - b.marker.c[0] || a.marker.c[1] - b.marker.c[1],
    )
    .slice(0, limit)
    .map((found, index) => ({ ...found, number: index + 1 }));
}

/** Whether a published marker is one of the numbered places (AC 5.1.1). */
export function numberOf(places: readonly Place[], marker: WarningPoint): number | null {
  return places.find((place) => place.marker === marker)?.number ?? null;
}

/** The chip that turns the layer on, as the design labels it. */
export const BEFORE_RAIN_CHIP = 'Before-rain checks';

/** The button on the address card, with the count where there is one. */
export function checkButton(places: readonly Place[]): string {
  return places.length === 0
    ? 'Check before heavy rain'
    : `Check before heavy rain (${String(places.length)})`;
}

/** The title of a place's card: *Place 2 · Check before heavy rain*. */
export const placeTitle = (place: Place): string =>
  `Place ${String(place.number)} · Check before heavy rain`;

/**
 * The conditional action, which is the same at every place (AC 5.2.2).
 *
 * Conditional and about the street: the marker is on a public road near the
 * address, not inside anybody's property, and the action only applies to a
 * person who parks or leaves bins there.
 */
export const PLACE_ACTION =
  'If you park or leave bins here, move them when heavy rain is forecast.';

/** The reminder a place earns once it is marked as applying (AC 5.2.2). */
export const reminderFor = (place: Place): string =>
  `When heavy rain is forecast: move your car or bins from Place ${String(place.number)}.`;

/** Why this place is on the list: the low area and the paths into it (AC 5.3.1). */
export const WHY_THIS_PLACE =
  'Because this spot sits in a low area where nearby water paths gather.';

/** What the place is, and is not, under *Why this place?* (AC 5.3.1). */
export const PLACE_SOURCE = 'Estimated by DrainLens · Not a live warning';

/** That the place is the street rather than the reader's property (AC 5.3.1). */
export const PLACE_IS_THE_STREET =
  'It describes the street near your address, not your property.';

/** How a place's status reads in the plan (AC 5.2.3, 5.4.1). */
export function statusOf(relevance: Relevance): string {
  switch (relevance) {
    case 'applies':
      return 'Applies to me';
    case 'does-not-apply':
      return "Doesn't apply to me";
    case null:
      return 'Not reviewed yet';
  }
}

/**
 * Progress as *1 of 3 reviewed* (AC 5.4.1).
 *
 * Both answers count as reviewed, and the criterion forbids calling this a
 * readiness or preparedness score — it counts decisions made, not safety.
 */
export function reviewedLine(places: readonly Place[], relevance: Readonly<Record<number, Relevance>>): string {
  const reviewed = places.filter((place) => (relevance[place.number] ?? null) !== null).length;
  /*
    **Named, because *0 of 1 reviewed* reads as a score.** The product
    already has to follow it with *It is not a safety or readiness score*,
    and a label that needs a denial underneath is a label doing the wrong
    job. Saying what is counted is shorter than denying what is not.
  */
  return `Nearby places reviewed: ${String(reviewed)} of ${String(places.length)}`;
}

/** The places that earn a reminder: only those marked as applying (AC 5.2.2). */
export const applying = (
  places: readonly Place[],
  relevance: Readonly<Record<number, Relevance>>,
): readonly Place[] => places.filter((place) => relevance[place.number] === 'applies');

/** What the plan says where no place qualifies (AC 5.1.3). */
/**
 * What the before-rain layer says before there is an address.
 *
 * The layer draws its markers whether or not an address has been chosen, and
 * the checks are about an address. Saying nothing is how a reader concludes
 * the layer is broken; `NO_PLACES` below is the other absence, which is an
 * address with nothing near it.
 */
export const NO_ADDRESS_FOR_CHECKS =
  'Search for an address to see the places to check near it.';

export const NO_PLACES =
  'No places were marked near this address from the available information.';

/** And what that does not mean (AC 5.1.3). */
export const NO_PLACES_MEANS = 'This does not mean the area cannot flood.';

/**
 * The same absence on the map, where the card can say more (Figma A8).
 *
 * The plan's version is one sentence because the plan goes on to give the
 * general actions. The card is the whole answer the reader gets on the map,
 * so it names the radius it searched -- the one `placesNear` actually used --
 * and says what is still worth doing.
 */
export const NO_PLACES_IN_RING = `No places to check were found within ${String(PLACE_RADIUS_M)} m of this address.`;

export const NO_PLACES_STILL =
  'This does not mean the area cannot flood. The street drains near your home are still worth a look before heavy rain.';

/** The two ways on from that card, as the design labels them (Figma A8). */
export const CHECK_STREET_DRAINS = 'Check the street drains near you';
export const EVERY_HOME = 'See what every home can do';

/** The heading over the places in the plan (AC 5.2.1, 5.2.3). */
export const PLACES_NEAR_YOU = 'Places near you';

/** The heading over the general actions, which every address gets. */
export const FOR_EVERY_HOME = 'For every home';
