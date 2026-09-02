/**
 * The recorded flood incidents, as the board reads them.
 *
 * The artefact is built by `drainlens_pipeline.flood_history` and everything
 * interesting about it was decided there, against the sources — which areas,
 * which incident type, which years, and what a count is. This module's job is
 * to refuse an artefact that does not carry those answers, so that a screen
 * never has to guess at one.
 *
 * **Why the checks are strict about the wording fields.** `source`,
 * `reportingPeriod`, `geography` and `excludes` are not decoration: AC 2.1.1.f
 * requires the period, the geographic unit and the source on the page, and AC
 * 2.3.1 requires the meaning and the limitations. An artefact missing them
 * would render a ranking with nothing qualifying it, which is the one shape
 * this page must never take. Better to fail to load than to publish a league
 * table of suburbs with no note saying what it counts.
 */

export interface FloodArea {
  readonly rank: number;
  readonly name: string;
  readonly total: number;
  /** One count per financial year, in the artefact's `reportingPeriod.years` order. */
  readonly byYear: readonly number[];
  readonly regions: number;
  readonly suppressedRegions: number;
  /** False where a count inside this area was withheld, making the total a floor. */
  readonly complete: boolean;
  /** True where an adjacent published area recorded the same total. */
  readonly tied: boolean;
}

export interface FloodPilotArea {
  readonly name: string;
  readonly total: number;
  readonly byYear: readonly number[];
  readonly complete: boolean;
}

export interface FloodHistoryArtefact {
  readonly artefact: 'flood-history';
  readonly version: number;
  readonly basis: 'sourceProvided';
  readonly note: string;
  readonly source: {
    readonly dataset: string;
    readonly publisher: string;
    readonly licence: string;
    readonly dataset_id: string;
  };
  readonly geographySource: FloodHistoryArtefact['source'];
  readonly reportingPeriod: {
    readonly start: string;
    readonly end: string;
    readonly years: readonly string[];
  };
  readonly geography: {
    readonly unit: string;
    readonly standard: string;
    readonly scope: string;
  };
  readonly incidentType: string;
  readonly excludes: string;
  readonly defaultAreas: number;
  readonly counts: {
    readonly areasPublished: number;
    readonly areasWithIncidents: number;
    readonly areasInScope: number;
    readonly regions: number;
    readonly suppressedRegions: number;
    readonly incidentsInScope: number;
    readonly incidentsPublished: number;
  };
  readonly areas: readonly FloodArea[];
  readonly pilotArea: FloodPilotArea | null;
}

export class FloodHistoryError extends Error {}

function fail(what: string): never {
  throw new FloodHistoryError(`the flood history artefact ${what}`);
}

/**
 * Accept the artefact, or say what is wrong with it.
 *
 * Ordering matters here in one place: the areas are checked to be ranked and
 * descending *after* they are checked to be non-empty, so an empty file is
 * reported as empty rather than as an ordering problem.
 */
export function assertFloodHistory(value: unknown): asserts value is FloodHistoryArtefact {
  const a = value as Partial<FloodHistoryArtefact> | null;
  if (a === null || typeof a !== 'object') fail('is not an object');
  if (a.artefact !== 'flood-history') fail(`is ${String(a.artefact)}, not flood-history`);

  if (typeof a.incidentType !== 'string' || a.incidentType === '') {
    fail('does not say which incident type it counts');
  }
  if (typeof a.excludes !== 'string' || a.excludes === '') {
    fail('does not say what that incident type leaves out');
  }
  if (typeof a.note !== 'string' || a.note === '') fail('does not say what a count is');

  const period = a.reportingPeriod;
  if (
    !period ||
    typeof period.start !== 'string' ||
    typeof period.end !== 'string' ||
    !Array.isArray(period.years) ||
    period.years.length === 0
  ) {
    fail('does not carry a reporting period — AC 2.1.1.f needs it on the page');
  }

  const geography = a.geography;
  if (
    !geography ||
    typeof geography.unit !== 'string' ||
    typeof geography.scope !== 'string' ||
    typeof geography.standard !== 'string'
  ) {
    fail('does not carry a geographic unit — AC 2.1.1.f needs it on the page');
  }

  for (const [name, source] of [
    ['source', a.source],
    ['geographySource', a.geographySource],
  ] as const) {
    if (
      !source ||
      typeof source.dataset !== 'string' ||
      typeof source.publisher !== 'string' ||
      typeof source.licence !== 'string'
    ) {
      fail(`does not credit its ${name}`);
    }
  }

  if (!Array.isArray(a.areas) || a.areas.length === 0) fail('carries no areas');
  if (typeof a.defaultAreas !== 'number' || a.defaultAreas < 1) {
    fail('does not say how many areas are the default view');
  }
  if (a.areas.length < a.defaultAreas) {
    fail(`carries ${a.areas.length} areas but calls ${a.defaultAreas} the default view`);
  }

  let previous = Infinity;
  a.areas.forEach((area, i) => {
    if (typeof area.name !== 'string' || area.name === '') fail(`area ${i + 1} has no name`);
    if (typeof area.total !== 'number' || !Number.isFinite(area.total) || area.total < 0) {
      fail(`area ${area.name} has no usable total`);
    }
    if (area.rank !== i + 1) fail(`area ${area.name} is ranked ${area.rank} at position ${i + 1}`);
    if (!Array.isArray(area.byYear) || area.byYear.length !== period.years.length) {
      fail(`area ${area.name} has ${String(area.byYear?.length)} years, not ${period.years.length}`);
    }
    // Summed with each value checked rather than trusted. `Array.isArray`
    // narrows the element type to `any`, so an entry that is a string would
    // otherwise concatenate its way to a total that looks like a number.
    let summed = 0;
    for (const value of area.byYear as readonly unknown[]) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        fail(`area ${area.name} has ${JSON.stringify(value)} where a count should be`);
      }
      summed += value;
    }
    if (summed !== area.total) {
      fail(`area ${area.name} totals ${area.total} but its years sum to ${summed}`);
    }
    // AC 2.1.1.c. Checked rather than sorted here: a file that arrives out of
    // order is a pipeline defect, and re-sorting it in the browser would hide
    // the defect while leaving the ranks it carries wrong.
    if (area.total > previous) fail(`area ${area.name} is ranked below a smaller count`);
    previous = area.total;
  });
}

/** The five (or however many) that open the page — AC 2.1.1.b and 2.1.1.h. */
export function defaultView(artefact: FloodHistoryArtefact): readonly FloodArea[] {
  return artefact.areas.slice(0, artefact.defaultAreas);
}

/**
 * Whether there is anything behind *Show more locations* — AC 2.2.1.
 *
 * False hides the control rather than showing one that does nothing. The
 * artefact caps at 30 and today carries 30, so this is a guard against a
 * smaller rebuild rather than a live case.
 */
export function hasMore(artefact: FloodHistoryArtefact): boolean {
  return artefact.areas.length > artefact.defaultAreas;
}

/**
 * The scale every bar is drawn against.
 *
 * The largest published total, not each view's own largest. A bar that
 * rescaled when *Show more* was pressed would make the top five appear to
 * shrink, which is a change in the picture with no change in the data.
 */
export function barScale(artefact: FloodHistoryArtefact): number {
  return Math.max(1, ...artefact.areas.map((a) => a.total));
}

/** The reporting period as a person reads it, from the artefact's own dates. */
export function periodLabel(artefact: FloodHistoryArtefact): string {
  const { years } = artefact.reportingPeriod;
  const first = years[0];
  const last = years[years.length - 1];
  return years.length === 1 ? String(first) : `${String(first)} to ${String(last)}`;
}

/**
 * Areas hidden by the cut that recorded the same total as the last one shown.
 *
 * The reason this exists: ranks five and six both recorded 133, so a default
 * view of five ends on a row marked *tied* with nothing on screen to be tied
 * to. "The five highest" is then quietly "five of the six highest", and the
 * reader cannot tell. Naming the hidden area costs a sentence and is the
 * difference between a ranking and a ranking you can check.
 */
export function tiedBeyond(
  artefact: FloodHistoryArtefact,
  shown: number,
): readonly FloodArea[] {
  const last = artefact.areas[shown - 1];
  if (last === undefined || shown >= artefact.areas.length) return [];
  return artefact.areas.slice(shown).filter((a) => a.total === last.total);
}

/** How many of the displayed areas hold a withheld count — AC 2.1.1.g. */
export function incompleteCount(areas: readonly FloodArea[]): number {
  return areas.filter((a) => !a.complete).length;
}
