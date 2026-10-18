import { describe, expect, it } from 'vitest';

import {
  type DifferencesArtefact,
  DifferencesError,
  assertDifferences,
  differenceHint,
  differenceSettings,
  differingDrains,
  loadDifferences,
} from './differences.js';

const FILE: DifferencesArtefact = {
  artefact: 'scenario-differences',
  version: 1,
  rainfallMm: [20, 40, 60],
  drains: {
    '11': { 'fully-blocked': [0, 12, 30], 'partly-blocked': [0, 0, 4] },
    '12': { 'fully-blocked': [3, 0, 0] },
    '13': { 'partly-blocked': [0, 0, 0] },
  },
};

describe('the differences file', () => {
  it('passes a well-formed file and refuses a malformed one', () => {
    expect(() => {
      assertDifferences(FILE);
    }).not.toThrow();
    expect(() => {
      assertDifferences({ ...FILE, artefact: 'x' });
    }).toThrow(DifferencesError);
    expect(() => {
      assertDifferences({ ...FILE, drains: { '1': { 'fully-blocked': [1] } } });
    }).toThrow(/wrong number/);
    expect(() => {
      assertDifferences({ ...FILE, drains: { '1': { clear: [1, 1, 1] } } });
    }).toThrow(/did not run/);
  });

  it('lists only drains with a difference somewhere', () => {
    expect([...differingDrains(FILE)].sort()).toEqual(['11', '12']);
    expect(differingDrains(null).size).toBe(0);
  });

  it('says which settings and amounts differ', () => {
    expect(differenceSettings(FILE, '11')).toEqual([
      { blockage: 'partly-blocked', rainfallMm: [60] },
      { blockage: 'fully-blocked', rainfallMm: [40, 60] },
    ]);
    expect(differenceSettings(FILE, '13')).toEqual([]);
    expect(differenceSettings(FILE, null)).toEqual([]);
  });

  it('warns that some choices show nothing, without listing them', () => {
    /*
      **It used to list the combinations** and read *In this model, a
      blockage at this drain shows a difference with: Partly blocked at
      60 mm; Fully blocked at 40 mm or 60 mm*, which is two nested lists a
      reader has to decode before choosing anything.

      The census still decides whether to say anything at all, which is the
      half of this that matters: a drain the model separates under no
      combination gets null rather than a sentence implying there is
      something to find.
    */
    expect(differenceHint(FILE, '11')).toBe(
      'Some choices may show no visible difference in this model.',
    );
    expect(differenceHint(FILE, '13')).toBeNull();
    expect(differenceHint(FILE, '99')).toBeNull();
    expect(differenceHint(null, '11')).toBeNull();
  });

  it('loads as nothing rather than failing the comparison', async () => {
    expect(await loadDifferences('x', () => Promise.resolve(FILE))).toEqual(FILE);
    expect(await loadDifferences('x', () => Promise.resolve({ artefact: 'nope' }))).toBeNull();
    expect(await loadDifferences('x', () => Promise.reject(new Error('404')))).toBeNull();
  });
});
