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
 * is background — drawn under everything, and not something reached for while
 * reading a particular street. A control's place should follow how often it is
 * used.
 *
 * That argument said "on by default" until 11 September, when the unguided map
 * stopped turning it on. The half that mattered survives: it is still the
 * layer people change least, which is what put it behind the button. The half
 * that did not survive is written out rather than quietly dropped, because an
 * argument for a recorded deviation should be readable as it actually stands.
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
 * Neither is a lesser layer. The ground surface is background: drawn beneath
 * everything else, and rarely the thing somebody is changing. It was on by
 * default until 11 September and is now on under every homepage card and off
 * on the unguided way in -- see `NOTHING_ON`.
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

/**
 * Nothing on at all: the unguided way in, from 10 September.
 *
 * **This reverses `ALL_ON` for that one entry, at the design owner's request,
 * and `ALL_ON` is kept because the legend and the comparison map still mean
 * "everything".** The argument for the reversal is that opening four layers at
 * once over a square kilometre is the densest thing this product ever puts on
 * screen, and it is what a first-time visitor meets: the chips read as
 * decoration when they are all already on, and turning one *off* to see what
 * it was is a harder first move than turning one on.
 *
 * **The ground surface went off too, on 11 September, and the argument for
 * keeping it on is kept here rather than deleted.** It ran: the ground is what
 * the map is drawn on rather than a layer over it, and without it the map
 * opens onto a flat colour that quietly implies level ground, in a product
 * whose whole argument is that it is not.
 *
 * What changed is the weighing, not the reasoning. Elevation shading over a
 * square kilometre is not a quiet background — it is colour edge to edge, and
 * it was the loudest thing left once the four chips went off. And the
 * implication it was there to prevent is only made by a map that *says*
 * nothing about the ground; this one says it in a control called **Ground
 * surface**, one press away, sitting in the Layers panel where somebody who
 * wants to know about the ground will look.
 *
 * The starting state is now the same claim as an empty page: it asserts
 * nothing at all, and every layer is something the person turned on.
 *
 * It does **not** touch `openingLayers`. AC 1.1.2 requires a homepage card to
 * open the map showing the thing it named, and a card that opened a map with
 * nothing on it would be a click that visibly did nothing — so the ground is
 * still on underneath every one of those.
 */
export const NOTHING_ON: LayerState = {
  pit: false,
  pipe: false,
  terrain: false,
  channel: false,
  lowPoint: false,
  unavailable: false,
};

/** Everything on. Still what the legend and the comparison map mean. */
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
