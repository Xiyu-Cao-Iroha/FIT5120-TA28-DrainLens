/**
 * The map's data, and the distinctions it exists to keep.
 *
 * Three of these matter more than the rest, and each is a way of being wrong
 * that produces a map which looks entirely normal:
 *
 * * **No score is not a low score.** Seven areas are airports, a racecourse and
 *   industrial land. Dividing anyway gives a defensible-looking number off one
 *   crew being sent somewhere nobody lives.
 * * **No recorded activity is not a little activity.** Four areas have a
 *   complete zero, and drawing them in the palest band says the SES went there
 *   rarely rather than never.
 * * **A floor is not a value.** 80 areas of 281 carry one, so the qualification
 *   is the common case rather than the edge.
 */

import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_BREAKS,
  AreaDataError,
  type MapArea,
  type PointsArtefact,
  type PopulationArtefact,
  SEVERITY_BREAKS,
  type ScopeAreas,
  assertPoints,
  assertPopulation,
  assertScopeAreas,
  bandOf,
  breaksFor,
  completenessOf,
  completenessText,
  joinAreas,
  scoreLabel,
  totalLabel,
  valueOf,
} from './severity.js';

const YEARS = ['2009-10', '2010-11'];

const scope = (...areas: Partial<ScopeAreas['areas'][number]>[]): ScopeAreas => ({
  artefact: 'sa2-areas',
  note: 'Counts of Victoria SES crew dispatches recorded as Flood.',
  incidentType: 'Flood',
  source: { dataset: 'VICSES Incidents Per SA1 ABS Census Areas, 2009 - 2015', publisher: 'Victoria State Emergency Service', licence: 'CC BY 4.0' },
  reportingPeriod: { start: '2009-07-01', end: '2015-06-30', years: YEARS },
  geography: { unit: 'SA2', standard: 'ASGS 2011', scope: 'Greater Melbourne' },
  areas: areas.map((a, index) => ({
    code: a.code ?? `20601110${String(index)}`,
    name: a.name ?? `Area ${String(index)}`,
    total: a.total ?? 6,
    byYear: a.byYear ?? [4, 2],
    regions: a.regions ?? 3,
    suppressedRegions: a.suppressedRegions ?? 0,
    complete: a.complete ?? (a.suppressedRegions ?? 0) === 0,
  })),
});

const population = (...persons: readonly number[][]): PopulationArtefact => ({
  artefact: 'population',
  note: 'Estimated resident population at 30 June, by SA2, ASGS 2011.',
  asAt: ['2009-06-30', '2012-06-30'],
  denominator: '2012-06-30',
  minimumResidents: 1000,
  source: { dataset: 'Population Estimates by SA2', publisher: 'Australian Bureau of Statistics' },
  areas: persons.map((series, index) => ({
    code: `20601110${String(index)}`,
    name: `Area ${String(index)}`,
    persons: series,
  })),
});

const points = (count: number): PointsArtefact => ({
  artefact: 'sa2-points',
  extent: { name: 'greater-melbourne', min_e: 300000, min_n: 5800000, width_m: 10000, height_m: 10000 },
  areas: Array.from({ length: count }, (_, index) => ({
    code: `20601110${String(index)}`,
    name: `Area ${String(index)}`,
    e: 100 * index,
    n: 200 * index,
  })),
});

const joined = (s: ScopeAreas, p: PopulationArtefact, pt: PointsArtefact) => joinAreas(s, p, pt);

describe('joining the three artefacts', () => {
  it('computes the rate the definition names, and keeps the series', () => {
    // 6 dispatches among 3,000 people over the period: 2.00 per 1,000. The
    // arithmetic is the one in docs/SEVERITY-SCORE.md and nothing else here.
    const [area] = joined(scope({}), population([2500, 3000]), points(1));
    expect(area.rate).toBeCloseTo(2, 6);
    expect(area.persons).toBe(3000);
    expect(area.personsByYear).toEqual([2500, 3000]);
    expect(area.e).toBe(0);
  });

  it('divides by the named year rather than the last one', () => {
    // The denominator is the mid-period figure, and a list of years is not an
    // instruction to use the newest. Using 2,500 here would give 2.40.
    const [area] = joined(scope({ total: 6 }), population([2500, 3000]), points(1));
    expect(area.rate).toBeCloseTo(2, 6);
  });

  it('gives no score to an area with too few residents, rather than a large one', () => {
    /*
      The case the threshold exists for. One dispatch among fifteen people is
      66.7 per 1,000 — four times the highest rate in Greater Melbourne — and
      it is a crew being sent to an industrial estate.
    */
    const [area] = joined(scope({ total: 1 }), population([15, 15]), points(1));
    expect(area.rate).toBeNull();
    expect(area.persons).toBeNull();
    expect(area.total).toBe(1);
  });

  it('refuses an area it cannot place or cannot divide, rather than dropping it', () => {
    // An area missing from the map is indistinguishable from an area with
    // nothing recorded in it, and telling those apart is what the map is for.
    expect(() => joined(scope({}, {}), population([1000, 1000]), points(2))).toThrow(
      /no population for Area 1/,
    );
    expect(() => joined(scope({}, {}), population([1000, 1000], [1000, 1000]), points(1))).toThrow(
      /does not place Area 1/,
    );
  });
});

const area = (over: Partial<MapArea> = {}): MapArea => ({
  code: '206011105',
  name: 'Brunswick',
  total: 24,
  byYear: [20, 4],
  complete: true,
  suppressedRegions: 0,
  persons: 24000,
  rate: 1,
  regions: 46,
  personsByYear: [23000, 24000],
  e: 0,
  n: 0,
  ...over,
});

describe('what an area is worth saying', () => {
  it('calls a withheld total a floor, in both modes', () => {
    const withheld = area({ complete: false, suppressedRegions: 2, total: 160, rate: 6.18 });
    expect(totalLabel(withheld)).toBe('160+');
    expect(scoreLabel(withheld)).toBe('6.18+');
    expect(completenessOf(withheld, 'activity')).toBe('minimum');
    expect(completenessOf(withheld, 'severity')).toBe('minimum');
  });

  it('separates a complete zero from a withheld one', () => {
    // Two areas in the data have a published total of zero *because* every
    // region in them was withheld. That reads as "none" and means "unknown".
    expect(completenessOf(area({ total: 0 }), 'activity')).toBe('none');
    expect(completenessOf(area({ total: 0, complete: false, suppressedRegions: 1 }), 'activity')).toBe(
      'minimum',
    );
  });

  it('gives the two modes different states, which is the whole reason it takes one', () => {
    /*
      Measured across all 281: the activity map produces exact, minimum and
      four complete zeros; the severity map produces exact, minimum and seven
      unavailable, and **no zeros at all** — every area with no recorded
      activity is also an area with no score. A legend shared between the modes
      offers each one a state it cannot produce.
    */
    const unscored = area({ total: 0, rate: null, persons: null });
    expect(completenessOf(unscored, 'activity')).toBe('none');
    expect(completenessOf(unscored, 'severity')).toBe('unavailable');
  });

  it('never calls a withheld count exact just because there is no score', () => {
    // Port Melbourne Industrial and Braeside: a withheld region, and too few
    // residents to score. The panel said "The counts are exact" about both.
    const both = area({ complete: false, suppressedRegions: 1, regions: 3, rate: null, persons: 400 });
    const state = completenessOf(both, 'severity');
    expect(state).toBe('unavailable');
    const said = completenessText(both, state, 'Flood');
    expect(said.label).toBe('Not available.');
    expect(said.body).not.toContain('exact');
    expect(said.body).toContain('1 of its 3 smaller regions');
    expect(said.body).toContain('minimum');

    const exactButUnscored = area({ rate: null, persons: 400 });
    expect(completenessText(exactButUnscored, 'unavailable', 'Flood').body).toContain('The counts are exact');
  });

  it('says each completeness state in its own words', () => {
    expect(completenessText(area(), 'exact', 'Flood').label).toBe('Exact.');
    expect(completenessText(area({ complete: false, suppressedRegions: 2, regions: 46 }), 'minimum', 'Flood').body).toContain('2 of its 46');
    expect(completenessText(area({ total: 0 }), 'none', 'Flood').body).toContain('no flood dispatch');
  });

  it('reads the mode’s own number off the area', () => {
    expect(valueOf(area(), 'activity')).toBe(24);
    expect(valueOf(area(), 'severity')).toBe(1);
    expect(valueOf(area({ rate: null }), 'severity')).toBeNull();
  });

  it('says No score rather than a dash or a zero', () => {
    expect(scoreLabel(area({ rate: null }))).toBe('No score');
  });
});

describe('the bands', () => {
  it('puts every published count in exactly one activity bin', () => {
    for (const [total, expected] of [
      [1, 0],
      [10, 0],
      [11, 1],
      [25, 1],
      [26, 2],
      [50, 2],
      [51, 3],
      [209, 3],
    ] as const) {
      expect(bandOf(total, ACTIVITY_BREAKS)).toBe(expected);
    }
  });

  it('has no band for zero, because no recorded activity is not a little', () => {
    // Drawn as its own thing. In the palest band it says the SES went there
    // rarely, and the data says they did not go.
    expect(bandOf(0, ACTIVITY_BREAKS)).toBeNull();
  });

  it('has no band for an area with no score', () => {
    expect(bandOf(null, SEVERITY_BREAKS)).toBeNull();
  });

  it('bands the rate at the measured quartiles', () => {
    // 1.3 and 3.0 are the first and third quartiles of the 274 scored areas,
    // to one decimal place.
    expect(bandOf(0.4, SEVERITY_BREAKS)).toBe(0);
    expect(bandOf(1.9, SEVERITY_BREAKS)).toBe(1);
    expect(bandOf(11.58, SEVERITY_BREAKS)).toBe(2);
  });

  it('puts the range in every band name, not only the judgement', () => {
    // AC 4.1.2.d. "Higher" without its numbers is a judgement with the
    // workings hidden.
    for (const band of SEVERITY_BREAKS) expect(band.label).toMatch(/[\d.]/);
    expect(breaksFor('activity')).toBe(ACTIVITY_BREAKS);
    expect(breaksFor('severity')).toBe(SEVERITY_BREAKS);
  });
});

describe('refusing artefacts the map cannot draw', () => {
  it('accepts the sound ones, so the refusals below mean something', () => {
    expect(() => {
      assertScopeAreas(scope({}));
      assertPopulation(population([1000, 1000]));
      assertPoints(points(1));
    }).not.toThrow();
  });

  it('refuses a completeness flag that disagrees with its own withheld count', () => {
    // One of the two is being maintained by hand, and the map draws the flag
    // rather than the count it belongs to.
    expect(() => {
      assertScopeAreas(scope({ complete: true, suppressedRegions: 2 }));
    }).toThrow(/complete with 2 withheld regions/);
  });

  it('refuses an area whose code is not an ASGS code', () => {
    expect(() => {
      assertScopeAreas(scope({ code: 'Brunswick' }));
    }).toThrow(/not an ASGS code/);
  });

  it('refuses a population that does not name its denominator year', () => {
    const p = { ...population([1000, 1000]), denominator: '2099-06-30' };
    expect(() => {
      assertPopulation(p);
    }).toThrow(/which of its years is the denominator/);
  });

  it('refuses a population with no minimum, because then nothing is too small', () => {
    expect(() => {
      assertPopulation({ ...population([1000, 1000]), minimumResidents: 0 });
    }).toThrow(/too few to divide by/);
  });

  it('refuses a point outside its own extent', () => {
    /*
      The failure that drew every address pin 1.5 km west and 6 km south of the
      house: coordinates measured from one extent's corner, drawn on another's.
      It is the same shape of mistake and the same guard.
    */
    const p = points(1);
    expect(() => {
      assertPoints({ ...p, areas: [{ ...p.areas[0]!, e: 999_999 }] });
    }).toThrow(/outside its own extent/);
  });

  it('refuses artefacts that are something else entirely', () => {
    expect(() => {
      assertScopeAreas({ artefact: 'flood-history' });
    }).toThrow(AreaDataError);
    expect(() => {
      assertPoints(null);
    }).toThrow(/is not an object/);
  });
});

/*
  One broken field at a time, because the guards are the product's argument.

  This file first covered 72.8% of the branches here, and every one of the
  missing ones was a refusal. A refusal nobody exercises is a sentence in a
  source file rather than a behaviour — the same finding that produced
  `refusals.test.ts` for the flood board, arrived at again one module over.
*/
describe('every field these guards refuse to do without', () => {
  /*
    No `?? a` fallback, and that is not a style choice.

    This helper returned `change(a) ?? a`, which handed the *valid* artefact
    back for the two cases that break it by returning nothing — so both tests
    asserted that a sound artefact is refused, and both failed. They would have
    passed silently if the guard had been the thing that was wrong.
  */
  const brokenScope = (change: (a: ScopeAreas) => unknown): unknown =>
    change(JSON.parse(JSON.stringify(scope({}))) as ScopeAreas);

  it.each([
    ['is not an object', () => null],
    ['is undefined', () => undefined],
    ['says what a count is', (a: ScopeAreas) => ({ ...a, note: '' })],
    ['names its incident type', (a: ScopeAreas) => ({ ...a, incidentType: '' })],
    ['names who recorded it', (a: ScopeAreas) => ({ ...a, source: undefined as unknown as ScopeAreas['source'] })],
    ['carries a reporting period', (a: ScopeAreas) => ({ ...a, reportingPeriod: undefined })],
    ['names a scope', (a: ScopeAreas) => ({ ...a, geography: { unit: 'SA2', standard: 'x', scope: '' } })],
    ['carries areas', (a: ScopeAreas) => ({ ...a, areas: [] })],
    ['names every area', (a: ScopeAreas) => ({ ...a, areas: [{ ...a.areas[0]!, name: '' }] })],
    ['has a usable total', (a: ScopeAreas) => ({ ...a, areas: [{ ...a.areas[0]!, total: -1 }] })],
    ['has a year for every year', (a: ScopeAreas) => ({ ...a, areas: [{ ...a.areas[0]!, byYear: [1] }] })],
    ['says whether a total is complete', (a: ScopeAreas) => ({
      ...a,
      areas: [{ ...a.areas[0]!, complete: 'yes' as unknown as boolean }],
    })],
  ])('refuses a scope list that %s', (_what, change) => {
    expect(() => {
      assertScopeAreas(brokenScope(change as (a: ScopeAreas) => unknown));
    }).toThrow(AreaDataError);
  });

  it.each([
    ['is not an object', () => 42],
    ['is another artefact', (p: PopulationArtefact) => ({ ...p, artefact: 'sa2-areas' })],
    ['says what its figures are', (p: PopulationArtefact) => ({ ...p, note: '' })],
    ['says when it was counted', (p: PopulationArtefact) => ({ ...p, asAt: [] })],
    ['names its publisher', (p: PopulationArtefact) => ({ ...p, source: undefined })],
    ['carries population', (p: PopulationArtefact) => ({ ...p, areas: [] })],
    ['has a figure per date', (p: PopulationArtefact) => ({
      ...p,
      areas: [{ ...p.areas[0]!, persons: [1000] }],
    })],
    ['has no negative residents', (p: PopulationArtefact) => ({
      ...p,
      areas: [{ ...p.areas[0]!, persons: [-1, 1000] }],
    })],
  ])('refuses a population that %s', (_what, change) => {
    expect(() => {
      assertPopulation(change(population([1000, 1000])) as unknown);
    }).toThrow(AreaDataError);
  });

  it.each([
    ['is another artefact', (p: PointsArtefact) => ({ ...p, artefact: 'population' })],
    ['has no extent', (p: PointsArtefact) => ({ ...p, extent: undefined })],
    ['has an extent with no width', (p: PointsArtefact) => ({
      ...p,
      extent: { ...p.extent, width_m: 0 },
    })],
    ['places nothing', (p: PointsArtefact) => ({ ...p, areas: [] })],
    ['places an area nowhere', (p: PointsArtefact) => ({
      ...p,
      areas: [{ ...p.areas[0]!, e: Number.NaN }],
    })],
  ])('refuses points that %s', (_what, change) => {
    expect(() => {
      assertPoints(change(points(1)) as unknown);
    }).toThrow(AreaDataError);
  });
});

describe('the numbers on the panel are the artefact’s, not arithmetic', () => {
  it('carries the region count rather than reconstructing it', () => {
    /*
      **The panel said "1 of its 2 regions" about an area with 46.** The
      sentence needed a denominator, `MapArea` did not carry one, and what went
      on screen was `suppressedRegions + 1` — an invented number, on a page
      whose subject is withheld counts, in a product whose argument is that it
      does not invent numbers.
    */
    const s = scope({});
    const withReal = {
      ...s,
      areas: [{ ...s.areas[0]!, regions: 46, suppressedRegions: 1, complete: false }],
    };
    const [joinedArea] = joinAreas(withReal, population([1000, 1000]), points(1));
    expect(joinedArea.regions).toBe(46);
    expect(joinedArea.suppressedRegions).toBe(1);
  });
});
