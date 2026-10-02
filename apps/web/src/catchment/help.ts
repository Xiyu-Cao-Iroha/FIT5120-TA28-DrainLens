/**
 * Who can help, at each level of the drainage system — and what that is not.
 *
 * AC 6.2.1 asks for three levels and the general role at each, cited to an
 * official source, with one sentence doing most of the work: **these are
 * general roles and do not confirm the legal owner or operator of a specific
 * asset.** A resident reading *local street drains are managed by the council*
 * beside a pit on their street will read it as *the council owns this pit*,
 * and the record does not say that about any particular pit.
 *
 * AC 6.2.2 is the other half: what the record *does* say about one asset. A
 * pipe carries an operator and three different things can be true of it, each
 * with its own sentence. A pit carries no operator at all, so it gets none —
 * not the operator of the pipe it joins, which the criterion forbids inferring,
 * and not the council because the council published the dataset.
 *
 * **The phone numbers here were read from the publishers' own pages on 2
 * October 2026**, with the page and the date recorded beside each. They are
 * reproduction, like the area names, rather than a claim this project makes;
 * what is still the team's to approve is the *guidance content register* the
 * Epic 6 definition of done asks for, which is `docs/GUIDANCE-CONTENT.md`.
 */

/** One level of the system, as *Who can help* lists them. */
export interface DrainageLevel {
  readonly id: 'private' | 'street' | 'regional';
  /** The level's name, as the design's card writes it (Figma D4). */
  readonly title: string;
  /** A problem a reader would recognise at this level, from the design. */
  readonly example: string;
  /** Who to tell, as the design's card names them. */
  readonly who: string;
  /** The general role, in the criterion's own hedged terms. */
  readonly role: string;
  /** Where that role is stated, for the citation AC 6.2.1 asks for. */
  readonly source: { readonly publisher: string; readonly page: string; readonly checked: string };
}

export const DRAINAGE_LEVELS: readonly DrainageLevel[] = [
  {
    id: 'private',
    title: 'Your property',
    example: 'e.g. overflowing gutters',
    who: 'You, or a plumber',
    role: 'Gutters, downpipes and drainage pipes on private property are generally the property owner’s responsibility.',
    source: {
      publisher: 'Melbourne Water',
      page: 'https://www.melbournewater.com.au/water-data-and-education/water-and-sewerage-services/drainage',
      checked: '2026-10-02',
    },
  },
  {
    id: 'street',
    title: 'Local streets',
    example: 'e.g. a blocked street drain',
    who: 'City of Melbourne',
    role: 'Street drains and the pipes under local streets are generally managed by the council.',
    source: {
      publisher: 'City of Melbourne',
      page: 'https://www.melbourne.vic.gov.au/pay-report-request',
      checked: '2026-10-02',
    },
  },
  {
    id: 'regional',
    title: 'Main drains',
    example: 'e.g. rubbish blocking a creek',
    who: 'Melbourne Water',
    role: 'Regional main drains, rivers and creeks are generally managed by Melbourne Water.',
    source: {
      publisher: 'Melbourne Water',
      page: 'https://www.melbournewater.com.au/about/contact-us',
      checked: '2026-10-02',
    },
  },
];

/**
 * The sentence that keeps the three levels from being read as ownership.
 *
 * AC 6.2.1's last line, and the Epic 6 definition of done repeats it: the
 * levels are general roles and do not establish who owns or operates a
 * particular asset.
 */
export const GENERAL_ROLES_ONLY =
  'These are general roles. They do not confirm who legally owns or operates any particular drain, pit or pipe.';

/** Heading for the panel. */
export const WHO_CAN_HELP = 'Who can help';

/**
 * What the record says about one pipe's operator.
 *
 * Three states and three sentences (AC 6.2.2):
 *
 * - `City of Melbourne` on 16,302 of the council's pipes — named.
 * - absent on 87 — *Operator not recorded*.
 * - the string `4` on 853 — a code the published data does not explain, and
 *   this says so rather than resolving it to an organisation. Which one it
 *   would be matters: a resident reports a blockage to whoever is named.
 */
export function operatorLine(operator: string | undefined): string {
  if (operator === undefined || operator.trim() === '') return 'Operator not recorded';
  if (/^[A-Za-z]/.test(operator.trim())) return operator.trim();
  return `Operator code not yet identified (${operator.trim()})`;
}

/**
 * What a pit's record says about its operator, which is nothing.
 *
 * The stormwater pits dataset has no operator field. AC 6.2.2 forbids showing
 * one anyway and forbids taking it from a pipe that joins the pit, so this is
 * the sentence that says what the record holds instead of leaving a gap a
 * reader fills in themselves.
 */
export const PIT_HAS_NO_OPERATOR =
  'A record from the City of Melbourne Stormwater Pits dataset. That dataset does not say who operates a pit.';

/** The label the operator sits under, on a pipe's card. */
export const OPERATOR_LABEL = 'Operator';

/**
 * The citation under each level, built from the row rather than written twice.
 *
 * AC 6.2.1 asks for the official source behind these general roles; a note
 * kept beside the row it cites cannot drift from it.
 */
export function levelSource(level: DrainageLevel): string {
  return `Source: ${level.source.publisher}, checked ${level.source.checked}`;
}
