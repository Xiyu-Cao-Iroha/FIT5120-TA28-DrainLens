/**
 * Drawing a followed path over the recorded network.
 *
 * Two things here are not decoration.
 *
 * **Direction comes from the topology, not from the geometry.** A pipe's
 * coordinates are a polyline, and nothing in the source guarantees the first
 * vertex is the upstream end — the export orders them however the surveyor
 * captured them. So the arrow is oriented by asking which end of the line is
 * nearer the pit the path arrived from. AC 1.2.2.b asks for the *recorded*
 * direction of flow, and reading it off the vertex order would produce arrows
 * that are right about half the time and confidently wrong the rest.
 *
 * **An ending is marked where it happens.** A path that stops in five places
 * has five marks, because a person following a branch needs to see that *that*
 * branch stopped, not read a footnote saying some branch did.
 */

import type { MapArtefact, Pipe } from '../map/artefact.js';
import { type Local, type Viewport, toScreen } from '../map/viewport.js';
import type { Ending, Termination, Trace } from './graph.js';

export interface TracePalette {
  readonly path: string;
  readonly pathHalo: string;
  readonly arrow: string;
  readonly start: string;
  /** Ends where the record ran out, and ends where only our map did. */
  readonly stopIncomplete: string;
  readonly stopOutside: string;
}

export const TRACE_DAY: TracePalette = {
  path: '#0f766e',
  pathHalo: '#ffffff',
  arrow: '#0f766e',
  start: '#0b5d56',
  // Amber for a gap in the record, grey for our own clip. They are different
  // facts and the map must not make one look like the other.
  stopIncomplete: '#b4690e',
  stopOutside: '#7c8b99',
};

/** Endings that mean the record stopped, as opposed to our map stopping. */
const RECORD_STOPPED: readonly Termination[] = [
  'no-recorded-connection',
  'unrecorded-destination',
  'cycle-guard',
];

export const stoppedBecauseOfTheRecord = (reason: Termination): boolean =>
  RECORD_STOPPED.includes(reason);

/** Pipe geometry by asset reference, for looking up what a trace named. */
export function pipesByRef(artefact: MapArtefact): Map<string, Pipe> {
  const index = new Map<string, Pipe>();
  for (const pipe of artefact.layers.pipe ?? []) {
    if (pipe.ref !== undefined) index.set(String(pipe.ref), pipe);
  }
  return index;
}

/** Pit positions by asset number, for placing markers and orienting arrows. */
export function pitsByAsset(artefact: MapArtefact): Map<string, Local> {
  const index = new Map<string, Local>();
  for (const pit of artefact.layers.pit ?? []) {
    if (pit.asset_number !== undefined) index.set(String(pit.asset_number), pit.c);
  }
  return index;
}

const distance2 = (a: Local, b: Local): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/**
 * The polyline, ordered so it runs away from `from`.
 *
 * Returns the line unchanged when `from` is unknown: an unoriented line still
 * draws correctly, and only its arrows would be uncertain.
 */
export function orientAwayFrom(
  line: readonly Local[],
  from: Local | undefined,
): readonly Local[] {
  if (from === undefined || line.length < 2) return line;
  const head = line[0]!;
  const tail = line[line.length - 1]!;
  return distance2(tail, from) < distance2(head, from) ? [...line].reverse() : line;
}

export interface Arrow {
  readonly at: Local;
  /** Radians, in the map frame. The renderer flips for the canvas. */
  readonly angle: number;
}

/**
 * Arrow positions along a polyline, one every `spacingM` metres.
 *
 * A short pipe gets one arrow at its midpoint rather than none: a segment with
 * no arrow reads as a pipe whose direction is unknown, which is a different
 * and untrue statement.
 */
export function arrowsAlong(line: readonly Local[], spacingM: number): Arrow[] {
  if (line.length < 2 || !(spacingM > 0)) return [];

  const arrows: Arrow[] = [];
  let carried = spacingM / 2;

  for (let i = 1; i < line.length; i += 1) {
    const from = line[i - 1]!;
    const to = line[i]!;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;

    const angle = Math.atan2(dy, dx);
    for (let along = carried; along <= length; along += spacingM) {
      arrows.push({ at: [from[0] + (dx * along) / length, from[1] + (dy * along) / length], angle });
    }
    carried = ((carried - length) % spacingM + spacingM) % spacingM;
  }

  if (arrows.length === 0) {
    const from = line[0]!;
    const to = line[line.length - 1]!;
    arrows.push({
      at: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
      angle: Math.atan2(to[1] - from[1], to[0] - from[0]),
    });
  }
  return arrows;
}

/** Metres between arrows, chosen so a 30 m pipe carries two or three. */
export const ARROW_SPACING_M = 14;

/** Below this, arrowheads are ink rather than information. */
export const ARROW_MIN_SCALE = 0.5;

function drawArrowhead(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  arrow: Arrow,
  palette: TracePalette,
): void {
  const [x, y] = toScreen(viewport, arrow.at);
  context.save();
  context.translate(x, y);
  // Northing up, canvas y down: the map angle is negated exactly here, the
  // same flip `toScreen` applies to the position.
  context.rotate(-arrow.angle);
  context.beginPath();
  context.moveTo(5, 0);
  context.lineTo(-3.5, 3.2);
  context.lineTo(-3.5, -3.2);
  context.closePath();
  context.fillStyle = palette.arrow;
  context.fill();
  context.restore();
}

function markerAt(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  point: Local,
  colour: string,
  radius: number,
): void {
  const [x, y] = toScreen(viewport, point);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = colour;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = '#ffffff';
  context.stroke();
}

export interface DrawTraceOptions {
  readonly palette?: TracePalette;
}

/**
 * Draw a trace over an already-drawn map.
 *
 * Order matters: halo, then path, then arrows, then endings, then the start.
 * The start is last because it is the thing the person selected and it must
 * not be covered by a path that happens to run over it.
 */
export function drawTrace(
  context: CanvasRenderingContext2D,
  artefact: MapArtefact,
  trace: Trace,
  viewport: Viewport,
  options: DrawTraceOptions = {},
): void {
  const palette = options.palette ?? TRACE_DAY;
  const pipes = pipesByRef(artefact);
  const pits = pitsByAsset(artefact);

  const lines: readonly Local[][] = trace.pipes
    .map((traced) => {
      const pipe = pipes.get(traced.pipe);
      if (pipe === undefined) return null;
      return orientAwayFrom(pipe.c, pits.get(traced.from)) as Local[];
    })
    .filter((line): line is Local[] => line !== null && line.length >= 2);

  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';

  for (const pass of ['halo', 'path'] as const) {
    context.strokeStyle = pass === 'halo' ? palette.pathHalo : palette.path;
    context.lineWidth = pass === 'halo' ? 7 : 3.5;
    for (const line of lines) {
      context.beginPath();
      const [first, ...rest] = line;
      const [sx, sy] = toScreen(viewport, first!);
      context.moveTo(sx, sy);
      for (const point of rest) {
        const [x, y] = toScreen(viewport, point);
        context.lineTo(x, y);
      }
      context.stroke();
    }
  }

  if (viewport.scale >= ARROW_MIN_SCALE) {
    for (const line of lines) {
      for (const arrow of arrowsAlong(line, ARROW_SPACING_M)) {
        drawArrowhead(context, viewport, arrow, palette);
      }
    }
  }

  for (const ending of trace.endings) {
    const at = endingPoint(ending, pipes, pits);
    if (at === undefined) continue;
    markerAt(
      context,
      viewport,
      at,
      stoppedBecauseOfTheRecord(ending.reason) ? palette.stopIncomplete : palette.stopOutside,
      4.5,
    );
  }

  const start = pits.get(trace.start);
  if (start !== undefined) markerAt(context, viewport, start, palette.start, 6.5);

  context.restore();
}

/**
 * Where to mark an ending.
 *
 * At the far end of the pipe that could not be followed when there is one, so
 * the mark sits where the path visibly stops rather than back at the pit it
 * left; at the pit itself when no pipe was recorded at all.
 */
export function endingPoint(
  ending: Ending,
  pipes: Map<string, Pipe>,
  pits: Map<string, Local>,
): Local | undefined {
  const atPit = pits.get(ending.atPit);
  if (ending.pipe === null) return atPit;

  const pipe = pipes.get(ending.pipe);
  if (pipe === undefined || pipe.c.length === 0) return atPit;

  const oriented = orientAwayFrom(pipe.c, atPit);
  return oriented[oriented.length - 1];
}
