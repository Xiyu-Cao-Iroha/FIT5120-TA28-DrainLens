import { describe, expect, it } from 'vitest';

import {
  allOf,
  checkMassBalance,
  checkMonotonicity,
  failed,
  passed,
  type PositionExtent,
  type WaterBalance,
} from './checks.js';

/** A balance that adds up: 100 m³ fell, 100 m³ accounted for. */
const balanced = (over: Partial<WaterBalance> = {}): WaterBalance => ({
  rainfallVolumeM3: 100,
  capturedVolumeM3: 60,
  pondedVolumeM3: 25,
  leftWindowVolumeM3: 15,
  ...over,
});

const failures = (result: ReturnType<typeof checkMassBalance>): readonly string[] =>
  result.ok ? [] : result.failures;

describe('mass balance', () => {
  it('passes when every drop is accounted for', () => {
    expect(checkMassBalance(balanced())).toEqual(passed);
  });

  it('passes when the discrepancy is rounding rather than a leak', () => {
    // Half a percent of the input, inside the default one percent tolerance.
    expect(checkMassBalance(balanced({ leftWindowVolumeM3: 15.5 })).ok).toBe(true);
  });

  it('fails when water goes missing', () => {
    const result = checkMassBalance(balanced({ capturedVolumeM3: 40 }));
    expect(result.ok).toBe(false);
    expect(failures(result)[0]).toContain('less water than fell');
  });

  it('fails when water appears from nowhere', () => {
    const result = checkMassBalance(balanced({ pondedVolumeM3: 45 }));
    expect(result.ok).toBe(false);
    expect(failures(result)[0]).toContain('more water than fell');
  });

  it('scales the tolerance with the input, so a large window cannot hide a leak', () => {
    // 2 m³ lost. Trivial against 1000 m³ of rain, a real defect against 100.
    expect(checkMassBalance(balanced({ leftWindowVolumeM3: 13 })).ok).toBe(false);
    expect(
      checkMassBalance({
        rainfallVolumeM3: 1000,
        capturedVolumeM3: 600,
        pondedVolumeM3: 250,
        leftWindowVolumeM3: 148,
      }).ok,
    ).toBe(true);
  });

  it('accepts a stricter tolerance when one is asked for', () => {
    const nearlyBalanced = balanced({ leftWindowVolumeM3: 15.5 });
    expect(checkMassBalance(nearlyBalanced).ok).toBe(true);
    expect(checkMassBalance(nearlyBalanced, { toleranceFraction: 0.001 }).ok).toBe(false);
  });

  it('requires an empty balance when no rain fell', () => {
    const dry: WaterBalance = {
      rainfallVolumeM3: 0,
      capturedVolumeM3: 0,
      pondedVolumeM3: 0,
      leftWindowVolumeM3: 0,
    };
    expect(checkMassBalance(dry)).toEqual(passed);

    const result = checkMassBalance({ ...dry, pondedVolumeM3: 3 });
    expect(result.ok).toBe(false);
    expect(failures(result)[0]).toContain('no rain fell');
  });

  it('rejects a negative term outright rather than letting it cancel out', () => {
    // 60 - 5 + 45 still sums to 100. Without this check the balance would pass
    // while the engine was reporting a negative volume somewhere.
    const result = checkMassBalance(balanced({ pondedVolumeM3: -5, leftWindowVolumeM3: 45 }));
    expect(result.ok).toBe(false);
    expect(failures(result)[0]).toContain('pondedVolumeM3 is negative');
  });

  it('rejects a term that is not a finite number', () => {
    const result = checkMassBalance(balanced({ capturedVolumeM3: Number.NaN }));
    expect(result.ok).toBe(false);
    expect(failures(result)[0]).toContain('not a finite number');
  });

  it('reports every malformed term at once', () => {
    const result = checkMassBalance({
      rainfallVolumeM3: -1,
      capturedVolumeM3: Number.POSITIVE_INFINITY,
      pondedVolumeM3: 0,
      leftWindowVolumeM3: 0,
    });
    expect(failures(result)).toHaveLength(2);
  });
});

const ascending: readonly PositionExtent[] = [
  { accumulatedRainfallMm: 10, pondedCells: 0 },
  { accumulatedRainfallMm: 25, pondedCells: 40 },
  { accumulatedRainfallMm: 40, pondedCells: 40 },
  { accumulatedRainfallMm: 60, pondedCells: 190 },
];

describe('monotonicity', () => {
  it('passes when ponding grows or holds steady as rainfall rises', () => {
    expect(checkMonotonicity(ascending)).toEqual(passed);
  });

  it('passes for a single position', () => {
    expect(checkMonotonicity([{ accumulatedRainfallMm: 10, pondedCells: 3 }])).toEqual(passed);
  });

  it('fails when ponding shrinks as the storm gets heavier', () => {
    const result = checkMonotonicity([
      { accumulatedRainfallMm: 25, pondedCells: 90 },
      { accumulatedRainfallMm: 40, pondedCells: 60 },
    ]);
    expect(result.ok).toBe(false);
    expect(failures(result)[0]).toContain('ponding shrank');
  });

  it('fails when the positions do not ascend in rainfall', () => {
    const result = checkMonotonicity([
      { accumulatedRainfallMm: 40, pondedCells: 10 },
      { accumulatedRainfallMm: 25, pondedCells: 20 },
    ]);
    expect(result.ok).toBe(false);
    expect(failures(result)[0]).toContain('must ascend in rainfall');
  });

  it('fails when two positions sit at the same rainfall', () => {
    const result = checkMonotonicity([
      { accumulatedRainfallMm: 25, pondedCells: 10 },
      { accumulatedRainfallMm: 25, pondedCells: 10 },
    ]);
    expect(result.ok).toBe(false);
    expect(failures(result)[0]).toContain('must ascend in rainfall');
  });

  it('fails when no position was solved', () => {
    const result = checkMonotonicity([]);
    expect(result.ok).toBe(false);
    expect(failures(result)[0]).toContain('at least one position');
  });

  it('rejects impossible inputs before comparing them', () => {
    const result = checkMonotonicity([
      { accumulatedRainfallMm: -5, pondedCells: 10 },
      { accumulatedRainfallMm: 25, pondedCells: 2.5 },
    ]);
    expect(failures(result)).toHaveLength(2);
    expect(failures(result)[0]).toContain('impossible rainfall');
    expect(failures(result)[1]).toContain('impossible ponded-cell count');
  });

  it('reports every backward step, not just the first', () => {
    const result = checkMonotonicity([
      { accumulatedRainfallMm: 10, pondedCells: 100 },
      { accumulatedRainfallMm: 25, pondedCells: 50 },
      { accumulatedRainfallMm: 40, pondedCells: 10 },
    ]);
    expect(failures(result)).toHaveLength(2);
  });
});

describe('allOf', () => {
  it('passes when every check passes', () => {
    expect(allOf(passed, checkMonotonicity(ascending), checkMassBalance(balanced()))).toEqual(passed);
  });

  it('passes when given nothing to check', () => {
    expect(allOf()).toEqual(passed);
  });

  it('keeps the failures from every check rather than stopping at the first', () => {
    const result = allOf(failed('one'), passed, failed('two', 'three'));
    expect(failures(result)).toEqual(['one', 'two', 'three']);
  });
});
