/**
 * The two-level control, proved as a truth table.
 *
 * The interesting cases are the ones a component would get wrong by accident:
 * a sub-layer switch that survives its mode being turned off and on, a mode
 * that quietly owns a layer twice, and the hatching that must not be hostage
 * to any of them.
 */
import { describe, expect, it } from 'vitest';

import {
  ALL_MODES,
  GUIDED_MODES,
  INDEPENDENT_KEYS,
  type LayerKey,
  MODES,
  type MapMode,
  SUBLAYER_KEYS,
  effectiveLayers,
  openingModes,
  ownerOf,
  subLayersWith,
  visibilityOf,
} from './modes.js';

const ALL_LAYERS: readonly LayerKey[] = [
  'pit',
  'pipe',
  'terrain',
  'channel',
  'lowPoint',
  'unavailable',
];

const BOTH_ON = subLayersWith(true);

describe('the mode table', () => {
  it('names the four modes in the order the criterion lists them', () => {
    expect(MODES.map((mode) => mode.key)).toEqual([
      'drainage',
      'water-flow',
      'terrain',
      'low-areas',
    ]);
  });

  it('governs every layer exactly once', () => {
    const governed = [...MODES.flatMap((mode) => mode.layers), ...INDEPENDENT_KEYS];
    expect([...governed].sort()).toEqual([...ALL_LAYERS].sort());
  });

  it('borrows a swatch from a layer it governs, so a chip cannot show a mark the mode does not draw', () => {
    for (const mode of MODES) {
      expect(mode.layers).toContain(mode.swatchOf);
    }
  });

  it('names an owner for the drainage sub-layers and none for the hatching', () => {
    expect(ownerOf('pit')).toBe('drainage');
    expect(ownerOf('pipe')).toBe('drainage');
    expect(ownerOf('unavailable')).toBeNull();
  });

  it('offers a sub-layer switch for exactly the layers no chip covers', () => {
    const onChips = MODES.flatMap((mode) => mode.layers);
    // Pits and pipes are switchable because Drainage covers both at once;
    // the hatching is switchable because no chip covers it at all.
    expect([...SUBLAYER_KEYS].sort()).toEqual(['pipe', 'pit', 'unavailable']);
    expect(onChips.filter((key) => key === 'pit')).toHaveLength(1);
  });
});

describe('effectiveLayers', () => {
  it('draws everything when every mode and switch is on', () => {
    expect(effectiveLayers(ALL_MODES, BOTH_ON)).toEqual({
      pit: true,
      pipe: true,
      terrain: true,
      channel: true,
      lowPoint: true,
      unavailable: true,
    });
  });

  it('hides both drainage layers when the mode is off, whatever the switches say', () => {
    const off = { ...ALL_MODES, drainage: false };
    const layers = effectiveLayers(off, BOTH_ON);
    expect(layers.pit).toBe(false);
    expect(layers.pipe).toBe(false);
    // AC 1.1.4: the other modes are unaffected by this one.
    expect(layers.channel).toBe(true);
    expect(layers.lowPoint).toBe(true);
  });

  it('switches pits and pipes independently — AC 1.1.5', () => {
    const noPipes = effectiveLayers(ALL_MODES, { pit: true, pipe: false, unavailable: false });
    expect(noPipes.pit).toBe(true);
    expect(noPipes.pipe).toBe(false);

    const noPits = effectiveLayers(ALL_MODES, { pit: false, pipe: true, unavailable: false });
    expect(noPits.pit).toBe(false);
    expect(noPits.pipe).toBe(true);
  });

  it('remembers a hidden sub-layer across the mode being turned off and on again', () => {
    const sub = { pit: true, pipe: false, unavailable: false };
    const hidden = effectiveLayers({ ...ALL_MODES, drainage: false }, sub);
    expect(hidden.pipe).toBe(false);

    // The switch is the same object; only the mode moved. Coming back must not
    // resurrect the layer the person turned off.
    const back = effectiveLayers(ALL_MODES, sub);
    expect(back.pit).toBe(true);
    expect(back.pipe).toBe(false);
  });

  it('keeps the hatching answerable to its own switch and to no mode', () => {
    const noModes = {
      drainage: false,
      'water-flow': false,
      terrain: false,
      'low-areas': false,
    } as const;
    expect(effectiveLayers(noModes, subLayersWith(true)).unavailable).toBe(true);
    expect(effectiveLayers(ALL_MODES, subLayersWith(false)).unavailable).toBe(false);
  });

  it('passes only the derived layers to the canvas', () => {
    expect(visibilityOf(effectiveLayers(ALL_MODES, BOTH_ON))).toEqual({
      channel: true,
      lowPoint: true,
      unavailable: true,
    });
  });
});

describe('openingModes', () => {
  const requests: readonly MapMode[] = ['drainage', 'water-flow', 'terrain', 'low-areas'];

  it('turns on the mode that was asked for, and no other except terrain', () => {
    for (const requested of requests) {
      const modes = openingModes(requested);
      expect(modes[requested]).toBe(true);
      const on = requests.filter((key) => modes[key]);
      expect([...on].sort()).toEqual([...new Set([requested, 'terrain'])].sort());
    }
  });

  it('keeps terrain underneath even when something else was chosen', () => {
    expect(openingModes('water-flow').terrain).toBe(true);
  });
});

describe('the presets', () => {
  it('opens the unguided map with every mode on', () => {
    expect(Object.values(ALL_MODES).every(Boolean)).toBe(true);
  });

  it('leaves low areas out of the guided task, and nothing else', () => {
    expect(GUIDED_MODES['low-areas']).toBe(false);
    expect(GUIDED_MODES.drainage && GUIDED_MODES['water-flow'] && GUIDED_MODES.terrain).toBe(true);
  });

  it('starts with both drainage layers on', () => {
    expect(subLayersWith(false)).toEqual({ pit: true, pipe: true, unavailable: false });
  });
});
