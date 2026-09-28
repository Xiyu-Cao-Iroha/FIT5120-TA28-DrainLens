/**
 * Where the guide's marks go on the canvas.
 *
 * The ground height guide (Figma Terrain Tutorial, 16 September) puts lettered
 * markers and a highlighted contour over the real map. They are drawn in HTML
 * over the canvas, at `toScreen` of the canvas's own viewport, the way the
 * comparison map places its labels, so they move with a drag or a zoom.
 *
 * **A marker whose point has left the canvas is not dropped silently.** It is
 * pinned to the nearest edge, smaller and pointing the way to its point, so a
 * reader who dragged away while a question is asked about A can see which way
 * A went. The recentre button brings both back.
 */

import type { ReactNode } from 'react';

import { type Local, type Viewport, toScreen } from './viewport.js';

export interface GuideMarker {
  readonly id: string;
  readonly at: Local;
  /** A letter in the marker, or empty for a plain ring. */
  readonly label: string;
  /** A short line beside it, such as a height. */
  readonly caption?: string;
}

export interface GuideLine {
  readonly points: readonly Local[];
  readonly label: string;
  readonly labelAt: Local;
}

/** Everything the guide draws over the map for one step. */
export interface GuideOverlay {
  readonly markers?: readonly GuideMarker[];
  readonly line?: GuideLine;
  /** Anything else, laid over the whole map: the step-7 illustration. */
  readonly node?: ReactNode;
}

export interface Placed {
  readonly x: number;
  readonly y: number;
  /** False when the point is off the canvas and this is its edge pin. */
  readonly inside: boolean;
  /** For an edge pin, the direction to the point, in radians from east, clockwise. */
  readonly towards: number;
}

/**
 * A marker's place: at its point, or pinned `inset` pixels inside the edge.
 *
 * The pin sits where the line from the canvas centre to the point crosses the
 * inset rectangle, so it is on the side the point went.
 */
export function placeMarker(viewport: Viewport, at: Local, inset: number): Placed {
  const [x, y] = toScreen(viewport, at);
  const { widthPx: w, heightPx: h } = viewport;
  if (x >= 0 && y >= 0 && x <= w && y <= h) return { x, y, inside: true, towards: 0 };
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const halfW = Math.max(w / 2 - inset, 0);
  const halfH = Math.max(h / 2 - inset, 0);
  // How far along the ray the inset rectangle is reached; dx and dy are not
  // both zero, since the centre is on the canvas.
  const t = Math.min(dx === 0 ? Infinity : halfW / Math.abs(dx), dy === 0 ? Infinity : halfH / Math.abs(dy));
  return { x: cx + dx * t, y: cy + dy * t, inside: false, towards: Math.atan2(dy, dx) };
}

/** The line as an SVG path in canvas pixels. */
export function linePath(viewport: Viewport, points: readonly Local[]): string {
  return points
    .map((point, index) => {
      const [x, y] = toScreen(viewport, point);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}
