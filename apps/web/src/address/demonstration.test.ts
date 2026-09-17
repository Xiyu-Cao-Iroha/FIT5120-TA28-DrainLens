/**
 * The address the product offers when somebody has not got one of their own.
 *
 * Written on 11 September and shipped the same day **with no test at all** —
 * a module whose whole argument is that the offer is named and checkable,
 * unchecked. The self-check that afternoon found it at 0% and this is the
 * repair.
 *
 * What matters here is the fallback. `check-guide.mjs` asserts the named
 * address is in the published index, so the fallback should never fire in
 * production; these are about what happens when it does, because a silent
 * return to "whichever address sorts first" is how this module came to exist.
 */

import { describe, expect, it } from 'vitest';

import { DEMONSTRATION_LABEL, demonstrationAddress } from './demonstration.js';
import type { AddressIndex, IndexedAddress } from './search.js';

const at = (id: string, label: string, e = 500, n = 500): IndexedAddress => {
  const [number = '', ...rest] = label.split(' ');
  return { id, label, number, street: rest.join(' ').split(',')[0] ?? '', suburb: 'Kensington', e, n };
};

const index = (addresses: readonly IndexedAddress[]): AddressIndex => ({
  area: 'kensington',
  addresses,
});

describe('choosing the address to offer', () => {
  it('picks the named one wherever it sits in the index', () => {
    // Not the first. The whole point is that the offer is chosen rather than
    // being whatever the pipeline's sort left at the top.
    const chosen = demonstrationAddress(
      index([
        at('a', '32 Altona Street, Kensington'),
        at('b', '1 Bellair Street, Kensington'),
        at('c', DEMONSTRATION_LABEL),
      ]),
    );
    expect(chosen?.label).toBe(DEMONSTRATION_LABEL);
    expect(chosen?.id).toBe('c');
  });

  it('matches without caring about case', () => {
    const chosen = demonstrationAddress(index([at('a', DEMONSTRATION_LABEL.toUpperCase())]));
    expect(chosen?.id).toBe('a');
  });

  it('falls back to the first address when the named one is gone', () => {
    /*
     * The behaviour to be deliberate about. An index rebuilt from a new
     * release could drop this address, and a screen with no suggestion at all
     * is worse than one suggesting an arbitrary address.
     *
     * It must not be silent, which is why `tools/data/check-guide.mjs`
     * asserts the named address is published and at least 150 m from every
     * boundary. That check fails the build; this fallback keeps the screen
     * working while somebody fixes it.
     */
    const chosen = demonstrationAddress(index([at('a', '32 Altona Street, Kensington')]));
    expect(chosen?.id).toBe('a');
  });

  it('returns nothing for an empty index rather than inventing an address', () => {
    expect(demonstrationAddress(index([]))).toBeUndefined();
  });

  it('names an address in the pilot suburb, not a placeholder', () => {
    // A guard on the constant itself: a label that stopped being a real
    // Kensington address would pass every test above by falling back.
    expect(DEMONSTRATION_LABEL).toMatch(/Kensington$/);
    expect(DEMONSTRATION_LABEL).toMatch(/^\d/);
  });
});

describe('the comparison’s own offer', () => {
  it('names a published address the comparison can show a difference for', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { unpack } = await import('./search.js');
    const { COMPARE_DEMONSTRATION_LABEL } = await import('./demonstration.js');
    const { comparableNear } = await import('../scenario/eligibility.js');
    const { differingDrains } = await import('../scenario/differences.js');
    const data = (name: string): unknown =>
      JSON.parse(readFileSync(path.resolve(__dirname, '../../public/data', name), 'utf8')) as unknown;
    const map = data('map.json') as { extent: { min_e: number; min_n: number; width_m: number; height_m: number }; layers: { pit: never[] } };
    const published = unpack(data('addresses.json') as never, map.extent);
    const offered = demonstrationAddress(published, COMPARE_DEMONSTRATION_LABEL);
    expect(offered?.label).toBe(COMPARE_DEMONSTRATION_LABEL);
    const tiles = data('scene-tiles/index.json') as { windows: Record<string, unknown> };
    const differing = differingDrains(data('scenario-differences.json') as never);
    const found = comparableNear(
      [offered?.e ?? 0, offered?.n ?? 0],
      map.layers.pit,
      new Set(Object.keys(tiles.windows)),
      undefined,
      differing,
    );
    expect(found.showsDifference).toBe(true);
  });

  it('falls back to the guide’s address, then to the first', () => {
    const guide = at('g', DEMONSTRATION_LABEL);
    expect(demonstrationAddress(index([at('a', '1 Any Street, Kensington'), guide]), 'Nowhere').id).toBe('g');
  });
});

describe('the three example addresses', () => {
  it('offers the named ones the index holds, in order, and no more than three', async () => {
    const { demonstrationAddresses, EXAMPLE_COUNT } = await import('./demonstration.js');
    const labels = ['4 D Street, Kensington', '1 A Street, Kensington', '2 B Street, Kensington', '3 C Street, Kensington'];
    const offered = demonstrationAddresses(
      index([at('c', labels[3]!), at('a', labels[1]!), at('b', labels[2]!), at('d', labels[0]!)]),
      labels,
    );
    expect(EXAMPLE_COUNT).toBe(3);
    expect(offered.map((a) => a.id)).toEqual(['d', 'a', 'b']);
  });

  it('skips a name the index does not hold rather than inventing one', async () => {
    const { demonstrationAddresses } = await import('./demonstration.js');
    const offered = demonstrationAddresses(index([at('x', '9 Other Street, Kensington'), at('b', '2 B Street, Kensington')]), [
      '1 A Street, Kensington',
      '2 B Street, Kensington',
    ]);
    expect(offered.map((a) => a.id)).toEqual(['b']);
  });

  it('keeps one fallback when it holds none of them, and nothing for an empty index', async () => {
    const { demonstrationAddresses } = await import('./demonstration.js');
    expect(demonstrationAddresses(index([at('x', '9 Other Street, Kensington')]), ['1 A Street, Kensington']).map((a) => a.id)).toEqual(['x']);
    expect(demonstrationAddresses(index([]))).toEqual([]);
  });

  it('offers three guide addresses on the bundled map, each centred and near a pit with a path', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { unpack } = await import('./search.js');
    const { DEMONSTRATION_LABELS, demonstrationAddresses } = await import('./demonstration.js');
    const { chooseTeachingPit } = await import('../tutorial/pit.js');
    const data = (name: string): unknown =>
      JSON.parse(readFileSync(path.resolve(__dirname, '../../public/data', name), 'utf8')) as unknown;
    const map = data('map.json') as { extent: { min_e: number; min_n: number; width_m: number; height_m: number }; layers: { pit: never[] } };
    const offered = demonstrationAddresses(unpack(data('addresses.json') as never, map.extent));
    expect(offered.map((a) => a.label)).toEqual(DEMONSTRATION_LABELS);
    for (const address of offered) {
      const margin = Math.min(address.e, address.n, map.extent.width_m - address.e, map.extent.height_m - address.n);
      expect(margin).toBeGreaterThanOrEqual(150);
      const pit = chooseTeachingPit([address.e, address.n], map.layers.pit, data('trace.json') as never);
      expect(pit?.steps ?? 0).toBeGreaterThanOrEqual(15);
      expect(pit?.distanceM ?? Infinity).toBeLessThanOrEqual(30);
    }
  });

  it('offers three comparison addresses on the council map, each opening on a drain that shows a difference', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { unpack } = await import('./search.js');
    const { COMPARE_DEMONSTRATION_LABELS, demonstrationAddresses } = await import('./demonstration.js');
    const { comparableNear } = await import('../scenario/eligibility.js');
    const { differingDrains } = await import('../scenario/differences.js');
    const read = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const data = (name: string) => read(path.resolve(__dirname, '../../public/data', name));
    type MapFile = { extent: { min_e: number; min_n: number; width_m: number; height_m: number }; layers: { pit: never[] } };
    const supported = new Set(Object.keys((data('scene-tiles/index.json') as { windows: object }).windows));
    const differing = differingDrains(data('scenario-differences.json') as never);
    const opensOnDifference = (map: MapFile, labels: readonly string[]) => {
      const offered = demonstrationAddresses(unpack(data('addresses.json') as never, map.extent), COMPARE_DEMONSTRATION_LABELS);
      expect(offered.map((a) => a.label)).toEqual(labels);
      for (const address of offered) {
        const found = comparableNear([address.e, address.n], map.layers.pit, supported, undefined, differing);
        expect(found.showsDifference, address.label).toBe(true);
        expect(found.nearest?.distanceM ?? Infinity, address.label).toBeLessThanOrEqual(20);
      }
    };
    // The live map: the first three.
    const council = read(path.resolve(__dirname, '../../../api/data/city-of-melbourne/map.json')) as MapFile;
    opensOnDifference(council, COMPARE_DEMONSTRATION_LABELS.slice(0, 3));
    // The Kensington fallback: the two it holds.
    const bundled = data('map.json') as MapFile;
    opensOnDifference(bundled, [COMPARE_DEMONSTRATION_LABELS[0]!, COMPARE_DEMONSTRATION_LABELS[3]!]);
  }, 60_000);
});
