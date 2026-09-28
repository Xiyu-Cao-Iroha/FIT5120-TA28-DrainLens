/**
 * The flood map panel's own evidence lines, checked against AC 4.1.3, 4.1.4
 * and 4.3.4.
 *
 * The longer explanations are About the data now (copy audit v4, #83), and
 * `ui/sources.test.ts` checks that page against the artefacts.
 */

import { describe, expect, it } from 'vitest';

import { AREA_KINDS, NOT_A_FORECAST, RATE_TIP, TOTAL_TIP } from './evidence.js';
import { SOURCE_LINKS } from '../ui/sources.js';
import { FLOOD } from '../ui/terms.js';

describe('the area panel', () => {
  it('says one count is one time the SES was sent, and not one flood', () => {
    expect(FLOOD.explain).toBe('Each one is a time the SES was sent to help.');
    expect(TOTAL_TIP).toBe('Each one is a time the SES was sent to help, not one flood.');
  });

  it('says the rate is calculated from SES records and population, and is not people affected', () => {
    expect(RATE_TIP).toMatch(/^Our calculation/);
    expect(RATE_TIP).toContain('SES records');
    expect(RATE_TIP).toContain('Australian Bureau of Statistics');
    expect(RATE_TIP).toMatch(/not the number of people affected/);
    expect(RATE_TIP).not.toMatch(/score|severity/i);
  });

  it('keeps three kinds of information apart, each opening its own section (AC 4.3.4)', () => {
    const links = Object.values(AREA_KINDS).map((id) => SOURCE_LINKS[id]);
    expect(links.map((l) => l.label)).toEqual(['Past records', 'Our calculation', 'Checked by our team']);
    expect(new Set(links.map((l) => l.section)).size).toBe(3);
  });

  it('says neither view is a forecast, in one short line', () => {
    expect(NOT_A_FORECAST).toBe('Past data only, not a forecast.');
  });
});
