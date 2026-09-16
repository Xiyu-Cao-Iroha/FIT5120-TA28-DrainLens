/**
 * Which real heights and which real contour the ground height guide points at.
 *
 * The design (Figma Terrain Tutorial, 16 September) was drawn over a picture
 * with two markers and an ellipse in it. The guide is the real map, so the
 * markers have to stand on real ground: **every height the guide names is a
 * spot height from the published tiles, and every line it highlights is one of
 * their contours.** Where the data near an address cannot support a part, that
 * part is null and the guide says less rather than making a height up.
 *
 * **The frame, checked against the files rather than assumed.** A tile's
 * `marks.json` is in the terrain index's frame -- metres from the council
 * extent's south-west corner -- and not in the tile's own: `Tile_+005_+003`
 * sits at (500, 0) and its contours start at e = 500.0 to 962.5. That is why
 * `terrainMarks.ts` `projector` adds only the offset between the index and the
 * map, and never the tile's corner, and it is what `intoMapFrame` does here.
 * On the Kensington fallback that offset is (-1500, -6000).
 *
 * Everything is chosen once, against the view the guide opens on, so a marker
 * does not jump because somebody dragged the map.
 */

import { RAMP } from '../map/terrain.js';
import type { ContourLine, SpotHeight } from '../map/terrainMarks.js';
import {
  type EncodedContour,
  type TerrainTileIndex,
  assertTerrainTileIndex,
  decodeContour,
  offsetInto,
} from '../map/terrainTiles.js';
import { type Local, type Viewport, toScreen } from '../map/viewport.js';

/** A spot height, moved into the map's frame. */
export interface GuideSpot {
  readonly id: string;
  readonly at: Local;
  /** Metres AHD, to the nearest half metre, as the tile publishes it. */
  readonly heightM: number;
}

/** The spots and contours near an address, in the map's frame. */
export interface GroundMarks {
  readonly spots: readonly GuideSpot[];
  readonly contours: readonly ContourLine[];
}

export type Letter = 'A' | 'B';

export interface HeightPair {
  readonly a: GuideSpot;
  readonly b: GuideSpot;
  /** Which marker is on higher ground. */
  readonly higher: Letter;
}

export interface HeightSpot {
  /** The spot nearest the address. */
  readonly here: GuideSpot;
  /** A spot at least a metre higher or lower, to compare with, or null. */
  readonly other: GuideSpot | null;
}

export interface ContourPick {
  /** Metres AHD. */
  readonly m: number;
  readonly major: boolean;
  readonly line: readonly Local[];
  readonly a: Local;
  readonly b: Local;
  readonly labelAt: Local;
  /** Along the line, from A to B. */
  readonly alongM: number;
}

export interface TerrainPoints {
  readonly pair: HeightPair | null;
  readonly spot: HeightSpot | null;
  readonly contour: ContourPick | null;
}

/** Step 3's two spots must differ by at least this much. */
export const MIN_PAIR_DIFFERENCE_M = 1;

/**
 * And by at least one step of the legend's scale.
 *
 * The ramp's nodes are a metre apart up to 5 m and then 5, 10 and 20 m apart.
 * A metre between 12 and 13 m is a tenth of a step, the same colour to the
 * eye, and a question that asks which is more orange would have no visible
 * answer.
 */
export const MIN_PAIR_RAMP_STEPS = 1;

/** Markers closer than this overlap on screen at the guide's scale. */
export const MIN_MARKER_APART_M = 40;

/** Step 6's A and B, at least this far apart along the line. */
export const MIN_CONTOUR_ALONG_M = 60;

/** And no further than this, so both sit near the address. */
export const MAX_CONTOUR_ALONG_M = 140;

/** A and B also this far apart in a straight line, so a line that doubles back does not stack them. */
export const MIN_CONTOUR_APART_M = 45;

/** Tiles are loaded whose square comes within this of the address. */
export const GROUND_RADIUS_M = 250;

const distance = (p: Local, q: Local): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

/**
 * Where a height sits on the legend's evenly spaced scale, in steps.
 *
 * The legend spaces the ramp's nodes evenly (`RAMP_GRADIENT`), so this is the
 * distance a reader sees between two heights on the colour bar.
 */
export function rampSteps(metres: number): number {
  const first = RAMP[0]!;
  const last = RAMP[RAMP.length - 1]!;
  if (!(metres > first.metres)) return 0;
  if (metres >= last.metres) return RAMP.length - 1;
  let upper = 1;
  while (RAMP[upper]!.metres < metres) upper += 1;
  const lo = RAMP[upper - 1]!;
  const hi = RAMP[upper]!;
  return upper - 1 + (metres - lo.metres) / (hi.metres - lo.metres);
}

/**
 * Which letter goes on the higher spot, from the address.
 *
 * Deterministic, so a reader who comes back sees the same question, and not
 * always B, so the answer is not the second button every time. A small FNV-1a
 * over the id: nothing here needs more than a coin that does not change.
 */
export function higherLetter(addressId: string): Letter {
  let hash = 0x811c9dc5;
  for (let i = 0; i < addressId.length; i += 1) {
    hash ^= addressId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 2 === 0 ? 'A' : 'B';
}

const byNearest = (address: Local) => (p: GuideSpot, q: GuideSpot) =>
  distance(p.at, address) - distance(q.at, address) || p.id.localeCompare(q.id);

/**
 * Step 3: two spots in view whose heights differ clearly, nearest the address.
 *
 * Nearest by the sum of both distances, ties by id. The lower of the two is
 * A or B by `higherLetter`.
 */
export function choosePair(
  spots: readonly GuideSpot[],
  address: Local,
  inView: (point: Local) => boolean,
  addressId: string,
): HeightPair | null {
  const seen = spots.filter((s) => inView(s.at)).sort(byNearest(address));
  let best: { low: GuideSpot; high: GuideSpot; score: number } | null = null;
  for (let i = 0; i < seen.length; i += 1) {
    for (let j = i + 1; j < seen.length; j += 1) {
      const p = seen[i]!;
      const q = seen[j]!;
      if (Math.abs(p.heightM - q.heightM) < MIN_PAIR_DIFFERENCE_M) continue;
      if (Math.abs(rampSteps(p.heightM) - rampSteps(q.heightM)) < MIN_PAIR_RAMP_STEPS) continue;
      if (distance(p.at, q.at) < MIN_MARKER_APART_M) continue;
      const score = distance(p.at, address) + distance(q.at, address);
      // Strictly less, over a list sorted nearest first: ties keep the earlier pair.
      if (best === null || score < best.score) {
        const [low, high] = p.heightM < q.heightM ? [p, q] : [q, p];
        best = { low, high, score };
      }
    }
  }
  if (best === null) return null;
  const higher = higherLetter(addressId);
  return higher === 'A'
    ? { a: best.high, b: best.low, higher }
    : { a: best.low, b: best.high, higher };
}

/**
 * Steps 4 and 5: the spot nearest the address, and one to compare it with.
 *
 * The comparison is the nearest other spot at least a metre away in height
 * and far enough away that the two markers do not overlap. Either direction:
 * the step says *higher* or *lower* by which it is.
 */
export function chooseSpot(
  spots: readonly GuideSpot[],
  address: Local,
  inView: (point: Local) => boolean,
): HeightSpot | null {
  const seen = spots.filter((s) => inView(s.at)).sort(byNearest(address));
  const here = seen[0];
  if (here === undefined) return null;
  const other =
    seen.find(
      (s) =>
        Math.abs(s.heightM - here.heightM) >= MIN_PAIR_DIFFERENCE_M &&
        distance(s.at, here.at) >= MIN_MARKER_APART_M,
    ) ?? null;
  return { here, other };
}

/** The point `along` metres down a polyline whose cumulative lengths are `sums`. */
function pointAlong(points: readonly Local[], sums: readonly number[], along: number): Local {
  let i = 1;
  while (i < points.length - 1 && sums[i]! < along) i += 1;
  const p = points[i - 1]!;
  const q = points[i]!;
  const span = sums[i]! - sums[i - 1]!;
  const t = span > 0 ? Math.min(Math.max((along - sums[i - 1]!) / span, 0), 1) : 0;
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}

/**
 * Step 6: one contour near the address, with A and B on it.
 *
 * For each line, the longest run of consecutive vertices inside the view.
 * A run at least `MIN_CONTOUR_ALONG_M` long gets A and B centred on it, up to
 * `MAX_CONTOUR_ALONG_M` apart along the line, and is kept if they are also
 * `MIN_CONTOUR_APART_M` apart in a straight line. Of those, the line whose run
 * comes nearest the address; ties by height, then by order.
 */
export function chooseContour(
  contours: readonly ContourLine[],
  address: Local,
  inView: (point: Local) => boolean,
): ContourPick | null {
  let best: { pick: ContourPick; near: number } | null = null;
  for (const line of contours) {
    let bestRun: readonly Local[] = [];
    let run: Local[] = [];
    const close = () => {
      if (run.length > bestRun.length) bestRun = run;
      run = [];
    };
    for (const point of line.c) {
      if (inView(point)) run.push(point);
      else close();
    }
    close();
    if (bestRun.length < 2) continue;

    const sums = [0];
    for (let i = 1; i < bestRun.length; i += 1) {
      sums.push(sums[i - 1]! + distance(bestRun[i - 1]!, bestRun[i]!));
    }
    const length = sums[sums.length - 1]!;
    if (length < MIN_CONTOUR_ALONG_M) continue;
    const span = Math.min(length, MAX_CONTOUR_ALONG_M);
    const start = (length - span) / 2;
    const a = pointAlong(bestRun, sums, start);
    const b = pointAlong(bestRun, sums, start + span);
    if (distance(a, b) < MIN_CONTOUR_APART_M) continue;

    const near = Math.min(...bestRun.map((p) => distance(p, address)));
    if (best === null || near < best.near || (near === best.near && line.m < best.pick.m)) {
      best = {
        near,
        pick: {
          m: line.m,
          major: line.major,
          line: bestRun,
          a,
          b,
          labelAt: pointAlong(bestRun, sums, start + span / 2),
          alongM: span,
        },
      };
    }
  }
  return best?.pick ?? null;
}

/** All three, for one address and one opening view. */
export function chooseTerrainPoints(
  ground: GroundMarks,
  address: Local,
  inView: (point: Local) => boolean,
  addressId: string,
): TerrainPoints {
  return {
    pair: choosePair(ground.spots, address, inView, addressId),
    spot: chooseSpot(ground.spots, address, inView),
    contour: chooseContour(ground.contours, address, inView),
  };
}

/** A rectangle of the canvas, in pixels, that a marker must stay out of. */
export interface ScreenBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * "Can a marker go here", for the view the guide opens on.
 *
 * Inside the canvas by `margin`, and outside every box in `keepOut`: the
 * legend, the Layers panel, the zoom buttons. A marker under the legend is a
 * marker the reader is asked about and cannot see.
 */
export function viewTest(
  viewport: Viewport,
  margin: number,
  keepOut: readonly ScreenBox[],
): (point: Local) => boolean {
  return (point) => {
    const [x, y] = toScreen(viewport, point);
    if (x < margin || y < margin || x > viewport.widthPx - margin || y > viewport.heightPx - margin) {
      return false;
    }
    return !keepOut.some((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
  };
}

/** Pixels kept clear of the frame's edge when choosing where a marker may stand. */
export const MARK_MARGIN_PX = 30;

/**
 * The parts of the ground height guide's map a marker must not be chosen under.
 *
 * Measured on the guide's 760 x 540 frame at a 1400 x 850 window: the Layers
 * button and its open panel at the top left, the legend with the ground-height
 * scale at the top right, and the scale bar, recentre and zoom buttons at the
 * bottom right. Plus a band along the top, because a lettered marker's bubble
 * stands 43 pixels above its point.
 */
export function guideKeepOut(viewport: Viewport): readonly ScreenBox[] {
  const { widthPx: w, heightPx: h } = viewport;
  return [
    { left: 0, top: 0, right: w, bottom: 60 },
    { left: 0, top: 0, right: 330, bottom: 205 },
    { left: w - 300, top: 0, right: w, bottom: 225 },
    { left: w - 150, top: h - 175, right: w, bottom: h },
  ];
}

/** One tile's marks as published, before decoding. */
interface PublishedMarks {
  readonly unitM?: number;
  readonly contours?: readonly EncodedContour[];
  readonly spots?: readonly SpotHeight[];
}

/**
 * Decoded tiles, moved from the index's frame into the map's.
 *
 * Spots are deduplicated by id: tiles carry a margin, so a spot near an edge
 * can be published by both tiles it is near.
 */
export function intoMapFrame(
  tiles: readonly PublishedMarks[],
  offset: readonly [number, number],
): GroundMarks {
  const spots = new Map<string, GuideSpot>();
  const contours: ContourLine[] = [];
  const [dx, dy] = offset;
  for (const tile of tiles) {
    const unit = tile.unitM ?? 0.5;
    for (const spot of tile.spots ?? []) {
      if (!Number.isFinite(spot.heightM) || spots.has(spot.id)) continue;
      spots.set(spot.id, { id: spot.id, at: [spot.e + dx, spot.n + dy], heightM: spot.heightM });
    }
    for (const encoded of tile.contours ?? []) {
      const line = decodeContour(encoded, unit);
      contours.push({ ...line, c: line.c.map(([e, n]) => [e + dx, n + dy] as const) });
    }
  }
  return { spots: [...spots.values()], contours };
}

/** The tiles whose square comes within `radiusM` of a point in the index's frame. */
export function tilesNear(index: TerrainTileIndex, at: Local, radiusM: number): readonly string[] {
  const size = index.tileGrid.sizeM;
  return index.tiles
    .filter(
      (tile) =>
        at[0] >= tile.e - radiusM &&
        at[0] <= tile.e + size + radiusM &&
        at[1] >= tile.n - radiusM &&
        at[1] <= tile.n + size + radiusM,
    )
    .map((tile) => tile.tile);
}

/**
 * Fetch the marks near an address, for the guide.
 *
 * Only `marks.json`: the images are the map's business, and it loads them
 * itself. A tile that fails is left out rather than failing the lot; the
 * choice then works with what arrived, and says less if that is not enough.
 */
export async function loadGroundMarks(
  base: string,
  address: Local,
  map: { readonly min_e?: number; readonly min_n?: number },
  json: (url: string) => Promise<unknown>,
  radiusM: number = GROUND_RADIUS_M,
): Promise<GroundMarks> {
  const index = await json(`${base}/index.json`);
  assertTerrainTileIndex(index);
  const offset = offsetInto(index.extent, map);
  const inIndex: Local = [address[0] - offset[0], address[1] - offset[1]];
  const names = tilesNear(index, inIndex, radiusM);
  const tiles = await Promise.all(
    names.map((name) =>
      json(`${base}/${name}/marks.json`).then(
        (marks) => marks as PublishedMarks,
        () => ({}) as PublishedMarks,
      ),
    ),
  );
  return intoMapFrame(tiles, offset);
}
