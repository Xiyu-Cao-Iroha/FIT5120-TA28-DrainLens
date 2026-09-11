/**
 * What the hollow's shape changes, and what happens without it.
 *
 * `SceneInput.rimDepthM` is optional, and `solvePosition` branches on it: with
 * it, water in a depression finds a level; without it, the volume is spread
 * evenly over the whole footprint. The engine's own comment says the fallback
 * "is wrong in a way that hides the product's own subject".
 *
 * **Neither the branch nor the difference had a test**, because every fixture
 * in this package is flat-bottomed — `bowl` puts every depression cell at one
 * depth, and on a flat bottom the two distributions are the same. So the
 * branch that matters was exercised only on the input that cannot tell it
 * apart.
 *
 * These build a *stepped* hollow, which is what real ground is, and measure
 * what the shape is worth.
 */

import { describe, expect, it } from 'vitest';

import { checkMassBalance } from './checks.js';
import { type SceneInput, runScenario, solvePosition } from './engine.js';
import { LEAVES_WINDOW, type Depression, d8FromElevations, depressionFieldFrom } from './flow.js';

const CELL = 5;
const WIDTH = 9;
const HEIGHT = 9;
const BASE = 100;

/**
 * A hollow with a deep middle and a shallow shelf around it.
 *
 * Three by three, 0.6 m at the centre and 0.15 m around it — the depth
 * difference is what the two distributions disagree about.
 */
function steppedHollow(): { scene: Omit<SceneInput, 'rimDepthM'>; rimDepthM: Float32Array; centre: number } {
  const elevationM = new Float32Array(WIDTH * HEIGHT).fill(BASE);
  const rimDepthM = new Float32Array(WIDTH * HEIGHT);

  const cells: number[] = [];
  const centre = 4 * WIDTH + 4;
  for (let y = 3; y <= 5; y += 1) {
    for (let x = 3; x <= 5; x += 1) {
      const cell = y * WIDTH + x;
      const depth = cell === centre ? 0.6 : 0.15;
      elevationM[cell] = BASE - depth;
      rimDepthM[cell] = depth;
      cells.push(cell);
    }
  }

  const capacityM3 = cells.reduce((sum, cell) => sum + rimDepthM[cell]! * CELL * CELL, 0);
  const depression: Depression = {
    id: 0,
    cells,
    capacityM3,
    spillElevationM: BASE,
    spillCell: LEAVES_WINDOW,
  };

  const grid = { width: WIDTH, height: HEIGHT, cellSizeM: CELL, elevationM };
  return {
    scene: {
      grid,
      flow: d8FromElevations(grid),
      depressions: depressionFieldFrom(grid, [depression]),
      drains: [{ assetNumber: 'P-0', cell: centre }],
    },
    rimDepthM,
    centre,
  };
}

const POSITIONS = { rainfallPositionsMm: [20, 40, 60] };

describe('the shape of a hollow, and the fallback when it is unknown', () => {
  it('puts more water in the deepest cell when it knows the shape', () => {
    const { scene, rimDepthM, centre } = steppedHollow();

    const withShape = solvePosition({ ...scene, rimDepthM }, 'clear', -1, 40);
    const without = solvePosition(scene, 'clear', -1, 40);

    // Both hold the same water; they disagree about where it sits.
    const total = (ponded: Float32Array) => ponded.reduce((sum, v) => sum + v, 0);
    expect(total(withShape.pondedM3)).toBeCloseTo(total(without.pondedM3), 4);
    expect(withShape.pondedM3[centre]!).toBeGreaterThan(without.pondedM3[centre]!);
  });

  it('agrees with the fallback on a flat bottom, which is why the fixtures could not tell', () => {
    /*
      Every other test in this package uses `bowl`, which is flat-bottomed.
      This is that case written down: give the stepped hollow one depth and
      the two distributions become the same, so a fixture like that cannot
      fail when the branch is wrong.
    */
    const { scene, centre } = steppedHollow();
    const flat = new Float32Array(WIDTH * HEIGHT);
    for (let y = 3; y <= 5; y += 1) {
      for (let x = 3; x <= 5; x += 1) flat[y * WIDTH + x] = 0.3;
    }

    const withShape = solvePosition({ ...scene, rimDepthM: flat }, 'clear', -1, 40);
    const without = solvePosition(scene, 'clear', -1, 40);

    expect(withShape.pondedM3[centre]!).toBeCloseTo(without.pondedM3[centre]!, 6);
  });

  it('runs a whole comparison with the shape, which nothing had done', () => {
    // The integration the branch sits in: `runScenario` builds both the
    // scenario and its baseline, and each one calls `solvePosition`.
    const { scene, rimDepthM, centre } = steppedHollow();
    const outcome = runScenario({ ...scene, rimDepthM }, 'fully-blocked', centre, POSITIONS);

    expect(outcome.status).toBe('successful');
    if (outcome.status !== 'successful') return;
    expect(outcome.positions).toHaveLength(3);
    for (const position of outcome.positions) {
      expect(['no-clear-change', 'higher-than-baseline']).toContain(position.band);
    }
  });

  it('conserves water either way, so the choice cannot be hidden by a leak', () => {
    // Through `checkMassBalance` rather than by adding the fields up here: it
    // is the check the engine itself applies, and a second copy of the sum in
    // a test is a second thing to keep right. The first version of this test
    // guessed at the field names and compared NaN to undefined.
    const { scene, rimDepthM } = steppedHollow();
    for (const input of [{ ...scene, rimDepthM }, scene]) {
      expect(checkMassBalance(solvePosition(input, 'clear', -1, 60).balance).ok).toBe(true);
    }
  });
});
