/**
 * The address screen says which task the address is for.
 *
 * In the 15 September user test the comparison's address screen used the
 * explorer's words, and the person read *Explore this area* as having been
 * sent somewhere other than the comparison they had just chosen.
 */

import { describe, expect, it } from 'vitest';

import { COMPARE_COPY, EXPLORE_COPY, landingCopyFor } from './Landing.js';
import { INITIAL_SESSION, reduce } from '../session.js';

describe('the address screen’s words', () => {
  it('uses the comparison’s own words when the comparison is waiting', () => {
    const waiting = reduce(INITIAL_SESSION, { type: 'task-wanted', task: 'compare', from: 'home' });
    expect(waiting.screen).toBe('address');
    const copy = landingCopyFor(waiting.pendingTask);
    expect(copy).toBe(COMPARE_COPY);
    // The team's Figma, H2 and H3.
    expect(copy.title).toBe('Which address do you want to check?');
    expect(copy.lead).toMatch(/nearest drain you can test/);
    expect(copy.submit).toBe('Find a drain →');
  });

  it('keeps the explorer’s words for every other way in', () => {
    expect(landingCopyFor(null)).toBe(EXPLORE_COPY);
    expect(landingCopyFor(undefined)).toBe(EXPLORE_COPY);
    expect(landingCopyFor('follow')).toBe(EXPLORE_COPY);
    expect(landingCopyFor('full-map')).toBe(EXPLORE_COPY);
    expect(EXPLORE_COPY.submit).toBe('Explore this area →');
  });
});
