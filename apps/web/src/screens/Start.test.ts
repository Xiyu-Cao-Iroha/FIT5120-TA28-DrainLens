/**
 * The fork *Get started* opens.
 *
 * The thing worth holding is that the two choices keep their scopes apart:
 * the drains are the City of Melbourne's and the history is Greater
 * Melbourne's, and the homepage has always said so in words. A fork that
 * dropped the scopes would be offering them as two views of one dataset.
 */

import { describe, expect, it } from 'vitest';

import { START_CHOICES } from './Start.js';
import { FLOOD } from '../ui/terms.js';

describe('the two choices', () => {
  it('offers exactly two, the drains first', () => {
    expect(START_CHOICES.map((choice) => choice.id)).toEqual(['explore', 'history']);
  });

  it('keeps the two scopes apart', () => {
    expect(START_CHOICES[0]?.scope).toBe('City of Melbourne');
    expect(START_CHOICES[1]?.scope).toBe('Greater Melbourne');
  });

  it('counts emergency responses in the site’s own words', () => {
    // `terms.ts` holds the one name for these, and the retired *call-outs*
    // is kept out of the source by its own test.
    expect(START_CHOICES[1]?.body).toContain(FLOOD.unit);
  });

  it('says what each one opens', () => {
    expect(START_CHOICES[0]?.action).toMatch(/guide/i);
    expect(START_CHOICES[1]?.action).toMatch(/flood history/i);
  });
});
