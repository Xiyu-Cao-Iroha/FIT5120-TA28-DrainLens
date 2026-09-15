/**
 * What the flood map says about its own evidence, AC 4.3.1 to 4.3.4.
 *
 * Written as data rather than inline in the map, for the same reason as
 * `scenario/outcome.ts`: these are the sentences that decide whether a count
 * reads as a flood, a rate reads as a risk, or an empty events list reads as
 * a clean history. They are reviewable in one place and asserted in
 * `evidence.test.ts`.
 *
 * **Every number is read from the artefacts or counted from the areas** -- the
 * dates, the population date, how many totals are minimums, how many areas
 * have no rate. The Iteration 1 board said "nine of the thirty" and the map
 * holds 281; a sentence with a number typed into it is a sentence that goes
 * stale.
 *
 * **All of it sits under More information** (copy audit v2, #81, #83, #85,
 * #87). The map's header keeps one question and `FLOOD.explain`; the panel
 * keeps the numbers. Who recorded and who calculated is said here once, in
 * words, instead of on a badge beside every section.
 */

import { readableDate } from './board.js';
import type { MapArea, PopulationArtefact, ScopeAreas } from './severity.js';
import { FLOOD } from '../ui/terms.js';

export interface Point {
  readonly title: string;
  readonly body: string;
}

/**
 * The one safety line across the top of the map, in both modes (4.1.1.e,
 * 4.1.2.g, 4.3.4.d).
 *
 * Copy audit v2, #81: *past data only, not a forecast*, after `FLOOD.explain`.
 * The dates it used to carry are in the page's subtitle and in More
 * information.
 */
export const NOT_A_FORECAST = 'Past data only, not a forecast.';

/** What an area's colour does and does not say. Under More information since copy audit v2, #81. */
export const AREAS_NOTE =
  'Each colour covers the whole area. It does not show where in the area the emergency responses were.';

/** Counts the evidence sentences need, taken from the areas rather than typed in. */
export function countsOf(areas: readonly MapArea[]) {
  return {
    areas: areas.length,
    floors: areas.filter((a) => !a.complete).length,
    unscored: areas.filter((a) => a.rate === null).length,
    none: areas.filter((a) => a.complete && a.total === 0).length,
    /**
     * Small regions whose count was withheld, inside these areas. Carried so
     * the privacy sentence can say that this and the area count are two
     * different things (copy audit v2, appendix D): the flood history page's
     * 144 are small regions in the whole SES file, the map's 80 are areas.
     */
    withheldRegions: areas.reduce((n, a) => n + a.suppressedRegions, 0),
  };
}

/** AC 4.3.1 a–f, for the total emergency responses view. */
export function activityEvidence(scope: ScopeAreas, areas: readonly MapArea[]): readonly Point[] {
  const { floors, withheldRegions } = countsOf(areas);
  const period = `${readableDate(scope.reportingPeriod.start)} to ${readableDate(scope.reportingPeriod.end)}`;
  return [
    {
      title: 'Where it comes from',
      body: `${scope.source.dataset}, published by the ${scope.source.publisher} under ${scope.source.licence}. Only jobs the SES classed as ${scope.incidentType.toLowerCase()} are counted.`,
    },
    {
      title: 'The years it covers',
      body: `Six financial years, ${period}. Every year is shown beside the total, because one wet year is a large part of it.`,
    },
    {
      title: 'Grouped by area',
      body: `The counts are added up for each statistical area (${scope.geography.unit}) in ${scope.geography.scope}, named and drawn as in the ${scope.geography.standard}.`,
    },
    {
      title: 'One count is one flood job, not one flood',
      // Copy audit v2: the old sentence said several crews at one incident
      // count once each. The publisher says they count once in total.
      body: `${FLOOD.explain} A count does not say how bad the flooding was.`,
    },
    {
      title: 'Some counts were hidden for privacy',
      body: `Counts for very small regions, where a number could identify somebody, were not published. ${String(withheldRegions)} of those small regions sit inside ${String(floors)} of the ${String(areas.length)} areas on this map, so those areas show at least this many, with a + and hatching. The real total may be higher.`,
    },
    {
      title: 'Not current or future flooding',
      body: `The record ends on ${readableDate(scope.reportingPeriod.end)}. Drains, buildings and rainfall have changed since, and nothing here describes conditions today or predicts them.`,
    },
  ];
}

/** AC 4.3.2 a–h, for the emergency responses per 1,000 people view. */
export function severityEvidence(scope: ScopeAreas, population: PopulationArtefact): readonly Point[] {
  const denominator = readableDate(population.denominator);
  return [
    {
      title: 'What it uses',
      body: `The SES ${scope.incidentType.toLowerCase()} ${FLOOD.unit} (${scope.source.publisher}) and the estimated number of residents (${population.source.publisher}, ${population.source.dataset}).`,
    },
    {
      title: 'What the inputs are',
      body: `${FLOOD.explain} Residents are the estimated number of people usually living in the area, not visitors, workers or anyone who was affected.`,
    },
    {
      title: 'How it is calculated',
      body: `All ${FLOOD.unit} from ${FLOOD.period} added together, divided by the residents on ${denominator}, times 1,000. Areas with fewer than ${population.minimumResidents.toLocaleString('en-AU')} residents are not given a rate because small populations can make the result unstable.`,
    },
    {
      title: 'The periods it covers',
      body: `Emergency responses: ${readableDate(scope.reportingPeriod.start)} to ${readableDate(scope.reportingPeriod.end)}. Residents: one estimate, on ${denominator}, the middle of that period.`,
    },
    {
      title: 'Calculated by DrainLens',
      body: 'Neither the SES nor the Australian Bureau of Statistics (ABS) publishes this number. DrainLens worked it out from their data.',
    },
    {
      title: 'What a higher rate means',
      body: `More SES flood ${FLOOD.unit} for every 1,000 people living in the area.`,
    },
    {
      title: 'It is not a count of people affected',
      body: `The population is what the ${FLOOD.unit} are divided by, not how many people flooding reached.`,
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
      body: `${String(floors)} areas have at least one count hidden for privacy, so their totals are minimums. ${String(unscored)} areas have fewer than ${minimum} residents, so they have no rate. These totals do not include flash flooding, which the SES records under storms.`,
    },
    {
      title: 'The years of each dataset',
      body: `SES ${FLOOD.unit} ${readableDate(scope.reportingPeriod.start)} to ${readableDate(scope.reportingPeriod.end)}; population estimates ${readableDate(population.asAt[0] ?? '')} to ${readableDate(population.asAt.at(-1) ?? '')}, of which ${readableDate(population.denominator)} is used; boundaries from the ${scope.geography.standard}.`,
    },
    {
      title: 'How the areas are drawn',
      body: `Each area is an ${scope.geography.unit}, a statistical area defined by the Australian Bureau of Statistics (ABS) in the ${scope.geography.standard}. It is drawn as its ABS boundary, simplified to about 25 metres. ${AREAS_NOTE}`,
    },
    {
      title: 'The periods do not match exactly',
      body: `Six years of ${FLOOD.unit} are divided by one population estimate from the middle of them. An area that grew or shrank a lot over those years has a rate that leans on that one date.`,
    },
    {
      title: 'Recorded, and calculated',
      body: `The counts are recorded by the ${scope.source.publisher}; the population is estimated by the ${population.source.publisher}. The rate and where each area is drawn are calculated by DrainLens.`,
    },
    {
      title: 'Nothing is filled in',
      body: 'A hidden count is not treated as zero, a missing population is not borrowed from a neighbouring area, and an area with no rate shows no rate.',
    },
    {
      title: 'How this affects the rate',
      body: `Where a count was hidden the rate is a minimum too, shown with a +. The rate compares ${FLOOD.unit} per resident across areas, and a small difference between two areas is not a real one.`,
    },
  ];
}

/**
 * AC 4.3.4: the three kinds of information on this map, kept apart.
 *
 * Kept apart in words, not by coloured badges (copy audit v2, #85): each says
 * who it comes from once, here under More information.
 */
export const INFORMATION_TYPES: readonly {
  readonly key: 'recorded' | 'calculated' | 'written';
  readonly from: string;
  readonly what: string;
  readonly purpose: string;
  readonly limits: string;
}[] = [
  {
    key: 'recorded',
    from: 'Recorded by the SES.',
    what: FLOOD.callouts,
    purpose: 'Shows where SES crews were sent to flood jobs, and when.',
    limits: 'Some counts were hidden for privacy. Not a count of floods, and not a measure of how bad they were.',
  },
  {
    key: 'calculated',
    from: 'Calculated by DrainLens.',
    what: FLOOD.rate,
    purpose: 'Compares emergency responses across areas with very different numbers of residents.',
    limits: 'Our arithmetic, not an observation. Not people affected, not flood depth or damage, not risk.',
  },
  {
    key: 'written',
    from: 'Written and checked by the DrainLens team.',
    what: 'Verified flood events',
    purpose: 'Describes particular floods, with links to the sources they were checked against.',
    limits: 'A short list of events the team has checked, not a complete history. No event listed does not mean no flooding.',
  },
];
