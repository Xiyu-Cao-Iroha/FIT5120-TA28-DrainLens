/**
 * What the reader's copy holds (AC 6.3.3), and what it leaves out.
 *
 * Short enough to read out over the telephone, because three of the five
 * channels are a telephone call, and carrying only what the reader chose: a
 * drain line names one if they picked it on the map and says so otherwise.
 *
 * **The house number is the thing it must not hold.** That is the team's
 * instruction of 10 October and the assertions for it are first, because a
 * change that quietly puts it back would otherwise only be caught by
 * somebody reading a printout.
 */

import { describe, expect, it } from 'vitest';

import type { ReportPlace } from './place.js';
import { problemFor } from './problems.js';
import {
  NO_ADDRESS,
  PHOTOS_ATTACH,
  type ReportWhere,
  reportSummary,
  summaryHtml,
  summaryText,
  whereLine,
} from './summary.js';

const ON = new Date(2026, 9, 3);
const WHERE: ReportWhere = {
  street: 'Gatehouse Drive',
  suburb: 'Kensington',
  area: 'Maribyrnong River (Lower)',
};
const drain = (...assetNumbers: readonly string[]): ReportPlace => ({
  kind: 'drain',
  drains: assetNumbers.map((assetNumber) => ({ assetNumber, street: null, distanceM: 20 })),
});
const summary = (
  place: ReportPlace = null,
  id: 'blocked-drain' | 'emergency' = 'blocked-drain',
  where: ReportWhere = WHERE,
) => reportSummary(where, problemFor(id), place, ON);

/** Every string the summary can put in front of a council officer. */
const everything = (where: ReportWhere = WHERE, place: ReportPlace = null): string =>
  [summaryText(summary(place, 'blocked-drain', where)), summaryHtml(summary(place, 'blocked-drain', where))].join(
    '\n',
  );

describe('the house number never leaves', () => {
  it('is not in the text, the page, or any field', () => {
    // The number is not even an input: `ReportWhere` has no field for it,
    // which is the point. This guards the two renderers against a future
    // one being handed a full label by a caller that still has it.
    const text = everything();
    expect(text).not.toMatch(/\b46\b/);
    expect(text).toContain('Gatehouse Drive, Kensington');
  });

  it('keeps the street and the suburb together, and the suburb optional', () => {
    expect(whereLine('Gatehouse Drive', 'Kensington')).toBe('Gatehouse Drive, Kensington');
    expect(whereLine('Lorimer Street', null)).toBe('Lorimer Street');
    expect(whereLine('Lorimer Street', '')).toBe('Lorimer Street');
  });

  it('says so rather than printing an empty line when there is no street', () => {
    expect(whereLine(null, 'Kensington')).toBe(NO_ADDRESS);
    expect(whereLine('  ', 'Kensington')).toBe(NO_ADDRESS);
    expect(everything({ street: null, suburb: null, area: null })).toContain(NO_ADDRESS);
  });
});

describe('what the summary holds', () => {
  it('shows the fields in the order the team listed them', () => {
    expect(summary().fields.map((field) => field.id)).toEqual([
      'when',
      'where',
      'area',
      'drain',
      'problem',
      'photos',
    ]);
  });

  it('fills in what the product already knows', () => {
    const by = Object.fromEntries(summary(drain('PIT-1')).fields.map((f) => [f.id, f.value]));
    expect(by.when).toMatch(/^Prepared on /);
    expect(by.where).toBe('Gatehouse Drive, Kensington');
    expect(by.area).toBe('Maribyrnong River (Lower)');
    expect(by.problem).toBe('Blocked or flooded street drain');
    expect(by.drain).toContain('PIT-1');
  });

  it('says the drainage area is not recorded rather than leaving it blank', () => {
    // AC 6.1.5: an address no recorded area contains says so, and is never
    // given a neighbour's.
    const none = summary(null, 'blocked-drain', { ...WHERE, area: null });
    expect(none.fields.find((f) => f.id === 'area')?.value).toBe('Not recorded for this street');
  });

  it('tells the reader the photographs are theirs to attach', () => {
    const photos = summary().fields.find((field) => field.id === 'photos');
    expect(photos?.note).toBe(PHOTOS_ATTACH);
    expect(summaryText(summary())).toContain(PHOTOS_ATTACH);
  });

  it('no longer claims the copy is kept by nobody', () => {
    // Removed on 10 October: the line was true and it was the last thing on
    // the page, under a report the reader is about to send to a council.
    expect(everything()).not.toMatch(/keeps nothing once you close this tab/);
  });

  it('holds who to contact, the first one first', () => {
    expect(summary().contacts[0]).toContain('City of Melbourne');
    expect(summary(null, 'emergency').contacts[0]).toContain('000');
  });
});

describe('the drain, which is the reader’s to add', () => {
  it('names it only where one was selected', () => {
    const picked = summary(drain('PIT-1')).fields.find((f) => f.id === 'drain');
    expect(picked?.value).toContain('PIT-1');

    const none = summary().fields.find((f) => f.id === 'drain');
    expect(none?.value).not.toContain('PIT-');
  });

  it('names every one of several', () => {
    const value = summary(drain('PIT-1', 'PIT-2')).fields.find((f) => f.id === 'drain')?.value ?? '';
    expect(value).toContain('PIT-1');
    expect(value).toContain('PIT-2');
  });
});

describe('the two ways it leaves the screen', () => {
  it('reads as plain text for the clipboard', () => {
    const text = summaryText(summary(drain('PIT-1')));
    expect(text.startsWith('Report a problem')).toBe(true);
    expect(text).toContain('Street: Gatehouse Drive, Kensington');
    expect(text).toContain('Who to contact:');
  });

  it('prints as one self-contained page with no fetch to make', () => {
    const html = summaryHtml(summary(drain('PIT-1')));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<(script|img|link)\b/);
    expect(html).not.toMatch(/https?:\/\/(?!www\.openstreetmap)/);
  });

  it('escapes what it prints, because a street name is somebody else’s text', () => {
    const html = summaryHtml(
      summary(null, 'blocked-drain', { ...WHERE, street: 'O<script>alert(1)</script> Street' }),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('a pinned place, which is a point as well as a sentence', () => {
  const pinned = (note: string) =>
    reportSummary(
      WHERE,
      problemFor('blocked-drain'),
      { kind: 'pin', note, at: { eastingM: 316500, northingM: 5814500 } },
      ON,
    );

  it('carries the words that make it findable', () => {
    const value = pinned('Outside number 50, near the corner').fields.find((f) => f.id === 'drain')?.value;
    expect(value).toBe('Pinned on the map · Outside number 50, near the corner');
  });

  it('carries a map link the reader can send on, built here', () => {
    // Figma B4d says the copied text includes it. AC 6.3.3: generated
    // locally, into their own clipboard, and requested from nobody.
    const text = summaryText(pinned('by the corner'));
    expect(text).toMatch(/Map link: https:\/\/www\.openstreetmap\.org\/\?mlat=-37\.798/);
  });

  it('adds no link where nothing was pinned', () => {
    expect(summaryText(summary())).not.toMatch(/Map link/);
    expect(summaryText(summary(drain('PIT-1')))).not.toMatch(/Map link/);
  });
});
