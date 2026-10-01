/**
 * Which way the ground falls around an address — Address Insight, terrain handover §3.
 *
 * Precomputed for every address in the index by `address_ground.py`, so a
 * search does not refit a million-cell surface in the browser. Three answers:
 *
 * - `falls`: a compass point and a fall over the 150 m-wide area around it;
 * - `unclear`: the ground is too flat, not planar enough, or the direction
 *   changes with the size of the circle;
 * - `edge`: the address is too close to the edge of the measured ground for
 *   the fit to be made at all.
 *
 * **The wording keeps three facts apart.** The ground's fall, the nearest
 * water path and the nearest low area are measured independently, and nothing
 * shows that one leads to another. So nothing here says water runs *towards*
 * anything, and the ground sentence never says *over the next 150 m*: it is the
 * trend of an area about that wide, not what a walk in that direction would
 * descend.
 */

import { idOf, labelOf } from '../address/search.js';
import { type Compass, type WaterNearby, describe as describeWater } from './nearby.js';

export type GroundTrend =
  | { readonly kind: 'falls'; readonly bearing: Compass; readonly fallM: number }
  | { readonly kind: 'unclear' }
  | { readonly kind: 'edge' };

/**
 * Version 2: the address index's own street list, and `number=code` per address.
 *
 * Keyed by id, the council's 62,397 addresses were about seven megabytes of
 * repeated strings. The code is `x` for too near the edge of the measured
 * ground, `u` for unclear, or a compass abbreviation and the fall in
 * half-metres — `SW3` is south-west, 1.5 m. See `pipeline/address_ground.py`.
 */
export interface AddressGroundArtefact {
  readonly artefact: 'address-ground';
  readonly version: 2;
  readonly area: string;
  readonly settings: { readonly areaAcrossM: number; readonly fallRoundingM?: number };
  readonly on: readonly string[];
  readonly at: readonly (readonly string[])[];
}

export class AddressGroundError extends Error {}

const ABBREVIATIONS: Readonly<Record<string, Compass>> = {
  E: 'east',
  NE: 'north-east',
  N: 'north',
  NW: 'north-west',
  W: 'west',
  SW: 'south-west',
  S: 'south',
  SE: 'south-east',
};

export function assertAddressGround(value: unknown): asserts value is AddressGroundArtefact {
  const a = value as Partial<AddressGroundArtefact> | null;
  if (a === null || typeof a !== 'object' || a.artefact !== 'address-ground') {
    throw new AddressGroundError('the address ground artefact is not one');
  }
  if (a.version !== 2) {
    throw new AddressGroundError(`the address ground artefact is version ${String(a.version)}, and this reads version 2`);
  }
  if (!Array.isArray(a.on) || !Array.isArray(a.at) || a.on.length === 0) {
    throw new AddressGroundError('the address ground artefact carries no addresses');
  }
  if (a.on.length !== a.at.length) {
    throw new AddressGroundError(
      `the address ground artefact has ${String(a.on.length)} streets and ${String(a.at.length)} groups of answers`,
    );
  }
  if (typeof a.area !== 'string' || a.area === '') {
    throw new AddressGroundError('the address ground artefact does not say which area its ids belong to');
  }
  if (!((a.settings?.areaAcrossM ?? 0) > 0)) {
    throw new AddressGroundError('the address ground artefact does not say how wide its area is');
  }
}

/** Every answer by id, built once per artefact on the first lookup. */
const BY_ID = new WeakMap<AddressGroundArtefact, ReadonlyMap<string, string>>();

function codesOf(artefact: AddressGroundArtefact): ReadonlyMap<string, string> {
  let codes = BY_ID.get(artefact);
  if (codes === undefined) {
    const built = new Map<string, string>();
    artefact.on.forEach((key, group) => {
      const [street = '', suburb = ''] = key.split('|');
      for (const entry of artefact.at[group] ?? []) {
        const split = entry.lastIndexOf('=');
        if (split <= 0) continue;
        built.set(idOf(artefact.area, labelOf(entry.slice(0, split), street, suburb)), entry.slice(split + 1));
      }
    });
    codes = built;
    BY_ID.set(artefact, codes);
  }
  return codes;
}

/** The trend a code stands for, or null for a code this does not read. */
export function trendOf(code: string, rounding = 0.5): GroundTrend | null {
  if (code === 'x') return { kind: 'edge' };
  if (code === 'u') return { kind: 'unclear' };
  const match = /^([NSEW]{1,2})(\d+)$/.exec(code);
  const bearing = match === null ? undefined : ABBREVIATIONS[match[1] ?? ''];
  if (match === null || bearing === undefined) return { kind: 'unclear' };
  return { kind: 'falls', bearing, fallM: Number(match[2]) * rounding };
}

/** The trend for one address, or null when the artefact has nothing for it. */
export function groundAt(artefact: AddressGroundArtefact, id: string): GroundTrend | null {
  const code = codesOf(artefact).get(id);
  return code === undefined ? null : trendOf(code, artefact.settings.fallRoundingM ?? 0.5);
}

export async function loadAddressGround(
  url = '/data/terrain/address-ground.json',
  fetchJson: (url: string) => Promise<unknown> = (u) => fetch(u).then((r) => r.json()),
): Promise<AddressGroundArtefact> {
  const value = await fetchJson(url);
  assertAddressGround(value);
  return value;
}

/**
 * Where a slope is called steep: a fall of 7.5 m across the 150 m-wide area.
 *
 * The fit gives the fall across an area 150 m wide, so this is a gradient of
 * 1 in 20 (5%) — the gradient past which AS 1428.1 stops calling a path a
 * walkway and calls it a ramp, about where a person on foot notices the ground
 * rising. Team review item 16 asked the card to say where there is a steep
 * slope rather than print a fall for every address. Over the council, 12,495 of
 * the 38,498 addresses with a direction (32.5%) are at or past it; the median
 * is 5.5 m. Below it the card says only that the ground slopes gently, and
 * prints no number.
 */
export const STEEP_FALL_M = 7.5;

/** Whether a fall across the 150 m-wide area is a steep slope. */
export const isSteep = (fallM: number): boolean => fallM >= STEEP_FALL_M;

/** A fall as the card writes it: whole metres bare, half-metres to one decimal. */
export const metresOf = (fallM: number): string => (Number.isInteger(fallM) ? String(fallM) : fallM.toFixed(1));

/**
 * The ground sentences, from the structure the figure is drawn from.
 *
 * Plain words, and still the trend of an area rather than a walk: *slopes down
 * to the north-west*, never *over the next 150 m*, and never *towards* anything.
 */
export function describeGround(trend: GroundTrend): string {
  if (trend.kind === 'falls') {
    const change = `The ground level changes by about ${metresOf(trend.fallM)} m across the surrounding 150 m-wide area.`;
    return isSteep(trend.fallM)
      ? `The ground around this address slopes down to the ${trend.bearing}, and the slope is steep. ${change}`
      : `The ground around this address slopes gently down to the ${trend.bearing}. ${change}`;
  }
  // *Downhill*, as the card's own note says it (copy audit v2, #58).
  if (trend.kind === 'edge') {
    return 'No downhill direction is given here: this address is too close to the edge of the measured ground.';
  }
  return 'No clear downhill direction could be found around this address.';
}

/**
 * Everything the card says, in the order it says it.
 *
 * The figure's accessible name and the words are both this, so the drawing
 * and what a screen reader hears cannot say different things.
 */
export function describeAddress(ground: GroundTrend | null, water: WaterNearby | null): string | null {
  const parts = [ground === null ? null : describeGround(ground), water === null ? null : describeWater(water)];
  const said = parts.filter((part): part is string => part !== null);
  return said.length === 0 ? null : said.join(' ');
}
