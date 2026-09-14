/**
 * The eligibility check: the nearest comparable drain, or none.
 *
 * Run before any setup, so a wrong answer here either offers a drain the
 * engine will refuse or turns a person away from an address that could have
 * been compared. Both are tested at the edges of the radius, not in the middle.
 */

import { describe, expect, it } from 'vitest';

import type { Pit } from '../map/artefact.js';
import { TEACHING_RADIUS_M } from '../tutorial/pit.js';
import { COMPARISON_RADIUS_M, aboutMetres, comparableNear } from './eligibility.js';

const pit = (asset: number | undefined, east: number, north: number): Pit => ({
  g: 'point',
  c: [east, north],
  ...(asset === undefined ? {} : { asset_number: asset }),
});

const HOME = [500, 500] as const;

describe('the nearest drain the comparison can use', () => {
  it('picks the nearest supported inlet, not the nearest pit', () => {
    const pits = [pit(1, 505, 500), pit(2, 540, 500), pit(3, 520, 500)];
    const found = comparableNear(HOME, pits, new Set(['2', '3']));
    expect(found.nearest?.assetNumber).toBe('3');
    expect(found.nearest?.distanceM).toBe(20);
  });

  it('orders the other comparable drains by distance, for the keyboard path', () => {
    const pits = [pit(10, 600, 500), pit(11, 500, 530), pit(12, 500, 450), pit(13, 690, 500)];
    const found = comparableNear(HOME, pits, new Set(['10', '11', '12', '13']));
    expect(found.nearest?.assetNumber).toBe('11');
    expect(found.others.map((d) => d.assetNumber)).toEqual(['12', '10', '13']);
  });

  it('includes a drain exactly on the radius and nothing past it', () => {
    const pits = [pit(1, 500 + COMPARISON_RADIUS_M, 500), pit(2, 500, 500 + COMPARISON_RADIUS_M + 0.1)];
    const found = comparableNear(HOME, pits, new Set(['1', '2']));
    expect(found.nearest?.assetNumber).toBe('1');
    expect(found.others).toEqual([]);
  });

  it('answers none when nothing comparable is within reach — the no-match state', () => {
    const pits = [pit(1, 900, 900), pit(2, 510, 500)];
    expect(comparableNear(HOME, pits, new Set(['1']))).toEqual({ nearest: null, others: [] });
    expect(comparableNear(HOME, pits, new Set())).toEqual({ nearest: null, others: [] });
    expect(comparableNear(HOME, [], new Set(['1']))).toEqual({ nearest: null, others: [] });
  });

  it('takes a radius, so a test can force the no-match state', () => {
    const pits = [pit(1, 560, 500)];
    expect(comparableNear(HOME, pits, new Set(['1']), 50).nearest).toBeNull();
    expect(comparableNear(HOME, pits, new Set(['1']), 60).nearest?.assetNumber).toBe('1');
  });

  it('counts an asset listed twice once, at its nearer position', () => {
    const pits = [pit(7, 580, 500), pit(7, 530, 500), pit(8, 550, 500)];
    const found = comparableNear(HOME, pits, new Set(['7', '8']));
    expect(found.nearest).toEqual({ assetNumber: '7', at: [530, 500], distanceM: 30 });
    expect(found.others.map((d) => d.assetNumber)).toEqual(['8']);
  });

  it('breaks a tie on the asset number, so the same address always highlights the same drain', () => {
    const one = comparableNear(HOME, [pit(9, 540, 500), pit(4, 460, 500)], new Set(['4', '9']));
    const other = comparableNear(HOME, [pit(4, 460, 500), pit(9, 540, 500)], new Set(['4', '9']));
    expect(one.nearest?.assetNumber).toBe('4');
    expect(other.nearest?.assetNumber).toBe('4');
  });

  it('ignores a pit with no asset number, which the worker cannot name', () => {
    expect(comparableNear(HOME, [pit(undefined, 501, 500)], new Set(['undefined'])).nearest).toBeNull();
  });

  it('means the same distance as the guide’s “near your address”', () => {
    expect(COMPARISON_RADIUS_M).toBe(TEACHING_RADIUS_M);
  });
});

describe('the distance in the sentence', () => {
  it('rounds to ten metres and never says zero', () => {
    expect(aboutMetres(24.2)).toBe(20);
    expect(aboutMetres(66)).toBe(70);
    expect(aboutMetres(3)).toBe(10);
    expect(aboutMetres(0)).toBe(10);
    expect(aboutMetres(195)).toBe(200);
  });
});
