/**
 * The summary a reader carries to the organisation (AC 6.3.3).
 *
 * Address, problem type, who to contact and what to have ready — short enough
 * to read out over the telephone, which is how three of the five channels are
 * used. It is built here as data and turned into text for the clipboard or a
 * page for the printer; it is never sent anywhere, because there is nowhere
 * for it to go.
 *
 * **Generated locally and kept by nobody.** No request, no storage, no address
 * in a URL. The reader's copy exists in their clipboard or on their paper, and
 * the tab forgets it. AC 6.3.3 asks for that in those words, and it is the
 * same rule the address has had since Iteration 1.
 */

import { type ProblemType, PREPARE, REPORT_HEADING, selectedDrainLine } from './problems.js';
import { channelLine } from './channels.js';
import { escapeHtml, printedDate } from '../prepare/printable.js';

/**
 * Where the address would be, where the reader has not chosen one.
 *
 * The full map can be read without an address, and an empty line on a printed
 * page reads as a field somebody forgot to fill in. Saying it plainly also
 * says what to do about it, since the location is the first thing any of
 * these organisations will ask for.
 */
export const NO_ADDRESS = 'No address chosen. Give the location when you contact them.';

/** That the summary belongs to the reader and to nobody else (AC 6.3.3). */
export const YOURS_TO_KEEP =
  'This summary is your copy. DrainLens keeps nothing once you close this tab.';

/** The summary, as data. */
export interface ReportSummary {
  readonly title: string;
  readonly address: string;
  readonly preparedOn: string;
  readonly problem: string;
  /** Who to contact, the one to use first. */
  readonly contacts: readonly string[];
  /** What to have ready, and the chosen drain where there is one. */
  readonly checklist: readonly string[];
  readonly keepLine: string;
}

/**
 * The summary for one address and one chosen problem.
 *
 * `drain` is the asset number of a drain the reader selected on the map, and
 * `null` where they selected none — which is allowed, and which leaves the
 * line out rather than guessing at the nearest (AC 6.3.2).
 */
export function reportSummary(
  address: string | null,
  problem: ProblemType,
  drain: string | null,
  on: Date,
): ReportSummary {
  return {
    title: REPORT_HEADING,
    address: address === null || address === '' ? NO_ADDRESS : address,
    preparedOn: `Prepared on ${printedDate(on)}`,
    problem: problem.label,
    contacts: problem.channels.map(channelLine),
    checklist: drain === null ? PREPARE : [...PREPARE, selectedDrainLine(drain)],
    keepLine: YOURS_TO_KEEP,
  };
}

/** The summary as plain text, which is what the clipboard carries. */
export function summaryText(summary: ReportSummary): string {
  return [
    summary.title,
    summary.address,
    summary.preparedOn,
    '',
    `Problem: ${summary.problem}`,
    '',
    'Who to contact:',
    ...summary.contacts.map((contact) => `- ${contact}`),
    '',
    'What to have ready:',
    ...summary.checklist.map((item) => `- ${item}`),
    '',
    summary.keepLine,
  ].join('\n');
}

const items = (lines: readonly string[]): string =>
  `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;

/** The same summary as one self-contained page for the printer. */
export function summaryHtml(summary: ReportSummary): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<title>${escapeHtml(summary.title)}</title>
<style>
  body { font: 12pt/1.5 Georgia, "Times New Roman", serif; color: #1f2421; margin: 2cm; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  h2 { font-size: 11pt; letter-spacing: 0.06em; text-transform: uppercase; color: #4a5551;
       margin: 18pt 0 6pt; }
  p.where { margin: 0; }
  p.when { margin: 2pt 0 0; color: #4a5551; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { margin: 0 0 8pt; }
  p.keep { margin: 18pt 0 0; font-size: 10pt; color: #4a5551; }
</style>
</head>
<body>
<h1>${escapeHtml(summary.title)}</h1>
<p class="where">${escapeHtml(summary.address)}</p>
<p class="when">${escapeHtml(summary.preparedOn)}</p>
<h2>Problem</h2><p>${escapeHtml(summary.problem)}</p>
<h2>Who to contact</h2>${items(summary.contacts)}
<h2>What to have ready</h2>${items(summary.checklist)}
<p class="keep">${escapeHtml(summary.keepLine)}</p>
</body>
</html>`;
}
