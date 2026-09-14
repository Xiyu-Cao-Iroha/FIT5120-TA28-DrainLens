/**
 * Suburb names: where they are, when they show, and which give way.
 *
 * The rules are checked on small fixtures. The positions are checked against
 * the published artefacts they were measured from, because a suburb name in
 * the wrong suburb is the one mistake here that looks exactly like a map
 * working — and a fixture cannot notice it.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { MapArtefact } from './artefact.js';
import { LABEL_MIN_SCALE, PIT_MIN_SCALE } from './draw.js';
import {
  PLACES,
  PLACE_FULL_SCALE,
  PLACE_HIDDEN_SCALE,
  type PlaceCandidate,
  placeNames,
  placeOpacity,
  placesIn,
  tracked,
} from './places.js';
import { LOCAL_SCALE, fit, fitWithin, toScreen } from './viewport.js';
import { type PointsArtefact, decodeRing } from '../history/severity.js';

const COUNCIL = { min_e: 315000, min_n: 5808500, width_m: 8500, height_m: 9000 };
const KENSINGTON = { min_e: 316500, min_n: 5814500, width_m: 1000, height_m: 1000 };

describe('which places are on this map', () => {
  it('puts every anchor inside the council extent', () => {
    expect(placesIn(COUNCIL).map((p) => p.place.name)).toEqual(PLACES.map((p) => p.name));
  });

  it('names only Kensington on the bundled Kensington square kilometre', () => {
    // The fallback when the database is down. Anything else here would be a
    // neighbouring suburb's name written over Kensington's streets.
    expect(placesIn(KENSINGTON).map((p) => p.place.name)).toEqual(['Kensington']);
  });

  it('names nothing on an extent that holds none of them', () => {
    expect(placesIn({ min_e: 330000, min_n: 5800000, width_m: 1000, height_m: 1000 })).toEqual([]);
  });

  it("shifts each anchor by the loaded extent's own corner", () => {
    const [kensington] = placesIn(KENSINGTON);
    const inCouncil = placesIn(COUNCIL).find((p) => p.place.name === 'Kensington');
    // The two frames differ by the corners' offset, 1,500 m east and 6,000 m
    // north, and by nothing else.
    expect(inCouncil!.at[0] - kensington!.at[0]).toBe(1500);
    expect(inCouncil!.at[1] - kensington!.at[1]).toBe(6000);
  });

  it('keeps the edge of the extent inside it', () => {
    const edge = [{ ...PLACES[0]!, e: COUNCIL.min_e + COUNCIL.width_m, n: COUNCIL.min_n }];
    expect(placesIn(COUNCIL, edge)).toHaveLength(1);
    expect(placesIn(COUNCIL, [{ ...edge[0]!, e: edge[0]!.e + 1 }])).toHaveLength(0);
  });

  it('names each place once and ranks each one differently', () => {
    expect(new Set(PLACES.map((p) => p.name)).size).toBe(PLACES.length);
    expect(new Set(PLACES.map((p) => p.rank)).size).toBe(PLACES.length);
  });
});

describe('when the names show', () => {
  it('is fully drawn at the council overview, on a laptop and on a phone', () => {
    const bounds = { widthM: COUNCIL.width_m, heightM: COUNCIL.height_m };
    for (const [w, h] of [[1080, 775], [375, 700]] as const) {
      expect(placeOpacity(fit(w, h, bounds).scale)).toBe(1);
      expect(placeOpacity(fitWithin(w, h, bounds).scale)).toBe(1);
    }
  });

  it('starts to fade where pits start to be drawn', () => {
    expect(PLACE_FULL_SCALE).toBe(PIT_MIN_SCALE);
    expect(placeOpacity(PLACE_FULL_SCALE)).toBe(1);
    expect(placeOpacity(PLACE_FULL_SCALE + 0.01)).toBeLessThan(1);
  });

  it('is on its way out when street names arrive, and gone soon after', () => {
    expect(placeOpacity(LABEL_MIN_SCALE)).toBeLessThan(0.5);
    expect(PLACE_HIDDEN_SCALE).toBeGreaterThan(LABEL_MIN_SCALE);
    expect(placeOpacity(PLACE_HIDDEN_SCALE)).toBe(0);
    expect(placeOpacity(1)).toBe(0);
  });

  it('never shows on the guide map, which opens at street scale', () => {
    expect(placeOpacity(LOCAL_SCALE)).toBe(0);
    // The guide's frame: 300 m across even a narrow 280 px panel.
    expect(placeOpacity(280 / 300)).toBe(0);
  });

  it('fades steadily rather than jumping', () => {
    let last = 1;
    for (let scale = PLACE_FULL_SCALE; scale <= PLACE_HIDDEN_SCALE; scale += 0.01) {
      const now = placeOpacity(scale);
      expect(now).toBeLessThanOrEqual(last);
      expect(last - now).toBeLessThan(0.05);
      last = now;
    }
  });
});

describe('how a name is set', () => {
  it('is capitals, letter-spaced with thin spaces', () => {
    const thin = String.fromCodePoint(0x2009);
    expect(tracked('Carlton')).toBe(['C', 'A', 'R', 'L', 'T', 'O', 'N'].join(thin));
    expect(tracked('South Wharf').replaceAll(thin, '')).toBe('SOUTH WHARF');
  });
});

describe('which names give way', () => {
  const screen = { widthPx: 1000, heightPx: 800 };
  const name = (text: string, x: number, y: number, rank: number, widthPx = 100): PlaceCandidate => ({
    text,
    x,
    y,
    widthPx,
    rank,
  });

  it('keeps names that are apart', () => {
    const placed = placeNames([name('A', 200, 200, 1), name('B', 600, 600, 2)], screen);
    expect(placed.map((p) => p.text)).toEqual(['A', 'B']);
  });

  it('drops the lower-ranked of two that collide, whichever comes first', () => {
    const higher = name('CBD', 500, 400, 1);
    const lower = name('Southbank', 540, 405, 5);
    expect(placeNames([lower, higher], screen).map((p) => p.text)).toEqual(['CBD']);
    expect(placeNames([higher, lower], screen).map((p) => p.text)).toEqual(['CBD']);
  });

  it('keeps clear space between names, so two never read as one', () => {
    // Boxes 100 wide centred 104 apart: four pixels of gap, less than padding.
    const placed = placeNames([name('Docklands', 300, 300, 1), name('South Wharf', 404, 300, 2)], screen);
    expect(placed).toHaveLength(1);
  });

  it('lets a name that is off the canvas claim no space', () => {
    const offCanvas = name('Off', -200, 400, 1);
    const onCanvas = name('On', 30, 400, 2);
    expect(placeNames([offCanvas, onCanvas], screen).map((p) => p.text)).toEqual(['On']);
  });

  it('keeps a name that is only partly on the canvas', () => {
    expect(placeNames([name('Edge', -20, 400, 1)], screen)).toHaveLength(1);
  });

  it('drops none of the fourteen at the council opening view on a laptop', () => {
    // Widths are measured by the canvas at run time. This allows eight pixels
    // a capital and two and a half a thin space, which is wider than 11 px
    // system-ui bold sets them, so it errs towards collisions.
    const view = fit(1080, 775, { widthM: COUNCIL.width_m, heightM: COUNCIL.height_m });
    const tall = { ...view, heightPx: 9000 * view.scale, centre: [4250, 4500] as const };
    const candidates = placesIn(COUNCIL).map(({ place, at }) => {
      const [x, y] = toScreen(tall, at);
      return name(place.name, x, y, place.rank, place.name.length * 8 + (place.name.length - 1) * 2.5);
    });
    expect(placeNames(candidates, tall)).toHaveLength(PLACES.length);
  });
});

/*
  The positions, against the artefacts they were measured from.
*/

const DATA = path.resolve(__dirname, '../../public/data');
const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

const areas = read<PointsArtefact>(path.join(DATA, 'sa2-points.json'));
const council = read<MapArtefact>(path.resolve(__dirname, '../../../api/data/city-of-melbourne/map.json'));
const bundled = read<MapArtefact>(path.join(DATA, 'map.json'));

/** Ray casting over a decoded ring, in MGA metres. */
function inside(e: number, n: number, ring: Float64Array, origin: { min_e: number; min_n: number }): boolean {
  let hit = false;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
    const ei = ring[i * 2]! + origin.min_e;
    const ni = ring[i * 2 + 1]! + origin.min_n;
    const ej = ring[j * 2]! + origin.min_e;
    const nj = ring[j * 2 + 1]! + origin.min_n;
    if (ni > n !== nj > n && e < ((ej - ei) * (n - ni)) / (nj - ni) + ei) hit = !hit;
  }
  return hit;
}

/** The statistical areas this MGA point falls in. Areas do not overlap, so one at most. */
const areasAt = (e: number, n: number): string[] =>
  areas.areas
    .filter((a) => a.rings.map(decodeRing).filter((ring) => inside(e, n, ring, areas.extent)).length % 2 === 1)
    .map((a) => a.name);

/** Metres from an MGA point to the nearest centreline carrying this name. */
function metresToStreet(artefact: MapArtefact, e: number, n: number, street: string): number {
  const px = e - artefact.extent.min_e;
  const py = n - artefact.extent.min_n;
  let best = Infinity;
  for (const feature of artefact.layers['street-name'] ?? []) {
    const label = (feature.maplabel ?? feature.name ?? '').replace(/\s+/g, ' ').trim();
    if (label !== street) continue;
    for (let i = 1; i < feature.c.length; i += 1) {
      const [ax, ay] = feature.c[i - 1]!;
      const [bx, by] = feature.c[i]!;
      const dx = bx - ax;
      const dy = by - ay;
      const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
      best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
  }
  return best;
}

/**
 * Streets that are in each suburb and nowhere near its neighbours, and how
 * far from the anchor each may be.
 *
 * Mostly a few hundred metres. Flemington's anchor is on the racecourse, which
 * is the City of Melbourne's part of Flemington and has Epsom Road as its
 * eastern edge; Port Melbourne's is in Fishermans Bend, whose streets are far
 * apart.
 */
const LANDMARKS: Record<string, readonly (readonly [street: string, withinM: number])[]> = {
  'Melbourne CBD': [['Elizabeth Street', 100], ['Bourke Street', 100]],
  Kensington: [['Bangalore Street', 100], ['The Ridgeway', 100], ['Macaulay Road', 300], ['Epsom Road', 300]],
  Southbank: [['Sturt Street', 100], ['Southbank Boulevard', 250]],
  Docklands: [['Victoria Harbour Promenade', 100], ['Harbour Esplanade', 350]],
  Carlton: [['Lygon Street', 100], ['Grattan Street', 100]],
  'North Melbourne': [['Baillie Street', 100], ['Provost Street', 100]],
  'East Melbourne': [['Wellington Parade', 200], ['Clarendon Street', 200]],
  Parkville: [['Elliott Avenue', 100]],
  'West Melbourne': [['Rosslyn Street', 100], ['Spencer Street', 100], ['Hawke Street', 350]],
  'South Wharf': [['South Wharf Promenade', 100], ['Convention Centre Place', 100]],
  'South Yarra': [['Mason Street', 100], ['Millswyn Street', 100]],
  Flemington: [['Epsom Road', 400], ['Smithfield Road', 400]],
  'Port Melbourne': [['Todd Road', 350], ['Wharf Road', 350], ['Lorimer Street', 500]],
  'Carlton North': [['Garton Street', 250], ['Princes Park Drive', 250]],
};

describe('where each name is written', () => {
  it('reads both artefacts in the same datum as the anchors', () => {
    expect(areas.extent).toMatchObject({ crs: 'EPSG:28355' });
    expect(council.crs).toMatch(/^EPSG:28355/);
    expect(council.extent).toMatchObject(COUNCIL);
  });

  it.each(PLACES.map((p) => [p.name, p] as const))('puts %s inside the ABS area it was taken from', (_, place) => {
    expect(areasAt(place.e, place.n)).toEqual([place.sa2]);
  });

  it.each(Object.entries(LANDMARKS))('puts %s beside streets that are in it', (name, streets) => {
    const place = PLACES.find((p) => p.name === name)!;
    for (const [street, withinM] of streets) {
      expect(metresToStreet(council, place.e, place.n, street), street).toBeLessThanOrEqual(withinM);
    }
  });

  it('has a street check for every place', () => {
    expect(Object.keys(LANDMARKS).sort()).toEqual(PLACES.map((p) => p.name).sort());
  });

  it('puts Kensington beside the same streets on the bundled fallback map', () => {
    const kensington = PLACES.find((p) => p.name === 'Kensington')!;
    expect(metresToStreet(bundled, kensington.e, kensington.n, 'Bangalore Street')).toBeLessThanOrEqual(100);
    expect(metresToStreet(bundled, kensington.e, kensington.n, 'The Ridgeway')).toBeLessThanOrEqual(100);
  });
});
