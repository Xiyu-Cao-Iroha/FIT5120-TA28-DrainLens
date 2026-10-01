/**
 * The board's units, its tooltips and its second ranking.
 *
 * Small fixtures for the rules, and the published artefacts for the claims
 * the page makes about real areas — the worked example is computed from the
 * data, so a test that only used fixtures could not notice it had stopped
 * matching what is on screen.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FLOOD } from '../ui/terms.js';
import { type FloodHistoryArtefact, yearSpan } from './artefact.js';
import {
  atLeastTip,
  bandLabel,
  bandName,
  bandRules,
  countFigure,
  exampleSum,
  figureText,
  listNames,
  rankByRate,
  rateFigure,
  rateTiedBeyond,
  rateTip,
  readableDate,
  sparklineLabel,
  topNote,
  unratedNote,
  wetYearNote,
  workedExample,
  yearTip,
} from './board.js';
import {
  type MapArea,
  type PointsArtefact,
  type PopulationArtefact,
  SEVERITY_BREAKS,
  type ScopeAreas,
  joinAreas,
  scoreLabel,
} from './severity.js';

const DATA = path.resolve(__dirname, '../../public/data');
const read = <T>(name: string): T => JSON.parse(readFileSync(path.join(DATA, name), 'utf8')) as T;

function area(name: string, total: number, persons: number | null, complete = true): MapArea {
  return {
    code: name,
    name,
    total,
    byYear: [total],
    complete,
    suppressedRegions: complete ? 0 : 1,
    regions: 10,
    persons,
    rate: persons === null ? null : (total / persons) * 1000,
    personsByYear: [persons ?? 0],
    e: 0,
    n: 0,
    rings: [],
  };
}

describe('units beside the numbers', () => {
  it('writes a count with its unit, and keeps a minimum marked', () => {
    expect(figureText(countFigure(209, true))).toBe('209 emergency responses');
    expect(figureText(countFigure(160, false))).toBe('160+ emergency responses');
    expect(countFigure(160, false)).toEqual({ value: '160', minimum: true, unit: 'emergency responses' });
    expect(figureText(countFigure(1, true))).toBe('1 emergency response');
    expect(figureText(countFigure(0, true))).toBe('0 emergency responses');
    expect(figureText(countFigure(1234, true))).toBe('1,234 emergency responses');
  });

  it('writes a rate with its unit, rounded exactly as the map rounds it', () => {
    const exact = area('Bacchus Marsh', 209, 18055);
    const floor = area('Gisborne', 133, 11717, false);
    expect(figureText(rateFigure(exact)!)).toBe(`${scoreLabel(exact)} ${FLOOD.rateUnit}`);
    expect(figureText(rateFigure(floor)!)).toBe(`${scoreLabel(floor)} ${FLOOD.rateUnit}`);
    expect(figureText(rateFigure(floor)!)).toBe('11.35+ emergency responses per 1,000 people');
    expect(rateFigure(area('Essendon Airport', 0, null))).toBeNull();
  });
});

describe('the sparkline tooltip', () => {
  it('names the financial year the way the page does, with the unit', () => {
    expect(yearTip('2010-11', 120, true)).toBe('2010/11: 120 emergency responses');
    expect(yearTip('2009-10', 1, true)).toBe('2009/10: 1 emergency response');
    expect(yearTip('2012-13', 7, false)).toBe('2012/13: 7+ emergency responses');
  });

  it('gives the whole chart one accessible name carrying every bar', () => {
    expect(sparklineLabel([3, 0], ['2009-10', '2010-11'], true)).toBe('2009/10: 3 emergency responses, 2010/11: 0 emergency responses');
  });
});

describe('the rate bands', () => {
  it('reads the thresholds from the band constants, name and range together', () => {
    expect(bandRules()).toEqual(SEVERITY_BREAKS.map((b) => b.label));
    expect(bandLabel(11.58)).toBe(SEVERITY_BREAKS[2]!.label);
    expect(bandLabel(1.3)).toBe(SEVERITY_BREAKS[0]!.label);
    expect(bandLabel(2)).toBe(SEVERITY_BREAKS[1]!.label);
    expect(bandLabel(null)).toBeNull();
    expect(bandLabel(-1)).toBeNull();
  });

  it('gives a list row the band name alone (copy audit v2, #76)', () => {
    expect(bandName(11.58)).toBe('High');
    expect(bandName(2)).toBe('Medium');
    expect(bandName(0.4)).toBe('Low');
    expect(bandName(null)).toBeNull();
  });
});

describe('ranking by rate', () => {
  const areas = [
    area('Low', 1, 5000),
    area('Nobody', 3, null),
    area('High', 50, 5000, false),
    area('Tie B', 3143, 1_000_000),
    area('Tie A', 3141, 1_000_000),
    area('Middle', 20, 5000),
  ];

  it('ranks only areas with a rate, highest first, and scales against the highest', () => {
    const { ranked, unrated, scale } = rankByRate(areas);
    expect(ranked.map((r) => r.area.name)).toEqual(['High', 'Middle', 'Tie B', 'Tie A', 'Low']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(unrated.map((a) => a.name)).toEqual(['Nobody']);
    expect(scale).toBe(10);
    expect(ranked[0]!.band).toBe(SEVERITY_BREAKS[2]!.name);
    expect(ranked[0]!.area.complete).toBe(false);
  });

  it('marks a tie where two rows show the same two decimals, and orders it by name', () => {
    const { ranked } = rankByRate(areas);
    expect(ranked.filter((r) => r.tied).map((r) => r.area.name)).toEqual(['Tie B', 'Tie A']);
    const equal = rankByRate([area('Zed', 10, 5000), area('Abe', 10, 5000)]).ranked;
    expect(equal.map((r) => r.area.name)).toEqual(['Abe', 'Zed']);
    expect(equal.every((r) => r.tied)).toBe(true);
  });

  it('names rows hidden by the cut that show the same rate as the last one shown', () => {
    const { ranked } = rankByRate(areas);
    expect(rateTiedBeyond(ranked, 3).map((r) => r.area.name)).toEqual(['Tie A']);
    expect(rateTiedBeyond(ranked, 2)).toEqual([]);
    expect(rateTiedBeyond(ranked, 5)).toEqual([]);
    expect(rateTiedBeyond(ranked, 0)).toEqual([]);
  });

  it('has a usable scale even with nothing to rank', () => {
    const { ranked, scale } = rankByRate([area('Nobody', 3, null)]);
    expect(ranked).toEqual([]);
    expect(scale).toBeGreaterThan(0);
  });
});

describe('the worked example', () => {
  it('prefers the board’s own top area, with a complete total', () => {
    const areas = [area('Top', 100, 10000, false), area('Second', 90, 9000), area('Elsewhere', 99, 1000)];
    expect(workedExample(areas, ['Top', 'Second'])?.name).toBe('Second');
    expect(workedExample(areas, ['Missing'])?.name).toBe('Elsewhere');
  });

  it('falls back to a minimum total, and to nothing when no area has a rate', () => {
    expect(workedExample([area('Only', 10, 2000, false)], [])?.complete).toBe(false);
    expect(workedExample([area('Nobody', 3, null)], ['Nobody'])).toBeNull();
  });

  it('writes the division out, marking a minimum on both sides', () => {
    const example = workedExample([area('Only', 10, 2000, false)], [])!;
    expect(exampleSum(example)).toBe('10+ emergency responses ÷ 2,000 people × 1,000 = 5.00+ emergency responses per 1,000 people');
  });
});

describe('against the published data', () => {
  const scope = read<ScopeAreas>('sa2-areas.json');
  const population = read<PopulationArtefact>('population.json');
  const points = read<PointsArtefact>('sa2-points.json');
  const board = read<FloodHistoryArtefact>('flood-history.json');
  const joined = joinAreas(scope, population, points);
  const ranking = rankByRate(joined);

  it('ranks every area with enough residents, and leaves out exactly those without', () => {
    expect(ranking.ranked.length + ranking.unrated.length).toBe(scope.areas.length);
    for (const row of ranking.unrated) expect(row.persons).toBeNull();
    for (const row of ranking.ranked) expect(row.area.persons).toBeGreaterThanOrEqual(population.minimumResidents);
    for (const [i, row] of ranking.ranked.entries()) {
      if (i > 0) expect(row.area.rate).toBeLessThanOrEqual(ranking.ranked[i - 1]!.area.rate);
    }
    expect(ranking.scale).toBe(ranking.ranked[0]!.area.rate);
  });

  it('writes the span FLOOD.period says, from the board’s own years', () => {
    expect(yearSpan(board.reportingPeriod.years)).toBe(FLOOD.period);
    expect(yearSpan(scope.reportingPeriod.years)).toBe(FLOOD.period);
  });

  it('says almost half about the published board, from its own totals', () => {
    const { years } = board.reportingPeriod;
    const totals = years.map((_, i) => board.areas.reduce((n, a) => n + (a.byYear[i] ?? 0), 0));
    expect(wetYearNote(totals, years)).toBe('Almost half of these emergency responses came in one wet year, 2010/11.');
  });

  it('divides out the board’s top area, and the sum comes back to the rate shown', () => {
    const example = workedExample(joined, board.areas.map((a) => a.name))!;
    expect(example.name).toBe(board.areas.find((a) => a.complete)!.name);
    expect(example.total).toBe(board.areas.find((a) => a.name === example.name)!.total);
    expect(example.rate.toFixed(2)).toBe(((example.total / example.persons) * 1000).toFixed(2));
    expect(exampleSum(example)).toContain(`÷ ${example.persons.toLocaleString('en-AU')} people × 1,000 = ${example.rate.toFixed(2)} `);
  });
});

describe('the short notes (copy audit v2, #67, #70, #71, #76, #77)', () => {
  it('says what a + means behind the number', () => {
    expect(atLeastTip('160')).toBe('At least 160. Some counts were hidden for privacy.');
  });

  it('puts the division behind a row, and the + first where there is one', () => {
    expect(rateTip(area('Exact', 67, 3900))).toBe('67 emergency responses ÷ 3,900 people × 1,000');
    expect(rateTip(area('Floor', 10, 2000, false))).toBe(
      'At least 5.00. Some counts were hidden for privacy. 10+ emergency responses ÷ 2,000 people × 1,000',
    );
    expect(rateTip(area('Nobody', 3, null))).toBeNull();
  });

  it('counts the list it describes', () => {
    expect(topNote(5, 30)).toBe('Top 5 of 30 areas.');
    expect(topNote(30, 30)).toBe('All 30 areas.');
    expect(unratedNote(1000)).toBe('Areas with under 1,000 people are not ranked.');
  });

  it('says almost half only while it is true', () => {
    const years = ['2009-10', '2010-11', '2011-12'];
    expect(wetYearNote([30, 45, 25], years)).toBe('Almost half of these emergency responses came in one wet year, 2010/11.');
    expect(wetYearNote([20, 62, 18], years)).toBe('62% of these emergency responses came in one year, 2010/11.');
    expect(wetYearNote([35, 35, 30], years)).toBe('35% of these emergency responses came in one year, 2009/10.');
    expect(wetYearNote([50, 50, 0], years)).toBe('50% of these emergency responses came in one year, 2009/10.');
    expect(wetYearNote([0, 0, 0], years)).toBe('');
  });
});

describe('small helpers', () => {
  it('lists names as a sentence does', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['A'])).toBe('A');
    expect(listNames(['A', 'B'])).toBe('A and B');
    expect(listNames(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('reads an ISO date without a time zone, and leaves anything else alone', () => {
    expect(readableDate('2009-07-01')).toBe('1 July 2009');
    expect(readableDate('2015-06-30')).toBe('30 June 2015');
    expect(readableDate('2015-13-30')).toBe('2015-13-30');
    expect(readableDate('June 2015')).toBe('June 2015');
  });
});
