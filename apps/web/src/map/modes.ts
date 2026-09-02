/**
 * The information modes, the layers each one governs, and what is left visible.
 *
 * Revised AC 1.1.4 and 1.1.5 describe two levels of control, not one. Along
 * the top are four **modes** — Drainage, Water Flow, Terrain, Low Areas — and
 * behind the Layers button are the **drainage layers**, pits and pipes, each
 * shown or hidden on its own. A mode is a master switch over the layers it
 * owns; the sub-switches refine what is on inside it.
 *
 * The map itself does not know about modes. It takes a `LayerState` and draws
 * it, exactly as before. `effectiveLayers` is the one place the two levels are
 * combined, which is why it is a plain function with a truth table for a test
 * rather than a tangle of conditions spread through a component.
 *
 * **The modes can all be on at once.** AC 1.1.4 says "clearly identify the
 * selected mode as active" in the singular but ends by asking that the modes
 * be available "for users to toggle", and every one of its bullets is of the
 * form *when X is selected, display X* — all of which hold when several are
 * on. Mutual exclusion would be the reading that loses information for no
 * reason: where water runs is a question about the ground it runs over, and
 * a person comparing the two should not have to choose.
 *
 * **`unavailable` is governed by no mode.** "Not enough ground measured" is
 * not a view of the world, it is a statement about the evidence, and it is
 * true in every mode — the surface paths and the low areas are derived from
 * the same terrain the hatching disclaims. Gating it behind the Terrain mode
 * would let somebody turn off the one mark that says the map is guessing.
 */

import type { DerivedVisibility } from './derived.js';

export type LayerKey = 'pit' | 'pipe' | 'terrain' | 'channel' | 'lowPoint' | 'unavailable';

export type LayerState = Record<LayerKey, boolean>;

/** The four names along the top of the map, in AC 1.1.4's order. */
export type MapMode = 'drainage' | 'water-flow' | 'terrain' | 'low-areas';

export type ModeState = Record<MapMode, boolean>;

/** The layers with a switch of their own behind the Layers button. */
export type SubLayerKey = 'pit' | 'pipe' | 'unavailable';

export type SubLayerState = Record<SubLayerKey, boolean>;

export interface ModeSpec {
  readonly key: MapMode;
  /** The short name on the chip. */
  readonly chip: string;
  /** What the mode shows, said in a sentence rather than a layer list. */
  readonly summary: string;
  /** The layers this mode is the master switch for. */
  readonly layers: readonly LayerKey[];
  /** The layer whose mark stands for the mode on its chip. */
  readonly swatchOf: LayerKey;
}

export const MODES: readonly ModeSpec[] = [
  {
    key: 'drainage',
    chip: 'Drainage',
    summary: 'Recorded drainage pits and pipes',
    layers: ['pit', 'pipe'],
    swatchOf: 'pit',
  },
  {
    key: 'water-flow',
    chip: 'Water flow',
    summary: 'Indicative surface-water paths',
    layers: ['channel'],
    swatchOf: 'channel',
  },
  {
    key: 'terrain',
    chip: 'Terrain',
    summary: 'The ground surface, shaded by elevation',
    layers: ['terrain'],
    swatchOf: 'terrain',
  },
  {
    key: 'low-areas',
    chip: 'Low areas',
    summary: 'Low points and depressions',
    layers: ['lowPoint'],
    swatchOf: 'lowPoint',
  },
];

/**
 * Layers no mode owns.
 *
 * One entry, and the reason is in this module's opening note. Kept as a list
 * so that `modes.test.ts` can prove every layer is accounted for exactly once
 * — a layer belonging to two modes, or to none by accident, is a control that
 * silently does nothing.
 */
export const INDEPENDENT_KEYS: readonly LayerKey[] = ['unavailable'];

/** The sub-layers the Layers panel offers, in the order it lists them. */
export const SUBLAYER_KEYS: readonly SubLayerKey[] = ['pit', 'pipe', 'unavailable'];

/** Which mode owns a sub-layer, or `null` where none does. */
export function ownerOf(key: SubLayerKey): MapMode | null {
  return MODES.find((mode) => mode.layers.includes(key))?.key ?? null;
}

/**
 * What the map should actually draw.
 *
 * A layer is visible when its mode is on *and* its own switch is on. Layers
 * with no switch of their own follow their mode; layers with no mode follow
 * their switch.
 */
export function effectiveLayers(modes: ModeState, sub: SubLayerState): LayerState {
  return {
    pit: modes.drainage && sub.pit,
    pipe: modes.drainage && sub.pipe,
    channel: modes['water-flow'],
    terrain: modes.terrain,
    lowPoint: modes['low-areas'],
    unavailable: sub.unavailable,
  };
}

export function visibilityOf(state: LayerState): DerivedVisibility {
  return { channel: state.channel, lowPoint: state.lowPoint, unavailable: state.unavailable };
}

/** Everything on: the unguided way in, where nothing has been narrowed yet. */
export const ALL_MODES: ModeState = {
  drainage: true,
  'water-flow': true,
  terrain: true,
  'low-areas': true,
};

/** The follow task: what its question needs, without the rest in the way. */
export const GUIDED_MODES: ModeState = {
  drainage: true,
  'water-flow': true,
  terrain: true,
  'low-areas': false,
};

/**
 * The modes to open with when somebody chose one on the homepage.
 *
 * AC 1.1.2 asks that the map "activate the mode associated with the option
 * selected by the user". Only that one is turned on: opening everything would
 * make the choice invisible, and a click that changes nothing on screen is a
 * click somebody has to repeat to believe.
 *
 * Terrain is the exception and stays on underneath. It is background — it is
 * what the recorded network and the derived paths are drawn over — and without
 * it the map opens onto a flat colour that quietly implies level ground.
 */
export function openingModes(requested: MapMode): ModeState {
  return {
    drainage: requested === 'drainage',
    'water-flow': requested === 'water-flow',
    terrain: true,
    'low-areas': requested === 'low-areas',
  };
}

/** Both drainage layers on, and the data-quality hatching left to the task. */
export function subLayersWith(unavailable: boolean): SubLayerState {
  return { pit: true, pipe: true, unavailable };
}
