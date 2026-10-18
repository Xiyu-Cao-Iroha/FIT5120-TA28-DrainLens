/**
 * What the printed plan holds, clause by clause.
 *
 * The acceptance file names this one as a rule a test has to hold rather than
 * a walkthrough: the page is generated once, read later, and the failures are
 * all omissions — a reminder for a place the reader said did not apply, a
 * reviewed count carried over from the screen, a missing telephone number.
 * None of those would stop the page printing.
 */

import { describe, expect, it } from 'vitest';

import { GENERAL_ACTIONS, SAFETY } from './actions.js';
import { KEEP_LINE, escapeHtml, planHtml, printedDate, printedPlan } from './printable.js';
import { placesNear } from './places.js';
import type { WarningPoint } from '../map/warnings.js';

const marker = (e: number, n: number): WarningPoint => ({ c: [e, n], depthM: 1.4, areaM2: 300 });
const HOME: [number, number] = [500, 500];
const PLACES = placesNear(HOME, [marker(520, 500), marker(560, 500), marker(600, 500)]);
const ON = new Date(2026, 9, 3);
const ADDRESS = '46 Gatehouse Drive, Kensington';

const plan = (
  relevance: Record<number, 'applies' | 'does-not-apply' | null>,
  ticked: readonly string[] = [],
) => printedPlan(ADDRESS, PLACES, relevance, new Set(ticked), ON);

describe('what the page says it is', () => {
  it('names the address and the day it was printed', () => {
    const page = plan({});
    expect(page.address).toBe(ADDRESS);
    // Figma A5 puts the address and the date on one line under the title.
    expect(page.preparedOn).toBe(`${ADDRESS} · Made on 3 October 2026`);
  });

  it('writes the month out, because a printed date outlives its reader', () => {
    expect(printedDate(new Date(2027, 0, 11))).toBe('11 January 2027');
  });

  it('says the copy is the reader’s to keep, and does not keep itself current', () => {
    expect(plan({}).keepLine).toBe(KEEP_LINE);
    expect(KEEP_LINE).toMatch(/does not update/);
  });
});

describe('which reminders reach the page', () => {
  it('takes only the places marked as applying', () => {
    const page = plan({ 1: 'applies', 2: 'does-not-apply', 3: null });
    expect(page.reminders.map((line) => line.text)).toEqual([
      'When heavy rain is forecast: move your car or bins from Place 1.',
    ]);
  });

  it('keeps Estimated by DrainLens on each reminder', () => {
    const page = plan({ 1: 'applies' });
    expect(page.reminders[0]?.source).toMatch(/Estimated by DrainLens/);
  });

  it('leaves the section out where no place applies', () => {
    const page = plan({ 1: 'does-not-apply', 2: null });
    expect(page.reminders).toEqual([]);
    expect(planHtml(page)).not.toContain('When heavy rain is forecast');
  });

  it('never prints a place’s status or the reviewed count', () => {
    const printed = planHtml(plan({ 1: 'applies', 2: 'does-not-apply', 3: null }));
    expect(printed).not.toMatch(/Not reviewed/);
    expect(printed).not.toMatch(/Doesn.t apply/);
    expect(printed).not.toMatch(/reviewed/i);
  });
});

describe('what every page holds, whatever was answered', () => {
  const printed = planHtml(plan({}));

  it('holds the general actions and who published them', () => {
    for (const action of GENERAL_ACTIONS) expect(printed).toContain(escapeHtml(action.text));
    expect(printed).toContain('Victoria State Emergency Service');
  });

  it('holds the safety boundary in full, telephone numbers included', () => {
    for (const sentence of SAFETY) expect(printed).toContain(escapeHtml(sentence));
    expect(printed).toContain('132 500');
    expect(printed).toContain('000');
  });

  it('writes the sources as text, so a printed page can still be followed', () => {
    expect(printed).toContain('https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/storm');
    expect(printed).toContain('https://emergency.vic.gov.au/respond/');
  });

  it('carries no control: nothing on paper can be pressed', () => {
    expect(printed).not.toMatch(/<button|<a |Reset|Show on map/);
  });
});

describe('the document itself', () => {
  it('is one self-contained page, with no fetch to make', () => {
    const printed = planHtml(plan({ 1: 'applies' }));
    expect(printed.startsWith('<!doctype html>')).toBe(true);
    expect(printed).not.toMatch(/<link|<script|src=/);
  });

  it('carries only the general actions that were ticked', () => {
    // Reported on 8 October: the page listed all three however the boxes
    // were left. The rule is the one the places already follow -- what the
    // reader chose is what the page they take away carries.
    // Read from the register rather than written out, so a change to the
    // actions is a change to what this test ticks rather than a failure.
    const [first, , third] = GENERAL_ACTIONS;
    expect(first).toBeDefined();
    expect(third).toBeDefined();
    const page = plan({}, [String(first?.id), String(third?.id)]);
    expect(page.generalActions.map((a) => a.text)).toEqual([first?.text, third?.text]);
  });

  it('carries all of them when none were ticked, rather than a section with nothing in it', () => {
    // The ticks are an optional filter, not a question the plan insists on.
    expect(plan({}).generalActions).toHaveLength(GENERAL_ACTIONS.length);
  });

  it('credits only the sources behind something on the page', () => {
    const page = plan({}, [String(GENERAL_ACTIONS[0]?.id)]);
    const action = GENERAL_ACTIONS[0];
    expect(action).toBeDefined();
    expect(page.sources).toContain(`${String(action?.publisher)}: ${String(action?.page)}`);
  });

  it('escapes an address rather than letting it close a tag', () => {
    const page = printedPlan('12 <b>Smith</b> & Co Lane', PLACES, {}, new Set(), ON);
    expect(planHtml(page)).toContain('12 &lt;b&gt;Smith&lt;/b&gt; &amp; Co Lane');
  });
});

describe('the detail under each printed action', () => {
  it('is on the page, between the action and its publisher', () => {
    const page = plan({});
    for (const line of page.generalActions) {
      expect(line.detail).toBeTruthy();
      expect(line.source).toBeTruthy();
      expect(line.detail).not.toBe(line.source);
    }
  });

  it('is drawn apart from the source line, not inside it', () => {
    // The source line is 9pt grey and says who wrote the action. Running the
    // team's own sentence into it would read as the publisher's words.
    const html = planHtml(plan({}));
    expect(html).toContain('class="detail"');
    expect(html).toContain('Torch, portable radio, spare batteries');
  });
});
