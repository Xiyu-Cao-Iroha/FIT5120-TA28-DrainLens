/**
 * Fetching the map's three artefacts, without React.
 *
 * `loadAreas` is exported and the hook around it is four lines, for the same
 * reason `positionsFor` and `resultOf` were pulled out of `useScenario`: the
 * judgement is which files are read, in what order they are checked, and what
 * happens when one of them is wrong — none of which needs a renderer, and all
 * of which would be untestable inside the effect.
 */

import { describe, expect, it } from 'vitest';

import { AreaDataError } from './severity.js';
import { loadAreas } from './useAreas.js';

const YEARS = ['2009-10'];

const artefacts: Record<string, unknown> = {
  '/data/sa2-areas.json': {
    artefact: 'sa2-areas',
    note: 'Counts of Victoria SES crew dispatches recorded as Flood.',
    incidentType: 'Flood',
    reportingPeriod: { start: '2009-07-01', end: '2015-06-30', years: YEARS },
    geography: { unit: 'SA2', standard: 'ASGS 2011', scope: 'Greater Melbourne' },
    areas: [
      {
        code: '206011105',
        name: 'Brunswick',
        total: 24,
        byYear: [24],
        regions: 50,
        suppressedRegions: 0,
        complete: true,
      },
    ],
  },
  '/data/population.json': {
    artefact: 'population',
    note: 'Estimated resident population at 30 June, by SA2, ASGS 2011.',
    asAt: ['2012-06-30'],
    denominator: '2012-06-30',
    minimumResidents: 1000,
    source: { dataset: 'Population Estimates by SA2', publisher: 'Australian Bureau of Statistics' },
    areas: [{ code: '206011105', name: 'Brunswick', persons: [24_000] }],
  },
  '/data/sa2-points.json': {
    artefact: 'sa2-points',
    extent: { name: 'greater-melbourne', min_e: 1, min_n: 1, width_m: 1000, height_m: 1000 },
    areas: [{ code: '206011105', name: 'Brunswick', e: 100, n: 200 }],
  },
};

const from = (over: Record<string, unknown> = {}) => {
  const asked: string[] = [];
  const get = (url: string) => {
    asked.push(url);
    return Promise.resolve(over[url] ?? artefacts[url]);
  };
  return { asked, get };
};

describe('loading the map’s artefacts', () => {
  it('reads all three and joins them', async () => {
    const { asked, get } = from();
    const data = await loadAreas(get);

    expect(asked.sort()).toEqual([
      '/data/population.json',
      '/data/sa2-areas.json',
      '/data/sa2-points.json',
    ]);
    expect(data.areas).toHaveLength(1);
    expect(data.areas[0]!.rate).toBeCloseTo(1, 6);
    expect(data.areas[0]!.regions).toBe(50);
  });

  it('refuses a wrong artefact rather than drawing whatever arrived', async () => {
    // The three files are published separately and a rebuild of one is not a
    // code change anything else would notice.
    const { get } = from({ '/data/sa2-points.json': artefacts['/data/population.json'] });
    await expect(loadAreas(get)).rejects.toThrow(AreaDataError);
  });

  it('refuses when the three do not describe the same areas', async () => {
    const { get } = from({
      '/data/population.json': {
        ...(artefacts['/data/population.json'] as Record<string, unknown>),
        areas: [{ code: '999999999', name: 'Somewhere', persons: [1000] }],
      },
    });
    await expect(loadAreas(get)).rejects.toThrow(/no population for Brunswick/);
  });
});
