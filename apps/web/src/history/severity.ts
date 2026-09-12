/**
 * The flood map's data: three artefacts joined, and the score defined.
 *
 * The board reads `flood-history.json` and shows thirty areas ranked. The map
 * shows all 281, in two modes — how much activity was recorded, and how much
 * relative to the people living there — so it needs three files and a join.
 *
 * **Nothing here recomputes a published number.** The counts, the completeness
 * flags, the population and the positions all arrive as facts; the one thing
 * calculated is the rate, and its definition is in `docs/SEVERITY-SCORE.md`,
 * written before any of this existed.
 *
 * The join is on `SA2_MAINCODE_2011`, and that is not incidental. The board
 * joins on names, which is safe only inside one Victorian file; the population
 * comes from a national dataset where two states can hold a Richmond.
 * `tools/data/check-areas.mjs` asserts the four artefacts agree, in CI, because
 * they are published separately and a run that rebuilt one of them is not a
 * code change anything else would notice.
 */

export class AreaDataError extends Error {}

function fail(what: string): never {
  throw new AreaDataError(`the area data ${what}`);
}

/** One area as `sa2-areas.json` publishes it. */
export interface ScopeArea {
  readonly code: string;
  readonly name: string;
  readonly total: number;
  readonly byYear: readonly number[];
  readonly regions: number;
  readonly suppressedRegions: number;
  readonly complete: boolean;
}

export interface ScopeAreas {
  readonly artefact: 'sa2-areas';
  readonly note: string;
  readonly incidentType: string;
  readonly reportingPeriod: { readonly start: string; readonly end: string; readonly years: readonly string[] };
  readonly geography: { readonly unit: string; readonly standard: string; readonly scope: string };
  readonly areas: readonly ScopeArea[];
}

export interface PopulationArtefact {
  readonly artefact: 'population';
  readonly note: string;
  readonly asAt: readonly string[];
  readonly denominator: string;
  readonly minimumResidents: number;
  readonly source: { readonly dataset: string; readonly publisher: string };
  readonly areas: readonly { readonly code: string; readonly name: string; readonly persons: readonly number[] }[];
}

export interface PointsArtefact {
  readonly artefact: 'sa2-points';
  readonly extent: {
    readonly name: string;
    readonly min_e: number;
    readonly min_n: number;
    readonly width_m: number;
    readonly height_m: number;
  };
  readonly areas: readonly { readonly code: string; readonly name: string; readonly e: number; readonly n: number }[];
}

export function assertScopeAreas(value: unknown): asserts value is ScopeAreas {
  const a = value as Partial<ScopeAreas> | null;
  if (a === null || typeof a !== 'object') fail('is not an object');
  if (a.artefact !== 'sa2-areas') fail(`is ${String(a.artefact)}, not sa2-areas`);
  if (typeof a.note !== 'string' || a.note === '') fail('does not say what a count is');
  if (typeof a.incidentType !== 'string' || a.incidentType === '') {
    fail('does not say which incident type it counts');
  }
  const period = a.reportingPeriod;
  if (!period || !Array.isArray(period.years) || period.years.length === 0) {
    fail('does not carry a reporting period, which every count on the map is over');
  }
  const geography = a.geography;
  if (!geography || typeof geography.scope !== 'string' || geography.scope === '') {
    fail('does not say which part of the world it covers');
  }
  if (!Array.isArray(a.areas) || a.areas.length === 0) fail('carries no areas');
  for (const area of a.areas) {
    if (typeof area.code !== 'string' || !/^\d{9}$/.test(area.code)) {
      fail(`has an area whose code is ${String(area.code)}, which is not an ASGS code`);
    }
    if (typeof area.name !== 'string' || area.name === '') fail(`has an area with no name`);
    if (!Number.isFinite(area.total) || area.total < 0) {
      fail(`has no usable total for ${area.name}`);
    }
    if (!Array.isArray(area.byYear) || area.byYear.length !== period.years.length) {
      fail(`has ${String(area.byYear?.length)} yearly counts for ${area.name} over ${String(period.years.length)} years`);
    }
    if (typeof area.complete !== 'boolean' || !Number.isFinite(area.suppressedRegions)) {
      fail(`does not say whether ${area.name}'s total is complete`);
    }
    // A total is a floor exactly when a count inside it was withheld. The two
    // fields saying different things means one of them is being maintained by
    // hand, and the map draws the flag rather than the count it belongs to.
    if (area.complete !== (area.suppressedRegions === 0)) {
      fail(`says ${area.name} is ${area.complete ? 'complete' : 'incomplete'} with ${String(area.suppressedRegions)} withheld regions`);
    }
  }
}

export function assertPopulation(value: unknown): asserts value is PopulationArtefact {
  const a = value as Partial<PopulationArtefact> | null;
  if (a === null || typeof a !== 'object') fail('is not an object');
  if (a.artefact !== 'population') fail(`is ${String(a.artefact)}, not population`);
  if (typeof a.note !== 'string' || a.note === '') fail('does not say what its figures are');
  if (!Array.isArray(a.asAt) || a.asAt.length === 0) fail('does not say when it was counted');
  // AC 4.3.2.d: the page has to state the population basis, and "approximately
  // 5,200 residents" without a date is a number the reader cannot check.
  if (typeof a.denominator !== 'string' || !a.asAt.includes(a.denominator)) {
    fail('does not name which of its years is the denominator');
  }
  if (!Number.isFinite(a.minimumResidents) || (a.minimumResidents ?? 0) <= 0) {
    fail('does not say how few residents is too few to divide by');
  }
  if (!a.source || typeof a.source.publisher !== 'string') fail('does not name its publisher');
  if (!Array.isArray(a.areas) || a.areas.length === 0) fail('carries no population');
  for (const area of a.areas) {
    if (!Array.isArray(area.persons) || area.persons.length !== a.asAt.length) {
      fail(`has ${String(area.persons?.length)} figures for ${area.name} over ${String(a.asAt.length)} dates`);
    }
    for (const persons of area.persons) {
      if (!Number.isFinite(persons) || persons < 0) fail(`has ${String(persons)} residents for ${area.name}`);
    }
  }
}

export function assertPoints(value: unknown): asserts value is PointsArtefact {
  const a = value as Partial<PointsArtefact> | null;
  if (a === null || typeof a !== 'object') fail('is not an object');
  if (a.artefact !== 'sa2-points') fail(`is ${String(a.artefact)}, not sa2-points`);
  const extent = a.extent;
  if (
    !extent ||
    !Number.isFinite(extent.min_e) ||
    !Number.isFinite(extent.min_n) ||
    !(extent.width_m > 0) ||
    !(extent.height_m > 0)
  ) {
    fail('has no extent, so its metres are measured from nowhere');
  }
  if (!Array.isArray(a.areas) || a.areas.length === 0) fail('places no areas');
  for (const area of a.areas) {
    if (!Number.isFinite(area.e) || !Number.isFinite(area.n)) fail(`does not place ${area.name}`);
    // Outside the extent is the failure that drew every address pin 1.5 km
    // from the house: a coordinate frame belonging to something else.
    if (area.e < 0 || area.n < 0 || area.e > extent.width_m || area.n > extent.height_m) {
      fail(`places ${area.name} outside its own extent`);
    }
  }
}

/** How complete an area's answer is — AC 4.1.6, and it differs by mode. */
export type Completeness = 'exact' | 'minimum' | 'none' | 'unavailable';

/** One area, as the map draws it. */
export interface MapArea {
  readonly code: string;
  readonly name: string;
  readonly total: number;
  readonly byYear: readonly number[];
  readonly complete: boolean;
  readonly suppressedRegions: number;
  /**
   * How many SA1 regions roll up into this area.
   *
   * Carried because the panel says *n of its m regions were withheld*, and the
   * first version of that sentence did not have m — it printed
   * `suppressedRegions + 1`, which said "1 of its 2" about an area with 46.
   * An invented denominator on a page about withheld counts.
   */
  readonly regions: number;
  /** Residents at the denominator date, or null where the area has none. */
  readonly persons: number | null;
  /**
   * Dispatches per 1,000 residents over the reporting period, or null.
   *
   * Null means *no score*, not *zero*: seven areas are airports, a racecourse
   * and industrial land, and one dispatch among fifteen residents would score
   * four times the highest rate in Greater Melbourne.
   */
  readonly rate: number | null;
  /** Residents at each date the population artefact carries. */
  readonly personsByYear: readonly number[];
  readonly e: number;
  readonly n: number;
}

/**
 * The three artefacts as one list, joined on the ASGS code.
 *
 * It refuses rather than dropping. An area silently missing from the map is
 * indistinguishable from an area with nothing recorded in it, and those are
 * the two things this map exists to tell apart.
 */
export function joinAreas(
  scope: ScopeAreas,
  population: PopulationArtefact,
  points: PointsArtefact,
): readonly MapArea[] {
  const persons = new Map(population.areas.map((a) => [a.code, a.persons]));
  const placed = new Map(points.areas.map((a) => [a.code, a]));
  const at = population.asAt.indexOf(population.denominator);

  return scope.areas.map((area) => {
    const series = persons.get(area.code);
    const point = placed.get(area.code);
    if (series === undefined) fail(`has no population for ${area.name}`);
    if (point === undefined) fail(`does not place ${area.name}`);

    const denominator = series[at] ?? 0;
    const enough = denominator >= population.minimumResidents;
    return {
      code: area.code,
      name: area.name,
      total: area.total,
      byYear: area.byYear,
      complete: area.complete,
      suppressedRegions: area.suppressedRegions,
      regions: area.regions,
      persons: enough ? denominator : null,
      rate: enough ? (area.total / denominator) * 1000 : null,
      personsByYear: series,
      e: point.e,
      n: point.n,
    };
  });
}

/**
 * What an area's number is worth, in each mode.
 *
 * **The two modes do not produce the same set of states**, which is why this
 * takes one. Measured across all 281: the activity map shows 197 exact, 80
 * floors and 4 areas with a complete zero; the severity map shows 196, 78, no
 * zeros at all and 7 with no score. A legend shared between the modes would
 * offer each one a state it cannot produce.
 */
export function completenessOf(area: MapArea, mode: MapMode): Completeness {
  if (mode === 'severity' && area.rate === null) return 'unavailable';
  if (!area.complete) return 'minimum';
  return area.total === 0 ? 'none' : 'exact';
}

export type MapMode = 'activity' | 'severity';

/**
 * What the panel says about completeness, as a label and the sentence after it.
 *
 * Out of the component so it can be tested: the first version said "The
 * counts are exact" about every area without a score, and two of those seven
 * -- Port Melbourne Industrial and Braeside -- have a withheld region. A
 * missing denominator and a withheld numerator are separate facts, and one
 * does not tell you anything about the other.
 */
export function completenessText(
  area: Pick<MapArea, 'complete' | 'suppressedRegions' | 'regions'>,
  state: Completeness,
  incidentType: string,
): { readonly label: string; readonly body: string } {
  const withheld = `A count inside this area was withheld for privacy — ${String(area.suppressedRegions)} of its ${String(area.regions)} smaller regions`;
  switch (state) {
    case 'minimum':
      return { label: 'Minimum value.', body: `${withheld} — so the total is a lower bound rather than a number.` };
    case 'none':
      return {
        label: 'No recorded activity.',
        body: `The SES recorded no ${incidentType.toLowerCase()} dispatch here across the whole period. That is different from a small number.`,
      };
    case 'unavailable':
      return {
        label: 'Not available.',
        body: `${area.complete ? 'The counts are exact' : `${withheld}, so the total is a minimum`}; the score is not published because there is no usable population to divide by.`,
      };
    case 'exact':
      return { label: 'Exact.', body: 'No count inside this area was withheld.' };
  }
}

export interface Break {
  /** Inclusive lower bound. */
  readonly from: number;
  /** Inclusive upper bound, or null for "and above". */
  readonly to: number | null;
  readonly label: string;
}

/**
 * The activity bins, and why they are these.
 *
 * **The counts are severely skewed** — 209 at the top and a median of 27 — so
 * equal-width bins put one area dark and everything else pale. These are round
 * numbers a reader can hold, and every one of them contains areas: 27, 102, 91
 * and 55 of the 281. `check-areas.mjs` asserts that, because a bin that empties
 * when the data is rebuilt is a legend entry describing nothing.
 */
export const ACTIVITY_BREAKS: readonly Break[] = [
  { from: 1, to: 10, label: '1–10' },
  { from: 11, to: 25, label: '11–25' },
  { from: 26, to: 50, label: '26–50' },
  { from: 51, to: null, label: '51 and above' },
];

/**
 * The severity bands, at the measured quartiles rounded to something sayable.
 *
 * The rate is far less skewed than the count it comes from — 17.18 at the top
 * against a median of 1.92, a ratio of nine where the counts' is over a
 * hundred — so three bands hold it. 1.3 and 3.0 are the first and third
 * quartiles to one decimal place, and the ranges are on the legend because a
 * band name without its numbers is a judgement with the workings hidden.
 */
export const SEVERITY_BREAKS: readonly Break[] = [
  { from: 0, to: 1.3, label: 'Lower — under 1.3' },
  { from: 1.3, to: 3, label: 'Moderate — 1.3 to 3.0' },
  { from: 3, to: null, label: 'Higher — over 3.0' },
];

export const breaksFor = (mode: MapMode): readonly Break[] =>
  mode === 'activity' ? ACTIVITY_BREAKS : SEVERITY_BREAKS;

/**
 * Which band a value falls in, or null for a value there is no band for.
 *
 * Null is returned for an area with no score and for an activity count of
 * zero, and both are drawn as their own thing rather than as the palest band.
 * *No recorded activity* is not *a little activity*.
 */
export function bandOf(value: number | null, breaks: readonly Break[]): number | null {
  if (value === null) return null;
  for (const [index, band] of breaks.entries()) {
    if (value >= band.from && (band.to === null || value <= band.to)) return index;
  }
  return null;
}

/** The value a mode reads off an area. */
export const valueOf = (area: MapArea, mode: MapMode): number | null =>
  mode === 'activity' ? area.total : area.rate;

/**
 * The score as it is written on screen: two decimals, and a floor says so.
 *
 * A total that is a lower bound divided by a known denominator is still a
 * lower bound, and 28.5% of the areas carry one. Dropping the mark would make
 * the map's most common qualification invisible.
 */
export function scoreLabel(area: MapArea): string {
  if (area.rate === null) return 'No score';
  return `${area.rate.toFixed(2)}${area.complete ? '' : '+'}`;
}

/** The count as it is written on screen, with the same rule. */
export function totalLabel(area: MapArea): string {
  return `${String(area.total)}${area.complete ? '' : '+'}`;
}
