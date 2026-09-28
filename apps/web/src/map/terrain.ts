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
 * Now the layer is the raw ground coloured on a **fixed AHD ramp**: the same
 * colour means the same height anywhere, on any map. Since 14 September the
 * colouring is done at build time, into 500 m tiles for the whole council
 * (`terrainTiles.ts`, `pipeline/.../terrain_tiles.py`); this file keeps the ramp
 * itself, which the legend draws and the pipeline's copy is checked against. The previous comment argued that the surface's 25 cm accuracy
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
