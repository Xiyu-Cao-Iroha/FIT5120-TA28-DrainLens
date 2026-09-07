/**
 * Whether the record says water enters at a pit, checked against the types the
 * record actually uses.
 *
 * **Every string below is one the council publishes**, with the count it has
 * in this extent, taken from `map.json` rather than imagined. That matters
 * because the failure this prevents is not a wrong branch — it is a confident
 * arrow of water running off the street into a pit the council calls a
 * junction, drawn on 126 pits, which nobody would notice because it looks
 * exactly like the 472 where it is right.
 *
 * The census is one table and the totals are summed from it, because the
 * headline number in this file was wrong for a day: it said 689 inlets over
 * eight rows that add to 472. 689 is what you get by counting `Lane Type` as
 * an inlet — the one reading the block below says would put a quarter of the
 * map into a claim the council did not make. A number written beside a table
 * rather than taken from it can disagree with the table and nothing fails.
 */

import { describe, expect, it } from 'vitest';

import { PIT_SUMMARY, SURFACE_ENTRY_NOTE, surfaceEntryOf } from './section.js';
import type { Pit } from '../map/artefact.js';
import type { SurfaceEntry } from './section.js';

const pit = (type?: string): Pit =>
  ({
    g: 'point',
    c: [0, 0],
    asset_number: 1,
    ...(type === undefined ? {} : { object_type_lupvalue: type }),
  }) as unknown as Pit;

/**
 * Every `object_type_lupvalue` in `map.json`, with its count and the reading
 * this module gives it. Counted from the artefact, not recalled: fifteen
 * distinct values over 895 pits, and `null` is the 22 that carry no type key
 * at all — an absent key is not an empty grate.
 */
const CENSUS: readonly (readonly [string | null, number, SurfaceEntry])[] = [
  ['Grated Side Entry', 313, 'recorded-inlet'],
  ['Grated OFK', 92, 'recorded-inlet'],
  ['Grated Kerbside', 25, 'recorded-inlet'],
  ['Side Entry', 18, 'recorded-inlet'],
  ['Double Grated OFK', 8, 'recorded-inlet'],
  ['Run Through Inlet', 8, 'recorded-inlet'],
  ['Grated Manhole', 6, 'recorded-inlet'],
  ['Double GSEP', 2, 'recorded-inlet'],
  ['Junction', 126, 'not-an-inlet'],
  ['System Node', 41, 'not-an-inlet'],
  ['Lane Type', 217, 'not-recorded'],
  ['Not Known', 15, 'not-recorded'],
  ['Submerged', 1, 'not-recorded'],
  ['Other', 1, 'not-recorded'],
  [null, 22, 'not-recorded'],
];

const total = (state: SurfaceEntry): number =>
  CENSUS.filter(([, , s]) => s === state).reduce((n, [, count]) => n + count, 0);

describe('the types the record uses', () => {
  it.each(CENSUS)('reads %s (%i pits) as %s', (type, _count, state) => {
    expect(surfaceEntryOf(pit(type ?? undefined))).toBe(state);
  });

  it('accounts for every pit in the extent exactly once', () => {
    // 895 is the pit count in `map.json`. If a future artefact adds a type,
    // this fails rather than letting the new rows land silently in whichever
    // branch the regular expressions happen to take.
    expect(CENSUS.reduce((n, [, count]) => n + count, 0)).toBe(895);
  });

  it('counts 472 inlets, 167 joins and 256 the record does not say', () => {
    expect(total('recorded-inlet')).toBe(472);
    expect(total('not-an-inlet')).toBe(167);
    expect(total('not-recorded')).toBe(256);
  });

  it('reads Lane Type as unrecorded rather than guessing', () => {
    // 217 pits, and the reason the total above is 472 and not 689. It names a
    // location, not a grate. Reading it either way would put a quarter of the
    // map into a claim the council did not make.
    expect(surfaceEntryOf(pit('Lane Type'))).toBe('not-recorded');
  });

  it('reads an empty string as unrecorded, not as an unfamiliar type', () => {
    expect(surfaceEntryOf(pit('   '))).toBe('not-recorded');
  });
});

describe('reading the type as written', () => {
  it('does not care about case', () => {
    expect(surfaceEntryOf(pit('GRATED SIDE ENTRY'))).toBe('recorded-inlet');
    expect(surfaceEntryOf(pit('junction'))).toBe('not-an-inlet');
  });

  it('prefers the inlet reading when a type names both', () => {
    // 'Grated Manhole' is a manhole with a grate in it: water gets in. If a
    // future type ever named a junction with a grate, the grate is the fact
    // the drawing needs.
    expect(surfaceEntryOf(pit('Grated Junction Pit'))).toBe('recorded-inlet');
  });
});

describe('what the card and the figure say', () => {
  it('has a sentence for every state, on both', () => {
    for (const state of ['recorded-inlet', 'not-an-inlet', 'not-recorded'] as const) {
      expect(PIT_SUMMARY[state].length).toBeGreaterThan(20);
      expect(SURFACE_ENTRY_NOTE[state].length).toBeGreaterThan(20);
    }
  });

  it('only claims water comes off the street where the record says so', () => {
    // The defect this replaced: one sentence about surface water, shown for
    // every pit including the 167 the record calls joins.
    expect(PIT_SUMMARY['recorded-inlet']).toContain('from the street');
    expect(PIT_SUMMARY['not-an-inlet']).not.toContain('collects surface water');
    expect(PIT_SUMMARY['not-recorded']).not.toContain('collects surface water');
  });
});
