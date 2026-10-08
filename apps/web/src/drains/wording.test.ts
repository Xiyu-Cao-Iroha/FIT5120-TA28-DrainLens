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
  SWEEP_DETAIL,
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
  it('carries on from the summary rather than repeating it', () => {
    // It opened with the summary's own sentence, so the fold read as the same
    // note printed twice.
    expect(SWEEP_DETAIL).not.toContain(SWEEP_SUMMARY.replace('…', ''));
    expect(SWEEP_DETAIL.startsWith('Sweep them')).toBe(true);
  });

  it('offers only what is safe, and then says what is not', () => {
    expect(SWEEP_SUMMARY).toMatch(/sweep them away/);
    for (const boundary of [/when it is dry/, /stay on the footpath/, /Never lift the cover/, /reach inside/, /stand in the road/]) {
      expect(SWEEP_DETAIL).toMatch(boundary);
    }
  });

  it('sends a drain that is still blocked to the report rather than to a tool', () => {
    expect(SWEEP_DETAIL).toMatch(/report it/);
    expect(SWEEP_DETAIL).not.toMatch(/clear it|unblock|rod|hose/i);
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
