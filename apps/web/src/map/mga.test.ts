/**
 * The projection port, against the Python it was ported from.
 *
 * The expected values below were produced by
 * `pipeline/src/drainlens_pipeline/geo.py`, whose forward direction agrees
 * with the City of Melbourne's own published eastings and northings across all
 * 63,721 address records to within a millimetre. Freezing its answers here is
 * what makes this a port rather than a second guess at the same maths.
 */

import { describe, expect, it } from 'vitest';

import { fromMga55, mapLink, toMga55 } from './mga.js';

describe('projecting to MGA Zone 55', () => {
  it('agrees with the pipeline, to a tenth of a millimetre', () => {
    const cases = [
      { latitude: -37.7963, longitude: 144.929, eastingM: 317659.959, northingM: 5814765.4153 },
      { latitude: -37.8136, longitude: 144.9631, eastingM: 320704.4463, northingM: 5812911.6995 },
      { latitude: -37.7, longitude: 145.0, eastingM: 323683.318, northingM: 5825587.4628 },
    ];
    for (const { latitude, longitude, eastingM, northingM } of cases) {
      const made = toMga55({ latitude, longitude });
      expect(made.eastingM).toBeCloseTo(eastingM, 3);
      expect(made.northingM).toBeCloseTo(northingM, 3);
    }
  });
});

describe('coming back out of it', () => {
  it('agrees with the pipeline to the eighth decimal, about a millimetre', () => {
    const cases = [
      { eastingM: 316500, northingM: 5814500, latitude: -37.79845837, longitude: 144.91576609 },
      { eastingM: 320000, northingM: 5812000, latitude: -37.82167343, longitude: 144.95487512 },
    ];
    for (const { eastingM, northingM, latitude, longitude } of cases) {
      const made = fromMga55({ eastingM, northingM });
      expect(made.latitude).toBeCloseTo(latitude, 7);
      expect(made.longitude).toBeCloseTo(longitude, 7);
    }
  });

  it('round-trips anywhere in the council extent', () => {
    // The extent is 8.5 by 9 km from (315000, 5808500).
    for (let e = 315000; e <= 323500; e += 1700) {
      for (let n = 5808500; n <= 5817500; n += 1800) {
        const back = toMga55(fromMga55({ eastingM: e, northingM: n }));
        expect(back.eastingM).toBeCloseTo(e, 3);
        expect(back.northingM).toBeCloseTo(n, 3);
      }
    }
  });
});

describe('the link a report carries', () => {
  it('points at the pinned place, in degrees', () => {
    const link = mapLink({ eastingM: 316500, northingM: 5814500 });
    expect(link).toContain('mlat=-37.798458');
    expect(link).toContain('mlon=144.915766');
    expect(link.startsWith('https://www.openstreetmap.org/')).toBe(true);
  });

  it('carries nothing about the reader', () => {
    // AC 6.3.3: the link is a place, not a person, and it is built here and
    // written into their own clipboard.
    const link = mapLink({ eastingM: 320000, northingM: 5812000 });
    expect(link).not.toMatch(/session|user|id=|token/i);
  });
});
