/**
 * The tour's arithmetic, and the one thing its words are not allowed to do.
 *
 * A coach mark that covers the control it is pointing at teaches nothing, and
 * a card half off the screen teaches less. Both are geometry, so both are
 * checked here rather than looked at once on one window size.
 */

import { describe, expect, it } from 'vitest';

import {
  type Box,
  CARD_GAP,
  EDGE_MARGIN,
  SPOTLIGHT_PADDING,
  TOUR_STEPS,
  caretAt,
  placeCard,
  spotlightFor,
} from './tourPlan.js';

const view = { width: 1280, height: 800 };
const card: Box = { x: 0, y: 0, width: 340, height: 180 };
const box = (x: number, y: number, width = 90, height = 34): Box => ({ x, y, width, height });

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe('the hole in the overlay', () => {
  it('is the control, with room around it', () => {
    const spot = spotlightFor(box(100, 200, 90, 34));
    expect(spot).toEqual({
      x: 100 - SPOTLIGHT_PADDING,
      y: 200 - SPOTLIGHT_PADDING,
      width: 90 + SPOTLIGHT_PADDING * 2,
      height: 34 + SPOTLIGHT_PADDING * 2,
    });
  });

  it('still contains the control when the padding is zero', () => {
    const target = box(100, 200);
    expect(spotlightFor(target, 0)).toEqual(target);
  });
});

describe('where the card goes', () => {
  it('sits below the control when there is room, and never on it', () => {
    const spot = spotlightFor(box(200, 180));
    const at = placeCard(spot, card, view);
    expect(at.caret).toBe('top');
    expect(at.top).toBe(spot.y + spot.height + CARD_GAP);
    expect(overlaps({ ...card, x: at.left, y: at.top }, spot)).toBe(false);
  });

  it('flips above the control when the card would run off the bottom', () => {
    // A chip near the foot of a short window. Below is where it wants to go
    // and below is where it does not fit.
    const spot = spotlightFor(box(200, 700));
    const at = placeCard(spot, card, view);
    expect(at.caret).toBe('bottom');
    expect(at.top).toBe(spot.y - CARD_GAP - card.height);
    expect(overlaps({ ...card, x: at.left, y: at.top }, spot)).toBe(false);
  });

  it('gives up the caret rather than point at something it is covering', () => {
    // No room above and none below: the card has to go somewhere, and the one
    // thing it must not do is claim to point at the control underneath it.
    const short = { width: 1280, height: 260 };
    const spot = spotlightFor(box(200, 110));
    const at = placeCard(spot, card, short);
    expect(at.caret).toBe('none');
    expect(at.top).toBeGreaterThanOrEqual(EDGE_MARGIN);
  });

  it('centres on the control it is about', () => {
    const spot = spotlightFor(box(600, 180));
    const at = placeCard(spot, card, view);
    expect(at.left + card.width / 2).toBeCloseTo(spot.x + spot.width / 2);
  });

  it('stays on screen for a control at either edge', () => {
    for (const x of [0, 8, view.width - 90, view.width - 20]) {
      const at = placeCard(spotlightFor(box(x, 180)), card, view);
      expect(at.left).toBeGreaterThanOrEqual(EDGE_MARGIN);
      expect(at.left + card.width).toBeLessThanOrEqual(view.width - EDGE_MARGIN);
    }
  });

  it('pins a card wider than the window to the left edge instead of past it', () => {
    // The clamp is Math.max(margin, Math.min(centred, widest)). With the
    // operations the other way round a narrow window gives a negative maximum
    // and the card leaves the screen on the side the clamp was meant to guard.
    const narrow = { width: 320, height: 800 };
    const at = placeCard(spotlightFor(box(10, 180)), card, narrow);
    expect(at.left).toBe(EDGE_MARGIN);
  });
});

describe('the caret', () => {
  it('follows the control when the card is pushed sideways to fit', () => {
    // A chip at the far right: the card is clamped, so the middle of the card
    // is no longer the middle of the hole and a centred caret would point at
    // empty space.
    const spot = spotlightFor(box(view.width - 60, 180));
    const at = placeCard(spot, card, view);
    expect(caretAt(spot, at, card)).toBeGreaterThan(0.5);
  });

  it('stays off the rounded corners', () => {
    const left = spotlightFor(box(0, 180));
    const right = spotlightFor(box(view.width - 20, 180));
    expect(caretAt(left, placeCard(left, card, view), card)).toBeGreaterThanOrEqual(0.1);
    expect(caretAt(right, placeCard(right, card, view), card)).toBeLessThanOrEqual(0.9);
  });
});

describe('what the steps say', () => {
  it('covers every control the prototype numbered, in that order', () => {
    expect(TOUR_STEPS.map((s) => s.target)).toEqual([
      'address',
      'chips',
      'chip-pit',
      'chip-pipe',
      'chip-channel',
      'chip-lowPoint',
      'layers',
    ]);
  });

  it('does not promise where water will go', () => {
    // The prototype's fifth step said "where it will flow to". This product
    // does not forecast, and a tour is where somebody learns what the words on
    // the screen mean -- so it is the worst place to define them more strongly
    // than the rest of the interface does.
    const forecast = /will flow to|will go|predicts?\b|forecast/i;
    for (const step of TOUR_STEPS) expect(step.body).not.toMatch(forecast);
  });

  it('hedges the two calculated layers where the map hedges them', () => {
    const flow = TOUR_STEPS.find((s) => s.target === 'chip-channel');
    const low = TOUR_STEPS.find((s) => s.target === 'chip-lowPoint');
    expect(flow?.body).toMatch(/likely|tends to/i);
    expect(low?.body).toMatch(/indicative/i);
  });
});
