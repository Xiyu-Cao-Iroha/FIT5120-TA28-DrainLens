/**
 * The scenario engine, off the main thread.
 *
 * A comparison solves the whole grid twice for every rainfall position. On the
 * main thread that freezes the map mid-gesture, and a frozen map during a
 * calculation reads as a crash — the person taps again, and now two runs are
 * competing.
 *
 * The worker loads the council's tile index once, and for each comparison the
 * one-kilometre window around the chosen drain, keeping the last few windows.
 * A second comparison in the same street is arithmetic over arrays already in
 * memory, so changing a blockage setting costs a calculation rather than a
 * download.
 */

import { runScenario } from '@drainlens/scenario';
import type { BlockageSetting } from '@drainlens/schema';

import type { InsufficiencyReason } from '@drainlens/schema';

import type { LoadedScene } from './scene.js';
import { type TileIndex, loadIndex, loadWindow, windowKey } from './sceneTiles.js';

/** A comparison on a scene already in hand, by the scene's own cell. */
export interface RunRequest {
  readonly type: 'run';
  readonly id: number;
  readonly drainCell: number;
  readonly blockage: BlockageSetting;
  readonly rainfallPositionsMm: readonly number[];
}

/** A comparison for a drain, by asset number: the worker finds its window. */
export interface AssetRunRequest {
  readonly type: 'run-asset';
  readonly id: number;
  readonly assetNumber: string;
  readonly blockage: BlockageSetting;
  readonly rainfallPositionsMm: readonly number[];
}

export interface LoadRequest {
  readonly type: 'load';
  readonly id: number;
  readonly base: string;
}

export type WorkerRequest = LoadRequest | AssetRunRequest;

/** One accumulated-rainfall position, as the interface needs it. */
export interface SolvedPosition {
  readonly rainfallMm: number;
  readonly band: 'no-clear-change' | 'higher-than-baseline';
  readonly cellsHigherThanBaseline: number;
  /**
   * Where the difference is, as south-west cell corners in **local metres**.
   *
   * The engine produces a band for all 1,000,000 cells and for a long time
   * only the count of them crossed this boundary, so the result screen
   * promised highlighted areas over a map that could not draw any. The cells
   * that actually differ are a tiny fraction — 652 for the demonstration pit,
   * out of a million — so sending those and only those costs a few kilobytes.
   *
   * Converted here rather than in the interface **on purpose**. The grid this
   * is derived from lives on this side; the one time a cell index was carried
   * across and the coordinate rebuilt on the other, all 895 drains disagreed
   * with the scene and every comparison returned `invalid_inlet`.
   */
  readonly higherAreasM: readonly (readonly [east: number, north: number])[];
}

/**
 * The most difference cells one position will report.
 *
 * The measured worst case in this extent is 652, two orders of magnitude
 * under this, so the cap never binds on the published artefact. It exists so
 * a future artefact whose hollows connect cannot post a multi-megabyte
 * message and freeze the tab — and `cellsHigherThanBaseline` is the true
 * count regardless, so a truncated layer can still be described honestly.
 */
export const MAX_REPORTED_DIFFERENCE_CELLS = 60000;

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
       * Every inlet a scenario can be calculated for: an inlet with a window of
       * four measured tiles around it. The map marks these before anybody
       * chooses (AC 3.1.1.a), and only these can be chosen.
       *
       * The interface must never work this out for itself — not from the asset
       * description, not from the map geometry. Both were tried, and both
       * offered drains the engine then refused.
       */
      readonly supported: readonly string[];
      /** Inlets with no window of measured ground around them (AC 3.1.1.d). */
      readonly withoutGround: readonly string[];
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
       * person is going to ask. AC 2.2.2 (Aug-27 set) is then a lookup rather than a rerun,
       * which is what keeps the rainfall control honest: it cannot quietly
       * re-solve with a different assumption between two readings.
       */
      readonly positions: readonly SolvedPosition[];
      readonly band: 'no-clear-change' | 'higher-than-baseline';
      readonly cellsHigherThanBaseline: number;
      /**
       * The grid's cell size in metres, so the interface can size what it
       * draws. Sent once per reply rather than per position — one grid solved
       * every position, and two values here could only ever disagree.
       */
      readonly cellSizeM: number;
      /**
       * The calculation window's south-west corner, in MGA metres.
       *
       * `higherAreasM` is in the window's own frame, and the map it is drawn
       * over is not: when the API answers the map is the council's, and when
       * it does not the map is Kensington's. Without this the difference
       * layer was drawn up to kilometres from the drain it belongs to.
       */
      readonly origin?: { readonly minE: number; readonly minN: number };
      /** Share of the window's ground that was measured, 0 to 1. */
      readonly measuredShare?: number;
    }
  | {
      readonly type: 'result';
      readonly id: number;
      readonly status: 'insufficient-information';
      readonly reason: string;
    }
  | { readonly type: 'failed'; readonly id: number; readonly message: string };

let tileIndex: TileIndex | null = null;
let tileBase = '';

/**
 * The cells a position marks higher than baseline, as local metres.
 *
 * Row 0 of the grid is its **north** edge and northing grows upward, so a
 * cell's northing is measured from the far side of the grid rather than from
 * the row index. Getting that backwards mirrors the whole layer about the
 * middle of the extent, which looks entirely plausible on a square grid and
 * is wrong everywhere.
 */
export function higherAreasOf(
  bands: readonly string[],
  grid: { readonly width: number; readonly height: number; readonly cellSizeM: number },
): (readonly [number, number])[] {
  const areas: (readonly [number, number])[] = [];
  for (let cell = 0; cell < bands.length; cell += 1) {
    if (bands[cell] !== 'higher-than-baseline') continue;
    if (areas.length >= MAX_REPORTED_DIFFERENCE_CELLS) break;
    const column = cell % grid.width;
    const row = Math.floor(cell / grid.width);
    areas.push([column * grid.cellSizeM, (grid.height - 1 - row) * grid.cellSizeM]);
  }
  return areas;
}

/**
 * What the engine is handed for a loaded scene.
 *
 * Its own function because what it leaves out is invisible in a result: the
 * rim depth was loaded by nobody and passed by nobody from 29 August to
 * 13 September, and every run still returned a plausible band.
 */
export function engineInput(loaded: LoadedScene): Parameters<typeof runScenario>[0] {
  return {
    grid: loaded.grid,
    flow: loaded.flow,
    depressions: loaded.depressions,
    drains: loaded.header.drains.map((drain) => ({
      assetNumber: drain.assetNumber,
      cell: drain.cell,
      isInlet: drain.isInlet,
    })),
    coverage: loaded.coverage,
    ...(loaded.rimDepthM === undefined ? {} : { rimDepthM: loaded.rimDepthM }),
  };
}

/**
 * Turn an engine outcome into a reply.
 *
 * A thrown error becomes `scenario_calculation_failed` rather than escaping.
 * The engine throws for caller mistakes — an empty or unordered position list —
 * and those are defects, but a defect that reaches a resident should still be
 * a screen that says what happened and offers a retry, not a blank page.
 */
export function handle(request: RunRequest | LoadRequest, loaded: LoadedScene | null): WorkerReply {
  if (request.type === 'load') {
    throw new Error('a load request is handled asynchronously, not here');
  }
  if (loaded === null) {
    return { type: 'failed', id: request.id, message: 'the scene has not been loaded' };
  }

  try {
    const outcome = runScenario(
      engineInput(loaded),
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
        higherAreasM: higherAreasOf(position.bands, loaded.grid),
      })),
      band: last.band,
      cellsHigherThanBaseline: last.cellsHigherThanBaseline,
      cellSizeM: loaded.grid.cellSizeM,
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

/**
 * Why a drain has no scenario, from the index alone and before any download.
 *
 * An inlet listed without ground is `terrain_unavailable` — every drain there
 * fails the same way, so the screen says choosing another will not help.
 * Anything else not listed is not an inlet the pack knows, `invalid_inlet`.
 */
export function unsupportedReason(index: TileIndex, assetNumber: string): InsufficiencyReason | null {
  if (index.windows[assetNumber] !== undefined) return null;
  return (index.inletsWithoutWindow ?? []).includes(assetNumber) ? 'terrain_unavailable' : 'invalid_inlet';
}

/**
 * A comparison for a drain by asset number: find its window, load it, solve.
 *
 * Separate from the message loop so it can be tested with a fake loader.
 */
export async function runForAsset(
  request: AssetRunRequest,
  index: TileIndex,
  windowFor: (window: readonly [number, number]) => Promise<LoadedScene>,
): Promise<WorkerReply> {
  const reason = unsupportedReason(index, request.assetNumber);
  if (reason !== null) {
    return { type: 'result', id: request.id, status: 'insufficient-information', reason };
  }
  const window = index.windows[request.assetNumber]!;
  let loaded: LoadedScene;
  try {
    loaded = await windowFor(window);
  } catch {
    return { type: 'result', id: request.id, status: 'insufficient-information', reason: 'scenario_calculation_failed' };
  }
  // The window's own cell for this drain, which the pipeline snapped onto the
  // flow path. Never recomputed from the map geometry.
  const drain = loaded.header.drains.find((d) => d.assetNumber === request.assetNumber && d.isInlet);
  if (drain === undefined) {
    return { type: 'result', id: request.id, status: 'insufficient-information', reason: 'invalid_inlet' };
  }
  const reply = handle(
    {
      type: 'run',
      id: request.id,
      drainCell: drain.cell,
      blockage: request.blockage,
      rainfallPositionsMm: request.rainfallPositionsMm,
    },
    loaded,
  );
  if (reply.type === 'result' && reply.status === 'successful') {
    return {
      ...reply,
      origin: { minE: loaded.header.extent.min_e, minN: loaded.header.extent.min_n },
      ...(loaded.measuredShare === undefined ? {} : { measuredShare: loaded.measuredShare }),
    };
  }
  return reply;
}

/** The windows kept in memory. A street's worth of comparisons reuse one. */
export const WINDOWS_KEPT = 2;

const windows = new Map<string, Promise<LoadedScene>>();

function cachedWindow(window: readonly [number, number]): Promise<LoadedScene> {
  if (tileIndex === null) return Promise.reject(new Error('the scene tile index has not been loaded'));
  const key = windowKey(window);
  const held = windows.get(key);
  if (held !== undefined) {
    windows.delete(key);
    windows.set(key, held);
    return held;
  }
  const loading = loadWindow(tileBase, tileIndex, window);
  loading.catch(() => windows.delete(key));
  windows.set(key, loading);
  while (windows.size > WINDOWS_KEPT) {
    const oldest = windows.keys().next().value;
    if (oldest === undefined) break;
    windows.delete(oldest);
  }
  return loading;
}

// The worker body. Skipped when this module is imported by a test, which has no
// `postMessage` on the global.
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;
    try {
      if (request.type === 'load') {
        tileBase = request.base;
        tileIndex = await loadIndex(request.base);
        self.postMessage({
          type: 'loaded',
          id: request.id,
          supported: Object.keys(tileIndex.windows),
          withoutGround: tileIndex.inletsWithoutWindow ?? [],
        } satisfies WorkerReply);
        return;
      }
      if (tileIndex === null) {
        self.postMessage({ type: 'failed', id: request.id, message: 'the scene tile index has not been loaded' } satisfies WorkerReply);
        return;
      }
      self.postMessage(await runForAsset(request, tileIndex, cachedWindow));
    } catch (error) {
      self.postMessage({
        type: 'failed',
        id: request.id,
        message: error instanceof Error ? error.message : String(error),
      } satisfies WorkerReply);
    }
  };
}
