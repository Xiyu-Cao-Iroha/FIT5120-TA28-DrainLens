/**
 * The address screen says which task the address is for.
 *
 * In the 15 September user test the comparison's address screen used the
 * explorer's words, and the person read *Explore this area* as having been
 * sent somewhere other than the comparison they had just chosen.
 */

import { describe, expect, it } from 'vitest';

import { ADDRESS_STAYS_HERE, COMPARE_COPY, EXPLORE_COPY, landingCopyFor } from './Landing.js';
import { INITIAL_SESSION, reduce } from '../session.js';

describe('the address screen’s words', () => {
  it('uses the comparison’s own words when the comparison is waiting', () => {
    const waiting = reduce(INITIAL_SESSION, { type: 'task-wanted', task: 'compare', from: 'home' });
    expect(waiting.screen).toBe('address');
    const copy = landingCopyFor(waiting.pendingTask);
    expect(copy).toBe(COMPARE_COPY);
    // The team's Figma, H2 and H3.
    expect(copy.title).toBe('Which address do you want to check?');
    // *Compare*, not *test*: the audit's first finding, and this screen
    // sets the expectation before any of the labels inside the flow do.
    expect(copy.lead).toBe('We’ll find a drain near it to compare clear against blocked.');
    expect(copy.lead).not.toMatch(/test/i);
    expect(copy.submit).toBe('Find a drain →');
  });

  it('keeps the explorer’s words for every other way in', () => {
    expect(landingCopyFor(null)).toBe(EXPLORE_COPY);
    expect(landingCopyFor(undefined)).toBe(EXPLORE_COPY);
    expect(landingCopyFor('follow')).toBe(EXPLORE_COPY);
    // Figma T0: one title for every way in, and the lead says what is next.
    expect(EXPLORE_COPY.submit).toBe('Continue →');
    expect(EXPLORE_COPY.title).toBe('Start with your address');
    expect(EXPLORE_COPY.lead).toBe('Enter it once. Every guide and the full map will use it.');
  });

  it('says what the address is for, where the design draws a screen for it', () => {
    /*
      T0g, T0d and T0m. It was a title per section -- *Find drains near your
      address* -- which named the guide in the heading and left the line
      under it saying only which council the map covers. The design keeps
      one heading and spends the line on what happens next.
    */
    expect(landingCopyFor(null, 'heavy-rain').lead).toBe(
      'Enter it once. The Get ready for heavy rain guide starts next.',
    );
    expect(landingCopyFor(null, 'drainage-area').lead).toBe(
      'Enter it once. The drainage problem guide starts next.',
    );
    expect(landingCopyFor('full-map').lead).toBe('Enter it once. The full map opens next.');

    // The guides the design draws no screen for keep T0's generic line.
    expect(landingCopyFor(null, 'drainage')).toBe(EXPLORE_COPY);
    expect(landingCopyFor(null, 'terrain')).toBe(EXPLORE_COPY);

    // The title and the button never change with the section.
    expect(landingCopyFor(null, 'heavy-rain').title).toBe(EXPLORE_COPY.title);
    expect(landingCopyFor(null, 'heavy-rain').submit).toBe(EXPLORE_COPY.submit);

    // The comparison keeps its own words whatever section was last chosen.
    expect(landingCopyFor('compare', 'drainage')).toBe(COMPARE_COPY);
  });

  it('reads the section from the session the chooser leaves behind', () => {
    const chosen = reduce(INITIAL_SESSION, { type: 'guide-chosen', section: 'heavy-rain' });
    expect(chosen.screen).toBe('address');
    expect(landingCopyFor(chosen.pendingTask, chosen.guideSection).lead).toBe(
      'Enter it once. The Get ready for heavy rain guide starts next.',
    );
  });
});

/**
 * The line under the search box, which nothing pinned while it went stale.
 *
 * It promised *Your address stays in this browser only* for three weeks after
 * a submitted search moved to `POST /api/addresses/search` on 9 October --
 * `DECISIONS-PENDING.md` §14. The privacy panel was rewritten that day
 * and this line was missed, and the reason it could be missed is that no test
 * had an opinion about it. This is that opinion: the withdrawn claim cannot
 * come back by itself, and the part that was never in question stays.
 */
describe('what the address screen promises about the address', () => {
  it('does not claim the search stays in the browser', () => {
    for (const withdrawn of [
      /in this browser/i,
      /in your browser/i,
      /browser only/i,
      /never leaves/i,
      /(is |are )?not sent/i,
      /on this device/i,
    ]) {
      expect(ADDRESS_STAYS_HERE).not.toMatch(withdrawn);
    }
  });

  it('says where the address goes and that nothing is kept', () => {
    // The privacy panel's claim in fewer words; `ui/sources.ts` has the whole
    // of it. Going silent about the server was the thing not to do here.
    expect(ADDRESS_STAYS_HERE).toMatch(/searched by DrainLens/);
    expect(ADDRESS_STAYS_HERE).toMatch(/is not kept/);
  });

  it('keeps the clause that was never in question', () => {
    expect(ADDRESS_STAYS_HERE).toContain('You can change it at any time.');
  });

  it('stays short enough for a line under a search field', () => {
    // Two sentences. The panel is where a longer version belongs.
    expect(ADDRESS_STAYS_HERE.split('. ').length).toBe(2);
    expect(ADDRESS_STAYS_HERE.length).toBeLessThan(100);
  });
});
