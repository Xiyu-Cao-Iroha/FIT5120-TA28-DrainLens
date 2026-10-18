/**
 * The before-rain guide's shape, which the screens are built around.
 *
 * The order of the steps is the design's order (the REVISED E5 frames of
 * 17 October), and it is the one thing about this lesson that the screen
 * cannot keep by itself: the place card closes on an answer, so a step that
 * asked about the card *after* the answer would be pointing at something
 * that had gone. The test is here because that mistake was made once and
 * read perfectly well in the source.
 *
 * **It was six steps until 17 October.** What went, and what the tests for
 * those steps were holding, is in `heavyRain.ts`. Three of the removals are
 * only removals from the guide: the fold and the street drain list are
 * still in the product and still tested by the screens that draw them.
 */

import { describe, expect, it } from 'vitest';

import {
  HEAVY_RAIN,
  HEAVY_RAIN_NO_PLACES_STEPS,
  HEAVY_RAIN_STEPS,
  heavyRainFor,
} from './heavyRain.js';
import { type MapNow, NOTHING_ON_MAP, finished, satisfied } from './lesson.js';
import { NOTHING_ON } from '../map/modes.js';
import { checkButton } from '../prepare/places.js';

describe('the order of the steps', () => {
  it('follows the design: open the plan, answer, read the plan', () => {
    expect(HEAVY_RAIN_STEPS.map((step) => step.id)).toEqual([
      'plan-opened',
      'places-reviewed',
      'plan-reviewed',
    ]);
  });

  it('waits on a press for the two steps that are presses', () => {
    const waits = HEAVY_RAIN_STEPS.filter((step) => step.kind === 'do');
    expect(waits.map((step) => step.requires)).toEqual(['plan-opened', 'places-reviewed']);
  });

  it('ends on a reading step, which is the one that has Next', () => {
    // *Next is the only required action* on the review step, and a `read`
    // step is the kind that has one. A `do` step there would be waiting for
    // something the design says not to ask for.
    const last = HEAVY_RAIN_STEPS.at(-1);
    expect(last?.kind).toBe('read');
    expect(last?.kind === 'read' ? last.note : '').toMatch(/No checkbox or other choice/);
  });

  it('gives the decision its own feedback, so the step after it can instruct', () => {
    // Without it the guides' own rule would require *Great! …* where the
    // design writes *Review the reminder, then select Next*.
    const decide = HEAVY_RAIN_STEPS.find((step) => step.id === 'places-reviewed');
    expect(decide?.kind === 'do' ? decide.done : undefined).toBeDefined();
  });

  it('counts either answer as the decision it asked for', () => {
    // AC 5.4.1: *doesn't apply to me* is a review.
    const one = { ...NOTHING_ON_MAP, placeCount: 1 };
    expect(satisfied('places-reviewed', { ...one, placesReviewed: 1 }, null)).toBe(true);
    expect(satisfied('places-reviewed', one, null)).toBe(false);
  });

  it('waits for every place, not for the first one', () => {
    /*
      The team's 17 October note: *save each relevant place decision; show
      review after the last one is saved*, and the review frame says *3 of 3
      reviewed*. Until then one answer out of three satisfied this step, and
      the reader reached a plan that was still asking them something.
    */
    const three = { ...NOTHING_ON_MAP, placeCount: 3 };
    expect(satisfied('places-reviewed', { ...three, placesReviewed: 1 }, null)).toBe(false);
    expect(satisfied('places-reviewed', { ...three, placesReviewed: 2 }, null)).toBe(false);
    expect(satisfied('places-reviewed', { ...three, placesReviewed: 3 }, null)).toBe(true);
  });

  it('is not satisfied while the markers are still loading', () => {
    // A null count is *not known yet*. Zero answers out of an unknown number
    // is not an answered guide, and reading it as one would walk a reader
    // past the step for as long as the file takes to arrive.
    expect(satisfied('places-reviewed', { ...NOTHING_ON_MAP, placesReviewed: 0 }, null)).toBe(false);
  });
});

/**
 * The address with nothing marked near it, which is most of them.
 *
 * Reported from the deployed site on 11 October at 11 Neale Street,
 * Kensington: the guide reached *Decide whether Place 1 applies to you* with
 * no place anywhere on the map and nothing but Previous to press. 58.6% of
 * the index is that address, and Figma G1z and G2z are what it should get.
 */
describe('an address with no places', () => {
  /** The plan open and the markers known to hold nothing near here. */
  const emptyAddress: MapNow = {
    ...NOTHING_ON_MAP,
    placeCount: 0,
    planOpen: true,
    planOpened: true,
  };

  it('can be finished, which at this address the full guide cannot', () => {
    const { steps } = heavyRainFor(0);
    expect(finished(steps, emptyAddress, null, steps.length)).toBe(true);

    // The bug, kept as the comparison: the plan open, every reading
    // acknowledged, and the full guide still waiting on a decision about a
    // place that was never drawn.
    expect(finished(HEAVY_RAIN_STEPS, emptyAddress, null, HEAVY_RAIN_STEPS.length)).toBe(false);
  });

  it('asks for one press only, because the rest has nothing to act on', () => {
    const waits = HEAVY_RAIN_NO_PLACES_STEPS.filter((step) => step.kind === 'do');
    expect(waits.map((step) => step.requires)).toEqual(['plan-opened']);
  });

  it('keeps the three steps the other version has', () => {
    // The team's note is three steps, written for an address with places.
    // The design draws no empty-address version of them, and a branch that
    // was two steps long would make the progress bar mean something
    // different at one address than at another.
    expect(HEAVY_RAIN_NO_PLACES_STEPS).toHaveLength(HEAVY_RAIN_STEPS.length);
    expect(HEAVY_RAIN_NO_PLACES_STEPS.at(-1)?.id).toBe(HEAVY_RAIN_STEPS.at(-1)?.id);
  });

  it('keeps the first step, so the answer arriving late cannot move the reader', () => {
    // The markers load after the guide opens. Both versions open on the same
    // step, so a reader on step one is on step one either way.
    expect(HEAVY_RAIN_NO_PLACES_STEPS[0]?.id).toBe(HEAVY_RAIN_STEPS[0]?.id);
    expect(HEAVY_RAIN_NO_PLACES_STEPS[0]?.kind).toBe('do');
  });

  it('names no place anywhere in its words', () => {
    const words = JSON.stringify(HEAVY_RAIN_NO_PLACES_STEPS);
    expect(words).not.toMatch(/Place \d/);
    expect(words).not.toMatch(/Why this place/);
  });

  it('says the absence in the words the design gives it', () => {
    const says = HEAVY_RAIN_NO_PLACES_STEPS[1];
    expect(says?.prompt).toBe('No places to check near this address.');
    // It pointed at the street drain check until that step was removed; what
    // is left is the statement, which is what G2z leads with.
    expect(says?.kind === 'read' ? says.note : '').toMatch(/published markers/);
  });

  it('does not promise answers that this address had nothing to give', () => {
    expect(heavyRainFor(0).finished.unlocked).not.toMatch(/your answers/);
    expect(heavyRainFor(2).finished.unlocked).toMatch(/your answers/);
  });
});

describe('which version an address gets', () => {
  it('takes the full guide where there are places', () => {
    expect(heavyRainFor(1).steps).toBe(HEAVY_RAIN_STEPS);
    expect(heavyRainFor(3).steps).toBe(HEAVY_RAIN_STEPS);
  });

  it('takes the full guide while the markers are still loading', () => {
    // Null is *not known yet*, not *none*: the markers arrive after the
    // guide opens, and reading that as an empty address would hand the
    // shorter guide to every reader for as long as the file takes.
    expect(heavyRainFor(null).steps).toBe(HEAVY_RAIN_STEPS);
  });

  it('belongs to the lesson, so the screen cannot pick a different rule', () => {
    expect(HEAVY_RAIN.withPlaces).toBe(heavyRainFor);
  });

  it('names the button the guide actually has, not the address card’s', () => {
    // In a guide the full address card is suppressed; the only way into the
    // plan is the callout on the address, which `checkButton` labels. The
    // first attempt at the empty version's step one said *See what every
    // home can do*, which is on the card and so was nowhere on screen.
    expect(HEAVY_RAIN_NO_PLACES_STEPS[0]?.prompt).toBe(`Select ${checkButton([])}.`);
    expect(HEAVY_RAIN_STEPS[0]?.prompt).toBe(`Select ${checkButton([])}.`);
  });
});

describe('what it opens with', () => {
  it('opens with the markers already drawn, unlike every other guide', () => {
    // AC 5.1.1 puts them on the address as soon as one is chosen, and step one
    // asks for the button that belongs to them.
    expect(HEAVY_RAIN.opensWith).toEqual({ ...NOTHING_ON, beforeRain: true });
  });

  it('offers the one chip, so the layer can be taken off again', () => {
    expect(HEAVY_RAIN.chips(0, NOTHING_ON_MAP)).toEqual(['beforeRain']);
  });
});
