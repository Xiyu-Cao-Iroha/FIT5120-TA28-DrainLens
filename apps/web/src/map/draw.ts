/**
 * Drawing the map onto a canvas.
 *
 * Every layer here is either recorded source data or nothing at all. The
 * derived layers — surface-water paths, low points, the difference from the
 * all-clear baseline — are drawn separately once the scenario worker exists,
 * because they carry a different basis and the interface has to be able to
 * show which is which. Mixing them into one pass is how a derived result ends
 * up looking as solid as a published record.
 */

import type { LineFeature, MapArtefact, Pipe, Pit, PolygonFeature, Road, StreetName } from './artefact.js';
import { type Local, type Viewport, toScreen, visibleBounds } from './viewport.js';

export interface Palette {
  readonly ground: string;
  readonly road: string;
  readonly roadEdge: string;
  readonly pipe: string;
  readonly pit: string;
  readonly pitEdge: string;
  readonly selected: string;
  readonly label: string;
  readonly labelHalo: string;
}

/** Muted on purpose: the recorded network is context, not the answer. */
export const DAY: Palette = {
  ground: '#eef3ea',
  road: '#ffffff',
  roadEdge: '#e2e8dd',
  pipe: '#31435a',
  pit: '#2f6f62',
  pitEdge: '#ffffff',
  selected: '#0f766e',
  label: '#5b6b7a',
  labelHalo: '#ffffff',
};

/** Below this many pixels per metre, street labels are noise rather than help. */
export const LABEL_MIN_SCALE = 0.55;

/** Below this, a pit is a dot that cannot be told from a pipe junction. */
export const PIT_MIN_SCALE = 0.35;

export interface Extremes {
  minE: number;
  minN: number;
  maxE: number;
  maxN: number;
}

/** The bounding box of a path, for deciding whether to draw it at all. */
export function boundsOfPath(path: readonly Local[]): Extremes | null {
  if (path.length === 0) return null;
  let minE = Infinity;
  let minN = Infinity;
  let maxE = -Infinity;
  let maxN = -Infinity;
  for (const point of path) {
    if (point[0] < minE) minE = point[0];
    if (point[0] > maxE) maxE = point[0];
    if (point[1] < minN) minN = point[1];
    if (point[1] > maxN) maxN = point[1];
  }
  return { minE, minN, maxE, maxN };
}

/**
 * Whether two rectangles overlap at all.
 *
 * Culling by bounding box before drawing is what keeps a thousand features at
 * sixty frames a second. Getting the comparison inverted culls everything
 * on screen and draws everything off it, which looks like a blank map.
 */
export const overlaps = (a: Extremes, b: Extremes): boolean =>
  a.minE <= b.maxE && a.maxE >= b.minE && a.minN <= b.maxN && a.maxN >= b.minN;

const pathIsVisible = (path: readonly Local[], seen: Extremes): boolean => {
  const bounds = boundsOfPath(path);
  return bounds !== null && overlaps(bounds, seen);
};

function tracePath(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  path: readonly Local[],
): void {
  context.beginPath();
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (!point) continue;
    const [x, y] = toScreen(viewport, point);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
}

function drawRoads(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  roads: readonly Road[],
  palette: Palette,
  seen: Extremes,
): void {
  context.fillStyle = palette.road;
  context.strokeStyle = palette.roadEdge;
  context.lineWidth = 1;
  for (const road of roads) {
    for (const ring of road.c) {
      if (!pathIsVisible(ring, seen)) continue;
      tracePath(context, viewport, ring);
      context.closePath();
      context.fill();
      context.stroke();
    }
  }
}

function drawPipes(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  pipes: readonly Pipe[],
  palette: Palette,
  seen: Extremes,
  selectedRef: number | null,
): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const pipe of pipes) {
    if (!pathIsVisible(pipe.c, seen)) continue;
    const isSelected = selectedRef !== null && pipe.ref === selectedRef;
    context.strokeStyle = isSelected ? palette.selected : palette.pipe;
    context.lineWidth = isSelected ? 4 : Math.max(1.2, viewport.scale * 1.1);
    tracePath(context, viewport, pipe.c);
    context.stroke();
  }
}

function drawPits(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  pits: readonly Pit[],
  palette: Palette,
  seen: Extremes,
  selectedAsset: number | null,
): void {
  const radius = Math.max(2.5, Math.min(7, viewport.scale * 2.2));
  context.lineWidth = 1.5;
  for (const pit of pits) {
    const [east, north] = pit.c;
    if (east < seen.minE || east > seen.maxE || north < seen.minN || north > seen.maxN) continue;
    const isSelected = selectedAsset !== null && pit.asset_number === selectedAsset;
    const [x, y] = toScreen(viewport, pit.c);
    context.beginPath();
    context.arc(x, y, isSelected ? radius + 2.5 : radius, 0, Math.PI * 2);
    context.fillStyle = isSelected ? palette.selected : palette.pit;
    context.fill();
    context.strokeStyle = palette.pitEdge;
    context.stroke();
  }
}

/** The longest segment of a street's centreline, which is where a label fits. */
export function labelAnchor(
  path: readonly Local[],
): { at: Local; angle: number; runM: number } | null {
  let best: { at: Local; angle: number; runM: number } | null = null;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (!from || !to) continue;
    const runM = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (best === null || runM > best.runM) {
      // The **map** angle: anticlockwise from east with north up. The canvas
      // negates it when drawing, because its y runs the other way. Computing a
      // screen angle here and negating it there would tilt every label the
      // wrong way against its street, which is the sort of wrong that looks
      // almost right.
      let angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
      // Never upside down: a street name read from below is not read at all.
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      best = { at: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], angle, runM };
    }
  }
  return best;
}

export interface LabelCandidate {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly widthPx: number;
  /** Longest visible run of this street, so the best-placed one wins. */
  readonly weight: number;
}

/** Half-height of a label box, in pixels. Matches the font size below. */
const LABEL_HALF_HEIGHT_PX = 7;

/**
 * Choose which street labels to draw.
 *
 * Two rules, and the first matters more than the second. **A street is named
 * once.** The source publishes a name per segment, and Kensington's blocks are
 * short, so drawing them all writes "Neale Street" six times across four
 * centimetres of screen. The longest visible run of a street wins, because
 * that is where there is room for the name.
 *
 * Then labels that would collide are dropped rather than drawn over each
 * other. Overlapping text is not a cosmetic problem here: a name half hidden
 * under another is a street the person cannot identify, on a map whose whole
 * job is telling them where water goes near their own address.
 */
export function placeLabels(candidates: readonly LabelCandidate[]): LabelCandidate[] {
  const bestByName = new Map<string, LabelCandidate>();
  for (const candidate of candidates) {
    const held = bestByName.get(candidate.text);
    if (held === undefined || candidate.weight > held.weight) {
      bestByName.set(candidate.text, candidate);
    }
  }

  const placed: LabelCandidate[] = [];
  const boxes: Extremes[] = [];
  // Longest run first: the label with the most room to sit in gets the space.
  for (const candidate of [...bestByName.values()].sort((a, b) => b.weight - a.weight)) {
    const half = candidate.widthPx / 2;
    const box: Extremes = {
      minE: candidate.x - half,
      maxE: candidate.x + half,
      minN: candidate.y - LABEL_HALF_HEIGHT_PX,
      maxN: candidate.y + LABEL_HALF_HEIGHT_PX,
    };
    if (boxes.some((other) => overlaps(box, other))) continue;
    boxes.push(box);
    placed.push(candidate);
  }
  return placed;
}

function drawStreetNames(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  names: readonly StreetName[],
  palette: Palette,
  seen: Extremes,
): void {
  context.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const candidates: LabelCandidate[] = [];
  for (const street of names) {
    const text = street.maplabel ?? street.name;
    if (!text || !pathIsVisible(street.c, seen)) continue;
    const anchor = labelAnchor(street.c);
    if (anchor === null) continue;
    const [x, y] = toScreen(viewport, anchor.at);
    candidates.push({
      text,
      x,
      y,
      angle: anchor.angle,
      widthPx: context.measureText(text).width,
      weight: anchor.runM * viewport.scale,
    });
  }

  context.lineWidth = 3;
  context.strokeStyle = palette.labelHalo;
  context.fillStyle = palette.label;
  for (const label of placeLabels(candidates)) {
    context.save();
    context.translate(label.x, label.y);
    context.rotate(-label.angle);
    context.strokeText(label.text, 0, 0);
    context.fillText(label.text, 0, 0);
    context.restore();
  }
}

export interface DrawOptions {
  readonly palette?: Palette;
  readonly selectedPit?: number | null;
  readonly selectedPipe?: number | null;
}

export function drawMap(
  context: CanvasRenderingContext2D,
  artefact: MapArtefact,
  viewport: Viewport,
  options: DrawOptions = {},
): void {
  const palette = options.palette ?? DAY;
  const seen = visibleBounds(viewport);

  context.fillStyle = palette.ground;
  context.fillRect(0, 0, viewport.widthPx, viewport.heightPx);

  drawRoads(context, viewport, artefact.layers.road ?? [], palette, seen);
  drawPipes(context, viewport, artefact.layers.pipe ?? [], palette, seen, options.selectedPipe ?? null);

  if (viewport.scale >= PIT_MIN_SCALE) {
    drawPits(context, viewport, artefact.layers.pit ?? [], palette, seen, options.selectedPit ?? null);
  }
  if (viewport.scale >= LABEL_MIN_SCALE) {
    drawStreetNames(context, viewport, artefact.layers['street-name'] ?? [], palette, seen);
  }
}

export type { LineFeature, PolygonFeature };
