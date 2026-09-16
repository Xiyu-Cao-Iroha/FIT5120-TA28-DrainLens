/**
 * The flood map's evidence sentences, checked against AC 4.3.1 to 4.3.4.
 *
 * Asserted against the real artefacts, not a fixture: the point of reading
 * every number from the data is that the sentences cannot drift from it.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  AREAS_NOTE,
  INFORMATION_TYPES,
  NOT_A_FORECAST,
  activityEvidence,
  countsOf,
  coverageEvidence,
  severityEvidence,
} from './evidence.js';
import { FLOOD } from '../ui/terms.js';
import { type PointsArtefact, type PopulationArtefact, type ScopeAreas, joinAreas } from './severity.js';

const DATA = path.resolve(__dirname, '../../public/data');
const read = <T>(name: string): T => JSON.parse(readFileSync(path.join(DATA, name), 'utf8')) as T;
const scope = read<ScopeAreas>('sa2-areas.json');
const population = read<PopulationArtefact>('population.json');
const areas = joinAreas(scope, population, read<PointsArtefact>('sa2-points.json'));

const text = (points: readonly { title: string; body: string }[]) => points.map((p) => `${p.title}. ${p.body}`).join(' ');

describe('counts taken from the areas', () => {
  it('match the measured figures', () => {
    expect(countsOf(areas)).toEqual({ areas: 281, floors: 80, unscored: 7, none: 4, withheldRegions: 106 });
  });
});

describe('AC 4.3.1: historical flood activity', () => {
  const points = activityEvidence(scope, areas);
  const all = text(points);

  it('says where the data comes from, the years, and that it is grouped by area', () => {
    expect(all).toContain('Victoria State Emergency Service');
    expect(all).toContain('1 July 2009 to 30 June 2015');
    expect(all).toContain('SA2');
  });

  it('says one value is one flood job however many crews went, not a flood', () => {
    // Copy audit v2: the publisher counts several crews at one job once, so
    // the sentence is FLOOD.explain and not the audit's "each crew sent".
    expect(all).toContain(FLOOD.explain);
    expect(all).not.toMatch(/count once each/);
    expect(all).toMatch(/not one flood/);
  });

  it('says some exact counts were not published, with the count read from the data', () => {
    expect(all).toContain('106 of those small regions sit inside 80 of the 281 areas');
    expect(all).toMatch(/hidden for privacy/i);
  });

  it('says it is not current or future flooding', () => {
    expect(all).toMatch(/nothing here describes conditions today or predicts them/);
  });
});

describe('AC 4.3.2: emergency responses per 1,000 people', () => {
  const all = text(severityEvidence(scope, population));

  it('names the data, the inputs, how they combine and the periods', () => {
    expect(all).toContain('Australian Bureau of Statistics');
    expect(all).toMatch(/divided by the residents on 30 June 2012, times 1,000/);
    expect(all).toContain('fewer than 1,000 residents are not given a rate');
    expect(all).toMatch(/Emergency responses: 1 July 2009 to 30 June 2015\. Residents: one estimate, on 30 June 2012/);
  });

  it('says it is calculated, what higher means, and the three things it is not', () => {
    expect(all).toContain('Calculated by DrainLens');
    expect(all).toMatch(/More SES flood emergency responses for every 1,000 people/);
    expect(all).toMatch(/not a count of people affected/i);
    expect(all).toMatch(/does not measure flood depth, damage, probability or current risk/);
    expect(all).toMatch(/how deep or damaging any flood was, how likely flooding is, or what flood risk/);
    expect(all).not.toMatch(/score|severity/i);
  });
});

describe('AC 4.3.3: coverage and uncertainty', () => {
  const all = text(coverageEvidence(scope, population, areas));

  it('names what is missing, the years, and the mismatch between periods', () => {
    expect(all).toContain('80 areas have at least one count hidden for privacy');
    expect(all).toContain('7 areas have fewer than 1,000 residents');
    expect(all).toMatch(/flash flooding/);
    expect(all).toMatch(/simplified to about 25 metres/);
    expect(all).toMatch(/periods do not match exactly/i);
  });

  it('separates source from calculated, fills nothing in, and says how the rate is affected', () => {
    expect(all).toMatch(/calculated by DrainLens/);
    expect(all).toMatch(/not treated as zero/);
    expect(all).toMatch(/rate is a minimum too/);
    expect(all).toContain('The rate and where each area is drawn are calculated by DrainLens');
    expect(all).toMatch(/does not show where in the area/);
  });
});

describe('AC 4.3.4 and the map header', () => {
  it('keeps three kinds of information, each with its own source and limits', () => {
    // Said in words under More information, not as badges (copy audit v2, #85).
    expect(INFORMATION_TYPES.map((t) => t.from)).toEqual([
      'Recorded by the SES.',
      'Calculated by DrainLens.',
      'Written and checked by the DrainLens team.',
    ]);
    for (const type of INFORMATION_TYPES) {
      expect(type.purpose.length).toBeGreaterThan(20);
      expect(type.limits.length).toBeGreaterThan(20);
    }
    expect(INFORMATION_TYPES[2]?.limits).toMatch(/does not mean no flooding/);
  });

  it('says neither view is a forecast, in one short line', () => {
    expect(NOT_A_FORECAST).toBe('Past data only, not a forecast.');
    expect(AREAS_NOTE).toMatch(/covers the whole area/);
    expect(INFORMATION_TYPES.map((t) => t.what)).toEqual([FLOOD.callouts, FLOOD.rate, 'Verified flood events']);
  });
});
