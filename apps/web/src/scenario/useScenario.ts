/**
 * The worker, from the screen's point of view.
 *
 * One worker for the tab, loaded once. Requests carry an id and replies are
 * matched against the newest one, so a person who changes the blockage while a
 * comparison is running sees the answer to what they asked last rather than
 * whichever run happened to finish second.
 *
 * **It loads only where it is needed.** Starting the worker fetches the scene:
 * `scene.json` plus the elevation, flow, depression and coverage arrays, a bit
 * over five megabytes. That used to happen on every visit, including visits
 * that never left the homepage. With the comparison out of the Iteration 1
 * interface (AC 1.1.1) it would be five megabytes for a screen nobody can
 * reach, so the caller says when it is wanted and the worker starts then.
 *
 * The map's own ground surface is a separate, smaller read in `terrain.ts`,
 * and is unaffected by this.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type BlockageSetting,
  type InsufficiencyReason,
  VALIDATED_RAINFALL_LEVELS_MM,
  isValidatedRainfall,
} from '@drainlens/schema';

import type { SceneDrain, SolvedPosition, WorkerReply, WorkerRequest } from './worker.js';

export type ScenarioResult =
  | {
      readonly status: 'successful';
      readonly band: 'no-clear-change' | 'higher-than-baseline';
      /** Every position solved by this run, ascending. The control reads these. */
      readonly positions: readonly SolvedPosition[];
      /** Metres per grid cell, for sizing the difference layer on the map. */
      readonly cellSizeM: number;
    }
  | { readonly status: 'insufficient-information'; readonly reason: InsufficiencyReason };

export interface ScenarioRunner {
  readonly ready: boolean;
  /**
   * The drains the scene places, once it has loaded.
   *
   * The single source for which pits a scenario can use and which cell each
   * one occupies. Deriving either from the map artefact is what produced a
   * suggestion the engine rejected for every pit in the extent.
   */
  readonly drains: readonly SceneDrain[];
  /** The scene's south-west corner in MGA metres, once loaded. */
  readonly origin: { readonly minE: number; readonly minN: number } | null;
  readonly running: boolean;
  readonly failure: string | null;
  readonly run: (
    drainCell: number,
    blockage: BlockageSetting,
    rainfallMm: number,
  ) => Promise<ScenarioResult>;
}

/**
 * Rainfall positions solved for one comparison.
 *
 * Every position is solved from zero independently, so the answer at 40 mm
 * does not depend on the interface having asked about 20 mm first. Solving the
 * three published amounts together costs one pass and means a person changing
 * amounts is reading a cache rather than waiting again.
 */
export const POSITIONS_MM: readonly number[] = VALIDATED_RAINFALL_LEVELS_MM;

/**
 * The rainfall amounts one run solves, given the one that was asked for.
 *
 * The validated three, **strictly ascending** — the engine refuses an
 * unordered or duplicated list, and it is right to: a position list that is
 * not sorted produces a monotonicity check comparing the wrong pair.
 *
 * It used to append whatever amount was asked for, which is how a typed 500
 * mm reached the engine. An amount outside the validated set is now refused
 * here, and the setup screen no longer offers a way to type one.
 *
 * Pulled out of the hook so it can be tested. It was four lines inside a
 * `useCallback` inside a `useEffect`-bearing hook, which meant the only way to
 * exercise the engine's own precondition was to render React.
 */
export function positionsFor(rainfallMm: number): number[] {
  if (!isValidatedRainfall(rainfallMm)) {
    throw new Error(`${String(rainfallMm)} mm is not a validated rainfall level`);
  }
  return [...POSITIONS_MM].sort((a, b) => a - b);
}

/**
 * A worker reply as the screen reads it.
 *
 * Everything that is not a successful result becomes an insufficiency with a
 * named reason, including the two shapes that should not arrive at all: a
 * `failed` message, and a `loaded` reply carrying a run's id — which would
 * mean the worker answered a different question from the one asked. Reading
 * fields off that would be reading `undefined` as an answer.
 *
 * Pulled out of the hook for the same reason as `positionsFor`, and it is the
 * more valuable of the two: this is the mapping the result screen depends on.
 */
export function resultOf(reply: WorkerReply): ScenarioResult {
  if (reply.type !== 'result') {
    return { status: 'insufficient-information', reason: 'scenario_calculation_failed' };
  }
  if (reply.status !== 'successful') {
    return {
      status: 'insufficient-information',
      reason: reply.reason as InsufficiencyReason,
    };
  }
  return {
    status: 'successful',
    band: reply.band,
    positions: reply.positions,
    cellSizeM: reply.cellSizeM,
  };
}

export function useScenario(base: string, enabled = true): ScenarioRunner {
  const workerRef = useRef<Worker | null>(null);
  const nextId = useRef(1);
  const pending = useRef(new Map<number, (reply: WorkerReply) => void>());
  const [ready, setReady] = useState(false);
  const [drains, setDrains] = useState<readonly SceneDrain[]>([]);
  const [origin, setOrigin] = useState<{ readonly minE: number; readonly minN: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.type === 'loaded') {
        setDrains(reply.drains);
        setOrigin(reply.origin);
        setReady(true);
        return;
      }
      const waiting = pending.current.get(reply.id);
      if (waiting) {
        pending.current.delete(reply.id);
        waiting(reply);
      }
    };
    worker.onerror = (event) => setFailure(event.message || 'the scenario worker failed to start');

    const id = nextId.current++;
    worker.postMessage({ type: 'load', id, base } satisfies WorkerRequest);

    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.current.clear();
    };
  }, [base, enabled]);

  const run = useCallback(
    (drainCell: number, blockage: BlockageSetting, rainfallMm: number) =>
      new Promise<ScenarioResult>((resolve) => {
        const worker = workerRef.current;
        if (worker === null) {
          resolve({ status: 'insufficient-information', reason: 'scenario_calculation_failed' });
          return;
        }

        // Refused before the worker is asked. A throw inside this executor
        // would reject a promise nobody catches.
        if (!isValidatedRainfall(rainfallMm)) {
          resolve({ status: 'insufficient-information', reason: 'scenario_calculation_failed' });
          return;
        }
        const positions = positionsFor(rainfallMm);
        const id = nextId.current++;

        setRunning(true);
        pending.current.set(id, (reply) => {
          setRunning(false);
          // The message goes on the screen, so it is kept here rather than in
          // `resultOf` — which says what the run produced, not what to show.
          if (reply.type === 'failed') setFailure(reply.message);
          resolve(resultOf(reply));
        });

        worker.postMessage({
          type: 'run',
          id,
          drainCell,
          blockage,
          rainfallPositionsMm: positions,
        } satisfies WorkerRequest);
      }),
    [],
  );

  return { ready, drains, origin, running, failure, run };
}
