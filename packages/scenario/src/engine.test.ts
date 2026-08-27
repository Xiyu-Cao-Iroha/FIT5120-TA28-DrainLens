import { describe, expect, it } from 'vitest';

import { checkMassBalance, checkMonotonicity } from './checks.js';
import {
  DEFAULT_ASSUMPTIONS,
  EngineError,
  type SceneInput,
  blockageMultiplier,
  runScenario,
  solvePosition,
} from './engine.js';
import {
  LEAVES_WINDOW,
  type Depression,
  d8FromElevations,
  depressionFieldFrom,
  downstreamOf,
  rainfallVolumePerCellM3,
} from './flow.js';
import { bowl, planarSlope } from './terrain.js';

const NO_DEPRESSIONS: readonly Depression[] = [];

function slopeScene(drainCells: readonly number[] = []): SceneInput {
  const grid = planarSlope({ width: 10, height: 10, cellSizeM: 5, gradient: 0.02 });
  return {
    grid,
    flow: d8FromElevations(grid),
    depressions: depressionFieldFrom(grid, NO_DEPRESSIONS),
    drains: drainCells.map((cell, i) => ({ assetNumber: `P-${String(i)}`, cell })),
  };
}

function bowlScene(drainCells: readonly number[] = []): SceneInput & { capacityM3: number } {
  const fixture = bowl({
    width: 10,
    height: 10,
    cellSizeM: 5,
    depthM: 0.4,
    pitWidth: 4,
    pitHeight: 4,
  });
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
    capacityM3: fixture.capacityM3,
  };
}

/**
 * A slope falling east, with the eastern column as a depression of a stated
 * capacity. Unlike the flat-plane bowl, every drop in the window routes into it,
 * so this is the fixture for fill-to-capacity-then-spill.
 */
function slopeIntoBowlScene(capacityM3: number): SceneInput & { capacityM3: number } {
  const grid = planarSlope({ width: 10, height: 10, cellSizeM: 5, gradient: 0.02 });
  const cells: number[] = [];
  for (let y = 0; y < grid.height; y += 1) cells.push(y * grid.width + (grid.width - 1));
  const depression: Depression = {
    id: 0,
    cells,
    capacityM3,
    spillElevationM: 99,
    spillCell: LEAVES_WINDOW,
  };
  return {
    grid,
    flow: d8FromElevations(grid),
    depressions: depressionFieldFrom(grid, [depression]),
    drains: [],
    capacityM3,
  };
}

describe('flow field', () => {
  it('routes a planar slope east and off the edge', () => {
    const grid = planarSlope({ width: 4, height: 2, cellSizeM: 5, gradient: 0.02 });
    const flow = d8FromElevations(grid);
    expect(downstreamOf(flow, 0)).toBe(1);
    expect(downstreamOf(flow, 1)).toBe(2);
    // Eastern edge: the boundary is an exit, not a wall.
    expect(downstreamOf(flow, 3)).toBe(LEAVES_WINDOW);
  });

  it('gives a flat surface nowhere to go', () => {
    const flat = { width: 3, height: 3, cellSizeM: 1, elevationM: new Float32Array(9).fill(10) };
    const flow = d8FromElevations(flat);
    expect([...flow.direction].every((d) => d === LEAVES_WINDOW)).toBe(true);
  });

  it('sends water into a depression rather than past it', () => {
    const scene = bowlScene();
    const centre = 5 * 10 + 5;
    expect(scene.depressions.cellDepression[centre]).toBe(0);
  });

  it('refuses a depression naming a cell outside the grid', () => {
    const grid = planarSlope({ width: 3, height: 3, cellSizeM: 1, gradient: 0.1 });
    expect(() =>
      depressionFieldFrom(grid, [
        { id: 0, cells: [99], capacityM3: 1, spillElevationM: 0, spillCell: LEAVES_WINDOW },
      ]),
    ).toThrow(/outside the grid/);
  });
});

describe('solving one position', () => {
  it('ponds nothing on a slope, and every drop leaves the window', () => {
    // The planar slope exists to assert exactly this. Ponding here would be a
    // routing defect, not a property of the terrain.
    const scene = slopeScene();
    const solution = solvePosition(scene, 'clear', null, 30);

    expect(solution.pondedCells).toBe(0);
    expect(solution.balance.pondedVolumeM3).toBe(0);
    expect(solution.balance.leftWindowVolumeM3).toBeCloseTo(solution.balance.rainfallVolumeM3, 6);
    expect(checkMassBalance(solution.balance)).toEqual({ ok: true });
  });

  it('fills a depression to exactly its stated capacity and spills the rest', () => {
    const scene = slopeIntoBowlScene(50);

    // 120 mm over the window is 300 m³ — far more than the depression holds.
    const heavy = solvePosition(scene, 'clear', null, 120);
    expect(heavy.balance.pondedVolumeM3).toBeCloseTo(50, 4);
    expect(heavy.pondedCells).toBe(10);
    expect(heavy.balance.leftWindowVolumeM3).toBeCloseTo(250, 4);
    expect(checkMassBalance(heavy.balance)).toEqual({ ok: true });

    // Little enough that it does not fill: everything that arrives stays.
    const light = solvePosition(scene, 'clear', null, 10);
    const fell = rainfallVolumePerCellM3(scene.grid, 10) * 100;
    expect(light.balance.pondedVolumeM3).toBeCloseTo(fell, 4);
    expect(light.balance.leftWindowVolumeM3).toBeCloseTo(0, 6);
    expect(checkMassBalance(light.balance)).toEqual({ ok: true });
  });

  it('only collects what the terrain actually delivers to the depression', () => {
    // The bowl fixture sits in a flat plane, and a flat cell has no downhill
    // neighbour, so rain outside the depression's immediate ring leaves where
    // it falls rather than travelling. 16 depression cells plus the 20 around
    // them, at 0.12 m over 25 m² each, is 108 m³ — and nothing more arrives no
    // matter how hard it rains.
    //
    // This is a property of the terrain, not a defect. It is pinned here
    // because a future change that quietly routed water across flat ground
    // would otherwise look like an improvement.
    const scene = bowlScene();
    const heavy = solvePosition(scene, 'clear', null, 120);

    expect(heavy.balance.pondedVolumeM3).toBeCloseTo(108, 4);
    expect(heavy.balance.pondedVolumeM3).toBeLessThan(scene.capacityM3);
    expect(heavy.pondedCells).toBe(16);
    expect(checkMassBalance(heavy.balance)).toEqual({ ok: true });
  });

  it('gives the same answer twice for the same inputs', () => {
    // AC 2.2: same inputs, same result. Nothing may depend on iteration order.
    const scene = bowlScene([12]);
    const a = solvePosition(scene, 'partly-blocked', 12, 45);
    const b = solvePosition(scene, 'partly-blocked', 12, 45);
    expect([...a.pondedM3]).toEqual([...b.pondedM3]);
    expect(a.balance).toEqual(b.balance);
  });

  it('accounts for every drop at every rainfall it is given', () => {
    const scene = bowlScene([0, 12, 34]);
    for (const mm of [0, 1, 5, 20, 60, 120]) {
      const solution = solvePosition(scene, 'fully-blocked', 12, mm);
      expect(checkMassBalance(solution.balance)).toEqual({ ok: true });
    }
  });

  it('does nothing at all when no rain falls', () => {
    const scene = bowlScene([12]);
    const solution = solvePosition(scene, 'clear', 12, 0);
    expect(solution.pondedCells).toBe(0);
    expect(solution.balance.rainfallVolumeM3).toBe(0);
    expect(checkMassBalance(solution.balance)).toEqual({ ok: true });
  });
});

describe('drains', () => {
  it('takes the capture fraction of the water reaching it', () => {
    // One drain on the eastern edge of a slope, where all the water passes.
    const scene = slopeScene([9]);
    const solution = solvePosition(scene, 'clear', null, 30);
    expect(solution.balance.capturedVolumeM3).toBeGreaterThan(0);
    expect(checkMassBalance(solution.balance)).toEqual({ ok: true });
  });

  it('captures less when partly blocked and nothing when fully blocked', () => {
    const scene = slopeScene([9]);
    const clear = solvePosition(scene, 'clear', 9, 30).balance.capturedVolumeM3;
    const partly = solvePosition(scene, 'partly-blocked', 9, 30).balance.capturedVolumeM3;
    const fully = solvePosition(scene, 'fully-blocked', 9, 30).balance.capturedVolumeM3;

    expect(partly).toBeCloseTo(clear * blockageMultiplier('partly-blocked'), 6);
    expect(fully).toBe(0);
  });

  it('blocks only the drain that was selected', () => {
    const scene = slopeScene([9, 19]);
    const both = solvePosition(scene, 'clear', null, 30).balance.capturedVolumeM3;
    const one = solvePosition(scene, 'fully-blocked', 9, 30).balance.capturedVolumeM3;
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(both);
  });

  it('captures nothing when the capture fraction is assumed to be zero', () => {
    const scene = slopeScene([9]);
    const solution = solvePosition(scene, 'clear', null, 30, {
      ...DEFAULT_ASSUMPTIONS,
      captureFraction: 0,
    });
    expect(solution.balance.capturedVolumeM3).toBe(0);
  });
});

describe('rejecting inputs it cannot honour', () => {
  const scene = slopeScene([9]);

  it('refuses negative or non-finite rainfall', () => {
    expect(() => solvePosition(scene, 'clear', null, -1)).toThrow(EngineError);
    expect(() => solvePosition(scene, 'clear', null, Number.NaN)).toThrow(EngineError);
  });

  it('refuses a capture fraction outside 0..1', () => {
    expect(() =>
      solvePosition(scene, 'clear', null, 10, { ...DEFAULT_ASSUMPTIONS, captureFraction: 1.5 }),
    ).toThrow(/within 0\.\.1/);
    expect(() =>
      solvePosition(scene, 'clear', null, 10, { ...DEFAULT_ASSUMPTIONS, captureFraction: -0.1 }),
    ).toThrow(EngineError);
  });

  it('refuses a negative noticeable volume', () => {
    expect(() =>
      solvePosition(scene, 'clear', null, 10, { ...DEFAULT_ASSUMPTIONS, noticeableVolumeM3: -1 }),
    ).toThrow(/non-negative/);
  });

  it('refuses a drain outside the window', () => {
    const broken = { ...scene, drains: [{ assetNumber: 'P-x', cell: 9999 }] };
    expect(() => solvePosition(broken, 'clear', null, 10)).toThrow(/outside the calculation window/);
  });

  it('refuses artefacts that describe different extents', () => {
    const wrongFlow = { ...scene, flow: { ...scene.flow, direction: new Int8Array(3) } };
    expect(() => solvePosition(wrongFlow, 'clear', null, 10)).toThrow(/different extents/);

    const wrongDepressions = {
      ...scene,
      depressions: { ...scene.depressions, cellDepression: new Int32Array(3) },
    };
    expect(() => solvePosition(wrongDepressions, 'clear', null, 10)).toThrow(/different extents/);
  });
});

describe('overflow from a full depression', () => {
  /** A slope east, with a depression in the middle column that spills onward. */
  function spillingScene(capacityM3: number, spillCell: number, extra: Depression[] = []): SceneInput {
    const grid = planarSlope({ width: 10, height: 4, cellSizeM: 5, gradient: 0.02 });
    const cells: number[] = [];
    for (let y = 0; y < grid.height; y += 1) cells.push(y * grid.width + 4);
    const depression: Depression = {
      id: 0,
      cells,
      capacityM3,
      spillElevationM: 99.6,
      spillCell,
    };
    return {
      grid,
      flow: d8FromElevations(grid),
      depressions: depressionFieldFrom(grid, [depression, ...extra]),
      drains: [],
    };
  }

  it('routes the overflow onward from the spill cell and out of the window', () => {
    const scene = spillingScene(5, 5);
    const solution = solvePosition(scene, 'clear', null, 60);

    expect(solution.balance.pondedVolumeM3).toBeCloseTo(5, 4);
    expect(solution.balance.leftWindowVolumeM3).toBeGreaterThan(0);
    expect(checkMassBalance(solution.balance)).toEqual({ ok: true });
  });

  it('lets a drain on the overflow path take its share', () => {
    const withoutDrain = solvePosition(spillingScene(5, 5), 'clear', null, 60).balance;
    const scene = { ...spillingScene(5, 5), drains: [{ assetNumber: 'P-1', cell: 6 }] };
    const withDrain = solvePosition(scene, 'clear', null, 60).balance;

    expect(withoutDrain.capturedVolumeM3).toBe(0);
    expect(withDrain.capturedVolumeM3).toBeGreaterThan(0);
    expect(withDrain.leftWindowVolumeM3).toBeLessThan(withoutDrain.leftWindowVolumeM3);
    expect(checkMassBalance(withDrain)).toEqual({ ok: true });
  });

  it('pours the overflow into a second depression downstream', () => {
    const downstream: Depression = {
      id: 1,
      cells: [7, 17, 27, 37],
      capacityM3: 3,
      spillElevationM: 99.2,
      spillCell: LEAVES_WINDOW,
    };
    const scene = spillingScene(5, 7, [downstream]);
    const solution = solvePosition(scene, 'clear', null, 60);

    // Both hold their stated capacity; the rest leaves.
    expect(solution.balance.pondedVolumeM3).toBeCloseTo(8, 4);
    expect(solution.pondedCells).toBe(8);
    expect(checkMassBalance(solution.balance)).toEqual({ ok: true });
  });

  it('keeps overflow that spills straight out of the window', () => {
    const scene = spillingScene(5, LEAVES_WINDOW);
    const solution = solvePosition(scene, 'clear', null, 60);
    expect(solution.balance.pondedVolumeM3).toBeCloseTo(5, 4);
    expect(checkMassBalance(solution.balance)).toEqual({ ok: true });
  });
});

describe('the blockage setting is an assumption, not a state the model evolves', () => {
  // Asked by a reviewer: "blockage by huge water flow — how do you calculate
  // the deposit speed?" The answer is that this model cannot, and these tests
  // are what stop a future change from quietly implying otherwise.
  //
  // The independent variable here is accumulated rainfall in millimetres, not
  // time. A deposit speed is a rate, and no rate can come out of a model whose
  // independent variable is not time. That is a dimensional fact, not a gap in
  // the data.

  it('holds the setting the resident chose at every rainfall, however heavy', () => {
    const scene = slopeScene([9]);
    for (const mm of [5, 30, 90, 120]) {
      expect(solvePosition(scene, 'fully-blocked', 9, mm).balance.capturedVolumeM3).toBe(0);
    }
  });

  it('does not let a heavier storm change how much a clear drain takes', () => {
    // If blockage formed with flow, the captured share would fall as rainfall
    // rose. It does not: the share is constant, because the setting is an
    // assumption held for the whole scenario.
    const scene = slopeScene([9]);
    const shares = [10, 40, 80, 120].map((mm) => {
      const { balance } = solvePosition(scene, 'clear', 9, mm);
      return balance.capturedVolumeM3 / balance.rainfallVolumeM3;
    });
    for (const share of shares) expect(share).toBeCloseTo(shares[0]!, 12);
  });

  it('offers no way to make a drain change setting partway through a scenario', () => {
    // A scenario takes exactly one setting for exactly one drain. There is no
    // parameter for a setting that varies with rainfall, position or time, and
    // adding one would be a different model rather than a bigger one.
    const scene = slopeScene([9]);
    const result = runScenario(scene, 'partly-blocked', 9, {
      rainfallPositionsMm: [10, 40, 80],
    });
    const captured = result.map((p) => p.scenarioBalance.capturedVolumeM3 / p.scenarioBalance.rainfallVolumeM3);
    for (const share of captured) expect(share).toBeCloseTo(captured[0]!, 12);
  });
});

describe('running a comparison', () => {
  const positions = [10, 25, 40, 60, 90, 120];

  it('reports no clear change when the blocked drain is clear anyway', () => {
    const scene = bowlScene([12]);
    const result = runScenario(scene, 'clear', 12, { rainfallPositionsMm: positions });
    expect(result).toHaveLength(positions.length);
    expect(result.every((p) => p.band === 'no-clear-change')).toBe(true);
    expect(result.every((p) => p.cellsHigherThanBaseline === 0)).toBe(true);
  });

  it('never reports ponding shrinking as the storm gets heavier', () => {
    const scene = bowlScene([12]);
    const result = runScenario(scene, 'fully-blocked', 12, { rainfallPositionsMm: positions });
    const extents = result.map((p) => ({
      accumulatedRainfallMm: p.accumulatedRainfallMm,
      pondedCells: p.scenarioPondedCells,
    }));
    expect(checkMonotonicity(extents)).toEqual({ ok: true });
  });

  it('keeps every position in mass balance, in both the scenario and the baseline', () => {
    const scene = bowlScene([12, 34]);
    const result = runScenario(scene, 'fully-blocked', 12, { rainfallPositionsMm: positions });
    for (const position of result) {
      expect(checkMassBalance(position.scenarioBalance)).toEqual({ ok: true });
      expect(checkMassBalance(position.baselineBalance)).toEqual({ ok: true });
    }
  });

  it('blocking a drain never captures more than leaving it clear', () => {
    const scene = bowlScene([12]);
    const result = runScenario(scene, 'fully-blocked', 12, { rainfallPositionsMm: positions });
    for (const position of result) {
      expect(position.scenarioBalance.capturedVolumeM3).toBeLessThanOrEqual(
        position.baselineBalance.capturedVolumeM3 + 1e-9,
      );
    }
  });

  it('labels every cell with a band', () => {
    const scene = bowlScene([12]);
    const [first] = runScenario(scene, 'partly-blocked', 12, { rainfallPositionsMm: [30] });
    expect(first?.bands).toHaveLength(scene.grid.width * scene.grid.height);
    expect(first?.bands.every((b) => b === 'no-clear-change' || b === 'higher-than-baseline')).toBe(
      true,
    );
  });

  it('refuses positions that are empty or not ascending', () => {
    const scene = bowlScene([12]);
    expect(() => runScenario(scene, 'clear', 12, { rainfallPositionsMm: [] })).toThrow(
      /at least one rainfall position/,
    );
    expect(() => runScenario(scene, 'clear', 12, { rainfallPositionsMm: [30, 10] })).toThrow(
      /strictly ascending/,
    );
    expect(() => runScenario(scene, 'clear', 12, { rainfallPositionsMm: [30, 30] })).toThrow(
      /strictly ascending/,
    );
  });

  it('refuses to block a cell where no drain sits', () => {
    const scene = bowlScene([12]);
    expect(() => runScenario(scene, 'fully-blocked', 77, { rainfallPositionsMm: [30] })).toThrow(
      /no drain sits at cell 77/,
    );
  });

  it('gives the same comparison twice', () => {
    const scene = bowlScene([12]);
    const options = { rainfallPositionsMm: positions };
    const a = runScenario(scene, 'partly-blocked', 12, options);
    const b = runScenario(scene, 'partly-blocked', 12, options);
    expect(a.map((p) => p.cellsHigherThanBaseline)).toEqual(b.map((p) => p.cellsHigherThanBaseline));
  });

  it('is unaffected by how many positions the interface chooses to show', () => {
    // Positions are solved independently from zero, so a position's answer
    // cannot depend on its neighbours.
    const scene = bowlScene([12]);
    const many = runScenario(scene, 'fully-blocked', 12, { rainfallPositionsMm: [10, 25, 40, 60] });
    const few = runScenario(scene, 'fully-blocked', 12, { rainfallPositionsMm: [40] });
    const at40 = many.find((p) => p.accumulatedRainfallMm === 40);
    expect(few[0]?.cellsHigherThanBaseline).toBe(at40?.cellsHigherThanBaseline);
  });
});
