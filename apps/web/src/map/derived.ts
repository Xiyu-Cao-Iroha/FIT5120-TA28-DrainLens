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

/**
 * Enlarged on 7 September, on a teammate's report that the direction could not
 * be read at a glance.
 *
 * 7x8 pixels was a mark you had to already know was an arrow. The line under
 * it is a 3-pixel dashed stroke, and a head no wider than twice the line it
 * sits on reads as a thickening of the dash rather than as a point. 11x12 is
 * legible without being a decoration: at the default zoom a channel carries
 * three or four of them, and the spacing is unchanged, so the density people
 * are used to is unchanged with it.
 */
export const ARROW_LENGTH_PX = 11;
export const ARROW_HALF_WIDTH_PX = 6;

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

/**
 * Each shape's bounds, worked out once.
 *
 * Recomputed on every frame they were free at a square kilometre and 800
 * shapes. The council-wide artefact carries about 16,000, and walking every
 * vertex of every one of them on each frame of a drag was a large part of
 * what made the zoomed-out map stutter. The artefact is immutable once
 * loaded, so a path's bounds never change and can be kept against the path
 * itself.
 */
const extremes = new WeakMap<readonly Local[], Extremes>();

function extremesOf(path: readonly Local[]): Extremes {
  const known = extremes.get(path);
  if (known) return known;
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
  const found = { minE, minN, maxE, maxN };
  extremes.set(path, found);
  return found;
}

/**
 * Whether any part of a shape's bounds is on screen.
 *
 * Bounds rather than vertices: a shape can span the view without a vertex
 * inside it, and a vertex inside the view is always inside the bounds too, so
 * the one test answers both.
 */
const pathVisible = (path: readonly Local[], seen: Extremes): boolean => {
  const box = extremesOf(path);
  return box.minE <= seen.maxE && box.maxE >= seen.minE && box.minN <= seen.maxN && box.maxN >= seen.minN;
};

/**
 * The smallest low point drawn, as its longer side on screen, in pixels.
 *
 * **A display filter that changes with zoom, not a claim about the ground.**
 * Below a pixel a hollow cannot be seen, only paid for: zoomed out over the
 * whole council, most of the 15,000 are specks under a pixel wide, each one
 * a fill and a stroke. Zoom in and every one of them is drawn again.
 */
export const LOW_POINT_MIN_PX = 1;

/** Rings per path when drawing low points. See the note in `drawDerived`. */
export const LOW_POINTS_PER_PATH = 10;

const bigEnough = (path: readonly Local[], scale: number): boolean => {
  const box = extremesOf(path);
  return Math.max(box.maxE - box.minE, box.maxN - box.minN) * scale >= LOW_POINT_MIN_PX;
};

/**
 * Add one ring to the current path. **Does not begin one.**
 *
 * It was split out of a `trace` that began a path per ring, because `hatch`
 * composes a clip region from several rings at once and that `beginPath`
 * threw away every ring but the last — so only one unavailable area was ever
 * hatched, and *which* one changed as the view moved. On screen that was
 * areas flickering and disappearing while the map was dragged. The low points
 * now build one path the same way, and `trace` had no callers left.
 */
function addRing(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  path: readonly Local[],
): void {
  const screen = onScreen(viewport, path);
  for (let index = 0; index < screen.length; index += 1) {
    const point = screen[index];
    if (!point) continue;
    if (index === 0) context.moveTo(point[0], point[1]);
    else context.lineTo(point[0], point[1]);
  }
}

/**
 * A path's vertices on screen, leaving out any within `MIN_STEP_PX` of the
 * last one kept.
 *
 * Zoomed out over the whole council the low points alone are 400,000 vertices,
 * most of them a fraction of a pixel from their neighbour. Leaving those out
 * took that layer from 191 ms a frame to about 50 ms in Chrome, and changes
 * nothing zoomed in: the pipeline already simplified to a metre, so at street
 * zoom no two vertices are this close. The first and last are always kept, so
 * a ring still closes where it started and a channel still ends where it ends.
 */
export const MIN_STEP_PX = 2;

function onScreen(viewport: Viewport, path: readonly Local[]): (readonly [number, number])[] {
  const kept: (readonly [number, number])[] = [];
  let lastX = 0;
  let lastY = 0;
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (!point) continue;
    const [x, y] = toScreen(viewport, point);
    const first = kept.length === 0;
    const last = index === path.length - 1;
    if (first || last || Math.abs(x - lastX) + Math.abs(y - lastY) >= MIN_STEP_PX) {
      kept.push([x, y]);
      lastX = x;
      lastY = y;
    }
  }
  return kept;
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
  // One path, every ring in it. `trace` would begin a new one per ring and
  // clip to whichever came last.
  context.beginPath();
  for (const ring of rings) {
    addRing(context, viewport, ring);
    context.closePath();
  }
  context.clip();

  context.strokeStyle = palette.hatch;
  context.lineWidth = 1;
  context.beginPath();

  /*
    **The pattern is anchored to the ground, not to the screen.**

    These lines were laid out from the canvas's own left edge, so they stayed
    put while the map moved underneath them — dragging made the hatching crawl
    through the shapes it belongs to, which reads as the shapes shimmering.
    Reported as *"it wobbles while dragging"*, and it had been true since the
    layer was written; the clip fix only made it visible in more places at once.

    Every line here satisfies `x - y = offset`, so a pan of `(dx, dy)` moves
    the ground under them by `dx - dy` in that quantity. Shifting the whole
    family by the same amount — read off where the extent's own corner lands —
    makes the hatching travel with the map. Taken modulo the spacing so the
    number stays small however far somebody has panned.

    It has a second effect worth having: neighbouring areas now share one
    continuous pattern rather than each carrying its own, so a cluster of small
    shapes reads as one texture instead of a scatter of independent ones.
  */
  const [originX, originY] = toScreen(viewport, [0, 0]);
  const phase = (((originX - originY) % HATCH_SPACING_PX) + HATCH_SPACING_PX) % HATCH_SPACING_PX;

  const reach = viewport.widthPx + viewport.heightPx;
  for (let offset = -viewport.heightPx + phase; offset < reach; offset += HATCH_SPACING_PX) {
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
    /*
      **A few rings to a path**, not one each and not all at once.

      One fill and one dashed stroke per ring was 30,000 draw calls a frame
      over the whole council and most of a 236 ms frame. One path holding
      every ring is worse: Chrome's cost for filling and dashing a path grows
      faster than its length, and 15,000 rings in one path hung the tab.
      Measured on 2,000 real rings -- one per path 51 ms, 10 per path 12 ms,
      50 19 ms, 200 24 ms. The rings are separate hollows and never overlap,
      so batching paints the same pixels, and every edge keeps its dash.
    */
    context.fillStyle = palette.lowPoint;
    context.strokeStyle = palette.lowPointEdge;
    context.lineWidth = 1;
    context.setLineDash([...LOW_POINT_DASH]);
    let inPath = 0;
    const flush = (): void => {
      if (inPath === 0) return;
      context.fill();
      context.stroke();
      inPath = 0;
    };
    for (const shape of artefact.layers['low-point'] ?? []) {
      for (const ring of shape.c) {
        if (!pathVisible(ring, seen) || !bigEnough(ring, viewport.scale)) continue;
        if (inPath === 0) context.beginPath();
        addRing(context, viewport, ring);
        context.closePath();
        inPath += 1;
        if (inPath === LOW_POINTS_PER_PATH) flush();
      }
    }
    flush();
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
      const screen = onScreen(viewport, line.c);
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
