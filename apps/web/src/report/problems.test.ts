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
import { type PickedDrain, NO_PLACE, SELECTED_DRAIN, placeLine } from './place.js';
import {
  EMERGENCY_CALLS,
  EMERGENCY_SAFETY,
  EMERGENCY_WARNINGS,
  NOT_SENT_YET,
  NOT_SUBMITTED,
  PROBLEM_TYPES,
  problemFor,
  whatToInclude,
} from './problems.js';

const drain = (assetNumber: string): PickedDrain => ({
  kind: 'drain',
  assetNumber,
  street: null,
  distanceM: 20,
});

describe('the five problem types', () => {
  it('offers exactly the five the design labels, emergency first', () => {
    // Figma B3. AC 6.3.4 asks for the emergency to come first; a list that
    // reads drain, grate, property, creek, emergency buries the one that
    // cannot wait under four that can.
    expect(PROBLEM_TYPES.map((type) => type.label)).toEqual([
      'Flood or storm emergency',
      'Blocked or flooded street drain',
      'Damaged or missing drain grate',
      'Drainage problem on my property',
      'Problem with a creek or main drain',
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
    ...PROBLEM_TYPES.flatMap((type) => [type.label, type.because]),
    ...CHANNELS.map(channelLine),
    ...whatToInclude('46 Gatehouse Drive, Kensington', drain('PIT-1')).map(
      (item) => `${item.title} ${item.detail}`,
    ),
    NOT_SUBMITTED,
    NOT_SENT_YET,
    NO_PLACE,
    ...EMERGENCY_SAFETY,
    EMERGENCY_WARNINGS,
  ].join('\n');

  it('states no response time', () => {
    // Three of the four pages publish one. Repeating it would be this project
    // making a promise on another organisation's behalf (AC 6.3.2).
    expect(everything).not.toMatch(/business day|within \d|\d+ (hours|days)|response time/i);
  });

  it('states no outcome and no repair', () => {
    expect(everything).not.toMatch(/will be (fixed|repaired|cleared|resolved)|we will (fix|repair)/i);
  });

  it('says plainly that the report is not sent, on both screens', () => {
    expect(NOT_SENT_YET).toMatch(/does not send it for you/);
    expect(NOT_SUBMITTED).toMatch(/does not send this report/);
    expect(NOT_SUBMITTED).toMatch(/Nothing leaves your browser/);
  });
});

describe('what to include', () => {
  it('fills the location in from the address, which is what they will be asked first', () => {
    const items = whatToInclude('46 Gatehouse Drive, Kensington', null);
    expect(items.map((item) => item.title)).toEqual(['Location', 'When', 'Photos', 'Which drain']);
    expect(items[0]?.detail).toBe('46 Gatehouse Drive, Kensington');
  });

  it('asks for the location in words where there is no address', () => {
    expect(whatToInclude(null, null)[0]?.detail).toMatch(/street address or nearest cross street/);
  });

  it('names a drain only where the reader selected one', () => {
    expect(whatToInclude(null, drain('PIT-9001'))[3]?.detail).toBe(
      'Selected recorded drain: PIT-9001',
    );
    expect(whatToInclude(null, null)[3]?.detail).toBe(NO_PLACE);
    expect(NO_PLACE).toMatch(/Nothing is chosen for you/);
  });

  it('labels the drain as the one they selected, with its identifier', () => {
    // AC 6.3.2 asks for both words and the number.
    expect(placeLine(drain('PIT-12345'))).toBe(`${SELECTED_DRAIN}: PIT-12345`);
  });

  it('turns a pinned point into the sentence that makes it findable', () => {
    const pinned = placeLine({
      kind: 'pin',
      note: 'Outside number 50, near the corner',
      at: { eastingM: 316500, northingM: 5814500 },
    });
    expect(pinned).toBe('Pinned on the map · Outside number 50, near the corner');
    expect(whatToInclude(null, { kind: 'pin', note: 'x', at: { eastingM: 1, northingM: 2 } })[3]?.title).toBe(
      'Drain location',
    );
  });
});

describe('the emergency branch', () => {
  it('puts the two numbers before anything else, Triple Zero first', () => {
    expect(EMERGENCY_CALLS.map((call) => call.label)).toEqual([
      'Call 000',
      'Call VICSES 132 500',
    ]);
    expect(EMERGENCY_CALLS[0]?.first).toBe(true);
    expect(problemFor('emergency').channels[0]).toBe(TRIPLE_ZERO);
    expect(problemFor('emergency').channels[1]).toBe(VICSES);
  });

  it('says what each number is for, so the choice needs no thinking', () => {
    expect(EMERGENCY_CALLS[0]?.when).toBe('If life is in danger');
    expect(EMERGENCY_CALLS[1]?.when).toBe('For flood and storm help');
  });

  it('advises against floodwater and against approaching drains', () => {
    expect(EMERGENCY_SAFETY[0]).toMatch(/Never walk or drive into floodwater/);
    expect(EMERGENCY_SAFETY[1]).toMatch(/Do not go near or clear drains/);
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
