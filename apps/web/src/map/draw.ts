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
import { type Frame, type PlaceCandidate, placeNames, placeOpacity, placesIn, tracked } from './places.js';

export interface Palette {
  readonly ground: string;
  /**
   * Outside the extent, and it must not look like ground.
   *
   * The ground used to be painted over the whole canvas, which was invisible
   * while the map could never be zoomed out past covering it. It can be now,
   * and a margin in the ground colour would read as **land inside the extent
   * with nothing recorded on it** — the opposite of the truth, which is that
   * the city continues and this map stops.
   */
  readonly beyond: string;
  readonly road: string;
  readonly roadEdge: string;
  readonly pipe: string;
  readonly pit: string;
  readonly pitEdge: string;
  readonly selected: string;
  readonly suggested: string;
  readonly comparable: string;
  /**
   * A pit the comparison cannot use, while the comparison is asking for one.
   *
   * Pale and small rather than hidden. The prototype's annotation is that a
   * resident should be able to see the model chose one drain out of many and
   * that the rest are unavailable — which a map that removed them cannot say.
   */
  readonly unavailable: string;
  readonly label: string;
  readonly labelHalo: string;
  /** Suburb names: darker than a street name, because they are read from further out. */
  readonly place: string;
  readonly placeHalo: string;
  readonly address: string;
  readonly addressHalo: string;
}

/** Muted on purpose: the recorded network is context, not the answer. */
export const DAY: Palette = {
  ground: '#eef3ea',
  // A shade off the ground and cooler than it: enough to read as a different
  // surface at a glance, quiet enough not to become a border people look at.
  beyond: '#e4e7e9',
  road: '#ffffff',
  roadEdge: '#e2e8dd',
  pipe: '#31435a',
  pit: '#2f6f62',
  pitEdge: '#ffffff',
  selected: '#0f766e',
  // Teal ring: a drain the comparison can be calculated for (AC 3.1.1.a).
  comparable: '#0f8b8d',
  // Amber, matching the panel's "suggested, not your choice yet" note. A
  // suggestion drawn in the chosen colour is a choice the person did not make.
  suggested: '#b4690e',
  // Grey, and lighter than the street labels, so it recedes behind them.
  unavailable: '#b9c3ca',
  label: '#5b6b7a',
  labelHalo: '#ffffff',
  // Near-black ink rather than the street grey. At the overview the names sit
  // over thousands of dark pipes, and grey over that is a smudge.
  place: '#253241',
  placeHalo: '#ffffff',
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
  comparable: ReadonlySet<string> | null = null,
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

    // Which drains a comparison can use, before anybody chooses (AC 3.1.1.a).
    // A ring rather than a fill, so the recorded pit underneath still reads as
    // the council's; nothing is drawn on the others, and the legend says that
    // an unringed drain is a limit of the calculation, not a finding.
    if (comparable !== null && comparable.has(String(pit.asset_number ?? ''))) {
      context.beginPath();
      context.arc(x, y, radius + 3.5, 0, Math.PI * 2);
      context.strokeStyle = palette.comparable;
      context.lineWidth = 2;
      context.stroke();
      context.lineWidth = 1.5;
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
 * The drains while the blocked-drain comparison is asking for one.
 *
 * Separate from `DrawOptions.suggestedPit` and `comparablePits`, which the
 * guide and the full map use with their own meaning: there a suggestion is an
 * amber "not your choice yet" ring. Here the design is the Blockage Flow
 * prototype's, and its colours mean one thing each — teal for a drain that can
 * be tested, grey for one that cannot, orange only for the address.
 */
export interface ComparisonMarks {
  /** Asset numbers the engine can calculate a comparison for. */
  readonly comparable: ReadonlySet<string>;
  /** Step 1's highlighted drain: filled teal, with a ripple around it. */
  readonly suggested: number | null;
  /** The chosen drain: filled teal, with a white tick. */
  readonly selected: number | null;
}

/** How opaque the ring on a comparable drain that is not the suggestion is. */
export const OTHER_COMPARABLE_ALPHA = 0.4;

/** Radius of the suggested and selected markers, which are drawn at a fixed size. */
export const COMPARISON_MARK_R = 12;

/**
 * Every pit, as the comparison needs them read.
 *
 * Two passes. The ordinary pits first — grey when the comparison cannot use
 * them, the council's own marker with a 40% teal ring when it can — and then
 * the highlighted and chosen drains on top, so a neighbouring pit a few pixels
 * away never paints over the one the screen is talking about.
 */
function drawComparisonPits(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  pits: readonly Pit[],
  palette: Palette,
  seen: Extremes,
  marks: ComparisonMarks,
): void {
  const radius = Math.max(2.5, Math.min(7, viewport.scale * 2.2));
  const emphasised: { pit: Pit; kind: 'suggested' | 'selected' }[] = [];

  for (const pit of pits) {
    const [east, north] = pit.c;
    if (east < seen.minE || east > seen.maxE || north < seen.minN || north > seen.maxN) continue;
    if (marks.selected !== null && pit.asset_number === marks.selected) {
      emphasised.push({ pit, kind: 'selected' });
      continue;
    }
    if (marks.suggested !== null && pit.asset_number === marks.suggested) {
      emphasised.push({ pit, kind: 'suggested' });
      continue;
    }
    const [x, y] = toScreen(viewport, pit.c);
    if (!marks.comparable.has(String(pit.asset_number ?? ''))) {
      // Smaller than a comparable pit and without an edge, so it reads as
      // part of the network rather than as something to press.
      context.beginPath();
      context.arc(x, y, Math.max(2, radius * 0.6), 0, Math.PI * 2);
      context.fillStyle = palette.unavailable;
      context.fill();
      continue;
    }
    if (viewport.scale >= ICON_MIN_SCALE) {
      drawPitIcon(context, x, y, palette.pit);
    } else {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = palette.pit;
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = palette.pitEdge;
      context.stroke();
    }
    const ring = viewport.scale >= ICON_MIN_SCALE ? 15 : radius + 3.5;
    context.save();
    context.globalAlpha = OTHER_COMPARABLE_ALPHA;
    context.beginPath();
    context.arc(x, y, ring, 0, Math.PI * 2);
    context.strokeStyle = palette.comparable;
    context.lineWidth = 2.5;
    context.stroke();
    context.restore();
  }

  for (const { pit, kind } of emphasised) {
    const [x, y] = toScreen(viewport, pit.c);
    if (kind === 'suggested') {
      // The ripple: two soft discs, the only translucent fill on the map
      // besides the difference, and teal rather than violet so the two can
      // never be read as one thing.
      context.save();
      context.globalAlpha = 0.14;
      context.beginPath();
      context.arc(x, y, COMPARISON_MARK_R * 2.6, 0, Math.PI * 2);
      context.fillStyle = palette.selected;
      context.fill();
      context.globalAlpha = 0.22;
      context.beginPath();
      context.arc(x, y, COMPARISON_MARK_R * 1.7, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.beginPath();
    context.arc(x, y, COMPARISON_MARK_R, 0, Math.PI * 2);
    context.fillStyle = palette.selected;
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = palette.pitEdge;
    context.stroke();

    context.strokeStyle = palette.pitEdge;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (kind === 'selected') {
      // The tick: chosen, and nothing left to confirm.
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(x - 5, y + 0.5);
      context.lineTo(x - 1.5, y + 4);
      context.lineTo(x + 5.5, y - 3.5);
      context.stroke();
    } else {
      // Four grate bars, so the highlighted drain still reads as a drain.
      context.lineWidth = 1.8;
      for (const dx of [-4.5, -1.5, 1.5, 4.5]) {
        context.beginPath();
        context.moveTo(x + dx, y - 5);
        context.lineTo(x + dx, y + 5);
        context.stroke();
      }
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

/**
 * The suburb names' type: the street names' size, heavier, and set in spaced
 * capitals by `tracked`. Not bigger, because the capitals and the spacing
 * already make each name twice as wide, and width is what collides.
 */
export const PLACE_FONT = '700 11px system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Suburb names, for the zoom at which the map is a city rather than a street.
 *
 * Over the drainage network, because at the council overview there are
 * seventeen thousand pipes and a name drawn under them is not read. Under the
 * street names, which take over as these fade — see `PLACE_HIDDEN_SCALE`.
 *
 * Over the pits too, which is cheaper than it sounds. Pits are not drawn below
 * `PIT_MIN_SCALE`, which is exactly where these begin to fade, so the two only
 * share the screen while the names are on their way out — and it is fourteen
 * short names across a whole council, not a label on every block.
 */
function drawPlaceNames(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  extent: Frame,
  palette: Palette,
): void {
  const opacity = placeOpacity(viewport.scale);
  if (opacity <= 0) return;
  const inExtent = placesIn(extent);
  if (inExtent.length === 0) return;

  context.save();
  context.font = PLACE_FONT;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const candidates: PlaceCandidate[] = inExtent.map(({ place, at }) => {
    const text = tracked(place.name);
    const [x, y] = toScreen(viewport, at);
    return { text, x, y, widthPx: context.measureText(text).width, rank: place.rank };
  });

  context.globalAlpha = opacity;
  // Round joins, or the halo grows spikes at the points of M, N and W.
  context.lineJoin = 'round';
  context.lineWidth = 3.5;
  context.strokeStyle = palette.placeHalo;
  context.fillStyle = palette.place;
  for (const label of placeNames(candidates, viewport)) {
    context.strokeText(label.text, label.x, label.y);
    context.fillText(label.text, label.x, label.y);
  }
  context.restore();
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
  /** Drains a comparison can be calculated for, ringed (AC 3.1.1.a). */
  readonly comparablePits?: ReadonlySet<string> | null;
  /**
   * The blocked-drain comparison's own reading of the pits.
   *
   * When given, it replaces `selectedPit`, `suggestedPit` and `comparablePits`
   * for the pits, and is drawn at every zoom at which pits are drawn.
   */
  readonly comparison?: ComparisonMarks | null;
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
   * Painted over the flat ground and under the roads: the terrain's colour.
   *
   * A hook rather than a layer drawn before `drawMap`, because `drawMap` opens
   * by filling the canvas. The terrain was once drawn first and erased by that
   * fill before anything else was painted, which a teammate reported —
   * accurately — as "the button does nothing".
   */
  readonly beneathRoads?: (context: CanvasRenderingContext2D) => void;
  /**
   * Painted over the roads and under the drainage network: the hillshade.
   *
   * Terrain V1.1's order. The shading multiplies over the ground and the
   * streets together, so a road reads as part of the landform; pipes, pits and
   * labels go on top and are never darkened by it.
   */
  readonly overRoads?: (context: CanvasRenderingContext2D) => void;
}

/** The address pin: head radius, and the drop from the head's centre to the tip. */
export const PIN_HEAD_R = 7.5;
export const PIN_DROP = 21;

/**
 * The outline of a map pin whose tip is exactly on the point it marks.
 *
 * A teardrop is a circle plus the two tangent lines from the tip to it, and
 * the tangency is what makes the shape read as one form rather than as a
 * lollipop. For a tip at distance `PIN_DROP` from a head of radius
 * `PIN_HEAD_R`, each tangent point sits `acos(r / d)` around the head from the
 * line joining the two centres — which is why the head has to be smaller than
 * the drop, and why this is computed rather than eyeballed.
 *
 * Exported for the test, which checks the tangent rather than the pixels.
 */
export function pinOutline(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  const cy = y - PIN_DROP;
  const spread = Math.acos(PIN_HEAD_R / PIN_DROP);
  const down = Math.PI / 2;
  context.beginPath();
  // The long way around, over the top of the head, between the two tangents.
  context.arc(x, cy, PIN_HEAD_R, down + spread, down - spread);
  context.lineTo(x, y);
  context.closePath();
}

/**
 * How far from the pin a press still counts as pressing it.
 *
 * A pin is 15 pixels across and 28 tall, which is smaller than a fingertip and
 * about the size of a careless mouse. The pad is added around the shape rather
 * than baked into a bigger drawing: the mark stays the size it should be and
 * the target is the size a hand needs.
 */
export const PIN_TOUCH_PAD_PX = 6;

/**
 * Is this press on the address pin?
 *
 * **Built from the same two constants that draw it**, so the target and the
 * mark cannot drift apart — the failure that would produce is a pin somebody
 * can see and cannot press, which reads as the application ignoring them.
 *
 * A rectangle rather than the teardrop itself. Pointer accuracy is worth more
 * here than geometric honesty, and the difference between the box and the
 * shape is a few pixels of empty ground beside a mark nothing else occupies.
 */
export function pressedThePin(
  press: readonly [number, number],
  pin: readonly [number, number],
): boolean {
  const [px, py] = press;
  const [x, tip] = pin;
  const halfWidth = PIN_HEAD_R + PIN_TOUCH_PAD_PX;
  // The head's top is PIN_DROP + PIN_HEAD_R above the tip; the tip is the
  // bottom of the shape.
  return (
    px >= x - halfWidth &&
    px <= x + halfWidth &&
    py >= tip - PIN_DROP - PIN_HEAD_R - PIN_TOUCH_PAD_PX &&
    py <= tip + PIN_TOUCH_PAD_PX
  );
}

/**
 * The selected address.
 *
 * **A pin standing on the point, not a ring around it.** The ring this
 * replaced was centred on the address, which put the mark and the thing it
 * marks in the same place: at street zoom it sat over the very pits and paths
 * a person had come to read, and it was reported — fairly — as looking like a
 * crosshair rather than like *you are here*. A pin occupies the empty space
 * above instead, and its tip is the only part that claims a position.
 *
 * It is deliberately the one thing on this map that is not drawn from an
 * artefact, and it keeps the warm colour no layer uses.
 */
export function drawAddress(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  at: Local,
  palette: Palette,
): void {
  const [x, y] = toScreen(viewport, at);

  // A shadow on the ground, so the pin reads as standing on the point rather
  // than as floating above it with its tip pointing at nothing.
  context.beginPath();
  context.ellipse(x, y, 4, 1.6, 0, 0, Math.PI * 2);
  context.fillStyle = 'rgba(15, 23, 42, 0.22)';
  context.fill();

  pinOutline(context, x, y);
  context.lineWidth = 2.5;
  context.strokeStyle = palette.addressHalo;
  context.stroke();
  context.fillStyle = palette.address;
  context.fill();

  // The eye. It sits on the head's centre, which `pinOutline` also uses, so
  // the two cannot drift apart when the proportions are changed.
  context.beginPath();
  context.arc(x, y - PIN_DROP, 2.8, 0, Math.PI * 2);
  context.fillStyle = palette.addressHalo;
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

  /*
    The ground is the extent, not the canvas.

    Zooming out far enough now leaves margin around the map — see
    `scaleToContain` — and filling all of it with the ground colour would
    say the city stops at the council boundary. It does not; the map does.
  */
  context.fillStyle = palette.beyond;
  context.fillRect(0, 0, viewport.widthPx, viewport.heightPx);

  const [left, top] = toScreen(viewport, [0, artefact.extent.height_m]);
  const [right, bottom] = toScreen(viewport, [artefact.extent.width_m, 0]);
  context.fillStyle = palette.ground;
  context.fillRect(left, top, right - left, bottom - top);

  options.beneathRoads?.(context);
  if (options.showRoads !== false) {
    drawRoads(context, viewport, artefact.layers.road ?? [], palette, seen);
  }
  options.overRoads?.(context);
  if (options.showPipes !== false) {
    drawPipes(context, viewport, artefact.layers.pipe ?? [], palette, seen, options.selectedPipe ?? null);
  }

  if (options.comparison && options.showPits !== false && viewport.scale >= PIT_MIN_SCALE) {
    drawComparisonPits(context, viewport, artefact.layers.pit ?? [], palette, seen, options.comparison);
  } else if (options.showPits !== false && viewport.scale >= PIT_MIN_SCALE) {
    drawPits(
      context,
      viewport,
      artefact.layers.pit ?? [],
      palette,
      seen,
      options.selectedPit ?? null,
      options.suggestedPit ?? null,
      options.comparablePits ?? null,
    );
  }
  drawPlaceNames(context, viewport, artefact.extent, palette);
  if (viewport.scale >= LABEL_MIN_SCALE) {
    drawStreetNames(context, viewport, artefact.layers['street-name'] ?? [], palette, seen);
  }

  // Last, and never culled by `seen`: a marker just off screen is the one
  // thing a person needs to be able to pan back towards.
  if (options.address) drawAddress(context, viewport, options.address, palette);
}

export type { LineFeature, PolygonFeature };
