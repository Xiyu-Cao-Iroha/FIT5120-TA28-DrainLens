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

import { HEAVY_RAIN, HEAVY_RAIN_STEPS } from './heavyRain.js';
import { NOTHING_ON_MAP, satisfied } from './lesson.js';
import { NOTHING_ON } from '../map/modes.js';

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
