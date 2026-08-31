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
    context.strokeStyle = palette.channel;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.setLineDash([...CHANNEL_DASH]);
    context.lineWidth = Math.max(1.4, viewport.scale * 1.6);
    for (const line of artefact.layers.channel ?? []) {
      if (!pathVisible(line.c, seen)) continue;
      trace(context, viewport, line.c);
      context.stroke();
    }
    context.setLineDash([]);
  }
}
