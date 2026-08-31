/**
 * The worker, from the screen's point of view.
 *
 * One worker for the tab, loaded once. Requests carry an id and replies are
 * matched against the newest one, so a person who changes the blockage while a
 * comparison is running sees the answer to what they asked last rather than
 * whichever run happened to finish second.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { BlockageSetting, InsufficiencyReason } from '@drainlens/schema';

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
export const POSITIONS_MM: readonly number[] = [20, 40, 60];

export function useScenario(base: string): ScenarioRunner {
  const workerRef = useRef<Worker | null>(null);
  const nextId = useRef(1);
  const pending = useRef(new Map<number, (reply: WorkerReply) => void>());
  const [ready, setReady] = useState(false);
  const [drains, setDrains] = useState<readonly SceneDrain[]>([]);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.type === 'loaded') {
        setDrains(reply.drains);
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
  }, [base]);

  const run = useCallback(
    (drainCell: number, blockage: BlockageSetting, rainfallMm: number) =>
      new Promise<ScenarioResult>((resolve) => {
        const worker = workerRef.current;
        if (worker === null) {
          resolve({ status: 'insufficient-information', reason: 'scenario_calculation_failed' });
          return;
        }

        // The requested amount is solved even when it is not one of the three
        // published ones, and the list stays strictly ascending because the
        // engine requires it.
        const positions = [...new Set([...POSITIONS_MM, rainfallMm])].sort((a, b) => a - b);
        const id = nextId.current++;

        setRunning(true);
        pending.current.set(id, (reply) => {
          setRunning(false);
          if (reply.type === 'failed') {
            setFailure(reply.message);
            resolve({ status: 'insufficient-information', reason: 'scenario_calculation_failed' });
            return;
          }
          if (reply.type !== 'result') {
            // A `loaded` reply carrying a run's id would mean the worker
            // answered the wrong question; treat it as a failed calculation
            // rather than reading fields that are not there.
            resolve({ status: 'insufficient-information', reason: 'scenario_calculation_failed' });
            return;
          }
          resolve(
            reply.status === 'successful'
              ? {
                  status: 'successful',
                  band: reply.band,
                  positions: reply.positions,
                  cellSizeM: reply.cellSizeM,
                }
              : {
                  status: 'insufficient-information',
                  reason: reply.reason as InsufficiencyReason,
                },
          );
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

  return { ready, drains, running, failure, run };
}
