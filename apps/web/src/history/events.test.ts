/**
 * Verified flood events, checked against AC 4.2.1 to 4.2.3.
 *
 * The published file is read as well as fixtures: the guard is only worth
 * something if the file the site ships passes it, and the filter is only the
 * process if an unchecked event in that file stays off the screen.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EVENTS_UNAVAILABLE,
  EventDataError,
  type EventsArtefact,
  type FloodEvent,
  MINIMUM_SOURCES,
  NOT_COMPLETE,
  againstRecord,
  assertEvents,
  eventDate,
  eventsFor,
  NO_EVENTS,
  NO_EVENTS_TIP,
  verifiedEvents,
} from './events.js';
import type { ScopeAreas } from './severity.js';

const DATA = path.resolve(__dirname, '../../public/data');
const read = (name: string): unknown => JSON.parse(readFileSync(path.join(DATA, name), 'utf8'));

const event = (over: Partial<FloodEvent> = {}): FloodEvent => ({
  id: 'e1',
  name: 'A flood',
  date: '2011-02-04',
  places: ['Oakleigh'],
  areas: [{ code: '212051326', name: 'Oakleigh - Huntingdale' }],
  summary: 'It flooded.',
  sources: [
    { title: 'One', publisher: 'A', url: 'https://a.example/1', accessed: '2026-09-13' },
    { title: 'Two', publisher: 'B', url: 'https://b.example/2', accessed: '2026-09-13' },
  ],
  draftedOn: '2026-09-13',
  checkedBy: 'A teammate',
  checkedOn: '2026-09-14',
  ...over,
});

const file = (...events: FloodEvent[]): EventsArtefact => ({
  artefact: 'flood-events',
  note: 'Not a complete record.',
  process: 'Checked by a second person.',
  events,
});

const refuses = (value: unknown, message: RegExp) => {
  expect(() => {
    assertEvents(value);
  }).toThrow(EventDataError);
  expect(() => {
    assertEvents(value);
  }).toThrow(message);
};

describe('the published events file', () => {
  const published = read('flood-events.json');
  const scope = read('sa2-areas.json') as ScopeAreas;
  const names = new Map(scope.areas.map((area) => [area.code, area.name]));

  it('passes the guard', () => {
    assertEvents(published);
  });

  it('gives every event its name, date, places, summary and sources (4.2.1, 4.2.2.b)', () => {
    assertEvents(published);
    expect(published.events.length).toBeGreaterThanOrEqual(3);
    for (const e of published.events) {
      expect(e.sources.length).toBeGreaterThanOrEqual(MINIMUM_SOURCES);
      expect(e.summary.length).toBeGreaterThan(80);
    }
  });

  it('names each area by a code and name the map has (4.2.2.c)', () => {
    assertEvents(published);
    for (const e of published.events) {
      for (const area of e.areas) expect(names.get(area.code)).toBe(area.name);
    }
  });

  it('shows only the events that carry a check', () => {
    assertEvents(published);
    const shown = verifiedEvents(published);
    expect(shown.every((e) => e.checkedBy !== null && e.checkedOn !== null)).toBe(true);
    expect(shown.length).toBe(published.events.filter((e) => e.checkedBy !== null).length);
  });
});

describe('the guard', () => {
  it('accepts a checked and an unchecked event', () => {
    assertEvents(file(event(), event({ id: 'e2', checkedBy: null, checkedOn: null })));
  });

  it('refuses the wrong artefact, a missing note and a missing process', () => {
    refuses(null, /not an object/);
    refuses({ ...file(), artefact: 'sa2-areas' }, /not flood-events/);
    refuses({ ...file(), note: '' }, /what the list is/);
    refuses({ ...file(), process: ' ' }, /how an event is checked/);
    refuses({ ...file(), events: undefined }, /no list of events/);
  });

  it('refuses an event missing any part 4.2.1 asks for', () => {
    refuses(file(event({ id: '' })), /no id/);
    refuses(file(event(), event()), /e1 twice/);
    refuses(file(event({ name: '' })), /no name/);
    refuses(file(event({ date: '4 February 2011' })), /not YYYY-MM-DD or YYYY-MM/);
    refuses(file(event({ places: [] })), /no places/);
    refuses(file(event({ areas: [{ code: '2120', name: 'Oakleigh' }] })), /ASGS code and name/);
    refuses(file(event({ summary: '' })), /no summary/);
  });

  it('refuses fewer than two sources, a source with no title, and a link that is not https', () => {
    const [first, second] = event().sources;
    refuses(file(event({ sources: [first!] })), /fewer than 2 sources/);
    refuses(file(event({ sources: [first!, { ...second!, title: '' }] })), /no title or publisher/);
    refuses(file(event({ sources: [first!, { ...second!, url: 'http://b.example/2' }] })), /not an https link/);
    refuses(file(event({ sources: [first!, { ...second!, accessed: 'yesterday' }] })), /was read/);
    refuses(file(event({ draftedOn: '' })), /was drafted/);
  });

  it('refuses half a check, and a check dated before the draft', () => {
    refuses(file(event({ checkedOn: null })), /filled in together/);
    refuses(file(event({ checkedBy: null })), /filled in together/);
    refuses(file(event({ checkedBy: ' ' })), /filled in together/);
    refuses(file(event({ checkedOn: '2026-09-01' })), /checked before it was drafted/);
  });
});

describe('what is shown', () => {
  const unchecked = event({ id: 'draft', checkedBy: null, checkedOn: null });
  const older = event({ id: 'older', date: '2010-03-06' });
  const newer = event({ id: 'newer', date: '2022-10' });

  it('leaves an unchecked event out (4.2.2.a)', () => {
    expect(verifiedEvents(file(unchecked, older)).map((e) => e.id)).toEqual(['older']);
  });

  it('finds the events of one area, newest first, and none for another', () => {
    const shown = verifiedEvents(file(older, newer));
    expect(eventsFor(shown, '212051326').map((e) => e.id)).toEqual(['newer', 'older']);
    expect(eventsFor(shown, '206011105')).toEqual([]);
  });

  it('writes the date to the precision the sources give', () => {
    expect(eventDate('2010-03-06')).toBe('6 March 2010');
    expect(eventDate('2022-10')).toBe('October 2022');
  });

  it('says how an event sits against the dispatch record', () => {
    const period = { start: '2009-07-01', end: '2015-06-30' };
    expect(againstRecord(newer, period)).toMatch(/after the SES record on this map ends \(2015-06-30\)/);
    expect(againstRecord(event({ date: '2005-01' }), period)).toMatch(/before the SES record/);
    expect(againstRecord(older, period)).toMatch(/do not say which emergency responses, if any, belong to it/);
  });

  it('handles an area with no verified event as 4.2.3 asks', () => {
    // Copy audit v4, #89: one line, and the ⓘ says no event is not no flooding.
    expect(NO_EVENTS).toBe('No checked flood events yet.');
    expect(NO_EVENTS_TIP).toBe('This does not mean the area has never flooded.');
    expect(`${NO_EVENTS} ${NO_EVENTS_TIP}`).not.toMatch(/Severity|score/);
    expect(NOT_COMPLETE).toMatch(/not a complete record/);
    expect(EVENTS_UNAVAILABLE).toMatch(/not a statement about this area/);
  });
});
