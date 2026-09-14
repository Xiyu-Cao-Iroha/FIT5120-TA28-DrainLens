/**
 * The ground surface, as a layer under everything else — Terrain V1.1.
 *
 * AC 1.1.4 names Terrain as one of the four modes, and AC 1.3.1 requires it to
 * be labelled as system-derived. It answers one question: **which ground is
 * higher and which is lower.** Water paths, low areas, pipes and the address
 * are other layers.
 *
 * **This is derived, not recorded, and it is not a LiDAR product.** The
 * surface comes from aerial photography filtered to bare earth; 52.1% of the
 * pilot extent was measured directly and the rest — under roofs and canopy —
 * is interpolated. The hillshade is drawn weaker where that is so (see
 * `pipeline/.../terrain_display.py`).
 *
 * **What changed, and why the old reasoning no longer holds.**
 *
 * The first versions read `elevation.bin`, the scenario engine's conditioned
 * routing surface, and undid it for display: buildings were picked out by
 * height, and the colour ramp was fitted between the 2nd and 98th percentile
 * of the ground in the extent. Three things were wrong with that, measured on
 * Kensington:
 *
 * - the conditioned surface is filled flat across every hollow, so the hollows
 *   the Low areas layer outlines were drawn level;
 * - the ground is strongly skewed — 61.4% of it landed in the first tenth of a
 *   linear ramp, so the river flats where most people live were one colour;
 * - a ramp fitted to what is in view changes a colour's meaning whenever the
 *   view or the extent changes.
 *
 * Now the layer reads the raw ground (`/data/terrain/ground.bin`) and colours
 * it on a **fixed AHD ramp**: the same colour means the same height anywhere,
 * on any map. The previous comment argued that the surface's 25 cm accuracy
 * could not support a scale in metres; that was true of a percentile ramp with
 * nothing to anchor it, and it does not hold for this one. The finest step
 * named on the legend is a metre, four times the error, and heights are
 * written as whole metres at the nodes.
 *
 * **Elevation is carried by hue, not lightness.** Measured on the composited
 * pixels, the old ramp's 2 m and 4 m differed by 2.1 in lightness against a
 * hillshade swing of 69 — the shading drowned the elevation 33 to 1. The ramp
 * below moves through hue (grey-green to ochre to clay) with CIE L* still
 * falling monotonically as a redundant channel for greyscale and colour-vision
 * deficiency. Its chroma peaks at 5 m and falls above it on purpose, so high
 * ground recedes into a background tan rather than becoming a warning orange.
 * The low end is grey-green, well away from the blues the water layers use.
 *
 * **The hillshade only darkens.** It multiplies the map by a factor in
 * [0.81, 1.00]. The old `0.5 + 0.5 × mult` with a multiplier up to 1.22 had a
 * gain of 1.11 and clipped six of the nine ramp nodes, shifting their hue by up
 * to 16°. A multiply with nothing above 1 cannot clip.
 */

import type { TerrainMarks } from './terrainMarks.js';
import { type Viewport, toScreen } from './viewport.js';

export class TerrainError extends Error {}

/** A colour, 0-255 per channel. */
export type Rgb = readonly [number, number, number];

/**
 * The ramp's nodes, metres AHD. From the handover's colour card, where each was
 * placed in OKLCH; interpolation between them is in OKLab, so lightness stays
 * monotonic between nodes as well as at them.
 */
export const RAMP: readonly { readonly metres: number; readonly hex: string }[] = [
  { metres: 0, hex: '#d7e4d4' },
  { metres: 1, hex: '#d1e3bf' },
  { metres: 2, hex: '#d9dda0' },
  { metres: 3, hex: '#e9d180' },
  { metres: 4, hex: '#f7c265' },
  { metres: 5, hex: '#feb958' },
  { metres: 10, hex: '#f6ac68' },
  { metres: 20, hex: '#ed965f' },
  { metres: 40, hex: '#e08159' },
];

export const RAMP_LOW_HEX = RAMP[0]!.hex;
export const RAMP_HIGH_HEX = RAMP[RAMP.length - 1]!.hex;

/**
 * The ramp as CSS gradient stops, one node every equal step.
 *
 * The legend spaces the nodes evenly rather than by metres: 0 to 5 m is where
 * nearly all of the ground is, and a bar to scale would give it an eighth of
 * the width. The ticks say which metre each step is.
 */
export const RAMP_GRADIENT = `linear-gradient(to right, ${RAMP.map(
  (node, index) => `${node.hex} ${String((index / (RAMP.length - 1)) * 100)}%`,
).join(', ')})`;

/** Buildings: neutral, and not shaded. They are not ground. */
export const BUILDING_HEX = '#ceccc8';

/**
 * Roads over the terrain, as a colour to paint with.
 *
 * An opaque white road punched a hole in the ramp exactly where people look.
 * This is the handover's `base × 0.34 + 255 × 0.66`, which is white at 66%:
 * the street pattern still reads, and the height underneath it still shows.
 */
export const ROAD_OVER_TERRAIN = 'rgba(255, 255, 255, 0.66)';

/** The hillshade byte to a multiply factor: `0.5 + 0.5 × (0.62 + 0.38 × hs)`. */
export function shadeFactor(byte: number): number {
  return 0.5 + 0.5 * (0.62 + (0.38 * byte) / 255);
}

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
};

/** sRGB to OKLab (Björn Ottosson's matrices). */
export function toOklab([r, g, b]: Rgb): readonly [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function fromOklab([L, a, b]: readonly [number, number, number]): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const NODES = RAMP.map((node) => ({ metres: node.metres, lab: toOklab(hexToRgb(node.hex)) }));

/**
 * The colour for a height in metres AHD, clamped at both ends: ground below
 * 0 m is drawn in the 0 m colour and ground above 40 m in the 40 m colour.
 * Kensington's ground runs from -3.29 to 29.84 m, so only the river-bank
 * cells below datum meet the clamp.
 */
export function rampColour(metres: number): Rgb {
  const first = NODES[0]!;
  const last = NODES[NODES.length - 1]!;
  if (!(metres > first.metres)) return fromOklab(first.lab);
  if (metres >= last.metres) return fromOklab(last.lab);
  let upper = 1;
  while (NODES[upper]!.metres < metres) upper += 1;
  const lo = NODES[upper - 1]!;
  const hi = NODES[upper]!;
  const t = (metres - lo.metres) / (hi.metres - lo.metres);
  return fromOklab([
    lo.lab[0] + (hi.lab[0] - lo.lab[0]) * t,
    lo.lab[1] + (hi.lab[1] - lo.lab[1]) * t,
    lo.lab[2] + (hi.lab[2] - lo.lab[2]) * t,
  ]);
}

/** Where a terrain raster sits, in metres of its own coordinate system. */
export interface TerrainExtent {
  readonly min_e: number;
  readonly min_n: number;
  readonly width_m: number;
  readonly height_m: number;
}

export interface TerrainRaster {
  readonly cols: number;
  readonly rows: number;
  /** Metres AHD, row 0 being the northern edge. */
  readonly groundM: Float32Array;
  /** One byte per cell, 1 inside a building footprint. */
  readonly building: Uint8Array;
  /** Hillshade bytes, already attenuated where the ground was interpolated. */
  readonly shade: Uint8Array;
  readonly extent: TerrainExtent;
}

interface Header {
  grid?: { rows?: number; cols?: number };
  extent?: Partial<TerrainExtent>;
  arrays?: {
    ground?: { file?: string; scale?: number };
    buildings?: { file?: string };
    shade?: { file?: string };
  };
}

/** Read the display terrain: raw ground, building mask and hillshade. */
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
  const header = (await fetchJson(`${base}/terrain.json`)) as Header;
  const rows = header.grid?.rows ?? 0;
  const cols = header.grid?.cols ?? 0;
  const ground = header.arrays?.ground;
  const extent = header.extent;

  if (!(rows > 0) || !(cols > 0)) throw new TerrainError('the terrain declares a grid with no area');
  if (typeof ground?.file !== 'string') throw new TerrainError('the terrain does not name its ground array');
  if (!((ground.scale ?? 0) > 0)) throw new TerrainError('the terrain does not say how to scale its heights');
  if (typeof header.arrays?.buildings?.file !== 'string' || typeof header.arrays.shade?.file !== 'string') {
    throw new TerrainError('the terrain does not name its building and shade arrays');
  }
  if (
    !extent ||
    !Number.isFinite(extent.min_e) ||
    !Number.isFinite(extent.min_n) ||
    !((extent.width_m ?? 0) > 0) ||
    !((extent.height_m ?? 0) > 0)
  ) {
    // Without it the raster is placed wherever the map happens to start, which
    // on the council map is 1.5 km west and 6 km south of Kensington.
    throw new TerrainError('the terrain does not say where it is');
  }

  const cells = rows * cols;
  const [centimetres, bits, shade] = await Promise.all([
    fetchBinary(`${base}/${ground.file}`).then((b) => new Int16Array(b)),
    fetchBinary(`${base}/${header.arrays.buildings.file}`).then((b) => new Uint8Array(b)),
    fetchBinary(`${base}/${header.arrays.shade.file}`).then((b) => new Uint8Array(b)),
  ]);
  if (centimetres.length !== cells) {
    throw new TerrainError(`the ground array holds ${String(centimetres.length)} cells but the grid is ${String(cells)}`);
  }
  if (shade.length !== cells) {
    throw new TerrainError(`the shade array holds ${String(shade.length)} cells but the grid is ${String(cells)}`);
  }
  if (bits.length !== Math.ceil(cells / 8)) {
    throw new TerrainError(`the building mask holds ${String(bits.length)} bytes but the grid needs ${String(Math.ceil(cells / 8))}`);
  }

  const groundM = new Float32Array(cells);
  const building = new Uint8Array(cells);
  for (let cell = 0; cell < cells; cell += 1) {
    groundM[cell] = centimetres[cell]! / ground.scale!;
    building[cell] = (bits[cell >> 3]! >> (7 - (cell & 7))) & 1;
  }
  return { cols, rows, groundM, building, shade, extent: extent as TerrainExtent };
}

/** The two images the map draws: colour under the roads, shade over them. */
export interface PaintedTerrain {
  readonly colour: HTMLCanvasElement;
  readonly shade: HTMLCanvasElement;
  readonly extent: TerrainExtent;
  /** Contours and spot heights, when they loaded. The layer still draws without them. */
  readonly marks?: TerrainMarks;
}

/**
 * Paint both rasters once, at their own resolution.
 *
 * Kept as canvases so panning and zooming are a `drawImage` rather than a
 * million-cell loop per frame. The colour ramp is looked up per centimetre
 * rather than computed per cell.
 */
export function rasterise(
  terrain: TerrainRaster,
  create: (w: number, h: number) => HTMLCanvasElement,
): PaintedTerrain {
  const colourCanvas = create(terrain.cols, terrain.rows);
  const shadeCanvas = create(terrain.cols, terrain.rows);
  const colourContext = colourCanvas.getContext('2d');
  const shadeContext = shadeCanvas.getContext('2d');
  if (colourContext === null || shadeContext === null) {
    throw new TerrainError('a canvas for the terrain could not be created');
  }

  const building = hexToRgb(BUILDING_HEX);
  const cache = new Map<number, Rgb>();
  const colour = colourContext.createImageData(terrain.cols, terrain.rows);
  const shade = shadeContext.createImageData(terrain.cols, terrain.rows);
  for (let cell = 0; cell < terrain.groundM.length; cell += 1) {
    const at = cell * 4;
    const isBuilding = terrain.building[cell] === 1;
    let rgb = building;
    if (!isBuilding) {
      const key = Math.round(terrain.groundM[cell]! * 100);
      rgb = cache.get(key) ?? rampColour(key / 100);
      cache.set(key, rgb);
    }
    colour.data[at] = rgb[0];
    colour.data[at + 1] = rgb[1];
    colour.data[at + 2] = rgb[2];
    colour.data[at + 3] = 255;

    // Buildings take no shading: a white multiply leaves them as they are.
    const grey = isBuilding ? 255 : Math.round(255 * shadeFactor(terrain.shade[cell]!));
    shade.data[at] = grey;
    shade.data[at + 1] = grey;
    shade.data[at + 2] = grey;
    shade.data[at + 3] = 255;
  }
  colourContext.putImageData(colour, 0, 0);
  shadeContext.putImageData(shade, 0, 0);
  return { colour: colourCanvas, shade: shadeCanvas, extent: terrain.extent };
}

/**
 * Where the raster lands on screen, in the frame of the map being drawn.
 *
 * Every artefact's coordinates are metres from its own extent's south-west
 * corner. The terrain is Kensington's square kilometre; the map may be the
 * whole council. So the raster is offset by the difference between the two
 * corners, not stretched over the map's bounds.
 */
export function placement(
  terrain: TerrainExtent,
  map: { readonly min_e?: number; readonly min_n?: number },
  viewport: Viewport,
): { left: number; top: number; width: number; height: number } {
  const east = terrain.min_e - (map.min_e ?? terrain.min_e);
  const north = terrain.min_n - (map.min_n ?? terrain.min_n);
  const [left, top] = toScreen(viewport, [east, north + terrain.height_m]);
  const [right, bottom] = toScreen(viewport, [east + terrain.width_m, north]);
  return { left, top, width: right - left, height: bottom - top };
}

/** The colour raster, opaque, under the roads. */
export function drawTerrain(
  context: CanvasRenderingContext2D,
  painted: PaintedTerrain,
  viewport: Viewport,
  map: { readonly min_e?: number; readonly min_n?: number },
): void {
  const { left, top, width, height } = placement(painted.extent, map, viewport);
  context.save();
  context.imageSmoothingEnabled = true;
  context.drawImage(painted.colour, left, top, width, height);
  context.restore();
}

/** The hillshade, multiplied over the colour and the roads together. */
export function drawTerrainShade(
  context: CanvasRenderingContext2D,
  painted: PaintedTerrain,
  viewport: Viewport,
  map: { readonly min_e?: number; readonly min_n?: number },
): void {
  const { left, top, width, height } = placement(painted.extent, map, viewport);
  context.save();
  context.globalCompositeOperation = 'multiply';
  context.imageSmoothingEnabled = true;
  context.drawImage(painted.shade, left, top, width, height);
  context.restore();
}
