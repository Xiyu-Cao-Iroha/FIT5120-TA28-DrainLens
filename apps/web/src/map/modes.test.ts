/**
 * Which layers are where, and what each way in opens with.
 *
 * The interesting property is coverage: every layer must appear in exactly one
 * of the two control groups. A layer in neither is one nothing can switch, and
 * a layer in both is two controls disagreeing about the same thing — and both
 * failures look like a working map until somebody presses the wrong one.
 */
import { describe, expect, it } from 'vitest';

import {
  ALL_ON,
  CHIP_KEYS,
  GUIDED_ON,
  type LayerKey,
  type MapMode,
  PANEL_KEYS,
  openingLayers,
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

describe('where each control lives', () => {
  it('gives every layer exactly one control', () => {
    const governed = [...CHIP_KEYS, ...PANEL_KEYS];
    expect([...governed].sort()).toEqual([...ALL_LAYERS].sort());
  });

  it('puts the recorded network on the chips and the background behind Layers', () => {
    // The departure from AC 1.1.4 and 1.1.5, asserted rather than left to a
    // comment: pits and pipes are chips, terrain is not. See the note at the
    // top of `modes.ts` and the deviation recorded in the acceptance file.
    expect(CHIP_KEYS).toEqual(['pit', 'pipe', 'channel', 'lowPoint']);
    expect(PANEL_KEYS).toEqual(['terrain', 'unavailable']);
  });

  it('keeps pits and pipes separate, which is what both criteria protect', () => {
    expect(CHIP_KEYS).toContain('pit');
    expect(CHIP_KEYS).toContain('pipe');
  });
});

describe('the presets', () => {
  it('opens the unguided map with every layer on', () => {
    expect(Object.values(ALL_ON).every(Boolean)).toBe(true);
  });

  it('leaves low areas and the hatching out of the guided task, and nothing else', () => {
    expect(GUIDED_ON.lowPoint).toBe(false);
    expect(GUIDED_ON.unavailable).toBe(false);
    expect(GUIDED_ON.pit && GUIDED_ON.pipe && GUIDED_ON.channel && GUIDED_ON.terrain).toBe(true);
  });

  it('passes only the derived layers to the canvas', () => {
    expect(visibilityOf(ALL_ON)).toEqual({ channel: true, lowPoint: true, unavailable: true });
  });
});

describe('openingLayers', () => {
  const WAYS_IN: readonly MapMode[] = ['drainage', 'water-flow', 'terrain', 'low-areas'];

  it('turns on what the card named and nothing else, except terrain', () => {
    expect(openingLayers('drainage')).toEqual({
      pit: true,
      pipe: true,
      channel: false,
      lowPoint: false,
      terrain: true,
      unavailable: false,
    });
    expect(openingLayers('water-flow').channel).toBe(true);
    expect(openingLayers('water-flow').pit).toBe(false);
    expect(openingLayers('low-areas').lowPoint).toBe(true);
    expect(openingLayers('low-areas').channel).toBe(false);
  });

  it('opens drainage with both of its layers, not one', () => {
    // The card says "the public pits and pipes the council has a record of".
    const drainage = openingLayers('drainage');
    expect(drainage.pit && drainage.pipe).toBe(true);
  });

  it('keeps terrain underneath every way in', () => {
    for (const way of WAYS_IN) {
      expect(openingLayers(way).terrain).toBe(true);
    }
  });

  it('opens terrain on its own when terrain is what was asked for', () => {
    expect(openingLayers('terrain')).toEqual({
      pit: false,
      pipe: false,
      channel: false,
      lowPoint: false,
      terrain: true,
      unavailable: false,
    });
  });

  it('never opens the hatching from a card', () => {
    // It is a statement about the evidence and it belongs to the reader, not
    // to the way they arrived. The full map turns it on; a card does not.
    for (const way of WAYS_IN) {
      expect(openingLayers(way).unavailable).toBe(false);
    }
  });
});
