/**
 * The cell-to-metres conversion the difference layer is drawn from.
 *
 * This is the boundary the engine's per-cell answer crosses to reach the
 * screen, and the one place in this repository where a coordinate is rebuilt
 * rather than carried. The last time that happened — a drain's cell derived
 * from the map artefact instead of read from the scene — all 895 drains
 * disagreed and every comparison returned `invalid_inlet`. So the conversion
 * is exercised here rather than trusted.
 */
import { describe, expect, it } from 'vitest';

import { type DepressionField, type FlowField, LEAVES_WINDOW } from '@drainlens/scenario';

import { MAX_REPORTED_DIFFERENCE_CELLS, extraWaterRoute, higherAreasOf } from './worker.js';

/** Four columns by three rows at 10 m, so a flip is unambiguous. */
const GRID = { width: 4, height: 3, cellSizeM: 10 };

/** `.` is unchanged, `H` is higher than baseline. Row 0 is the north edge. */
const bandsFrom = (rows: readonly string[]): string[] =>
  rows
    .join('')
    .split('')
    .map((mark) => (mark === 'H' ? 'higher-than-baseline' : 'no-clear-change'));

describe('turning changed cells into local metres', () => {
  it('reports nothing when nothing changed', () => {
    expect(higherAreasOf(bandsFrom(['....', '....', '....']), GRID)).toEqual([]);
  });

  it('puts the north-west cell at the top of the grid, not the bottom', () => {
    // Row 0 is the *north* edge and northing grows upward, so cell 0 is at
    // the maximum northing. Reading the row index as a northing mirrors the
    // whole layer about the middle of the extent — which on a square grid
    // looks entirely plausible and is wrong everywhere.
    expect(higherAreasOf(bandsFrom(['H...', '....', '....']), GRID)).toEqual([[0, 20]]);
  });

  it('puts the south-west cell at northing zero', () => {
    expect(higherAreasOf(bandsFrom(['....', '....', 'H...']), GRID)).toEqual([[0, 0]]);
  });

  it('measures easting from the west edge', () => {
    expect(higherAreasOf(bandsFrom(['...H', '....', '....']), GRID)).toEqual([[30, 20]]);
  });

  it('scales both axes by the cell size', () => {
    const metre = { width: 4, height: 3, cellSizeM: 1 };
    expect(higherAreasOf(bandsFrom(['....', '....', '...H']), metre)).toEqual([[3, 0]]);
  });

  it('keeps every changed cell and no unchanged one', () => {
    const areas = higherAreasOf(bandsFrom(['H..H', '.H..', '....']), GRID);
    expect(areas).toEqual([
      [0, 20],
      [30, 20],
      [10, 10],
    ]);
  });

  it('ignores a band it does not recognise rather than guessing', () => {
    // `no-clear-change` is the only other band the engine emits today. A
    // third one added later must not silently become a highlight.
    expect(higherAreasOf(['something-else', 'higher-than-baseline'], GRID)).toEqual([[10, 20]]);
  });

  it('stops at the cap instead of posting an unbounded message', () => {
    // The measured worst case in this extent is 652, so the cap never binds
    // on the published artefact. It exists so a future artefact whose
    // hollows connect cannot freeze the tab.
    const many = Array.from({ length: MAX_REPORTED_DIFFERENCE_CELLS + 50 }, () =>
      'higher-than-baseline',
    );
    const wide = { width: many.length, height: 1, cellSizeM: 1 };
    expect(higherAreasOf(many, wide)).toHaveLength(MAX_REPORTED_DIFFERENCE_CELLS);
  });
});

describe('the route the extra water takes to the difference', () => {
  // Five columns by three rows at 1 m. Directions are D8 codes: E 0, S 2, W 4, N 6; `.` leaves.
  const ROUTE_GRID = { width: 5, height: 3, cellSizeM: 1 };
  const CODES: Record<string, number> = { E: 0, S: 2, W: 4, N: 6, '.': LEAVES_WINDOW };
  const flowFrom = (rows: readonly string[]): FlowField => ({
    width: 5,
    height: 3,
    direction: Int8Array.from(rows.join('').split(''), (mark) => CODES[mark]!),
  });
  const hollows = (...groups: { cells: number[]; spillCell: number }[]): DepressionField => {
    const cellDepression = new Int32Array(15).fill(-1);
    groups.forEach((group, id) => group.cells.forEach((cell) => (cellDepression[cell] = id)));
    return {
      cellDepression,
      depressions: groups.map((group, id) => ({
        id,
        cells: group.cells,
        capacityM3: 1,
        spillElevationM: 0,
        spillCell: group.spillCell,
      })),
    };
  };
  const none = hollows();

  it('runs downhill from the drain and keeps only the corners', () => {
    const flow = flowFrom(['EES..', '..S..', '.....']);
    const bands = bandsFrom(['.....', '.....', '..H..']);
    // Drain at cell 0; east to cell 2, south to cell 12, which is marked.
    expect(extraWaterRoute(bands, flow, none, 0, ROUTE_GRID)).toEqual([
      [0.5, 2.5],
      [2.5, 2.5],
      [2.5, 0.5],
    ]);
  });

  it('passes through a hollow with no difference at its spill cell', () => {
    // The water lands in the hollow at cell 1, which spills at cell 3; from
    // there it runs south into the marked hollow at 13 and 14.
    const flow = flowFrom(['E..S.', '...S.', '.....']);
    const bands = bandsFrom(['.....', '.....', '....H']);
    const field = hollows({ cells: [1, 2], spillCell: 3 }, { cells: [13, 14], spillCell: LEAVES_WINDOW });
    expect(extraWaterRoute(bands, flow, field, 0, ROUTE_GRID)).toEqual([
      [0.5, 2.5],
      [1.5, 2.5],
      [3.5, 2.5],
      [3.5, 0.5],
      [4.5, 0.5],
    ]);
  });

  it('draws nothing when nothing is higher', () => {
    const flow = flowFrom(['EES..', '..S..', '.....']);
    expect(extraWaterRoute(bandsFrom(['.....', '.....', '.....']), flow, none, 0, ROUTE_GRID)).toEqual([]);
  });

  it('draws nothing when the water leaves before reaching the difference', () => {
    // The marked cell is off the route: a line ending elsewhere would be a claim.
    const flow = flowFrom(['EEEE.', '.....', '.....']);
    const bands = bandsFrom(['.....', '.....', 'H....']);
    expect(extraWaterRoute(bands, flow, none, 0, ROUTE_GRID)).toEqual([]);
  });

  it('stops rather than spinning on a loop', () => {
    const flow = flowFrom(['ES...', 'NW...', '.....']);
    const bands = bandsFrom(['.....', '.....', '....H']);
    expect(extraWaterRoute(bands, flow, none, 0, ROUTE_GRID)).toEqual([]);
  });
});
