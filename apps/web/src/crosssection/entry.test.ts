/**
 * Whether the record says water enters at a pit, checked against the types the
 * record actually uses.
 *
 * **Every string below is one the council publishes**, with the count it has
 * in this extent, taken from `map.json` rather than imagined. That matters
 * because the failure this prevents is not a wrong branch — it is a confident
 * arrow of water running off the street into a pit the council calls a
 * junction, drawn on 126 pits, which nobody would notice because it looks
 * exactly like the 689 where it is right.
 */

import { describe, expect, it } from 'vitest';

import { PIT_SUMMARY, SURFACE_ENTRY_NOTE, surfaceEntryOf } from './section.js';
import type { Pit } from '../map/artefact.js';

const pit = (type?: string): Pit =>
  ({
    g: 'point',
    c: [0, 0],
    asset_number: 1,
    ...(type === undefined ? {} : { object_type_lupvalue: type }),
  }) as unknown as Pit;

describe('types the record uses for a way in', () => {
  // 689 of the 895 pits in this extent, by these names.
  it.each([
    ['Grated Side Entry', 313],
    ['Grated OFK', 92],
    ['Grated Kerbside', 25],
    ['Side Entry', 18],
    ['Double Grated OFK', 8],
    ['Run Through Inlet', 8],
    ['Grated Manhole', 6],
    ['Double GSEP', 2],
  ])('reads %s as an inlet (%i pits)', (type) => {
    expect(surfaceEntryOf(pit(type))).toBe('recorded-inlet');
  });
});

describe('types the record uses for a join', () => {
  it.each([
    ['Junction', 126],
    ['System Node', 41],
  ])('reads %s as not an inlet (%i pits)', (type) => {
    expect(surfaceEntryOf(pit(type))).toBe('not-an-inlet');
  });
});

describe('types that say neither', () => {
  it('reads Lane Type as unrecorded rather than guessing', () => {
    // 217 pits. It names a location, not a grate. Reading it either way would
    // put a quarter of the map into a claim the council did not make.
    expect(surfaceEntryOf(pit('Lane Type'))).toBe('not-recorded');
  });

  it.each([['Not Known'], ['Other'], ['Submerged']])(
    'reads %s as unrecorded',
    (type) => {
      expect(surfaceEntryOf(pit(type))).toBe('not-recorded');
    },
  );

  it('reads a pit with no recorded type as unrecorded', () => {
    // 22 pits carry no type at all, and an absent key is not an empty grate.
    expect(surfaceEntryOf(pit())).toBe('not-recorded');
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
