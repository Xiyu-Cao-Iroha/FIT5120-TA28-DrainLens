/**
 * Which drains can be compared, and the words for the ones that cannot.
 *
 * AC 3.1.1.a, d and e. The wording is tested like code for the same reason as
 * `outcome.ts`: an unmarked drain has to read as "we cannot calculate this",
 * never as "this drain is fine".
 */

import { describe, expect, it } from 'vitest';

import { SUPPORT_LEGEND, UNSUPPORTED_TEXT, supportOf } from './support.js';

const SUPPORT = { supported: new Set(['1001']), withoutGround: new Set(['2002']) };

describe('which drains support a comparison', () => {
  it('knows the three answers from the index alone', () => {
    expect(supportOf(SUPPORT, '1001')).toBe('supported');
    expect(supportOf(SUPPORT, '2002')).toBe('no-measured-ground');
    expect(supportOf(SUPPORT, '3003')).toBe('not-an-inlet');
  });
});

describe('what an unsupported drain is not', () => {
  it('says every time that it is about the calculation, not a clean bill for the drain', () => {
    for (const text of [...Object.values(UNSUPPORTED_TEXT), SUPPORT_LEGEND]) {
      expect(text).toMatch(/does not mean (this drain|they) (has|have) no drainage or flood concern/);
    }
  });

  it('gives each reason its own cause', () => {
    expect(UNSUPPORTED_TEXT['not-an-inlet']).toMatch(/surface inlet/);
    expect(UNSUPPORTED_TEXT['no-measured-ground']).toMatch(/measured ground/);
  });
});
