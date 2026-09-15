/**
 * Drawing 281 statistical areas as their own shapes, and the claims a shape
 * must not make.
 *
 * **The areas were dots until 13 September**, one flat disc at a point inside
 * each, and the map had no map in it: 281 marks on an empty ground with
 * nothing to say where the bay, the city or the edge of Greater Melbourne was.
 * They are now the ABS boundaries, simplified to 25 m, filled flat.
 *
 * **Flat, still.** The value belongs to the whole statistical area and nothing
 * in this product knows anything about the inside of one, so an area is one
 * colour edge to edge — no gradient, no glow, nothing brighter at the middle.
 *
 * The palette is the map's own. Blues for how much was recorded and greens for
 * the rate, so switching mode is visibly a different question rather than the
 * same picture recoloured — and neither ramp is red, because a red map of
 * recorded dispatch counts reads as danger and the counts are not a measure of
 * danger.
 *
 * Three things are drawn as their own thing rather than as the palest band:
 *
 * * **No recorded activity** — white, outlined in grey. In the palest band it
 *   would say the SES went there rarely, and they did not go.
 * * **A floor** — hatched over its colour. 80 of the 281 carry one, so this is
 *   the common qualification and not an edge case.
 * * **No score** — white with a dashed outline, in severity mode only. Seven
 *   areas are airports, a racecourse and industrial land.
 */

import type { Break, Completeness, MapArea, MapMode } from './severity.js';
import { bandOf, breaksFor, valueOf } from './severity.js';
import { type Viewport, toLocal, toScreen } from '../map/viewport.js';
import { FLOOD } from '../ui/terms.js';

/** The two ramps, palest first. Four for counts, three for the rate. */
export const RAMPS: Readonly<Record<MapMode, readonly string[]>> = {
  activity: ['#cdd9ee', '#93a9d6', '#5871b0', '#2b3f7d'],
  severity: ['#cfe2d6', '#86b79a', '#3f8360', '#1d5540'].slice(0, 3),
};

/** An area nobody recorded anything in, and one nobody lives in. */
export const NOTHING_RECORDED = '#8c98a4';
export const NO_SCORE = '#98a2ac';
/** The hatch that says a total is a lower bound, and the selection outline. */
export const FLOOR_HATCH = '#1e2b36';
/** What an area with no colour of its own is filled with. */
export const EMPTY_FILL = '#ffffff';
/** Between areas, and what is not an area at all — the bay, beyond the scope. */
export const BORDER = '#ffffff';
export const GROUND = '#e3e8ec';

/**
 * How far the flood map zooms: 20 metres to a pixel.
 *
 * The boundaries are simplified to 25 m ring by ring, so two neighbours can
 * disagree along their shared edge by up to 50 m — two and a half pixels here,
 * under the white border between them. The drainage map's limit is four pixels
 * to a metre, where the same disagreement would be a gap you could drive
 * through.
 */
export const MAX_AREA_SCALE = 0.05;

/** Hatch spacing, in pixels. */
export const HATCH_PX = 6;

/** The corners of an area's shape, in local metres, worked out once. */
interface Box {
  readonly minE: number;
  readonly minN: number;
  readonly maxE: number;
  readonly maxN: number;
}
const boxes = new WeakMap<MapArea, Box>();

export function boxOf(area: MapArea): Box {
  const held = boxes.get(area);
  if (held) return held;
  let minE = Infinity;
  let minN = Infinity;
  let maxE = -Infinity;
  let maxN = -Infinity;
  for (const ring of area.rings) {
    for (let index = 0; index < ring.length; index += 2) {
      const e = ring[index]!;
      const n = ring[index + 1]!;
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
      if (n < minN) minN = n;
      if (n > maxN) maxN = n;
    }
  }
  const box = { minE, minN, maxE, maxN };
  boxes.set(area, box);
  return box;
}

/** The colour an area is filled with, or null for one with no colour of its own. */
export function fillFor(area: MapArea, mode: MapMode, state: Completeness): string | null {
  if (state === 'unavailable') return null;
  if (state === 'none') return null;
  const band = bandOf(valueOf(area, mode), breaksFor(mode));
  return band === null ? null : (RAMPS[mode][band] ?? null);
}

export interface DrawInput {
  readonly areas: readonly MapArea[];
  readonly mode: MapMode;
  readonly stateOf: (area: MapArea) => Completeness;
  readonly selected: string | null;
  readonly viewport: Viewport;
  readonly width: number;
  readonly height: number;
}

/** A canvas 2D context, as much of one as this file uses. */
export type Context = Pick<
  CanvasRenderingContext2D,
  | 'clearRect'
  | 'fillRect'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'closePath'
  | 'fill'
  | 'stroke'
  | 'save'
  | 'restore'
  | 'clip'
  | 'setLineDash'
  | 'fillText'
  | 'strokeText'
> & {
  // As the DOM declares them: a canvas fill may be a gradient or a pattern,
  // and narrowing it to `string` here would mean the real context does not
  // satisfy this type. Nothing below assigns anything but a colour.
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

/** Whether any of an area's shape is on the canvas. */
function onScreen(area: MapArea, input: DrawInput): boolean {
  const box = boxOf(area);
  const [left, top] = toScreen(input.viewport, [box.minE, box.maxN]);
  const [right, bottom] = toScreen(input.viewport, [box.maxE, box.minN]);
  return right >= 0 && bottom >= 0 && left <= input.width && top <= input.height;
}

function trace(context: Context, area: MapArea, viewport: Viewport): void {
  context.beginPath();
  for (const ring of area.rings) {
    for (let index = 0; index < ring.length; index += 2) {
      const [x, y] = toScreen(viewport, [ring[index]!, ring[index + 1]!]);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  }
}

export function drawAreas(context: Context, input: DrawInput): void {
  const { areas, mode, stateOf, selected, viewport } = input;
  context.clearRect(0, 0, input.width, input.height);
  context.fillStyle = GROUND;
  context.fillRect(0, 0, input.width, input.height);
  context.lineJoin = 'round';

  const visible = areas.filter((area) => onScreen(area, input));

  // Fills and the white edges between them. Even-odd, because a boundary with
  // a hole in it is a ring inside a ring and nothing in the file says which
  // one is the hole.
  for (const area of visible) {
    const state = stateOf(area);
    trace(context, area, viewport);
    context.fillStyle = fillFor(area, mode, state) ?? EMPTY_FILL;
    context.fill('evenodd');
    context.setLineDash([]);
    context.strokeStyle = BORDER;
    context.lineWidth = 0.8;
    context.stroke();
  }

  // What an area's colour cannot say on its own, over every fill, so no
  // neighbour's edge is drawn across it. `setLineDash` before every stroke: a
  // dash left set by the previous area says "no score" about one that has one.
  for (const area of visible) {
    const state = stateOf(area);
    if (state === 'minimum') {
      hatch(context, area, input, fillFor(area, mode, state));
    } else if (state === 'none' || state === 'unavailable') {
      trace(context, area, viewport);
      context.setLineDash(state === 'unavailable' ? [4, 3] : []);
      context.strokeStyle = state === 'unavailable' ? NO_SCORE : NOTHING_RECORDED;
      context.lineWidth = 1;
      context.stroke();
    }
  }
  context.setLineDash([]);

  const chosen = visible.find((area) => area.code === selected);
  if (!chosen) return;
  trace(context, chosen, viewport);
  context.strokeStyle = FLOOR_HATCH;
  context.lineWidth = 2.5;
  context.stroke();

  // The name, at the point inside the area, with a white edge so it reads over
  // any colour and any neighbour.
  const [x, y] = toScreen(viewport, [chosen.e, chosen.n]);
  context.font = '600 12px "Kensington Sans", system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.strokeStyle = BORDER;
  context.lineWidth = 3;
  context.strokeText(chosen.name, x, y);
  context.fillStyle = FLOOR_HATCH;
  context.fillText(chosen.name, x, y);
}

/** The hatch over a light fill, and over the two darkest bands where that one disappears. */
export const HATCH_ON_LIGHT = 'rgba(30, 43, 54, 0.55)';
export const HATCH_ON_DARK = 'rgba(255, 255, 255, 0.65)';

/** Diagonal lines across the area's own shape and nowhere else. */
function hatch(context: Context, area: MapArea, input: DrawInput, fill: string | null): void {
  const box = boxOf(area);
  const [left, top] = toScreen(input.viewport, [box.minE, box.maxN]);
  const [right, bottom] = toScreen(input.viewport, [box.maxE, box.minN]);
  context.save();
  trace(context, area, input.viewport);
  context.clip('evenodd');
  context.beginPath();
  // Lines at 45°, on a grid fixed to the screen rather than to the area, so
  // two hatched neighbours read as one texture and not two.
  const start = Math.floor((left + top) / HATCH_PX) * HATCH_PX;
  for (let offset = start; offset <= right + bottom; offset += HATCH_PX) {
    context.moveTo(offset - top, top);
    context.lineTo(offset - bottom, bottom);
  }
  const ramp = RAMPS[input.mode];
  const dark = fill !== null && ramp.indexOf(fill) >= 2;
  context.strokeStyle = dark ? HATCH_ON_DARK : HATCH_ON_LIGHT;
  context.lineWidth = 1;
  context.setLineDash([]);
  context.stroke();
  context.restore();
}

/** Even-odd across every ring, which is the rule the fill used. */
export function inShape(area: MapArea, e: number, n: number): boolean {
  const box = boxOf(area);
  if (e < box.minE || e > box.maxE || n < box.minN || n > box.maxN) return false;
  let hit = false;
  for (const ring of area.rings) {
    const count = ring.length / 2;
    for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
      const e1 = ring[i * 2]!;
      const n1 = ring[i * 2 + 1]!;
      const e2 = ring[j * 2]!;
      const n2 = ring[j * 2 + 1]!;
      if (n1 > n !== n2 > n && e < ((e2 - e1) * (n - n1)) / (n2 - n1) + e1) hit = !hit;
    }
  }
  return hit;
}

/**
 * The area under a click, or null for the bay or beyond the scope.
 *
 * Shapes do not overlap, so there is no drawing order to respect: a point is
 * in one area or none.
 */
export function areaAt(areas: readonly MapArea[], viewport: Viewport, x: number, y: number): MapArea | null {
  const [e, n] = toLocal(viewport, [x, y]);
  return areas.find((area) => inShape(area, e, n)) ?? null;
}

/** The legend's entries for a mode, in the order they are drawn. */
export interface LegendEntry {
  readonly label: string;
  readonly fill: string | null;
  readonly stroke: string;
  readonly dashed: boolean;
  readonly hatched: boolean;
}

/**
 * What the legend shows, which is not the same list in both modes.
 *
 * Measured across all 281 areas: the activity map has four areas with a
 * complete zero and no area without a score; the severity map has seven
 * without a score and none with a complete zero, because every area the SES
 * was never called to is an area almost nobody lives in. An entry for a state
 * a mode cannot produce is a key to a colour that appears nowhere.
 *
 * **Short entries** (copy audit v2, #82, #90): the floor is `FLOOD.atLeast`,
 * the withheld zero *Count not available*, the complete zero *None recorded*
 * and the unscored area *Too few residents to compare*. The threshold is no
 * longer in the entry, so it is not passed in; it is under More information.
 */
export function legendFor(mode: MapMode): readonly LegendEntry[] {
  const bands: LegendEntry[] = breaksFor(mode).map((band: Break, index) => ({
    label: band.label,
    fill: RAMPS[mode][index] ?? null,
    stroke: RAMPS[mode][index] ?? NOTHING_RECORDED,
    dashed: false,
    hatched: false,
  }));

  bands.push({
    label: FLOOD.atLeast,
    fill: RAMPS[mode][1] ?? null,
    stroke: RAMPS[mode][1] ?? NOTHING_RECORDED,
    dashed: false,
    hatched: true,
  });

  if (mode === 'activity') {
    // Two areas have a published total of zero because every region in them
    // was withheld. They draw hatched over no colour.
    bands.push({
      label: 'Count not available',
      fill: null,
      stroke: NOTHING_RECORDED,
      dashed: false,
      hatched: true,
    });
    bands.push({
      label: 'None recorded',
      fill: null,
      stroke: NOTHING_RECORDED,
      dashed: false,
      hatched: false,
    });
  } else {
    bands.push({
      label: 'Too few residents to compare',
      fill: null,
      stroke: NO_SCORE,
      dashed: true,
      hatched: false,
    });
  }
  return bands;
}
