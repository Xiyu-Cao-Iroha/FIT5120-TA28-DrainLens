/**
 * Which heights and which contour the ground height guide points at.
 *
 * Fixtures for the rules -- ties, a pair too close in height or in colour, a
 * contour too short or doubled back, a tile that fails -- and one smoke test
 * against the published files for the homepage's example address, read the
 * way the browser reads them.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { type PackedIndex, unpack } from '../address/search.js';
import type { ContourLine } from '../map/terrainMarks.js';
import type { TerrainTileIndex } from '../map/terrainTiles.js';
import { type Local, type Viewport, focus, toScreen } from '../map/viewport.js';
import {
  GROUND_RADIUS_M,
  type GuideSpot,
  MARK_MARGIN_PX,
  MIN_CONTOUR_ALONG_M,
  MIN_MARKER_APART_M,
  chooseContour,
  choosePair,
  chooseSpot,
  chooseTerrainPoints,
  guideKeepOut,
  higherLetter,
  intoMapFrame,
  loadGroundMarks,
  rampSteps,
  tilesNear,
  viewTest,
} from './terrainPoints.js';

const spot = (id: string, at: Local, heightM: number): GuideSpot => ({ id, at, heightM });
const everywhere = () => true;
const line = (m: number, c: readonly Local[], major = false): ContourLine => ({ m, major, c });
const dist = (p: Local, q: Local) => Math.hypot(p[0] - q[0], p[1] - q[1]);

describe('the legend scale', () => {
  it('counts a metre as a step up to 5 m and less above it', () => {
    expect(rampSteps(-2)).toBe(0);
    expect(rampSteps(0)).toBe(0);
    expect(rampSteps(2.5)).toBeCloseTo(2.5);
    expect(rampSteps(7.5)).toBeCloseTo(5.5);
    expect(rampSteps(40)).toBe(8);
    expect(rampSteps(99)).toBe(8);
  });
});

describe('which letter is higher', () => {
  it('is fixed for an address and is not always the same letter', () => {
    expect(higherLetter('kensington/46-gatehouse-drive-kensington')).toBe(
      higherLetter('kensington/46-gatehouse-drive-kensington'),
    );
    const letters = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(higherLetter));
    expect(letters).toEqual(new Set(['A', 'B']));
  });
});

describe('step 3, two spots to compare', () => {
  const low = spot('low', [50, 0], 2);
  const high = spot('high', [-50, 0], 3);

  it('puts the higher one on the letter the address decides', () => {
    for (const id of ['a', 'b', 'c', 'd']) {
      const pair = choosePair([low, high], [0, 0], everywhere, id);
      expect(pair?.higher).toBe(higherLetter(id));
      const [up, down] = pair?.higher === 'A' ? [pair.a, pair.b] : [pair?.b, pair?.a];
      expect(up?.id).toBe('high');
      expect(down?.id).toBe('low');
    }
  });

  it('refuses heights less than a metre apart', () => {
    expect(choosePair([low, spot('x', [-50, 0], 2.5)], [0, 0], everywhere, 'a')).toBeNull();
  });

  it('refuses a metre the colour bar cannot show', () => {
    // 12 m and 13.5 m are a tenth of a legend step apart.
    expect(choosePair([spot('p', [50, 0], 12), spot('q', [-50, 0], 13.5)], [0, 0], everywhere, 'a')).toBeNull();
  });

  it('refuses markers that would sit on each other', () => {
    const near = spot('near', [50 + MIN_MARKER_APART_M - 1, 0], 4);
    expect(choosePair([low, near], [0, 0], everywhere, 'a')).toBeNull();
  });

  it('takes only spots in view', () => {
    expect(choosePair([low, high], [0, 0], ([e]) => e > 0, 'a')).toBeNull();
  });

  it('prefers the pair nearest the address, and is stable on a tie', () => {
    const far = spot('far', [300, 0], 5);
    const pair = choosePair([far, low, high], [0, 0], everywhere, 'a');
    expect(new Set([pair?.a.id, pair?.b.id])).toEqual(new Set(['low', 'high']));
    // Two equally good pairs: the one with the earlier id wins, whatever the input order.
    const twin = spot('alt', [0, 50], 3);
    const one = choosePair([low, high, twin], [0, 0], everywhere, 'a');
    const two = choosePair([twin, high, low], [0, 0], everywhere, 'a');
    expect(one).toEqual(two);
    expect(new Set([one?.a.id, one?.b.id])).toEqual(new Set(['low', 'alt']));
  });
});

describe('steps 4 and 5, a height near the address', () => {
  it('takes the nearest spot and a comparison a metre away', () => {
    const chosen = chooseSpot(
      [spot('here', [5, 0], 3), spot('same', [60, 0], 3.5), spot('other', [0, 80], 1.5)],
      [0, 0],
      everywhere,
    );
    expect(chosen?.here.id).toBe('here');
    expect(chosen?.other?.id).toBe('other');
  });

  it('keeps the height and names no comparison when none differs enough', () => {
    const chosen = chooseSpot([spot('here', [5, 0], 3), spot('same', [60, 0], 3.5)], [0, 0], everywhere);
    expect(chosen?.here.id).toBe('here');
    expect(chosen?.other).toBeNull();
  });

  it('says nothing when no spot is in view', () => {
    expect(chooseSpot([spot('here', [5, 0], 3)], [0, 0], () => false)).toBeNull();
  });
});

describe('step 6, one contour', () => {
  const straight = line(3, [[-100, 20], [-50, 20], [0, 20], [50, 20], [100, 20]]);

  it('puts A and B on the line, apart along it, centred on the run', () => {
    const pick = chooseContour([straight], [0, 0], everywhere);
    expect(pick?.m).toBe(3);
    expect(pick?.alongM).toBe(140);
    expect(pick?.a).toEqual([-70, 20]);
    expect(pick?.b).toEqual([70, 20]);
    expect(pick?.labelAt).toEqual([0, 20]);
  });

  it('uses the whole run when it is shorter than the cap', () => {
    const short = line(2, [[0, 10], [40, 10], [80, 10]]);
    const pick = chooseContour([short], [0, 0], everywhere);
    expect(pick?.alongM).toBe(80);
    expect(pick?.a).toEqual([0, 10]);
    expect(pick?.b).toEqual([80, 10]);
  });

  it('refuses a run shorter than the minimum', () => {
    const stub = line(2, [[0, 10], [MIN_CONTOUR_ALONG_M - 1, 10]]);
    expect(chooseContour([stub], [0, 0], everywhere)).toBeNull();
  });

  it('refuses a line that doubles back on itself', () => {
    const hairpin = line(2, [[0, 0], [60, 0], [0, 1]]);
    expect(chooseContour([hairpin], [0, 0], everywhere)).toBeNull();
  });

  it('measures only the part in view', () => {
    // Long, but only two short pieces of it are on screen.
    const broken = line(4, [[0, 0], [30, 0], [60, 0], [90, 0], [120, 0]]);
    expect(chooseContour([broken], [0, 0], ([e]) => e !== 60)).toBeNull();
  });

  it('takes the nearest line, ties by height', () => {
    const far = line(1, [[-100, 90], [100, 90]]);
    const near = line(5, [[-100, 10], [100, 10]], true);
    const alsoNear = line(4, [[-100, -10], [100, -10]]);
    expect(chooseContour([far, near], [0, 0], everywhere)?.m).toBe(5);
    expect(chooseContour([near, alsoNear, far], [0, 0], everywhere)?.m).toBe(4);
  });

  it('says nothing for a line with one vertex in view', () => {
    expect(chooseContour([line(1, [[0, 0]])], [0, 0], everywhere)).toBeNull();
  });
});

describe('where a marker may stand', () => {
  const view: Viewport = { widthPx: 760, heightPx: 540, scale: 2, centre: [500, 500] };

  it('keeps inside the margin and out of every box', () => {
    const test = viewTest(view, MARK_MARGIN_PX, guideKeepOut(view));
    expect(test([500, 500])).toBe(true);
    // 5 px from the left edge.
    expect(test([500 - (380 - 5) / 2, 500])).toBe(false);
    // Under the legend, top right.
    expect(test([500 + 300 / 2, 500 + 150 / 2])).toBe(false);
    // Under the Layers panel, top left.
    expect(test([500 - 250 / 2, 500 + 150 / 2])).toBe(false);
    // Under the zoom buttons, bottom right.
    expect(test([500 + 340 / 2, 500 - 230 / 2])).toBe(false);
    // Bottom left is clear.
    expect(test([500 - 300 / 2, 500 - 200 / 2])).toBe(true);
  });
});

describe('reading the tiles', () => {
  const index: TerrainTileIndex = {
    artefact: 'terrain-tiles',
    extent: { min_e: 1000, min_n: 2000, width_m: 1000, height_m: 1000 },
    tileGrid: { sizeM: 500 },
    tiles: [
      { tile: 'T00', tx: 0, ty: 0, e: 0, n: 0 },
      { tile: 'T10', tx: 1, ty: 0, e: 500, n: 0 },
      { tile: 'T01', tx: 0, ty: 1, e: 0, n: 500 },
    ],
    overview: { colour: 'c.webp', shade: 's.webp', cellM: 4, width: 250, height: 250 },
  };

  it('picks the tiles whose square comes near the point', () => {
    expect(tilesNear(index, [100, 100], 50)).toEqual(['T00']);
    expect(tilesNear(index, [480, 100], 50)).toEqual(['T00', 'T10']);
    expect(tilesNear(index, [480, 480], 50)).toEqual(['T00', 'T10', 'T01']);
  });

  it('moves spots and contours into the map frame, once each', () => {
    const marks = intoMapFrame(
      [
        {
          unitM: 0.5,
          spots: [{ id: 's1', tier: 'a', e: 10, n: 20, heightM: 2.5, priority: 1 }],
          contours: [{ m: 3, major: false, d: [20, 40, 2, 0] }],
        },
        // The same spot again from a neighbour's margin, and one with no height.
        {
          spots: [
            { id: 's1', tier: 'a', e: 10, n: 20, heightM: 2.5, priority: 1 },
            { id: 's2', tier: 'a', e: 0, n: 0, heightM: Number.NaN, priority: 1 },
          ],
        },
      ],
      [-5, 100],
    );
    expect(marks.spots).toEqual([{ id: 's1', at: [5, 120], heightM: 2.5 }]);
    expect(marks.contours).toEqual([{ m: 3, major: false, c: [[5, 120], [6, 120]] }]);
  });

  it('loads the tiles near an address and survives one that fails', async () => {
    const asked: string[] = [];
    const json = (url: string): Promise<unknown> => {
      asked.push(url);
      if (url === 'base/index.json') return Promise.resolve(index);
      if (url === 'base/T10/marks.json') return Promise.reject(new Error('gone'));
      return Promise.resolve({
        spots: [{ id: url, tier: 'a', e: 100, n: 100, heightM: 1, priority: 1 }],
      });
    };
    // The map's corner is the index's plus (100, 0), so a map point is 100 m further west in the index.
    const marks = await loadGroundMarks('base', [380, 100], { min_e: 1100, min_n: 2000 }, json, 50);
    expect(asked).toEqual(['base/index.json', 'base/T00/marks.json', 'base/T10/marks.json']);
    expect(marks.spots).toEqual([{ id: 'base/T00/marks.json', at: [0, 100], heightM: 1 }]);
  });

  it('refuses an index that is not one', async () => {
    await expect(loadGroundMarks('base', [0, 0], {}, () => Promise.resolve({}))).rejects.toThrow();
  });
});

describe('against the published files', () => {
  const PUBLIC = path.resolve(__dirname, '../../public/data');
  const read = (name: string): unknown => JSON.parse(readFileSync(path.join(PUBLIC, name), 'utf8')) as unknown;
  const map = read('map.json') as {
    extent: { min_e: number; min_n: number; width_m: number; height_m: number };
  };
  const index = unpack(read('addresses.json') as PackedIndex, map.extent);
  const address = index.addresses.find((a) => a.label === '46 Gatehouse Drive, Kensington');
  const at: Local = [address?.e ?? 0, address?.n ?? 0];

  /*
    The view the guide opens on for this address on the Kensington fallback:
    the 760 x 540 frame at 300 m across, centred and clamped as `MapCanvas`
    does it.
  */
  const opening = focus(760, 540, { widthM: map.extent.width_m, heightM: map.extent.height_m }, at, 760 / 300);
  const inView = viewTest(opening, MARK_MARGIN_PX, guideKeepOut(opening));

  it('finds a pair, a height and a contour near 46 Gatehouse Drive, all on screen', async () => {
    expect(address).toBeDefined();
    const ground = await loadGroundMarks(
      '',
      at,
      map.extent,
      (url) => Promise.resolve(read(`terrain-tiles${url}`)),
      GROUND_RADIUS_M,
    );
    expect(ground.spots.length).toBeGreaterThan(20);
    expect(ground.contours.length).toBeGreaterThan(20);

    const points = chooseTerrainPoints(ground, at, inView, address?.id ?? '');
    const onScreen = (p: Local) => {
      const [x, y] = toScreen(opening, p);
      return x > 0 && y > 0 && x < 760 && y < 540;
    };

    // Step 3: two real spots a metre or more apart, both on screen and apart.
    const pair = points.pair;
    expect(pair).not.toBeNull();
    expect(Math.abs((pair?.a.heightM ?? 0) - (pair?.b.heightM ?? 0))).toBeGreaterThanOrEqual(1);
    expect(onScreen(pair!.a.at) && onScreen(pair!.b.at)).toBe(true);
    expect(dist(pair!.a.at, pair!.b.at)).toBeGreaterThanOrEqual(MIN_MARKER_APART_M);
    const higher = pair!.higher === 'A' ? pair!.a : pair!.b;
    const lower = pair!.higher === 'A' ? pair!.b : pair!.a;
    expect(higher.heightM).toBeGreaterThan(lower.heightM);

    // Steps 4 and 5: the nearest spot, and a comparison.
    expect(points.spot).not.toBeNull();
    expect(dist(points.spot!.here.at, at)).toBeLessThan(100);
    expect(points.spot?.other).not.toBeNull();

    // Step 6: a real contour, A and B on it, both on screen.
    const contour = points.contour;
    expect(contour).not.toBeNull();
    expect(onScreen(contour!.a) && onScreen(contour!.b)).toBe(true);
    expect(contour!.alongM).toBeGreaterThanOrEqual(MIN_CONTOUR_ALONG_M);
    const original = ground.contours.find((c) => c.m === contour!.m && c.c.includes(contour!.line[0]!));
    expect(original).toBeDefined();

    // Written down, so a change to the data or the rules shows up here.
    expect({
      pair: [pair!.a.id, pair!.a.heightM, pair!.b.id, pair!.b.heightM, pair!.higher],
      here: [points.spot!.here.id, points.spot!.here.heightM, points.spot!.other?.heightM],
      contour: [contour!.m, Math.round(contour!.alongM), Math.round(dist(contour!.a, contour!.b))],
    }).toMatchInlineSnapshot(`
      {
        "contour": [
          3,
          127,
          60,
        ],
        "here": [
          "sp-023-029-c",
          3,
          2,
        ],
        "pair": [
          "sp-023-029-a",
          2,
          "sp-023-029-c",
          3,
          "B",
        ],
      }
    `);
  });
});
