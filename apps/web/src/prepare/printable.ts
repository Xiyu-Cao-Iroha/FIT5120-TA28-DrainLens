/**
 * The one-page plan a reader can print or save, built in the browser.
 *
 * AC 5.4.3 is a list of what the page holds and what it must not: the
 * address and the date, the reminders the reader marked as applying and no
 * others, the general actions, the sources, the safety boundary, and a line
 * saying the copy is theirs to keep. It leaves out the reviewed count and
 * every control, because a printed page cannot be reviewed, reset or pressed
 * and a number on paper that looks like a score is the thing AC 5.4.1 spent
 * two clauses forbidding on screen.
 *
 * **Built here as data, printed elsewhere.** The page is a value — headings
 * and lines — so that what it contains can be tested without a browser, which
 * is how the acceptance file asks for this one to be held. `planHtml` turns
 * that value into the document; nothing else in this module touches the DOM.
 *
 * **Nothing leaves the browser.** No request, no storage, no address in a URL:
 * the document is a string this module builds and the browser prints. AC
 * 5.4.1 and 5.4.3 both say so, and it is the same rule the address has had
 * since Iteration 1.
 */

import { GENERAL_ACTIONS, SAFETY, VICEMERGENCY } from './actions.js';
import { PLACE_SOURCE, type Place, type Relevance, applying, reminderFor } from './places.js';

/** The page's own title, which is also the browser's print header. */
export const PRINTED_TITLE = 'My heavy rain plan';

/** That the page is a copy rather than something that keeps itself current. */
export const KEEP_LINE =
  'This copy is yours to keep. It does not update, and it is not a live flood warning.';

/** The heading over the reminders, where there are any. */
export const PRINTED_REMINDERS = 'When heavy rain is forecast';

/** The heading over the actions every home gets. */
export const PRINTED_EVERY_HOME = 'For every home';

/** The heading over the safety boundary. */
export const PRINTED_SAFETY = 'Before you rely on this';

/** The control that makes the page, as the design labels it. */
export const PRINT_PLAN = 'Print or save my plan';

/** The heading over where the wording came from. */
export const PRINTED_SOURCES = 'Sources';

/** One line of the page, with where it came from where it has one. */
export interface PrintedLine {
  readonly text: string;
  /** Shown under the line, smaller. `Estimated by DrainLens` on a reminder. */
  readonly source?: string;
}

/** The page, as data. */
export interface PrintedPlan {
  readonly title: string;
  readonly address: string;
  /** *Prepared on 3 October 2026* — the day it was printed, not a forecast. */
  readonly preparedOn: string;
  /** Only the places marked as applying. Empty means the section is left out. */
  readonly reminders: readonly PrintedLine[];
  readonly generalActions: readonly PrintedLine[];
  readonly safety: readonly string[];
  readonly sources: readonly string[];
  readonly keepLine: string;
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

/**
 * *3 October 2026*, written out rather than left to the reader's locale.
 *
 * A printed page can be read months later by somebody who did not print it,
 * and 03/10/2026 means two different days depending on who is holding it.
 */
export function printedDate(on: Date): string {
  return `${String(on.getDate())} ${MONTHS[on.getMonth()] ?? ''} ${String(on.getFullYear())}`;
}

/** The page for an address and the answers given for it (AC 5.4.3). */
export function printedPlan(
  address: string,
  places: readonly Place[],
  relevance: Readonly<Record<number, Relevance>>,
  on: Date,
): PrintedPlan {
  return {
    title: PRINTED_TITLE,
    address,
    preparedOn: `Prepared on ${printedDate(on)}`,
    // Only the places the reader said apply to them. A place they said does
    // not apply, or never answered, puts nothing on the page: the reminder is
    // the thing they agreed to, and the page is the agreement.
    reminders: applying(places, relevance).map((place) => ({
      text: reminderFor(place),
      source: PLACE_SOURCE,
    })),
    generalActions: GENERAL_ACTIONS.map((action) => ({
      text: action.text,
      source: action.publisher,
    })),
    safety: SAFETY,
    sources: [
      ...new Set(GENERAL_ACTIONS.map((action) => `${action.publisher}: ${action.page}`)),
      `${VICEMERGENCY.label}: ${VICEMERGENCY.href}`,
    ],
    keepLine: KEEP_LINE,
  };
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text into the document, with the five characters that would break it out. */
export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);

const lines = (items: readonly PrintedLine[]): string =>
  items
    .map(
      (line) =>
        `<li>${escapeHtml(line.text)}${
          line.source === undefined ? '' : `<span>${escapeHtml(line.source)}</span>`
        }</li>`,
    )
    .join('');

/**
 * The page as one self-contained document.
 *
 * Inline styles and no links out: it is printed, and a stylesheet it had to
 * fetch would print unstyled on a machine that was offline when the rain
 * started. The source URLs are written as text for the same reason — a
 * printed link that cannot be clicked should still be readable.
 */
export function planHtml(plan: PrintedPlan): string {
  const section = (heading: string, body: string): string =>
    body === '' ? '' : `<h2>${escapeHtml(heading)}</h2>${body}`;

  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<title>${escapeHtml(plan.title)}</title>
<style>
  body { font: 12pt/1.5 Georgia, "Times New Roman", serif; color: #1f2421; margin: 2cm; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  h2 { font-size: 11pt; letter-spacing: 0.06em; text-transform: uppercase; color: #4a5551;
       margin: 18pt 0 6pt; }
  p.where { margin: 0; font-size: 12pt; }
  p.when { margin: 2pt 0 0; color: #4a5551; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { margin: 0 0 8pt; }
  li span { display: block; font-size: 9pt; color: #4a5551; }
  p.keep { margin: 18pt 0 0; font-size: 10pt; color: #4a5551; }
</style>
</head>
<body>
<h1>${escapeHtml(plan.title)}</h1>
<p class="where">${escapeHtml(plan.address)}</p>
<p class="when">${escapeHtml(plan.preparedOn)}</p>
${section(PRINTED_REMINDERS, plan.reminders.length === 0 ? '' : `<ul>${lines(plan.reminders)}</ul>`)}
${section(PRINTED_EVERY_HOME, `<ul>${lines(plan.generalActions)}</ul>`)}
${section(PRINTED_SAFETY, `<ul>${lines(plan.safety.map((text) => ({ text })))}</ul>`)}
${section(PRINTED_SOURCES, `<ul>${lines(plan.sources.map((text) => ({ text })))}</ul>`)}
<p class="keep">${escapeHtml(plan.keepLine)}</p>
</body>
</html>`;
}
