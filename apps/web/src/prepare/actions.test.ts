/**
 * The general actions, and the rule that none of them is ours.
 *
 * AC 5.2.3 asks for three or four short specific sentences, and the Epic 5
 * definition of done asks for them to be traceable to official guidance. The
 * test that matters is the one that checks each carries the sentence it came
 * from — a plausible action with no source is the thing this design is most
 * likely to grow by accident.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

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

  it('takes the design’s fourth action only now that a page carries it', () => {
    /*
      It was left out on 2 October because no official page was found carrying
      *Move valuable items above floor level*, and a mock-up is not a source.
      VICSES's flood page carries *Lift it: Lift your valuables up high*, read
      on 8 October, so the action is in under the publisher's words rather
      than the mock-up's.
    */
    const lift = GENERAL_ACTIONS.find((action) => action.id === 'raise-items');
    expect(lift?.quote).toBe('Lift it: Lift your valuables up high');
    /*
      Still held on 11 October, when the other three lines were taken from
      the frames and this one was not. *Above floor level* is a specific
      the publisher does not give, and a frame re-proposing it is the same
      mock-up the 2 October decision was about.
    */
    expect(lift?.text).not.toMatch(/valuable items|floor level/i);
  });

  it('gives each action a photograph the repository actually ships', () => {
    // The file has to be there: a broken image on the plan is a gap in the
    // one screen somebody may read with rain coming.
    for (const action of GENERAL_ACTIONS) {
      expect(action.photo).toMatch(/^\/actions\/[a-z-]+\.webp$/);
      expect(existsSync(path.resolve(__dirname, '../../public', action.photo.slice(1)))).toBe(true);
    }
  });

  it('never lets a photograph stand in for evidence', () => {
    // Every action still carries the sentence it came from; the picture is
    // about which part of a house the sentence is about and nothing more.
    for (const action of GENERAL_ACTIONS) {
      expect(action.quote.length).toBeGreaterThan(20);
    }
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
