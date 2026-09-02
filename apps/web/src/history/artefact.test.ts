/**
 * The artefact checks, and why they are strict about words rather than numbers.
 *
 * A ranking with no period, no unit and no source beside it is the one shape
 * this page must never take: a league table of suburbs that looks like a
 * finding. So a missing sentence fails the load exactly as a missing number
 * does, and these tests hold that line — most of them assert that something
 * *refuses* to load.
 */
import { describe, expect, it } from 'vitest';

import {
  FloodHistoryError,
  type FloodHistoryArtefact,
  assertFloodHistory,
  barScale,
  defaultView,
  hasMore,
  incompleteCount,
  periodLabel,
  tiedBeyond,
} from './artefact.js';

const YEARS = ['2009-10', '2010-11', '2011-12'] as const;

function area(name: string, byYear: readonly number[], extra: Record<string, unknown> = {}) {
  return {
    rank: 0,
    name,
    total: byYear.reduce((n, v) => n + v, 0),
    byYear,
    regions: 4,
    suppressedRegions: 0,
    complete: true,
    tied: false,
    ...extra,
  };
}

const CREDIT = {
  dataset: 'A dataset',
  publisher: 'A publisher',
  licence: 'CC BY 4.0',
  dataset_id: 'a-dataset',
};

function artefact(overrides: Record<string, unknown> = {}): unknown {
  const areas = [
    area('Alpha', [5, 4, 3]),
    area('Beta', [4, 4, 3]),
    area('Gamma', [1, 1, 1]),
  ].map((a, i) => ({ ...a, rank: i + 1 }));

  return {
    artefact: 'flood-history',
    version: 1,
    basis: 'sourceProvided',
    note: 'One count is one crew dispatch.',
    source: CREDIT,
    geographySource: CREDIT,
    reportingPeriod: { start: '2009-07-01', end: '2012-06-30', years: [...YEARS] },
    geography: { unit: 'SA2', standard: 'ASGS 2011', scope: 'Greater Melbourne' },
    incidentType: 'Flood',
    excludes: 'Flash flooding is recorded under Storm.',
    defaultAreas: 2,
    counts: {
      areasPublished: 3,
      areasWithIncidents: 3,
      areasInScope: 9,
      regions: 20,
      suppressedRegions: 1,
      incidentsInScope: 40,
      incidentsPublished: 25,
    },
    areas,
    pilotArea: null,
    ...overrides,
  };
}

function refuses(overrides: Record<string, unknown>, match: RegExp) {
  expect(() => {
    assertFloodHistory(artefact(overrides));
  }).toThrowError(match);
}

describe('accepting an artefact', () => {
  it('accepts the shape the pipeline publishes', () => {
    expect(() => {
      assertFloodHistory(artefact());
    }).not.toThrow();
  });

  it('throws its own error type, so a screen can tell it from a network failure', () => {
    expect(() => {
      assertFloodHistory(null);
    }).toThrowError(FloodHistoryError);
  });

  it('refuses something that is not this artefact', () => {
    refuses({ artefact: 'derived-layers' }, /not flood-history/);
  });
});

describe('the wording AC 2.1.1.f and AC 2.3.1 need', () => {
  it('refuses an artefact with no reporting period', () => {
    refuses({ reportingPeriod: undefined }, /reporting period/);
  });

  it('refuses an artefact whose period names no years', () => {
    refuses(
      { reportingPeriod: { start: 'a', end: 'b', years: [] } },
      /reporting period/,
    );
  });

  it('refuses an artefact with no geographic unit', () => {
    refuses({ geography: { standard: 'ASGS 2011', scope: 'Greater Melbourne' } }, /geographic unit/);
  });

  it('refuses an artefact that does not credit its source', () => {
    refuses({ source: { dataset: 'A dataset' } }, /credit its source/);
  });

  it('refuses an artefact that does not credit where the names came from', () => {
    refuses({ geographySource: undefined }, /credit its geographySource/);
  });

  it('refuses an artefact that does not say what a count is', () => {
    refuses({ note: '' }, /what a count is/);
  });

  it('refuses an artefact that does not name its incident type', () => {
    refuses({ incidentType: '' }, /which incident type/);
  });

  it('refuses an artefact that does not say what the type leaves out', () => {
    // Flash flooding sits under Storm. A page ranking Flood without saying so
    // overstates what it is showing, so the sentence is load-bearing.
    refuses({ excludes: '' }, /leaves out/);
  });
});

describe('the ranking', () => {
  it('refuses an artefact with no areas', () => {
    refuses({ areas: [] }, /carries no areas/);
  });

  it('refuses fewer areas than it calls the default view', () => {
    refuses({ defaultAreas: 9 }, /calls 9 the default view/);
  });

  it('refuses an area whose rank does not match its position', () => {
    const areas = [area('Alpha', [5, 4, 3]), area('Beta', [4, 4, 3])].map((a, i) => ({
      ...a,
      rank: i + 3,
    }));
    refuses({ areas }, /ranked 3 at position 1/);
  });

  it('refuses a list that is not descending', () => {
    // Re-sorting here would hide a pipeline defect while leaving the ranks it
    // published wrong, so this fails instead.
    const areas = [area('Small', [1, 0, 0]), area('Large', [9, 0, 0])].map((a, i) => ({
      ...a,
      rank: i + 1,
    }));
    refuses({ areas, defaultAreas: 2 }, /ranked below a smaller count/);
  });

  it('refuses an area whose years do not match the period', () => {
    const areas = [{ ...area('Alpha', [5, 4]), rank: 1 }, { ...area('Beta', [1, 1, 1]), rank: 2 }];
    refuses({ areas }, /has 2 years, not 3/);
  });

  it('refuses an area whose total disagrees with its own years', () => {
    const areas = [
      { ...area('Alpha', [5, 4, 3]), total: 99, rank: 1 },
      { ...area('Beta', [1, 1, 1]), rank: 2 },
    ];
    refuses({ areas }, /totals 99 but its years sum to 12/);
  });

  it('refuses an area with no name', () => {
    const areas = [{ ...area('', [5, 4, 3]), rank: 1 }, { ...area('Beta', [1, 1, 1]), rank: 2 }];
    refuses({ areas }, /area 1 has no name/);
  });
});

describe('reading it', () => {
  function loaded(overrides: Record<string, unknown> = {}): FloodHistoryArtefact {
    const value = artefact(overrides);
    assertFloodHistory(value);
    return value;
  }

  it('opens on the default view and no more — AC 2.1.1.h', () => {
    expect(defaultView(loaded()).map((a) => a.name)).toEqual(['Alpha', 'Beta']);
  });

  it('offers more only when there is more', () => {
    expect(hasMore(loaded())).toBe(true);
    expect(hasMore(loaded({ defaultAreas: 3 }))).toBe(false);
  });

  it('scales bars against every published area, not the visible ones', () => {
    // Otherwise pressing Show more rescales the top five, and the picture
    // changes while the data does not.
    expect(barScale(loaded())).toBe(12);
  });

  it('never scales against zero', () => {
    const flat = [
      { ...area('Alpha', [0, 0, 0]), rank: 1 },
      { ...area('Beta', [0, 0, 0]), rank: 2 },
    ];
    expect(barScale(loaded({ areas: flat }))).toBe(1);
  });

  it('reads the period off the artefact rather than hard-coding it', () => {
    expect(periodLabel(loaded())).toBe('2009-10 to 2011-12');
  });

  it('does not write a range when the period is one year', () => {
    // The years and the areas have to move together: a period of one year with
    // three-year areas is refused, which is why this rebuilds both.
    const single = loaded({
      reportingPeriod: { start: '2020-07-01', end: '2021-06-30', years: ['2020-21'] },
      areas: [
        { ...area('Alpha', [9]), rank: 1 },
        { ...area('Beta', [2]), rank: 2 },
      ],
    });
    expect(periodLabel(single)).toBe('2020-21');
  });

  it('counts the areas whose totals are lower bounds — AC 2.1.1.g', () => {
    const areas = [
      { ...area('Alpha', [5, 4, 3]), rank: 1, complete: false, suppressedRegions: 2 },
      { ...area('Beta', [4, 4, 3]), rank: 2 },
      { ...area('Gamma', [1, 1, 1]), rank: 3, complete: false, suppressedRegions: 1 },
    ];
    expect(incompleteCount(loaded({ areas }).areas)).toBe(2);
    expect(incompleteCount([])).toBe(0);
  });
});

describe('the tie at the edge of the default view', () => {
  function loaded(areas: readonly unknown[], defaultAreas: number): FloodHistoryArtefact {
    const value = artefact({ areas, defaultAreas });
    assertFloodHistory(value);
    return value;
  }

  const LEVEL = [
    { ...area('Alpha', [9, 0, 0]), rank: 1 },
    { ...area('Beta', [5, 0, 0]), rank: 2, tied: true },
    { ...area('Gamma', [5, 0, 0]), rank: 3, tied: true },
    { ...area('Delta', [1, 0, 0]), rank: 4 },
  ];

  it('names the hidden area that is level with the last one shown', () => {
    // Ranks five and six of the real board are both 133. Cutting at five ends
    // on a row marked "tied" with nothing on screen to be tied to.
    expect(tiedBeyond(loaded(LEVEL, 2), 2).map((a) => a.name)).toEqual(['Gamma']);
  });

  it('says nothing when the cut does not fall on a tie', () => {
    expect(tiedBeyond(loaded(LEVEL, 3), 3)).toEqual([]);
  });

  it('says nothing when everything is shown', () => {
    expect(tiedBeyond(loaded(LEVEL, 4), 4)).toEqual([]);
  });

  it('names every hidden area at that count, not only the first', () => {
    const three = [
      { ...area('Alpha', [9, 0, 0]), rank: 1 },
      { ...area('Beta', [5, 0, 0]), rank: 2, tied: true },
      { ...area('Gamma', [5, 0, 0]), rank: 3, tied: true },
      { ...area('Delta', [5, 0, 0]), rank: 4, tied: true },
    ];
    expect(tiedBeyond(loaded(three, 2), 2).map((a) => a.name)).toEqual(['Gamma', 'Delta']);
  });

  it('is empty when asked about nothing', () => {
    expect(tiedBeyond(loaded(LEVEL, 2), 0)).toEqual([]);
  });
});
