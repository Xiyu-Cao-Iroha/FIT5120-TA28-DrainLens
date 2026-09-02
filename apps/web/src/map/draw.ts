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
import { ICON_MIN_SCALE, drawPitIcon } from './pitIcon.js';

export interface Palette {
  readonly ground: string;
  readonly road: string;
  readonly roadEdge: string;
  readonly pipe: string;
  readonly pit: string;
  readonly pitEdge: string;
  readonly selected: string;
  readonly suggested: string;
  readonly label: string;
  readonly labelHalo: string;
  readonly address: string;
  readonly addressHalo: string;
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
  // Amber, matching the panel's "suggested, not your choice yet" note. A
  // suggestion drawn in the chosen colour is a choice the person did not make.
  suggested: '#b4690e',
  label: '#5b6b7a',
  labelHalo: '#ffffff',
  // Warm, and shared with no layer. The address is the person's own
  // location, not a recorded asset, and a marker that borrowed the pit
  // colour would put their house into the drainage network.
  address: '#c2410c',
  addressHalo: '#ffffff',
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
  suggestedAsset: number | null = null,
): void {
  const radius = Math.max(2.5, Math.min(7, viewport.scale * 2.2));
  context.lineWidth = 1.5;
  for (const pit of pits) {
    const [east, north] = pit.c;
    if (east < seen.minE || east > seen.maxE || north < seen.minN || north > seen.maxN) continue;
    const isSelected = selectedAsset !== null && pit.asset_number === selectedAsset;
    const [x, y] = toScreen(viewport, pit.c);
    if (viewport.scale >= ICON_MIN_SCALE) {
      // Close enough for the grate to be countable. See map/pitIcon.ts for
      // why it is a fixed size and why it is not the artwork's own colour.
      drawPitIcon(context, x, y, isSelected ? palette.selected : palette.pit);
      context.lineWidth = 1.5;
    } else {
      context.beginPath();
      context.arc(x, y, isSelected ? radius + 2.5 : radius, 0, Math.PI * 2);
      context.fillStyle = isSelected ? palette.selected : palette.pit;
      context.fill();
      context.strokeStyle = palette.pitEdge;
      context.stroke();
    }

    // A ring around, not a different fill: the suggestion has to read as
    // "this one, if you want it" rather than as an already-made choice.
    if (suggestedAsset !== null && pit.asset_number === suggestedAsset) {
      drawPin(context, x, y, palette.suggested, String(pit.asset_number ?? ''));
      context.lineWidth = 1.5;
    }
    if (isSelected) {
      drawPin(context, x, y, palette.selected, String(pit.asset_number ?? ''));
      context.lineWidth = 1.5;
    }
  }
}

/**
 * A pin and a label for the one pit a person is working with.
 *
 * A pit is drawn at two to seven pixels, which is right for eight hundred of
 * them and useless for the one that matters: a teammate reported not being
 * able to find the pit the panel had just named. So the chosen and suggested
 * pits get a stem, a ring and their asset number — the same identifier the
 * panel shows, so the two can be matched without counting dots.
 *
 * Drawn upward from the pit, because the label belongs to the point below it
 * and a label centred on the point hides the thing it names.
 */
function drawPin(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  colour: string,
  label: string,
): void {
  const stem = 22;

  context.beginPath();
  context.moveTo(x, y - 3);
  context.lineTo(x, y - stem);
  context.lineWidth = 2;
  context.strokeStyle = colour;
  context.stroke();

  context.beginPath();
  context.arc(x, y, 9, 0, Math.PI * 2);
  context.lineWidth = 2.5;
  context.strokeStyle = colour;
  context.stroke();

  if (label === '') return;

  context.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const width = context.measureText(label).width + 12;

  // A plain rectangle, not a rounded one. The rounded-rectangle canvas
  // method is missing on older browsers, and there the whole map would
  // throw rather than lose a corner radius.
  context.fillStyle = colour;
  context.fillRect(x - width / 2, y - stem - 17, width, 17);

  context.fillStyle = '#ffffff';
  context.fillText(label, x, y - stem - 8);
  context.textAlign = 'start';
  context.textBaseline = 'alphabetic';
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
  /**
   * A pit offered but not yet confirmed.
   *
   * Drawn as a ring rather than filled, because AC 2.1.1.d (Aug-27 set) requires a
   * suggestion to be clearly labelled and require confirmation — and a
   * suggestion the panel names but the map does not show leaves the person
   * reading an asset number with no way to find it.
   */
  readonly suggestedPit?: number | null;
  readonly selectedPipe?: number | null;
  /** The selected address, in local metres. Drawn last so nothing covers it. */
  readonly address?: Local | null;
  /**
   * Which recorded layers to draw.
   *
   * Pits and pipes are separate because AC 1.1.5 names them separately, and
   * because they answer different questions: the pipes are where water goes,
   * the pits are where it can get in.
   */
  readonly showPipes?: boolean;
  readonly showPits?: boolean;
  readonly showRoads?: boolean;
  /**
   * Skip the flat ground fill because something already painted the ground.
   *
   * `drawMap` opens by filling the whole canvas. With the terrain layer drawn
   * first and this left false, the fill covered it completely: the layer was
   * computed, drawn, and then erased before anything else was painted over
   * it. Toggling it changed 0.1% of the screen, which a teammate reported —
   * accurately — as "the button does nothing".
   */
  readonly groundAlreadyDrawn?: boolean;
}

/**
 * The selected address.
 *
 * A ring rather than a filled dot, so it reads as "here" rather than as one
 * more asset in a layer of dots — and it is deliberately the one thing on this
 * map that is not drawn from an artefact.
 */
export function drawAddress(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  at: Local,
  palette: Palette,
): void {
  const [x, y] = toScreen(viewport, at);
  context.lineWidth = 3;
  context.strokeStyle = palette.addressHalo;
  context.beginPath();
  context.arc(x, y, 8, 0, Math.PI * 2);
  context.stroke();

  context.lineWidth = 2.5;
  context.strokeStyle = palette.address;
  context.beginPath();
  context.arc(x, y, 8, 0, Math.PI * 2);
  context.stroke();

  context.beginPath();
  context.arc(x, y, 2.5, 0, Math.PI * 2);
  context.fillStyle = palette.address;
  context.fill();
}

export function drawMap(
  context: CanvasRenderingContext2D,
  artefact: MapArtefact,
  viewport: Viewport,
  options: DrawOptions = {},
): void {
  const palette = options.palette ?? DAY;
  const seen = visibleBounds(viewport);

  if (options.groundAlreadyDrawn !== true) {
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, viewport.widthPx, viewport.heightPx);
  }

  if (options.showRoads !== false) {
    drawRoads(context, viewport, artefact.layers.road ?? [], palette, seen);
  }
  if (options.showPipes !== false) {
    drawPipes(context, viewport, artefact.layers.pipe ?? [], palette, seen, options.selectedPipe ?? null);
  }

  if (options.showPits !== false && viewport.scale >= PIT_MIN_SCALE) {
    drawPits(
      context,
      viewport,
      artefact.layers.pit ?? [],
      palette,
      seen,
      options.selectedPit ?? null,
      options.suggestedPit ?? null,
    );
  }
  if (viewport.scale >= LABEL_MIN_SCALE) {
    drawStreetNames(context, viewport, artefact.layers['street-name'] ?? [], palette, seen);
  }

  // Last, and never culled by `seen`: a marker just off screen is the one
  // thing a person needs to be able to pan back towards.
  if (options.address) drawAddress(context, viewport, options.address, palette);
}

export type { LineFeature, PolygonFeature };
