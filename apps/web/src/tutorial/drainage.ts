/**
 * The drainage section, step by step.
 *
 * **Every step that asks for something advances when that thing is true of the
 * map, not when a Next button is pressed.** That is the whole difference
 * between this and the tour it sits beside: the tour describes the map, and
 * this one waits for you to work it. A step that could be skipped with Next
 * would teach nothing to the person most likely to press Next.
 *
 * The steps that only tell you what just happened *do* have Next, because
 * there is nothing to wait for. The two kinds are `do` and `read`, and mixing
 * them up is the mistake this type exists to prevent.
 *
 * **The requirement is checked against the map, not remembered.** `satisfied`
 * takes what the map currently shows, so turning Pits back off on step 3 puts
 * you back on step 1 rather than leaving you ahead of a map that no longer
 * matches the words beside it.
 */

/** What a `do` step is waiting for. */
export type Requirement = 'pits-on' | 'pipes-on' | 'pit-selected' | 'trace-following';

export type Step =
  | {
      readonly kind: 'do';
      readonly id: string;
      readonly prompt: string;
      /** Said under the prompt, where it needs a second sentence. */
      readonly hint?: string;
      readonly requires: Requirement;
    }
  | { readonly kind: 'read'; readonly id: string; readonly prompt: string };

/** What the map is showing, as far as a step needs to know. */
export interface MapNow {
  readonly pits: boolean;
  readonly pipes: boolean;
  /** The selected pit's asset number as a string, or null. */
  readonly selectedPit: string | null;
  /** The pit whose downstream path is drawn, or null. */
  readonly followingPit: string | null;
}

export const DRAINAGE_STEPS: readonly Step[] = [
  {
    kind: 'do',
    id: 'pits-on',
    prompt: 'Press Pits to show the drainage pits near your address.',
    hint: 'The map opens with nothing on it. Everything you see from here is something you turned on.',
    requires: 'pits-on',
  },
  {
    kind: 'read',
    id: 'pits-shown',
    prompt:
      'Those are the structures the council has a record of — a grate in the kerb, a lid in the footpath, or a join where pipes meet.',
  },
  {
    kind: 'do',
    id: 'pipes-on',
    prompt: 'Now press Pipes to show what connects them underground.',
    requires: 'pipes-on',
  },
  {
    kind: 'read',
    id: 'pipes-shown',
    prompt:
      'That is the recorded network. Nothing here is measured by us: it is what the council published, drawn as published.',
  },
  {
    kind: 'do',
    id: 'pit-selected',
    prompt: 'Press the pit marked on the map.',
    hint: 'We picked this one because the record carries a path onward from it. Not every pit does.',
    requires: 'pit-selected',
  },
  {
    kind: 'do',
    id: 'trace-following',
    prompt: 'Press Show connected pipe to follow the water downstream.',
    requires: 'trace-following',
  },
];

/**
 * Is this step's requirement true of the map right now?
 *
 * `teachingPit` is the one the guide asked for. A different pit does not
 * satisfy the step — not to be strict about it, but because the next step
 * presses *Show connected pipe*, and a quarter of the pits in this extent have
 * nothing to show there.
 */
export function satisfied(
  requires: Requirement,
  now: MapNow,
  teachingPit: string | null,
): boolean {
  switch (requires) {
    case 'pits-on':
      return now.pits;
    case 'pipes-on':
      // Pits stay a condition of this step. Turning them off to see the pipes
      // on their own leaves the words beside the map describing a map that is
      // no longer there.
      return now.pits && now.pipes;
    case 'pit-selected':
      return teachingPit !== null && now.selectedPit === teachingPit;
    case 'trace-following':
      return teachingPit !== null && now.followingPit === teachingPit;
  }
}

/**
 * Where the guide should be, given what the map shows.
 *
 * Derived rather than incremented. A step counter that only goes up drifts
 * away from the map the moment somebody switches a layer back off, and then
 * the instruction and the screen disagree with nobody to notice.
 *
 * `read` steps are the exception and have to be: nothing about the map says
 * whether their sentence has been read, so they hold until Next is pressed —
 * which is what `acknowledged` carries.
 */
export function stepIndex(
  steps: readonly Step[],
  now: MapNow,
  teachingPit: string | null,
  acknowledged: number,
): number {
  let index = 0;
  while (index < steps.length) {
    const step = steps[index];
    if (step === undefined) break;
    if (step.kind === 'read') {
      if (acknowledged <= index) break;
    } else if (!satisfied(step.requires, now, teachingPit)) {
      break;
    }
    index += 1;
  }
  return index;
}

/** True when every step is behind you. */
export const finished = (
  steps: readonly Step[],
  now: MapNow,
  teachingPit: string | null,
  acknowledged: number,
): boolean => stepIndex(steps, now, teachingPit, acknowledged) >= steps.length;

/** Said once, on the way out. */
export const DRAINAGE_DONE = {
  headline: 'That is the drainage layer.',
  body: 'You turned on the council’s record, followed one path downstream, and saw where the record stops. The same two controls work anywhere on the map.',
  unlocked: 'Recorded drainage is now yours on the whole map.',
} as const;
