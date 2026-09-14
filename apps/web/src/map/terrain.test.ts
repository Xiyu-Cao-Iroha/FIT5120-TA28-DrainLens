/**
 * Tests for the ground-surface layer, Terrain V1.1.
 *
 * What goes wrong with a terrain layer is rarely an error. It is a surface that
 * looks plausible and says something false: a ramp that re-fits itself and
 * changes what a colour means, a shading that brightens and shifts hue, a
 * raster placed a kilometre from the pipes drawn over it, or a layer painted
 * and then erased. The tests below are about those.
 */

import { describe, expect, it } from 'vitest';

import type { MapArtefact } from './artefact.js';
import { DAY, drawMap } from './draw.js';
import {
  BUILDING_HEX,
  RAMP,
  RAMP_GRADIENT,
  RAMP_HIGH_HEX,
  RAMP_LOW_HEX,
  ROAD_OVER_TERRAIN,
  type Rgb,
  TerrainError,
  drawTerrain,
  drawTerrainShade,
  hexToRgb,
  loadTerrain,
  placement,
  rampColour,
  rasterise,
  shadeFactor,
} from './terrain.js';
import { fit } from './viewport.js';

/** CIE L*, for asserting that lightness only ever falls as the ground rises. */
function lightness([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

describe('the fixed AHD ramp', () => {
  it('draws every node in the colour the colour card gives it', () => {
    for (const node of RAMP) {
      const drawn = rampColour(node.metres);
      const card = hexToRgb(node.hex);
      for (let channel = 0; channel < 3; channel += 1) {
        expect(Math.abs(drawn[channel]! - card[channel]!)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is fixed: a height has one colour, whatever else is on the map', () => {
    // The old ramp was fitted between percentiles of the ground in view, so
    // 3 m was a different colour on a flat street and on a hill.
    expect(rampColour(3)).toEqual(rampColour(3));
    expect(rampColour(3)).toEqual(hexToRgb('#e9d180'));
  });

  it('gets darker all the way up, so greyscale still reads high and low', () => {
    let previous = Infinity;
    for (let tenths = 0; tenths <= 400; tenths += 1) {
      const l = lightness(rampColour(tenths / 10));
      // Within a third of a unit: each channel is rounded to a whole byte, which
      // alone moves L* by up to about 0.3 between neighbouring heights.
      expect(l).toBeLessThanOrEqual(previous + 0.3);
      previous = l;
    }
    expect(lightness(rampColour(0)) - lightness(rampColour(40))).toBeGreaterThan(20);
  });

  it('separates 2 m from 4 m by hue, where most of the pilot ground is', () => {
    const [r2, g2, b2] = rampColour(2);
    const [r4, g4, b4] = rampColour(4);
    // 2 m is yellow-green (green above red), 4 m is orange (red well above green).
    expect(g2).toBeGreaterThan(r2 - 10);
    expect(r4 - g4).toBeGreaterThan(40);
    expect(b2).not.toBe(b4);
  });

  it('clamps below 0 m and above 40 m rather than running off the ends', () => {
    expect(rampColour(-3.29)).toEqual(rampColour(0));
    expect(rampColour(120)).toEqual(rampColour(40));
    expect(rampColour(Number.NaN)).toEqual(rampColour(0));
  });

  it('publishes its ends and every node to the legend', () => {
    expect(RAMP_LOW_HEX).toBe('#d7e4d4');
    expect(RAMP_HIGH_HEX).toBe('#e08159');
    for (const node of RAMP) expect(RAMP_GRADIENT).toContain(node.hex);
    expect(RAMP.map((n) => n.metres)).toEqual([0, 1, 2, 3, 4, 5, 10, 20, 40]);
  });
});

describe('the hillshade factor', () => {
  it('only darkens: flat-lit is 1, the deepest shadow 0.81, nothing above 1', () => {
    // The old 0.5 + 0.5 × mult had a gain of 1.11 and clipped six of the nine
    // ramp nodes. A multiply that never exceeds 1 cannot clip.
    expect(shadeFactor(255)).toBeCloseTo(1, 6);
    expect(shadeFactor(0)).toBeCloseTo(0.81, 6);
    for (let byte = 0; byte <= 255; byte += 1) expect(shadeFactor(byte)).toBeLessThanOrEqual(1);
  });
});

const HEADER = {
  grid: { rows: 2, cols: 2 },
  extent: { name: 't', min_e: 316500, min_n: 5814500, width_m: 2, height_m: 2 },
  arrays: {
    ground: { file: 'ground.bin', scale: 100 },
    buildings: { file: 'buildings.bin' },
    shade: { file: 'shade.bin' },
  },
};

function fixtures(
  overrides: { header?: unknown; ground?: Int16Array; buildings?: Uint8Array; shade?: Uint8Array } = {},
) {
  const files: Record<string, ArrayBuffer> = {
    'ground.bin': (overrides.ground ?? Int16Array.from([100, 250, 400, 3000])).buffer as ArrayBuffer,
    // Cell 1 is a building: 0b0100_0000.
    'buildings.bin': (overrides.buildings ?? Uint8Array.from([0b0100_0000])).buffer as ArrayBuffer,
    'shade.bin': (overrides.shade ?? Uint8Array.from([255, 0, 128, 0])).buffer as ArrayBuffer,
  };
  return loadTerrain('/terrain', {
    fetchJson: () => Promise.resolve(overrides.header ?? HEADER),
    fetchBinary: (url: string) => Promise.resolve(files[url.split('/').pop()!]!),
  });
}

describe('loadTerrain', () => {
  it('reads the raw ground in metres, the building bits and the shade', async () => {
    const terrain = await fixtures();
    expect([...terrain.groundM]).toEqual([1, 2.5, 4, 30]);
    expect([...terrain.building]).toEqual([0, 1, 0, 0]);
    expect([...terrain.shade]).toEqual([255, 0, 128, 0]);
    expect(terrain.extent.min_e).toBe(316500);
  });

  it('refuses arrays of the wrong length, which would be a seam rather than an error', async () => {
    await expect(fixtures({ ground: Int16Array.from([1, 2, 3]) })).rejects.toThrow(/ground array/);
    await expect(fixtures({ shade: Uint8Array.from([1]) })).rejects.toThrow(/shade array/);
    await expect(fixtures({ buildings: Uint8Array.from([0, 0]) })).rejects.toThrow(/building mask/);
  });

  it('refuses a header that does not say where the terrain is', async () => {
    // Placed nowhere in particular, the raster lands at the map's own corner:
    // on the council map, 1.5 km west and 6 km south of Kensington.
    await expect(fixtures({ header: { ...HEADER, extent: undefined } })).rejects.toThrow(/where it is/);
  });

  it('refuses a grid with no area, an unscaled ground, or unnamed arrays', async () => {
    await expect(fixtures({ header: { ...HEADER, grid: { rows: 0, cols: 2 } } })).rejects.toThrow(TerrainError);
    await expect(
      fixtures({ header: { ...HEADER, arrays: { ...HEADER.arrays, ground: { file: 'g', scale: 0 } } } }),
    ).rejects.toThrow(/scale/);
    await expect(fixtures({ header: { ...HEADER, arrays: { ground: HEADER.arrays.ground } } })).rejects.toThrow(
      /building and shade/,
    );
    await expect(fixtures({ header: { ...HEADER, arrays: {} } })).rejects.toThrow(/ground array/);
  });
});

/** A canvas stub whose image data can be read back. */
function stubCanvas(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  const context = {
    createImageData: (w: number, h: number) => ({ data, width: w, height: h }),
    putImageData: () => undefined,
  };
  return { data, canvas: { width, height, getContext: () => context } as unknown as HTMLCanvasElement };
}

describe('rasterise', () => {
  it('paints ground on the ramp, buildings grey, and every cell opaque', async () => {
    const terrain = await fixtures();
    const colour = stubCanvas(2, 2);
    const shade = stubCanvas(2, 2);
    const made = [colour, shade];
    rasterise(terrain, () => made.shift()!.canvas);

    expect([...colour.data.slice(0, 3)]).toEqual([...rampColour(1)]);
    expect([...colour.data.slice(4, 7)]).toEqual([...hexToRgb(BUILDING_HEX)]);
    for (let cell = 0; cell < 4; cell += 1) expect(colour.data[cell * 4 + 3]).toBe(255);
  });

  it('shades ground by the factor and leaves buildings unshaded', async () => {
    const terrain = await fixtures();
    const colour = stubCanvas(2, 2);
    const shade = stubCanvas(2, 2);
    const made = [colour, shade];
    rasterise(terrain, () => made.shift()!.canvas);

    expect(shade.data[0]).toBe(255); // lit ground
    expect(shade.data[4]).toBe(255); // a building, whatever its shade byte says
    expect(shade.data[12]).toBe(Math.round(255 * shadeFactor(0))); // shadowed ground
  });

  it('refuses a canvas that gives no context rather than drawing nothing', async () => {
    const terrain = await fixtures();
    const noContext = { width: 2, height: 2, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => rasterise(terrain, () => noContext)).toThrow(TerrainError);
  });
});

describe('where the raster lands', () => {
  const kensington = { min_e: 316500, min_n: 5814500, width_m: 1000, height_m: 1000 };

  it('covers the map corner to corner when the map is the same extent', () => {
    const viewport = fit(800, 800, { widthM: 1000, heightM: 1000 });
    const at = placement(kensington, kensington, viewport);
    expect(at.width).toBeCloseTo(1000 * viewport.scale);
    expect(at.left + at.width / 2).toBeCloseTo(400);
    expect(at.top + at.height / 2).toBeCloseTo(400);
  });

  it('is offset into the council map rather than stretched over it', () => {
    // The council extent starts 1,500 m west and 6,000 m south of Kensington.
    const council = { min_e: 315000, min_n: 5808500 };
    const viewport = { widthPx: 850, heightPx: 900, scale: 0.1, centre: [4250, 4500] as const };
    const at = placement(kensington, council, viewport);
    expect(at.width).toBeCloseTo(100); // 1,000 m at 0.1 px/m, not 8,500 m
    expect(at.left).toBeCloseTo(425 + (1500 - 4250) * 0.1);
    expect(at.top).toBeCloseTo(450 - (7000 - 4500) * 0.1);
  });
});

describe('drawing it', () => {
  function context() {
    const calls: { op: string; args: unknown[]; composite: string; alpha: number }[] = [];
    const state = { composite: 'source-over', alpha: 1 };
    const c = {
      calls,
      save: () => calls.push({ op: 'save', args: [], ...state }),
      restore: () => {
        state.composite = 'source-over';
        state.alpha = 1;
        calls.push({ op: 'restore', args: [], ...state });
      },
      drawImage: (...args: unknown[]) => calls.push({ op: 'drawImage', args, ...state }),
      set globalCompositeOperation(value: string) {
        state.composite = value;
      },
      get globalCompositeOperation() {
        return state.composite;
      },
      set globalAlpha(value: number) {
        state.alpha = value;
      },
      imageSmoothingEnabled: true,
    };
    return c as typeof c & CanvasRenderingContext2D;
  }
  const painted = {
    colour: { id: 'colour' } as unknown as HTMLCanvasElement,
    shade: { id: 'shade' } as unknown as HTMLCanvasElement,
    extent: { min_e: 0, min_n: 0, width_m: 1000, height_m: 1000 },
  };
  const viewport = fit(800, 600, { widthM: 1000, heightM: 1000 });

  it('draws the colour opaque, not faded to three quarters', () => {
    const ctx = context();
    drawTerrain(ctx, painted, viewport, { min_e: 0, min_n: 0 });
    const drawn = ctx.calls.find((c) => c.op === 'drawImage')!;
    expect(drawn.args[0]).toBe(painted.colour);
    expect(drawn.alpha).toBe(1);
    expect(drawn.composite).toBe('source-over');
  });

  it('multiplies the shade, and restores the composite so nothing after it is darkened', () => {
    const ctx = context();
    drawTerrainShade(ctx, painted, viewport, { min_e: 0, min_n: 0 });
    const drawn = ctx.calls.find((c) => c.op === 'drawImage')!;
    expect(drawn.args[0]).toBe(painted.shade);
    expect(drawn.composite).toBe('multiply');
    expect(ctx.calls.at(-1)?.op).toBe('restore');
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });
});

/**
 * The order, which is Terrain V1.1's and the opposite of what it replaced.
 *
 * The terrain was once drawn before `drawMap` and erased by its opening fill:
 * computed, drawn, and gone before a single road went over it, which a
 * teammate reported as "the button does nothing". Every unit test passed. What
 * is asserted here is the sequence on one canvas.
 */
describe('the order on the canvas', () => {
  const artefact = {
    artefact: 'map-geometry',
    version: 1,
    extent: { name: 't', min_e: 0, min_n: 0, width_m: 1000, height_m: 1000 },
    coordinates: 'metres',
    crs: 't',
    sources: [],
    layers: {
      road: [{ g: 'polygon', c: [[[100, 400], [900, 400], [900, 420], [100, 420]]] }],
      pipe: [{ g: 'line', ref: 1, c: [[100, 500], [900, 500]] }],
    },
  } as unknown as MapArtefact;

  function recorder() {
    const calls: { op: string; fill: string }[] = [];
    const state = { fillStyle: '' };
    const note = (op: string) => () => calls.push({ op, fill: state.fillStyle });
    const context = {
      calls,
      save: note('save'), restore: note('restore'),
      beginPath: note('beginPath'), moveTo: note('moveTo'), lineTo: note('lineTo'),
      closePath: note('closePath'), stroke: note('stroke'), fill: note('fill'),
      arc: note('arc'), rect: note('rect'), clip: note('clip'),
      fillRect: note('fillRect'), drawImage: note('drawImage'),
      translate: note('translate'), rotate: note('rotate'), setTransform: note('setTransform'),
      measureText: () => ({ width: 10 }), fillText: note('fillText'), strokeText: note('strokeText'),
      setLineDash: note('setLineDash'),
      get fillStyle() {
        return state.fillStyle;
      },
      set fillStyle(value: string) {
        state.fillStyle = value;
      },
      strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
      font: '', textAlign: '', textBaseline: '', globalAlpha: 1, imageSmoothingEnabled: true,
    };
    return context as typeof context & CanvasRenderingContext2D;
  }

  it('paints ground, then terrain, then roads, then shade, then the network', () => {
    const ctx = recorder();
    drawMap(ctx, artefact, fit(800, 600, { widthM: 1000, heightM: 1000 }), {
      palette: { ...DAY, road: ROAD_OVER_TERRAIN },
      beneathRoads: (c) => {
        c.drawImage({} as HTMLCanvasElement, 0, 0);
      },
      overRoads: (c) => {
        c.save();
        c.restore();
      },
    });
    const ops = ctx.calls.map((c) => c.op);
    const terrainAt = ops.indexOf('drawImage');
    const lastGroundFill = ops.lastIndexOf('fillRect');
    const roadFill = ctx.calls.findIndex((c) => c.op === 'fill' && c.fill === ROAD_OVER_TERRAIN);
    const shadeAt = ops.indexOf('save', roadFill);
    const pipeStroke = ops.indexOf('stroke', shadeAt);

    expect(lastGroundFill).toBeLessThan(terrainAt);
    expect(terrainAt).toBeLessThan(roadFill);
    expect(roadFill).toBeLessThan(shadeAt);
    expect(shadeAt).toBeLessThan(pipeStroke);
  });

  it('still paints the flat ground when there is no terrain', () => {
    const ctx = recorder();
    drawMap(ctx, artefact, fit(800, 600, { widthM: 1000, heightM: 1000 }), {});
    expect(ctx.calls.filter((c) => c.op === 'fillRect').length).toBeGreaterThan(0);
    expect(ctx.calls.some((c) => c.op === 'drawImage')).toBe(false);
  });
});
