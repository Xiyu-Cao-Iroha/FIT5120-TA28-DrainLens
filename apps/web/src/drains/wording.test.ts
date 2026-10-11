/**
 * The panel's sentences, held to what they are allowed to claim.
 *
 * Two of these are the point. The count sentence has to carry *not a
 * selection*, because a list of drains without it reads as the drains that
 * matter — a judgement nothing in this product has made. And the sweep note
 * has to carry all four prohibitions, because it is the one place a resident
 * is being told they may touch a drain at all.
 */

import { describe, expect, it } from 'vitest';

import { DRAIN_RADIUS_M, STREET_MATCH_M } from './nearby.js';
import {
  DRAIN_SOURCE,
  NO_DRAINS_STILL,
  OTHER_DRAINS_WHY,
  SWEEP_FULL,
  SWEEP_LEAD,
  SWEEP_REST,
  SWEEP_SUMMARY,
  drainCount,
  moreStreets,
  noDrains,
  noOwnStreet,
} from './wording.js';

describe('the count sentence', () => {
  it('says the list is everything, not a shortlist', () => {
    expect(drainCount(107, '46 Gatehouse Drive')).toBe(
      '107 recorded street drains within 200 m of 46 Gatehouse Drive. This is every recorded drain nearby, not a selection.',
    );
  });

  it('names the radius it actually searched', () => {
    expect(drainCount(1, 'x')).toContain(`${String(DRAIN_RADIUS_M)} m`);
  });

  it('says drain, singular, when there is one', () => {
    expect(drainCount(1, 'x')).toMatch(/^1 recorded street drain within/);
    expect(moreStreets(1)).toBe('1 more street, largest first');
  });
});

describe('what the sweep note is allowed to say', () => {
  it('is one sentence folded, not two sentences stacked', () => {
    /*
      The 11 October report: the text is still broken when it opens. It was
      a summary and then a paragraph of its own, so the fold added a second
      sentence where the design lengthens the first. Open has to be the
      folded line with the rest of its own sentence on the end, to the
      character, or the ellipsis is promising something it does not deliver.
    */
    expect(SWEEP_SUMMARY).toBe(`${SWEEP_LEAD}…`);
    expect(SWEEP_FULL).toBe(`${SWEEP_LEAD}${SWEEP_REST}`);
    expect(SWEEP_FULL.startsWith(SWEEP_LEAD)).toBe(true);
    // The join is a space inside one sentence, not a full stop between two.
    expect(SWEEP_LEAD.endsWith('.')).toBe(false);
    expect(SWEEP_REST.startsWith(' ')).toBe(true);
    expect(SWEEP_FULL).toContain('sweep them away when it is dry');
  });

  it('offers only what is safe, and then says what is not', () => {
    expect(SWEEP_SUMMARY).toMatch(/sweep them away/);
    for (const boundary of [/when it is dry/, /stay on the footpath/, /Never lift the cover/, /reach inside/, /stand in the road/]) {
      expect(SWEEP_FULL).toMatch(boundary);
    }
  });

  it('sends a drain that is still blocked to the report rather than to a tool', () => {
    expect(SWEEP_FULL).toMatch(/report it/);
    expect(SWEEP_FULL).not.toMatch(/clear it|unblock|rod|hose/i);
  });
});

describe('the absences', () => {
  it('never reads an absence of drains as an absence of risk', () => {
    expect(noDrains('46 Gatehouse Drive')).toBe(
      'No recorded street drain was found within 200 m of 46 Gatehouse Drive.',
    );
    expect(NO_DRAINS_STILL).toMatch(/still applies/);
  });

  it('says why a drain has no street rather than leaving it a mystery', () => {
    expect(OTHER_DRAINS_WHY).toContain(`${String(STREET_MATCH_M)} m`);
  });

  it('explains the order when the reader’s own street holds none', () => {
    expect(noOwnStreet('Gatehouse Drive')).toBe(
      'No recorded drain is labelled with Gatehouse Drive, so the street with the most drains is shown first.',
    );
  });
});

describe('where a drain’s record comes from', () => {
  it('names the dataset rather than claiming the drain was inspected', () => {
    expect(DRAIN_SOURCE).toBe('Recorded in the City of Melbourne Stormwater Pits dataset.');
    expect(DRAIN_SOURCE).not.toMatch(/working|clear|blocked|maintained/i);
  });
});
