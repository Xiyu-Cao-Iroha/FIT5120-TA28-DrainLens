/**
 * The scenario engine, off the main thread.
 *
 * A comparison solves the whole grid twice for every rainfall position. On the
 * main thread that freezes the map mid-gesture, and a frozen map during a
 * calculation reads as a crash — the person taps again, and now two runs are
 * competing.
 *
 * The worker loads the scene once and keeps it. Every subsequent comparison is
 * arithmetic over arrays already in memory, so changing a blockage setting
 * costs a calculation rather than a megabyte.
 */

import { runScenario } from '@drainlens/scenario';
import type { BlockageSetting } from '@drainlens/schema';

import { type LoadedScene, loadScene } from './scene.js';

export interface RunRequest {
  readonly type: 'run';
  readonly id: number;
  readonly drainCell: number;
  readonly blockage: BlockageSetting;
  readonly rainfallPositionsMm: readonly number[];
}

export interface LoadRequest {
  readonly type: 'load';
  readonly id: number;
  readonly base: string;
}

export type WorkerRequest = LoadRequest | RunRequest;

/** One accumulated-rainfall position, as the interface needs it. */
export interface SolvedPosition {
  readonly rainfallMm: number;
  readonly band: 'no-clear-change' | 'higher-than-baseline';
  readonly cellsHigherThanBaseline: number;
}

/** A drain as the scene places it. The `cell` is authoritative — see below. */
export interface SceneDrain {
  readonly assetNumber: string;
  readonly cell: number;
  readonly isInlet: boolean;
}

export type WorkerReply =
  | {
      readonly type: 'loaded';
      readonly id: number;
      /**
       * Every drain, with the cell the scene put it in.
       *
       * The interface must never work this out for itself. The pipeline snaps
       * each drain up to three metres onto the flow field — a kerbside inlet
       * recorded in the middle of the road belongs to the gutter it drains,
       * not to the cell its coordinate landed in — so a cell derived from the
       * map geometry disagrees with the scene for every drain in the extent,
       * and the engine then finds no drain there at all.
       */
      readonly drains: readonly SceneDrain[];
      readonly inlets: number;
    }
  | {
      readonly type: 'result';
      readonly id: number;
      readonly status: 'successful';
      /**
       * Every position the run solved, ascending.
       *
       * The engine solves them all in one pass whether or not anybody asks, so
       * returning only the last threw away the answer to the next question the
       * person is going to ask. AC 2.2.2 is then a lookup rather than a rerun,
       * which is what keeps the rainfall control honest: it cannot quietly
       * re-solve with a different assumption between two readings.
       */
      readonly positions: readonly SolvedPosition[];
      readonly band: 'no-clear-change' | 'higher-than-baseline';
      readonly cellsHigherThanBaseline: number;
    }
  | {
      readonly type: 'result';
      readonly id: number;
      readonly status: 'insufficient-information';
      readonly reason: string;
    }
  | { readonly type: 'failed'; readonly id: number; readonly message: string };

let scene: LoadedScene | null = null;

/**
 * Turn an engine outcome into a reply.
 *
 * A thrown error becomes `scenario_calculation_failed` rather than escaping.
 * The engine throws for caller mistakes — an empty or unordered position list —
 * and those are defects, but a defect that reaches a resident should still be
 * a screen that says what happened and offers a retry, not a blank page.
 */
export function handle(request: WorkerRequest, loaded: LoadedScene | null): WorkerReply {
  if (request.type === 'load') {
    throw new Error('a load request is handled asynchronously, not here');
  }
  if (loaded === null) {
    return { type: 'failed', id: request.id, message: 'the scene has not been loaded' };
  }

  try {
    const outcome = runScenario(
      {
        grid: loaded.grid,
        flow: loaded.flow,
        depressions: loaded.depressions,
        drains: loaded.header.drains.map((drain) => ({
          assetNumber: drain.assetNumber,
          cell: drain.cell,
          isInlet: drain.isInlet,
        })),
        coverage: loaded.coverage,
      },
      request.blockage,
      request.drainCell,
      { rainfallPositionsMm: [...request.rainfallPositionsMm] },
    );

    if (outcome.status === 'insufficient-information') {
      return { type: 'result', id: request.id, status: outcome.status, reason: outcome.reason };
    }

    const last = outcome.positions[outcome.positions.length - 1];
    if (last === undefined) {
      return {
        type: 'result',
        id: request.id,
        status: 'insufficient-information',
        reason: 'scenario_calculation_failed',
      };
    }
    return {
      type: 'result',
      id: request.id,
      status: 'successful',
      positions: outcome.positions.map((position) => ({
        rainfallMm: position.accumulatedRainfallMm,
        band: position.band,
        cellsHigherThanBaseline: position.cellsHigherThanBaseline,
      })),
      band: last.band,
      cellsHigherThanBaseline: last.cellsHigherThanBaseline,
    };
  } catch {
    return {
      type: 'result',
      id: request.id,
      status: 'insufficient-information',
      reason: 'scenario_calculation_failed',
    };
  }
}

// The worker body. Skipped when this module is imported by a test, which has no
// `postMessage` on the global.
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;
    try {
      if (request.type === 'load') {
        scene = await loadScene(request.base);
        const drains = scene.header.drains;
        self.postMessage({
          type: 'loaded',
          id: request.id,
          drains: drains.map((drain) => ({
            assetNumber: String(drain.assetNumber),
            cell: drain.cell,
            isInlet: drain.isInlet,
          })),
          inlets: drains.filter((drain) => drain.isInlet).length,
        } satisfies WorkerReply);
        return;
      }
      self.postMessage(handle(request, scene));
    } catch (error) {
      self.postMessage({
        type: 'failed',
        id: request.id,
        message: String(error),
      } satisfies WorkerReply);
    }
  };
}
