import { describe, expect, it } from 'vitest';

import {
  type Bounds,
  MAX_SCALE,
  type Viewport,
  ViewportError,
  clamp,
  fit,
  focus,
  LOCAL_SCALE,
  pan,
  scaleToCover,
  toLocal,
  toScreen,
  visibleBounds,
  zoomAt,
} from './viewport.js';

/** The demonstration extent: one square kilometre. */
const KENSINGTON: Bounds = { widthM: 1000, heightM: 1000 };

const square = (px = 800): Viewport => fit(px, px, KENSINGTON);

describe('the frame', () => {
  it('puts the centre of the map at the centre of the canvas', () => {
    const view = square();
    expect(toScreen(view, [500, 500])).toEqual([400, 400]);
  });

  it('puts north at the top', () => {
    // The bug this file exists to prevent. Get the sign wrong and the map
    // renders, pans, and points at the wrong house.
    const view = square();
    const [, northY] = toScreen(view, [500, 900]);
    const [, southY] = toScreen(view, [500, 100]);
    expect(northY).toBeLessThan(southY);
  });

  it('puts east at the right', () => {
    const view = square();
    const [eastX] = toScreen(view, [900, 500]);
    const [westX] = toScreen(view, [100, 500]);
    expect(eastX).toBeGreaterThan(westX);
  });

  it('places the south-west corner of the extent at the bottom left', () => {
    const view = square();
    expect(toScreen(view, [0, 0])).toEqual([0, 800]);
    expect(toScreen(view, [1000, 1000])).toEqual([800, 0]);
  });

  it('round-trips a point through the screen and back', () => {
    const view = square();
    for (const point of [
      [0, 0],
      [1000, 1000],
      [317.4, 812.9],
      [500, 500],
    ] as const) {
      const [east, north] = toLocal(view, toScreen(view, point));
      expect(east).toBeCloseTo(point[0], 9);
      expect(north).toBeCloseTo(point[1], 9);
    }
  });

  it('round-trips on a canvas that is not square', () => {
    const view = fit(1200, 500, KENSINGTON);
    const [east, north] = toLocal(view, toScreen(view, [123.4, 987.6]));
    expect(east).toBeCloseTo(123.4, 9);
    expect(north).toBeCloseTo(987.6, 9);
  });
});

describe('fitting the extent', () => {
  it('fills the canvas rather than letterboxing it', () => {
    // A wide canvas on a square extent has to overflow top and bottom, not
    // leave grey bars: the grey would be outside the pilot area, which the
    // product never implies it knows anything about.
    const view = fit(1200, 600, KENSINGTON);
    expect(view.scale).toBe(1.2);
    const seen = visibleBounds(view);
    expect(seen.minE).toBeCloseTo(0);
    expect(seen.maxE).toBeCloseTo(1000);
    expect(seen.maxN - seen.minN).toBeLessThan(1000);
  });

  it('scales by whichever axis needs more', () => {
    expect(scaleToCover(800, 400, KENSINGTON)).toBe(0.8);
    expect(scaleToCover(400, 800, KENSINGTON)).toBe(0.8);
  });

  it('refuses a canvas or an extent with no area', () => {
    expect(() => fit(0, 800, KENSINGTON)).toThrow(ViewportError);
    expect(() => fit(800, 0, KENSINGTON)).toThrow(ViewportError);
    expect(() => fit(800, 800, { widthM: 0, heightM: 1000 })).toThrow(/no area/);
  });
});

describe('panning', () => {
  it('drags the map with the finger', () => {
    const view = square();
    // Dragging right shows what was to the west, so the centre moves west.
    expect(pan(view, 80, 0).centre[0]).toBeLessThan(view.centre[0]);
    // Dragging down shows what was to the north, so the centre moves north.
    expect(pan(view, 0, 80).centre[1]).toBeGreaterThan(view.centre[1]);
  });

  it('moves by the distance dragged, in metres', () => {
    const view = { ...square(), scale: 2 };
    expect(pan(view, 100, 0).centre[0]).toBeCloseTo(view.centre[0] - 50);
  });

  it('holds still under the point that was grabbed', () => {
    const view = square();
    const grabbed: readonly [number, number] = [300, 200];
    const before = toLocal(view, grabbed);
    const after = toLocal(pan(view, 55, -35), [grabbed[0] + 55, grabbed[1] - 35]);
    expect(after[0]).toBeCloseTo(before[0], 9);
    expect(after[1]).toBeCloseTo(before[1], 9);
  });
});

describe('zooming', () => {
  it('holds the anchor point still', () => {
    // What makes a wheel feel like the map moving rather than the window.
    const view = square();
    const anchor: readonly [number, number] = [620, 180];
    const held = toLocal(view, anchor);
    const after = toLocal(zoomAt(view, 2, anchor, KENSINGTON), anchor);
    expect(after[0]).toBeCloseTo(held[0], 6);
    expect(after[1]).toBeCloseTo(held[1], 6);
  });

  it('holds the anchor still when zooming out too', () => {
    const view = { ...square(), scale: 2 };
    const anchor: readonly [number, number] = [120, 700];
    const held = toLocal(view, anchor);
    const after = toLocal(zoomAt(view, 0.5, anchor, KENSINGTON), anchor);
    expect(after[0]).toBeCloseTo(held[0], 6);
    expect(after[1]).toBeCloseTo(held[1], 6);
  });

  it('will not zoom out past the whole extent', () => {
    const view = square();
    expect(zoomAt(view, 0.1, [400, 400], KENSINGTON).scale).toBe(view.scale);
  });

  it('stops enlarging where the artefacts stop having detail', () => {
    // Past a few pixels per metre this is magnification, and it invites
    // reading precision into a surface whose source is quoted at 25 cm.
    const view = square();
    expect(zoomAt(view, 1000, [400, 400], KENSINGTON).scale).toBe(MAX_SCALE);
  });

  it('refuses a factor that is not positive', () => {
    expect(() => zoomAt(square(), 0, [0, 0], KENSINGTON)).toThrow(ViewportError);
    expect(() => zoomAt(square(), -2, [0, 0], KENSINGTON)).toThrow(/positive/);
  });
});

describe('clamping to the pilot area', () => {
  it('keeps the canvas full of map when zoomed in', () => {
    const zoomed = { ...square(), scale: 2, centre: [10, 10] as const };
    const held = clamp(zoomed, KENSINGTON);
    const seen = visibleBounds(held);
    expect(seen.minE).toBeGreaterThanOrEqual(-1e-9);
    expect(seen.minN).toBeGreaterThanOrEqual(-1e-9);
  });

  it('holds the far corner in as well', () => {
    const zoomed = { ...square(), scale: 2, centre: [9999, 9999] as const };
    const seen = visibleBounds(clamp(zoomed, KENSINGTON));
    expect(seen.maxE).toBeLessThanOrEqual(1000 + 1e-9);
    expect(seen.maxN).toBeLessThanOrEqual(1000 + 1e-9);
  });

  it('centres the map instead when the canvas is wider than it', () => {
    // Nothing to clamp against: overflow would be blank either way, so the
    // honest arrangement is the map in the middle.
    const wide = { ...fit(800, 800, KENSINGTON), scale: 0.4, centre: [0, 0] as const };
    expect(clamp(wide, KENSINGTON).centre).toEqual([500, 500]);
  });

  it('leaves a viewport already inside alone', () => {
    const view = square();
    expect(clamp(view, KENSINGTON).centre).toEqual(view.centre);
  });
});

describe('what is on screen', () => {
  it('reports the rectangle in map coordinates', () => {
    const view = { ...square(), scale: 1, centre: [500, 500] as const };
    const seen = visibleBounds(view);
    expect(seen.minE).toBeCloseTo(100);
    expect(seen.maxE).toBeCloseTo(900);
    expect(seen.minN).toBeCloseTo(100);
    expect(seen.maxN).toBeCloseTo(900);
  });

  it('always reports minimums below maximums, whatever the sign flip', () => {
    const seen = visibleBounds(fit(1200, 500, KENSINGTON));
    expect(seen.minE).toBeLessThan(seen.maxE);
    expect(seen.minN).toBeLessThan(seen.maxN);
  });
});

describe('focus', () => {
  it('centres on the point it is given', () => {
    const view = focus(800, 600, KENSINGTON, [300, 700]);
    expect(view.centre[0]).toBeCloseTo(300);
    expect(view.centre[1]).toBeCloseTo(700);
  });

  it('puts the point at the middle of the canvas', () => {
    // The property AC 1.1.2.a actually asks for, stated in screen terms
    // rather than in the viewport's own.
    const at: readonly [number, number] = [420, 310];
    const view = focus(800, 600, KENSINGTON, at);
    const [x, y] = toScreen(view, at);
    expect(x).toBeCloseTo(400);
    expect(y).toBeCloseTo(300);
  });

  it('opens closer than the whole extent, so a local map is local', () => {
    expect(focus(800, 600, KENSINGTON, [500, 500]).scale).toBe(LOCAL_SCALE);
    expect(LOCAL_SCALE).toBeGreaterThan(scaleToCover(800, 600, KENSINGTON));
  });

  it('moves as far as it can towards an address near the boundary, and no further', () => {
    // Never onto blank ground outside the pilot area: the product is careful
    // not to imply it knows anything there.
    const view = focus(800, 600, KENSINGTON, [5, 5]);
    const seen = visibleBounds(view);
    expect(seen.minE).toBeGreaterThanOrEqual(-0.001);
    expect(seen.minN).toBeGreaterThanOrEqual(-0.001);
  });

  it('is fit when the requested scale cannot fill the canvas', () => {
    // What the full-map task gets: the clamp pins the centre, so the whole
    // extent still shows and the marker still marks.
    const wide = focus(1200, 500, KENSINGTON, [200, 200], 0.1);
    expect(wide.scale).toBeCloseTo(scaleToCover(1200, 500, KENSINGTON));
    expect(wide.centre[0]).toBeCloseTo(500);
  });

  it('never opens past the zoom ceiling', () => {
    expect(focus(800, 600, KENSINGTON, [500, 500], 999).scale).toBe(MAX_SCALE);
  });

  it('leaves nothing blank at any address in the extent', () => {
    for (const at of [[0, 0], [1000, 1000], [0, 1000], [1000, 0], [500, 500]] as const) {
      const seen = visibleBounds(focus(800, 600, KENSINGTON, at));
      expect(seen.minE).toBeGreaterThanOrEqual(-0.001);
      expect(seen.maxE).toBeLessThanOrEqual(1000.001);
      expect(seen.minN).toBeGreaterThanOrEqual(-0.001);
      expect(seen.maxN).toBeLessThanOrEqual(1000.001);
    }
  });
});
