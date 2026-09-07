/**
 * What a street cross-section can honestly say about one pit.
 *
 * The drawing is the easy half. The hard half is that **no depth exists**.
 * Invert levels are missing for 95.4% of the council's record and the
 * surviving fraction is internally inconsistent, so the pipeline never fetched
 * them and the map artefact carries none at all — not for 95.4% of pits in the
 * extent, but for every one of them.
 *
 * That decides the shape of this module. A cross-section is a *vertical*
 * drawing, and the one axis it exists to show is the one we have no data for.
 * So the vertical dimension here is presentation and nothing else, and it says
 * so in the drawing rather than in a caption somewhere: AC 1.1.7.d asks that
 * recorded information be distinguishable from simplified presentation, and
 * the honest split is that **everything horizontal is recorded and everything
 * vertical is invented**.
 *
 * What is genuinely recorded, and therefore what the section may assert:
 *
 * - which pipes connect to this pit, and on which side (`upstr_pit`/`dnstr_pit`)
 * - each pipe's nominal diameter, for 98.9% of them
 * - each pipe's material, for all of them
 *
 * What it must never assert (AD6, which the 3 September revision no longer
 * restates as a criterion of its own): anything about
 * capacity, about whether a pipe is adequate, or about a blockage underground.
 * A diameter is a recorded dimension. It is not a flow rate, and the step from
 * one to the other needs a hydraulic model this project does not have and has
 * decided not to build.
 */

import type { MapArtefact, Pipe, Pit } from '../map/artefact.js';

/** A pipe as the section presents it. Every field here is recorded. */
export interface SectionPipe {
  readonly ref: string;
  /** Nominal diameter in millimetres, or null when the record omits it. */
  readonly diameterMm: number | null;
  readonly material: string | null;
  /** Which way water runs, relative to this pit. */
  readonly direction: 'into-this-pit' | 'out-of-this-pit';
}

/**
 * Whether the record says surface water enters at this pit.
 *
 * **The drawing needs this and the record does not always answer it.** A
 * teammate's sketch put an arrow of water running off the street into the pit,
 * which is what a grated inlet does — and 126 of the 895 pits here are
 * recorded as `Junction` and 41 as `System Node`, which are joins in the
 * network rather than ways in. Drawing that arrow on one of those states
 * something the record contradicts.
 *
 * Three states rather than two, because `Lane Type` (217 pits), `Not Known`,
 * `Other`, `Submerged` and the 22 with nothing recorded do not say either
 * way, and reading silence as a grate would be inventing the answer for a
 * quarter of the map.
 */
export type SurfaceEntry = 'recorded-inlet' | 'not-an-inlet' | 'not-recorded';

/** Said on the figure, so the arrow's absence is never left to be guessed. */
export const SURFACE_ENTRY_NOTE: Record<SurfaceEntry, string> = {
  'recorded-inlet': 'Water runs off the street and in through the grate.',
  'not-an-inlet':
    'The record calls this a join in the network rather than a way in, so no surface inflow is drawn: water arrives through the pipes.',
  'not-recorded':
    'The record does not say whether surface water enters here, so no surface inflow is drawn.',
};

/**
 * The one sentence the map's pit card leads with.
 *
 * It said "This pit collects surface water from the street" for every pit,
 * including the 126 recorded as junctions and the 41 recorded as system
 * nodes. That was a claim about a quarter of the map that the record does not
 * make, and it was invisible until the drawing had to decide whether to put an
 * arrow of water on the street above the pit -- which is the useful thing
 * about drawing something: it forces a question the prose could keep avoiding.
 *
 * Kept beside `SURFACE_ENTRY_NOTE` so the card and the figure cannot come to
 * disagree about the same pit.
 */
export const PIT_SUMMARY: Record<SurfaceEntry, string> = {
  'recorded-inlet':
    'This pit collects surface water from the street and connects it to the recorded drainage network.',
  'not-an-inlet':
    'The record calls this a join in the drainage network rather than a way into it: water reaches it through the pipes rather than off the street.',
  'not-recorded':
    'This pit is part of the recorded drainage network. The record does not say whether surface water enters here.',
};

/**
 * Read from the recorded type, and only where the words plainly say so.
 *
 * Matching on 'grated', 'side entry' and 'inlet' covers every type in this
 * extent that names a way in. Nothing is inferred from a type that is merely
 * unfamiliar -- 'Lane Type' is a location, not a grate, and guessing it either
 * way would put 217 pits into a claim the council did not make.
 */
export function surfaceEntryOf(pit: Pit): SurfaceEntry {
  const type = text(pit.object_type_lupvalue)?.toLowerCase();
  if (type === undefined || type === null) return 'not-recorded';
  if (/grated|side entry|inlet|gsep|kerbside/.test(type)) return 'recorded-inlet';
  if (/junction|system node/.test(type)) return 'not-an-inlet';
  return 'not-recorded';
}

export interface CrossSection {
  readonly kind: 'available';
  readonly assetNumber: string;
  /** Whether to draw water arriving from the street. See `SurfaceEntry`. */
  readonly surfaceEntry: SurfaceEntry;
  readonly description: string | null;
  readonly incoming: readonly SectionPipe[];
  readonly outgoing: readonly SectionPipe[];
  /** Named gaps in the record, always non-empty: depth is never available. */
  readonly missing: readonly string[];
}

export interface SectionUnavailable {
  readonly kind: 'unavailable';
  /** Which required information is missing — AC 1.1.7.f. */
  readonly reasons: readonly string[];
}

export type SectionOutcome = CrossSection | SectionUnavailable;

/**
 * Depth is absent from every pit, so this sentence appears on every section.
 *
 * Stated as a property of the record rather than of this screen. "We do not
 * show depth" invites the question of whether we could; "the record does not
 * carry it" is the actual situation.
 */
export const DEPTH_IS_ABSENT =
  'No pipe depth or invert level is recorded for any pit in this area, so the vertical positions in this drawing are illustrative only.';

/** AD6, as a sentence rather than only as an omission. */
export const NO_CAPACITY_CLAIM =
  'A recorded diameter is a dimension, not a capacity. This drawing does not say whether a pipe is large enough, whether it is blocked below ground, or how much it can carry.';

export const UNAVAILABLE_TITLE = 'A reliable cross-section cannot be drawn here';

const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

/** A diameter of zero is the export's way of saying nothing, not a 0 mm pipe. */
const diameterOf = (pipe: Pipe): number | null => {
  const value = pipe.diameter;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
};

const describe = (pipe: SectionPipe): string =>
  pipe.direction === 'into-this-pit' ? 'arrives at this pit' : 'leaves this pit';

/**
 * Build the section for one pit.
 *
 * Returns `unavailable` when the record holds no connected pipe at all — 169
 * of the 895 pits in the extent, which is why this state is a real screen
 * rather than a defensive branch nobody sees.
 */
export function sectionFor(artefact: MapArtefact, pit: Pit): SectionOutcome {
  const asset = text(pit.asset_number);
  const surfaceEntry = surfaceEntryOf(pit);
  if (asset === null) {
    return {
      kind: 'unavailable',
      reasons: ['This pit has no recorded asset number, so its connections cannot be looked up.'],
    };
  }

  const incoming: SectionPipe[] = [];
  const outgoing: SectionPipe[] = [];

  for (const pipe of artefact.layers.pipe ?? []) {
    const ref = text(pipe.ref);
    if (ref === null) continue;
    const entry = (direction: SectionPipe['direction']): SectionPipe => ({
      ref,
      diameterMm: diameterOf(pipe),
      material: text(pipe.material),
      direction,
    });
    if (text(pipe.dnstr_pit) === asset) incoming.push(entry('into-this-pit'));
    if (text(pipe.upstr_pit) === asset) outgoing.push(entry('out-of-this-pit'));
  }

  if (incoming.length === 0 && outgoing.length === 0) {
    return {
      kind: 'unavailable',
      reasons: [
        'The council record does not connect any pipe to this pit, so there is nothing beneath the street to draw.',
        // Said explicitly, because the alternative reading — that this pit
        // genuinely has no pipes — is a claim about the drainage rather than
        // about the record, and we cannot tell the two apart from here.
        'That is a gap in the record rather than evidence that no pipe exists.',
      ],
    };
  }

  const missing: string[] = [DEPTH_IS_ABSENT];
  const undimensioned = [...incoming, ...outgoing].filter((pipe) => pipe.diameterMm === null);
  if (undimensioned.length > 0) {
    missing.push(
      undimensioned.length === 1
        ? `The diameter of pipe ${undimensioned[0]!.ref} is not recorded.`
        : `${undimensioned.length} of these pipes have no recorded diameter.`,
    );
  }
  if (incoming.length === 0) {
    missing.push('No pipe is recorded as arriving at this pit, only leaving it.');
  }
  if (outgoing.length === 0) {
    missing.push('No pipe is recorded as leaving this pit, only arriving at it.');
  }

  return {
    kind: 'available',
    assetNumber: asset,
    surfaceEntry,
    description: text(pit.asset_description),
    incoming,
    outgoing,
    missing,
  };
}

/** A one-line summary of a pipe, for the list beside the drawing. */
export function summarise(pipe: SectionPipe): string {
  const size = pipe.diameterMm === null ? 'diameter not recorded' : `${pipe.diameterMm} mm`;
  const material = pipe.material === null ? '' : `, ${pipe.material.toLowerCase()}`;
  return `Pipe ${pipe.ref} — ${size}${material}, ${describe(pipe)}`;
}

/**
 * Relative thickness for drawing, 0 to 1.
 *
 * Scaled against the widest pipe *in this section* rather than against a fixed
 * maximum, so the comparison a reader makes is between pipes they can see. A
 * pipe with no recorded diameter gets the minimum and is labelled, never an
 * average of its neighbours — filling it in is what AC 1.1.7.f forbids.
 */
export function relativeWidth(pipe: SectionPipe, all: readonly SectionPipe[]): number {
  if (pipe.diameterMm === null) return 0;
  const widest = Math.max(...all.map((other) => other.diameterMm ?? 0));
  return widest <= 0 ? 0 : pipe.diameterMm / widest;
}
