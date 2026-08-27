import { describe, expect, it } from 'vitest';

import { type ArtefactError, assertUsable, boundsOf } from './artefact.js';
import { TAP_RADIUS_PX, distanceToSegment, pick } from './hit.js';
import { type Bounds, fit, toScreen } from './viewport.js';

const KENSINGTON: Bounds = { widthM: 1000, heightM: 1000 };
const view = fit(1000, 1000, KENSINGTON); // one pixel per metre, so metres read as pixels

const pit = (east: number, north: number, asset_number: number) =>
  ({ g: 'point', c: [east, north], asset_number }) as const;

const pipe = (path: readonly (readonly [number, number])[], ref: number) =>
  ({ g: 'line', c: path, ref }) as const;

describe('distance to a segment', () => {
  it('measures perpendicular when the foot falls on the segment', () => {
    expect(distanceToSegment([50, 10], [0, 0], [100, 0])).toBe(10);
  });

  it('measures to the end when the tap is past it', () => {
    // Not to the infinite line: a tap 300 pixels beyond a short pipe is not a
    // near miss, and treating it as one would select something off screen.
    expect(distanceToSegment([200, 0], [0, 0], [100, 0])).toBe(100);
    expect(distanceToSegment([-30, 40], [0, 0], [100, 0])).toBe(50);
  });

  it('handles a segment of zero length', () => {
    expect(distanceToSegment([3, 4], [0, 0], [0, 0])).toBe(5);
  });
});

describe('picking', () => {
  it('finds a pit under the tap', () => {
    const hit = pick(toScreen(view, [500, 500]), view, { pit: [pit(500, 500, 1147906)] });
    expect(hit?.kind).toBe('pit');
    expect(hit?.feature).toMatchObject({ asset_number: 1147906 });
  });

  it('finds nothing when the tap is in the middle of a street', () => {
    expect(pick(toScreen(view, [100, 100]), view, { pit: [pit(900, 900, 1)] })).toBeNull();
  });

  it('takes the nearest of two pits close together', () => {
    const hit = pick(toScreen(view, [502, 500]), view, {
      pit: [pit(495, 500, 111), pit(505, 500, 222)],
    });
    expect(hit?.feature).toMatchObject({ asset_number: 222 });
  });

  it('reaches further than a pit is drawn, because a finger is wider than a grate', () => {
    const nearby = toScreen(view, [500 + TAP_RADIUS_PX - 2, 500]);
    const far = toScreen(view, [500 + TAP_RADIUS_PX + 4, 500]);
    expect(pick(nearby, view, { pit: [pit(500, 500, 1)] })).not.toBeNull();
    expect(pick(far, view, { pit: [pit(500, 500, 1)] })).toBeNull();
  });

  it('measures the reach in pixels, so zooming out does not shrink the target', () => {
    // The moment a pit is hardest to hit is the moment the map is zoomed out.
    // A radius in metres would shrink exactly then.
    const close = { ...view, scale: 4 };
    const wide = { ...view, scale: 0.5 };
    const eightPixelsAway = (v: typeof view) => {
      const [x, y] = toScreen(v, [500, 500]);
      return [x + 8, y] as const;
    };
    expect(pick(eightPixelsAway(close), close, { pit: [pit(500, 500, 1)] })).not.toBeNull();
    expect(pick(eightPixelsAway(wide), wide, { pit: [pit(500, 500, 1)] })).not.toBeNull();
  });

  it('selects a pipe when the tap is on one and no pit is near', () => {
    const hit = pick(toScreen(view, [300, 500]), view, {
      pipe: [pipe([[200, 500], [400, 500]], 1511419)],
    });
    expect(hit?.kind).toBe('pipe');
    expect(hit?.feature).toMatchObject({ ref: 1511419 });
  });

  it('prefers the pit when a pit sits on the end of a pipe', () => {
    // Every pit does, so pipes would otherwise shadow the entire layer — and a
    // pit is the thing the interface has something to say about.
    const hit = pick(toScreen(view, [400, 500]), view, {
      pit: [pit(400, 500, 1145184)],
      pipe: [pipe([[200, 500], [400, 500]], 7)],
    });
    expect(hit?.kind).toBe('pit');
  });

  it('finds nothing in empty layers', () => {
    expect(pick([10, 10], view, {})).toBeNull();
    expect(pick([10, 10], view, { pit: [], pipe: [] })).toBeNull();
  });

  it('ignores a pipe with a single vertex, which has no segment to be near', () => {
    expect(pick(toScreen(view, [300, 500]), view, { pipe: [pipe([[300, 500]], 1)] })).toBeNull();
  });
});

describe('the artefact contract', () => {
  const usable = {
    artefact: 'map-geometry',
    version: 1,
    extent: { name: 'kensington', min_e: 316500, min_n: 5814500, width_m: 1000, height_m: 1000 },
    coordinates: 'metres from the corner',
    crs: 'EPSG:28355',
    sources: [
      {
        layer: 'pit',
        dataset_id: 'stormwater-pits',
        publisher: 'City of Melbourne Open Data Portal',
        licence: 'CC BY 4.0',
        last_modified: '2023-02-26',
        features: 895,
      },
    ],
    layers: {},
  };

  it('accepts the artefact the pipeline writes', () => {
    expect(() => assertUsable(usable)).not.toThrow();
    expect(boundsOf(usable as never)).toEqual({ widthM: 1000, heightM: 1000 });
  });

  it('refuses one that names no sources', () => {
    // Nothing goes on screen without a basis. An artefact that cannot say
    // where its contents came from cannot be displayed at all.
    expect(() => assertUsable({ ...usable, sources: [] })).toThrow(/no sources/);
  });

  it('refuses a different artefact that happens to be JSON', () => {
    expect(() => assertUsable({ artefact: 'ground-surface' })).toThrow(/map-geometry/);
    expect(() => assertUsable(null)).toThrow(/not an object/);
  });

  it('refuses an extent with no area rather than dividing by it later', () => {
    expect(() =>
      assertUsable({ ...usable, extent: { ...usable.extent, width_m: 0 } }),
    ).toThrow(/no area/);
  });

  it('refuses one with no layers block', () => {
    const { layers: _dropped, ...without } = usable;
    expect(() => assertUsable(without)).toThrow(/no layers/);
  });
});
