/**
 * The engine's monotonicity guard, tested by making the check fail.
 *
 * This lives in its own file because it mocks `./checks.js`, and a module
 * mock is scoped to the file that declares it. `engine.test.ts` uses the
 * *real* `checkMonotonicity` to assert the engine's own output is
 * consistent; that is the property. This file asserts the separate thing:
 * that if the property is ever violated, the result is withheld rather than
 * drawn.
 *
 * It has to be mocked because the violation cannot be produced honestly. The
 * arithmetic does not run backwards, so there is no scene and no rainfall
 * that makes ponding shrink as the storm grows — which is the point of the
 * guard, and also the reason it can only be reached by stubbing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./checks.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./checks.js')>();
  return { ...actual, checkMonotonicity: vi.fn(actual.checkMonotonicity) };
});

import { LEAVES_WINDOW, type Depression, d8FromElevations, depressionFieldFrom } from './flow.js';
import { checkMonotonicity, failed } from './checks.js';

// The real implementation, kept so each test starts from it. `mockClear`
// forgets calls but keeps a `mockReturnValue`, which silently leaked a
// refusal from one test into the next when this file was first written.
const { checkMonotonicity: realCheck } =
  await vi.importActual<typeof import('./checks.js')>('./checks.js');
import { type SceneInput, runScenario } from './engine.js';
import { bowl } from './terrain.js';

function bowlScene(drainCells: readonly number[]): SceneInput {
  const fixture = bowl({ width: 10, height: 10, cellSizeM: 5, depthM: 0.4, pitWidth: 4, pitHeight: 4 });
  const depression: Depression = {
    id: 0,
    cells: fixture.depressionCells,
    capacityM3: fixture.capacityM3,
    spillElevationM: fixture.spillElevationM,
    spillCell: LEAVES_WINDOW,
  };
  return {
    grid: fixture.grid,
    flow: d8FromElevations(fixture.grid),
    depressions: depressionFieldFrom(fixture.grid, [depression]),
    drains: drainCells.map((cell, i) => ({ assetNumber: `P-${String(i)}`, cell })),
  };
}

const POSITIONS = { rainfallPositionsMm: [20, 40, 60] };

describe('a slider that goes backwards is withheld, not drawn', () => {
  beforeEach(() => {
    vi.mocked(checkMonotonicity).mockReset().mockImplementation(realCheck);
  });

  it('runs the check over both the scenario and the baseline', () => {
    runScenario(bowlScene([12]), 'fully-blocked', 12, POSITIONS);
    expect(vi.mocked(checkMonotonicity)).toHaveBeenCalledTimes(2);
  });

  it('refuses the comparison when ponding shrinks as rainfall rises', () => {
    vi.mocked(checkMonotonicity).mockReturnValue(
      failed('ponding shrank as rainfall rose: 40 cells at 20 mm, 12 cells at 40 mm'),
    );
    const outcome = runScenario(bowlScene([12]), 'fully-blocked', 12, POSITIONS);
    expect(outcome).toEqual({ status: 'insufficient-information', reason: 'scenario_calculation_failed' });
  });

  it('refuses it when only the baseline is inconsistent', () => {
    // The scenario run is checked first, so passing once and failing once
    // proves the baseline is checked too rather than short-circuited past.
    vi.mocked(checkMonotonicity)
      .mockReturnValueOnce({ ok: true })
      .mockReturnValueOnce(failed('ponding shrank as rainfall rose'));
    const outcome = runScenario(bowlScene([12]), 'fully-blocked', 12, POSITIONS);
    expect(outcome).toEqual({ status: 'insufficient-information', reason: 'scenario_calculation_failed' });
  });

  it('does not refuse a consistent one', () => {
    const outcome = runScenario(bowlScene([12]), 'fully-blocked', 12, POSITIONS);
    expect(outcome.status).toBe('successful');
  });
});
