/**
 * What the flood map says about its own evidence, AC 4.3.1 to 4.3.4.
 *
 * Written as data rather than inline in the map, for the same reason as
 * `scenario/outcome.ts`: these are the sentences that decide whether a count
 * reads as a flood, a score reads as a risk, or an empty events list reads as
 * a clean history. They are reviewable in one place and asserted in
 * `evidence.test.ts`.
 *
 * **Every number is read from the artefacts or counted from the areas** — the
 * years, the population date, how many totals are floors, how many areas have
 * no score. The Iteration 1 board said "nine of the thirty" and the map holds
 * 281; a sentence with a number typed into it is a sentence that goes stale.
 */

import type { MapArea, PopulationArtefact, ScopeAreas } from './severity.js';

export interface Point {
  readonly title: string;
  readonly body: string;
}

/** The sentence across the top of the map, in both modes (4.1.1.e, 4.1.2.g, 4.3.4.d). */
export function notAPrediction(scope: ScopeAreas): string {
  return `A record of what happened between ${scope.reportingPeriod.years[0] ?? ''} and ${scope.reportingPeriod.years.at(-1) ?? ''}. Neither view is a forecast, and neither describes flooding today or in the future.`;
}

/** Why the areas are dots, not shapes. */
export const DOTS_NOTE =
  'Each dot marks one statistical area, placed inside the area it names. The value belongs to the whole area, not to the spot where the dot sits, and nothing is drawn where the area’s boundary runs.';

/** Counts the evidence sentences need, taken from the areas rather than typed in. */
export function countsOf(areas: readonly MapArea[]) {
  return {
    areas: areas.length,
    floors: areas.filter((a) => !a.complete).length,
    unscored: areas.filter((a) => a.rate === null).length,
    none: areas.filter((a) => a.complete && a.total === 0).length,
  };
}

/** AC 4.3.1 a–f, for the Historical Flood Activity view. */
export function activityEvidence(scope: ScopeAreas, areas: readonly MapArea[]): readonly Point[] {
  const { floors } = countsOf(areas);
  const years = scope.reportingPeriod.years;
  return [
    {
      title: 'Where it comes from',
      body: `${scope.source.dataset}, published by ${scope.source.publisher} under ${scope.source.licence}. Only incidents classed as ${scope.incidentType} are counted.`,
    },
    {
      title: 'The years it covers',
      body: `Six financial years, ${years[0] ?? ''} to ${years.at(-1) ?? ''} (${scope.reportingPeriod.start} to ${scope.reportingPeriod.end}). Every year is shown beside the total, because one wet year is most of it.`,
    },
    {
      title: 'Grouped by statistical area',
      body: `The counts are added up for each ${scope.geography.unit} in ${scope.geography.scope}, named and bounded by the ${scope.geography.standard}.`,
    },
    {
      title: 'One count is one crew dispatch, not one flood',
      body: 'A value is an SES crew sent to a flood-related job. Several crews at one incident count once each, and a dispatch is not a measure of how bad the flooding was.',
    },
    {
      title: 'Some counts were withheld',
      body: `The publisher withheld counts for very small areas to protect privacy. ${String(floors)} of the ${String(areas.length)} areas contain one, so their totals are minimums — shown with a + and a ring — not complete counts.`,
    },
    {
      title: 'Not current or future flooding',
      body: `The record ends on ${scope.reportingPeriod.end}. Drainage, development and rainfall have changed since, and nothing here describes conditions today or predicts them.`,
    },
  ];
}

/** AC 4.3.2 a–h, for the Severity Score view. */
export function severityEvidence(scope: ScopeAreas, population: PopulationArtefact): readonly Point[] {
  const years = scope.reportingPeriod.years;
  return [
    {
      title: 'What it uses',
      body: `The recorded SES ${scope.incidentType.toLowerCase()} dispatches (${scope.source.publisher}) and the estimated resident population (${population.source.publisher}, ${population.source.dataset}).`,
    },
    {
      title: 'What the inputs are',
      body: 'Dispatches are crews sent to flood-related jobs in the area. Residents are the estimated number of people usually living there — not visitors, workers, or anyone who was affected.',
    },
    {
      title: 'How it is calculated',
      body: `All dispatches from ${years[0] ?? ''} to ${years.at(-1) ?? ''} added together, divided by the residents on ${population.denominator}, times 1,000. Areas with fewer than ${population.minimumResidents.toLocaleString('en-AU')} residents get no score, because a handful of dispatches over a few residents gives a number that means nothing.`,
    },
    {
      title: 'The periods it covers',
      body: `Dispatches: ${scope.reportingPeriod.start} to ${scope.reportingPeriod.end}. Residents: one estimate, on ${population.denominator}, the middle of that period.`,
    },
    {
      title: 'Calculated by DrainLens',
      body: 'Neither the SES nor the ABS publishes this number. It is arithmetic we did on their data, and it is labelled as calculated wherever it appears.',
    },
    {
      title: 'What a higher score means',
      body: 'More recorded flood-related SES activity relative to the number of people living in the area.',
    },
    {
      title: 'It is not a count of people affected',
      body: 'The population is what the dispatches are divided by, not how many people flooding reached.',
    },
    {
      title: 'It is not severity, probability or risk',
      body: 'It does not measure how deep or damaging any flood was, how likely flooding is, or what flood risk an area has now or in the future.',
    },
  ];
}

/** AC 4.3.3 a–f, for both views. */
export function coverageEvidence(
  scope: ScopeAreas,
  population: PopulationArtefact,
  areas: readonly MapArea[],
): readonly Point[] {
  const { floors, unscored } = countsOf(areas);
  return [
    {
      title: 'What is missing or incomplete',
      body: `${String(floors)} areas have withheld counts, so their totals are minimums. ${String(unscored)} areas have too few residents for a score. Flash flooding is recorded by the SES under storms rather than floods and is not in these counts.`,
    },
    {
      title: 'The years of each dataset',
      body: `SES dispatches ${scope.reportingPeriod.start} to ${scope.reportingPeriod.end}; population estimates ${population.asAt[0] ?? ''} to ${population.asAt.at(-1) ?? ''}, of which ${population.denominator} is used; boundaries from the ${scope.geography.standard}.`,
    },
    {
      title: 'The periods do not match exactly',
      body: `Six years of dispatches are divided by one population estimate from the middle of them. An area that grew or shrank a lot over those years has a score that leans on that one date.`,
    },
    {
      title: 'Recorded, and calculated',
      body: `The dispatch counts are recorded by ${scope.source.publisher}; the population is estimated by ${population.source.publisher}. The Severity Score and where each dot is drawn are calculated by DrainLens.`,
    },
    {
      title: 'Nothing is filled in',
      body: 'A withheld count is not treated as zero, a missing population is not borrowed from a neighbouring area, and an area with no score shows no score.',
    },
    {
      title: 'How this affects the score',
      body: 'Where a count was withheld the score is a minimum too, shown with a +. A score is a comparison of recorded activity per resident across areas, and a small difference between two areas is not a real one.',
    },
  ];
}

/** AC 4.3.4: the three kinds of information on this map, kept apart. */
export const INFORMATION_TYPES: readonly {
  readonly key: 'recorded' | 'calculated' | 'written';
  readonly badge: string;
  readonly what: string;
  readonly purpose: string;
  readonly limits: string;
}[] = [
  {
    key: 'recorded',
    badge: 'Recorded by the SES',
    what: 'Historical flood activity',
    purpose: 'Shows where SES crews were sent to flood-related jobs, and when.',
    limits: 'A count of dispatches, some withheld; not a count of floods, and not a measure of how bad they were.',
  },
  {
    key: 'calculated',
    badge: 'Calculated by DrainLens',
    what: 'Severity Score',
    purpose: 'Compares recorded activity across areas with very different numbers of residents.',
    limits: 'Our arithmetic, not an observation. Not people affected, not severity, not risk.',
  },
  {
    key: 'written',
    badge: 'Written by the DrainLens team',
    what: 'Verified flood events',
    purpose: 'Describes particular floods, with links to the sources they were checked against.',
    limits: 'A short list of events the team has checked, not a complete history. No event listed does not mean no flooding.',
  },
];
