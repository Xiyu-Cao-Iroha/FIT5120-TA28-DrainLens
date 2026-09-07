/**
 * Which way the water near an address was measured to lie.
 *
 * A sentence naming two directions and two distances asks a reader to hold a
 * small map in their head — *"a path 30 m to the north-west, towards a low
 * area 30 m to the north-east"* — and the thing it asks them to work out is
 * exactly the thing a picture states in one look: **whether the two lie the
 * same way or opposite ways.** Water running away from you and water
 * collecting behind you are different situations, and the prose made them the
 * same shape of sentence.
 *
 * **It claims nothing the sentence does not.** Both arrows point at the
 * reported eighth rather than the true bearing, both labels carry the rounded
 * distance, and the arrows are the same length whatever the distance — a
 * drawing whose lengths were proportional would be a scale drawing, and the
 * one thing this figure must not become is a map. It says so under itself.
 *
 * The address keeps its own colour, the warm one no map layer uses. The
 * things it points at keep theirs, from `DERIVED_DAY`, so the arrow for a
 * surface-water path is the colour of the surface-water paths drawn behind the
 * card.
 */

import { COMPASS_ANGLE, type WaterNearby, describe } from './nearby.js';
import { DERIVED_DAY } from './derived.js';

/**
 * Wide, and the arrows short inside it.
 *
 * The first version was 208 wide with 34-pixel arrows and a label on one line,
 * and the labels ran off both sides: a diagonal tip sits 47 pixels from the
 * centre, and "water may run 30 m" is eighty pixels of text hanging off it.
 * The figure is mostly margin on purpose -- the space around the arrows is
 * what the words need, and a compass whose labels are clipped says less than
 * the sentence it replaced.
 */
const WIDTH = 250;
const HEIGHT = 146;
const CX = WIDTH / 2;
const CY = 62;

/** Short, because the label beside it needs the room more than the arrow does. */
const ARROW = 28;
const ADDRESS = '#c2410c';
const FAINT = '#dfe5da';
const INK = '#4d5f6e';

/**
 * Captions are read, so they are coloured like something to read.
 *
 * The first version used the palette's `subtle` grey at nine pixels for the
 * line saying the drawing is not to scale — measured at **3.1:1**, against the
 * 4.5:1 that normal text needs, and the smallest type anywhere in the product.
 * The one sentence stopping the figure from being taken for a map was the
 * hardest thing on it to read.
 */
const CAPTION = '#5b6e7e';
const CAPTION_PX = 10;

/**
 * Screen coordinates for a compass angle.
 *
 * North is up, which is the one thing about this figure a reader has to be
 * told rather than shown — hence the `N` at the top. The canvas y axis runs
 * down and the map frame's northing runs up, so the sine is negated here, the
 * same flip every other drawing in this app applies.
 */
const point = (degrees: number, radius: number): readonly [number, number] => {
  const radians = (degrees * Math.PI) / 180;
  return [CX + Math.cos(radians) * radius, CY - Math.sin(radians) * radius];
};

function Ray({
  bearing,
  distanceM,
  colour,
  label,
}: {
  readonly bearing: keyof typeof COMPASS_ANGLE;
  readonly distanceM: number;
  readonly colour: string;
  readonly label: string;
}) {
  const angle = COMPASS_ANGLE[bearing];
  const radians = (angle * Math.PI) / 180;

  // The shaft stops where the head starts, so the two do not overlap into a
  // blunt end at the small sizes this is drawn at.
  const [x1, y1] = point(angle, 9);
  const [bx, by] = point(angle, ARROW);
  const [tipX, tipY] = point(angle, ARROW + 8);

  // Perpendicular to the ray, with the same northing-up flip as `point`.
  const perp = radians + Math.PI / 2;
  const px = Math.cos(perp) * 4.5;
  const py = -Math.sin(perp) * 4.5;

  const [tx, ty] = point(angle, ARROW + 12);
  const across = Math.cos(radians);
  // Two lines, so a label is half as wide as the phrase it carries.
  const above = Math.sin(radians) > 0.3;

  return (
    <g>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={colour} strokeWidth="2.5" />
      <polygon
        points={`${String(tipX)},${String(tipY)} ${String(bx + px)},${String(by + py)} ${String(bx - px)},${String(by - py)}`}
        fill={colour}
      />
      <text
        x={tx}
        y={ty + (above ? -1 : 9)}
        fontSize="11"
        fill={INK}
        textAnchor={across < -0.3 ? 'end' : across > 0.3 ? 'start' : 'middle'}
      >
        <tspan x={tx} dy="0">
          {label}
        </tspan>
        <tspan x={tx} dy="11" fontSize="11">
          {String(distanceM)} m
        </tspan>
      </text>
    </g>
  );
}

export function WaterCompass({ near }: { readonly near: WaterNearby }) {
  return (
    <svg
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      role="img"
      aria-label={describe(near)}
      style={{ width: '100%', height: 'auto', display: 'block', margin: '4px 0 2px' }}
    >
      <circle cx={CX} cy={CY} r={ARROW + 4} fill="none" stroke={FAINT} strokeWidth="1" />
      <text
        x={CX}
        y={CY - ARROW - 9}
        fontSize="11"
        fill={CAPTION}
        fontWeight="600"
        textAnchor="middle"
      >
        N
      </text>

      {near.channel !== null && (
        <Ray
          bearing={near.channel.bearing}
          distanceM={near.channel.distanceM}
          colour={DERIVED_DAY.channel}
          label="water may run"
        />
      )}
      {near.low !== null && (
        <Ray
          bearing={near.low.bearing}
          distanceM={near.low.distanceM}
          colour={DERIVED_DAY.lowPointEdge}
          label="may collect here"
        />
      )}

      {/* The address, last, so nothing is drawn over the person's own mark. */}
      <circle cx={CX} cy={CY} r="5" fill={ADDRESS} stroke="#ffffff" strokeWidth="2" />

      <text
        x={CX}
        y={HEIGHT - 6}
        fontSize={CAPTION_PX}
        fill={CAPTION}
        textAnchor="middle"
      >
        Directions and distances as measured · not to scale
      </text>
    </svg>
  );
}
