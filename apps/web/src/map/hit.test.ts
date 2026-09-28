import { describe, expect, it } from 'vitest';

import { type ArtefactError, assertUsable, boundsOf } from './artefact.js';
import { SUGGESTED_HALO_R } from './draw.js';
import { TAP_RADIUS_PX, distanceToSegment, pick, pickComparison, selectableLayers } from './hit.js';
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

describe('only what is drawn can be selected', () => {
  /*
   * The press lands exactly on the pit every time below. What changes is
   * whether the layer was drawn, which is the whole of the defect: with Pits
   * switched off the markers disappeared and the pits stayed selectable, so a
   * press on apparently blank ground opened a card about something not on the
   * map.
   */
  const on = toScreen(view, [500, 500]);
  const layers = {
    pit: [pit(500, 500, 1147906)],
    pipe: [pipe([[400, 500], [600, 500]], 77)],
  };

  it('finds the pit when its layer is drawn', () => {
    const shown = selectableLayers(layers, { pits: true, pipes: true });
    expect(pick(on, view, shown)?.kind).toBe('pit');
  });

  it('finds nothing where a hidden pit is, even dead centre', () => {
    const shown = selectableLayers(layers, { pits: false, pipes: false });
    expect(pick(on, view, shown)).toBeNull();
  });

  it('falls through to the pipe when only the pits are hidden', () => {
    // Not "nothing": the pipe is still on screen under the press, and it is
    // only the pit that was winning the tie.
    const shown = selectableLayers(layers, { pits: false, pipes: true });
    expect(pick(on, view, shown)?.kind).toBe('pipe');
  });

  it('hides the pipes without hiding the pits', () => {
    const shown = selectableLayers(layers, { pits: true, pipes: false });
    expect(pick(on, view, shown)?.kind).toBe('pit');
    expect(shown.pipe).toEqual([]);
  });

  it('offers nothing for a layer the artefact does not carry', () => {
    // An absent layer and a switched-off one are the same to a press, and
    // neither may reach `pick` as undefined.
    expect(selectableLayers({}, { pits: true, pipes: true })).toEqual({ pit: [], pipe: [] });
  });
});

describe('a press on the comparison map reaches the drain it asks about', () => {
  /*
   * The user test of 15 September, at 200 Bourke Street: the highlighted drain
   * about 10 m from the address, a grey pit that cannot be tested 3 m from the
   * drain, and the map at about three pixels a metre. A press on the drain's
   * ripple, a little off its centre, selected the grey pit and said
   * "Can't be tested".
   */
  const street = { ...view, scale: 3 };
  const drain = pit(510, 500, 1363621);
  const grey = pit(513, 500, 999001);
  const layers = { pit: [grey, drain], pipe: [pipe([[400, 500], [600, 500]], 77)] };
  const marks = { comparable: new Set(['1363621']), suggested: 1363621 };
  const pressAt = (east: number, north: number, dx = 0) => {
    const [x, y] = toScreen(street, [east, north]);
    return [x + dx, y] as const;
  };

  it('reproduces the defect: nearest-wins picks the grey pit', () => {
    // Five pixels right of the drain's centre is four from the grey pit's.
    expect(pick(pressAt(510, 500, 5), street, layers)?.feature).toBe(grey);
  });

  it('gives that press to the highlighted drain', () => {
    expect(pickComparison(pressAt(510, 500, 5), street, layers, marks)?.feature).toBe(drain);
    expect(pickComparison(pressAt(510, 500), street, layers, marks)?.feature).toBe(drain);
  });

  it('gives it to the highlighted drain even dead centre on the grey pit, which sits on its ripple', () => {
    expect(pickComparison(pressAt(513, 500), street, layers, marks)?.feature).toBe(drain);
  });

  it('reaches the highlighted drain anywhere on its ripple, past the ordinary tap radius', () => {
    const onRipple = pressAt(510, 500, -(SUGGESTED_HALO_R - 1));
    expect(SUGGESTED_HALO_R - 1).toBeGreaterThan(TAP_RADIUS_PX);
    expect(pickComparison(onRipple, street, layers, marks)?.feature).toBe(drain);
    expect(pickComparison(pressAt(510, 500, -(SUGGESTED_HALO_R + 2)), street, layers, marks)?.kind).toBe('pipe');
  });

  it('prefers any comparable drain to a grey pit, on later steps too', () => {
    // No suggestion from step 2 on: the chosen drain is simply comparable.
    const later = { comparable: new Set(['1363621']), suggested: null };
    expect(pickComparison(pressAt(510, 500, 5), street, layers, later)?.feature).toBe(drain);
  });

  it('takes the nearer of two drains that can both be chosen, off the highlighted drain’s disc', () => {
    // 73 Bayswater Road: a second comparable drain 14 px from the highlighted
    // one. Its visible edge, outside the highlighted disc, stays pressable.
    const other = pit(514.7, 500, 1363588);
    const both = { comparable: new Set(['1363621', '1363588']), suggested: 1363621 };
    const hit = pickComparison(pressAt(514.7, 500, 5), street, { pit: [drain, other] }, both);
    expect(hit?.feature).toBe(other);
  });

  it('gives a press on the highlighted drain’s painted disc to that drain, whatever lies under it', () => {
    // Ten pixels from the highlighted centre, four from the other drain's:
    // but the highlighted disc is painted over it there.
    const other = pit(514.7, 500, 1363588);
    const both = { comparable: new Set(['1363621', '1363588']), suggested: 1363621 };
    expect(pickComparison(pressAt(510, 500, 10), street, { pit: [drain, other, grey] }, both)?.feature).toBe(drain);
    // The chosen drain on later steps is painted the same way.
    const later = { comparable: both.comparable, suggested: null, selected: 1363621 };
    expect(pickComparison(pressAt(510, 500, 10), street, { pit: [drain, other] }, later)?.feature).toBe(drain);
  });

  it('still answers with the grey pit when nothing that can be chosen is in reach', () => {
    const alone = pit(560, 500, 999002);
    const hit = pickComparison(pressAt(560, 500), street, { pit: [drain, alone] }, marks);
    expect(hit?.feature).toBe(alone);
  });
});
