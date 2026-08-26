import { describe, expect, it } from 'vitest';

import {
  TerrainError,
  bowl,
  cellAreaM2,
  cellCount,
  elevationAt,
  planarSlope,
} from './terrain.js';

describe('planar slope', () => {
  const grid = planarSlope({ width: 10, height: 4, cellSizeM: 5, gradient: 0.02 });

  it('has the extent it was asked for', () => {
    expect(grid.width).toBe(10);
    expect(grid.height).toBe(4);
    expect(cellCount(grid)).toBe(40);
    expect(cellAreaM2(grid)).toBe(25);
    expect(grid.elevationM).toHaveLength(40);
  });

  it('falls east at exactly the requested gradient', () => {
    // One cell east is 5 m at a 2% grade, so 0.1 m of fall.
    expect(elevationAt(grid, 0, 0)).toBeCloseTo(100, 5);
    expect(elevationAt(grid, 1, 0)).toBeCloseTo(99.9, 5);
    expect(elevationAt(grid, 9, 0)).toBeCloseTo(99.1, 5);
  });

  it('is uniform north to south, so every row drains identically', () => {
    for (let y = 1; y < grid.height; y += 1) {
      expect(elevationAt(grid, 4, y)).toBeCloseTo(elevationAt(grid, 4, 0), 5);
    }
  });

  it('has nowhere for water to collect', () => {
    // The property the fixture exists to assert: every cell is strictly higher
    // than the one east of it, so no cell is a local minimum and an engine
    // reporting ponding here has a routing defect.
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 1; x < grid.width; x += 1) {
        expect(elevationAt(grid, x, y)).toBeLessThan(elevationAt(grid, x - 1, y));
      }
    }
  });

  it('honours a supplied base elevation', () => {
    const raised = planarSlope({ width: 3, height: 1, cellSizeM: 1, gradient: 0.1, baseElevationM: 12 });
    expect(elevationAt(raised, 0, 0)).toBeCloseTo(12, 5);
  });

  it('refuses an extent or gradient that is not a slope', () => {
    expect(() => planarSlope({ width: 0, height: 4, cellSizeM: 5, gradient: 0.02 })).toThrow(TerrainError);
    expect(() => planarSlope({ width: 2.5, height: 4, cellSizeM: 5, gradient: 0.02 })).toThrow(TerrainError);
    expect(() => planarSlope({ width: 4, height: 4, cellSizeM: 0, gradient: 0.02 })).toThrow(TerrainError);
    expect(() => planarSlope({ width: 4, height: 4, cellSizeM: 5, gradient: 0 })).toThrow(/not a slope/);
    expect(() => planarSlope({ width: 4, height: 4, cellSizeM: 5, gradient: -0.01 })).toThrow(TerrainError);
  });
});

describe('bowl', () => {
  const fixture = bowl({
    width: 10,
    height: 10,
    cellSizeM: 2,
    depthM: 0.5,
    pitWidth: 4,
    pitHeight: 3,
  });

  it('states exactly how much water it holds before it spills', () => {
    // 12 cells, 4 m² each, 0.5 m deep — a product of three numbers, not an
    // approximation the test has to tolerate.
    expect(fixture.depressionCells).toHaveLength(12);
    expect(fixture.capacityM3).toBeCloseTo(24, 6);
    expect(fixture.spillElevationM).toBeCloseTo(100, 6);
  });

  it('sits the depression below a flat surrounding plane', () => {
    const { grid } = fixture;
    for (const index of fixture.depressionCells) {
      expect(grid.elevationM[index]).toBeCloseTo(99.5, 5);
    }
    expect(elevationAt(grid, 0, 0)).toBeCloseTo(100, 5);
    expect(elevationAt(grid, 9, 9)).toBeCloseTo(100, 5);
  });

  it('leaves a rim on every side, so the depression is enclosed', () => {
    const { grid } = fixture;
    for (let x = 0; x < grid.width; x += 1) {
      expect(elevationAt(grid, x, 0)).toBeCloseTo(100, 5);
      expect(elevationAt(grid, x, grid.height - 1)).toBeCloseTo(100, 5);
    }
    for (let y = 0; y < grid.height; y += 1) {
      expect(elevationAt(grid, 0, y)).toBeCloseTo(100, 5);
      expect(elevationAt(grid, grid.width - 1, y)).toBeCloseTo(100, 5);
    }
  });

  it('scales capacity with cell size, depth and pit extent', () => {
    const deeper = bowl({ ...fixture.grid, depthM: 1, pitWidth: 4, pitHeight: 3 });
    expect(deeper.capacityM3).toBeCloseTo(48, 6);

    const wider = bowl({ ...fixture.grid, depthM: 0.5, pitWidth: 6, pitHeight: 3 });
    expect(wider.capacityM3).toBeCloseTo(36, 6);
  });

  it('refuses a depression that would not fit inside a rim', () => {
    const spec = { width: 6, height: 6, cellSizeM: 1, depthM: 0.5 };
    expect(() => bowl({ ...spec, pitWidth: 6, pitHeight: 2 })).toThrow(/rim on every side/);
    expect(() => bowl({ ...spec, pitWidth: 2, pitHeight: 6 })).toThrow(/rim on every side/);
    expect(() => bowl({ ...spec, pitWidth: 0, pitHeight: 2 })).toThrow(TerrainError);
  });

  it('refuses a depth that is not a depth', () => {
    const spec = { width: 6, height: 6, cellSizeM: 1, pitWidth: 2, pitHeight: 2 };
    expect(() => bowl({ ...spec, depthM: 0 })).toThrow(/positive depth/);
    expect(() => bowl({ ...spec, depthM: Number.NaN })).toThrow(TerrainError);
  });
});

describe('elevationAt', () => {
  const grid = planarSlope({ width: 3, height: 3, cellSizeM: 1, gradient: 0.1 });

  it('refuses a coordinate outside the grid rather than returning undefined', () => {
    expect(() => elevationAt(grid, -1, 0)).toThrow(TerrainError);
    expect(() => elevationAt(grid, 0, -1)).toThrow(TerrainError);
    expect(() => elevationAt(grid, 3, 0)).toThrow(/outside the grid/);
    expect(() => elevationAt(grid, 0, 3)).toThrow(/outside the grid/);
  });
});
