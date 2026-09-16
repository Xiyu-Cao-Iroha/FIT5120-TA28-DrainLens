/**
 * The "About the data" page: every source, method and limit, said once.
 *
 * **Why a page.** The copy audit of 15 September found the same explanations
 * repeated on cards, legends, popups and tutorial steps, most of it about
 * where data came from rather than what the resident is looking at. Screens
 * now keep only what an acceptance criterion needs on the spot (a short source
 * label, a status such as "At least") and link here for the rest.
 *
 * **What stays on screen, and why** (see `SOURCE_LINKS` for each entry point):
 * - AC 1.1.4, 1.3.1: the map legend groups layers by source.
 * - AC 1.1.7, 1.2.1: every popup names its source in one short line.
 * - AC 2.1.1, 2.3.1: the flood history page states period, source, area unit
 *   and "not a forecast" itself.
 * - AC 4.1.4: the selected area panel keeps its own link here.
 * - AC 4.2.3: "no checked events" is said inside the events section.
 *
 * AC 4.3.1 to 4.3.4 describe what the system explains "when the user opens the
 * evidence explanation"; this page is that explanation. Each section lists the
 * clauses it answers in `ac`, which is for the team and is not rendered.
 *
 * Copy rules: plain English, no abbreviation without its full name first, no
 * long dashes. The Iteration 2 criteria call the per-1,000 figure a severity
 * score; the site does not use that word (see `RETIRED_TERMS`).
 */

export type SourceSectionId =
  | 'drains'
  | 'ground'
  | 'flood-history'
  | 'rate'
  | 'events'
  | 'limits'
  | 'privacy';

export interface SourceSection {
  readonly id: SourceSectionId;
  /** Short heading, also used in the section menu. */
  readonly title: string;
  /** One sentence under the heading. */
  readonly summary: string;
  readonly points: readonly string[];
  /** Where the data comes from, in one paragraph. Absent where the page renders credits instead. */
  readonly source?: string;
  /** Acceptance criteria this section answers. Not rendered. */
  readonly ac: readonly string[];
}

export const SOURCES_PAGE = {
  title: 'About the data',
  intro: 'Where each part of DrainLens comes from, how it is worked out, and what it cannot tell you.',
  /** The footer link on every screen. */
  footerLink: 'Data sources and limits',
  close: 'Back',
  menuLabel: 'On this page',
} as const;

export const SOURCE_SECTIONS: readonly SourceSection[] = [
  {
    id: 'drains',
    title: 'Drains and pipes',
    summary: 'The street drains (pits) and underground pipes come from City of Melbourne records.',
    points: [
      'The council last updated these records in February 2023. DrainLens has not checked them on site.',
      'When you follow a drain, the highlighted line uses only connections in the council record. We do not guess missing pipes.',
      'The line stops where the record stops. That may not be where water really leaves the drain network.',
      'The records do not tell us how deep a pipe is, whether it is blocked, or how much water it can carry.',
      'Street outlines and street names also come from City of Melbourne records.',
    ],
    source:
      'City of Melbourne Open Data: stormwater pits and drain pipes (updated 26 February 2023), road corridors and street names (updated 30 September 2021). Licensed CC BY 4.0.',
    ac: ['1.1.4', '1.1.7', '1.2.1', '1.2.2', 'Epic 1 DoD'],
  },
  {
    id: 'ground',
    title: 'Ground height, water paths and low areas',
    summary: 'These are estimates made by DrainLens. They are not council records and not flood forecasts.',
    points: [
      'They are worked out from the City of Melbourne 3D Point Cloud 2018, a height survey made from aerial photographs. Heights are accurate to about 25 cm.',
      'Heights are in metres above sea level (Australian Height Datum). Colours show higher and lower ground, and lines join places of equal height.',
      'Likely water paths follow the steepest way downhill. They show where rain would tend to run, not where water has been seen.',
      'Building outlines are used so that water paths go around buildings.',
      'Low areas are dips in the ground. We only show dips at least 25 cm deep, because smaller changes are within the survey’s error.',
      'A warning sign marks an especially deep low area on a street. It appears when you zoom in.',
      'Striped areas are ground data gaps. Cameras cannot see the ground under trees, so we do not show water paths there.',
      'None of these layers shows how deep water would get, when it would arrive, or whether a place will flood.',
    ],
    source:
      'City of Melbourne Open Data: 3D Point Cloud 2018 and 2020 Building Footprints. Licensed CC BY 4.0. DrainLens calculated the ground height, water paths and low areas from this data; they are not published by the council.',
    ac: ['1.1.4', '1.1.7', '1.3.1', '1.3.2', 'Epic 1 DoD'],
  },
  {
    id: 'flood-history',
    title: 'Flood history',
    summary:
      'Past emergency responses to flooding by the Victoria State Emergency Service (SES), from July 2009 to June 2015.',
    points: [
      'Each emergency response is a time the SES was sent to help with a flood-related job. It is not one flood.',
      'The counts do not show how bad the flooding was, how much water there was, or what was damaged.',
      'Years run from July to June. For example, 2010/11 means July 2010 to June 2011.',
      'Areas follow Australian Bureau of Statistics boundaries (Statistical Area Level 2, 2011 edition). A count covers the whole area and does not show where in the area the job was.',
      'To protect privacy, the SES did not publish exact counts for very small areas. Where that happened, the total is shown with a + and is a minimum. The real number may be higher.',
      'Flash flooding is recorded by the SES under storms, so it is not included.',
      'How often people ask for help differs between areas, so a count is not a direct measure of flooding.',
      'The records end in June 2015. They do not describe flooding today or in the future.',
    ],
    source:
      'Victoria State Emergency Service: VICSES Incidents Per SA1 ABS Census Areas, 2009 to 2015. Licensed CC BY 4.0. Area names and boundaries: Australian Bureau of Statistics, Australian Statistical Geography Standard 2011. Licensed CC BY 2.5 AU. DrainLens added up the counts for each area and ranked them.',
    ac: ['2.1.1', '2.2.1', '2.3.1', '4.1.2', '4.1.5', '4.3.1', '4.3.3', '4.3.4'],
  },
  {
    id: 'rate',
    title: 'Emergency responses per 1,000 people',
    summary: 'Our calculation. It lets you compare areas with very different numbers of residents.',
    points: [
      'How it works: take an area’s SES flood responses from July 2009 to June 2015, divide by the number of people living there on 30 June 2012, then multiply by 1,000.',
      'Example: Bacchus Marsh had 209 responses and 18,055 residents. 209 ÷ 18,055 × 1,000 = 11.58.',
      'Low is up to 1.3. Medium is above 1.3 and up to 3. High is above 3.',
      'A higher figure means more SES flood activity for the number of people who live there. It is not the number of people affected, how severe a flood was, or the chance of flooding.',
      'We use one population year for all six years of records. An area that grew or shrank a lot over that time leans on that one date.',
      'Areas with fewer than 1,000 residents have no figure.',
      'If an area’s count is a minimum (+), its figure is a minimum too.',
      'Small differences between two areas are not meaningful.',
      'We never fill in missing numbers. A hidden count is not treated as zero, and a missing population is not borrowed from a nearby area.',
    ],
    source:
      'Australian Bureau of Statistics: Population Estimates by Statistical Area Level 2, 2005 to 2015. Licensed CC BY 2.5 AU. Calculated by DrainLens from these figures and the SES records above.',
    ac: ['4.1.3', '4.1.5', '4.1.6', '4.3.2', '4.3.3', '4.3.4'],
  },
  {
    id: 'events',
    title: 'Checked flood events',
    summary: 'A short list of past floods, written by the DrainLens team.',
    points: [
      'Each event is written from at least two official sources, such as the Bureau of Meteorology, Melbourne Water and the Australian Institute for Disaster Resilience. We do not use news reports.',
      'A team member checks every sentence against those sources before it appears.',
      'Links to the sources are shown under each event.',
      'The list is not complete. If an area has no event listed, that does not mean it has never flooded.',
    ],
    source:
      'Official publications only, such as the Bureau of Meteorology, Melbourne Water and the Australian Institute for Disaster Resilience Knowledge Hub.',
    ac: ['4.2.1', '4.2.2', '4.2.3', '4.3.4'],
  },
  {
    id: 'limits',
    title: 'What DrainLens cannot tell you',
    summary: 'DrainLens helps you understand your area. It is not a warning service.',
    points: [
      'It does not show live conditions or warnings. For current warnings, check VicEmergency.',
      'For flood or storm help, call the SES on 132 500. In a life-threatening emergency, call 000.',
      'It does not predict floods, how deep water would get, or when it would arrive.',
      'Drains, water paths and low areas cover the City of Melbourne only. Flood history covers Greater Melbourne.',
      'The photograph on the homepage and the illustration on the guide page are decoration. Nothing is measured from them.',
    ],
    ac: ['1.1.1', '1.3.2', '2.3.1', '4.1.1', '4.3.4'],
  },
  {
    id: 'privacy',
    title: 'Your privacy and data licences',
    summary: 'Your address stays on your device.',
    points: [
      'Address search happens in your browser. Your address is not sent or saved, and it is forgotten when you close the tab.',
      'Your progress through the guides is saved on this device only.',
    ],
    // The credits are rendered here from the loaded artefacts, so a replaced
    // dataset updates its own credit. See `ui/attribution.ts`.
    ac: ['1.1.3', 'CC BY 4.0 attribution'],
  },
];

/**
 * Every place on the site that links here, and the section it opens.
 *
 * `label` is the visible text. `where` and `ac` are for the team: the
 * component that renders the link and the clause that made it necessary.
 * `sources.test.ts` fails on an id no component uses, so an entry is removed
 * with its last link rather than left describing nothing.
 *
 * The warning sign's card has no link on purpose (copy audit v4, #62): the
 * industry mentor asked for no further explanation on it, and the low areas'
 * legend group already says they are estimated.
 */
export const SOURCE_LINKS = {
  footer: { label: SOURCES_PAGE.footerLink, section: null, where: 'ui/Shell.tsx footer, every screen', ac: ['2.3.1', '4.3.1'] },
  recorded: { label: 'From council records', section: 'drains', where: 'map/MapLayers.tsx legend group; map/MapCallout.tsx foot of the pit and pipe popups (screens/MapView.tsx)', ac: ['1.1.4', '1.1.7', '1.2.1'] },
  derived: { label: 'Estimated by DrainLens', section: 'ground', where: 'map/MapLayers.tsx legend group; map/AddressInsight.tsx foot of the address card, and screens/MapView.tsx when the card has no figure', ac: ['1.1.4', '1.1.7', '1.3.1', '1.3.2'] },
  pathEnds: { label: 'Why the line stops', section: 'drains', where: 'screens/PitDetail.tsx followed path', ac: ['1.2.2'] },
  groundLegend: { label: 'More about ground height', section: 'ground', where: 'map/MapLayers.tsx ground height legend', ac: ['1.3.1'] },
  mapNotice: { label: 'More about the map', section: 'drains', where: 'screens/LockedMap.tsx, under the two lines', ac: ['1.1.4'] },
  homeLimits: { label: 'What DrainLens can and cannot show', section: 'limits', where: 'screens/Home.tsx, under the closing "not a live flood warning" line', ac: ['1.1.1'] },
  history: { label: 'About the data', section: 'flood-history', where: 'screens/Home.tsx top 5 note; screens/FloodHistory.tsx under the three notes; screens/FloodMap.tsx empty and selected area panels', ac: ['2.1.1', '2.3.1', '4.1.4'] },
  minimum: { label: 'Why “at least”?', section: 'flood-history', where: 'screens/FloodHistory.tsx under the list; screens/FloodMap.tsx foot of the key, and after an "At least" status in the area panel', ac: ['2.2.1', '4.1.5', '4.1.6'] },
  pastRecords: { label: 'Past records', section: 'flood-history', where: 'history/evidence.ts AREA_KINDS: the counts section of the screens/FloodMap.tsx area panel', ac: ['4.3.4'] },
  calculation: { label: 'Our calculation', section: 'rate', where: 'history/evidence.ts AREA_KINDS: the rate section of the screens/FloodMap.tsx area panel; screens/FloodHistory.tsx under the rate list', ac: ['4.1.3', '4.3.2'] },
  checked: { label: 'Checked by our team', section: 'events', where: 'history/evidence.ts AREA_KINDS: the events section of the screens/FloodMap.tsx area panel', ac: ['4.2.2', '4.3.4'] },
} as const satisfies Record<
  string,
  { label: string; section: SourceSectionId | null; where: string; ac: readonly string[] }
>;

export type SourceLinkId = keyof typeof SOURCE_LINKS;

/** The DOM id a section is rendered under, so a link can scroll to it. */
export const sectionAnchor = (id: SourceSectionId): string => `about-data-${id}`;
