/**
 * The two decisions the scenario hook makes, outside React.
 *
 * `useScenario.ts` was at **0% — eighty-four statements, untested**. Most of
 * it is worker plumbing that needs a renderer and a `Worker`, but two pieces
 * were pure logic trapped inside a `useCallback`: which rainfall amounts a run
 * solves, and how a worker reply becomes something the screen can read. Both
 * are now exported, and both are worth more than their size.
 *
 * `positionsFor` feeds a precondition the engine throws on. `resultOf` decides
 * whether a person sees an answer or an insufficiency — and the result screen
 * reads fields that exist on only one of those.
 */

import { describe, expect, it } from 'vitest';

import { POSITIONS_MM, positionsFor, resultOf } from './useScenario.js';
import type { SolvedPosition, WorkerReply } from './worker.js';

const position = (rainfallMm: number): SolvedPosition => ({
  rainfallMm,
  band: 'no-clear-change',
  cellsHigherThanBaseline: 0,
  higherAreasM: [],
});

describe('which rainfall amounts a run solves', () => {
  it('solves the three published amounts', () => {
    // One pass covers them all, so moving the control afterwards reads a cache
    // rather than waiting again.
    expect(positionsFor(40)).toEqual([...POSITIONS_MM]);
  });

  it('adds the requested amount when it is not one of them', () => {
    expect(positionsFor(35)).toEqual([20, 35, 40, 60]);
    expect(positionsFor(5)).toEqual([5, 20, 40, 60]);
    expect(positionsFor(90)).toEqual([20, 40, 60, 90]);
  });

  it('never repeats an amount', () => {
    // A duplicate is not merely untidy: the engine refuses a list that is not
    // strictly ascending, and the refusal reaches a resident as a failed
    // calculation.
    for (const mm of POSITIONS_MM) {
      expect(positionsFor(mm)).toHaveLength(POSITIONS_MM.length);
    }
  });

  it('is strictly ascending for every amount, which is the engine precondition', () => {
    for (const mm of [0, 1, 19, 20, 21, 40, 59, 60, 61, 120, 200]) {
      const positions = positionsFor(mm);
      for (let i = 1; i < positions.length; i += 1) {
        expect(positions[i]!).toBeGreaterThan(positions[i - 1]!);
      }
      expect(positions).toContain(mm);
    }
  });

  it('sorts numerically, not as text', () => {
    // The classic: a default sort puts 100 before 20.
    expect(positionsFor(100)).toEqual([20, 40, 60, 100]);
  });
});

describe('reading a worker reply', () => {
  const successful: WorkerReply = {
    type: 'result',
    id: 1,
    status: 'successful',
    band: 'higher-than-baseline',
    positions: [position(20), position(40), position(60)],
    cellsHigherThanBaseline: 12,
    cellSizeM: 5,
  } as WorkerReply;

  it('passes a successful result through with everything the screen draws', () => {
    const result = resultOf(successful);
    expect(result.status).toBe('successful');
    if (result.status !== 'successful') return;
    expect(result.band).toBe('higher-than-baseline');
    expect(result.positions).toHaveLength(3);
    expect(result.cellSizeM).toBe(5);
  });

  it('carries the engine reason through on an insufficiency', () => {
    // Each reason is explained by the interface in its own words, so losing
    // it would turn four different explanations into one shrug.
    for (const reason of [
      'terrain_unavailable',
      'invalid_inlet',
      'scenario_calculation_failed',
      'comparison_not_comparable',
    ] as const) {
      const result = resultOf({
        type: 'result',
        id: 1,
        status: 'insufficient-information',
        reason,
      } as WorkerReply);
      expect(result).toEqual({ status: 'insufficient-information', reason });
    }
  });

  it('reads a failed worker as a failed calculation', () => {
    const result = resultOf({ type: 'failed', id: 1, message: 'the scene is missing' });
    expect(result).toEqual({
      status: 'insufficient-information',
      reason: 'scenario_calculation_failed',
    });
  });

  it('refuses a loaded reply carrying a run id rather than reading fields off it', () => {
    /*
     * This would mean the worker answered a different question from the one
     * asked. There is no band and no positions on a `loaded` reply, so the
     * alternative is a result screen rendering `undefined` as an answer.
     */
    const result = resultOf({ type: 'loaded', id: 9, drains: [], inlets: 0 });
    expect(result.status).toBe('insufficient-information');
  });

  it('never produces a result carrying both a band and a reason', () => {
    // The same structural distinction `RESULT_STATUSES` keeps on the wire,
    // held at the boundary where the screen reads it.
    const replies: WorkerReply[] = [
      successful,
      { type: 'failed', id: 1, message: 'x' },
      { type: 'loaded', id: 1, drains: [], inlets: 0 },
      { type: 'result', id: 1, status: 'insufficient-information', reason: 'invalid_inlet' } as WorkerReply,
    ];
    for (const reply of replies) {
      const asAny = resultOf(reply) as Record<string, unknown>;
      expect('band' in asAny && 'reason' in asAny).toBe(false);
    }
  });
});
