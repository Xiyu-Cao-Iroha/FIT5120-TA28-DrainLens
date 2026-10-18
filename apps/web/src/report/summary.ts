/**
 * The summary a reader carries to the organisation (AC 6.3.3).
 *
 * Where the problem is, what it is, who to contact and what to have ready.
 * It is built here as data and turned into text for the clipboard or a page
 * for the printer; it is never sent anywhere, because there is nowhere for it
 * to go.
 *
 * **Generated locally and kept by nobody.** No request, no storage, no
 * address in a URL. The reader's copy exists in their clipboard or on their
 * paper, and the tab forgets it.
 *
 * > **Rewritten on 10 October, on the team's list.** It was a checklist: four
 * > bullets headed *What to have ready*, each a prompt the reader had to act
 * > on. It is now a set of fields with the answers already in them, because
 * > by the time somebody presses Copy or Print the product knows most of
 * > them. The one that is still a prompt says so.
 * >
 * > It also stopped printing a house number. See `whereLine`.
 */

import { type ProblemType, REPORT_HEADING } from './problems.js';
import { type ReportPlace, pinnedLink, placeLine, placeTitle } from './place.js';
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

/**
 * The street and the suburb, and never the house number.
 *
 * **The number comes off on the team's instruction of 10 October, and the
 * instruction is right for a reason worth writing down.** This page goes to a
 * council officer, and what it is about is a drain in a public street. The
 * reporter's own front door is not part of that: it is the one piece of
 * identifying information in the whole summary, and nothing downstream needs
 * it. The street locates the problem, the asset number locates it exactly
 * where one was chosen, and the suburb disambiguates the street.
 *
 * Built from the fields rather than parsed off the label, because the label
 * is `labelOf(number, street, suburb)` and published numbers include `12A`,
 * `1/46` and `U 3 220`. A regular expression over those is a way to print
 * somebody's unit number by accident.
 */
export function whereLine(street: string | null, suburb: string | null): string {
  if (street === null || street.trim() === '') return NO_ADDRESS;
  const where = suburb === null || suburb.trim() === '' ? street : `${street}, ${suburb}`;
  return where;
}

/** One field of the summary: a label and the answer, or the prompt. */
export interface SummaryField {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /**
   * A second line under the value, where the field needs one.
   *
   * Photographs have one, because a printed page raises the question of what
   * happened to them: nothing is uploaded here, so they travel with the
   * report the same way the report does.
   */
  readonly note?: string;
}

/** What a reader is told to attach themselves, under the photographs field. */
export const PHOTOS_ATTACH = '(may be attached with this report form)';

/** The summary, as data. */
export interface ReportSummary {
  readonly title: string;
  /** Who to contact, the one to use first. */
  readonly contacts: readonly string[];
  /**
   * The fields, in the order the team listed them.
   *
   * Everything the summary says is in here. There is no second copy of the
   * street or the date beside it: two sources for one sentence is how the
   * printed page and the clipboard start disagreeing.
   */
  readonly fields: readonly SummaryField[];
}

export interface ReportWhere {
  /** The reader's street, without the number. */
  readonly street: string | null;
  readonly suburb: string | null;
  /** The recorded drainage area, where the product found one. */
  readonly area: string | null;
}

/**
 * The summary for one place and one chosen problem.
 *
 * `place` is a drain the reader tapped or a point they pinned, and `null`
 * where they named neither, which is allowed and which says so rather than
 * guessing at the nearest (AC 6.3.2).
 */
export function reportSummary(
  where: ReportWhere,
  problem: ProblemType,
  place: ReportPlace,
  on: Date,
): ReportSummary {
  const link = pinnedLink(place);
  return {
    title: REPORT_HEADING,
    contacts: problem.channels.map(channelLine),
    fields: [
      { id: 'when', label: 'When', value: `Prepared on ${printedDate(on)}` },
      {
        id: 'where',
        label: 'Street',
        value: whereLine(where.street, where.suburb),
      },
      {
        id: 'area',
        label: 'Recorded drainage area',
        // Not every address has one, and AC 6.1.5 is that the product says
        // so rather than giving a neighbour's.
        value: where.area === null || where.area === '' ? 'Not recorded for this street' : where.area,
      },
      { id: 'drain', label: placeTitle(place), value: placeLine(place) },
      { id: 'problem', label: 'Problem', value: problem.label },
      {
        id: 'photos',
        label: 'Photos',
        value: 'Taken from a safe place',
        note: PHOTOS_ATTACH,
      },
      // A pin is a point as well as a sentence, and the point is only useful
      // as something the reader can send (Figma B4d).
      ...(link === null ? [] : [{ id: 'link', label: 'Map link', value: link }]),
    ],
  };
}

/** The summary as plain text, which is what the clipboard carries. */
export function summaryText(summary: ReportSummary): string {
  return [
    summary.title,
    '',
    ...summary.fields.map((field) =>
      field.note === undefined
        ? `${field.label}: ${field.value}`
        : `${field.label}: ${field.value} ${field.note}`,
    ),
    '',
    'Who to contact:',
    ...summary.contacts.map((contact) => `- ${contact}`),
  ].join('\n');
}

const rows = (fields: readonly SummaryField[]): string =>
  fields
    .map(
      (field) =>
        `<tr><th scope="row">${escapeHtml(field.label)}</th><td>${escapeHtml(field.value)}${
          field.note === undefined ? '' : `<span class="note">${escapeHtml(field.note)}</span>`
        }</td></tr>`,
    )
    .join('');

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
  h1 { font-size: 18pt; margin: 0 0 12pt; }
  h2 { font-size: 11pt; letter-spacing: 0.06em; text-transform: uppercase; color: #4a5551;
       margin: 18pt 0 6pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; vertical-align: top; padding: 4pt 0; }
  th { width: 34%; font-weight: normal; color: #4a5551; padding-right: 12pt; }
  tr + tr th, tr + tr td { border-top: 1px solid #d9dedb; }
  span.note { display: block; font-size: 10pt; color: #4a5551; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { margin: 0 0 8pt; }
</style>
</head>
<body>
<h1>${escapeHtml(summary.title)}</h1>
<table>${rows(summary.fields)}</table>
<h2>Who to contact</h2>${items(summary.contacts)}
</body>
</html>`;
}
