/**
 * How a guided section works, for all of them.
 *
 * This was the top half of `drainage.ts` while there was one section. It moved
 * here on 11 September when there were three, because a second lesson
 * importing `MapNow` and `satisfied` from a file called *drainage* is a file
 * telling you something untrue about itself.
 *
 * **Every step that asks for something advances when that thing is true of the
 * map, not when a Next button is pressed.** That is the whole difference
 * between this and the tour it sits beside: the tour describes the map, and
 * these wait for you to work it. A step that could be skipped with Next would
 * teach nothing to the person most likely to press Next.
 *
 * The steps that only tell you what just happened *do* have Next, because
 * there is nothing to wait for. The two kinds are `do` and `read`, and mixing
 * them up is the mistake this type exists to prevent.
 *
 * **The requirement is checked against the map, not remembered.** `satisfied`
 * takes what the map currently shows, so turning a layer back off puts you
 * back on the step that asked for it rather than leaving you ahead of a map
 * that no longer matches the words beside it.
 */

import type { LayerKey } from '../map/modes.js';


/** What a `do` step is waiting for. */
export type Requirement =
  | 'pits-on'
  | 'pipes-on'
  | 'pit-selected'
  | 'trace-following'
  | 'water-flow-on'
  | 'low-areas-on'
  | 'unmeasured-on';

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
  /** The calculated surface-water paths. */
  readonly channel: boolean;
  /** The calculated hollows. */
  readonly lowPoints: boolean;
  /** The hatching over ground that was never measured. */
  readonly unmeasured: boolean;
  /** The selected pit's asset number as a string, or null. */
  readonly selectedPit: string | null;
  /** The pit whose downstream path is drawn, or null. */
  readonly followingPit: string | null;
}

/** Nothing on and nothing selected. The state every lesson opens in. */
export const NOTHING_ON_MAP: MapNow = {
  pits: false,
  pipes: false,
  channel: false,
  lowPoints: false,
  unmeasured: false,
  selectedPit: null,
  followingPit: null,
};

/**
 * What the guide says when a section is finished.
 *
 * `unlocked` is one sentence and it is a promise: the section's layer is the
 * reader's on the whole map from now on.
 */
export interface Finished {
  readonly headline: string;
  readonly body: string;
  readonly unlocked: string;
}

/**
 * One section of the guide.
 *
 * `chips` is a function rather than a list because **what is on offer changes
 * with the step**. The section already narrows the map to the layers it is
 * about; this narrows it again to the one being taught, so that step one does
 * not sit beside a control for step three. It takes the current state as well
 * as the step, because a layer that is *on* must keep its chip whatever the
 * step says — otherwise turning a layer off mid-lesson can strand another one
 * drawn with no way to remove it.
 */
export interface Lesson {
  readonly steps: readonly Step[];
  readonly finished: Finished;
  readonly chips: (index: number, now: MapNow) => readonly LayerKey[];
  /**
   * The lesson points at one particular pit, so the guide has to choose one.
   *
   * True only for drainage, which asks the reader to press a pit and then
   * follow the water out of it — and a quarter of the pits in this extent have
   * nothing to follow. The other lessons ask for a layer, not for a feature,
   * and choosing a pit for them would be a few hundred graph walks nothing
   * reads.
   */
  readonly teachingPit: boolean;
}

/**
 * Is this step's requirement true of the map right now?
 *
 * `teachingPit` is the one the guide asked for, and is null for a lesson that
 * does not name one. A different pit does not satisfy a `pit-selected` step —
 * not to be strict about it, but because the next step presses *Show connected
 * pipe*, and a quarter of the pits in this extent have nothing to show there.
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
    case 'water-flow-on':
      return now.channel;
    case 'low-areas-on':
      return now.lowPoints;
    case 'unmeasured-on':
      return now.unmeasured;
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

/**
 * A chip rule that unlocks its layers in order and never takes one back.
 *
 * Used by every lesson: give it the layers in the order the steps ask for
 * them, and the step index each one unlocks at. A layer that is already on
 * keeps its chip whatever the step says.
 */
export function unlockingChips(
  order: readonly { readonly key: LayerKey; readonly at: number; readonly on: (now: MapNow) => boolean }[],
): (index: number, now: MapNow) => readonly LayerKey[] {
  return (index, now) => order.filter((l) => index >= l.at || l.on(now)).map((l) => l.key);
}
