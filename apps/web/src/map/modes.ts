/**
 * Which layers the map draws, and what each way in turns on.
 *
 * **This is one flat level of control, and that is a deliberate departure from
 * the criteria.** AC 1.1.4 names Drainage, Water Flow, Terrain and Low Areas
 * as the four things along the top, and AC 1.1.5 puts Drainage Pits and
 * Drainage Pipes behind the Layers button beneath a Drainage mode. That was
 * built on 3 September and then reversed the same day at the design owner's
 * request: the chips are the layers again — **Pits, Pipes, Water flow, Low
 * areas** — and Terrain sits behind Layers with the data-quality hatching.
 *
 * The deviation is recorded in `docs/ITERATION-1-ACCEPTANCE.md` rather than
 * papered over, because it is a real one and somebody will be asked about it.
 * The argument for it: pits and pipes are the recorded data this product is
 * built on and they are what a person switches most, while the ground surface
 * is background — on by default, drawn under everything, and not something
 * reached for while reading a particular street. A control's place should
 * follow how often it is used.
 *
 * Every layer still has its own switch, which is the substance both criteria
 * are protecting. What differs is which switch sits where.
 *
 * `MapMode` survives the change because it is not the chip row: it is the
 * vocabulary of *ways in* from the homepage, and AC 1.1.2 still asks that
 * choosing one open the map showing that thing.
 */

import type { DerivedVisibility } from './derived.js';

export type LayerKey = 'pit' | 'pipe' | 'terrain' | 'channel' | 'lowPoint' | 'unavailable';

export type LayerState = Record<LayerKey, boolean>;

/**
 * The chips along the top, in the order they are drawn.
 *
 * The recorded network first, because it is what the product is for, and the
 * two derived layers after it.
 */
export const CHIP_KEYS: readonly LayerKey[] = ['pit', 'pipe', 'channel', 'lowPoint'];

/**
 * The switches behind the Layers button.
 *
 * Neither is a lesser layer. The ground surface is background: on by default,
 * drawn beneath everything else, and rarely the thing somebody is changing.
 * "Not enough ground measured" answers a question about the *evidence* rather
 * than about the ground, and it stays switchable in every view because it is
 * the one mark that says the map is guessing.
 */
export const PANEL_KEYS: readonly LayerKey[] = ['terrain', 'unavailable'];

/** The ways in from the homepage. Not the chip row — see the note above. */
export type MapMode = 'drainage' | 'water-flow' | 'terrain' | 'low-areas';

export function visibilityOf(state: LayerState): DerivedVisibility {
  return { channel: state.channel, lowPoint: state.lowPoint, unavailable: state.unavailable };
}

/** Everything on: the unguided way in, where nothing has been narrowed yet. */
export const ALL_ON: LayerState = {
  pit: true,
  pipe: true,
  terrain: true,
  channel: true,
  lowPoint: true,
  unavailable: true,
};

/** The guided task: what its question needs, without the rest in the way. */
export const GUIDED_ON: LayerState = {
  pit: true,
  pipe: true,
  terrain: true,
  channel: true,
  lowPoint: false,
  unavailable: false,
};

/**
 * Which layers each homepage card turns on — AC 1.1.2.
 *
 * Only what was asked for, because opening everything would make the choice
 * invisible and a click that changes nothing on screen is a click somebody
 * repeats to believe.
 *
 * Terrain is the exception and stays on underneath whatever was chosen. It is
 * background: without it the map opens onto a flat colour that quietly implies
 * level ground, in a product whose whole argument is that it is not.
 */
export function openingLayers(requested: MapMode): LayerState {
  return {
    pit: requested === 'drainage',
    pipe: requested === 'drainage',
    channel: requested === 'water-flow',
    lowPoint: requested === 'low-areas',
    terrain: true,
    unavailable: false,
  };
}
