/**
 * The population date as the area panel says it.
 *
 * The panel names the date its resident count is from (AC 4.1.3, 4.1.4), and
 * the artefact carries it as an ISO date.
 */

import { describe, expect, it } from 'vitest';

import { monthYear } from './FloodMap.js';

describe('the date beside the resident count', () => {
  it('reads an ISO date as a month and a year', () => {
    expect(monthYear('2012-06-30')).toBe('June 2012');
    expect(monthYear('2009-01-01')).toBe('January 2009');
  });

  it('leaves anything else as it is rather than inventing a month', () => {
    expect(monthYear('2012')).toBe('2012');
    expect(monthYear('2012-13-01')).toBe('2012-13-01');
  });
});
