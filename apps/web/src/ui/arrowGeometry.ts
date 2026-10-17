/**
 * Where the guide's arrow starts, where it lands, and how it bends.
 *
 * The drawing is `GuideArrow.tsx`. The two are not one file because a module
 * cannot sit beside another whose name differs from it only in case, and
 * they are named apart rather than merged because the geometry is the half
 * worth testing.
 *
 * **The mentor found a ring on its own too ambiguous** (team, 17 October): a
 * circle says *something here matters* and leaves the reader to work out
 * which of the things under it is the one to press. An arrow says which. So
 * every step that asks for a press now draws both, and this file is the
 * geometry of the second one.
 *
 * It is separated from the component that draws it because geometry is the
 * part that can be wrong in ways a screenshot will not show -- an arrowhead
 * a degree out, a line that starts inside the box it is leaving -- and this
 * repository tests logic rather than rendering.
 *
 * Everything here is in **viewport pixels**, the frame `getBoundingClientRect`
 * reports in, because that is the frame the overlay is drawn in and
 * converting twice is how an arrow ends up pointing at where something was
 * before the map moved.
 */

/** The Figma orange, shared by the ring and the arrow (team, 17 October). */
export const GUIDE_ORANGE = '#EA6B1A';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A rectangle as `getBoundingClientRect` gives one, and nothing more. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const centreOf = (box: Box): Point => ({
  x: (box.left + box.right) / 2,
  y: (box.top + box.bottom) / 2,
});

/**
 * The point on a box's edge in the direction of `towards`, pushed out by
 * `gap`.
 *
 * The arrow has to stop at the edge of the thing it points at rather than in
 * the middle of it: an arrowhead over a label is an arrowhead over the word
 * the reader is being asked to find. A box with no width or height has no
 * edge to find, so its centre is the answer.
 */
export function edgePoint(box: Box, towards: Point, gap = 0): Point {
  const c = centreOf(box);
  const dx = towards.x - c.x;
  const dy = towards.y - c.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return c;

  const halfWidth = (box.right - box.left) / 2;
  const halfHeight = (box.bottom - box.top) / 2;
  // How far along the direction the edge is: whichever side is met first.
  const toSide = halfWidth === 0 ? Infinity : Math.abs(halfWidth / (dx / length));
  const toTopOrBottom = halfHeight === 0 ? Infinity : Math.abs(halfHeight / (dy / length));
  const reach = Math.min(toSide, toTopOrBottom);
  const out = (Number.isFinite(reach) ? reach : 0) + gap;
  return { x: c.x + (dx / length) * out, y: c.y + (dy / length) * out };
}

/**
 * How far the curve bows away from the straight line between its ends.
 *
 * A straight line between two boxes reads as a rule or a border, especially
 * over a map that is full of straight lines already. A shallow curve reads as
 * something drawn on top to point at something.
 */
const BOW = 0.16;

/**
 * The control point of the quadratic the arrow is drawn as.
 *
 * Always bowed to the same side of the direction of travel, so two steps in a
 * row do not flip the curve about and draw attention to the arrow instead of
 * to what it points at.
 */
export function bowOf(start: Point, end: Point, bow = BOW): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const mid = { x: start.x + dx / 2, y: start.y + dy / 2 };
  const length = Math.hypot(dx, dy);
  if (length === 0) return mid;
  // The left-hand normal of the direction of travel.
  return { x: mid.x + (-dy / length) * length * bow, y: mid.y + (dx / length) * length * bow };
}

/**
 * The direction the arrowhead points, which is the curve's own at the end.
 *
 * For a quadratic the tangent at the far end is the line from the control
 * point to it, which is why the head is never computed from the straight
 * line between the ends: on a bowed curve that is visibly the wrong angle.
 */
export const headAngle = (control: Point, end: Point): number =>
  Math.atan2(end.y - control.y, end.x - control.x);

/** The three corners of the head, as `points` for an SVG polygon. */
export function headPoints(end: Point, angle: number, size: number): string {
  const spread = 0.42;
  const corner = (turn: number): string => {
    const x = end.x - Math.cos(angle + turn) * size;
    const y = end.y - Math.sin(angle + turn) * size;
    return `${String(Math.round(x * 10) / 10)},${String(Math.round(y * 10) / 10)}`;
  };
  return `${String(Math.round(end.x * 10) / 10)},${String(Math.round(end.y * 10) / 10)} ${corner(spread)} ${corner(-spread)}`;
}

/** How far the line stops short of the target, leaving its hit area clear. */
const TARGET_GAP = 10;
/** And how far clear of the words it starts. */
const SOURCE_GAP = 6;

/**
 * Under this many pixels apart, an arrow is noise rather than direction.
 *
 * It happens when the step panel and its target end up beside each other on a
 * narrow window: the head would land on the words that sent the reader there.
 */
const TOO_CLOSE = 48;

export interface Arrow {
  readonly start: Point;
  readonly control: Point;
  readonly end: Point;
  readonly angle: number;
}

/**
 * The whole arrow, or null where drawing one would not help.
 *
 * Null rather than a flag, because every caller's answer to *should this be
 * drawn* is the same: do not draw it.
 */
export function arrowBetween(from: Box, to: Box): Arrow | null {
  const target = centreOf(to);
  const source = centreOf(from);
  if (Math.hypot(target.x - source.x, target.y - source.y) < TOO_CLOSE) return null;

  const start = edgePoint(from, target, SOURCE_GAP);
  const end = edgePoint(to, source, TARGET_GAP);
  if (Math.hypot(end.x - start.x, end.y - start.y) < TOO_CLOSE / 2) return null;

  const control = bowOf(start, end);
  return { start, control, end, angle: headAngle(control, end) };
}

/** Is the target somewhere a reader can actually see it? */
export function onScreen(box: Box, width: number, height: number): boolean {
  if (box.right <= 0 || box.bottom <= 0) return false;
  if (box.left >= width || box.top >= height) return false;
  return box.right - box.left > 0 && box.bottom - box.top > 0;
}

/** The `d` of the path, rounded so a jittering rect does not redraw forever. */
export const pathOf = (arrow: Arrow): string => {
  const at = (p: Point): string => `${String(Math.round(p.x * 10) / 10)} ${String(Math.round(p.y * 10) / 10)}`;
  return `M ${at(arrow.start)} Q ${at(arrow.control)} ${at(arrow.end)}`;
};
