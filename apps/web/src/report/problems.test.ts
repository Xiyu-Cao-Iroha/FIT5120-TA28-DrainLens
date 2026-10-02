/**
 * The five problem types, the channels behind them, and the four promises
 * AC 6.3.2 forbids making.
 *
 * Most of this file is about what the reporting pathway must *not* say. The
 * channels are easy to check by eye; a response time that crept in from a
 * council page, or an organisation named for a problem the reader never
 * chose, reads perfectly well and is the thing the criteria rule out.
 */

import { describe, expect, it } from 'vitest';

import { CHANNELS, COUNCIL_URGENT, TRIPLE_ZERO, VICSES, channelLine } from './channels.js';
import {
  EMERGENCY_CHECKLIST_LATER,
  EMERGENCY_FIRST,
  EMERGENCY_SAFETY,
  NOT_SUBMITTED,
  NO_DRAIN_NEEDED,
  PREPARE,
  PROBLEM_TYPES,
  problemFor,
  selectedDrainLine,
} from './problems.js';

describe('the five problem types', () => {
  it('offers exactly the five the criterion names', () => {
    expect(PROBLEM_TYPES.map((type) => type.label)).toEqual([
      'Blocked or flooded street drain',
      'Damaged or missing grate',
      'Private property',
      'Regional drain or waterway',
      'Flood or storm emergency',
    ]);
  });

  it('sends each one to an organisation that holds that kind of problem', () => {
    expect(problemFor('blocked-drain').channels[0]?.organisation).toBe('City of Melbourne');
    expect(problemFor('waterway').channels[0]?.organisation).toBe('Melbourne Water');
    expect(problemFor('private-property').channels[0]?.organisation).toBe('A licensed plumber');
  });

  it('marks only the emergency as urgent', () => {
    expect(PROBLEM_TYPES.filter((type) => type.urgent).map((type) => type.id)).toEqual([
      'emergency',
    ]);
  });
});

describe('what the pathway refuses to say', () => {
  const everything = [
    ...PROBLEM_TYPES.flatMap((type) => [type.label, type.describes, type.because]),
    ...CHANNELS.map(channelLine),
    ...PREPARE,
    NOT_SUBMITTED,
    NO_DRAIN_NEEDED,
    EMERGENCY_FIRST,
    EMERGENCY_SAFETY,
    EMERGENCY_CHECKLIST_LATER,
  ].join('\n');

  it('states no response time', () => {
    // Three of the four pages publish one. Repeating it would be this project
    // making a promise on another organisation's behalf (AC 6.3.2).
    expect(everything).not.toMatch(/business day|within \d|\d+ (hours|days)|response time/i);
  });

  it('states no outcome and no repair', () => {
    expect(everything).not.toMatch(/will be (fixed|repaired|cleared|resolved)|we will (fix|repair)/i);
  });

  it('says plainly that the report is not sent', () => {
    expect(NOT_SUBMITTED).toMatch(/does not send it/);
  });

  it('says a drain is optional and never chosen for the reader', () => {
    expect(NO_DRAIN_NEEDED).toMatch(/Nothing is chosen for you/);
  });
});

describe('the drain a reader may add', () => {
  it('labels it as the one they selected, with its identifier', () => {
    expect(selectedDrainLine('PIT-12345')).toBe('Selected recorded drain: PIT-12345');
  });
});

describe('the emergency branch', () => {
  it('puts the two numbers before anything else', () => {
    expect(EMERGENCY_FIRST.indexOf('000')).toBeLessThan(EMERGENCY_FIRST.indexOf('132 500'));
    expect(problemFor('emergency').channels[0]).toBe(TRIPLE_ZERO);
    expect(problemFor('emergency').channels[1]).toBe(VICSES);
  });

  it('keeps the checklist out of the primary position', () => {
    expect(EMERGENCY_CHECKLIST_LATER).toMatch(/^Once everyone is safe/);
  });

  it('advises against floodwater and against approaching drains', () => {
    expect(EMERGENCY_SAFETY).toMatch(/Never enter floodwater/);
    expect(EMERGENCY_SAFETY).toMatch(/do not approach drains/);
  });
});

describe('the register behind the channels', () => {
  it('carries a quote, a publisher, a page and a date for every one', () => {
    for (const channel of CHANNELS) {
      expect(channel.quote.length).toBeGreaterThan(20);
      expect(channel.publisher).not.toBe('');
      expect(channel.page).toMatch(/^https:\/\//);
      expect(channel.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('reads as one line with the number where there is one', () => {
    expect(channelLine(COUNCIL_URGENT)).toBe(
      'City of Melbourne · Call straight away if there is danger to the public on 03 9658 9658',
    );
  });
});
