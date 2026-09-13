/**
 * Verified flood events, US 4.2.
 *
 * **Everything else on the flood map is counted by a script; these are
 * sentences a person wrote about a real flood.** So "verified" has to be a
 * claim about a process the file can show, not about its shape: an event is
 * drafted from named sources, and it reaches the screen only once a team
 * member has checked it and put their name and the date on it (AC 4.2.2.a).
 * A drafted event is kept in the file, visible in review, and filtered out
 * here — the filter is the process, which is why it lives in the loader and
 * not in the component that draws the list.
 *
 * The guard refuses a malformed file outright. The filter does not refuse an
 * unchecked event; waiting for a check is the normal state of a new event.
 */

export class EventDataError extends Error {
  override readonly name = 'EventDataError';
}

function fail(what: string): never {
  throw new EventDataError(`the flood events ${what}`);
}

export interface EventSource {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  /** When the source was last read against the summary, YYYY-MM-DD. */
  readonly accessed: string;
}

export interface FloodEvent {
  readonly id: string;
  readonly name: string;
  /** YYYY-MM-DD, or YYYY-MM where the sources give only the month. */
  readonly date: string;
  /** The places as the sources name them. */
  readonly places: readonly string[];
  /** The statistical areas those places are in, by the map's own codes. */
  readonly areas: readonly { readonly code: string; readonly name: string }[];
  readonly summary: string;
  readonly sources: readonly EventSource[];
  readonly draftedOn: string;
  readonly checkedBy: string | null;
  readonly checkedOn: string | null;
}

export interface EventsArtefact {
  readonly artefact: 'flood-events';
  readonly note: string;
  readonly process: string;
  readonly events: readonly FloodEvent[];
}

/** Two sources, so no event rests on one account of it (AC 4.2.2.b). */
export const MINIMUM_SOURCES = 2;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_OR_MONTH = /^\d{4}-\d{2}(-\d{2})?$/;

const words = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

export function assertEvents(value: unknown): asserts value is EventsArtefact {
  const a = value as Partial<EventsArtefact> | null;
  if (a === null || typeof a !== 'object') fail('are not an object');
  if (a.artefact !== 'flood-events') fail(`are ${String(a.artefact)}, not flood-events`);
  if (!words(a.note)) fail('do not say what the list is and is not');
  if (!words(a.process)) fail('do not say how an event is checked');
  if (!Array.isArray(a.events)) fail('carry no list of events');
  const ids = new Set<string>();
  for (const raw of a.events as unknown[]) {
    const event = (raw ?? {}) as Partial<FloodEvent>;
    if (!words(event.id)) fail('include an event with no id');
    const label = event.id;
    if (ids.has(event.id)) fail(`include ${event.id} twice`);
    ids.add(event.id);
    if (!words(event.name)) fail(`give ${label} no name`);
    if (typeof event.date !== 'string' || !DAY_OR_MONTH.test(event.date)) {
      fail(`give ${label} the date ${String(event.date)}, which is not YYYY-MM-DD or YYYY-MM`);
    }
    if (!Array.isArray(event.places) || event.places.length === 0 || !event.places.every(words)) {
      fail(`name no places for ${label}`);
    }
    if (
      !Array.isArray(event.areas) ||
      event.areas.length === 0 ||
      !(event.areas as readonly Partial<FloodEvent['areas'][number]>[]).every((area) => typeof area.code === 'string' && /^\d{9}$/.test(area.code) && words(area.name))
    ) {
      fail(`do not identify the areas of ${label} by ASGS code and name`);
    }
    if (!words(event.summary)) fail(`give ${label} no summary`);
    if (!Array.isArray(event.sources) || event.sources.length < MINIMUM_SOURCES) {
      fail(`give ${label} fewer than ${String(MINIMUM_SOURCES)} sources`);
    }
    for (const source of event.sources as readonly Partial<EventSource>[]) {
      if (!words(source.title) || !words(source.publisher)) fail(`give ${label} a source with no title or publisher`);
      if (typeof source.url !== 'string' || !source.url.startsWith('https://')) {
        fail(`give ${label} a source that is not an https link`);
      }
      if (typeof source.accessed !== 'string' || !DAY.test(source.accessed)) {
        fail(`do not say when a source of ${label} was read`);
      }
    }
    if (typeof event.draftedOn !== 'string' || !DAY.test(event.draftedOn)) fail(`do not say when ${label} was drafted`);
    // Both or neither: a name with no date, or a date with no name, is a check
    // nobody can stand behind.
    const checked = (event.checkedBy ?? null) !== null || (event.checkedOn ?? null) !== null;
    if (checked && (!words(event.checkedBy) || typeof event.checkedOn !== 'string' || !DAY.test(event.checkedOn))) {
      fail(`record half a check on ${label}: checkedBy and checkedOn are filled in together`);
    }
    if (checked && (event.checkedOn as string) < event.draftedOn) fail(`say ${label} was checked before it was drafted`);
  }
}

/** Only the events a team member has checked (AC 4.2.2.a). */
export function verifiedEvents(artefact: EventsArtefact): readonly FloodEvent[] {
  return artefact.events.filter((event) => words(event.checkedBy) && typeof event.checkedOn === 'string');
}

/** The verified events associated with one area, newest first. */
export function eventsFor(events: readonly FloodEvent[], code: string): readonly FloodEvent[] {
  return events.filter((event) => event.areas.some((area) => area.code === code)).sort((a, b) => b.date.localeCompare(a.date));
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "6 March 2010", or "October 2022" when only the month is known. */
export function eventDate(date: string): string {
  const [year, month, day] = date.split('-');
  const name = MONTHS[Number(month) - 1] ?? '';
  return day === undefined ? `${name} ${year ?? ''}` : `${String(Number(day))} ${name} ${year ?? ''}`;
}

/**
 * How the event sits against the dispatch counts shown above it.
 *
 * Without this the two read as one record: an event beside a bar chart looks
 * like the bars it happened in. The counts are dispatches classed as Flood,
 * and a storm's flash flooding is mostly recorded under storms, so even an
 * event inside the period cannot be matched to a bar.
 */
export function againstRecord(event: FloodEvent, period: { readonly start: string; readonly end: string }): string {
  const month = event.date.slice(0, 7);
  if (month > period.end.slice(0, 7)) {
    return `This happened after the SES record on this map ends (${period.end}), so none of it is in the counts above.`;
  }
  if (month < period.start.slice(0, 7)) {
    return `This happened before the SES record on this map begins (${period.start}), so none of it is in the counts above.`;
  }
  return 'This falls inside the SES record on this map, but the counts above do not say which dispatches, if any, belong to it.';
}

/** AC 4.2.3 a–c: an area with no verified event. */
export function noEventsText(areaName: string): string {
  return `No verified flood event is currently available for ${areaName} in the DrainLens record. That does not mean flooding has never occurred here: the list is a short set of events the team has checked against sources, not a complete record of historical flooding. The recorded activity and Severity Score above still apply.`;
}

/** AC 4.2.3.c, under a list that is not empty. */
export const NOT_COMPLETE =
  'These are the events the team has checked against sources. They are not a complete record of flooding in this area.';

/** The events file failed to load: say that, rather than showing the empty state. */
export const EVENTS_UNAVAILABLE =
  'The verified flood events could not be loaded, so none are shown. That is a problem loading the list, not a statement about this area.';
