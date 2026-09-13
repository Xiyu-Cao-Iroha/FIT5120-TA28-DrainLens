/**
 * What the worker replies, for every way a run can end.
 *
 * `handle` is the whole of the worker that is not `postMessage`, and none of
 * it was covered: the file's tests stopped at `higherAreasOf`. What that left
 * untested is the **reply contract** — the shape the hook reads to decide
 * whether a person sees a result, an insufficiency, or a retry.
 *
 * It matters because the hook trusts it. `useScenario` switches on
 * `reply.type` and then reads fields that only exist on one of them; a reply
 * of the wrong shape is a screen reading `undefined` as an answer.
 *
 * The scene here is a stepped hollow rather than a flat one, for the reason in
 * `packages/scenario/src/rimDepth.test.ts`: flat bottoms hide a branch.
 */

import { describe, expect, it } from 'vitest';

import { LEAVES_WINDOW, type Depression, d8FromElevations, depressionFieldFrom } from '@drainlens/scenario';

import type { LoadedScene } from './scene.js';
import { engineInput, handle } from './worker.js';

const WIDTH = 9;
const HEIGHT = 9;
const CELL = 5;
const BASE = 100;
const CENTRE = 4 * WIDTH + 4;

function loadedScene(): LoadedScene {
  const elevationM = new Float32Array(WIDTH * HEIGHT).fill(BASE);
  const cells: number[] = [];
  for (let y = 3; y <= 5; y += 1) {
    for (let x = 3; x <= 5; x += 1) {
      const cell = y * WIDTH + x;
      elevationM[cell] = BASE - (cell === CENTRE ? 0.6 : 0.15);
      cells.push(cell);
    }
  }

  const depression: Depression = {
    id: 0,
    cells,
    capacityM3: cells.length * CELL * CELL * 0.2,
    spillElevationM: BASE,
    spillCell: LEAVES_WINDOW,
  };
  const grid = { width: WIDTH, height: HEIGHT, cellSizeM: CELL, elevationM };

  return {
    header: {
      artefact: 'scene',
      version: 1,
      grid: { rows: HEIGHT, cols: WIDTH, cellSizeM: CELL, origin: 'south-west' },
      extent: { name: 'test', min_e: 0, min_n: 0, width_m: WIDTH * CELL, height_m: HEIGHT * CELL },
      arrays: {
        elevation: { file: 'elevation.bin', scale: 100 },
        flow: { file: 'flow.bin' },
        depressions: { file: 'depressions.bin' },
        coverage: { file: 'coverage.bin' },
      },
      depressions: [
        {
          id: 0,
          cellCount: cells.length,
          capacityM3: depression.capacityM3,
          spillElevationM: BASE,
          spillCell: LEAVES_WINDOW,
        },
      ],
      drains: [{ assetNumber: '1', cell: CENTRE, isInlet: true }],
      note: 'a fixture',
    },
    grid,
    flow: d8FromElevations(grid),
    depressions: depressionFieldFrom(grid, [depression]),
    coverage: new Uint8Array(WIDTH * HEIGHT).fill(1),
  };
}

const run = (over: Partial<Parameters<typeof handle>[0]> = {}) =>
  ({
    type: 'run' as const,
    id: 7,
    drainCell: CENTRE,
    blockage: 'fully-blocked' as const,
    rainfallPositionsMm: [20, 40, 60],
    ...over,
  });

describe('what the worker replies', () => {
  it('refuses a load request, which is handled asynchronously elsewhere', () => {
    // Not a friendly reply: reaching here with a load is a defect in the
    // worker body, and a `failed` message would send a person a retry button
    // for a bug that retrying cannot clear.
    expect(() => handle({ type: 'load', id: 1, base: '/data/scene' }, loadedScene())).toThrow();
  });

  it('says the scene is not loaded rather than answering from nothing', () => {
    const reply = handle(run(), null);
    expect(reply).toEqual({ type: 'failed', id: 7, message: 'the scene has not been loaded' });
  });

  it('carries the request id back, so a stale answer can be discarded', () => {
    /*
     * The hook matches replies against the newest request it sent. An id that
     * did not survive the round trip would let a person who changed the
     * blockage mid-run read the answer to the question they had abandoned.
     */
    expect(handle(run({ id: 41 }), loadedScene()).id).toBe(41);
    expect(handle(run({ id: 42 }), null).id).toBe(42);
  });

  it('answers a real run with a result the hook can read', () => {
    const reply = handle(run(), loadedScene());
    expect(reply.type).toBe('result');
    if (reply.type !== 'result') return;

    expect(reply.status).toBe('successful');
    if (reply.status !== 'successful') return;

    // One entry per rainfall position, in the order they were asked for.
    expect(reply.positions.map((p) => p.rainfallMm)).toEqual([20, 40, 60]);
    expect(reply.cellSizeM).toBe(CELL);
    // The band on the reply is the last position's, which is what the screen
    // shows before anybody moves the rainfall control.
    expect(reply.band).toBe(reply.positions[reply.positions.length - 1]?.band);
  });

  it('reports a drain the scene does not have as an insufficiency, not a crash', () => {
    const reply = handle(run({ drainCell: 99999 }), loadedScene());
    expect(reply.type).toBe('result');
    if (reply.type !== 'result') return;
    expect(reply.status).toBe('insufficient-information');
  });

  it('turns an engine refusal into a failed calculation rather than letting it escape', () => {
    /*
     * The engine throws for caller mistakes — an empty or unordered position
     * list is a defect in the code that built it. A defect that reaches a
     * resident should still be a screen that says what happened and offers a
     * retry, not a blank page.
     */
    for (const positions of [[], [60, 20]]) {
      const reply = handle(run({ rainfallPositionsMm: positions }), loadedScene());
      expect(reply.type).toBe('result');
      if (reply.type !== 'result') continue;
      expect(reply.status).toBe('insufficient-information');
      if (reply.status !== 'insufficient-information') continue;
      expect(reply.reason).toBe('scenario_calculation_failed');
    }
  });

  it('never returns a band and an insufficiency together', () => {
    // The distinction `RESULT_STATUSES` exists to keep structural: a screen
    // that could read both would have to decide which one it believed.
    for (const request of [run(), run({ drainCell: 99999 }), run({ rainfallPositionsMm: [] })]) {
      const reply = handle(request, loadedScene());
      if (reply.type !== 'result') continue;
      const asAny = reply as Record<string, unknown>;
      if (reply.status === 'successful') expect(asAny.reason).toBeUndefined();
      else expect(asAny.band).toBeUndefined();
    }
  });
});

describe('the shape of the hollow reaches the engine', () => {
  it('passes rim depth on when the scene has it, and nothing when it does not', () => {
    /*
     * The published scene has carried `rim-depth.bin` since 29 August, and the
     * worker never passed it on: the site spread every hollow's water evenly,
     * the fallback the engine's own comment says hides the product's subject.
     * Measured on 60 real inlets it changed no band -- but the site should run
     * the model the finding was made with.
     */
    const flat = loadedScene();
    expect(engineInput(flat).rimDepthM).toBeUndefined();

    const rimDepthM = new Float32Array(WIDTH * HEIGHT).fill(0.1);
    expect(engineInput({ ...flat, rimDepthM }).rimDepthM).toBe(rimDepthM);
  });
});
