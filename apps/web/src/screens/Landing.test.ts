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
    expect(copy.lead).toMatch(/a drain near it you can test/);
    expect(copy.submit).toBe('Find a drain →');
  });

  it('keeps the explorer’s words for every other way in', () => {
    expect(landingCopyFor(null)).toBe(EXPLORE_COPY);
    expect(landingCopyFor(undefined)).toBe(EXPLORE_COPY);
    expect(landingCopyFor('follow')).toBe(EXPLORE_COPY);
    expect(landingCopyFor('full-map')).toBe(EXPLORE_COPY);
    expect(EXPLORE_COPY.submit).toBe('Explore this area →');
    // Copy audit v2, #16: what to do, and where the search covers.
    expect(EXPLORE_COPY.title).toBe('Enter your address');
    expect(EXPLORE_COPY.lead).toBe('Covers the City of Melbourne.');
  });

  it('names the guide section waiting for the address in the title', () => {
    expect(landingCopyFor(null, 'drainage').title).toBe('Find drains near your address');
    expect(landingCopyFor(null, 'water-flow').title).toBe('See where rain may flow near your address');
    expect(landingCopyFor(null, 'low-areas').title).toBe('Find low areas near your address');
    // No guide for terrain yet, so the plain title.
    expect(landingCopyFor(null, 'terrain')).toBe(EXPLORE_COPY);
    // The section changes only the title.
    expect(landingCopyFor(null, 'drainage').lead).toBe(EXPLORE_COPY.lead);
    expect(landingCopyFor(null, 'drainage').submit).toBe(EXPLORE_COPY.submit);
    // The comparison keeps its own words whatever section was last chosen.
    expect(landingCopyFor('compare', 'drainage')).toBe(COMPARE_COPY);
  });

  it('reads the section from the session the chooser leaves behind', () => {
    const chosen = reduce(INITIAL_SESSION, { type: 'guide-chosen', section: 'drainage' });
    expect(chosen.screen).toBe('address');
    expect(landingCopyFor(chosen.pendingTask, chosen.guideSection).title).toBe('Find drains near your address');
  });
});
