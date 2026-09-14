/**
 * What the flood map says about its own evidence, AC 4.3.1 to 4.3.4.
 *
 * Written as data rather than inline in the map, for the same reason as
 * `scenario/outcome.ts`: these are the sentences that decide whether a count
 * reads as a flood, a rate reads as a risk, or an empty events list reads as
 * a clean history. They are reviewable in one place and asserted in
 * `evidence.test.ts`.
 *
 * **Every number is read from the artefacts or counted from the areas** — the
 * years, the population date, how many totals are minimums, how many areas
 * have no rate. The Iteration 1 board said "nine of the thirty" and the map
 * holds 281; a sentence with a number typed into it is a sentence that goes
 * stale.
 */

import { yearRange } from './artefact.js';
import type { MapArea, PopulationArtefact, ScopeAreas } from './severity.js';
import { FLOOD } from '../ui/terms.js';

export interface Point {
  readonly title: string;
  readonly body: string;
}

/** The sentence across the top of the map, in both modes (4.1.1.e, 4.1.2.g, 4.3.4.d). */
export function notAPrediction(scope: ScopeAreas): string {
  return `This map shows SES records from ${yearRange(scope.reportingPeriod.years)}, not current or future flooding.`;
}

/** What an area's colour does and does not say. */
export const AREAS_NOTE =
  'Each colour applies to the whole statistical area and does not locate incidents within it.';

/** Counts the evidence sentences need, taken from the areas rather than typed in. */
export function countsOf(areas: readonly MapArea[]) {
  return {
    areas: areas.length,
    floors: areas.filter((a) => !a.complete).length,
    unscored: areas.filter((a) => a.rate === null).length,
    none: areas.filter((a) => a.complete && a.total === 0).length,
  };
}

/** AC 4.3.1 a–f, for the recorded call-outs view. */
export function activityEvidence(scope: ScopeAreas, areas: readonly MapArea[]): readonly Point[] {
  const { floors } = countsOf(areas);
  return [
    {
      title: 'Where it comes from',
      body: `${scope.source.dataset}, published by ${scope.source.publisher} under ${scope.source.licence}. Only incidents classed as ${scope.incidentType} are counted.`,
    },
    {
      title: 'The years it covers',
      body: `Six financial years, ${yearRange(scope.reportingPeriod.years)} (${scope.reportingPeriod.start} to ${scope.reportingPeriod.end}). Every year is shown beside the total, because one wet year is most of it.`,
    },
    {
      title: 'Grouped by statistical area',
      body: `The counts are added up for each ${scope.geography.unit} in ${scope.geography.scope}, named and bounded by the ${scope.geography.standard}.`,
    },
    {
      title: 'Each count is one SES crew response, not one flood event',
      body: 'A value is an SES crew sent to a flood-related job. Several crews at one incident count once each, and a call-out is not a measure of how bad the flooding was.',
    },
    {
      title: 'Some exact counts were not published',
      body: `The publisher did not publish exact counts for very small areas, to protect privacy. ${String(floors)} of the ${String(areas.length)} areas include at least one of those small areas, so their totals are minimums — shown with a + and a ring — and the real total may be higher.`,
    },
    {
      title: 'Not current or future flooding',
      body: `The record ends on ${scope.reportingPeriod.end}. Drainage, development and rainfall have changed since, and nothing here describes conditions today or predicts them.`,
    },
  ];
}

/** AC 4.3.2 a–h, for the call-outs per 1,000 residents view. */
export function severityEvidence(scope: ScopeAreas, population: PopulationArtefact): readonly Point[] {
  return [
    {
      title: 'What it uses',
      body: `The recorded SES ${scope.incidentType.toLowerCase()} call-outs (${scope.source.publisher}) and the estimated resident population (${population.source.publisher}, ${population.source.dataset}).`,
    },
    {
      title: 'What the inputs are',
      body: 'Call-outs are SES crews sent to flood-related jobs in the area. Residents are the estimated number of people usually living there — not visitors, workers, or anyone who was affected.',
    },
    {
      title: 'How it is calculated',
      body: `All call-outs from ${yearRange(scope.reportingPeriod.years)} added together, divided by the residents on ${population.denominator}, times 1,000. Areas with fewer than ${population.minimumResidents.toLocaleString('en-AU')} residents are not given a rate because small populations can make the result unstable.`,
    },
    {
      title: 'The periods it covers',
      body: `Call-outs: ${scope.reportingPeriod.start} to ${scope.reportingPeriod.end}. Residents: one estimate, on ${population.denominator}, the middle of that period.`,
    },
    {
      title: 'Calculated by DrainLens',
      body: 'Neither the SES nor the ABS publishes this number. It is arithmetic we did on their data, and it is labelled as calculated wherever it appears.',
    },
    {
      title: 'What a higher rate means',
      body: 'More recorded SES flood call-outs for every 1,000 people living in the area.',
    },
    {
      title: 'It is not a count of people affected',
      body: 'The population is what the call-outs are divided by, not how many people flooding reached.',
    },
    {
      title: 'This rate does not measure flood depth, damage, probability or current risk',
      body: 'It does not say how deep or damaging any flood was, how likely flooding is, or what flood risk an area has now or in the future.',
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
  const minimum = population.minimumResidents.toLocaleString('en-AU');
  return [
    {
      title: 'What is missing or incomplete',
      body: `${String(floors)} areas have at least one exact count that was not published, so their totals are minimums. ${String(unscored)} areas have fewer than ${minimum} residents, so they have no rate. These totals do not include incidents recorded as flash flooding, which the SES records under storms.`,
    },
    {
      title: 'The years of each dataset',
      body: `SES call-outs ${scope.reportingPeriod.start} to ${scope.reportingPeriod.end}; population estimates ${population.asAt[0] ?? ''} to ${population.asAt.at(-1) ?? ''}, of which ${population.denominator} is used; boundaries from the ${scope.geography.standard}.`,
    },
    {
      title: 'How the areas are drawn',
      body: `Each area is an ${scope.geography.unit}, a statistical area defined by the ABS in the ${scope.geography.standard}. It is drawn as its ABS boundary, simplified to about 25 metres.`,
    },
    {
      title: 'The periods do not match exactly',
      body: 'Six years of call-outs are divided by one population estimate from the middle of them. An area that grew or shrank a lot over those years has a rate that leans on that one date.',
    },
    {
      title: 'Recorded, and calculated',
      body: `The call-out counts are recorded by ${scope.source.publisher}; the population is estimated by ${population.source.publisher}. The call-out rate and map symbol positions are calculated by DrainLens.`,
    },
    {
      title: 'Nothing is filled in',
      body: 'A count that was not published is not treated as zero, a missing population is not borrowed from a neighbouring area, and an area with no rate shows no rate.',
    },
    {
      title: 'How this affects the rate',
      body: 'Where an exact count was not published the rate is a minimum too, shown with a +. The rate compares recorded call-outs per resident across areas, and a small difference between two areas is not a real one.',
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
    what: FLOOD.callouts,
    purpose: 'Shows where SES crews were sent to flood-related jobs, and when.',
    limits: 'A count of crew call-outs, some with the exact count not published; not a count of floods, and not a measure of how bad they were.',
  },
  {
    key: 'calculated',
    badge: 'Calculated by DrainLens',
    what: FLOOD.rate,
    purpose: 'Compares recorded call-outs across areas with very different numbers of residents.',
    limits: 'Our arithmetic, not an observation. Not people affected, not flood depth or damage, not risk.',
  },
  {
    key: 'written',
    badge: 'Written by the DrainLens team',
    what: 'Verified flood events',
    purpose: 'Describes particular floods, with links to the sources they were checked against.',
    limits: 'A short list of events the team has checked, not a complete history. No event listed does not mean no flooding.',
  },
];
