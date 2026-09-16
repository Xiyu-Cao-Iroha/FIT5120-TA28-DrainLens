/**
 * The warning sign on an especially deep low area.
 *
 * The industry mentor's request, and the team's decision: where a low area is
 * especially deep, put a warning sign on it; pressing it opens a small card
 * saying water collects there easily and not to park there when heavy rain is
 * coming. **Just that sentence** — no depth, no caveat — because the card is
 * advice about a place, and everything the map says about how the low areas
 * were calculated is already said beside the layer itself.
 *
 * **The sign stands on the street, because the sentence is about parking.**
 * The first file put it at each hollow's deepest cell, and the 15 September
 * live test found one screen of Carlton holding 22 signs, most of them in
 * courtyards and backyards. Where signs go is decided in the pipeline: the
 * lowest cell of the hollow inside a street's road corridor and off a
 * building, at least 1 m below the spill level there, on a hollow of at least
 * 100 m², and no two within 150 m.
 * `pipeline/src/drainlens_pipeline/low_area_warnings.py` carries the numbers.
 * That gives 2 signs over Kensington's square kilometre and 91 over the
 * council (it was 11 and 764), and the sign is still only drawn close in — see
 * `WARNING_MIN_SCALE`.
 *
 * **The sign is drawn, not typed.** The site's typeface is a 120-character
 * subset (`public/fonts/README.md`) and has no ⚠, and an emoji falls back to
 * whatever the device has, in whatever colour it likes.
 */

import type { Local, Screen, Viewport } from './viewport.js';
import { toScreen } from './viewport.js';

export interface WarningPoint {
  /** The lowest street cell of the hollow, in the extent's local metres. */
  readonly c: Local;
  readonly depthM: number;
  readonly areaM2: number;
}

export interface WarningsArtefact {
  readonly artefact: 'low-area-warnings';
  readonly version: 1;
  readonly extent: { readonly name: string; readonly width_m: number; readonly height_m: number };
  readonly basis: 'derived';
  readonly points: readonly WarningPoint[];
}

export class WarningsError extends Error {}

/**
 * The card. The body is the request's advice alone (copy audit v2, #62),
 * since its first sentence repeated the title word for word and its dash
 * broke the site's writing rules. The title says *may* (copy audit v4, #62),
 * so it does not read as "this spot will flood" (AC 1.3.2). No source line:
 * the industry mentor asked for no further explanation on this card.
 */
export const WARNING_TITLE = 'Water may pool here in heavy rain';
export const WARNING_BODY = 'Avoid parking here when heavy rain is coming.';

/**
 * Pixels per metre at or above which the signs are drawn.
 *
 * **Close in, and not on the zoomed-out view.** Kensington's whole square
 * kilometre on a 1080-pixel map is about 1.1 px/m, and the council overview is
 * a tenth of that — a sign there would be a sign about a whole neighbourhood.
 * The full map opens at 3 px/m and the guide opens 300 m across its frame:
 * 1.87 px/m in the 560-pixel frame of a laptop, 1.49 in the 448 pixels it gets
 * in a narrow window. 1.25 is past the first and short of all of those, so the
 * guide can show a sign without asking anyone to zoom first.
 *
 * Measured sliding a 1080 × 775 window over each extent: the council's worst
 * view holds 13 signs at 1.25 px/m and 4 at 3; Kensington's worst holds 2.
 * (Before the signs moved to the streets, 59 and 20, and 6.)
 */
export const WARNING_MIN_SCALE = 1.25;

/** The drawn triangle: its width, and its height from base to apex. */
export const WARNING_WIDTH_PX = 24;
export const WARNING_HEIGHT_PX = 21;

/** Whether the signs are on the map at all, for this layer state and zoom. */
export function warningsVisible(lowAreasOn: boolean, scale: number): boolean {
  return lowAreasOn && scale >= WARNING_MIN_SCALE;
}

/**
 * The signs whose mark is at least partly on screen.
 *
 * Tested against the drawn box, not the point: a sign whose point is just off
 * the edge still shows half a triangle, and half a triangle that cannot be
 * pressed is a mark that ignores the person pressing it.
 */
export function warningsInView(points: readonly WarningPoint[], viewport: Viewport): WarningPoint[] {
  const halfW = WARNING_WIDTH_PX / 2;
  const halfH = WARNING_HEIGHT_PX / 2;
  return points.filter((point) => {
    const [x, y] = toScreen(viewport, point.c);
    return x + halfW >= 0 && x - halfW <= viewport.widthPx && y + halfH >= 0 && y - halfH <= viewport.heightPx;
  });
}

/**
 * The sign under a press, or null.
 *
 * **Only where the sign is drawn.** It takes a press ahead of the pits, because
 * it is painted over them and a mark that hands its press to something
 * underneath reads as a mark that does nothing. But the box is the triangle's
 * own and no larger: the pit tap radius is 18 pixels, and a sign that borrowed
 * it would steal presses meant for a pit beside it that is plainly visible.
 *
 * Where two signs overlap, the one whose centre the press is nearest wins.
 */
export function pickWarning(
  press: Screen,
  viewport: Viewport,
  points: readonly WarningPoint[],
): WarningPoint | null {
  let best: WarningPoint | null = null;
  let bestDistance = Infinity;
  for (const point of points) {
    const [x, y] = toScreen(viewport, point.c);
    const dx = press[0] - x;
    const dy = press[1] - y;
    if (Math.abs(dx) > WARNING_WIDTH_PX / 2 || Math.abs(dy) > WARNING_HEIGHT_PX / 2) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

/** Amber, with a dark mark: the road-sign convention people already read. */
const FILL = '#f2b01e';
const EDGE = '#5c3b00';

/**
 * One sign, centred on the point.
 *
 * Centred rather than standing on it like the address pin: the point is the
 * deepest part of a hollow's street, not a spot on the ground to be pointed at,
 * and a sign hovering above it would sit over whatever is north of it — on a
 * street running east–west, the fronts of the houses.
 */
export function drawWarning(context: CanvasRenderingContext2D, x: number, y: number): void {
  const top = y - WARNING_HEIGHT_PX / 2;
  const bottom = y + WARNING_HEIGHT_PX / 2;
  const half = WARNING_WIDTH_PX / 2;

  context.save();
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(x, top);
  context.lineTo(x + half, bottom);
  context.lineTo(x - half, bottom);
  context.closePath();
  // A white halo first, so the sign stays a sign over the blue wash, the
  // hatching and the pits alike.
  context.lineWidth = 4;
  context.strokeStyle = '#ffffff';
  context.stroke();
  context.fillStyle = FILL;
  context.fill();
  context.lineWidth = 1.5;
  context.strokeStyle = EDGE;
  context.stroke();

  // The exclamation mark: a tapered bar and a dot, in the lower two thirds
  // where the triangle is wide enough to hold them.
  context.fillStyle = EDGE;
  context.beginPath();
  context.moveTo(x - 1.6, top + 7);
  context.lineTo(x + 1.6, top + 7);
  context.lineTo(x + 1, top + 14);
  context.lineTo(x - 1, top + 14);
  context.closePath();
  context.fill();
  context.beginPath();
  context.arc(x, top + 17, 1.4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function drawWarnings(
  context: CanvasRenderingContext2D,
  points: readonly WarningPoint[],
  viewport: Viewport,
): void {
  for (const point of warningsInView(points, viewport)) {
    const [x, y] = toScreen(viewport, point.c);
    drawWarning(context, x, y);
  }
}

/**
 * Check the artefact is this map's before any of it is drawn.
 *
 * The file is chosen by the name of the extent the map came from, and its
 * points are only right in that extent's frame: the council's drawn over the
 * Kensington fallback would land a kilometre and a half from their hollows.
 * So the name and the size are both compared, not just read.
 */
export function assertWarnings(
  value: unknown,
  extent: { readonly name: string; readonly width_m: number; readonly height_m: number },
): asserts value is WarningsArtefact {
  const artefact = value as Partial<WarningsArtefact> | null;
  if (artefact === null || typeof artefact !== 'object' || artefact.artefact !== 'low-area-warnings') {
    throw new WarningsError('the low-area warnings artefact is not one');
  }
  if (artefact.version !== 1) {
    throw new WarningsError(`the low-area warnings artefact is version ${String(artefact.version)}, and this reads version 1`);
  }
  if (artefact.basis !== 'derived') {
    throw new WarningsError('the low-area warnings artefact does not declare itself derived');
  }
  if (
    artefact.extent?.name !== extent.name ||
    artefact.extent.width_m !== extent.width_m ||
    artefact.extent.height_m !== extent.height_m
  ) {
    throw new WarningsError(
      `the warnings are for ${String(artefact.extent?.name)} and the map is ${extent.name}; drawn here they would be in the wrong place`,
    );
  }
  if (!Array.isArray(artefact.points)) {
    throw new WarningsError('the low-area warnings artefact carries no points');
  }
}

/** Where an extent's warnings are published, beside the site's other static artefacts. */
export const warningsUrl = (extentName: string): string =>
  `/data/warnings/${encodeURIComponent(extentName)}.json`;

export async function loadWarnings(
  extent: { readonly name: string; readonly width_m: number; readonly height_m: number },
  fetchJson: (url: string) => Promise<unknown> = (u) =>
    fetch(u).then((r) => {
      if (!r.ok) throw new WarningsError(`${u} answered ${String(r.status)}`);
      return r.json();
    }),
): Promise<WarningsArtefact> {
  const value = await fetchJson(warningsUrl(extent.name));
  assertWarnings(value, extent);
  return value;
}
