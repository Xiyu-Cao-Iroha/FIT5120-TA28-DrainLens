/**
 * The ground surface, as a layer under everything else.
 *
 * AC 1.1.3.b names terrain as one of the five controllable layers, and until
 * now there was nothing to control: the map drew the recorded network and the
 * derived paths over a flat colour. That flat colour was the one thing on
 * screen quietly implying the ground is level, in a product whose entire
 * argument is that it is not.
 *
 * **This is derived, not recorded, and it is not a LiDAR product.** The
 * surface comes from aerial photography filtered to bare earth; 52.1% of this
 * extent was measured directly and the rest — under roofs and canopy — is
 * interpolated from the nearest measured ground. The `unavailable` layer
 * already hatches where too little was measured to say anything, and this
 * layer is drawn beneath it so that hatching still reads.
 *
 * The shading is relative, not absolute. It ramps across the ground actually
 * present in the extent rather than against sea level, because the question a
 * reader has is "which way is downhill from here", not "how high am I". A
 * legend in metres would invite the second reading and the surface's own
 * accuracy — about 25 cm — does not support it.
 *
 * **`elevation.bin` is the conditioned routing surface, not the ground.**
 * `scene.py` says so at the top and gives the reason: the flow field was
 * computed on it, and shipping the raw surface instead lost 71.6% of the
 * rain. Conditioning raises every building by `BARRIER_RAISE_M` — a hundred
 * metres — so water runs between them rather than through.
 *
 * A first version of this layer ramped from that array's own min to its max
 * and produced a map that looked like one flat colour. 26.1% of the cells sit
 * above 100 m, so the ramp spent almost all of itself on an artefact, and the
 * ground a resident actually stands on — median 3.2 m, everything under 30 m
 * — was compressed into the bottom few percent of it. A teammate reported it
 * as "the button does nothing", which is exactly what it looked like.
 *
 * So this file has to undo, for display only, something the engine needs. The
 * barrier cells are separated out and drawn as buildings rather than as very
 * high ground, and the ramp is fitted to the remaining ground at robust
 * percentiles rather than to its extremes.
 */

import { type Viewport, toScreen } from './viewport.js';

export class TerrainError extends Error {}

export interface TerrainRaster {
  readonly cols: number;
  readonly rows: number;
  /** Metres above the datum, row 0 being the northern edge. */
  readonly elevationM: Float32Array;
  readonly minM: number;
  readonly maxM: number;
}

/**
 * Low ground cool, high ground warm.
 *
 * The first attempt ramped to a pale near-white, which was almost exactly the
 * map's own ground fill — so the layer drew correctly and changed 6.8% of the
 * pixels on screen, which is a layer nobody can see. Both ends now sit clear
 * of #eef3ea. A hypsometric ramp is also the convention a reader already has:
 * cool is low, warm is high.
 */
const LOW: readonly [number, number, number] = [108, 140, 158];
const HIGH: readonly [number, number, number] = [226, 212, 178];

/** Buildings, drawn as buildings. Deliberately off the ground ramp. */
const BARRIER: readonly [number, number, number] = [176, 172, 166];

/**
 * Above this, a cell is a conditioning barrier rather than ground.
 *
 * `BARRIER_RAISE_M` is 100 and the highest real ground in the extent is
 * 29.84 m, so half the raise separates the two with 20 m of margin on the
 * ground side and 50 m on the barrier side. Measured, not guessed: it splits
 * 260,532 barrier cells from 739,468 ground ones, and the barrier count
 * matches the 258,754 the pipeline reports for the footprint mask.
 */
export const BARRIER_FLOOR_M = 50;

/**
 * Percentiles the ramp is fitted between.
 *
 * Not the extremes. A single spike would flatten everything else, which is
 * the failure this layer already had once — for a different reason, and with
 * the same symptom.
 */
export const RAMP_LOW_PERCENTILE = 0.02;
export const RAMP_HIGH_PERCENTILE = 0.98;

/**
 * Colour for one elevation, as a fraction of the extent's own range.
 *
 * Returns the low colour for a flat extent rather than dividing by zero — a
 * uniform surface is uniformly shaded, which is the truthful picture of it.
 */
export function shade(
  elevationM: number,
  minM: number,
  maxM: number,
): readonly [number, number, number] {
  // A conditioning barrier is a building, not the top of the ramp. Clamping
  // it to the highest ground colour would draw every roof as a hill.
  if (elevationM >= BARRIER_FLOOR_M) return BARRIER;

  const span = maxM - minM;
  const t = span <= 0 ? 0 : Math.max(0, Math.min(1, (elevationM - minM) / span));
  return [
    Math.round(LOW[0] + (HIGH[0] - LOW[0]) * t),
    Math.round(LOW[1] + (HIGH[1] - LOW[1]) * t),
    Math.round(LOW[2] + (HIGH[2] - LOW[2]) * t),
  ];
}

/** How strongly the terrain shows through. Context, not the subject. */
export const TERRAIN_ALPHA = 0.75;

/**
 * The range to fit the ramp across: ground only, at robust percentiles.
 *
 * Barrier cells are excluded before the percentiles are taken rather than
 * after, because at 26.1% of the extent they would otherwise dominate any
 * percentile high enough to be useful.
 *
 * Falls back to the full span when there is no ground at all, which cannot
 * happen on a real artefact and should not divide by zero if it does.
 */
export function groundRange(elevationM: Float32Array): { minM: number; maxM: number } {
  const ground: number[] = [];
  for (let cell = 0; cell < elevationM.length; cell += 1) {
    const metres = elevationM[cell]!;
    if (metres < BARRIER_FLOOR_M) ground.push(metres);
  }
  if (ground.length === 0) return { minM: 0, maxM: 1 };

  ground.sort((a, b) => a - b);
  const at = (p: number) => ground[Math.min(ground.length - 1, Math.floor(ground.length * p))]!;
  const minM = at(RAMP_LOW_PERCENTILE);
  const maxM = at(RAMP_HIGH_PERCENTILE);
  // A perfectly flat extent would give an empty span; shade() handles it, but
  // returning a usable one keeps the caller from having to know that.
  return maxM > minM ? { minM, maxM } : { minM, maxM: minM + 1 };
}

/**
 * Read the scene's elevation array into a raster the map can shade.
 *
 * The scene is fetched a second time here rather than shared with the worker.
 * It is the same URL, so the browser serves it from cache, and the alternative
 * — passing a megabyte back out of the worker — couples the map's layers to
 * the scenario engine's lifecycle for no gain.
 */
export async function loadTerrain(
  base: string,
  {
    fetchJson = (url: string) => fetch(url).then((r) => r.json()),
    fetchBinary = (url: string) => fetch(url).then((r) => r.arrayBuffer()),
  }: {
    fetchJson?: (url: string) => Promise<unknown>;
    fetchBinary?: (url: string) => Promise<ArrayBuffer>;
  } = {},
): Promise<TerrainRaster> {
  const header = (await fetchJson(`${base}/scene.json`)) as {
    grid?: { rows?: number; cols?: number };
    arrays?: { elevation?: { file?: string; scale?: number } };
  };

  const rows = header.grid?.rows;
  const cols = header.grid?.cols;
  const file = header.arrays?.elevation?.file;
  const scale = header.arrays?.elevation?.scale;

  if (!(rows! > 0) || !(cols! > 0)) throw new TerrainError('the scene declares a grid with no area');
  if (typeof file !== 'string') throw new TerrainError('the scene does not name its elevation array');
  if (!(scale! > 0)) throw new TerrainError('the scene does not say how to scale its elevations');

  const centimetres = new Int16Array(await fetchBinary(`${base}/${file}`));
  const cells = rows! * cols!;
  if (centimetres.length !== cells) {
    throw new TerrainError(
      `the elevation array holds ${centimetres.length} cells but the grid is ${cells}`,
    );
  }

  const elevationM = new Float32Array(cells);
  for (let cell = 0; cell < cells; cell += 1) {
    elevationM[cell] = centimetres[cell]! / scale!;
  }

  const { minM, maxM } = groundRange(elevationM);
  return { cols: cols!, rows: rows!, elevationM, minM, maxM };
}

/**
 * Paint the raster once, at its own resolution.
 *
 * Kept as its own canvas so panning and zooming are a `drawImage` rather than
 * a million-cell loop per frame. The map is north-up and axis-aligned, so no
 * rotation is ever needed and the transform is two corners.
 */
export function rasterise(
  terrain: TerrainRaster,
  create: (w: number, h: number) => HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = create(terrain.cols, terrain.rows);
  const context = canvas.getContext('2d');
  if (context === null) throw new TerrainError('a canvas for the terrain could not be created');

  const image = context.createImageData(terrain.cols, terrain.rows);
  for (let cell = 0; cell < terrain.elevationM.length; cell += 1) {
    const [r, g, b] = shade(terrain.elevationM[cell]!, terrain.minM, terrain.maxM);
    const at = cell * 4;
    image.data[at] = r;
    image.data[at + 1] = g;
    image.data[at + 2] = b;
    image.data[at + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Draw the painted raster into the viewport.
 *
 * Row 0 of the raster is the northern edge, so the image's top-left corner is
 * the extent's north-west corner in local metres. Both corners go through the
 * same `toScreen` every other layer uses, which is what keeps the terrain
 * registered with the pipes drawn over it.
 */
export function drawTerrain(
  context: CanvasRenderingContext2D,
  raster: HTMLCanvasElement,
  viewport: Viewport,
  extent: { readonly widthM: number; readonly heightM: number },
): void {
  const [left, top] = toScreen(viewport, [0, extent.heightM]);
  const [right, bottom] = toScreen(viewport, [extent.widthM, 0]);

  context.save();
  context.globalAlpha = TERRAIN_ALPHA;
  context.imageSmoothingEnabled = true;
  context.drawImage(raster, left, top, right - left, bottom - top);
  context.restore();
}
