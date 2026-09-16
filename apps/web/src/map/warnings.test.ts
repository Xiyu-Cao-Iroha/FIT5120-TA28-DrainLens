/**
 * The warning signs on especially deep low areas.
 *
 * Three questions, each a pure function, because each has a way of being
 * wrong that looks right on screen: a sign drawn on the zoomed-out view where
 * it covers a neighbourhood, a sign half off the edge that cannot be pressed,
 * and a sign that takes presses meant for the pit beside it.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  WARNING_BODY,
  WARNING_HEIGHT_PX,
  WARNING_MIN_SCALE,
  WARNING_TITLE,
  WARNING_WIDTH_PX,
  type WarningPoint,
  WarningsError,
  assertWarnings,
  drawWarnings,
  loadWarnings,
  pickWarning,
  warningsInView,
  warningsUrl,
  warningsVisible,
} from './warnings.js';
import { TAP_RADIUS_PX } from './hit.js';
import { type Viewport, toScreen } from './viewport.js';

const KENSINGTON = { name: 'kensington', width_m: 1000, height_m: 1000 };
const view: Viewport = { widthPx: 800, heightPx: 600, scale: 2, centre: [500, 500] };
const at = (e: number, n: number): WarningPoint => ({ c: [e, n], depthM: 1.2, areaM2: 400 });

const artefact = (over: Record<string, unknown> = {}) => ({
  artefact: 'low-area-warnings',
  version: 1,
  basis: 'derived',
  extent: KENSINGTON,
  points: [at(500, 500)],
  ...over,
});

describe('when the signs are drawn', () => {
  it('only with Low areas on', () => {
    expect(warningsVisible(false, 4)).toBe(false);
    expect(warningsVisible(true, 4)).toBe(true);
  });

  it('from the minimum scale in, and not on the zoomed-out view', () => {
    expect(warningsVisible(true, WARNING_MIN_SCALE)).toBe(true);
    expect(warningsVisible(true, WARNING_MIN_SCALE - 0.01)).toBe(false);
    // Kensington's whole square kilometre across a 1080-pixel map.
    expect(warningsVisible(true, 1080 / 1000)).toBe(false);
  });

  it("at the guide's opening view, 300 m across a 560-pixel frame", () => {
    expect(warningsVisible(true, 560 / 300)).toBe(true);
  });
});

describe('which signs are in view', () => {
  it('keeps a sign on screen and leaves out one far off it', () => {
    const inside = at(500, 500);
    const away = at(100, 100);
    expect(warningsInView([inside, away], view)).toEqual([inside]);
  });

  it('keeps a sign whose point is just off the edge but whose triangle is not', () => {
    // 5 px past the right edge: half the triangle is still showing.
    const [edge] = toScreen(view, [700, 500]);
    expect(edge).toBe(view.widthPx);
    const past = at(700 + 5 / view.scale, 500);
    const gone = at(700 + (WARNING_WIDTH_PX / 2 + 1) / view.scale, 500);
    expect(warningsInView([past, gone], view)).toEqual([past]);
  });
});

describe('pressing a sign', () => {
  const sign = at(500, 500);
  const [x, y] = toScreen(view, sign.c);

  it('hits anywhere inside the drawn triangle’s box', () => {
    expect(pickWarning([x, y], view, [sign])).toBe(sign);
    expect(pickWarning([x + WARNING_WIDTH_PX / 2, y + WARNING_HEIGHT_PX / 2], view, [sign])).toBe(sign);
  });

  it('misses just outside it, even within a pit’s tap radius', () => {
    // A pit beside the sign keeps its presses: the sign's target is its own
    // mark, not the 18-pixel radius a pit gets.
    const beside = WARNING_WIDTH_PX / 2 + 2;
    expect(beside).toBeLessThan(TAP_RADIUS_PX);
    expect(pickWarning([x + beside, y], view, [sign])).toBeNull();
    expect(pickWarning([x, y - WARNING_HEIGHT_PX / 2 - 1], view, [sign])).toBeNull();
  });

  it('chooses the nearer of two overlapping signs', () => {
    const other = at(500 + 8 / view.scale, 500);
    expect(pickWarning([x + 6, y], view, [sign, other])).toBe(other);
    expect(pickWarning([x + 1, y], view, [sign, other])).toBe(sign);
  });

  it('finds nothing with no signs', () => {
    expect(pickWarning([x, y], view, [])).toBeNull();
  });
});

describe('the sign and its card', () => {
  it('says exactly what was asked for', () => {
    expect(WARNING_TITLE).toBe('Water collects here easily');
    // Copy audit v2, #62: the advice alone, without repeating the title.
    expect(WARNING_BODY).toBe('Avoid parking here when heavy rain is coming.');
  });

  it('is drawn with paths, never with a glyph the font does not have', () => {
    const ops: string[] = [];
    const record = (op: string) => () => {
      ops.push(op);
    };
    const context = {
      save: record('save'),
      restore: record('restore'),
      beginPath: record('beginPath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      closePath: record('closePath'),
      arc: record('arc'),
      fill: record('fill'),
      stroke: record('stroke'),
      fillText: record('fillText'),
      strokeText: record('strokeText'),
    } as unknown as CanvasRenderingContext2D;
    drawWarnings(context, [at(500, 500), at(0, 0)], view);
    expect(ops).not.toContain('fillText');
    expect(ops).not.toContain('strokeText');
    // One sign in view, so one save and one restore.
    expect(ops.filter((op) => op === 'save')).toHaveLength(1);
    expect(ops.filter((op) => op === 'restore')).toHaveLength(1);
  });
});

describe('the artefact', () => {
  it('accepts one for this map', () => {
    expect(() => assertWarnings(artefact(), KENSINGTON)).not.toThrow();
  });

  it('refuses one for another extent, which would draw in the wrong frame', () => {
    const council = { name: 'city-of-melbourne', width_m: 8500, height_m: 9000 };
    expect(() => assertWarnings(artefact({ extent: council }), KENSINGTON)).toThrow(/wrong place/);
    expect(() => assertWarnings(artefact({ extent: { ...KENSINGTON, width_m: 999 } }), KENSINGTON)).toThrow(WarningsError);
  });

  it('refuses what is not one', () => {
    expect(() => assertWarnings(null, KENSINGTON)).toThrow(/not one/);
    expect(() => assertWarnings(artefact({ version: 2 }), KENSINGTON)).toThrow(/version 2/);
    expect(() => assertWarnings(artefact({ basis: 'recorded' }), KENSINGTON)).toThrow(/derived/);
    expect(() => assertWarnings(artefact({ points: undefined }), KENSINGTON)).toThrow(/no points/);
  });

  it('is fetched by the name of the extent that was served', async () => {
    const asked: string[] = [];
    const loaded = await loadWarnings(KENSINGTON, (url) => {
      asked.push(url);
      return Promise.resolve(artefact());
    });
    expect(asked).toEqual(['/data/warnings/kensington.json']);
    expect(loaded.points).toHaveLength(1);
    expect(warningsUrl('city-of-melbourne')).toBe('/data/warnings/city-of-melbourne.json');
  });

  it('ships for the bundled map, in its frame', () => {
    const data = (name: string): unknown =>
      JSON.parse(readFileSync(path.resolve(__dirname, '../../public/data', name), 'utf8'));
    const map = data('map.json') as { extent: typeof KENSINGTON };
    const warnings = data('warnings/kensington.json');
    assertWarnings(warnings, map.extent);
    expect(warnings.points.length).toBeGreaterThan(0);
    for (const point of warnings.points) {
      expect(point.c[0]).toBeGreaterThanOrEqual(0);
      expect(point.c[0]).toBeLessThanOrEqual(map.extent.width_m);
      expect(point.c[1]).toBeGreaterThanOrEqual(0);
      expect(point.c[1]).toBeLessThanOrEqual(map.extent.height_m);
    }
  });
});
