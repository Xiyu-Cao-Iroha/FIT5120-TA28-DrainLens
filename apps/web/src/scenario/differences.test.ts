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

  it('writes the hint in the model’s terms, or nothing', () => {
    expect(differenceHint(FILE, '11')).toBe(
      'In this model, a blockage at this drain shows a difference with: Partly blocked at 60 mm; Fully blocked at 40 mm or 60 mm.',
    );
    expect(differenceHint(FILE, '99')).toBeNull();
    expect(differenceHint(null, '11')).toBeNull();
  });

  it('loads as nothing rather than failing the comparison', async () => {
    expect(await loadDifferences('x', () => Promise.resolve(FILE))).toEqual(FILE);
    expect(await loadDifferences('x', () => Promise.resolve({ artefact: 'nope' }))).toBeNull();
    expect(await loadDifferences('x', () => Promise.reject(new Error('404')))).toBeNull();
  });
});
