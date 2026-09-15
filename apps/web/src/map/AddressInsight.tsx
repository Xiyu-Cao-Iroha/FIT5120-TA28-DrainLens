/**
 * What was measured around an address, as one small figure — terrain handover §3.
 *
 * It used to be two filled arrows, one to the nearest water path and one to the
 * nearest low area, both saying "a thing is over there" in the same shape as a
 * movement. With the ground's own fall added there would have been three
 * arrows meaning two different things. So the figure has one rule and does not
 * break it:
 *
 * > **An arrow is a trend or a movement. A line with an end mark is a thing
 * > that is there.**
 *
 * | Mark | Meaning | Label |
 * |---|---|---|
 * | Orange arrow | which way the ground around the address generally falls | *Steep slope down* or *Gentle slope downhill this way* |
 * | Blue dashed line, short bar at the end | the nearest mapped likely water path | *Water may flow* |
 * | Lighter blue dashed line, oval at the end | the nearest mapped low area | *Water may pool* |
 * | Orange dot | the address | |
 *
 * **The labels say what a resident wants to know, not what was calculated.**
 * Team review item 16: *likely water path*, *low area*, *ground falls ≈ 4.0 m
 * over 150 m* and a three-line key (*Arrow = …, Dashed = …*) were not
 * understood. Each label now says where water may flow, where it may pool
 * and where the ground slopes steeply, hedged with *may* as everywhere else, so
 * the marks need no key. (*Pool* rather than *collect* from copy audit v2, #58,
 * so the card and the low-areas guide use one word.)
 *
 * **Orange is no longer the address's alone.** It was reserved for the address
 * because no map layer used it; the ground's arrow is about the address, and is
 * not drawn on the map (§3.6), so the two share it without competing with
 * anything else.
 *
 * **Position is drawn, the figure is not to scale.** The ground arrow points at
 * the eighth its sentence names, because the fit claims no more than that. The
 * dashed lines point at where the nearest path and low area actually are; the
 * rounded distance is on the label, and every line is the same length whatever
 * that distance. One plain line says so: *Directions and distances are
 * approximate.* It sits behind a small ⓘ in the figure's corner rather than
 * printed under it (copy audit v2, #59), and the ⓘ is only there when the
 * figure draws a direction for it to qualify.
 *
 * The figure's accessible name is `describeAddress`, the same structure the
 * marks are drawn from, so the picture and what a screen reader hears cannot
 * disagree.
 */

import { useId, useState } from 'react';

import { type GroundTrend, describeAddress, isSteep } from './addressGround.js';
import { DERIVED_DAY } from './derived.js';
import { COMPASS_ANGLE, type NearbyThing, type WaterNearby } from './nearby.js';

const WIDTH = 320;
/**
 * The drawing above the notes is never shorter than this, so an ordinary
 * address's figure keeps the size it always had. It grows past it only when a
 * label needs the room; a taller card is better than words printed over marks.
 */
const MIN_DRAWING = 138;
const CX = WIDTH / 2;
/** Where the ring's centre sits when nothing above the N needs room. */
const CY = 66;
const RING = 34;
/** How far past the ring the ground's arrowhead reaches, and where its base sits. */
const ARROW_TIP = RING + 8;
const ARROW_BASE = RING - 2;
const ARROW_HALF = 5;
/** The water path's end bar: half its length, and its round cap. */
const BAR_HALF = 6;
const BAR_CAP = 1.5;
/** The low area's oval, long along its line, with half its stroke. */
const OVAL_ALONG = 8;
const OVAL_ACROSS = 5;
const OVAL_STROKE = 0.75;
/** Each fact with nothing to point at gets a line of words under the ring. */
const NOTE_LINE = 13;

const ORANGE = '#c2410c';
const FAINT = '#dfe5da';
const INK = '#4d5f6e';
/** 5.9:1 on white at 10 px; the caption line has to be readable. */
const CAPTION = '#5b6e7e';
/** The figure is not to scale and its distances are rounded; this is that, in plain words. */
export const CAPTION_TEXT = 'Directions and distances are approximate.';

const point = (cy: number, degrees: number, radius: number): readonly [number, number] => {
  const radians = (degrees * Math.PI) / 180;
  return [CX + Math.cos(radians) * radius, cy - Math.sin(radians) * radius];
};

/** A label's two lines, placed. */
export interface PlacedLabel {
  readonly key: string;
  readonly lines: readonly [string, string];
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

/** What the ring carries at the end of a label's line. */
export type Mark = 'arrow' | 'bar' | 'oval';

/** Everything the figure needs to draw its marks and words without overlap. */
export interface FigureLayout {
  /** The ring's centre, lower than `CY` when a label above the ring needed room. */
  readonly cy: number;
  /** The N's baseline, raised when a mark near north would sit on it. */
  readonly northY: number;
  readonly labels: readonly PlacedLabel[];
  /** The lowest thing drawn around the ring; the notes and the caption go under it. */
  readonly drawingBottom: number;
}

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Roughly 10.5 px system sans: wide enough to keep labels inside, not a measurement. */
const CHAR_PX = 5.8;
const LINE_PX = 11;
/** A label's box, from its first baseline: a cap height above, a line and a descender below. */
const LABEL_ABOVE = 9;
const LABEL_HEIGHT = LABEL_ABOVE + LINE_PX + 2;
/** Room kept between a label and anything else, and between the figure and its edge. */
const GAP = 3;
const EDGE = 4;
/** The ring's disc as labels see it: the ring, its stroke, and a little air. */
const DISC = RING + 4;

const overlaps = (a: Box, b: Box, pad: number) =>
  a.left < b.right + pad && a.right + pad > b.left && a.top < b.bottom + pad && a.bottom + pad > b.top;

const boxAround = (xs: readonly number[], ys: readonly number[], grow: number): Box => ({
  left: Math.min(...xs) - grow,
  right: Math.max(...xs) + grow,
  top: Math.min(...ys) - grow,
  bottom: Math.max(...ys) + grow,
});

/**
 * The rectangle a mark covers where it reaches past the ring's disc.
 *
 * The dashed lines and the arrow's shaft stay inside the ring, which labels
 * already keep out of; what sticks out is the arrowhead's tip and the glyph
 * sitting on the ring, and a label printed over either hides which way it points.
 */
function markBox(mark: Mark, degrees: number, cy: number): Box {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  if (mark === 'arrow') {
    const [tipX, tipY] = point(cy, degrees, ARROW_TIP);
    const [bx, by] = point(cy, degrees, ARROW_BASE);
    const px = -sin * ARROW_HALF;
    const py = -cos * ARROW_HALF;
    return boxAround([tipX, bx + px, bx - px], [tipY, by + py, by - py], 0);
  }
  const [ex, ey] = point(cy, degrees, RING);
  if (mark === 'bar') {
    return boxAround([ex + sin * BAR_HALF, ex - sin * BAR_HALF], [ey + cos * BAR_HALF, ey - cos * BAR_HALF], BAR_CAP);
  }
  const hx = Math.hypot(OVAL_ALONG * cos, OVAL_ACROSS * sin) + OVAL_STROKE;
  const hy = Math.hypot(OVAL_ALONG * sin, OVAL_ACROSS * cos) + OVAL_STROKE;
  return { left: ex - hx, right: ex + hx, top: ey - hy, bottom: ey + hy };
}

/** The N's box: an 11 px bold capital, centred on the ring's top. */
const northBox = (baseline: number): Box => ({ left: CX - 5, right: CX + 5, top: baseline - 9, bottom: baseline + 1 });

/**
 * How far a label may turn from its mark's own direction, in the order tried.
 *
 * Straight out first; then a little either way, which is still plainly beside
 * the mark; then round the side of the ring when two marks point the same way.
 */
const TURNS = [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 180];
/** A degree of turn costs as much as this many pixels further out. */
const TURN_COST_PX = 0.6;
const STEP_PX = 3;
const STEPS = 24;
/** Every place a label may try, nearest first; the same for every label, so sorted once. */
const PLACES = TURNS.flatMap((turn) =>
  Array.from({ length: STEPS }, (_, step) => ({
    turn,
    distance: DISC + step * STEP_PX,
    cost: Math.abs(turn) * TURN_COST_PX + step * STEP_PX,
  })),
).sort((a, b) => a.cost - b.cost);

/**
 * Put each label outside the ring, beside its mark, and off everything drawn.
 *
 * The first version only kept labels off each other and off the N. At 5 Darcy
 * Lane the low area lies just west of north; its label, pushed down off the N a
 * label's height at a time, landed on the address dot and the arrow. At 2
 * Mctaggart Street a low area and a water path both lie north, and the second
 * label was pushed inside the ring over the dashed line.
 *
 * So a label is never tried inside the ring. Each is given a list of places
 * along rays from the centre — its mark's direction, then turned 15°, 30° and
 * further either way — each at growing distance past the ring, and takes the
 * nearest free one. Free means clear of the ring's disc, the arrowhead and the
 * glyphs on the ring, the N, and the labels already placed, which claim space in
 * the order given (the ground first). The side a label hangs from follows its
 * ray, so a label up and to the left grows up and to the left, away from the
 * ring. A label that would run off either side is pulled back in rather than
 * clipped, which is what the first version did to "about 3.5 m over 150 m".
 *
 * Nothing caps the height: a label that needs room above the N moves the ring
 * down, and one below it moves the notes down. If no place near the ring is
 * free, which the sweep in the tests says does not happen, the label goes above
 * or below everything else rather than over it.
 */
export function layoutFigure(
  items: readonly {
    readonly key: string;
    readonly degrees: number;
    readonly mark: Mark;
    readonly lines: readonly [string, string];
  }[],
): FigureLayout {
  const marks = items.map((item) => markBox(item.mark, item.degrees, CY));

  // A mark near north would sit on the N; the N moves up out of its way.
  let northY = CY - RING - 6;
  for (let guard = 0; guard < items.length + 1; guard += 1) {
    const clash = marks.find((m) => overlaps(northBox(northY), m, 1));
    if (clash === undefined) break;
    northY = clash.top - 2;
  }

  const obstacles: Box[] = [...marks, northBox(northY)];
  const clear = (box: Box) => {
    const dx = Math.max(box.left - CX, 0, CX - box.right);
    const dy = Math.max(box.top - CY, 0, CY - box.bottom);
    return dx * dx + dy * dy >= DISC * DISC && !obstacles.some((o) => overlaps(box, o, GAP));
  };

  const placed: (PlacedLabel & Box)[] = [];
  for (const item of items) {
    const width = Math.max(...item.lines.map((l) => l.length)) * CHAR_PX;
    const at = (degrees: number, distance: number): PlacedLabel & Box => {
      const radians = (degrees * Math.PI) / 180;
      const across = Math.cos(radians);
      const up = Math.sin(radians);
      const [px, py] = point(CY, degrees, distance);
      const anchor = across < -0.3 ? 'end' : across > 0.3 ? 'start' : 'middle';
      const wanted = anchor === 'end' ? px - width : anchor === 'middle' ? px - width / 2 : px;
      const left = Math.min(Math.max(wanted, EDGE), WIDTH - EDGE - width);
      const top = up > 0.3 ? py - LABEL_HEIGHT : up < -0.3 ? py : py - LABEL_HEIGHT / 2;
      const x = anchor === 'end' ? left + width : anchor === 'middle' ? left + width / 2 : left;
      return { key: item.key, lines: item.lines, x, y: top + LABEL_ABOVE, anchor, left, right: left + width, top, bottom: top + LABEL_HEIGHT };
    };
    let label: (PlacedLabel & Box) | undefined;
    for (const place of PLACES) {
      const tried = at(item.degrees + place.turn, place.distance);
      if (clear(tried)) {
        label = tried;
        break;
      }
    }
    if (label === undefined) {
      const upward = Math.sin((item.degrees * Math.PI) / 180) >= 0;
      const fallback = at(upward ? 90 : 270, DISC);
      const edge = upward
        ? Math.min(CY - DISC, ...obstacles.map((o) => o.top)) - GAP - 1 - LABEL_HEIGHT
        : Math.max(CY + DISC, ...obstacles.map((o) => o.bottom)) + GAP + 1;
      label = { ...fallback, y: edge + LABEL_ABOVE, top: edge, bottom: edge + LABEL_HEIGHT };
    }
    placed.push(label);
    obstacles.push(label);
  }

  // Move everything down until the highest thing drawn is inside the figure.
  const top = Math.min(CY - RING - 1, northY - 9, ...obstacles.map((o) => o.top));
  const shift = Math.max(0, EDGE - top);
  const bottom = Math.max(CY + RING + 1, ...obstacles.map((o) => o.bottom)) + shift;
  return {
    cy: CY + shift,
    northY: northY + shift,
    labels: placed.map(({ key, lines, x, y, anchor }) => ({ key, lines, x, y: y + shift, anchor })),
    drawingBottom: Math.max(MIN_DRAWING, Math.ceil(bottom)),
  };
}

function Label({ label }: { readonly label: PlacedLabel }) {
  return (
    <text x={label.x} y={label.y} fontSize="10.5" fill={INK} textAnchor={label.anchor}>
      <tspan x={label.x} dy="0">
        {label.lines[0]}
      </tspan>
      <tspan x={label.x} dy={String(LINE_PX)}>
        {label.lines[1]}
      </tspan>
    </text>
  );
}

function GroundArrow({ trend, cy }: { readonly trend: Extract<GroundTrend, { kind: 'falls' }>; readonly cy: number }) {
  const degrees = COMPASS_ANGLE[trend.bearing];
  const radians = (degrees * Math.PI) / 180;
  const [x1, y1] = point(cy, degrees, 8);
  const [bx, by] = point(cy, degrees, ARROW_BASE);
  const [tipX, tipY] = point(cy, degrees, ARROW_TIP);
  const px = Math.cos(radians + Math.PI / 2) * ARROW_HALF;
  const py = -Math.sin(radians + Math.PI / 2) * ARROW_HALF;
  return (
    <g>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={ORANGE} strokeWidth="3" />
      <polygon
        points={`${String(tipX)},${String(tipY)} ${String(bx + px)},${String(by + py)} ${String(bx - px)},${String(by - py)}`}
        fill={ORANGE}
      />
    </g>
  );
}

function Pointer({
  thing,
  colour,
  end,
  cy,
}: {
  readonly thing: Extract<NearbyThing, { kind: 'direction' }>;
  readonly colour: string;
  readonly end: 'bar' | 'oval';
  readonly cy: number;
}) {
  const degrees = thing.angleDeg;
  const radians = (degrees * Math.PI) / 180;
  const [x1, y1] = point(cy, degrees, 8);
  const [ex, ey] = point(cy, degrees, RING);
  const px = Math.cos(radians + Math.PI / 2);
  const py = -Math.sin(radians + Math.PI / 2);
  return (
    <g>
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={colour} strokeWidth="2" strokeDasharray="3 3" />
      {end === 'bar' ? (
        <line
          x1={ex + px * BAR_HALF}
          y1={ey + py * BAR_HALF}
          x2={ex - px * BAR_HALF}
          y2={ey - py * BAR_HALF}
          stroke={colour}
          strokeWidth={BAR_CAP * 2}
          strokeLinecap="round"
        />
      ) : (
        <ellipse
          cx={ex}
          cy={ey}
          rx={OVAL_ALONG}
          ry={OVAL_ACROSS}
          transform={`rotate(${String(-degrees)} ${String(ex)} ${String(ey)})`}
          fill={colour}
          fillOpacity="0.35"
          stroke={colour}
          strokeWidth={OVAL_STROKE * 2}
        />
      )}
    </g>
  );
}

/**
 * Where the figure draws its words: the labels it carries, each with the mark
 * it belongs to, in the order they claim space — the ground first.
 */
export function figureFor(ground: GroundTrend | null, near: WaterNearby | null): FigureLayout {
  const items: { key: string; degrees: number; mark: Mark; lines: readonly [string, string] }[] = [];
  if (ground?.kind === 'falls') {
    items.push({ key: 'ground', degrees: COMPASS_ANGLE[ground.bearing], mark: 'arrow', lines: groundLines(ground.fallM) });
  }
  if (near?.channel?.kind === 'direction') {
    items.push({
      key: 'path',
      degrees: near.channel.angleDeg,
      mark: 'bar',
      lines: ['Water may flow', `about ${String(near.channel.distanceM)} m away`],
    });
  }
  if (near?.low?.kind === 'direction') {
    items.push({
      key: 'low',
      degrees: near.low.angleDeg,
      mark: 'oval',
      lines: ['Water may pool', `about ${String(near.low.distanceM)} m away`],
    });
  }
  return layoutFigure(items);
}

/**
 * The ground arrow's words: a number only for a steep slope.
 *
 * Team review item 16 found *ground falls / ≈ 4.0 m over 150 m* meant nothing to
 * a resident. The arrow now says the ground slopes down its way, and the fall is
 * printed only where it is steep enough to matter (`STEEP_FALL_M`, 1 in 20);
 * a gentler fall is called gentle and given no number to read too much into.
 *
 * Every label line is kept to 20 characters or fewer. `layoutFigure` measures
 * a line at 5.8 px a character, and a label much wider than about 110 px no
 * longer fits beside the ring on the east or west: it is pushed round above or
 * below and the card grows. So the steep fall is whole metres, *about*, which
 * is as much as a fitted plane rounded to half a metre supports anyway, and the
 * sweep in the tests runs the widest one the artefact holds.
 */
export function groundLines(fallM: number): readonly [string, string] {
  return isSteep(fallM) ? ['Steep slope down', `about ${String(Math.round(fallM))} m in 150 m`] : ['Gentle slope', 'downhill this way'];
}

/** Words for the facts that have nothing to point at. */
export function notesFor(ground: GroundTrend | null, near: WaterNearby | null): readonly string[] {
  const notes: string[] = [];
  // Copy audit v2, #58: *downhill* and *pool*, the words the guides now use.
  if (ground?.kind === 'unclear') notes.push('No clear downhill direction here');
  if (ground?.kind === 'edge') notes.push('No downhill direction: too near the edge of the data');
  if (near?.channel?.kind === 'very-near') notes.push('Water may flow at or near this address');
  if (near?.low?.kind === 'inside') notes.push('Water may pool at this address');
  if (near?.low?.kind === 'very-near') notes.push('Water may pool at or near this address');
  return notes;
}

export function AddressInsight({
  ground,
  near,
}: {
  readonly ground: GroundTrend | null;
  readonly near: WaterNearby | null;
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutId = useId();
  const notes = notesFor(ground, near);
  const figure = figureFor(ground, near);
  const { cy } = figure;
  // The notes start under the drawing; the last one's descender ends the figure.
  const notesY = figure.drawingBottom + 12;
  const height = notes.length === 0 ? figure.drawingBottom + 4 : notesY + (notes.length - 1) * NOTE_LINE + 4;
  // Only a figure that draws a direction has directions and distances to qualify.
  const drawsDirection = figure.labels.length > 0;
  return (
    <div style={{ margin: '4px 0 2px' }}>
      <svg
        viewBox={`0 0 ${String(WIDTH)} ${String(height)}`}
        role="img"
        aria-label={describeAddress(ground, near) ?? ''}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <circle cx={CX} cy={cy} r={RING} fill="none" stroke={FAINT} strokeWidth="1" />
        <text x={CX} y={figure.northY} fontSize="11" fill={CAPTION} fontWeight="600" textAnchor="middle">
          N
        </text>

        {near?.low?.kind === 'direction' && <Pointer thing={near.low} colour={DERIVED_DAY.lowPointEdge} end="oval" cy={cy} />}
        {near?.channel?.kind === 'direction' && <Pointer thing={near.channel} colour={DERIVED_DAY.channel} end="bar" cy={cy} />}
        {ground?.kind === 'falls' && <GroundArrow trend={ground} cy={cy} />}
        {figure.labels.map((label) => (
          <Label key={label.key} label={label} />
        ))}

        {/* The address, last, so nothing is drawn over the person's own mark. */}
        <circle cx={CX} cy={cy} r="4.5" fill={ORANGE} stroke="#ffffff" strokeWidth="2" />

        {notes.map((note, index) => (
          <text key={note} x={CX} y={notesY + index * NOTE_LINE} fontSize="10.5" fill={INK} textAnchor="middle">
            {note}
          </text>
        ))}
      </svg>
      {drawsDirection && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minHeight: 18 }}>
          {aboutOpen && (
            <span id={aboutId} style={{ fontSize: 11, lineHeight: 1.3, color: CAPTION }}>
              {CAPTION_TEXT}
            </span>
          )}
          {/*
            Drawn, not typed: the site's font subset has no ⓘ (public/fonts/README.md).
            A press rather than hover alone, so it opens on a phone as well.
          */}
          <button
            type="button"
            title={CAPTION_TEXT}
            aria-label="About this figure"
            aria-expanded={aboutOpen}
            aria-controls={aboutOpen ? aboutId : undefined}
            onClick={() => {
              setAboutOpen((open) => !open);
            }}
            style={{ display: 'inline-flex', padding: 1, background: 'none', border: 'none', color: CAPTION, cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
              <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="8" cy="4.8" r="1" fill="currentColor" />
              <path d="M8 7.2v4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
