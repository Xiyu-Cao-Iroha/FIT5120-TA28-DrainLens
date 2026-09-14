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
 */

export type Point = readonly [x: number, y: number];

export interface LabelPlacement {
  /** The address name: its anchor, and whether it runs leftward from there. */
  readonly address: { readonly at: Point; readonly alignRight: boolean };
  /**
   * The distance line: centred on `at` along a long connector, and otherwise
   * anchored beside the pin and running away from the drain, like the name.
   */
  readonly distance: { readonly at: Point; readonly align: 'centre' | 'left' | 'right' };
  /** The coach mark's top-left corner. */
  readonly coach: Point;
}

/** A connector shorter than this, in pixels, cannot carry its own label. */
export const SHORT_CONNECTOR_PX = 180;

/** The coach mark's size, which `ComparisonMap` draws it at. */
export const COACH_WIDTH_PX = 232;
export const COACH_HEIGHT_PX = 76;

/** About as wide as "Nearest drain you can test · about 200 m away" sets. */
export const DISTANCE_LABEL_PX = 250;

/** Gap between a marker and the writing beside it. */
const GAP_PX = 30;

/** Nothing is placed closer than this to the canvas edge. */
const EDGE_PX = 8;

const clampTo = (value: number, low: number, high: number): number => Math.max(low, Math.min(value, high));

/**
 * Place the three labels for an address at `address` and its drain at `drain`,
 * on a canvas `width` by `height` pixels.
 *
 * - The coach mark goes on the drain's far side from the address, flips when
 *   that would leave the canvas, and moves above or below the drain — away
 *   from the address — when neither side has room.
 * - The address name goes on the address's far side from the drain.
 * - The distance sits on the connector's midpoint when there is room, and
 *   beside the pin, under the name, when there is not.
 */
export function placeStepOneLabels(address: Point, drain: Point, width: number, height: number): LabelPlacement {
  const drainIsRight = drain[0] >= address[0];

  const rightOfDrain = drain[0] + GAP_PX;
  const leftOfDrain = drain[0] - GAP_PX - COACH_WIDTH_PX;
  const fitsRight = rightOfDrain + COACH_WIDTH_PX <= width - EDGE_PX;
  const fitsLeft = leftOfDrain >= EDGE_PX;

  let coach: Point;
  if (fitsRight && (drainIsRight || !fitsLeft)) {
    coach = [rightOfDrain, drain[1] - COACH_HEIGHT_PX / 2];
  } else if (fitsLeft) {
    coach = [leftOfDrain, drain[1] - COACH_HEIGHT_PX / 2];
  } else {
    const above = drain[1] - GAP_PX - COACH_HEIGHT_PX;
    const below = drain[1] + GAP_PX;
    const preferAbove = address[1] >= drain[1];
    const y = preferAbove
      ? above >= EDGE_PX
        ? above
        : below
      : below + COACH_HEIGHT_PX <= height - EDGE_PX
        ? below
        : Math.max(EDGE_PX, above);
    coach = [clampTo(drain[0] - COACH_WIDTH_PX / 2, EDGE_PX, Math.max(EDGE_PX, width - EDGE_PX - COACH_WIDTH_PX)), y];
  }

  const connectorPx = Math.hypot(drain[0] - address[0], drain[1] - address[1]);
  let distance: LabelPlacement['distance'];
  if (connectorPx >= SHORT_CONNECTOR_PX) {
    distance = { at: [(address[0] + drain[0]) / 2, (address[1] + drain[1]) / 2], align: 'centre' };
  } else {
    // Under the name, on the same far side: centred under the pin it ran into
    // the coach mark whenever the drain was a few metres away.
    const rightEdge = address[0] + 12;
    const leftEdge = address[0] - 12;
    const y = address[1] + 16;
    if (drainIsRight) {
      distance =
        rightEdge - DISTANCE_LABEL_PX >= EDGE_PX
          ? { at: [rightEdge, y], align: 'right' }
          : { at: [EDGE_PX, y], align: 'left' };
    } else {
      distance =
        leftEdge + DISTANCE_LABEL_PX <= width - EDGE_PX
          ? { at: [leftEdge, y], align: 'left' }
          : { at: [width - EDGE_PX, y], align: 'right' };
    }
  }

  return {
    address: { at: [drainIsRight ? address[0] - 14 : address[0] + 14, address[1] - 20], alignRight: drainIsRight },
    distance,
    coach,
  };
}
