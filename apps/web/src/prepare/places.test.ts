/**
 * The places, and the four things AC 5.2.2 forbids them being chosen from.
 *
 * The qualifying places are the published pooling markers and nothing else.
 * This file is mostly about what does *not* become a place, and about the
 * common case the criteria were written for: an address with none.
 */

import { describe, expect, it } from 'vitest';

import {
  CHECK_STREET_DRAINS,
  EVERY_HOME,
  MAX_PLACES,
  NOT_AN_ORDER,
  NO_PLACES,
  PLACE_ACTION,
  PLACE_IS_THE_STREET,
  PLACE_RADIUS_M,
  NO_PLACES_IN_RING,
  NO_PLACES_MEANS,
  NO_PLACES_STILL,
  WHY_THIS_PLACE,
  applying,
  checkButton,
  numberOf,
  placeTitle,
  placesNear,
  reminderFor,
  reviewedLine,
  statusOf,
} from './places.js';
import type { WarningPoint } from '../map/warnings.js';

const marker = (e: number, n: number, depthM = 1.4, areaM2 = 300): WarningPoint => ({
  c: [e, n],
  depthM,
  areaM2,
});

const HOME: [number, number] = [500, 500];

describe('which places are offered', () => {
  it('takes the nearest markers within the search distance', () => {
    const places = placesNear(HOME, [marker(560, 500), marker(520, 500), marker(600, 500)]);
    expect(places.map((place) => place.number)).toEqual([1, 2, 3]);
    expect(places[0]?.distanceM).toBe(20);
  });

  it('numbers nearest first, which is the only ordering a reader can check', () => {
    // AC 5.1.1 forbids implying the number is risk or priority; distance is
    // what it is, and the plan says so in words.
    const places = placesNear(HOME, [marker(700, 500), marker(520, 500)]);
    expect(places[0]?.distanceM).toBe(20);
    expect(places[1]?.distanceM).toBe(200);
  });

  it('stops at three, however many are near', () => {
    const near = [510, 520, 530, 540, 550].map((e) => marker(e, 500));
    expect(placesNear(HOME, near)).toHaveLength(MAX_PLACES);
  });

  it('leaves out anything past the search distance', () => {
    // 200 m is the product's existing meaning of "near this address".
    expect(PLACE_RADIUS_M).toBe(200);
    expect(placesNear(HOME, [marker(500 + PLACE_RADIUS_M + 1, 500)])).toEqual([]);
  });

  it('offers none where the address has none, rather than widening its search', () => {
    // The common case: 58.6% of the council's addresses have no marker within
    // 200 m, and AC 5.1.3 is what that address reads.
    expect(placesNear(HOME, [])).toEqual([]);
    expect(placesNear(null, [marker(510, 500)])).toEqual([]);
  });

  it('breaks a tie the same way every time', () => {
    const first = placesNear(HOME, [marker(500, 520), marker(520, 500)]);
    const second = placesNear(HOME, [marker(520, 500), marker(500, 520)]);
    expect(first.map((p) => p.at)).toEqual(second.map((p) => p.at));
  });

  it('knows which published marker is which place', () => {
    const one = marker(520, 500);
    const two = marker(560, 500);
    const places = placesNear(HOME, [one, two]);
    expect(numberOf(places, one)).toBe(1);
    expect(numberOf(places, two)).toBe(2);
    expect(numberOf(places, marker(900, 900))).toBeNull();
  });
});

describe('what a place says', () => {
  const [place] = placesNear(HOME, [marker(520, 500)]);

  it('titles itself by its number', () => {
    expect(placeTitle(place!)).toBe('Place 1 · Check before heavy rain');
  });

  it('states the action as a condition, not an instruction', () => {
    // The marker is on a public street. A reader who never parks there has
    // nothing to do, and the wording has to let them say so.
    expect(PLACE_ACTION).toMatch(/^If you park or leave bins here/);
  });

  it('says the place is the street rather than the property', () => {
    expect(PLACE_IS_THE_STREET).toMatch(/not your property/);
  });

  it('words a reminder with the place number in it', () => {
    expect(reminderFor(place!)).toBe('When heavy rain is forecast: move your car or bins from Place 1.');
  });

  it('never presents an absence as safety', () => {
    expect(NO_PLACES_MEANS).toMatch(/does not mean the area cannot flood/);
    expect(NO_PLACES_STILL).toMatch(/does not mean the area cannot flood/);
  });

  it('names the radius it actually searched, on the card that reports the absence', () => {
    /*
      The card says *within 200 m*, which is a claim about what was looked at.
      Written as a number it would go on saying 200 after somebody changed
      `PLACE_RADIUS_M`, and the sentence would be false rather than merely
      out of date.
    */
    expect(NO_PLACES_IN_RING).toContain(`${String(PLACE_RADIUS_M)} m`);
    expect(placesNear(HOME, [marker(500 + PLACE_RADIUS_M + 20, 500)])).toEqual([]);
  });
});

describe('reviewing them', () => {
  const places = placesNear(HOME, [marker(520, 500), marker(560, 500), marker(600, 500)]);

  it('counts both answers as reviewed', () => {
    // AC 5.4.1: deciding a place does not apply is reviewing it.
    expect(reviewedLine(places, { 1: 'applies', 2: 'does-not-apply' })).toBe(
      'Nearby places reviewed: 2 of 3',
    );
  });

  it('starts at none reviewed', () => {
    expect(reviewedLine(places, {})).toBe('Nearby places reviewed: 0 of 3');
  });

  it('names the three states in the reader’s words', () => {
    expect(statusOf('applies')).toBe('Applies to me');
    expect(statusOf('does-not-apply')).toBe("Doesn't apply to me");
    expect(statusOf(null)).toBe('Not reviewed yet');
  });

  it('gives a reminder only to a place marked as applying', () => {
    // AC 5.2.2: not to one marked as not applying, and not to one left alone.
    const applies = applying(places, { 1: 'applies', 2: 'does-not-apply', 3: null });
    expect(applies.map((place) => place.number)).toEqual([1]);
  });

  it('counts the places on the button, and drops the count when there are none', () => {
    expect(checkButton(places)).toBe('Check before heavy rain (3)');
    expect(checkButton([])).toBe('Check before heavy rain');
  });
});

/**
 * The word the product stopped using.
 *
 * The plain-English audit's first finding: four labels said the product
 * tests a real drain, and the home page says in as many words that it does
 * not. Those four were changed on 10 October and three more were missed: the
 * address screen that opens the comparison, the map button's label for a
 * screen reader, and a spinner. A regular expression is a blunt guard, and
 * blunt is what this one needs.
 */
describe('the comparison never says it tests a drain', () => {
  it('keeps the word out of the places and comparison vocabulary', () => {
    const words = [
      NOT_AN_ORDER,
      NO_PLACES,
      NO_PLACES_MEANS,
      NO_PLACES_IN_RING,
      NO_PLACES_STILL,
      CHECK_STREET_DRAINS,
      EVERY_HOME,
      PLACE_ACTION,
      WHY_THIS_PLACE,
    ];
    for (const line of words) expect(line).not.toMatch(/\btest/i);
  });
});

describe('the plan is a list, not a form', () => {
  it('says the three parts are not an order', () => {
    // The numbers are the design's (Figma A8b, G6). This is what they mean.
    expect(NOT_AN_ORDER).toMatch(/not an order/);
  });
});
