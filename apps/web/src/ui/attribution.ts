/**
 * Who the data belongs to, said on screen rather than only in the artefacts.
 *
 * Every artefact already records its `publisher`, `licence` and
 * `last_modified` — that is what `assertUsable` refuses an artefact for
 * lacking. None of it ever reached a screen, which was survivable on a
 * developer's machine and is not once the site is published: **CC BY 4.0
 * requires the attribution to be visible to the person using the work.**
 *
 * Three things the licence asks for, and one this project owes anyway:
 *
 * - the creator, named
 * - the licence, named and linked
 * - **an indication that changes were made** — and they were. The
 *   surface-water paths, the low points and the ground shading are calculated
 *   from the council's data, not published by the council. Somebody who takes
 *   a screenshot of a derived layer and calls it a City of Melbourne map has
 *   been misled by us, not by them.
 *
 * The list is read from the artefacts rather than written here, so replacing a
 * data source updates the credit with it. An attribution that has to be
 * remembered is one that goes stale the first time nobody remembers.
 */

import type { MapArtefact } from '../map/artefact.js';

export const LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/';

/**
 * The deed for a licence, by its name.
 *
 * Every credit linked to CC BY 4.0 while every source was the council's. The
 * ABS publishes under CC BY 2.5 Australia, and a link to the wrong licence is
 * a credit that misstates the terms the data was used under.
 */
export function licenceUrl(licence: string): string {
  const name = licence.trim().toUpperCase();
  if (name === 'CC BY 2.5 AU') return 'https://creativecommons.org/licenses/by/2.5/au/';
  if (name === 'CC BY 3.0 AU') return 'https://creativecommons.org/licenses/by/3.0/au/';
  return LICENCE_URL;
}

/** What the flood board adds: totals by area and a ranking, not a score or a map. */
export const BOARD_CHANGES_NOTICE =
  'The totals for each area and the ranking are added up from this data by DrainLens, not published by the source.';

/** What the flood map adds to its sources, the same clause as `CHANGES_NOTICE`. */
export const FLOOD_CHANGES_NOTICE =
  'The Severity Score and where each area is drawn are calculated from this data by DrainLens, not published by the sources.';

interface NamedSource {
  readonly publisher: string;
  readonly licence?: string;
  readonly dataset_id?: string;
}

/**
 * The flood map's credit, from the sources its artefacts name.
 *
 * It showed the council's drainage credit, which is the drainage map's. The
 * flood map is the SES's dispatches, the ABS's boundaries and the ABS's
 * population, and those are who it credits.
 */
export function creditsForSources(sources: readonly (NamedSource | undefined)[]): readonly Credit[] {
  const grouped = new Map<string, { publisher: string; licence: string; datasets: string[] }>();
  for (const source of sources) {
    const publisher = source?.publisher?.trim();
    const licence = source?.licence?.trim();
    if (!publisher || !licence) continue;
    const key = `${publisher}\u0000${licence}`;
    const held = grouped.get(key) ?? { publisher, licence, datasets: [] };
    if (source?.dataset_id && !held.datasets.includes(source.dataset_id)) held.datasets.push(source.dataset_id);
    grouped.set(key, held);
  }
  return [...grouped.values()].map((held) => ({ ...held, lastModified: null }));
}

/**
 * The changes notice, which is the clause most often skipped.
 *
 * Kept separate from the credit because it is a different obligation: the
 * credit says whose data this is, and this says that what is on screen is not
 * only their data.
 */
export const CHANGES_NOTICE =
  'Surface-water paths, low points and the ground surface are calculated from this data by DrainLens, not published by the source.';

export interface Credit {
  readonly publisher: string;
  readonly licence: string;
  /** Dataset identifiers, in the order the artefact lists them. */
  readonly datasets: readonly string[];
  /** The most recent `last_modified` across those datasets. */
  readonly lastModified: string | null;
}

/**
 * One credit per publisher and licence pair.
 *
 * Four datasets from one publisher under one licence is one line of credit,
 * not four. Grouping is what makes the notice short enough to be read, and a
 * notice nobody reads satisfies the letter of the licence and not its point.
 */
export function creditsFor(artefact: MapArtefact): readonly Credit[] {
  // Keyed by a pair that cannot collide, and the parts are kept in the value
  // rather than parsed back out of the key. A first version built the key as
  // `publisher + ' ' + licence` and split it on a space, which turns "City of
  // Melbourne Open Data Portal" into a publisher called "City".
  const grouped = new Map<
    string,
    { publisher: string; licence: string; datasets: string[]; lastModified: string | null }
  >();

  for (const source of artefact.sources) {
    const publisher = source.publisher?.trim();
    const licence = source.licence?.trim();
    if (!publisher || !licence) continue;

    // Grouped on a separator that cannot occur in either field. A space was the
    // first version and it split back wrong on every "City of ..." publisher,
    // which is why this is U+0000 and not punctuation.
    //
    // Written as an escape rather than as the byte itself. It was a literal NUL
    // until 5 September, which made `file`, `grep` and `git` treat this whole
    // source file as binary — so it was skipped silently by every code search —
    // and left the line reading as two placeholders with nothing between them,
    // which is indistinguishable from the defect the separator exists to fix.
    const key = `${publisher}\u0000${licence}`;
    const held = grouped.get(key) ?? { publisher, licence, datasets: [], lastModified: null };
    if (source.dataset_id && !held.datasets.includes(source.dataset_id)) {
      held.datasets.push(source.dataset_id);
    }
    // Lexicographic works because these are ISO dates, and a malformed one
    // sorts rather than throwing — a bad date should not cost the credit.
    if (
      source.last_modified &&
      (held.lastModified === null || source.last_modified > held.lastModified)
    ) {
      held.lastModified = source.last_modified;
    }
    grouped.set(key, held);
  }

  return [...grouped.values()].map((held) => ({
    publisher: held.publisher,
    licence: held.licence,
    datasets: held.datasets,
    lastModified: held.lastModified,
  }));
}

/** "road-corridors, drainpipes and two others" rather than a wall of ids. */
export function describeDatasets(datasets: readonly string[], shown = 2): string {
  if (datasets.length === 0) return '';
  if (datasets.length <= shown) return datasets.join(', ');
  const rest = datasets.length - shown;
  return `${datasets.slice(0, shown).join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`;
}

/** One line per credit, for a screen reader and for a copy-paste. */
export function creditLine(credit: Credit): string {
  const datasets = describeDatasets(credit.datasets);
  const modified = credit.lastModified === null ? '' : `, last updated ${credit.lastModified}`;
  return `${datasets} © ${credit.publisher}, licensed ${credit.licence}${modified}`;
}
