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
  NOTHING_ON,
  PANEL_KEYS,
  openingLayers,
  visibilityOf,
} from './modes.js';
import { LEGEND_GROUPS } from './MapLayers.js';

const ALL_LAYERS: readonly LayerKey[] = [
  'pit',
  'pipe',
  'terrain',
  // Epic 6's two, from Iteration 3's Figma: the drainage area's boundary and
  // the three levels of who looks after what.
  'catchment',
  'help',
  'beforeRain',
  'channel',
  'lowPoint',
  'unavailable',
];

describe('where each control lives', () => {
  it('gives every layer a control, except the one that is not a choice', () => {
    // *Limited ground data* stopped being a switch on 4 October: the hatch
    // marks where this product has nothing to say, and a reader who turned it
    // off was left with a map that looked complete where it is not. It is
    // always drawn and it is in the legend, so it is governed by neither row.
    const governed = [...CHIP_KEYS, ...PANEL_KEYS];
    expect([...governed].sort()).toEqual(
      [...ALL_LAYERS].filter((key) => key !== 'unavailable').sort(),
    );
    expect(governed).not.toContain('unavailable');
  });

  it('puts the recorded network on the chips and the background behind Layers', () => {
    // The departure from AC 1.1.4 and 1.1.5, asserted rather than left to a
    // comment: pits and pipes are chips, terrain is not. See the note at the
    // top of `modes.ts` and the deviation recorded in the acceptance file.
    expect(CHIP_KEYS).toEqual([
      'pit',
      'pipe',
      'channel',
      'lowPoint',
      'catchment',
      'help',
      'beforeRain',
    ]);
    expect(PANEL_KEYS).toEqual(['terrain']);
  });

  it('keeps pits and pipes separate, which is what both criteria protect', () => {
    expect(CHIP_KEYS).toContain('pit');
    expect(CHIP_KEYS).toContain('pipe');
  });
});

describe('the presets', () => {
  it('has one preset with every layer on', () => {
    // Still what the legend and the comparison map mean by "everything". It
    // stopped being what the unguided map opens with on 10 September.
    expect(Object.values(ALL_ON).every(Boolean)).toBe(true);
  });

  it('opens the unguided map with nothing on but the gaps', () => {
    // The gaps are not a layer somebody turned on; they are the map saying
    // where it was never measured, and they are drawn in every preset.
    const { unavailable, ...chosen } = NOTHING_ON;
    expect(unavailable).toBe(true);
    expect(Object.values(chosen).some(Boolean)).toBe(false);
  });

  it('covers every layer, so a new one cannot arrive switched on', () => {
    // Written as a sweep rather than six booleans: the failure this catches is
    // a layer added to `LayerState` and given a value everywhere except here,
    // which would open the map with one thing on and no reason why.
    for (const key of ALL_LAYERS) {
      expect(NOTHING_ON[key]).toBe(key === 'unavailable');
    }
    expect(Object.keys(NOTHING_ON).sort()).toEqual([...ALL_LAYERS].sort());
  });

  it('still leaves the ground on under every homepage card', () => {
    // The ground went off for the unguided entry on 11 September and stayed on
    // for the cards, which is not an inconsistency: a card names a thing to
    // look at, and AC 1.1.2 asks that pressing it show that thing.
    expect(NOTHING_ON.terrain).toBe(false);
    for (const way of ['drainage', 'water-flow', 'terrain', 'low-areas'] as const) {
      expect(openingLayers(way).terrain).toBe(true);
    }
  });

  it('leaves low areas out of the guided task, and nothing else', () => {
    expect(GUIDED_ON.lowPoint).toBe(false);
    // The hatching is in it, as it is in everything, since 4 October.
    expect(GUIDED_ON.unavailable).toBe(true);
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
      // Drawn under every card, like the ground: it is the map saying where
      // it was never measured (4 October).
      unavailable: true,
      // Off even under the drainage-area card: its guide's first step is to
      // press the chip, and a boundary already drawn makes that a no-op.
      catchment: false,
      help: false,
      beforeRain: false,
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
      unavailable: true,
      catchment: false,
      help: false,
      beforeRain: false,
    });
  });

  it('opens the hatching from every card, because it is not a choice', () => {
    // It was the reader's switch until 4 October, on the reasoning that a
    // statement about the evidence belongs to them. The team's answer was
    // that a reader who turns it off is left with a map that looks complete
    // where it is not, so it is drawn everywhere and explained in the legend.
    for (const way of WAYS_IN) {
      expect(openingLayers(way).unavailable).toBe(true);
    }
  });
});

describe('the legend against the marks on the map', () => {
  // A layer that draws on the canvas and is missing from the legend is a map
  // that disagrees with its own key, and nothing on screen says so: the marks
  // simply appear unexplained. The before-rain markers shipped that way for a
  // day, which is why this is a test and not a glance.
  it('gives every layer that draws marks a line in the legend', () => {
    const listed = new Set(LEGEND_GROUPS.flatMap((group) => group.keys));
    for (const key of ['pit', 'pipe', 'channel', 'lowPoint', 'terrain', 'unavailable', 'beforeRain'] as const) {
      expect(listed.has(key)).toBe(true);
    }
  });

  it('leaves out the layers that draw no mark of their own', () => {
    // `help` is a card about who to contact. `catchment` draws a boundary but
    // is Melbourne Water's record rather than the council's, and neither of
    // the legend's two groups says that; its own card carries the source.
    const listed = new Set(LEGEND_GROUPS.flatMap((group) => group.keys));
    expect(listed.has('help')).toBe(false);
  });

  it('calls the before-rain markers an estimate, never a record', () => {
    // AC 5.1.1: they are the lowest street cell of a modelled hollow.
    const derived = LEGEND_GROUPS.find((group) => group.link === 'derived');
    expect(derived?.keys).toContain('beforeRain');
    const recorded = LEGEND_GROUPS.find((group) => group.link === 'recorded');
    expect(recorded?.keys).not.toContain('beforeRain');
  });
});
