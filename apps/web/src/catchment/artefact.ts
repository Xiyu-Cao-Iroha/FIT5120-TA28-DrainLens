/**
 * The drainage area an address is in, as the browser reads it.
 *
 * Two published files answer Epic 6's first question. `subcatchments.json`
 * carries the areas — their boundaries, names, record dates and what the
 * council has recorded inside them. `address-catchments.json` carries which
 * area each address is in, worked out in the pipeline against Melbourne
 * Water's own geometry.
 *
 * **The browser does not decide which area an address is in.** It could: it
 * has the boundaries and the address. It would also be wrong for 287 of the
 * 62,397 addresses, because the boundaries it has are simplified to five
 * metres for drawing and the addresses it would misplace are the ones nearest
 * a boundary — the ones a reader is most likely to check. The pipeline
 * measured that (`docs/DATASETS.md`, entry 11) and answers the question there
 * instead; this module reads the answer.
 *
 * **The lookup is street and position, and the position is the published
 * one.** `IndexedAddress.at` carries it for exactly this, because the
 * Kensington fallback drops addresses outside its smaller map and counting
 * positions in what survives would shift every address after the first gap.
 */

import type { IndexedAddress } from '../address/search.js';

/** The four answers AC 6.1.2 allows, as the pipeline's register publishes them. */
export type ReceivingClass = 'main-drain' | 'waterway-section' | 'council-direct' | 'unclassified';

const CLASSES: readonly ReceivingClass[] = [
  'main-drain',
  'waterway-section',
  'council-direct',
  'unclassified',
];

/** What the council has recorded inside an area, and how much of it we hold. */
export interface AreaSummary {
  readonly pits: number;
  readonly pipeLengthM: number;
  readonly lowAreas: number;
  /**
   * The share of the area's own recorded size inside the build extent, 0 to 1.
   *
   * Absent where the record carries no area to compare against. **It is what
   * makes the counts above honest**: a subcatchment does not stop at the
   * council boundary, so `pits` is the pits in the part of it this project has
   * data for, and this says how much of it that is (AC 6.1.3).
   */
  readonly coverage?: number;
}

export interface Subcatchment {
  /** Melbourne Water's own number, which the assignment file keys by. */
  readonly number: string;
  /** The name as published, kept so the artefact can be checked against the source. */
  readonly name: string;
  /** The name a reader sees: numeric prefix off, abbreviations written out (AC 6.1.1). */
  readonly displayName: string;
  /**
   * What receives this area's water, or `unclassified`.
   *
   * `unclassified` until a team member has approved the row in
   * `docs/SUBCATCHMENT-CLASSIFICATION.md`, whatever the area's name suggests.
   * The Epic 6 definition of done: no subcatchment is described as a Melbourne
   * Water drain without an approved classification.
   */
  readonly class: ReceivingClass;
  readonly majorName?: string;
  readonly primaryName?: string;
  readonly basinName?: string;
  readonly areaSqKm?: number;
  /** When the boundary was first recorded, `YYYY-MM-DD`. */
  readonly captured?: string;
  /** When the record was last updated, `YYYY-MM-DD`. The card states its year. */
  readonly lastUpdated?: string;
  /** The complete boundary, metres from the artefact extent's south-west corner. */
  readonly rings: readonly (readonly (readonly [number, number])[])[];
  readonly summary?: AreaSummary;
}

export interface SubcatchmentsArtefact {
  readonly artefact: 'subcatchments';
  readonly version: 1;
  readonly note: string;
  readonly extent: { readonly min_e: number; readonly min_n: number };
  readonly source: { readonly publisher: string; readonly licence: string; readonly dataset: string };
  /** The sentence AC 6.1.3 asks for about what the counts cover. */
  readonly coverage: string;
  readonly areas: readonly Subcatchment[];
}

/** One street's areas: a single index, or one per published address. */
export interface StreetAreas {
  readonly n: number;
  readonly a: number | readonly number[];
}

export interface AddressCatchmentsArtefact {
  readonly artefact: 'address-catchments';
  readonly version: 1;
  /** Area numbers, the values in `streets` index into this. */
  readonly numbers: readonly string[];
  readonly streets: Readonly<Record<string, StreetAreas>>;
}

export class CatchmentError extends Error {}

/** No recorded area contains this address — one of the council's 62,397. */
export const NO_AREA = -1;

export function assertSubcatchments(value: unknown): asserts value is SubcatchmentsArtefact {
  const a = value as Partial<SubcatchmentsArtefact> | null;
  if (a === null || typeof a !== 'object' || a.artefact !== 'subcatchments') {
    throw new CatchmentError('the drainage-area file is not one');
  }
  if (typeof a.coverage !== 'string' || a.coverage === '') {
    throw new CatchmentError('the drainage-area file does not say what its counts cover');
  }
  if (!Array.isArray(a.areas) || a.areas.length === 0) {
    throw new CatchmentError('the drainage-area file carries no areas');
  }
  for (const area of a.areas) {
    if (typeof area.number !== 'string' || typeof area.displayName !== 'string' || area.displayName === '') {
      throw new CatchmentError('an area has no number or no name to show');
    }
    if (!CLASSES.includes(area.class)) {
      throw new CatchmentError(`area ${area.number} is ${String(area.class)}, which is not a receiving class`);
    }
    if (!Array.isArray(area.rings) || area.rings.length === 0) {
      throw new CatchmentError(`area ${area.number} has no boundary`);
    }
  }
}

export function assertAddressCatchments(value: unknown): asserts value is AddressCatchmentsArtefact {
  const a = value as Partial<AddressCatchmentsArtefact> | null;
  if (a === null || typeof a !== 'object' || a.artefact !== 'address-catchments') {
    throw new CatchmentError('the address-to-area file is not one');
  }
  if (!Array.isArray(a.numbers) || a.numbers.length === 0) {
    throw new CatchmentError('the address-to-area file names no areas');
  }
  if (a.streets === null || typeof a.streets !== 'object') {
    throw new CatchmentError('the address-to-area file carries no streets');
  }
}

/** The key both files use for a street: the index's own `"Street|Suburb"`. */
export const streetKey = (address: IndexedAddress): string => `${address.street}|${address.suburb}`;

/**
 * The area number for this address, or null where none contains it.
 *
 * Null is a real answer and the screen says so (AC 6.1.5): the nearest area is
 * never substituted. It is also what an address outside the published index
 * gets — a street the assignment has never heard of is not a street whose
 * drainage area can be guessed from its neighbours.
 */
export function areaNumberFor(
  assignment: AddressCatchmentsArtefact | null,
  address: IndexedAddress | null,
): string | null {
  if (assignment === null || address === null) return null;
  const street = assignment.streets[streetKey(address)];
  if (street === undefined) return null;
  const at = Array.isArray(street.a) ? street.a[address.at] : street.a;
  if (at === undefined || at === NO_AREA) return null;
  return assignment.numbers[at] ?? null;
}

/** The area itself, ready for the card, or null. */
export function areaFor(
  areas: SubcatchmentsArtefact | null,
  assignment: AddressCatchmentsArtefact | null,
  address: IndexedAddress | null,
): Subcatchment | null {
  const number = areaNumberFor(assignment, address);
  if (number === null || areas === null) return null;
  return areas.areas.find((area) => area.number === number) ?? null;
}

/**
 * Fetch and check both files. A failure is no drainage area, not a broken map.
 *
 * The same shape as `loadDifferences`: the rest of the product works without
 * this, and a screen that cannot name a drainage area says so.
 */
export async function loadCatchments(
  areasUrl: string,
  assignmentUrl: string,
  get: (url: string) => Promise<unknown> = async (u) => (await fetch(u)).json() as Promise<unknown>,
): Promise<{ areas: SubcatchmentsArtefact; assignment: AddressCatchmentsArtefact } | null> {
  try {
    const [rawAreas, rawAssignment] = await Promise.all([get(areasUrl), get(assignmentUrl)]);
    assertSubcatchments(rawAreas);
    assertAddressCatchments(rawAssignment);
    return { areas: rawAreas, assignment: rawAssignment };
  } catch {
    return null;
  }
}
