/**
 * The judgements the API makes on the way out of the database.
 *
 * Three of them can produce a board that is confidently wrong rather than
 * visibly incomplete, which is the failure this product exists to avoid: a
 * withheld count summed as zero, a tie presented as an ordering, and a year
 * that lands in the wrong slot of a sparkline. None needs a database to test.
 */

import { describe, expect, it } from 'vitest';

import {
  type IncidentRow,
  decimetre,
  pitFeature,
  rank,
  totalsByArea,
} from './artefacts.js';

const YEARS = ['2009-10', '2010-11', '2011-12'] as const;

const row = (
  sa2_name: string,
  financial_year: string,
  count: number | null,
  sa1_code_2011 = '2110101',
): IncidentRow => ({ sa2_name, financial_year, count, sa1_code_2011 });

describe('summing an area', () => {
  it('places each year in its own slot', () => {
    const totals = totalsByArea(
      [row('Kensington', '2009-10', 4), row('Kensington', '2011-12', 9)],
      YEARS,
    );
    expect(totals[0]?.byYear).toEqual([4, 0, 9]);
    expect(totals[0]?.total).toBe(13);
  });

  it('adds regions that share a year rather than overwriting them', () => {
    const totals = totalsByArea(
      [row('Kensington', '2010-11', 3, '2110101'), row('Kensington', '2010-11', 5, '2110102')],
      YEARS,
    );
    expect(totals[0]?.byYear).toEqual([0, 8, 0]);
    expect(totals[0]?.regions).toBe(2);
  });

  it('never counts a withheld figure as a zero', () => {
    // The heart of it. COALESCE(count, 0) in SQL would give a total of 4 here
    // and call it exact; the truth is "at least 4, and we do not know by how
    // much more".
    const totals = totalsByArea(
      [row('Kensington', '2009-10', 4, '2110101'), row('Kensington', '2010-11', null, '2110102')],
      YEARS,
    );
    expect(totals[0]?.total).toBe(4);
    expect(totals[0]?.complete).toBe(false);
    expect(totals[0]?.suppressedRegions).toBe(1);
  });

  it('is complete when nothing in it was withheld', () => {
    const totals = totalsByArea([row('Kensington', '2009-10', 4)], YEARS);
    expect(totals[0]?.complete).toBe(true);
    expect(totals[0]?.suppressedRegions).toBe(0);
  });

  it('counts a withheld region once, however many years it withholds', () => {
    const totals = totalsByArea(
      [
        row('Kensington', '2009-10', null, '2110101'),
        row('Kensington', '2010-11', null, '2110101'),
      ],
      YEARS,
    );
    expect(totals[0]?.suppressedRegions).toBe(1);
    expect(totals[0]?.regions).toBe(1);
  });

  it('drops a year the artefact does not publish instead of appending it', () => {
    // Appending would push every later year one place along and quietly
    // rewrite the sparkline, which is a wrong picture rather than a missing
    // one.
    const totals = totalsByArea(
      [row('Kensington', '2009-10', 4), row('Kensington', '2020-21', 99)],
      YEARS,
    );
    expect(totals[0]?.byYear).toHaveLength(3);
    expect(totals[0]?.byYear).toEqual([4, 0, 0]);
    expect(totals[0]?.total).toBe(4);
  });

  it('keeps areas apart', () => {
    const totals = totalsByArea(
      [row('Kensington', '2009-10', 4), row('Flemington', '2009-10', 7)],
      YEARS,
    );
    expect(totals).toHaveLength(2);
    expect(totals.find((a) => a.name === 'Flemington')?.total).toBe(7);
  });
});

describe('ranking', () => {
  const area = (name: string, total: number) => ({
    name,
    total,
    byYear: [total],
    regions: 1,
    suppressedRegions: 0,
    complete: true,
  });

  it('orders by total, highest first', () => {
    const ranked = rank([area('B', 10), area('A', 30), area('C', 20)]);
    expect(ranked.map((a) => a.name)).toEqual(['A', 'C', 'B']);
    expect(ranked.map((a) => a.rank)).toEqual([1, 2, 3]);
  });

  it('gives equal totals the same rank, and skips the one after', () => {
    // Ranks five and six were both 133 the first time this data was ranked.
    // Numbering them 5 and 6 by whatever order the rows arrived in would make
    // the database's row order into a finding.
    const ranked = rank([area('A', 30), area('B', 20), area('C', 20), area('D', 10)]);
    expect(ranked.map((a) => a.rank)).toEqual([1, 2, 2, 4]);
  });

  it('marks both sides of a tie', () => {
    const ranked = rank([area('A', 30), area('B', 20), area('C', 20)]);
    expect(ranked.find((a) => a.name === 'B')?.tied).toBe(true);
    expect(ranked.find((a) => a.name === 'C')?.tied).toBe(true);
    expect(ranked.find((a) => a.name === 'A')?.tied).toBe(false);
  });

  it('breaks a tie by name, so the same rows always give the same page', () => {
    const one = rank([area('Zed', 20), area('Alpha', 20)]);
    const two = rank([area('Alpha', 20), area('Zed', 20)]);
    expect(one.map((a) => a.name)).toEqual(two.map((a) => a.name));
    expect(one[0]?.name).toBe('Alpha');
  });

  it('does not mutate what it was given', () => {
    const input = [area('B', 10), area('A', 30)];
    rank(input);
    expect(input.map((a) => a.name)).toEqual(['B', 'A']);
  });
});

describe('coordinates', () => {
  it('comes back at the decimetre the survey supports', () => {
    // Postgres returns double precision and JavaScript prints every bit of
    // it. A payload carrying 454.80000000000007 claims a precision the source
    // never had.
    expect(decimetre(454.80000000000007)).toBe(454.8);
    expect(decimetre(118.90000000000001)).toBe(118.9);
  });

  it('rounds a genuine half up, which is a choice rather than an accident', () => {
    // 118.95 is not noise on a stored decimetre -- it is a value between two
    // of them, and it can only arise if something upstream started publishing
    // centimetres. Half-up is the convention; the case is pinned so that a
    // change to it is visible rather than discovered in a coordinate.
    expect(decimetre(118.95)).toBe(119);
    expect(decimetre(-118.95)).toBe(-118.9);
  });

  it('leaves a value that is already a decimetre alone', () => {
    expect(decimetre(454.8)).toBe(454.8);
    expect(decimetre(0)).toBe(0);
  });
});

describe('one pit, in the shape the map reads', () => {
  const base = {
    asset_number: '1145184',
    e_m: 454.8,
    n_m: 118.9,
    description: 'SWD Pit - Lane Type',
    object_type: 'Lane Type',
  };

  it('matches what map.json publishes', () => {
    expect(pitFeature(base)).toEqual({
      g: 'point',
      c: [454.8, 118.9],
      asset_number: 1145184,
      asset_description: 'SWD Pit - Lane Type',
      object_type_lupvalue: 'Lane Type',
    });
  });

  it('omits a field the record does not hold rather than sending null', () => {
    // The frontend distinguishes "the council recorded nothing" from "this key
    // was absent", and renders the first as *Not recorded*. A null would
    // arrive as a value and print as one.
    const sparse = pitFeature({ ...base, description: null, object_type: null });
    expect('asset_description' in sparse).toBe(false);
    expect('object_type_lupvalue' in sparse).toBe(false);
  });

  it('returns the asset number as a number, whatever pg hands over', () => {
    // bigint arrives from node-postgres as a string, because it does not fit
    // a float safely. The artefact has always carried a number and the
    // frontend compares it with ===.
    expect(pitFeature(base).asset_number).toBe(1145184);
    expect(pitFeature({ ...base, asset_number: 1145184 }).asset_number).toBe(1145184);
  });
});
