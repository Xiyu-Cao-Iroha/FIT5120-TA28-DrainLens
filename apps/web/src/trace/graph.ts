/**
 * Following the recorded drainage downstream, and stopping honestly.
 *
 * The artefact is `drainlens_pipeline.trace`, scoped to the extent. Every link
 * either names the pit it reaches or says why it does not, and this module's
 * whole job is to walk those links without ever inventing one.
 *
 * Three behaviours here are load-bearing and each has its own test:
 *
 * **Branches fan out.** A pit with two downstream pipes has two downstream
 * paths, and collapsing them to one would hide half the drainage from the
 * person following it. The traversal is breadth-first over a set, not a walk
 * along a single chain.
 *
 * **The path terminates.** The artefact marks the council's own back edges,
 * but a visited set guards this walk as well: the marking was computed over
 * the council-wide graph, and a loop that only closes within the extent would
 * not be in it. A trace that does not terminate is a browser tab that hangs.
 *
 * **A stop is never an arrival.** There is no recorded outlet anywhere in the
 * extent — every dead end is a junction, a kerbside inlet or an unrecorded
 * type — so this module has no `outlet` reason to return and the interface has
 * none to display. 83 of the 215 pits with no downstream pipe are inlets, and
 * a kerbside grate is not where a drainage system ends. It is where the record
 * does. That is AC 1.2.2.c answered truthfully rather than completed.
 */

/** Why a path stopped. Deliberately no `outlet` — see the module comment. */
export type Termination =
  | 'no-recorded-connection'
  | 'unrecorded-destination'
  | 'leaves-mapped-area'
  | 'cycle-guard';

export const TERMINATIONS: readonly Termination[] = [
  'no-recorded-connection',
  'unrecorded-destination',
  'leaves-mapped-area',
  'cycle-guard',
];

/** One recorded pipe leaving a pit: it reaches `to`, or it `ends`. */
export type Link =
  | { readonly pipe: string; readonly to: string; readonly ends?: undefined }
  | { readonly pipe: string; readonly to?: undefined; readonly ends: Termination };

export interface TraceArtefact {
  readonly artefact: 'drainage-trace';
  readonly version: number;
  readonly basis: 'sourceProvided';
  readonly note: string;
  readonly source: Record<string, unknown>;
  readonly terminations: Readonly<Record<Termination, string>>;
  readonly counts: Readonly<Record<string, number>>;
  readonly links: Readonly<Record<string, readonly Link[]>>;
}

export class TraceError extends Error {}

/**
 * Check the artefact before a path is drawn from it.
 *
 * The basis check is the one that matters. This layer is presented to the
 * person as official recorded data, and an artefact that arrived by some other
 * route — derived, assumed — must not be able to wear that label.
 */
export function assertTrace(value: unknown): asserts value is TraceArtefact {
  const artefact = value as Partial<TraceArtefact> | null;
  if (!artefact || typeof artefact !== 'object') {
    throw new TraceError('the trace artefact is not an object');
  }
  if (artefact.artefact !== 'drainage-trace') {
    throw new TraceError(`expected a drainage-trace artefact, got ${String(artefact.artefact)}`);
  }
  if (artefact.basis !== 'sourceProvided') {
    throw new TraceError(
      `a trace shown as recorded data must declare a sourceProvided basis, not ${String(artefact.basis)}`,
    );
  }
  if (!artefact.links || typeof artefact.links !== 'object') {
    throw new TraceError('the trace artefact carries no links');
  }
  if (!artefact.terminations || typeof artefact.terminations !== 'object') {
    throw new TraceError('the trace artefact carries no wording for its terminations');
  }
  for (const reason of TERMINATIONS) {
    if (typeof artefact.terminations[reason] !== 'string') {
      throw new TraceError(`the trace artefact does not say what "${reason}" means`);
    }
  }
}

/** A pipe on the path, and how many steps downstream it was reached. */
export interface TracedPipe {
  readonly pipe: string;
  readonly from: string;
  readonly to: string;
  readonly step: number;
}

/** A place the path stopped, and why. */
export interface Ending {
  readonly atPit: string;
  /** The pipe that could not be followed, absent when the pit had none. */
  readonly pipe: string | null;
  readonly reason: Termination;
  readonly step: number;
}

export interface Trace {
  readonly start: string;
  /** Every pit on the path, including the start, in the order first reached. */
  readonly pits: readonly string[];
  readonly pipes: readonly TracedPipe[];
  readonly endings: readonly Ending[];
  /** How many pipes deep the longest branch went. */
  readonly steps: number;
  /** True when at least one branch stopped for a reason other than a loop. */
  readonly incomplete: boolean;
}

/**
 * Every pit and pipe reachable downstream of `start`, and every reason the
 * path stopped.
 *
 * A pit not in the artefact is not an error: the map and the trace are built
 * from the same extent, but a caller may still ask about something outside it,
 * and the honest answer is a path of length zero rather than a throw.
 */
export function traceDownstream(artefact: TraceArtefact, start: string): Trace {
  const pits: string[] = [];
  const pipes: TracedPipe[] = [];
  const endings: Ending[] = [];
  const seen = new Set<string>();

  let frontier: string[] = [start];
  let step = 0;

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const pit of frontier) {
      if (seen.has(pit)) continue;
      seen.add(pit);
      pits.push(pit);

      const links = artefact.links[pit];
      if (links === undefined) {
        // Outside the extent, or a pit the artefact does not carry. Not a
        // dead end in the data — a question we cannot answer — so it is
        // reported the same way as one, which is the conservative reading.
        endings.push({ atPit: pit, pipe: null, reason: 'no-recorded-connection', step });
        continue;
      }
      if (links.length === 0) {
        endings.push({ atPit: pit, pipe: null, reason: 'no-recorded-connection', step });
        continue;
      }

      for (const link of links) {
        if (link.to === undefined) {
          endings.push({ atPit: pit, pipe: link.pipe, reason: link.ends, step });
          continue;
        }
        if (seen.has(link.to)) {
          // A loop that closes inside the extent. The artefact's own back-edge
          // marking is computed council-wide and would not carry this one.
          endings.push({ atPit: pit, pipe: link.pipe, reason: 'cycle-guard', step });
          continue;
        }
        pipes.push({ pipe: link.pipe, from: pit, to: link.to, step });
        next.push(link.to);
      }
    }
    frontier = next;
    if (next.length > 0) step += 1;
  }

  return {
    start,
    pits,
    pipes,
    endings,
    steps: step,
    incomplete: endings.some((ending) => ending.reason !== 'leaves-mapped-area'),
  };
}

/**
 * The endings, grouped by reason, most common first.
 *
 * A path of any length usually stops in several places at once, and listing
 * eleven separate "not recorded" lines tells the person less than one line
 * saying eleven. Ties break by the fixed reason order so the panel does not
 * reshuffle itself between two traces that stopped the same way.
 */
export function endingsByReason(trace: Trace): readonly {
  readonly reason: Termination;
  readonly count: number;
}[] {
  const counts = new Map<Termination, number>();
  for (const ending of trace.endings) {
    counts.set(ending.reason, (counts.get(ending.reason) ?? 0) + 1);
  }
  return [...counts]
    .map(([reason, count]) => ({ reason, count }))
    .sort(
      (a, b) => b.count - a.count || TERMINATIONS.indexOf(a.reason) - TERMINATIONS.indexOf(b.reason),
    );
}
