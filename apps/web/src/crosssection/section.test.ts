/**
 * Tests for what a cross-section may claim.
 *
 * The subject here is not the drawing. It is the boundary between what the
 * council recorded and what we would be inventing — and the sharpest case is
 * depth, which does not exist for a single pit in the extent and must never be
 * filled in, averaged, or implied by a plausible-looking vertical scale.
 */

import { describe, expect, it } from 'vitest';

import type { MapArtefact, Pipe, Pit } from '../map/artefact.js';
import {
  DEPTH_IS_ABSENT,
  NO_CAPACITY_CLAIM,
  UNAVAILABLE_TITLE,
  relativeWidth,
  sectionFor,
  summarise,
} from './section.js';
import { sectionLabel } from '../screens/CrossSection.js';

function mapOf(pipes: Partial<Pipe>[]): MapArtefact {
  return {
    artefact: 'map-geometry',
    version: 1,
    extent: { name: 't', min_e: 0, min_n: 0, width_m: 10, height_m: 10 },
    coordinates: 'metres',
    crs: 't',
    sources: [
      {
        layer: 'pipe',
        dataset_id: 'drainpipes',
        publisher: 'City of Melbourne Open Data Portal',
        licence: 'CC BY 4.0',
        last_modified: '2023-02-26',
        features: pipes.length,
      },
    ],
    layers: {
      pipe: pipes.map((p) => ({ g: 'line' as const, c: [[0, 0] as const, [1, 1] as const], ...p })),
    },
  };
}

const pit = (asset: number | undefined, description = 'SWD Pit - Junction'): Pit => ({
  g: 'point',
  c: [0, 0],
  ...(asset === undefined ? {} : { asset_number: asset }),
  asset_description: description,
});

describe('when a section can be drawn', () => {
  const map = mapOf([
    { ref: 11, dnstr_pit: 500, diameter: 300, material: 'Concrete' },
    { ref: 12, upstr_pit: 500, diameter: 450, material: 'Concrete' },
  ]);

  it('separates what arrives from what leaves', () => {
    const out = sectionFor(map, pit(500));
    if (out.kind !== 'available') throw new Error('expected a section');
    expect(out.incoming.map((p) => p.ref)).toEqual(['11']);
    expect(out.outgoing.map((p) => p.ref)).toEqual(['12']);
  });

  it('carries the recorded diameter and material through unchanged', () => {
    const out = sectionFor(map, pit(500));
    if (out.kind !== 'available') throw new Error('expected a section');
    expect(out.incoming[0]).toMatchObject({ diameterMm: 300, material: 'Concrete' });
  });

  it('matches on asset number whichever type the artefact used', () => {
    // The pit layer gives numbers and a pipe's endpoint may arrive as either.
    const mixed = mapOf([{ ref: 11, dnstr_pit: '500' as unknown as number, diameter: 300 }]);
    const out = sectionFor(mixed, pit(500));
    expect(out.kind).toBe('available');
  });

  it('always names depth as missing, because it always is', () => {
    // Not 95.4% missing in this artefact — absent for every pit, because the
    // pipeline never fetched a field it could not trust.
    const out = sectionFor(map, pit(500));
    if (out.kind !== 'available') throw new Error('expected a section');
    expect(out.missing).toContain(DEPTH_IS_ABSENT);
  });

  it('names an unrecorded diameter rather than filling it in', () => {
    const gap = mapOf([
      { ref: 11, dnstr_pit: 500, diameter: 300 },
      { ref: 12, upstr_pit: 500 },
    ]);
    const out = sectionFor(gap, pit(500));
    if (out.kind !== 'available') throw new Error('expected a section');
    expect(out.outgoing[0]!.diameterMm).toBeNull();
    expect(out.missing.join(' ')).toContain('12');
  });

  it('treats a zero diameter as no record, not as a zero-millimetre pipe', () => {
    const zero = mapOf([{ ref: 11, dnstr_pit: 500, diameter: 0 }]);
    const out = sectionFor(zero, pit(500));
    if (out.kind !== 'available') throw new Error('expected a section');
    expect(out.incoming[0]!.diameterMm).toBeNull();
  });

  it('says when nothing is recorded as arriving', () => {
    const only = mapOf([{ ref: 12, upstr_pit: 500, diameter: 450 }]);
    const out = sectionFor(only, pit(500));
    if (out.kind !== 'available') throw new Error('expected a section');
    expect(out.missing.join(' ')).toMatch(/arriving at this pit/);
  });

  it('says when nothing is recorded as leaving', () => {
    const only = mapOf([{ ref: 11, dnstr_pit: 500, diameter: 300 }]);
    const out = sectionFor(only, pit(500));
    if (out.kind !== 'available') throw new Error('expected a section');
    expect(out.missing.join(' ')).toMatch(/leaving this pit/);
  });

  it('handles a pipe that both arrives and leaves without losing one', () => {
    const loop = mapOf([{ ref: 11, upstr_pit: 500, dnstr_pit: 500, diameter: 300 }]);
    const out = sectionFor(loop, pit(500));
    if (out.kind !== 'available') throw new Error('expected a section');
    expect(out.incoming).toHaveLength(1);
    expect(out.outgoing).toHaveLength(1);
  });
});

describe('when it cannot be drawn', () => {
  it('refuses a pit the record connects no pipe to', () => {
    const out = sectionFor(mapOf([{ ref: 11, dnstr_pit: 999 }]), pit(500));
    expect(out.kind).toBe('unavailable');
  });

  it('says the gap is in the record, not in the drainage', () => {
    // The two are indistinguishable from here, and claiming the second would
    // be a statement about the world we cannot support.
    const out = sectionFor(mapOf([]), pit(500));
    if (out.kind !== 'unavailable') throw new Error('expected unavailable');
    expect(out.reasons.join(' ')).toMatch(/gap in the record/);
  });

  it('refuses a pit with no asset number, and says why', () => {
    const out = sectionFor(mapOf([]), pit(undefined));
    if (out.kind !== 'unavailable') throw new Error('expected unavailable');
    expect(out.reasons.join(' ')).toMatch(/no recorded asset number/);
  });

  it('names what is missing rather than only that something is', () => {
    const out = sectionFor(mapOf([]), pit(500));
    if (out.kind !== 'unavailable') throw new Error('expected unavailable');
    expect(out.reasons.length).toBeGreaterThan(0);
    for (const reason of out.reasons) expect(reason.trim()).not.toBe('');
  });

  it('has a heading that does not blame the person', () => {
    expect(UNAVAILABLE_TITLE).toMatch(/cannot be drawn/i);
  });
});

describe('what it must never claim', () => {
  it('never says anything about capacity, adequacy or a hidden blockage', () => {
    // AD6, which the criteria no longer restate. A diameter is a dimension.
    const out = sectionFor(mapOf([{ ref: 11, dnstr_pit: 500, diameter: 300 }]), pit(500));
    if (out.kind !== 'available') throw new Error('expected a section');
    const everything = [...out.missing, ...out.incoming.map(summarise)].join(' ').toLowerCase();
    expect(everything).not.toMatch(/capacity|adequate|sufficient|enough to|overflow/);
  });

  it('states outright that a diameter is not a capacity', () => {
    expect(NO_CAPACITY_CLAIM).toMatch(/dimension, not a capacity/i);
    expect(NO_CAPACITY_CLAIM).toMatch(/blocked below ground/i);
  });

  it('describes depth as absent from the record rather than hidden by us', () => {
    expect(DEPTH_IS_ABSENT).toMatch(/no pipe depth or invert level is recorded/i);
    expect(DEPTH_IS_ABSENT).toMatch(/illustrative/i);
  });
});

describe('summarise', () => {
  it('gives the size, the material and the direction', () => {
    expect(
      summarise({ ref: '11', diameterMm: 300, material: 'Concrete', direction: 'into-this-pit' }),
    ).toBe('Pipe 11 — 300 mm, concrete, arrives at this pit');
  });

  it('says which way the water runs, without ambiguity', () => {
    // "arrives from this pit" was the first wording and it says the opposite
    // of what it means for an incoming pipe.
    const inbound = summarise({ ref: '1', diameterMm: 300, material: null, direction: 'into-this-pit' });
    const outbound = summarise({ ref: '2', diameterMm: 300, material: null, direction: 'out-of-this-pit' });
    expect(inbound).toContain('arrives at this pit');
    expect(outbound).toContain('leaves this pit');
    expect(inbound).not.toContain('leaves');
  });

  it('says a diameter is not recorded rather than omitting it silently', () => {
    expect(
      summarise({ ref: '11', diameterMm: null, material: null, direction: 'out-of-this-pit' }),
    ).toContain('diameter not recorded');
  });
});

describe('relativeWidth', () => {
  const wide = { ref: 'a', diameterMm: 600, material: null, direction: 'into-this-pit' } as const;
  const narrow = { ref: 'b', diameterMm: 300, material: null, direction: 'into-this-pit' } as const;
  const unknown = { ref: 'c', diameterMm: null, material: null, direction: 'into-this-pit' } as const;

  it('scales against the widest pipe in the same drawing', () => {
    expect(relativeWidth(wide, [wide, narrow])).toBe(1);
    expect(relativeWidth(narrow, [wide, narrow])).toBe(0.5);
  });

  it('draws an unrecorded diameter at the minimum rather than an average', () => {
    // Filling it with a neighbour's value is what AC 1.1.7.f forbids — an unsupported
    // assumption dressed as a measurement.
    expect(relativeWidth(unknown, [wide, narrow, unknown])).toBe(0);
  });

  it('does not divide by zero when nothing has a diameter', () => {
    expect(relativeWidth(unknown, [unknown])).toBe(0);
  });
});

describe('the figure label a screen reader hears', () => {
  const section = {
    kind: 'available' as const,
    assetNumber: '500',
    description: null,
    incoming: [{ ref: '1', diameterMm: 300, material: null, direction: 'into-this-pit' as const }],
    outgoing: [],
    missing: [],
  };

  it('counts one pipe as a pipe, not as pipes', () => {
    expect(sectionLabel(section)).toContain('1 pipe arriving');
    expect(sectionLabel(section)).not.toContain('1 pipes');
  });

  it('pluralises more than one', () => {
    const two = { ...section, outgoing: [section.incoming[0]!, section.incoming[0]!] };
    expect(sectionLabel(two)).toContain('2 pipes leaving');
  });

  it('tells a listener the depth is not real, as the drawing tells a reader', () => {
    expect(sectionLabel(section)).toMatch(/no depth is recorded/i);
    expect(sectionLabel(section)).toMatch(/illustrative/i);
  });
});
