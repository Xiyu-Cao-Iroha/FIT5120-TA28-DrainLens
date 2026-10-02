/**
 * The general actions, and the rule that none of them is ours.
 *
 * AC 5.2.3 asks for three or four short specific sentences, and the Epic 5
 * definition of done asks for them to be traceable to official guidance. The
 * test that matters is the one that checks each carries the sentence it came
 * from — a plausible action with no source is the thing this design is most
 * likely to grow by accident.
 */

import { describe, expect, it } from 'vitest';

import { GENERAL_ACTIONS, NOT_A_SCORE, SAFETY } from './actions.js';

describe('the general actions', () => {
  it('offers three or four, as the criterion asks', () => {
    expect(GENERAL_ACTIONS.length).toBeGreaterThanOrEqual(3);
    expect(GENERAL_ACTIONS.length).toBeLessThanOrEqual(4);
  });

  it('is one short sentence each', () => {
    for (const action of GENERAL_ACTIONS) {
      expect(action.text.split('. ').length).toBe(1);
      expect(action.text.split(/\s+/).length).toBeLessThanOrEqual(12);
      expect(action.text.endsWith('.')).toBe(true);
    }
  });

  it('carries the official sentence it came from, and when it was read', () => {
    for (const action of GENERAL_ACTIONS) {
      expect(action.quote.length).toBeGreaterThan(20);
      expect(action.publisher).toBeTruthy();
      expect(action.page).toMatch(/^https:\/\//);
      expect(action.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('has nothing the design showed and no page carried', () => {
    // The mock-up's fourth action, *Move valuable items above floor level*, is
    // not here: no official page was found carrying it on 2 October, and a
    // mock-up is not a source.
    const all = GENERAL_ACTIONS.map((action) => action.text).join(' ');
    expect(all).not.toMatch(/valuable items/i);
  });
});

describe('the safety boundary', () => {
  it('says all six things AC 5.3.3 lists', () => {
    const text = SAFETY.join(' ');
    expect(text).toMatch(/not a live flood warning/i);
    expect(text).toMatch(/does not determine whether a property will flood/i);
    expect(text).toMatch(/VicEmergency/);
    expect(text).toMatch(/Never enter floodwater/i);
    expect(text).toMatch(/132 500/);
    expect(text).toMatch(/Triple Zero \(000\)/);
  });
});

describe('what the plan is not', () => {
  it('says the reviewed count is not a score', () => {
    expect(NOT_A_SCORE).toMatch(/not a safety or readiness score/i);
  });
});
