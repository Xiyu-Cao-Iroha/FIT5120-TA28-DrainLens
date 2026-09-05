/**
 * Tests for the data credit.
 *
 * This is a licence obligation rather than a design choice, so the assertions
 * are about what CC BY 4.0 asks for: the creator named, the licence named and
 * linked, and an indication that changes were made — which is the clause most
 * often skipped and the one this project most owes, because half of what is on
 * screen is calculated rather than published.
 */

import { describe, expect, it } from 'vitest';

import type { MapArtefact, MapSource } from '../map/artefact.js';
import {
  CHANGES_NOTICE,
  LICENCE_URL,
  creditLine,
  creditsFor,
  describeDatasets,
} from './attribution.js';

const source = (over: Partial<MapSource> = {}): MapSource => ({
  layer: 'pit',
  dataset_id: 'stormwater-pits',
  publisher: 'City of Melbourne Open Data Portal',
  licence: 'CC BY 4.0',
  last_modified: '2023-02-26',
  features: 1,
  ...over,
});

const artefactWith = (sources: MapSource[]): MapArtefact =>
  ({
    artefact: 'map-geometry',
    version: 1,
    extent: { name: 't', min_e: 0, min_n: 0, width_m: 1, height_m: 1 },
    coordinates: 'metres',
    crs: 't',
    sources,
    layers: {},
  }) as MapArtefact;

describe('creditsFor', () => {
  it('keeps a publisher whose name contains spaces intact', () => {
    // The first version keyed on `publisher + ' ' + licence` and split the key
    // back apart on a space, which credited "City" for everything.
    const credits = creditsFor(artefactWith([source()]));
    expect(credits[0]?.publisher).toBe('City of Melbourne Open Data Portal');
    expect(credits[0]?.licence).toBe('CC BY 4.0');
  });

  it('gives one credit for many datasets from one publisher', () => {
    const credits = creditsFor(
      artefactWith([
        source({ dataset_id: 'stormwater-pits' }),
        source({ dataset_id: 'drainpipes' }),
        source({ dataset_id: 'road-corridors' }),
      ]),
    );
    expect(credits).toHaveLength(1);
    expect(credits[0]?.datasets).toEqual(['stormwater-pits', 'drainpipes', 'road-corridors']);
  });

  it('separates publishers, and separates licences from one publisher', () => {
    const credits = creditsFor(
      artefactWith([
        source(),
        source({ publisher: 'Another Portal' }),
        source({ licence: 'CC BY-SA 4.0' }),
      ]),
    );
    expect(credits).toHaveLength(3);
  });

  it('does not merge two different publishers whose names run into their licences', () => {
    // The separator, finally tested. `keeps a publisher whose name contains
    // spaces intact` reads like it covers this and does not: the credit holds
    // the publisher and the licence as their own fields, so the name survives
    // whatever the grouping key is made of. What the key can still do is
    // *collide* — "Water Corp" + "CC BY 4.0" and "Water" + "Corp CC BY 4.0"
    // join on a space to the same string, and one of these two credits would
    // disappear.
    //
    // It failed for thirty seconds on 5 September, when a quality pass rewrote
    // the line and put the space back. Nothing went red, which is why this is
    // here.
    const credits = creditsFor(
      artefactWith([
        source({ publisher: 'Water Corp', licence: 'CC BY 4.0' }),
        source({ publisher: 'Water', licence: 'Corp CC BY 4.0' }),
      ]),
    );
    expect(credits).toHaveLength(2);
    expect(credits.map((c) => c.publisher)).toEqual(['Water Corp', 'Water']);
  });

  it('reports the most recent update across the group', () => {
    const credits = creditsFor(
      artefactWith([
        source({ dataset_id: 'a', last_modified: '2021-09-30' }),
        source({ dataset_id: 'b', last_modified: '2023-02-26' }),
      ]),
    );
    expect(credits[0]?.lastModified).toBe('2023-02-26');
  });

  it('does not repeat a dataset named by two layers', () => {
    const credits = creditsFor(
      artefactWith([source({ layer: 'pit' }), source({ layer: 'pipe' })]),
    );
    expect(credits[0]?.datasets).toEqual(['stormwater-pits']);
  });

  it('drops a source that names no publisher or no licence', () => {
    // A credit that cannot say who to credit is not a credit, and printing
    // "undefined" beside a copyright symbol is worse than printing nothing.
    const credits = creditsFor(
      artefactWith([
        source({ publisher: '   ' }),
        source({ licence: undefined as unknown as string }),
      ]),
    );
    expect(credits).toEqual([]);
  });

  it('survives an artefact with no sources', () => {
    expect(creditsFor(artefactWith([]))).toEqual([]);
  });
});

describe('describeDatasets', () => {
  it('lists a short set in full', () => {
    expect(describeDatasets(['a', 'b'])).toBe('a, b');
  });

  it('summarises a long one rather than filling the footer', () => {
    expect(describeDatasets(['a', 'b', 'c', 'd'])).toBe('a, b and 2 others');
  });

  it('says "1 other", not "1 others"', () => {
    expect(describeDatasets(['a', 'b', 'c'])).toBe('a, b and 1 other');
  });

  it('is empty for nothing', () => {
    expect(describeDatasets([])).toBe('');
  });
});

describe('what the licence requires', () => {
  it('names the creator and the licence in one readable line', () => {
    const line = creditLine(creditsFor(artefactWith([source()]))[0]!);
    expect(line).toContain('City of Melbourne Open Data Portal');
    expect(line).toContain('CC BY 4.0');
    expect(line).toContain('©');
  });

  it('links the licence itself, not a page about it', () => {
    expect(LICENCE_URL).toBe('https://creativecommons.org/licenses/by/4.0/');
  });

  it('indicates that changes were made', () => {
    // The clause people skip. Half of what is on screen is calculated, and a
    // screenshot of a derived layer must not read as a council map.
    expect(CHANGES_NOTICE).toMatch(/calculated from this data/i);
    expect(CHANGES_NOTICE).toMatch(/not published by the source/i);
  });

  it('does not claim the derived layers are the council own work', () => {
    expect(CHANGES_NOTICE.toLowerCase()).not.toMatch(/published by the city|official/);
  });
});
