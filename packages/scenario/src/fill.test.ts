/**
 * How water spreads inside a hollow — the arithmetic behind the finding.
 *
 * **This function was completely untested, and it is the one the product
 * actually runs.** `solvePosition` calls `fillToLevel` only when the scene
 * carries `rimDepthM`; the fixtures here do not, so every engine test took the
 * flat-bottomed fallback and forty lines of the real path were never executed.
 * The published artefacts do carry rim depths. The path under test was the one
 * the product does not take.
 *
 * It also matters more than its size suggests. [DECISIONS-PENDING.md §1] turns
 * on *where the water goes*: blocking one inlet releases 4.349 m³, and the
 * finding is that it spreads across 6,051 cells of one hollow at 0.0007 m³ per
 * cell — seventy times under the reporting threshold. That number is this
 * function. If it spread water evenly instead of to a level, the deepest cells
 * would be under-filled, the shallow ones wet when they should be dry, and the
 * comparison would report differences in the wrong places.
 *
 * So these check the physical properties rather than the lines: water finds one
 * level, volume is conserved, the deepest cells wet first, and anything above
 * the surface stays dry.
 */

import { describe, expect, it } from 'vitest';

import { fillToLevel } from './engine.js';

const CELL_AREA = 25; // 5 m cells, as every fixture in this package uses.

/** A hollow whose cells sit at the given depths below the rim. */
function hollow(depthsM: readonly number[]) {
  const rimDepthM = new Float32Array(depthsM);
  const cells = depthsM.map((_, index) => index);
  const pondedM3 = new Float32Array(depthsM.length);
  return { cells, rimDepthM, pondedM3 };
}

/** Total water placed, which must equal what was handed over. */
const held = (ponded: Float32Array): number => ponded.reduce((sum, v) => sum + v, 0);

/**
 * The water surface each wet cell implies, as a depth below the rim.
 *
 * A cell `d` below the rim holding `v` cubic metres has `v / area` metres of
 * water in it, so its surface sits `d - v / area` below the rim. Water finding
 * a level means every wet cell agrees on this number.
 */
const surfaceOf = (cell: number, depthsM: readonly number[], ponded: Float32Array): number =>
  depthsM[cell]! - ponded[cell]! / CELL_AREA;

describe('spreading a held volume over a hollow', () => {
  it('places nothing when there is nothing to place', () => {
    const { cells, rimDepthM, pondedM3 } = hollow([0.4, 0.3, 0.2]);
    expect(fillToLevel(cells, rimDepthM, 0, CELL_AREA, pondedM3)).toBe(0);
    expect(held(pondedM3)).toBe(0);
  });

  it('places nothing when the volume is negative, rather than draining a cell', () => {
    const { cells, rimDepthM, pondedM3 } = hollow([0.4, 0.3]);
    expect(fillToLevel(cells, rimDepthM, -5, CELL_AREA, pondedM3)).toBe(0);
    expect(held(pondedM3)).toBe(0);
  });

  it('places nothing in a hollow with no cells', () => {
    const pondedM3 = new Float32Array(0);
    expect(fillToLevel([], new Float32Array(0), 10, CELL_AREA, pondedM3)).toBe(0);
  });

  it('conserves the volume it was given', () => {
    // The property the mass balance downstream depends on. Water that this
    // function loses is water the balance reports as leaving the window.
    const depths = [0.5, 0.4, 0.3, 0.25, 0.1];
    for (const volume of [0.5, 2, 5, 12]) {
      const { cells, rimDepthM, pondedM3 } = hollow(depths);
      fillToLevel(cells, rimDepthM, volume, CELL_AREA, pondedM3);
      expect(held(pondedM3)).toBeCloseTo(volume, 6);
    }
  });

  it('wets the deepest cell first and leaves the rest dry', () => {
    // A volume small enough to sit inside the deepest cell alone.
    const depths = [0.1, 0.5, 0.2];
    const { cells, rimDepthM, pondedM3 } = hollow(depths);
    const wet = fillToLevel(cells, rimDepthM, 0.5, CELL_AREA, pondedM3);

    expect(wet).toBe(1);
    expect(pondedM3[1]).toBeCloseTo(0.5, 6);
    expect(pondedM3[0]).toBe(0);
    expect(pondedM3[2]).toBe(0);
  });

  it('finds one level: every wet cell agrees where the surface is', () => {
    // The whole point of the function. Spread evenly, five cells of different
    // depths would each hold the same volume and the surface would be a
    // staircase.
    const depths = [0.5, 0.4, 0.3, 0.25, 0.1];
    const { cells, rimDepthM, pondedM3 } = hollow(depths);
    const wet = fillToLevel(cells, rimDepthM, 6, CELL_AREA, pondedM3);
    expect(wet).toBeGreaterThan(1);

    const surfaces = cells.filter((c) => pondedM3[c]! > 0).map((c) => surfaceOf(c, depths, pondedM3));
    for (const surface of surfaces) expect(surface).toBeCloseTo(surfaces[0]!, 6);
  });

  it('leaves every cell above the surface dry', () => {
    const depths = [0.5, 0.4, 0.3, 0.25, 0.1];
    const { cells, rimDepthM, pondedM3 } = hollow(depths);
    fillToLevel(cells, rimDepthM, 3, CELL_AREA, pondedM3);

    const wet = cells.filter((c) => pondedM3[c]! > 0);
    const dry = cells.filter((c) => pondedM3[c] === 0);

    /*
      **Both halves have to be non-empty or this test asserts nothing.**

      It did not, at first. The loop below skips wet cells, so a version of
      `fillToLevel` that wet every cell made it pass with zero assertions
      executed — which a mutation run found: spreading the volume evenly over
      all five cells left this green while three of its neighbours went red.
      A test that can be satisfied by having nothing to check is worse than no
      test, because it is counted.
    */
    expect(wet.length).toBeGreaterThan(0);
    expect(dry.length).toBeGreaterThan(0);

    const surface = surfaceOf(wet[0]!, depths, pondedM3);
    for (const cell of dry) {
      // A dry cell must be no deeper than the surface: if it were deeper, the
      // water would have reached it.
      expect(depths[cell]!).toBeLessThanOrEqual(surface + 1e-6);
    }
  });

  it('wets more cells as more water arrives, and never fewer', () => {
    // Monotonicity, the same property `checkMonotonicity` asserts of the
    // engine as a whole, at the level that produces it.
    const depths = [0.5, 0.45, 0.4, 0.3, 0.2, 0.1];
    let previous = 0;
    for (const volume of [0.2, 1, 3, 6, 10, 20]) {
      const { cells, rimDepthM, pondedM3 } = hollow(depths);
      const wet = fillToLevel(cells, rimDepthM, volume, CELL_AREA, pondedM3);
      expect(wet).toBeGreaterThanOrEqual(previous);
      previous = wet;
    }
  });

  it('wets every cell when the water is deeper than the hollow', () => {
    const depths = [0.5, 0.4, 0.3];
    const { cells, rimDepthM, pondedM3 } = hollow(depths);
    const wet = fillToLevel(cells, rimDepthM, 500, CELL_AREA, pondedM3);
    expect(wet).toBe(3);
    expect(held(pondedM3)).toBeCloseTo(500, 4);
  });

  it('does not depend on the order the cells arrive in', () => {
    /*
     * The failure this catches is a sort that is not total. `fillToLevel`
     * orders by depth and walks down; if two cells share a depth and the
     * result depended on which came first, two runs over the same hollow could
     * disagree — and a comparison against a baseline is two runs.
     */
    const depths = [0.4, 0.4, 0.25, 0.5, 0.25];
    const rimDepthM = new Float32Array(depths);

    const forwards = new Float32Array(depths.length);
    const backwards = new Float32Array(depths.length);
    const cells = depths.map((_, i) => i);
    fillToLevel(cells, rimDepthM, 4, CELL_AREA, forwards);
    fillToLevel([...cells].reverse(), rimDepthM, 4, CELL_AREA, backwards);

    expect([...backwards]).toEqual([...forwards]);
  });

  it('treats a cell the rim depths do not mention as flat ground', () => {
    // `rimDepthM[cell] ?? 0` rather than a throw: a depression naming a cell
    // outside the array is a defect upstream, and the honest reading of a
    // missing depth is that the cell is not below the rim at all.
    const rimDepthM = new Float32Array([0.4]);
    const pondedM3 = new Float32Array(3);
    const wet = fillToLevel([0, 1, 2], rimDepthM, 1, CELL_AREA, pondedM3);
    expect(wet).toBe(1);
    expect(pondedM3[0]).toBeCloseTo(1, 6);
  });

  it('spreads a small volume thinly across a large hollow, which is the finding', () => {
    /*
     * The shape of DECISIONS-PENDING §1, at a scale a test can hold: 4.349 m³
     * released into a wide flat hollow becomes a fraction of a cubic metre per
     * cell, well under the 0.05 m³ that is worth telling somebody about.
     *
     * 600 cells at one depth, so the water covers all of them at once.
     */
    const depths = Array.from({ length: 600 }, () => 0.3);
    const { cells, rimDepthM, pondedM3 } = hollow(depths);
    const wet = fillToLevel(cells, rimDepthM, 4.349, CELL_AREA, pondedM3);

    expect(wet).toBe(600);
    const perCell = 4.349 / 600;
    expect(pondedM3[0]).toBeCloseTo(perCell, 6);
    expect(perCell).toBeLessThan(0.05);
  });
});
