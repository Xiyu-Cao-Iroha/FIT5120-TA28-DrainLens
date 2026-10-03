/**
 * What the reader's copy holds (AC 6.3.3), and what it leaves out.
 *
 * Short enough to read out over the telephone, because three of the five
 * channels are a telephone call, and carrying only what the reader chose: a
 * drain line appears if they picked one on the map and not otherwise.
 */

import { describe, expect, it } from 'vitest';

import { problemFor, whatToInclude } from './problems.js';
import type { ReportPlace } from './place.js';
import { NO_ADDRESS, YOURS_TO_KEEP, reportSummary, summaryHtml, summaryText } from './summary.js';

const ON = new Date(2026, 9, 3);
const ADDRESS = '46 Gatehouse Drive, Kensington';
const drain = (assetNumber: string): ReportPlace => ({
  kind: 'drain',
  assetNumber,
  street: null,
  distanceM: 20,
});
const summary = (place: ReportPlace = null, id: 'blocked-drain' | 'emergency' = 'blocked-drain') =>
  reportSummary(ADDRESS, problemFor(id), place, ON);

describe('what the summary holds', () => {
  it('holds the address, the day, the problem and who to contact', () => {
    const made = summary();
    expect(made.address).toBe(ADDRESS);
    expect(made.preparedOn).toBe('Prepared on 3 October 2026');
    expect(made.problem).toBe('Blocked or flooded street drain');
    expect(made.contacts[0]).toMatch(/^City of Melbourne/);
  });

  it('holds the checklist, in the order the reader will use it', () => {
    expect(summary().checklist).toEqual(
      whatToInclude(ADDRESS, null).map((item) => `${item.title}: ${item.detail}`),
    );
    expect(summary().checklist[0]).toBe(`Location: ${ADDRESS}`);
  });

  it('says the copy is the reader’s and that nothing is kept', () => {
    expect(summary().keepLine).toBe(YOURS_TO_KEEP);
    expect(YOURS_TO_KEEP).toMatch(/keeps nothing/);
  });
});

describe('reading the map without an address', () => {
  it('says so rather than printing an empty line', () => {
    // The full map can be read without one, and a blank field on paper reads
    // as something somebody forgot to fill in.
    expect(reportSummary(null, problemFor('waterway'), null, ON).address).toBe(NO_ADDRESS);
    expect(reportSummary('', problemFor('waterway'), null, ON).address).toBe(NO_ADDRESS);
    expect(NO_ADDRESS).toMatch(/Give the location when you contact them/);
  });
});

describe('the drain, which is the reader’s to add', () => {
  it('names it only where one was selected', () => {
    expect(summary(drain('PIT-9001')).checklist).toContain('Which drain: Selected recorded drain: PIT-9001');
    expect(summaryText(summary())).not.toMatch(/Selected recorded drain/);
    expect(summaryText(summary())).toMatch(/Which drain: Not chosen/);
  });
});

describe('the two ways it leaves the screen', () => {
  it('reads as plain text for the clipboard', () => {
    const text = summaryText(summary(drain('PIT-9001')));
    expect(text.startsWith('Report a problem\n46 Gatehouse Drive, Kensington')).toBe(true);
    expect(text).toContain('Problem: Blocked or flooded street drain');
    expect(text).toContain('- Which drain: Selected recorded drain: PIT-9001');
    expect(text).not.toMatch(/<[a-z]/);
  });

  it('prints as one self-contained page with no fetch to make', () => {
    const page = summaryHtml(summary(null, 'emergency'));
    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(page).not.toMatch(/<link|<script|src=/);
    expect(page).toContain('Flood or storm emergency');
    expect(page).toContain('000');
    // The printed copy still carries the two numbers, because it is the thing
    // a reader may be holding when the screen is not in front of them.
    expect(page).toContain('132 500');
  });
});

describe('a pinned place, which is a point as well as a sentence', () => {
  const pinned = (note: string) =>
    reportSummary(ADDRESS, problemFor('blocked-drain'), {
      kind: 'pin',
      note,
      at: { eastingM: 316500, northingM: 5814500 },
    }, ON);

  it('carries the words that make it findable', () => {
    expect(pinned('Outside number 50, near the corner').checklist).toContain(
      'Drain location: Pinned on the map · Outside number 50, near the corner',
    );
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
