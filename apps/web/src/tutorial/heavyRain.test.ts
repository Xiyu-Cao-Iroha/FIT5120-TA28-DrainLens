/**
 * The before-rain guide's shape, which the screens are built around.
 *
 * The order of these four steps is the design's order (Figma `G1` to `G3`),
 * and it is the one thing about this lesson that the screen cannot keep by
 * itself: the place card closes on an answer, so a step that asked about the
 * card *after* the answer would be pointing at something that had gone. The
 * test is here because that mistake was made once and read perfectly well in
 * the source.
 */

import { describe, expect, it } from 'vitest';

import { HEAVY_RAIN, HEAVY_RAIN_NO_PLACES_STEPS, HEAVY_RAIN_STEPS, heavyRainFor } from './heavyRain.js';
import { type MapNow, NOTHING_ON_MAP, finished, satisfied } from './lesson.js';
import { NOTHING_ON } from '../map/modes.js';
import { checkButton } from '../prepare/places.js';

describe('the order of the steps', () => {
  it('follows the design: press, decide, read the plan, open the explanation', () => {
    // Figma G1 to G5. The order was once rearranged to put *Why this place?*
    // on the place's card at step two, which is not what the design does: the
    // explanation is step four and it is opened in the plan, under the
    // reminder the answer has just created.
    expect(HEAVY_RAIN_STEPS.map((step) => step.id)).toEqual([
      'plan-opened',
      'place-reviewed',
      'plan-updated',
      'why-shown',
    ]);
  });

  it('waits on a press for the three steps that are presses', () => {
    const waits = HEAVY_RAIN_STEPS.filter((step) => step.kind === 'do');
    expect(waits.map((step) => step.requires)).toEqual([
      'plan-opened',
      'place-reviewed',
      'why-opened',
    ]);
  });

  it('gives the decision its own feedback, so the step after it can instruct', () => {
    // Without it the guides' own rule would require *Great! …* where the
    // design writes *Review the reminder added to your plan*.
    const decide = HEAVY_RAIN_STEPS.find((step) => step.id === 'place-reviewed');
    expect(decide?.kind === 'do' ? decide.done : undefined).toBeDefined();
  });

  it('counts either answer as the decision it asked for', () => {
    // AC 5.4.1: *doesn't apply to me* is a review.
    expect(satisfied('place-reviewed', { ...NOTHING_ON_MAP, placesReviewed: 1 }, null)).toBe(true);
    expect(satisfied('place-reviewed', NOTHING_ON_MAP, null)).toBe(false);
  });
});

/**
 * The address with nothing marked near it, which is most of them.
 *
 * Reported from the deployed site on 11 October at 11 Neale Street,
 * Kensington: the guide reached *Decide whether Place 1 applies to you* with
 * no place anywhere on the map and nothing but Previous to press. 58.6% of
 * the index is that address.
 */
describe('an address with no places', () => {
  /** The plan open and the markers known to hold nothing near here. */
  const emptyAddress: MapNow = { ...NOTHING_ON_MAP, placeCount: 0, planOpen: true };

  it('can be finished, which at this address the full guide cannot', () => {
    const { steps } = heavyRainFor(0);
    expect(finished(steps, emptyAddress, null, steps.length)).toBe(true);

    // The bug, kept as the comparison: every read acknowledged and the plan
    // open, and the full guide is still waiting on a decision about a place
    // that was never drawn.
    expect(finished(HEAVY_RAIN_STEPS, emptyAddress, null, HEAVY_RAIN_STEPS.length)).toBe(false);
  });

  it('waits only on the one press an empty address can make', () => {
    const waits = HEAVY_RAIN_NO_PLACES_STEPS.filter((step) => step.kind === 'do');
    expect(waits.map((step) => step.requires)).toEqual(['plan-opened']);
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

describe('the one press an empty address can make', () => {
  it('names the button the guide actually has, not the address card’s', () => {
    // In a guide the full address card is suppressed; the only way into the
    // plan is the callout on the address, which `checkButton` labels. The
    // first attempt at this step said *See what every home can do*, which is
    // on the card and so was nowhere on screen.
    const first = HEAVY_RAIN_NO_PLACES_STEPS[0];
    expect(first?.prompt).toBe(`Click ${checkButton([])}.`);
    expect(HEAVY_RAIN_STEPS[0]?.prompt).toBe(`Click ${checkButton([])}.`);
  });
});
