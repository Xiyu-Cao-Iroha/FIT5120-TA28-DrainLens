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
 * | Mark | Meaning |
 * |---|---|
 * | Orange arrow | which way the ground around the address generally falls |
 * | Blue dashed line, short bar at the end | the nearest mapped likely water path |
 * | Lighter blue dashed line, oval at the end | the nearest mapped low area |
 * | Orange dot | the address |
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
 * that distance. The caption says so.
 *
 * The figure's accessible name is `describeAddress`, the same structure the
 * marks are drawn from, so the picture and what a screen reader hears cannot
 * disagree.
 */

import { type GroundTrend, describeAddress } from './addressGround.js';
import { DERIVED_DAY } from './derived.js';
import { COMPASS_ANGLE, type NearbyThing, type WaterNearby } from './nearby.js';

const WIDTH = 320;
const HEIGHT = 170;
const CX = WIDTH / 2;
const CY = 66;
const RING = 34;
/** Each fact with nothing to point at gets a line of words under the ring. */
const NOTE_LINE = 13;

const ORANGE = '#c2410c';
const FAINT = '#dfe5da';
const INK = '#4d5f6e';
/** 5.9:1 on white at 10 px; the not-to-scale line has to be readable. */
const CAPTION = '#5b6e7e';

const point = (degrees: number, radius: number): readonly [number, number] => {
  const radians = (degrees * Math.PI) / 180;
  return [CX + Math.cos(radians) * radius, CY - Math.sin(radians) * radius];
};

/** A label's two lines, placed. */
export interface PlacedLabel {
  readonly key: string;
  readonly lines: readonly [string, string];
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

/** Roughly 10.5 px system sans: wide enough to keep labels inside, not a measurement. */
const CHAR_PX = 5.8;
const LINE_PX = 11;

/**
 * Put each label beside its mark, inside the figure, and off every other label.
 *
 * Two marks can point the same way — at 53 Altona Street the ground falls west
 * and the nearest water path is west — and their labels would print over each
 * other. A later label that collides moves down, then up, a label's height at a
 * time. A label that would run off either side is pulled back in rather than
 * clipped, which is what the first version did to "about 3.5 m over 150 m".
 */
export function layoutLabels(
  items: readonly { readonly key: string; readonly degrees: number; readonly lines: readonly [string, string] }[],
): readonly PlacedLabel[] {
  const placed: (PlacedLabel & { left: number; right: number; top: number; bottom: number })[] = [];
  // The N above the ring is a label too, and the first to claim its space.
  const north = { left: CX - 8, right: CX + 8, top: CY - RING - 17, bottom: CY - RING - 2 };
  for (const item of items) {
    const [tx, ty] = point(item.degrees, RING + 14);
    const across = Math.cos((item.degrees * Math.PI) / 180);
    const above = Math.sin((item.degrees * Math.PI) / 180) > 0.3;
    const anchor = across < -0.3 ? 'end' : across > 0.3 ? 'start' : 'middle';
    const width = Math.max(...item.lines.map((l) => l.length)) * CHAR_PX;
    const shiftFor = (x: number) => {
      const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
      if (left < 4) return 4 - left;
      if (left + width > WIDTH - 4) return WIDTH - 4 - (left + width);
      return 0;
    };
    const x = tx + shiftFor(tx);
    const baseY = ty + (above ? -6 : 6);
    const boxAt = (y: number) => {
      const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
      return { left, right: left + width, top: y - 9, bottom: y + LINE_PX + 2 };
    };
    const clashes = (box: ReturnType<typeof boxAt>) =>
      [north, ...placed].some((o) => box.left < o.right && box.right > o.left && box.top < o.bottom && box.bottom > o.top);
    let y = baseY;
    for (const step of [0, 1, -1, 2, -2]) {
      const candidate = baseY + step * (LINE_PX * 2 + 3);
      const box = boxAt(candidate);
      // Stay above the notes and captions under the ring.
      if (box.top < 2 || box.bottom > HEIGHT - 32) continue;
      if (!clashes(box)) {
        y = candidate;
        break;
      }
    }
    placed.push({ key: item.key, lines: item.lines, x, y, anchor, ...boxAt(y) });
  }
  return placed.map(({ key, lines, x, y, anchor }) => ({ key, lines, x, y, anchor }));
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

function GroundArrow({ trend }: { readonly trend: Extract<GroundTrend, { kind: 'falls' }> }) {
  const degrees = COMPASS_ANGLE[trend.bearing];
  const radians = (degrees * Math.PI) / 180;
  const [x1, y1] = point(degrees, 8);
  const [bx, by] = point(degrees, RING - 2);
  const [tipX, tipY] = point(degrees, RING + 8);
  const px = Math.cos(radians + Math.PI / 2) * 5;
  const py = -Math.sin(radians + Math.PI / 2) * 5;
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
}: {
  readonly thing: Extract<NearbyThing, { kind: 'direction' }>;
  readonly colour: string;
  readonly end: 'bar' | 'oval';
}) {
  const degrees = thing.angleDeg;
  const radians = (degrees * Math.PI) / 180;
  const [x1, y1] = point(degrees, 8);
  const [ex, ey] = point(degrees, RING);
  const px = Math.cos(radians + Math.PI / 2);
  const py = -Math.sin(radians + Math.PI / 2);
  return (
    <g>
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={colour} strokeWidth="2" strokeDasharray="3 3" />
      {end === 'bar' ? (
        <line
          x1={ex + px * 6}
          y1={ey + py * 6}
          x2={ex - px * 6}
          y2={ey - py * 6}
          stroke={colour}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <ellipse
          cx={ex}
          cy={ey}
          rx="8"
          ry="5"
          transform={`rotate(${String(-degrees)} ${String(ex)} ${String(ey)})`}
          fill={colour}
          fillOpacity="0.35"
          stroke={colour}
          strokeWidth="1.5"
        />
      )}
    </g>
  );
}

/** The labels this figure carries, in the order they claim space: the ground first. */
export function labelsFor(ground: GroundTrend | null, near: WaterNearby | null): readonly PlacedLabel[] {
  const items: { key: string; degrees: number; lines: readonly [string, string] }[] = [];
  if (ground?.kind === 'falls') {
    items.push({
      key: 'ground',
      degrees: COMPASS_ANGLE[ground.bearing],
      lines: ['ground falls', `≈ ${ground.fallM.toFixed(1)} m over 150 m`],
    });
  }
  if (near?.channel?.kind === 'direction') {
    items.push({ key: 'path', degrees: near.channel.angleDeg, lines: ['likely water path', `about ${String(near.channel.distanceM)} m away`] });
  }
  if (near?.low?.kind === 'direction') {
    items.push({ key: 'low', degrees: near.low.angleDeg, lines: ['low area', `about ${String(near.low.distanceM)} m away`] });
  }
  return layoutLabels(items);
}

/** Words for the facts that have nothing to point at. */
export function notesFor(ground: GroundTrend | null, near: WaterNearby | null): readonly string[] {
  const notes: string[] = [];
  if (ground?.kind === 'unclear') notes.push('No reliable overall ground direction');
  if (ground?.kind === 'edge') notes.push('No ground direction: too near the edge of the data');
  if (near?.channel?.kind === 'very-near') notes.push('A likely water path is at or very near');
  if (near?.low?.kind === 'inside') notes.push('This address is inside a mapped low area');
  if (near?.low?.kind === 'very-near') notes.push('A low area is at or very near this address');
  return notes;
}

export function AddressInsight({
  ground,
  near,
}: {
  readonly ground: GroundTrend | null;
  readonly near: WaterNearby | null;
}) {
  const notes = notesFor(ground, near);
  const height = HEIGHT + notes.length * NOTE_LINE;
  return (
    <svg
      viewBox={`0 0 ${String(WIDTH)} ${String(height)}`}
      role="img"
      aria-label={describeAddress(ground, near) ?? ''}
      style={{ width: '100%', height: 'auto', display: 'block', margin: '4px 0 2px' }}
    >
      <circle cx={CX} cy={CY} r={RING} fill="none" stroke={FAINT} strokeWidth="1" />
      <text x={CX} y={CY - RING - 6} fontSize="11" fill={CAPTION} fontWeight="600" textAnchor="middle">
        N
      </text>

      {near?.low?.kind === 'direction' && <Pointer thing={near.low} colour={DERIVED_DAY.lowPointEdge} end="oval" />}
      {near?.channel?.kind === 'direction' && <Pointer thing={near.channel} colour={DERIVED_DAY.channel} end="bar" />}
      {ground?.kind === 'falls' && <GroundArrow trend={ground} />}
      {labelsFor(ground, near).map((label) => (
        <Label key={label.key} label={label} />
      ))}

      {/* The address, last, so nothing is drawn over the person's own mark. */}
      <circle cx={CX} cy={CY} r="4.5" fill={ORANGE} stroke="#ffffff" strokeWidth="2" />

      {notes.map((note, index) => (
        <text key={note} x={CX} y={HEIGHT - 20 + index * NOTE_LINE} fontSize="10.5" fill={INK} textAnchor="middle">
          {note}
        </text>
      ))}
      <text x={CX} y={height - 16} fontSize="10" fill={CAPTION} textAnchor="middle">
        Arrow = which way the ground falls
      </text>
      <text x={CX} y={height - 4} fontSize="10" fill={CAPTION} textAnchor="middle">
        Dashed = something is there · not to scale
      </text>
    </svg>
  );
}
