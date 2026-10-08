/**
 * The recorded street drains near an address, named and grouped (Figma S1–S4).
 *
 * **Every recorded drain within the ring, not a selection.** The panel says so
 * in its first sentence, and it is the one claim this file has to keep: there
 * is no ranking, no shortlist and no judgement about which drain matters. The
 * grouping is for reading, not for ordering by importance — a reader looking
 * for the drain outside their own house should find it first, and everything
 * else is behind a street name they can open.
 *
 * **A drain is named by the address it is nearest to, within 30 m.** The
 * council's pits carry an asset number and no street, so *Drain near 30
 * Gatehouse Drive* is this product joining two records, not something either
 * one says. Thirty metres is about the depth of a suburban block: past it the
 * nearest house is across a back fence or on the next street, and the name
 * would be wrong in the way a reader cannot check. A drain that matches
 * nothing keeps its asset number and goes in *Other drains near you*, which is
 * the honest answer rather than a guess at a street.
 */

import type { AddressIndex, IndexedAddress } from '../address/search.js';
import type { MapArtefact } from '../map/artefact.js';
import type { Local } from '../map/viewport.js';

/** The ring, the same one the before-rain places use. */
export const DRAIN_RADIUS_M = 200;

/** How near a drain has to be to an address before it takes its street. */
export const STREET_MATCH_M = 30;

/**
 * How many street groups are named before the rest are rolled up.
 *
 * The first is open and the other three are closed, which is four street names
 * on screen — enough to recognise your own neighbourhood, short enough that
 * the roll-up is still the obvious way to the rest.
 */
export const NAMED_GROUPS = 4;

export interface NamedDrain {
  /** The council's asset number, as a string. */
  readonly id: string;
  readonly at: Local;
  /** From the address, in metres, for nothing but a stable order. */
  readonly distanceM: number;
  /** The street it was matched to, or null where nothing was within 30 m. */
  readonly street: string | null;
  /** The house number it was matched to, for ordering within a street. */
  readonly number: number | null;
  /** *Drain near 30 Gatehouse Drive*, or the asset number where it has no street. */
  readonly label: string;
}

export interface DrainGroup {
  /** The street, or null for the drains that matched no address. */
  readonly street: string | null;
  /** Whether this is the reader's own street. */
  readonly yours: boolean;
  readonly drains: readonly NamedDrain[];
}

export interface StreetDrains {
  readonly total: number;
  /**
   * The reader's street first where they have one, then the rest largest
   * first, with the unnamed drains last.
   */
  readonly groups: readonly DrainGroup[];
}

const distance = (a: Local, b: Local): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The nearest address within `STREET_MATCH_M`, or null. */
function nearestAddress(at: Local, candidates: readonly IndexedAddress[]): IndexedAddress | null {
  let best: IndexedAddress | null = null;
  let bestM = STREET_MATCH_M;
  for (const candidate of candidates) {
    const away = distance(at, [candidate.e, candidate.n]);
    if (away <= bestM) {
      best = candidate;
      bestM = away;
    }
  }
  return best;
}

/** *Drain near 30 Gatehouse Drive*, as the design writes a row. */
export const drainLabel = (number: string, street: string): string => `Drain near ${number} ${street}`;

/** What a drain with no street beside it is called: its own record. */
export const unnamedDrainLabel = (id: string): string => `Recorded drain ${id}`;

/**
 * Every recorded drain within the ring, named and grouped.
 *
 * The addresses are filtered to the ring plus the match distance first, so the
 * cross product is a few hundred by a few hundred rather than every pit
 * against every address in the council.
 */
export function streetDrains(
  map: MapArtefact,
  index: AddressIndex,
  at: Local,
  yourStreet: string | null,
): StreetDrains {
  const near = (index.addresses ?? []).filter(
    (candidate) => distance(at, [candidate.e, candidate.n]) <= DRAIN_RADIUS_M + STREET_MATCH_M,
  );

  const drains: NamedDrain[] = [];
  for (const pit of map.layers.pit ?? []) {
    const away = distance(at, pit.c);
    if (away > DRAIN_RADIUS_M) continue;
    const id = String(pit.asset_number ?? '');
    if (id === '') continue;
    const match = nearestAddress(pit.c, near);
    const number = match === null ? Number.NaN : Number.parseInt(match.number, 10);
    drains.push({
      id,
      at: pit.c,
      distanceM: away,
      street: match?.street ?? null,
      number: match === null || Number.isNaN(number) ? null : number,
      label: match === null ? unnamedDrainLabel(id) : drainLabel(match.number, match.street),
    });
  }

  const byStreet = new Map<string, NamedDrain[]>();
  const unnamed: NamedDrain[] = [];
  for (const drain of drains) {
    if (drain.street === null) unnamed.push(drain);
    else {
      const held = byStreet.get(drain.street);
      if (held === undefined) byStreet.set(drain.street, [drain]);
      else held.push(drain);
    }
  }

  // House number first, because a street read in order is a street somebody
  // can walk; distance second, for the drains that share a number or have none.
  const ordered = (group: readonly NamedDrain[]): readonly NamedDrain[] =>
    [...group].sort(
      (a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER) || a.distanceM - b.distanceM,
    );

  const streets = [...byStreet.entries()]
    .map(([street, group]): DrainGroup => ({ street, yours: street === yourStreet, drains: ordered(group) }))
    .sort((a, b) => {
      if (a.yours !== b.yours) return a.yours ? -1 : 1;
      return b.drains.length - a.drains.length || (a.street ?? '').localeCompare(b.street ?? '');
    });

  const groups: DrainGroup[] = [...streets];
  if (unnamed.length > 0) {
    groups.push({
      street: null,
      yours: false,
      drains: [...unnamed].sort((a, b) => a.distanceM - b.distanceM),
    });
  }

  return { total: drains.length, groups };
}

/** Whether any of the drains found is on the reader's own street. */
export const hasOwnStreet = (found: StreetDrains): boolean => found.groups.some((group) => group.yours);
