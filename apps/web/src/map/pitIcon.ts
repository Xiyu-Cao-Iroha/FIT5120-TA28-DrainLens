/**
 * The drainage pit, drawn as a grate in a round frame.
 *
 * The grate is the icon supplied by the team, redrawn in canvas commands. It
 * is *not* rasterised from the SVG file: an `<img>` from a data URI is a
 * second thing to wait for and a second thing that can fail silently mid-pan,
 * and this map repaints on every frame.
 *
 * **The round frame replaces the artwork's rounded rectangle rather than
 * containing it.** A frame inside a frame leaves the bars about a pixel wide
 * at any size this map can afford, and five bars that merge into a grey block
 * is a picture of a grate rather than a grate. Dropping the inner rectangle
 * gives the bars room: in a 26-pixel circle they are 1.9 px with 2.7 px
 * between them, which is the point at which they stay countable.
 *
 * **It is drawn at a fixed size, and only when there is room.** A marker that
 * scales with zoom is between 5 and 14 pixels across on this map. Above the
 * threshold the grate is drawn at a constant size, which is what makes it
 * legible; below it the map goes back to a dot, because a dot at six pixels is
 * still honestly a dot while a grate at six pixels is a claim about how much
 * you can see.
 *
 * **The colour is the pit's, not the artwork's.** The supplied file is
 * `#202544`, within a few percent of the pipe colour — and pits and pipes are
 * separate layers, with separate controls, answering different questions. Two
 * marks that close would undo the distinction the map exists to make, so the
 * grate keeps its shape and takes the pit's established green.
 */

/** Bar centres and rows, in the supplied artwork's own coordinates. */
const BAR_X = [36.5, 63, 89.5, 116, 142.5] as const;
const BAR_ROWS = [
  { top: 24.5, bottom: 37.5 },
  { top: 56.5, bottom: 69.5 },
] as const;

const BAR_WIDTH = 11;

/** The grate's own extent in artwork units, ignoring the frame it came in. */
const GRATE_W = BAR_X[4] - BAR_X[0] + BAR_WIDTH;
const GRATE_H = BAR_ROWS[1].bottom - BAR_ROWS[0].top + BAR_WIDTH;
const GRATE_CX = (BAR_X[0] + BAR_X[4]) / 2;
const GRATE_CY = (BAR_ROWS[0].top + BAR_ROWS[1].bottom) / 2;

/**
 * How much of the circle's diameter the grate's diagonal may take.
 *
 * At 1 the grate touches the ring and reads as cramped; below about 0.8 the
 * bars are too thin to count. 0.86 is where both stop being true.
 */
const FIT = 0.86;

/** Diameter of the marker, in pixels. */
export const ICON_DIAMETER_PX = 26;

/**
 * The scale at or above which the grate replaces the dot.
 *
 * Not about whether the marker fits — it is a fixed size, so it always fits —
 * but about whether the map underneath still reads with 26-pixel markers on
 * it. Below this the pits crowd into each other and the streets disappear.
 */
export const ICON_MIN_SCALE = 1.9;

export const RING_WIDTH_PX = 2;

/**
 * Draw the pit marker centred on a point.
 *
 * `diameter` is the drawn size in pixels; the grate inside is derived from the
 * artwork's proportions, so it cannot be stretched by accident.
 */
export function drawPitIcon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  colour: string,
  diameter: number = ICON_DIAMETER_PX,
): void {
  const radius = diameter / 2;

  context.save();

  // The frame. Filled before the bars so the network underneath does not show
  // between them, which is what turns a grate into a smear over a pipe.
  context.beginPath();
  context.arc(x, y, radius - RING_WIDTH_PX / 2, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.lineWidth = RING_WIDTH_PX;
  context.strokeStyle = colour;
  context.stroke();

  // The grate, scaled so its diagonal sits inside the ring.
  const diagonal = Math.hypot(GRATE_W, GRATE_H);
  const k = (diameter * FIT) / diagonal;

  context.translate(x - GRATE_CX * k, y - GRATE_CY * k);
  context.scale(k, k);

  // Stadium bars: a thick line with round caps is the same figure as a
  // rounded rectangle of that width, and one path instead of ten.
  context.lineWidth = BAR_WIDTH;
  context.lineCap = 'round';
  context.strokeStyle = colour;
  context.beginPath();
  for (const barX of BAR_X) {
    for (const row of BAR_ROWS) {
      context.moveTo(barX, row.top);
      context.lineTo(barX, row.bottom);
    }
  }
  context.stroke();

  context.restore();
}

/** What a bar measures on screen, for the test that keeps them countable. */
export function barWidthPx(diameter: number = ICON_DIAMETER_PX): number {
  return (BAR_WIDTH * (diameter * FIT)) / Math.hypot(GRATE_W, GRATE_H);
}
