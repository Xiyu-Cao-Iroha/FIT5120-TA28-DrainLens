/**
 * What the three pictures may claim.
 *
 * The request was for photographs of a drain at 0, 50 and 100. What is here is
 * drawings, and the thing worth holding is that they never drift into being
 * presented as observations: AD13 and AC 3.1.2.d both forbid the product
 * implying it knows whether a real drain is blocked.
 */

import { describe, expect, it } from 'vitest';

import { BLOCKAGE_OPTIONS } from '../screens/ScenarioSetup.js';
import {
  BLOCKAGE_PICTURES,
  NOT_THIS_DRAIN,
  SEE_WHAT_IT_LOOKS_LIKE,
  takesLine,
} from './blockagePicture.js';

describe('the three pictures', () => {
  it('shows one per setting the comparison offers, in the same order', () => {
    expect(BLOCKAGE_PICTURES.map((picture) => picture.setting)).toEqual(
      BLOCKAGE_OPTIONS.map((option) => option.setting),
    );
  });

  it('names them with the words the criterion uses', () => {
    expect(BLOCKAGE_PICTURES.map((picture) => picture.title)).toEqual(
      BLOCKAGE_OPTIONS.map((option) => option.title),
    );
  });

  it('is the model’s intake, which is what 0, 50 and 100 mean here', () => {
    expect(BLOCKAGE_PICTURES.map((picture) => picture.takesPercent)).toEqual([100, 50, 0]);
    expect(takesLine(BLOCKAGE_PICTURES[1]!)).toBe('Takes 50% of the surface water');
    expect(takesLine(BLOCKAGE_PICTURES[2]!)).toBe('Takes none of the surface water');
  });
});

describe('what they are careful not to claim', () => {
  it('says they are drawings and not of this drain', () => {
    expect(NOT_THIS_DRAIN).toMatch(/Drawings, not photographs/);
    expect(NOT_THIS_DRAIN).toMatch(/not of this drain/);
    expect(NOT_THIS_DRAIN).toMatch(/does not know whether this drain is blocked/);
  });

  it('never says a reader could tell these apart on a real grate', () => {
    const everything = [
      SEE_WHAT_IT_LOOKS_LIKE,
      NOT_THIS_DRAIN,
      ...BLOCKAGE_PICTURES.flatMap((picture) => [picture.looksLike, picture.modelDoes]),
    ].join('\n');
    expect(everything).not.toMatch(/if you see|check whether|means the drain is|your drain/i);
  });
});
