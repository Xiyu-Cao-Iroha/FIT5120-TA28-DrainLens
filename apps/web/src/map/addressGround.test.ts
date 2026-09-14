/**
 * Which way the ground falls around an address, and how the card says it.
 *
 * The wording is the claim. These check that the ground, the water path and the
 * low area stay three separate facts, that "unclear" and "too near the edge"
 * are told apart, and that the figure writes down whatever it cannot point at.
 */

import { describe, expect, it } from 'vitest';

import { labelsFor, layoutLabels, notesFor } from './AddressInsight.js';
import {
  AddressGroundError,
  assertAddressGround,
  describeAddress,
  describeGround,
  groundAt,
  loadAddressGround,
} from './addressGround.js';
import type { WaterNearby } from './nearby.js';

const artefact = {
  artefact: 'address-ground' as const,
  settings: { areaAcrossM: 150 },
  addresses: {
    'kensington/1-a-street-kensington': { ground: 'falls', bearing: 'north-west', fallM: 1 },
    'kensington/2-a-street-kensington': { ground: 'unclear' },
    'kensington/3-a-street-kensington': { ground: 'edge' },
    'kensington/4-a-street-kensington': { ground: 'falls', bearing: 'up', fallM: 1 },
  },
};

describe('reading the artefact', () => {
  it('gives each address its trend, and nothing for an address it does not hold', () => {
    expect(groundAt(artefact, 'kensington/1-a-street-kensington')).toEqual({ kind: 'falls', bearing: 'north-west', fallM: 1 });
    expect(groundAt(artefact, 'kensington/2-a-street-kensington')).toEqual({ kind: 'unclear' });
    expect(groundAt(artefact, 'kensington/3-a-street-kensington')).toEqual({ kind: 'edge' });
    expect(groundAt(artefact, 'nowhere')).toBeNull();
  });

  it('treats a direction that is not a compass point as unclear, not as a direction', () => {
    expect(groundAt(artefact, 'kensington/4-a-street-kensington')).toEqual({ kind: 'unclear' });
  });

  it('refuses something that is not the artefact', async () => {
    expect(() => {
      assertAddressGround({ artefact: 'derived-layers' });
    }).toThrow(AddressGroundError);
    expect(() => {
      assertAddressGround({ artefact: 'address-ground', settings: { areaAcrossM: 150 } });
    }).toThrow(/no addresses/);
    expect(() => {
      assertAddressGround({ artefact: 'address-ground', addresses: {} });
    }).toThrow(/how wide/);
    await expect(loadAddressGround('/x', () => Promise.resolve(artefact))).resolves.toBe(artefact);
    await expect(loadAddressGround('/x', () => Promise.resolve({}))).rejects.toThrow(AddressGroundError);
  });
});

describe('what the card says', () => {
  it('uses the handover wording for a reliable direction, to one decimal', () => {
    expect(describeGround({ kind: 'falls', bearing: 'north-west', fallM: 1 })).toBe(
      'Nearby ground generally falls north-west. The fitted ground level changes by about 1.0 m across the surrounding 150 m-wide area.',
    );
  });

  it('never says "over the next 150 m", which would be a walk rather than an area', () => {
    const said = describeGround({ kind: 'falls', bearing: 'south', fallM: 2.5 });
    expect(said).not.toMatch(/over the next|towards/);
  });

  it('tells an unclear ground from an address too near the edge of the data', () => {
    expect(describeGround({ kind: 'unclear' })).toBe('No reliable overall ground direction could be identified around this address.');
    expect(describeGround({ kind: 'edge' })).toMatch(/too close to the edge of the measured ground/);
  });

  it('keeps the ground and the water as separate sentences, and joins no cause', () => {
    const water: WaterNearby = {
      channel: { kind: 'direction', distanceM: 10, bearing: 'north-east', angleDeg: 40 },
      low: { kind: 'direction', distanceM: 30, bearing: 'south', angleDeg: 270 },
    };
    const said = describeAddress({ kind: 'falls', bearing: 'north-west', fallM: 1 }, water)!;
    expect(said.startsWith('Nearby ground generally falls north-west.')).toBe(true);
    expect(said).toContain('about 10 m to the north-east');
    expect(said).toContain('about 30 m to the south');
    expect(said).not.toMatch(/towards/);
    expect(describeAddress(null, null)).toBeNull();
    expect(describeAddress({ kind: 'unclear' }, null)).toMatch(/^No reliable/);
  });
});

describe('what the figure writes when it has nothing to point at', () => {
  it('notes an unclear or edge ground, a very near path, and a house inside a low area', () => {
    expect(notesFor({ kind: 'unclear' }, null)).toEqual(['No reliable overall ground direction']);
    expect(notesFor({ kind: 'edge' }, null)[0]).toMatch(/edge of the data/);
    expect(
      notesFor({ kind: 'falls', bearing: 'east', fallM: 1 }, { channel: { kind: 'very-near' }, low: { kind: 'inside' } }),
    ).toEqual(['A likely water path is at or very near', 'This address is inside a mapped low area']);
    expect(notesFor(null, { channel: null, low: { kind: 'very-near' } })).toEqual(['A low area is at or very near this address']);
  });
});

describe('where the figure puts its labels', () => {
  const box = (l: ReturnType<typeof layoutLabels>[number]) => {
    const width = Math.max(...l.lines.map((t) => t.length)) * 5.8;
    const left = l.anchor === 'end' ? l.x - width : l.anchor === 'middle' ? l.x - width / 2 : l.x;
    return { left, right: left + width, top: l.y - 9, bottom: l.y + 13 };
  };

  it('keeps two labels pointing the same way from printing over each other', () => {
    // 53 Altona Street: the ground falls west and the nearest path is west.
    const labels = labelsFor(
      { kind: 'falls', bearing: 'west', fallM: 6 },
      { channel: { kind: 'direction', distanceM: 20, bearing: 'west', angleDeg: 178 }, low: null },
    );
    const [a, b] = labels.map(box);
    expect(a!.bottom <= b!.top || b!.bottom <= a!.top || a!.right <= b!.left || b!.right <= a!.left).toBe(true);
  });

  it('keeps a label pointing north off the N above the ring', () => {
    const [label] = layoutLabels([{ key: 'k', degrees: 95, lines: ['low area', 'about 40 m away'] }]);
    const b = box(label!);
    // The N sits at x 160, y 15 to 30 in the figure.
    expect(b.right <= 152 || b.left >= 168 || b.bottom <= 15 || b.top >= 30).toBe(true);
  });

  it('keeps every label inside the figure, whichever way it points', () => {
    for (let degrees = 0; degrees < 360; degrees += 15) {
      for (const label of layoutLabels([{ key: 'k', degrees, lines: ['ground falls', '≈ 3.5 m over 150 m'] }])) {
        const b = box(label);
        expect(b.left).toBeGreaterThanOrEqual(3.9);
        expect(b.right).toBeLessThanOrEqual(316.1);
      }
    }
  });
});
