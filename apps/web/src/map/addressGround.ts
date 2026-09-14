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

import { type Compass, type WaterNearby, describe as describeWater } from './nearby.js';

export type GroundTrend =
  | { readonly kind: 'falls'; readonly bearing: Compass; readonly fallM: number }
  | { readonly kind: 'unclear' }
  | { readonly kind: 'edge' };

export interface AddressGroundArtefact {
  readonly artefact: 'address-ground';
  readonly settings: { readonly areaAcrossM: number };
  readonly addresses: Readonly<
    Record<string, { readonly ground: string; readonly bearing?: string; readonly fallM?: number }>
  >;
}

export class AddressGroundError extends Error {}

const COMPASS_POINTS: readonly string[] = [
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
  'south',
  'south-east',
];

export function assertAddressGround(value: unknown): asserts value is AddressGroundArtefact {
  const a = value as Partial<AddressGroundArtefact> | null;
  if (a === null || typeof a !== 'object' || a.artefact !== 'address-ground') {
    throw new AddressGroundError('the address ground artefact is not one');
  }
  if (!a.addresses || typeof a.addresses !== 'object') {
    throw new AddressGroundError('the address ground artefact carries no addresses');
  }
  if (!((a.settings?.areaAcrossM ?? 0) > 0)) {
    throw new AddressGroundError('the address ground artefact does not say how wide its area is');
  }
}

/** The trend for one address, or null when the artefact has nothing for it. */
export function groundAt(artefact: AddressGroundArtefact, id: string): GroundTrend | null {
  const record = artefact.addresses[id];
  if (!record) return null;
  if (record.ground === 'falls') {
    if (!COMPASS_POINTS.includes(record.bearing ?? '') || !Number.isFinite(record.fallM)) return { kind: 'unclear' };
    return { kind: 'falls', bearing: record.bearing as Compass, fallM: record.fallM! };
  }
  if (record.ground === 'edge') return { kind: 'edge' };
  return { kind: 'unclear' };
}

export async function loadAddressGround(
  url = '/data/terrain/address-ground.json',
  fetchJson: (url: string) => Promise<unknown> = (u) => fetch(u).then((r) => r.json()),
): Promise<AddressGroundArtefact> {
  const value = await fetchJson(url);
  assertAddressGround(value);
  return value;
}

/** The ground sentences, from the structure the figure is drawn from. */
export function describeGround(trend: GroundTrend): string {
  if (trend.kind === 'falls') {
    return (
      `Nearby ground generally falls ${trend.bearing}. ` +
      `The fitted ground level changes by about ${trend.fallM.toFixed(1)} m across the surrounding 150 m-wide area.`
    );
  }
  if (trend.kind === 'edge') {
    return 'No overall ground direction is given here: this address is too close to the edge of the measured ground to fit the 150 m-wide area around it.';
  }
  return 'No reliable overall ground direction could be identified around this address.';
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
