/**
 * Which way the ground falls around an address, and how the card says it.
 *
 * The wording is the claim. These check that the ground, the water path and the
 * low area stay three separate facts, that "unclear" and "too near the edge"
 * are told apart, and that the figure writes down whatever it cannot point at.
 */

import { describe, expect, it } from 'vitest';

import { CAPTION_TEXT, type PlacedLabel, figureFor, groundLines, layoutFigure, notesFor } from './AddressInsight.js';
import {
  AddressGroundError,
  type GroundTrend,
  STEEP_FALL_M,
  assertAddressGround,
  describeAddress,
  describeGround,
  groundAt,
  isSteep,
  loadAddressGround,
  metresOf,
  trendOf,
} from './addressGround.js';
import { COMPASS_ANGLE, type NearbyThing, type WaterNearby } from './nearby.js';

const artefact = {
  artefact: 'address-ground' as const,
  version: 2 as const,
  area: 'kensington',
  settings: { areaAcrossM: 150, fallRoundingM: 0.5 },
  on: ['A Street|Kensington', 'No Suburb Lane'],
  at: [['1=NW2', '2=u', '3=x', '4=UP2', '5=bad'], ['7=S5']],
};

describe('reading the artefact', () => {
  it('gives each address its trend, and nothing for an address it does not hold', () => {
    expect(groundAt(artefact, 'kensington/1-a-street-kensington')).toEqual({ kind: 'falls', bearing: 'north-west', fallM: 1 });
    expect(groundAt(artefact, 'kensington/2-a-street-kensington')).toEqual({ kind: 'unclear' });
    expect(groundAt(artefact, 'kensington/3-a-street-kensington')).toEqual({ kind: 'edge' });
    expect(groundAt(artefact, 'nowhere')).toBeNull();
  });

  it('rebuilds the id the address index builds, suburb or none', () => {
    expect(groundAt(artefact, 'kensington/7-no-suburb-lane')).toEqual({ kind: 'falls', bearing: 'south', fallM: 2.5 });
  });

  it('treats a direction that is not a compass point as unclear, not as a direction', () => {
    expect(groundAt(artefact, 'kensington/4-a-street-kensington')).toEqual({ kind: 'unclear' });
    expect(groundAt(artefact, 'kensington/5-a-street-kensington')).toEqual({ kind: 'unclear' });
    expect(trendOf('SE1')).toEqual({ kind: 'falls', bearing: 'south-east', fallM: 0.5 });
    expect(trendOf('NN3', 0.5)).toEqual({ kind: 'unclear' });
  });

  it('refuses something that is not the artefact', async () => {
    expect(() => {
      assertAddressGround({ artefact: 'derived-layers' });
    }).toThrow(AddressGroundError);
    expect(() => {
      assertAddressGround({ ...artefact, version: 1 });
    }).toThrow(/version 1/);
    expect(() => {
      assertAddressGround({ ...artefact, on: [], at: [] });
    }).toThrow(/no addresses/);
    expect(() => {
      assertAddressGround({ ...artefact, at: [[]] });
    }).toThrow(/2 streets and 1 groups/);
    expect(() => {
      assertAddressGround({ ...artefact, area: '' });
    }).toThrow(/which area/);
    expect(() => {
      assertAddressGround({ ...artefact, settings: {} });
    }).toThrow(/how wide/);
    await expect(loadAddressGround('/x', () => Promise.resolve(artefact))).resolves.toBe(artefact);
    await expect(loadAddressGround('/x', () => Promise.resolve({}))).rejects.toThrow(AddressGroundError);
  });
});

describe('what the card says', () => {
  it('says a gentle slope in plain words, and a steep one as steep', () => {
    expect(describeGround({ kind: 'falls', bearing: 'north-west', fallM: 1 })).toBe(
      'The ground around this address slopes gently down to the north-west. The ground level changes by about 1 m across the surrounding 150 m-wide area.',
    );
    expect(describeGround({ kind: 'falls', bearing: 'east', fallM: 8.5 })).toBe(
      'The ground around this address slopes down to the east, and the slope is steep. The ground level changes by about 8.5 m across the surrounding 150 m-wide area.',
    );
  });

  it('calls a slope steep from 1 in 20 across the 150 m area, and not before', () => {
    expect(STEEP_FALL_M / 150).toBe(1 / 20);
    expect(isSteep(7)).toBe(false);
    expect(isSteep(7.5)).toBe(true);
    expect(metresOf(4)).toBe('4');
    expect(metresOf(12.5)).toBe('12.5');
  });

  it('never says "over the next 150 m", which would be a walk rather than an area', () => {
    for (const fallM of [2.5, 15]) {
      const said = describeGround({ kind: 'falls', bearing: 'south', fallM });
      expect(said).not.toMatch(/over the next|towards/);
    }
  });

  it('tells an unclear ground from an address too near the edge of the data', () => {
    expect(describeGround({ kind: 'unclear' })).toBe('No clear downhill direction could be found around this address.');
    expect(describeGround({ kind: 'edge' })).toMatch(/too close to the edge of the measured ground/);
  });

  it('keeps the ground and the water as separate sentences, and joins no cause', () => {
    const water: WaterNearby = {
      channel: { kind: 'direction', distanceM: 10, bearing: 'north-east', angleDeg: 40 },
      low: { kind: 'direction', distanceM: 30, bearing: 'south', angleDeg: 270 },
    };
    const said = describeAddress({ kind: 'falls', bearing: 'north-west', fallM: 1 }, water)!;
    expect(said.startsWith('The ground around this address slopes gently down to the north-west.')).toBe(true);
    expect(said).toContain('about 10 m to the north-east');
    expect(said).toContain('about 30 m to the south');
    expect(said).not.toMatch(/towards/);
    expect(describeAddress(null, null)).toBeNull();
    expect(describeAddress({ kind: 'unclear' }, null)).toMatch(/^No clear downhill direction/);
  });
});

describe('what the figure writes when it has nothing to point at', () => {
  it('notes an unclear or edge ground, a very near path, and a house inside a low area', () => {
    expect(notesFor({ kind: 'unclear' }, null)).toEqual(['No clear downhill direction here']);
    expect(notesFor({ kind: 'edge' }, null)[0]).toMatch(/edge of the data/);
    expect(
      notesFor({ kind: 'falls', bearing: 'east', fallM: 1 }, { channel: { kind: 'very-near' }, low: { kind: 'inside' } }),
    ).toEqual(['Water may flow at or near this address', 'Water may pool at this address']);
    expect(notesFor(null, { channel: null, low: { kind: 'very-near' } })).toEqual(['Water may pool at or near this address']);
  });
});

/**
 * Team review item 16: the labels say where water may flow, where it may
 * collect and where the ground slopes steeply, in words a resident reads
 * without a key — and none of the words they replaced.
 */
describe('what the figure’s labels say', () => {
  const near: WaterNearby = {
    channel: { kind: 'direction', distanceM: 60, bearing: 'north', angleDeg: 90 },
    low: { kind: 'direction', distanceM: 10, bearing: 'south', angleDeg: 270 },
  };
  const linesOf = (ground: GroundTrend | null) =>
    Object.fromEntries(figureFor(ground, near).labels.map((l) => [l.key, l.lines]));

  it('says where water may flow and where it may pool, hedged with "may"', () => {
    const lines = linesOf(null);
    expect(lines.path).toEqual(['Water may flow', 'about 60 m away']);
    expect(lines.low).toEqual(['Water may pool', 'about 10 m away']);
  });

  it('prints a fall only for a steep slope', () => {
    // 10 Leonard Crescent: north-east, 4 m — gentle, so no number.
    expect(linesOf({ kind: 'falls', bearing: 'north-east', fallM: 4 }).ground).toEqual(['Gentle slope', 'downhill this way']);
    expect(groundLines(7)).toEqual(['Gentle slope', 'downhill this way']);
    expect(groundLines(7.5)).toEqual(['Steep slope down', 'about 8 m in 150 m']);
    expect(groundLines(129.5)).toEqual(['Steep slope down', 'about 130 m in 150 m']);
  });

  it('keeps the old calculated-feature words and the key out of the figure', () => {
    const labels = [
      ...[1, 15, 129.5].flatMap((fallM) => linesOf({ kind: 'falls', bearing: 'west', fallM }).ground ?? []),
      ...Object.values(linesOf(null)).flat(),
    ];
    const notes = [
      ...notesFor({ kind: 'unclear' }, { channel: { kind: 'very-near' }, low: { kind: 'inside' } }),
      ...notesFor({ kind: 'edge' }, { channel: null, low: { kind: 'very-near' } }),
    ];
    expect([...labels, ...notes, CAPTION_TEXT].join(' | ')).not.toMatch(
      /likely water path|low area|ground falls|≈|Arrow =|Dashed =|not to scale|feature/i,
    );
    expect(CAPTION_TEXT).toBe('Directions and distances are approximate.');
    // Short enough to sit beside the ring; see `groundLines`.
    expect(labels.filter((line) => line.length > 20)).toEqual([]);
  });
});

/**
 * The figure's geometry, worked out here from how `AddressInsight` draws each
 * mark rather than borrowed from the layout, so a layout that misjudged a mark's
 * size would fail these instead of agreeing with itself.
 */
describe('where the figure puts its labels', () => {
  interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }
  // The ring is 34 px round, centred at x 160; the layout decides its y.
  const CX = 160;
  const RING = 34;
  const toward = (cy: number, degrees: number, radius: number) => {
    const r = (degrees * Math.PI) / 180;
    return [CX + Math.cos(r) * radius, cy - Math.sin(r) * radius] as const;
  };
  const around = (points: readonly (readonly [number, number])[], grow: number): Box => ({
    left: Math.min(...points.map((p) => p[0])) - grow,
    right: Math.max(...points.map((p) => p[0])) + grow,
    top: Math.min(...points.map((p) => p[1])) - grow,
    bottom: Math.max(...points.map((p) => p[1])) + grow,
  });

  const box = (l: PlacedLabel): Box => {
    const width = Math.max(...l.lines.map((t) => t.length)) * 5.8;
    const left = l.anchor === 'end' ? l.x - width : l.anchor === 'middle' ? l.x - width / 2 : l.x;
    return { left, right: left + width, top: l.y - 9, bottom: l.y + 13 };
  };
  /** The arrowhead from radius 32 to its tip at 42, 10 px across. */
  const arrowBox = (cy: number, degrees: number) => {
    const [bx, by] = toward(cy, degrees, 32);
    const r = (degrees * Math.PI) / 180;
    const [px, py] = [-Math.sin(r) * 5, -Math.cos(r) * 5];
    return around([toward(cy, degrees, 42), [bx + px, by + py], [bx - px, by - py]], 0);
  };
  /** The path's bar across the ring, 12 px long with a 1.5 px round cap. */
  const barBox = (cy: number, degrees: number) => {
    const r = ((degrees + 90) * Math.PI) / 180;
    const [ex, ey] = toward(cy, degrees, RING);
    return around([[ex + Math.cos(r) * 6, ey - Math.sin(r) * 6], [ex - Math.cos(r) * 6, ey + Math.sin(r) * 6]], 1.5);
  };
  /** The low area's oval, 16 by 10 px along its line, traced round its outline. */
  const ovalBox = (cy: number, degrees: number) => {
    const r = (degrees * Math.PI) / 180;
    const [ex, ey] = toward(cy, degrees, RING);
    const outline = Array.from({ length: 144 }, (_, i) => {
      const t = (i / 144) * 2 * Math.PI;
      const [u, v] = [8 * Math.cos(t), 5 * Math.sin(t)];
      return [ex + u * Math.cos(r) - v * Math.sin(r), ey - (u * Math.sin(r) + v * Math.cos(r))] as const;
    });
    return around(outline, 0.75);
  };
  /** The N: an 11 px bold capital on its baseline. */
  const northBox = (y: number): Box => ({ left: CX - 4, right: CX + 4, top: y - 8, bottom: y });
  const centreBox = (cy: number): Box => ({ left: CX - 5.5, right: CX + 5.5, top: cy - 5.5, bottom: cy + 5.5 });

  const apart = (a: Box, b: Box) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
  /** How far a box is from the ring's centre at its nearest point. */
  const reach = (b: Box, cy: number) => Math.hypot(Math.max(b.left - CX, 0, CX - b.right), Math.max(b.top - cy, 0, cy - b.bottom));

  /**
   * Lay out a figure and list everything wrong with it: a label on the ring,
   * the centre, the N, a mark or another label, or anything outside the figure.
   * A list rather than an `expect` per box keeps the sweep quick and its failure
   * readable.
   */
  const check = (ground: GroundTrend | null, near: WaterNearby | null) => {
    const figure = figureFor(ground, near);
    const { cy } = figure;
    const glyphs: { name: string; box: Box }[] = [];
    if (ground?.kind === 'falls') glyphs.push({ name: 'arrowhead', box: arrowBox(cy, COMPASS_ANGLE[ground.bearing]) });
    if (near?.channel?.kind === 'direction') glyphs.push({ name: 'path bar', box: barBox(cy, near.channel.angleDeg) });
    if (near?.low?.kind === 'direction') glyphs.push({ name: 'low oval', box: ovalBox(cy, near.low.angleDeg) });
    const north = northBox(figure.northY);
    const boxes = figure.labels.map((l) => ({ key: l.key, box: box(l) }));

    const problems: string[] = [];
    const inside = (name: string, b: Box) => {
      if (b.left < 3.9 || b.right > 316.1) problems.push(`${name} off the side`);
      if (b.top < 0) problems.push(`${name} off the top`);
      if (b.bottom > figure.drawingBottom) problems.push(`${name} into the notes`);
    };
    inside('N', north);
    for (const glyph of glyphs) {
      if (!apart(north, glyph.box)) problems.push(`N under the ${glyph.name}`);
      inside(glyph.name, glyph.box);
    }
    boxes.forEach(({ key, box: b }, i) => {
      const name = `label ${key}`;
      if (reach(b, cy) < RING + 1) problems.push(`${name} on the ring`);
      if (!apart(b, centreBox(cy))) problems.push(`${name} on the centre`);
      if (!apart(b, north)) problems.push(`${name} on the N`);
      for (const glyph of glyphs) if (!apart(b, glyph.box)) problems.push(`${name} on the ${glyph.name}`);
      for (const other of boxes.slice(i + 1)) if (!apart(b, other.box)) problems.push(`${name} on label ${other.key}`);
      inside(name, b);
    });
    const context = problems.length === 0 ? [] : [JSON.stringify({ ground, near })];
    return { figure, boxes, problems: problems.length === 0 ? problems : [...problems, ...context] };
  };

  it('keeps two labels pointing the same way from printing over each other', () => {
    // 53 Altona Street: the ground falls west and the nearest path is west.
    const { figure, problems } = check(
      { kind: 'falls', bearing: 'west', fallM: 6 },
      { channel: { kind: 'direction', distanceM: 20, bearing: 'west', angleDeg: 178 }, low: null },
    );
    expect(problems).toEqual([]);
    expect(figure.labels).toHaveLength(2);
    // Nothing needed more room, so the figure keeps its usual size.
    expect(figure.drawingBottom).toBe(138);
  });

  it('keeps a label pointing north off the N above the ring, and the N out from under the oval', () => {
    const figure = layoutFigure([{ key: 'k', degrees: 95, mark: 'oval', lines: ['Water may collect', 'about 40 m away'] }]);
    const north = northBox(figure.northY);
    expect(apart(box(figure.labels[0]!), north)).toBe(true);
    expect(apart(ovalBox(figure.cy, 95), north)).toBe(true);
  });

  it('keeps 5 Darcy Lane’s low-area label off the address dot, the arrow and the N', () => {
    // The ground falls west; a low area about 30 m away, just west of north.
    for (const angleDeg of [92, 95, 100, 105]) {
      const { boxes, figure, problems } = check(
        { kind: 'falls', bearing: 'west', fallM: 15 },
        { channel: null, low: { kind: 'direction', distanceM: 30, bearing: 'north', angleDeg } },
      );
      expect(problems).toEqual([]);
      // Still on the side the oval is: above the address, and not across on the east.
      const low = boxes.find((b) => b.key === 'low')!.box;
      expect(low.bottom).toBeLessThanOrEqual(figure.cy - RING / 2);
      expect(low.left).toBeLessThan(CX);
    }
  });

  it('keeps 2 Mctaggart Street’s two northern labels outside the ring and apart', () => {
    // The ground falls north-west; a low area about 20 m north, a water path about 130 m roughly north.
    for (const [low, path] of [
      [90, 90],
      [92, 84],
      [88, 96],
      [95, 75],
      [80, 105],
    ] as const) {
      const { boxes, figure, problems } = check(
        { kind: 'falls', bearing: 'north-west', fallM: 9.5 },
        {
          channel: { kind: 'direction', distanceM: 130, bearing: 'north', angleDeg: path },
          low: { kind: 'direction', distanceM: 20, bearing: 'north', angleDeg: low },
        },
      );
      expect(problems).toEqual([]);
      expect(boxes).toHaveLength(3);
      // Both northern labels above the address, not pushed round underneath it.
      for (const key of ['path', 'low']) expect(boxes.find((b) => b.key === key)!.box.bottom).toBeLessThan(figure.cy);
    }
  });

  it('keeps every label off every mark, the N and each other, and inside the figure, in every arrangement', () => {
    const grounds: (GroundTrend | null)[] = [
      null,
      { kind: 'unclear' },
      { kind: 'edge' },
      ...(Object.keys(COMPASS_ANGLE) as (keyof typeof COMPASS_ANGLE)[]).flatMap(
        (bearing): GroundTrend[] => [
          { kind: 'falls', bearing, fallM: 15 },
          { kind: 'falls', bearing, fallM: 2 },
          // The widest ground label the artefact holds: "about 130 m in 150 m".
          { kind: 'falls', bearing, fallM: 129.5 },
        ],
      ),
    ];
    const angles = Array.from({ length: 12 }, (_, i) => i * 30);
    const channels: NearbyThing[] = [
      { kind: 'very-near' },
      ...angles.map((angleDeg): NearbyThing => ({ kind: 'direction', distanceM: 130, bearing: 'north', angleDeg })),
    ];
    const lows: NearbyThing[] = [
      { kind: 'inside' },
      { kind: 'very-near' },
      ...angles.map((angleDeg): NearbyThing => ({ kind: 'direction', distanceM: 130, bearing: 'north', angleDeg })),
    ];
    let tallest = 0;
    const problems: string[] = [];
    for (const ground of grounds) {
      for (const channel of [null, ...channels]) {
        for (const low of [null, ...lows]) {
          const result = check(ground, channel === null && low === null ? null : { channel, low });
          problems.push(...result.problems);
          tallest = Math.max(tallest, result.figure.drawingBottom);
        }
      }
    }
    expect(problems).toEqual([]);
    // Growing is allowed, but not without limit: two extra label heights at most.
    expect(tallest).toBeLessThanOrEqual(138 + 2 * 25);
  });
});
