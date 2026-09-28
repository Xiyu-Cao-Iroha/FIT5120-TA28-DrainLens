/**
 * Where step 1's three pieces of writing go around the address and its drain.
 *
 * The address's name, the connector's "about N m away" and the coach mark all
 * belong to two points that are often close — the demonstration address is
 * 24 m from its nearest comparable drain, which at the fitted zoom is about
 * sixty pixels. Placed at fixed offsets, the three sat on top of one another
 * and on top of the pin: found in the browser, on the first address anybody
 * is offered. So each is put on the side away from the other point, the
 * distance moves off the connector when the connector is too short to carry
 * it, and on a phone — where neither side of a drain has room for the coach
 * mark — the coach mark goes above or below instead of over the drain.
 *
 * **Away from the other point was not enough.** In the user test of
 * 15 September, at 200 Bourke Street, the drain was about 10 m from the
 * address: the distance label covered the drain's icon and the coach mark's
 * left edge sat on its ripple, so only the ripple showed — and the person
 * pressed beside the drain rather than on it. Offsets measured from the
 * drain's centre knew nothing about how big the drain is drawn. So both are
 * now chosen from a short list of candidate places, and a candidate is only
 * taken if it keeps clear of the drain's whole ripple and the whole pin. When
 * none does — a canvas too small for anything — the one covering least wins.
 */

import { COMPARISON_MARK_R, PIN_DROP, PIN_HEAD_R, SUGGESTED_HALO_R } from './draw.js';

export type Point = readonly [x: number, y: number];

export interface LabelPlacement {
  /** The address name: its anchor, and whether it runs leftward from there. */
  readonly address: { readonly at: Point; readonly alignRight: boolean };
  /**
   * The distance line. `centre` is centred on `at`; `left` and `right` hang
   * from `at` as their top-left or top-right corner, so the writing runs
   * away from the point it is anchored beside.
   */
  readonly distance: { readonly at: Point; readonly align: 'centre' | 'left' | 'right' };
  /** The coach mark's top-left corner. */
  readonly coach: Point;
}

/** An axis-aligned rectangle in canvas pixels. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** A connector shorter than this, in pixels, cannot carry its own label. */
export const SHORT_CONNECTOR_PX = 180;

/** The coach mark's size, which `ComparisonMap` draws it at. */
export const COACH_WIDTH_PX = 232;
export const COACH_HEIGHT_PX = 76;

/**
 * About as wide as "Nearest drain you can test · about 200 m away" sets.
 * Measured at 254 px for "about 20 m" in Chromium on Windows, with a little
 * over for a wider system font.
 */
export const DISTANCE_LABEL_PX = 270;

/** The distance line's height, with its padding and border. */
export const DISTANCE_LABEL_HEIGHT_PX = 28;

/** Clear space kept between any writing and the edge of a mark. */
export const MARK_CLEARANCE_PX = 6;

/** Nothing is placed closer than this to the canvas edge. */
const EDGE_PX = 8;

const clampTo = (value: number, low: number, high: number): number => Math.max(low, Math.min(value, high));

const boxAt = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

/** How many square pixels two boxes share. Touching edges share none. */
export const overlapArea = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/**
 * What the suggested drain occupies on screen: its ripple, and the clearance.
 *
 * A square round the circle rather than the circle, which costs a few corner
 * pixels of room and keeps every test here a comparison of four numbers.
 */
export function drainMarkBox(drain: Point): Box {
  const reach = SUGGESTED_HALO_R + MARK_CLEARANCE_PX;
  return { left: drain[0] - reach, top: drain[1] - reach, right: drain[0] + reach, bottom: drain[1] + reach };
}

/**
 * What the address pin occupies on screen: head, stem and shadow, and the
 * clearance. The pin stands above the point, so almost all of it is above.
 */
export function pinMarkBox(address: Point): Box {
  const half = PIN_HEAD_R + 1.25 + MARK_CLEARANCE_PX;
  return {
    left: address[0] - half,
    top: address[1] - PIN_DROP - PIN_HEAD_R - 1.25 - MARK_CLEARANCE_PX,
    right: address[0] + half,
    bottom: address[1] + 2 + MARK_CLEARANCE_PX,
  };
}

/** The box the distance line takes up, for a placement and the width it is drawn at. */
export function distanceBox(distance: LabelPlacement['distance'], widthPx: number = DISTANCE_LABEL_PX): Box {
  const [x, y] = distance.at;
  if (distance.align === 'centre') {
    return boxAt(x - widthPx / 2, y - DISTANCE_LABEL_HEIGHT_PX / 2, widthPx, DISTANCE_LABEL_HEIGHT_PX);
  }
  return boxAt(distance.align === 'left' ? x : x - widthPx, y, widthPx, DISTANCE_LABEL_HEIGHT_PX);
}

/** The coach mark's box, from its top-left corner. */
export const coachBox = (coach: Point): Box => boxAt(coach[0], coach[1], COACH_WIDTH_PX, COACH_HEIGHT_PX);

const onCanvas = (box: Box, width: number, height: number): boolean =>
  box.left >= EDGE_PX - 0.5 && box.top >= EDGE_PX - 0.5 && box.right <= width - EDGE_PX + 0.5 && box.bottom <= height - EDGE_PX + 0.5;

/**
 * The first candidate that is on the canvas and covers nothing, or else the
 * one that covers least. Order is preference, so ties go to the earlier one.
 */
function choose<T>(candidates: readonly T[], boxOf: (c: T) => Box, avoid: readonly Box[], width: number, height: number): T {
  let best: { candidate: T; covered: number } | null = null;
  for (const candidate of candidates) {
    const box = boxOf(candidate);
    const covered = avoid.reduce((sum, mark) => sum + overlapArea(box, mark), 0);
    if (covered === 0 && onCanvas(box, width, height)) return candidate;
    // A candidate off the canvas is only a last resort, behind every one on it.
    const score = covered + (onCanvas(box, width, height) ? 0 : 1e9);
    if (best === null || score < best.covered) best = { candidate, covered: score };
  }
  // `candidates` is never empty below.
  return (best as { candidate: T }).candidate;
}

/**
 * Place the three labels for an address at `address` and its drain at `drain`,
 * on a canvas `width` by `height` pixels.
 *
 * - The coach mark goes beside the drain on its far side from the address,
 *   then on the near side, then above or below it — away from the address
 *   first — and failing those, at whichever other place nearest the drain
 *   keeps clear of the drain's ripple, the pin and (given its width) the name.
 * - The address name goes on the address's far side from the drain.
 * - The distance sits on the connector's midpoint when the connector is long
 *   enough, and otherwise hangs beside the pin, under it or above the name;
 *   failing those, it takes the place nearest the pin that keeps clear of
 *   both marks, the name and the coach mark.
 */
export function placeStepOneLabels(
  address: Point,
  drain: Point,
  width: number,
  height: number,
  nameWidthPx = 0,
): LabelPlacement {
  const drainIsRight = drain[0] >= address[0];
  const pin = pinMarkBox(address);
  const drainBox = drainMarkBox(drain);
  const named: LabelPlacement['address'] = {
    at: [drainIsRight ? address[0] - 14 : address[0] + 14, address[1] - 20],
    alignRight: drainIsRight,
  };
  // The address name is kept clear too, when its width is known: at 67 Altona
  // Street, with the drain 3 m away, the coach mark covered it entirely.
  const name = nameWidthPx > 0 ? [nameBox(named, nameWidthPx)] : [];
  const marks = [drainBox, pin, ...name];
  const reach = SUGGESTED_HALO_R + MARK_CLEARANCE_PX;
  const nearest = (to: Point, box: Box) => Math.hypot((box.left + box.right) / 2 - to[0], (box.top + box.bottom) / 2 - to[1]);

  // ---- The coach mark -------------------------------------------------------
  const fitX = (x: number) => clampTo(x, EDGE_PX, Math.max(EDGE_PX, width - EDGE_PX - COACH_WIDTH_PX));
  const fitY = (y: number) => clampTo(y, EDGE_PX, Math.max(EDGE_PX, height - EDGE_PX - COACH_HEIGHT_PX));
  const besideY = drain[1] - COACH_HEIGHT_PX / 2;
  const right: Point = [drain[0] + reach, besideY];
  const left: Point = [drain[0] - reach - COACH_WIDTH_PX, besideY];
  const above: Point = [fitX(drain[0] - COACH_WIDTH_PX / 2), drain[1] - reach - COACH_HEIGHT_PX];
  const below: Point = [fitX(drain[0] - COACH_WIDTH_PX / 2), drain[1] + reach];
  const sides = drainIsRight ? [right, left] : [left, right];
  const ends = address[1] >= drain[1] ? [above, below] : [below, above];
  // Everywhere else worth trying: beside, above or below the drain, or
  // against either side of the pin, at every height that lines the card up
  // with an edge of one of the two marks. Nearest the drain first, so the card
  // still reads as belonging to it.
  const xs = [right[0], left[0], above[0], fitX(pin.right), fitX(pin.left - COACH_WIDTH_PX)];
  const ys = [
    besideY,
    drainBox.bottom - COACH_HEIGHT_PX,
    drainBox.top,
    above[1],
    below[1],
    ...[pin, ...name].flatMap((box) => [box.bottom, box.top - COACH_HEIGHT_PX]),
  ];
  const grid = xs
    .flatMap((x) => ys.map((y) => [x, y] as Point))
    .sort((a, b) => nearest(drain, coachBox(a)) - nearest(drain, coachBox(b)));
  // Last resorts, already pushed onto the canvas: covering least wins among them.
  const pushed = [...ends, ...sides].map(([x, y]) => [fitX(x), fitY(y)] as Point);
  const coach = choose([...sides, ...ends, ...grid, ...pushed], coachBox, marks, width, height);
  const card = coachBox(coach);

  // ---- The distance ---------------------------------------------------------
  const connectorPx = Math.hypot(drain[0] - address[0], drain[1] - address[1]);
  // Running away from the drain, from just beside the pin; pushed back onto
  // the canvas at either edge rather than cut off.
  const hanging = (top: number): LabelPlacement['distance'] =>
    drainIsRight
      ? address[0] + 12 - DISTANCE_LABEL_PX >= EDGE_PX
        ? { at: [address[0] + 12, top], align: 'right' }
        : { at: [EDGE_PX, top], align: 'left' }
      : address[0] - 12 + DISTANCE_LABEL_PX <= width - EDGE_PX
        ? { at: [address[0] - 12, top], align: 'left' }
        : { at: [width - EDGE_PX, top], align: 'right' };
  const centredOn = (x: number, top: number): LabelPlacement['distance'] => ({
    at: [clampTo(x, EDGE_PX + DISTANCE_LABEL_PX / 2, width - EDGE_PX - DISTANCE_LABEL_PX / 2), top + DISTANCE_LABEL_HEIGHT_PX / 2],
    align: 'centre',
  });
  // Above the pin, the address name sits level with the pin's head, so above
  // the pin means above the name too.
  const nameTop = address[1] - 20 - 12;
  const line = DISTANCE_LABEL_HEIGHT_PX;
  const tops = [
    Math.max(address[1] + 16, pin.bottom),
    Math.min(pin.top, nameTop) - line,
    drainBox.bottom,
    drainBox.top - line,
    card.bottom,
    card.top - line,
    Math.max(pin.bottom, drainBox.bottom),
    Math.min(pin.top, nameTop, drainBox.top) - line,
    Math.max(pin.bottom, drainBox.bottom, card.bottom),
    Math.min(pin.top, nameTop, drainBox.top, card.top) - line,
    ...name.flatMap((box) => [box.bottom, box.top - line]),
  ];
  const others = tops
    .flatMap((top) => [hanging(top), centredOn(address[0], top), centredOn(drain[0], top)])
    .sort((a, b) => nearest(address, distanceBox(a)) - nearest(address, distanceBox(b)));
  const candidates: LabelPlacement['distance'][] = [
    ...(connectorPx >= SHORT_CONNECTOR_PX
      ? [{ at: [(address[0] + drain[0]) / 2, (address[1] + drain[1]) / 2] as Point, align: 'centre' as const }]
      : []),
    hanging(tops[0] ?? address[1] + 16),
    hanging(tops[1] ?? nameTop - line),
    ...others,
  ];
  const distance = choose(candidates, (c) => distanceBox(c), [...marks, card], width, height);

  return { address: named, distance, coach };
}

/** The *Selected drain* label's size, which `ComparisonMap` draws it at. */
export const SELECTED_LABEL_PX = 190;
export const SELECTED_LABEL_HEIGHT_PX = 44;

/** The chosen drain's painted disc, its edge, and the clearance. */
const SELECTED_REACH_PX = COMPARISON_MARK_R + 1.5 + MARK_CLEARANCE_PX;

/** The box the address name takes up, from its placement and an estimated width. */
export function nameBox(address: LabelPlacement['address'], widthPx: number): Box {
  const [x, y] = address.at;
  return boxAt(address.alignRight ? x - widthPx : x, y - 10, widthPx, 20);
}

/**
 * The top-left corner of step 2 and 3's *Selected drain* label.
 *
 * Beside the chosen drain on whichever side is free, then above or below it,
 * and in every case clear of the drain's disc, the address pin and the
 * address name. It used to go to the right whenever that fitted the canvas,
 * which at 73 Bayswater Road — the drain 10 m left of the address — laid it
 * straight over the pin and the name.
 */
export function placeSelectedLabel(
  drain: Point,
  address: Point | null,
  name: Box | null,
  width: number,
  height: number,
): Point {
  const W = SELECTED_LABEL_PX;
  const H = SELECTED_LABEL_HEIGHT_PX;
  const fitX = (x: number) => clampTo(x, EDGE_PX, Math.max(EDGE_PX, width - EDGE_PX - W));
  const fitY = (y: number) => clampTo(y, EDGE_PX, Math.max(EDGE_PX, height - EDGE_PX - H));
  const disc: Box = {
    left: drain[0] - SELECTED_REACH_PX,
    top: drain[1] - SELECTED_REACH_PX,
    right: drain[0] + SELECTED_REACH_PX,
    bottom: drain[1] + SELECTED_REACH_PX,
  };
  const pin = address === null ? null : pinMarkBox(address);
  const avoid = [disc, ...(pin === null ? [] : [pin]), ...(name === null ? [] : [name])];
  const right = disc.right + 2;
  const left = disc.left - 2 - W;
  const centred = fitX(drain[0] - W / 2);
  const beside = drain[1] - H / 2;
  const ys = [beside, disc.top - H, disc.bottom, ...avoid.flatMap((box) => [box.top - H, box.bottom])];
  const grid = [right, left, centred]
    .flatMap((x) => ys.map((y) => [x, y] as Point))
    .sort(
      (a, b) =>
        Math.hypot(a[0] + W / 2 - drain[0], a[1] + H / 2 - drain[1]) -
        Math.hypot(b[0] + W / 2 - drain[0], b[1] + H / 2 - drain[1]),
    );
  // Last resorts, pushed onto the canvas: covering least wins among them.
  const pushed: Point[] = [
    [fitX(right), fitY(beside)],
    [fitX(left), fitY(beside)],
    [centred, fitY(disc.top - H)],
    [centred, fitY(disc.bottom)],
  ];
  const box = (at: Point) => boxAt(at[0], at[1], W, H);
  return choose([[right, beside] as Point, [left, beside] as Point, ...grid, ...pushed], box, avoid, width, height);
}

/**
 * The one-line reason on a grey pit, if it may still be shown.
 *
 * Each reason is held with the step it was raised on, and shown only on that
 * step. In the 15 September user test the hover reason for a grey pit stayed
 * on screen through steps 2 and 3 and onto the result, over the *Selected
 * drain* label. Clearing hover on every event that should end it is done as
 * well, in `MapCanvas` and `ComparisonMap`; this makes a stale reason
 * impossible rather than merely unlikely.
 */
export interface HeldReason<P> {
  readonly pit: P;
  readonly reason: string;
  readonly step: string;
}

export function reasonOnScreen<P>(
  hovered: HeldReason<P> | null,
  pressed: HeldReason<P> | null,
  step: string,
): HeldReason<P> | null {
  if (hovered !== null && hovered.step === step) return hovered;
  if (pressed !== null && pressed.step === step) return pressed;
  return null;
}
