/**
 * The refusals nobody had made fire.
 *
 * `assertFloodHistory` is the guard between a published artefact and a board
 * that ranks thirty areas of Melbourne by how often the SES was called. Its
 * happy path is well covered. Several of its refusals were not — the branches
 * were never taken, so a guard that had stopped guarding would have looked
 * exactly the same from outside.
 *
 * That matters more here than in most places. This product's argument is that
 * it refuses rather than guesses, and a refusal that is never exercised is a
 * claim rather than a behaviour. It is also the artefact most likely to change
 * shape: the flood board is the one screen that reads a rollup produced by a
 * separate pipeline stage from a separate source.
 */

import { describe, expect, it } from 'vitest';

import { assertFloodHistory } from './artefact.js';

/** A minimal artefact the guard accepts, to break one field at a time. */
const sound = () => ({
  artefact: 'flood-history',
  version: 1,
  basis: 'sourceProvided',
  note: 'Counts of Victoria SES crew dispatches recorded as Flood.',
  source: {
    dataset: 'VICSES Incidents',
    dataset_id: 'vicses-incidents',
    publisher: 'Victoria State Emergency Service',
    licence: 'CC BY 4.0',
  },
  geographySource: {
    dataset: 'ASGS 2011',
    dataset_id: 'asgs-2011',
    publisher: 'ABS',
    licence: 'CC BY 4.0',
  },
  reportingPeriod: { start: '2009-07-01', end: '2015-06-30', years: ['2009-10', '2010-11'] },
  geography: { unit: 'SA2', standard: 'ASGS 2011', scope: 'Greater Melbourne' },
  incidentType: 'Flood',
  excludes: 'Storm',
  defaultAreas: 1,
  counts: { areasPublished: 2 },
  areas: [
    { rank: 1, name: 'Bacchus Marsh', total: 9, byYear: [5, 4], regions: 3, suppressedRegions: 0, complete: true },
    { rank: 2, name: 'Croydon', total: 3, byYear: [2, 1], regions: 2, suppressedRegions: 1, complete: false },
  ],
});

/** The artefact with one thing changed, as the guard will receive it. */
const broken = (change: (a: ReturnType<typeof sound>) => void): unknown => {
  const a = sound();
  change(a);
  return a;
};

describe('refusing a flood-history artefact that cannot be drawn', () => {
  it('accepts the sound one, so the refusals below mean something', () => {
    // Without this, every test here could pass against a guard that refuses
    // everything.
    expect(() => {
      assertFloodHistory(sound());
    }).not.toThrow();
  });

  it('refuses one carrying no areas', () => {
    expect(() => {
      assertFloodHistory(broken((a) => ((a as { areas: unknown }).areas = [])));
    }).toThrow(/no areas/);
  });

  it('refuses one that does not say how many areas are the default view', () => {
    // The board opens showing some of them and offers *Show more*. Without
    // this number it does not know where to cut.
    expect(() => {
      assertFloodHistory(broken((a) => ((a as { defaultAreas: unknown }).defaultAreas = 0)));
    }).toThrow(/default view/);
  });

  it('refuses one whose default view is larger than the list', () => {
    expect(() => {
      assertFloodHistory(broken((a) => ((a as { defaultAreas: number }).defaultAreas = 9)));
    }).toThrow(/default view/);
  });

  it('refuses an area with no name', () => {
    expect(() => {
      assertFloodHistory(broken((a) => (a.areas[0]!.name = '')));
    }).toThrow(/has no name/);
  });

  it('refuses an area whose total is not a usable number', () => {
    for (const total of [-1, Number.NaN, 'nine' as unknown as number]) {
      expect(() => {
        assertFloodHistory(broken((a) => (a.areas[0]!.total = total)));
      }).toThrow(/usable total/);
    }
  });

  it('refuses a list whose ranks do not match their positions', () => {
    /*
     * The board draws the rank beside the name. A list sorted one way and
     * ranked another puts "1" next to the second-highest area, which is a
     * wrong answer with the right shape — exactly what a shape check misses.
     */
    expect(() => {
      assertFloodHistory(broken((a) => (a.areas[1]!.rank = 5)));
    }).toThrow(/ranked 5 at position 2/);
  });

  it('refuses an area whose years do not match the reporting period', () => {
    expect(() => {
      assertFloodHistory(broken((a) => (a.areas[0]!.byYear = [1])));
    }).toThrow(/years/);
  });

  it('refuses a count that is a string, rather than adding it to a total', () => {
    /*
     * `Array.isArray` narrows the element type to `any`, so a string entry
     * would concatenate its way to a total that still looks like a number.
     * This is why the sum is built with each value checked rather than
     * reduced and trusted.
     */
    expect(() => {
      assertFloodHistory(
        broken((a) => (a.areas[0]!.byYear = ['5' as unknown as number, 4])),
      );
    }).toThrow(/where a count should be/);
  });

  it('refuses a negative count', () => {
    expect(() => {
      assertFloodHistory(broken((a) => (a.areas[0]!.byYear = [-1, 4])));
    }).toThrow(/where a count should be/);
  });
});
