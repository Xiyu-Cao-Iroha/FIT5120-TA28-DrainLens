/**
 * The terrain-derived layers, and the rule that keeps them distinguishable.
 *
 * Pits and pipes are published records used as provided. Surface-water paths,
 * low points and the unavailable areas are calculated from a filtered
 * photogrammetric surface. The interface calls the first `Official recorded
 * data` and the second `System-derived result`, and the map has to make that
 * difference visible without anyone reading a legend — otherwise a derivation
 * borrows the authority of a record simply by being drawn beside one.
 *
 * The way it does that here is: **recorded things are solid, derived things
 * are not.** Channels are dashed, low points are a translucent wash with a
 * dashed edge, unavailable areas are hatched. None of them is drawn with a
 * solid line, and nothing recorded is drawn with a dashed one.
 *
 * The channel arrowheads are the one filled mark in this file, and they do not
 * break that rule: the *line* is what carries the recorded-or-derived reading,
 * and it stays dashed under them. An arrowhead drawn in dashes is three dots.
 */

import type { Local, Viewport } from './viewport.js';
import { toScreen, visibleBounds } from './viewport.js';

export type DerivedKind = 'channel' | 'low-point' | 'unavailable';

export interface DerivedLine {
  readonly g: 'line';
  readonly c: readonly Local[];
}

export interface DerivedPolygon {
  readonly g: 'polygon';
  readonly c: readonly (readonly Local[])[];
}

export interface DerivedArtefact {
  readonly artefact: 'derived-layers';
  readonly version: number;
  readonly extent: { readonly name: string; readonly width_m: number; readonly height_m: number };
  readonly coordinates: string;
  readonly basis: 'derived';
  readonly note: string;
  readonly layers: {
    readonly channel?: readonly DerivedLine[];
    readonly 'low-point'?: readonly DerivedPolygon[];
    readonly unavailable?: readonly DerivedPolygon[];
  };
  readonly settings: Record<string, unknown>;
}

export class DerivedError extends Error {}

/**
 * Check the artefact before drawing it.
 *
 * The `basis` field is checked, not just read. If a future artefact ever
 * arrives claiming to be recorded data, it must not be drawn through this
 * path, because everything downstream of here styles its contents as a
 * derivation and labels them so.
 */
export function assertDerived(value: unknown): asserts value is DerivedArtefact {
  const artefact = value as Partial<DerivedArtefact> | null;
  if (!artefact || typeof artefact !== 'object') {
    throw new DerivedError('the derived artefact is not an object');
  }
  if (artefact.artefact !== 'derived-layers') {
    throw new DerivedError(`expected derived-layers, got ${String(artefact.artefact)}`);
  }
  if (artefact.basis !== 'derived') {
    throw new DerivedError(
      `this path draws derivations and labels them so; the artefact declares basis "${String(
        artefact.basis,
      )}"`,
    );
  }
  if (!artefact.note) {
    throw new DerivedError('the artefact carries no note saying what its layers are not');
  }
  if (!artefact.layers || typeof artefact.layers !== 'object') {
    throw new DerivedError('the artefact carries no layers');
  }
}

export interface DerivedPalette {
  readonly channel: string;
  readonly lowPoint: string;
  readonly lowPointEdge: string;
  readonly hatch: string;
  readonly unavailableLabel: string;
}

export const DERIVED_DAY: DerivedPalette = {
  channel: '#2f7fb8',
  lowPoint: 'rgba(90, 160, 205, 0.28)',
  lowPointEdge: '#5aa0cd',
  hatch: '#c2cdbb',
  unavailableLabel: '#7c8a72',
};

/** Dash lengths in pixels, so the pattern stays readable at every zoom. */
const CHANNEL_DASH: readonly number[] = [7, 5];
const LOW_POINT_DASH: readonly number[] = [3, 3];

/** Spacing of the unavailable hatch, in pixels. */
export const HATCH_SPACING_PX = 7;

/**
 * Arrowheads along a channel, in pixels.
 *
 * In pixels rather than metres so that the density on screen is the same at
 * every zoom: spaced in metres, a zoomed-out view is a solid row of arrows and
 * a zoomed-in one has none.
 */
export const ARROW_SPACING_PX = 46;
export const ARROW_LENGTH_PX = 7;
export const ARROW_HALF_WIDTH_PX = 4;

/** A short line still gets one arrow, at its middle, if it is at least this long. */
export const ARROW_MIN_PATH_PX = 26;

export interface Arrow {
  readonly x: number;
  readonly y: number;
  /** Screen-space heading, radians, in the direction the water runs. */
  readonly angle: number;
}

/**
 * Where to put the arrowheads on one channel, and which way they point.
 *
 * **The direction is the vertex order, and that is a fact about the pipeline
 * rather than a convention adopted here.** `trace_channels` walks each path
 * from its head to where it merges, following the D8 flow direction one cell
 * at a time, and Douglas-Peucker drops vertices without reordering them. So
 * vertex *n+1* is downstream of vertex *n*, and an arrow along that heading
 * points the way water runs. If that ever stops being true the arrows become
 * confidently wrong rather than merely absent, which is why it is asserted in
 * the pipeline's own tests and restated here.
 *
 * Positions are walked in screen space, so the northing-up to canvas-y-down
 * flip is already applied and the heading needs no correction.
 */
export function arrowsAlong(
  points: readonly (readonly [number, number])[],
  spacingPx: number = ARROW_SPACING_PX,
): Arrow[] {
  if (points.length < 2) return [];

  // One pass for the total, so a short path can be given a single arrow at its
  // midpoint rather than none at all.
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  if (total < ARROW_MIN_PATH_PX) return [];

  const marks: number[] = [];
  if (total < spacingPx) {
    marks.push(total / 2);
  } else {
    // Inset from both ends by half a spacing, so no arrowhead lands on the
    // junction where two channels meet and neither one owns it.
    for (let at = spacingPx / 2; at <= total - spacingPx / 4; at += spacingPx) marks.push(at);
  }

  const arrows: Arrow[] = [];
  let travelled = 0;
  let next = 0;
  for (let i = 1; i < points.length && next < marks.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;

    while (next < marks.length) {
      const want = marks[next];
      if (want === undefined || want > travelled + length) break;
      const t = (want - travelled) / length;
      arrows.push({
        x: a[0] + dx * t,
        y: a[1] + dy * t,
        angle: Math.atan2(dy, dx),
      });
      next += 1;
    }
    travelled += length;
  }
  return arrows;
}

export interface DerivedVisibility {
  readonly channel: boolean;
  readonly lowPoint: boolean;
  readonly unavailable: boolean;
}

export const ALL_DERIVED: DerivedVisibility = {
  channel: true,
  lowPoint: true,
  unavailable: true,
};

interface Extremes {
  minE: number;
  minN: number;
  maxE: number;
  maxN: number;
}

const pathVisible = (path: readonly Local[], seen: Extremes): boolean => {
  for (const point of path) {
    if (point[0] >= seen.minE && point[0] <= seen.maxE && point[1] >= seen.minN && point[1] <= seen.maxN) {
      return true;
    }
  }
  // A shape can span the view without a vertex inside it, so fall back to its
  // own bounds. Cheaper to do second: most shapes fail or pass on a vertex.
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
  return minE <= seen.maxE && maxE >= seen.minE && minN <= seen.maxN && maxN >= seen.minN;
};

function trace(
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

/**
 * Fill a region with diagonal hatching.
 *
 * Hatching rather than a flat tint, because a tint reads as another quantity
 * on a map that already uses tints for water. Hatching reads as absence, which
 * is what this layer means: not "less", but "we did not measure enough here to
 * say anything at all".
 */
function hatch(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  rings: readonly (readonly Local[])[],
  palette: DerivedPalette,
): void {
  context.save();
  context.beginPath();
  for (const ring of rings) {
    trace(context, viewport, ring);
    context.closePath();
  }
  context.clip();

  context.strokeStyle = palette.hatch;
  context.lineWidth = 1;
  context.beginPath();
  const reach = viewport.widthPx + viewport.heightPx;
  for (let offset = -viewport.heightPx; offset < reach; offset += HATCH_SPACING_PX) {
    context.moveTo(offset, 0);
    context.lineTo(offset + viewport.heightPx, viewport.heightPx);
  }
  context.stroke();
  context.restore();
}

/** One filled triangle, nose at the point, pointing along `angle`. */
function drawArrowhead(context: CanvasRenderingContext2D, arrow: Arrow): void {
  const { x, y, angle } = arrow;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Local coordinates: nose ahead, two corners behind and to each side.
  const point = (along: number, across: number): readonly [number, number] => [
    x + along * cos - across * sin,
    y + along * sin + across * cos,
  ];
  const nose = point(ARROW_LENGTH_PX / 2, 0);
  const left = point(-ARROW_LENGTH_PX / 2, ARROW_HALF_WIDTH_PX);
  const right = point(-ARROW_LENGTH_PX / 2, -ARROW_HALF_WIDTH_PX);
  context.beginPath();
  context.moveTo(nose[0], nose[1]);
  context.lineTo(left[0], left[1]);
  context.lineTo(right[0], right[1]);
  context.closePath();
  context.fill();
}

export function drawDerived(
  context: CanvasRenderingContext2D,
  artefact: DerivedArtefact,
  viewport: Viewport,
  options: { readonly palette?: DerivedPalette; readonly show?: DerivedVisibility } = {},
): void {
  const palette = options.palette ?? DERIVED_DAY;
  const show = options.show ?? ALL_DERIVED;
  const seen = visibleBounds(viewport);

  if (show.unavailable) {
    const rings = (artefact.layers.unavailable ?? [])
      .flatMap((shape) => shape.c)
      .filter((ring) => pathVisible(ring, seen));
    if (rings.length > 0) hatch(context, viewport, rings, palette);
  }

  if (show.lowPoint) {
    context.fillStyle = palette.lowPoint;
    context.strokeStyle = palette.lowPointEdge;
    context.lineWidth = 1;
    context.setLineDash([...LOW_POINT_DASH]);
    for (const shape of artefact.layers['low-point'] ?? []) {
      for (const ring of shape.c) {
        if (!pathVisible(ring, seen)) continue;
        trace(context, viewport, ring);
        context.closePath();
        context.fill();
        context.stroke();
      }
    }
    context.setLineDash([]);
  }

  if (show.channel) {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = Math.max(1.4, viewport.scale * 1.6);

    const drawn: (readonly [number, number])[][] = [];
    context.strokeStyle = palette.channel;
    context.setLineDash([...CHANNEL_DASH]);
    for (const line of artefact.layers.channel ?? []) {
      if (!pathVisible(line.c, seen)) continue;
      const screen = line.c.map((point) => toScreen(viewport, point));
      drawn.push(screen);
      context.beginPath();
      for (let i = 0; i < screen.length; i += 1) {
        const point = screen[i];
        if (!point) continue;
        if (i === 0) context.moveTo(point[0], point[1]);
        else context.lineTo(point[0], point[1]);
      }
      context.stroke();
    }
    context.setLineDash([]);

    // Arrowheads last, over the dashes, so one never lands in a gap and reads
    // as a stray mark. Filled rather than stroked: a stroked head at this size
    // is a smudge, and a dashed one would be three dots.
    context.fillStyle = palette.channel;
    for (const screen of drawn) {
      for (const arrow of arrowsAlong(screen)) drawArrowhead(context, arrow);
    }
  }
}
