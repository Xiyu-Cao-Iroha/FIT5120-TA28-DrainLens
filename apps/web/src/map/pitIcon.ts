/**
 * The drainage pit: the team's grate icon, inside a round frame.
 *
 * The artwork is redrawn in canvas commands rather than rasterised from the
 * SVG file. An `<img>` from a data URI is a second thing to wait for and a
 * second thing that can fail silently mid-pan, and this map repaints on every
 * frame.
 *
 * **The circle holds the whole icon, rounded rectangle and all.** An earlier
 * version dropped the artwork's own frame to give the bars room, which kept
 * them legible but stopped it looking like the icon it came from. Keeping the
 * frame costs size instead: the bars are 5.7% of the marker's diameter, so the
 * diameter is the only thing that buys them.
 *
 * **It was 32, and is 23 since 3 September.** Halved in *area* at the design
 * owner's request, which put the bars at 1.29 px — thinner than the 1.5 the
 * marker was originally sized to clear, and a deliberate trade of a little
 * legibility for a marker that crowds the street less. Halving the *diameter*
 * instead was the other reading of "half the size" and it does not survive
 * contact with the pixel grid: 16 px puts the bars at 0.90, where five of them
 * render as one grey smudge and the marker stops being the grate it was drawn
 * from. One pixel is the floor `pitIcon.test.ts` now holds.
 *
 * **It is drawn at a fixed size, and only when there is room.** A marker that
 * scales with zoom is between 5 and 14 pixels across on this map. Below the
 * threshold the map goes back to a dot, because a dot at six pixels is still
 * honestly a dot while a grate at six pixels is a claim about how much you can
 * see.
 *
 * **The colour is the pit's, not the artwork's.** The supplied file is
 * `#202544`, within a few percent of the pipe colour — and pits and pipes are
 * separate layers, with separate controls, answering different questions. Two
 * marks that close would undo the distinction the map exists to make.
 */

/** The supplied artwork's coordinate space. */
const ART_W = 168;
const ART_H = 94;

/** Its outer frame, and the stroke drawn on the frame's own path. */
const FRAME = { x: 8, y: 6, w: 152, h: 82, radius: 9 } as const;
const FRAME_STROKE = 5.5;

/** Bar centres and rows, in artwork units. */
const BAR_X = [36.5, 63, 89.5, 116, 142.5] as const;
const BAR_ROWS = [
  { top: 24.5, bottom: 37.5 },
  { top: 56.5, bottom: 69.5 },
] as const;
const BAR_WIDTH = 11;

/** What the artwork actually occupies, stroke included. */
const DRAWN_W = FRAME.w + FRAME_STROKE;
const DRAWN_H = FRAME.h + FRAME_STROKE;
const DRAWN_DIAGONAL = Math.hypot(DRAWN_W, DRAWN_H);

/**
 * How much of the circle's diameter the artwork's diagonal takes.
 *
 * The artwork is a rounded rectangle, so its corners do not reach as far as a
 * true rectangle's would and it can sit closer to the ring than a naive fit
 * suggests. Above about 0.95 it touches; below 0.85 the bars go under a pixel
 * and a half.
 */
const FIT = 0.92;

/**
 * Diameter of the marker, in pixels.
 *
 * Half the area of the 32 it started at. The lower bound is the bars, not
 * taste: `barWidthPx` must stay above 1 px, which fails below about 18 with
 * the artwork's own frame inside the circle.
 */
export const ICON_DIAMETER_PX = 23;

export const RING_WIDTH_PX = 2;

/**
 * The scale at or above which the grate replaces the dot.
 *
 * Not about whether the marker fits — it is a fixed size, so it always fits —
 * but about whether the map underneath still reads with markers on it.
 *
 * Left at 2.2 when the marker shrank to 23, which makes it conservative rather
 * than wrong: a smaller marker crowds less, so the grate could honestly appear
 * a little sooner. Not lowered in the same change, because moving the size and
 * the threshold together means neither can be judged on screen.
 */
export const ICON_MIN_SCALE = 2.2;

/** What one bar measures on screen. The reason the diameter is what it is. */
export function barWidthPx(diameter: number = ICON_DIAMETER_PX): number {
  return (BAR_WIDTH * diameter * FIT) / DRAWN_DIAGONAL;
}

/** A rounded rectangle, without `roundRect`, which older browsers throw on. */
function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.arcTo(x + width, y, x + width, y + r, r);
  context.lineTo(x + width, y + height - r);
  context.arcTo(x + width, y + height, x + width - r, y + height, r);
  context.lineTo(x + r, y + height);
  context.arcTo(x, y + height, x, y + height - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

/**
 * Draw the pit marker centred on a point.
 *
 * `diameter` is the drawn size in pixels; the artwork inside is scaled from
 * its own proportions, so it cannot be stretched by accident.
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

  // The ring, filled before anything else so the network underneath does not
  // show between the bars — which is what turns a grate into a smear over a
  // pipe.
  context.beginPath();
  context.arc(x, y, radius - RING_WIDTH_PX / 2, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.lineWidth = RING_WIDTH_PX;
  context.strokeStyle = colour;
  context.stroke();

  // The artwork, scaled so its diagonal sits inside the ring.
  const k = (diameter * FIT) / DRAWN_DIAGONAL;
  context.translate(x - (ART_W / 2) * k, y - (ART_H / 2) * k);
  context.scale(k, k);

  // The icon's own rounded-rectangle frame.
  const inset = FRAME_STROKE / 2;
  roundedRect(
    context,
    FRAME.x + inset,
    FRAME.y + inset,
    FRAME.w - FRAME_STROKE,
    FRAME.h - FRAME_STROKE,
    FRAME.radius,
  );
  context.fillStyle = '#ffffff';
  context.fill();
  context.lineWidth = FRAME_STROKE;
  context.strokeStyle = colour;
  context.stroke();

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
