/**
 * The four sentences, and the one the interface must not invent.
 *
 * AC 6.1.2 allows a sentence per receiving class. The fifth — naming a
 * Melbourne Water drain because the area is named after one — is what the Epic
 * 6 definition of done forbids, and `unclassified` is what the register
 * publishes until a person has approved the row.
 */

import { describe, expect, it } from 'vitest';

import type { ReceivingClass, Subcatchment } from './artefact.js';
import {
  COUNTS_COVER,
  CLASS_NAME,
  LAYER_EDITED_ON,
  NOT_EVERY_PIPE,
  NO_AREA_MEANS,
  areaLine,
  coverageLine,
  dateLine,
  lowAreasLine,
  pipeLengthLine,
  receivingLine,
  recordYear,
  updatedLine,
  widerNames,
} from './wording.js';

/**
 * One area, with fields overridden or removed.
 *
 * `undefined` in an override means *this record does not have that field*,
 * and the key is deleted rather than set to `undefined`: under
 * `exactOptionalPropertyTypes` those are different states, and the card's
 * job is to say nothing where a date or an area is missing.
 */
const area = (over: { [K in keyof Subcatchment]?: Subcatchment[K] | undefined } = {}): Subcatchment => {
  const base: Subcatchment = {
    number: '4410',
    name: 'ALEXANDRA PARADE M.D.',
    displayName: 'Alexandra Parade Main Drain',
    class: 'unclassified',
    rings: [[[0, 0], [1, 0], [1, 1]]],
    lastUpdated: '2013-11-20',
    captured: '2002-07-24',
    areaSqKm: 10.54,
    majorName: 'YARRA RIVER MAIN STREAM',
    basinName: 'Yarra',
    summary: { pits: 1002, pipeLengthM: 19_000, lowAreas: 1578, coverage: 0.909 },
  };
  const made: Record<string, unknown> = { ...base, ...over };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) delete made[key];
  }
  return made as unknown as Subcatchment;
};

describe('what receives this area’s water', () => {
  it('names the drain only where the class says so', () => {
    expect(receivingLine(area({ class: 'main-drain' }))).toContain('Alexandra Parade Main Drain');
    expect(receivingLine(area({ class: 'main-drain' }))).toContain('Melbourne Water');
  });

  it('says a waterway section drains to that section', () => {
    const line = receivingLine(area({ class: 'waterway-section', displayName: 'Yarra River (Mouth to Merri)' }));
    expect(line).toContain('drains to Yarra River (Mouth to Merri)');
    expect(line).toContain('section of the waterway');
  });

  it('uses the criterion’s own words for council drainage', () => {
    // AC 6.1.2 quotes this one exactly.
    expect(receivingLine(area({ class: 'council-direct' }))).toBe(
      'This area is recorded as council drainage discharging directly to a receiving waterway or bay.',
    );
  });

  it('names the area and no drain while the class is unconfirmed', () => {
    const line = receivingLine(area());
    expect(line).toContain('Alexandra Parade Main Drain');
    expect(line).toContain('has not been confirmed');
    // The sentence the definition of done forbids without an approval.
    expect(line).not.toContain('Melbourne Water');
  });

  it('has a sentence for every class the artefact can carry', () => {
    const classes: readonly ReceivingClass[] = ['main-drain', 'waterway-section', 'council-direct', 'unclassified'];
    for (const kind of classes) {
      expect(receivingLine(area({ class: kind })).length).toBeGreaterThan(20);
      expect(CLASS_NAME[kind]).toBeTruthy();
    }
  });

  it('never claims the address’s own pipe runs there', () => {
    expect(NOT_EVERY_PIPE).toContain('does not mean every pipe');
  });
});

describe('the dates, kept apart', () => {
  it('states the year from the record’s own date', () => {
    expect(recordYear(area())).toBe('2013');
    expect(updatedLine(area())).toBe('This drainage-area record was last updated in 2013.');
  });

  it('says nothing where the record has no date, rather than guessing one', () => {
    expect(updatedLine(area({ lastUpdated: undefined }))).toBeNull();
  });

  it('writes a date as a reader would', () => {
    expect(dateLine('2013-11-20')).toBe('20 November 2013');
    expect(dateLine(undefined)).toBeNull();
  });

  it('keeps the layer’s own edit date separate from the record’s', () => {
    // AC 6.1.4 twice: neither is a survey date, and the portal's metadata date
    // is not the record's.
    expect(LAYER_EDITED_ON).not.toBe(area().lastUpdated);
  });
});

describe('the figures on the card', () => {
  it('writes the recorded area as the record has it', () => {
    expect(areaLine(area())).toBe('10.54 km²');
    expect(areaLine(area({ areaSqKm: undefined }))).toBeNull();
  });

  it('writes pipe length in the unit that stays readable', () => {
    expect(pipeLengthLine(96_432)).toBe('96.4 km');
    expect(pipeLengthLine(940)).toBe('940 m');
  });

  it('says whether low areas are present, in words', () => {
    expect(lowAreasLine(area())).toContain('1,578 low areas');
    expect(lowAreasLine(area({ summary: { pits: 0, pipeLengthM: 0, lowAreas: 0 } }))).toContain('No low areas');
    expect(lowAreasLine(area({ summary: { pits: 0, pipeLengthM: 0, lowAreas: 1 } }))).toContain('1 low area ');
  });

  it('says how much of the area the counts cover, when it is not all of it', () => {
    expect(coverageLine(area())).toContain('91%');
    expect(coverageLine(area({ summary: { pits: 1, pipeLengthM: 1, lowAreas: 0, coverage: 1 } }))).toBeNull();
  });

  it('says the counts are City of Melbourne data whatever the coverage', () => {
    expect(COUNTS_COVER).toContain('City of Melbourne data only');
  });

  it('writes the wider catchment names as names rather than as shouting', () => {
    expect(widerNames(area())).toEqual([
      { label: 'Major catchment', value: 'Yarra River Main Stream' },
      { label: 'River basin', value: 'Yarra' },
    ]);
  });
});

describe('the address with no recorded area', () => {
  it('says why the nearest is not offered instead', () => {
    expect(NO_AREA_MEANS).toContain('not shown instead');
  });
});
