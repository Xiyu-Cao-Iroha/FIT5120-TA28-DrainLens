/**
 * Contours and spot heights over the terrain — Terrain V1.1 §2.4 and §2.5.
 *
 * The ramp says which ground is higher. These say by how much, in lines and
 * numbers a reader can check, and **the spot heights are the part a reader
 * with red-green colour deficiency relies on**: the ramp's green-to-orange path
 * runs along the axis they separate worst, and a hillshade has no up or down.
 *
 * **Nothing here is chosen from the distribution of what is in view.** The
 * candidates are fixed, with stable ids, on an 80 m grid (`terrain_marks.py`).
 * The map divides the screen into a 3 x 2 grid and takes the highest-priority
 * candidate in each cell, up to five, then resolves collisions on screen. A
 * label never moves because a different part of the ground came into view.
 */

import type { TerrainExtent } from './terrain.js';
import { type Local, type Viewport, toScreen } from './viewport.js';

export class TerrainMarksError extends Error {}

export interface ContourLine {
  /** Metres AHD. */
  readonly m: number;
  /** Every 5 m. */
  readonly major: boolean;
  readonly c: readonly Local[];
}

export interface SpotHeight {
  readonly id: string;
  readonly tier: string;
  readonly e: number;
  readonly n: number;
  /** Rounded to 0.5 m. */
  readonly heightM: number;
  /** Measured share of the surrounding 15 m. */
  readonly priority: number;
}

export interface TerrainMarks {
  readonly contours: readonly ContourLine[];
  readonly spots: readonly SpotHeight[];
  readonly extent: TerrainExtent;
}

/** Below this many pixels per metre, the 1 m lines are drawn no more; the 5 m ones still are. */
export const MINOR_CONTOUR_MIN_SCALE = 1;

export const CONTOUR_STYLE = {
  minor: { colour: 'rgba(118, 126, 112, 0.24)', width: 1 },
  major: { colour: 'rgba(104, 112, 98, 0.69)', width: 2 },
} as const;

export const SPOT_DOT = '#384236';
export const SPOT_TEXT = '#202c22';

export const SPOT_GRID = { cols: 3, rows: 2 } as const;
export const SPOT_MAX = 5;
export const CONTOUR_LABEL_MAX = 2;
export const CONTOUR_LABEL_SPACING_PX = 175;
export const CONTOUR_LABEL_SPOT_CLEARANCE_PX = 46;

function isExtent(value: unknown): value is TerrainExtent {
  const e = value as Partial<TerrainExtent> | null;
  return (
    e !== null &&
    typeof e === 'object' &&
    Number.isFinite(e.min_e) &&
    Number.isFinite(e.min_n) &&
    (e.width_m ?? 0) > 0 &&
    (e.height_m ?? 0) > 0
  );
}

/** Both artefacts, checked, or an error naming what is wrong. */
export async function loadTerrainMarks(
  base: string,
  fetchJson: (url: string) => Promise<unknown> = (url) => fetch(url).then((r) => r.json()),
): Promise<TerrainMarks> {
  const [lines, spots] = (await Promise.all([
    fetchJson(`${base}/terrain-contours.json`),
    fetchJson(`${base}/spot-heights.json`),
  ])) as [
    { artefact?: string; extent?: unknown; lines?: unknown },
    { artefact?: string; extent?: unknown; points?: unknown },
  ];
  if (lines.artefact !== 'terrain-contours' || !Array.isArray(lines.lines)) {
    throw new TerrainMarksError('the contours artefact is not one');
  }
  if (spots.artefact !== 'spot-heights' || !Array.isArray(spots.points)) {
    throw new TerrainMarksError('the spot-heights artefact is not one');
  }
  if (!isExtent(lines.extent) || !isExtent(spots.extent)) {
    throw new TerrainMarksError('the contours or spot heights do not say where they are');
  }
  if (lines.extent.min_e !== spots.extent.min_e || lines.extent.min_n !== spots.extent.min_n) {
    throw new TerrainMarksError('the contours and spot heights are in different frames');
  }
  for (const line of lines.lines as ContourLine[]) {
    if (!Number.isFinite(line.m) || !Array.isArray(line.c) || line.c.length < 2) {
      throw new TerrainMarksError('a contour has no level or fewer than two points');
    }
  }
  for (const spot of spots.points as SpotHeight[]) {
    if (typeof spot.id !== 'string' || !Number.isFinite(spot.e) || !Number.isFinite(spot.n) || !Number.isFinite(spot.heightM)) {
      throw new TerrainMarksError('a spot height has no id, position or height');
    }
  }
  return {
    contours: lines.lines as ContourLine[],
    spots: spots.points as SpotHeight[],
    extent: lines.extent,
  };
}

/** Terrain metres to screen pixels, through the offset into the map's frame. */
export function projector(
  extent: TerrainExtent,
  map: { readonly min_e?: number; readonly min_n?: number },
  viewport: Viewport,
): (point: Local) => readonly [number, number] {
  const east = extent.min_e - (map.min_e ?? extent.min_e);
  const north = extent.min_n - (map.min_n ?? extent.min_n);
  return ([e, n]) => toScreen(viewport, [e + east, n + north]);
}

export const spotLabel = (spot: SpotHeight): string => `≈ ${spot.heightM.toFixed(1)} m`;

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export interface PlacedSpot {
  readonly spot: SpotHeight;
  readonly x: number;
  readonly y: number;
  /** Where the text starts (left edge) and its vertical middle. */
  readonly textX: number;
  readonly textY: number;
  /** True when the label sits diagonally off the point and needs a leader. */
  readonly leader: boolean;
  readonly box: Box;
}

const LABEL_HEIGHT_PX = 14;
const GAP_PX = 6;
const LIFT_PX = 12;

/**
 * Up to five spot heights for this view, with their labels placed.
 *
 * One per screen cell of a 3 x 2 grid, the highest priority in it (ties by
 * id, so the choice is stable); then, strongest first, each label tries five
 * positions — right, left, upper right, lower right, upper left — and is
 * dropped if all five collide. Fewer than five is better than a pile.
 */
export function placeSpots(
  spots: readonly SpotHeight[],
  project: (point: Local) => readonly [number, number],
  widthPx: number,
  heightPx: number,
  measure: (text: string) => number,
): readonly PlacedSpot[] {
  const cellW = widthPx / SPOT_GRID.cols;
  const cellH = heightPx / SPOT_GRID.rows;
  const best = new Map<number, { spot: SpotHeight; x: number; y: number }>();
  for (const spot of spots) {
    const [x, y] = project([spot.e, spot.n]);
    if (x < 8 || y < 8 || x > widthPx - 8 || y > heightPx - 8) continue;
    const cell = Math.floor(y / cellH) * SPOT_GRID.cols + Math.floor(x / cellW);
    const held = best.get(cell);
    if (
      held === undefined ||
      spot.priority > held.spot.priority ||
      (spot.priority === held.spot.priority && spot.id < held.spot.id)
    ) {
      best.set(cell, { spot, x, y });
    }
  }

  const chosen = [...best.values()]
    .sort((a, b) => b.spot.priority - a.spot.priority || a.spot.id.localeCompare(b.spot.id))
    .slice(0, SPOT_MAX);

  // Every dot is an obstacle for every label, placed or not yet.
  const dots: Box[] = chosen.map(({ x, y }) => ({ left: x - 4, top: y - 4, right: x + 4, bottom: y + 4 }));
  const labels: Box[] = [];
  const placed: PlacedSpot[] = [];
  for (const { spot, x, y } of chosen) {
    const width = measure(spotLabel(spot));
    const positions: readonly { tx: number; ty: number; leader: boolean }[] = [
      { tx: x + GAP_PX, ty: y, leader: false },
      { tx: x - GAP_PX - width, ty: y, leader: false },
      { tx: x + GAP_PX, ty: y - LIFT_PX, leader: true },
      { tx: x + GAP_PX, ty: y + LIFT_PX, leader: true },
      { tx: x - GAP_PX - width, ty: y - LIFT_PX, leader: true },
    ];
    for (const { tx, ty, leader } of positions) {
      const box = { left: tx, top: ty - LABEL_HEIGHT_PX / 2, right: tx + width, bottom: ty + LABEL_HEIGHT_PX / 2 };
      if (box.left < 0 || box.right > widthPx || box.top < 0 || box.bottom > heightPx) continue;
      if (labels.some((other) => overlaps(box, other)) || dots.some((dot) => overlaps(box, dot))) continue;
      labels.push(box);
      placed.push({ spot, x, y, textX: tx, textY: ty, leader, box });
      break;
    }
  }
  return placed;
}

export interface ContourLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  /** Radians, kept between -90° and 90° so the text is never upside down. */
  readonly angle: number;
}

/**
 * At most two contour labels for this view.
 *
 * Only the 5 m lines, unless none of them is in view — common on the river
 * flats, where 53.4% of the ground is between 2 and 4 m — in which case the
 * finest level drawn. Each line at most once, each value at most once, at
 * least 175 px apart, and never within 46 px of a spot height, which wins.
 */
export function placeContourLabels(
  lines: readonly ContourLine[],
  project: (point: Local) => readonly [number, number],
  widthPx: number,
  heightPx: number,
  drawMinor: boolean,
  spots: readonly PlacedSpot[],
): readonly ContourLabel[] {
  const onScreen = ([x, y]: readonly [number, number]) => x >= 20 && y >= 20 && x <= widthPx - 20 && y <= heightPx - 20;

  const candidates = (pool: readonly ContourLine[]) =>
    pool
      .map((line) => {
        // The longest run of consecutive on-screen vertices, labelled at its middle.
        const points = line.c.map(project);
        let bestStart = -1;
        let bestLength = 0;
        let start = -1;
        for (let i = 0; i <= points.length; i += 1) {
          const inside = i < points.length && onScreen(points[i]!);
          if (inside && start < 0) start = i;
          if (!inside && start >= 0) {
            if (i - start > bestLength) {
              bestLength = i - start;
              bestStart = start;
            }
            start = -1;
          }
        }
        if (bestLength < 2) return null;
        const middle = bestStart + Math.floor(bestLength / 2);
        const a = points[Math.max(bestStart, middle - 1)]!;
        const b = points[Math.min(bestStart + bestLength - 1, middle + 1)]!;
        let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        if (angle > Math.PI / 2) angle -= Math.PI;
        if (angle < -Math.PI / 2) angle += Math.PI;
        const [x, y] = points[middle]!;
        return { line, x, y, angle, run: bestLength };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((p, q) => q.run - p.run || p.line.m - q.line.m);

  let pool = candidates(lines.filter((line) => line.major));
  if (pool.length === 0 && drawMinor) pool = candidates(lines);

  const labels: ContourLabel[] = [];
  const values = new Set<number>();
  for (const candidate of pool) {
    if (labels.length >= CONTOUR_LABEL_MAX) break;
    if (values.has(candidate.line.m)) continue;
    if (labels.some((l) => Math.hypot(l.x - candidate.x, l.y - candidate.y) < CONTOUR_LABEL_SPACING_PX)) continue;
    if (spots.some((s) => Math.hypot(s.x - candidate.x, s.y - candidate.y) < CONTOUR_LABEL_SPOT_CLEARANCE_PX)) continue;
    values.add(candidate.line.m);
    labels.push({ text: `${String(candidate.line.m)} m`, x: candidate.x, y: candidate.y, angle: candidate.angle });
  }
  return labels;
}

/** Contours, then contour labels, then spot heights, over the hillshade. */
export function drawTerrainMarks(
  context: CanvasRenderingContext2D,
  marks: TerrainMarks,
  viewport: Viewport,
  map: { readonly min_e?: number; readonly min_n?: number },
): void {
  const project = projector(marks.extent, map, viewport);
  const drawMinor = viewport.scale >= MINOR_CONTOUR_MIN_SCALE;

  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  for (const line of marks.contours) {
    if (!line.major && !drawMinor) continue;
    const style = line.major ? CONTOUR_STYLE.major : CONTOUR_STYLE.minor;
    context.beginPath();
    line.c.forEach((point, index) => {
      const [x, y] = project(point);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = style.colour;
    context.lineWidth = style.width;
    context.stroke();
  }

  context.font = '600 11px "Kensington Sans", system-ui, sans-serif';
  context.textBaseline = 'middle';
  const spots = placeSpots(marks.spots, project, viewport.widthPx, viewport.heightPx, (t) => context.measureText(t).width);
  const labels = placeContourLabels(marks.contours, project, viewport.widthPx, viewport.heightPx, drawMinor, spots);

  context.textAlign = 'center';
  for (const label of labels) {
    context.save();
    context.translate(label.x, label.y);
    context.rotate(label.angle);
    context.lineWidth = 3;
    context.strokeStyle = '#ffffff';
    context.strokeText(label.text, 0, 0);
    context.fillStyle = CONTOUR_STYLE.major.colour;
    context.fillText(label.text, 0, 0);
    context.restore();
  }

  context.textAlign = 'left';
  for (const placed of spots) {
    if (placed.leader) {
      context.beginPath();
      context.moveTo(placed.x, placed.y);
      context.lineTo(placed.textX, placed.textY);
      context.strokeStyle = SPOT_DOT;
      context.lineWidth = 1;
      context.stroke();
    }
    context.beginPath();
    context.arc(placed.x, placed.y, 3, 0, Math.PI * 2);
    context.fillStyle = SPOT_DOT;
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1;
    context.stroke();

    const text = spotLabel(placed.spot);
    context.lineWidth = 3;
    context.strokeStyle = '#ffffff';
    context.strokeText(text, placed.textX, placed.textY);
    context.fillStyle = SPOT_TEXT;
    context.fillText(text, placed.textX, placed.textY);
  }
  context.restore();
}
