/**
 * Drawing 281 statistical areas as marks, and the claims a mark must not make.
 *
 * **A mark is not a shape, and this is the cost of drawing it this way.** The
 * value belongs to the whole statistical area — kilometres across — and a disc
 * at its centre invites the reading *worst here, fading outwards*, which the
 * data says nothing about. So the marks are **flat discs of one colour, not
 * soft glows**: a gradient is a claim about the inside of an area, and nothing
 * in this product knows anything about the inside of one.
 *
 * The palette is the map's own. Blues for how much was recorded and greens for
 * the rate, so switching mode is visibly a different question rather than the
 * same picture recoloured — and neither ramp is red, because a red map of
 * recorded dispatch counts reads as danger and the counts are not a measure of
 * danger.
 *
 * Three things are drawn as their own thing rather than as the palest band:
 *
 * * **No recorded activity** — an outlined ring with nothing in it. In the
 *   palest band it would say the SES went there rarely, and they did not go.
 * * **A floor** — a ring around the disc. 80 of the 281 carry one, so this is
 *   the common qualification and not an edge case.
 * * **No score** — a dashed ring, in severity mode only. Seven areas are
 *   airports, a racecourse and industrial land.
 */

import type { Break, Completeness, MapArea, MapMode } from './severity.js';
import { bandOf, breaksFor, valueOf } from './severity.js';
import { type Viewport, toScreen } from '../map/viewport.js';

/** The two ramps, palest first. Four for counts, three for the rate. */
export const RAMPS: Readonly<Record<MapMode, readonly string[]>> = {
  activity: ['#cdd9ee', '#93a9d6', '#5871b0', '#2b3f7d'],
  severity: ['#cfe2d6', '#86b79a', '#3f8360', '#1d5540'].slice(0, 3),
};

/** An area nobody recorded anything in, and one nobody lives in. */
export const NOTHING_RECORDED = '#8c98a4';
export const NO_SCORE = '#98a2ac';
/** The ring that says a total is a lower bound. */
export const FLOOR_RING = '#1e2b36';

export const LABEL_MIN_SCALE = 0.0045;
export const MARK_R_PX = 7;
export const SELECTED_R_PX = 11;

export interface AreaMark {
  readonly area: MapArea;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * Where each area lands on screen, largest value last.
 *
 * Order is the whole of the overlap rule: at the scale that fits 109 by 116 km
 * into a laptop pane, neighbouring areas touch, and whichever is drawn last is
 * the one a reader sees. Painting the highest value last means a busy area is
 * never hidden under a quiet one — the opposite order hides exactly what the
 * map is for.
 */
export function marksFor(
  areas: readonly MapArea[],
  mode: MapMode,
  viewport: Viewport,
  selected: string | null,
): readonly AreaMark[] {
  return [...areas]
    .sort((a, b) => (valueOf(a, mode) ?? -1) - (valueOf(b, mode) ?? -1))
    .map((area) => {
      const [x, y] = toScreen(viewport, [area.e, area.n]);
      return { area, x, y, r: area.code === selected ? SELECTED_R_PX : MARK_R_PX };
    });
}

/** The colour a mark is filled with, or null for one that is only outlined. */
export function fillFor(area: MapArea, mode: MapMode, state: Completeness): string | null {
  if (state === 'unavailable') return null;
  if (state === 'none') return null;
  const band = bandOf(valueOf(area, mode), breaksFor(mode));
  return band === null ? null : (RAMPS[mode][band] ?? null);
}

export interface DrawInput {
  readonly marks: readonly AreaMark[];
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
  | 'beginPath'
  | 'arc'
  | 'fill'
  | 'stroke'
  | 'setLineDash'
  | 'fillText'
  | 'measureText'
> & {
  // As the DOM declares them: a canvas fill may be a gradient or a pattern,
  // and narrowing it to `string` here would mean the real context does not
  // satisfy this type. Nothing below assigns anything but a colour.
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

export function drawAreas(context: Context, input: DrawInput): void {
  const { marks, mode, stateOf, selected } = input;
  context.clearRect(0, 0, input.width, input.height);

  for (const mark of marks) {
    const state = stateOf(mark.area);
    const fill = fillFor(mark.area, mode, state);

    context.beginPath();
    context.arc(mark.x, mark.y, mark.r, 0, Math.PI * 2);
    if (fill !== null) {
      context.fillStyle = fill;
      context.fill();
    }

    // An outline in every case, so a disc with no fill is still a mark and not
    // a hole. `setLineDash` before every stroke rather than only before a
    // dashed one: a dash left set by the previous mark is a solid ring drawn
    // dashed, which says "no score" about an area that has one.
    context.setLineDash(state === 'unavailable' ? [3, 3] : []);
    context.strokeStyle =
      state === 'none'
        ? NOTHING_RECORDED
        : state === 'unavailable'
          ? NO_SCORE
          : state === 'minimum'
            ? FLOOR_RING
            : (fill ?? NOTHING_RECORDED);
    context.lineWidth = state === 'minimum' ? 2 : 1;
    context.stroke();
  }
  context.setLineDash([]);

  if (input.viewport.scale < LABEL_MIN_SCALE) return;

  /*
    Labels last, and only for the selected area plus the busiest few.

    281 names at this scale is a grey rectangle. Drawing them over every mark
    also means a name can sit on top of a neighbour's disc, which is the same
    mistake as a mark implying a location — so the label is a reading aid for
    what a person has chosen, not a layer of its own.
  */
  context.font = '600 11px "Kensington Sans", system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'bottom';
  context.fillStyle = FLOOR_RING;
  for (const mark of marks) {
    if (mark.area.code !== selected) continue;
    context.fillText(mark.area.name, mark.x, mark.y - mark.r - 3);
  }
}

/**
 * The area under a click, or null.
 *
 * Searched from the last mark backwards, because the last one drawn is the one
 * on top. Hit testing in the drawing order rather than against it is how a
 * person presses the area they can see and selects the one underneath it.
 */
export function markAt(
  marks: readonly AreaMark[],
  x: number,
  y: number,
  slopPx = 4,
): MapArea | null {
  for (let index = marks.length - 1; index >= 0; index -= 1) {
    const mark = marks[index]!;
    const reach = mark.r + slopPx;
    if ((mark.x - x) ** 2 + (mark.y - y) ** 2 <= reach * reach) return mark.area;
  }
  return null;
}

/** The legend's entries for a mode, in the order they are drawn. */
export interface LegendEntry {
  readonly label: string;
  readonly fill: string | null;
  readonly stroke: string;
  readonly dashed: boolean;
  readonly ringed: boolean;
}

/**
 * What the legend shows, which is not the same list in both modes.
 *
 * Measured across all 281 areas: the activity map has four areas with a
 * complete zero and no area without a score; the severity map has seven
 * without a score and none with a complete zero, because every area the SES
 * was never called to is an area almost nobody lives in. An entry for a state
 * a mode cannot produce is a key to a colour that appears nowhere.
 */
export function legendFor(mode: MapMode): readonly LegendEntry[] {
  const bands: LegendEntry[] = breaksFor(mode).map((band: Break, index) => ({
    label: band.label,
    fill: RAMPS[mode][index] ?? null,
    stroke: RAMPS[mode][index] ?? NOTHING_RECORDED,
    dashed: false,
    ringed: false,
  }));

  bands.push({
    label: 'Total is a minimum — a count inside was withheld',
    fill: RAMPS[mode][1] ?? null,
    stroke: FLOOR_RING,
    dashed: false,
    ringed: true,
  });

  if (mode === 'activity') {
    bands.push({
      label: 'No recorded activity',
      fill: null,
      stroke: NOTHING_RECORDED,
      dashed: false,
      ringed: false,
    });
  } else {
    bands.push({
      label: 'No score — too few residents to divide by',
      fill: null,
      stroke: NO_SCORE,
      dashed: true,
      ringed: false,
    });
  }
  return bands;
}
