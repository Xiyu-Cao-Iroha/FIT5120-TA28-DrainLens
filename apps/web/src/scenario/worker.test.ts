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

import { MAX_REPORTED_DIFFERENCE_CELLS, higherAreasOf } from './worker.js';

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
