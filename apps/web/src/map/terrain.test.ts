/**
 * Tests for the ground-surface layer, Terrain V1.1.
 *
 * What goes wrong with a terrain layer is rarely an error. It is a surface that
 * looks plausible and says something false: a ramp that re-fits itself and
 * changes what a colour means, a shading that brightens and shifts hue, a
 * layer painted and then erased. The tiles themselves are `terrainTiles.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import type { MapArtefact } from './artefact.js';
import { DAY, drawMap } from './draw.js';
import {
  RAMP,
  RAMP_GRADIENT,
  RAMP_HIGH_HEX,
  RAMP_LOW_HEX,
  ROAD_OVER_TERRAIN,
  type Rgb,
  hexToRgb,
  rampColour,
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
