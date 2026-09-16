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
import type { TerrainPoints } from './terrainPoints.js';


/** What a `do` step is waiting for. */
export type Requirement =
  | 'pits-on'
  | 'pipes-on'
  | 'pit-selected'
  | 'trace-following'
  | 'water-flow-on'
  | 'low-areas-on'
  | 'unmeasured-on'
  /*
    The ground height guide's three, Figma Terrain Tutorial, 16 September.

    The first two are *latched*: true once the thing has happened during this
    lesson, whatever the map shows now. They have to be, because step nine asks
    for the opposite of step two -- Ground height off -- and `stepIndex` walks
    the steps in order: a step two that read the map as it is would send the
    reader back to it the moment they did what step nine asked. The guide
    accumulates them with `latch`. The third is read as the map is now.
  */
  | 'layers-opened'
  | 'terrain-shown'
  | 'terrain-off';

/**
 * A control on the map the guide can outline, besides a chip.
 *
 * `layers` is the Layers button, `terrain-toggle` the Ground height checkbox
 * inside its panel, and `terrain-legend` the ground-height scale in the map
 * legend.
 */
export type Highlight = 'layers' | 'terrain-toggle' | 'terrain-legend';

/**
 * What the guide draws over the map for a step, in the map's own frame.
 *
 * Named rather than carried as coordinates, because the step is copy and the
 * points are data: `tutorial/terrainPoints.ts` chooses them near the address,
 * and the guide turns the name into marks. A step whose data is missing has
 * no mark rather than an invented one.
 */
export type GuideMark = 'height-pair' | 'height-spot' | 'height-compare' | 'contour' | 'slope-example';

/** A box under a step's heading, as the ground height guide draws them. */
export type StepCard =
  | { readonly kind: 'ramp' }
  | { readonly kind: 'height'; readonly value: string; readonly text: string }
  | {
      readonly kind: 'reading';
      readonly value: string;
      readonly note: string;
      readonly compare: string | null;
    }
  | { readonly kind: 'warning'; readonly title: string; readonly text: string };

export interface QuizOption {
  readonly label: string;
  readonly correct: boolean;
}

/** A folded card under a quiz, with a line sample beside each sentence. */
export interface MoreInfo {
  readonly title: string;
  readonly items: readonly { readonly sample: 'thin' | 'bold'; readonly text: string }[];
}

/** What every kind of step can carry besides its heading. */
interface StepExtras {
  /**
   * One line under the heading. The ground height guide has a heading and a
   * sentence on every step; the other three lessons put their one sentence
   * in `prompt` and leave this out.
   */
  readonly body?: string;
  readonly card?: StepCard;
  readonly mark?: GuideMark;
  /** Outlined on the map while this step is shown. `do` steps derive theirs. */
  readonly highlight?: Highlight;
}

export type Step =
  | (StepExtras & {
      readonly kind: 'do';
      readonly id: string;
      readonly prompt: string;
      /** Said under the prompt, where it needs a second sentence. */
      readonly hint?: string;
      readonly requires: Requirement;
      /**
       * Said once the action is done, and shown for a `do` step looked back
       * at with Previous.
       */
      readonly done?: string;
      /**
       * Hold on this step once it is done, until Next is pressed, so `done`
       * is read. Without it the step moves on the moment the map matches,
       * which for a last step means its `done` line is never seen.
       */
      readonly confirm?: true;
    })
  | (StepExtras & {
      readonly kind: 'read';
      readonly id: string;
      readonly prompt: string;
      /**
       * One short line of small print under the prompt, where a step keeps a
       * caveat. The prompt is the feedback after a correct press and starts
       * *Great!*; a caveat folded into it turned the heading into a disclaimer
       * (copy audit v2, #36, #50).
       */
      readonly note?: string;
    })
  /**
   * A question about the map, with one right answer.
   *
   * Passed the way a `read` step is, by Next, and Next only appears once the
   * right answer has been chosen. A wrong answer says why and leaves the
   * options open. No greyed-out Next beside the options: the lesson's rule
   * that a disabled button reads as the way forward being broken (copy audit
   * v2, #21) holds here too.
   */
  | (StepExtras & {
      readonly kind: 'quiz';
      readonly id: string;
      readonly prompt: string;
      /** In a box above the options. */
      readonly question?: string;
      readonly questionHint?: string;
      readonly options: readonly QuizOption[];
      readonly right: string;
      readonly wrong: string;
      readonly more?: MoreInfo;
    });

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
  /** Ground height, drawn now. */
  readonly terrain: boolean;
  /** The Layers panel, open now. */
  readonly layersOpen: boolean;
  /** Latched: the Layers panel has been open during this lesson. See `latch`. */
  readonly layersOpened: boolean;
  /** Latched: Ground height has been on during this lesson. */
  readonly terrainShown: boolean;
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
  terrain: false,
  layersOpen: false,
  layersOpened: false,
  terrainShown: false,
};

/**
 * The map's new report, with the latched facts kept from the old one.
 *
 * The map reports what it shows; it does not know what it showed a minute
 * ago, and it should not have to. The guide keeps that, here, so a panel
 * closed again or a layer turned back off does not undo a step that asked for
 * it to be opened or turned on.
 */
export const latch = (before: MapNow, next: MapNow): MapNow => ({
  ...next,
  layersOpened: before.layersOpened || next.layersOpened || next.layersOpen,
  terrainShown: before.terrainShown || next.terrainShown || next.terrain,
});

/**
 * What the guide says when a section is finished.
 *
 * `unlocked` is one sentence: where the section's layer can be used on the
 * full map. `body` is optional and no lesson sets one now: the paragraph
 * between the two retold the data the reader had just worked with, where a
 * finish page is there to say well done (copy audit v2, #31, #42, #51).
 */
export interface Finished {
  readonly headline: string;
  readonly body?: string;
  readonly unlocked: string;
  /**
   * A small label over the headline. Set only by the ground height guide,
   * whose design draws a *Guide complete* chip, a heading and one line, with
   * a way back to the last step.
   */
  readonly badge?: string;
}

/** The screen before step one, where a lesson has one. */
export interface LessonIntro {
  /** How long it takes, as a chip. */
  readonly duration: string;
  readonly heading: string;
  readonly body: string;
}

/** How the guide's map is dressed for a lesson that is not the default. */
export interface MapChrome {
  /** The Layers button, for a lesson whose layer lives behind it. */
  readonly layersButton: boolean;
  /** The map legend, for a lesson that points at it. */
  readonly legend: boolean;
  /** A wider frame, so the legend does not cover half the map. */
  readonly wide: boolean;
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
  /** An entry screen before step one. Only the ground height guide has one. */
  readonly intro?: LessonIntro;
  /**
   * Previous, to look back at a step already passed. Opt-in: the three
   * older lessons were designed without it. See `stepBack`.
   */
  readonly previous?: boolean;
  readonly mapChrome?: MapChrome;
  /**
   * The steps, given the ground near the address.
   *
   * The ground height guide names real heights, and which it can name depends
   * on the data near the address, so its steps are a function of that. Null
   * means none could be chosen (or not yet): the steps then use general
   * wording and no marks. The step count and ids do not change with it, so
   * the data arriving mid-lesson cannot move the reader.
   */
  readonly withGround?: (points: TerrainPoints | null) => readonly Step[];
}

/**
 * The chip a requirement is waiting on, or null when it is not a chip.
 *
 * The guide outlines this chip while the step waits. It replaced the line
 * *Waiting for you to try it* under every `do` step, which read like a system
 * log and said nothing about where to press (copy audit v2, #21). The pit and
 * the connected-pipe button are not chips: the pit has its ring, and the
 * button is on the pit's own card.
 */
export function chipFor(requires: Requirement): LayerKey | null {
  switch (requires) {
    case 'pits-on':
      return 'pit';
    case 'pipes-on':
      return 'pipe';
    case 'water-flow-on':
      return 'channel';
    case 'low-areas-on':
      return 'lowPoint';
    case 'unmeasured-on':
      return 'unavailable';
    case 'pit-selected':
    case 'trace-following':
    case 'layers-opened':
    case 'terrain-shown':
    case 'terrain-off':
      return null;
  }
}

/**
 * What to outline on the map for a step, besides a chip.
 *
 * A `do` step that needs the Layers panel outlines the button while the panel
 * is shut and the checkbox once it is open, so the outline is always on
 * something that can be pressed. Other steps say what they point at.
 */
export function highlightFor(step: Step, now: MapNow): Highlight | null {
  if (step.kind !== 'do') return step.highlight ?? null;
  switch (step.requires) {
    case 'layers-opened':
      return 'layers';
    case 'terrain-shown':
    case 'terrain-off':
      return now.layersOpen ? 'terrain-toggle' : 'layers';
    default:
      return step.highlight ?? null;
  }
}

/**
 * Is this step's requirement true of the map right now?
 *
 * **Any pit satisfies `pit-selected`** (team request, 16 September). It used
 * to be only the pit the guide ringed, on the reasoning that a quarter of the
 * pits in this extent have no connected pipe to show next; in use, a reader who
 * pressed the pit beside the ringed one was told nothing and stayed stuck. The
 * ring stays as a suggestion, and the guide says so when the chosen pit has no
 * recorded pipe (`Guide.tsx`). `trace-following` asks for the pit that is
 * selected, so the connected pipe shown is the one for the pit just pressed.
 *
 * `teachingPit` is kept in the signature for the lessons that name one; no
 * requirement reads it now.
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
      return now.selectedPit !== null;
    case 'trace-following':
      return now.followingPit !== null && now.followingPit === now.selectedPit;
    case 'layers-opened':
      return now.layersOpened || now.layersOpen;
    case 'terrain-shown':
      return now.terrainShown || now.terrain;
    case 'terrain-off':
      return !now.terrain;
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
 * which is what `acknowledged` carries. A `quiz` holds the same way, and so
 * does a `do` step marked `confirm`, once its action is done.
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
    if (step.kind !== 'do') {
      if (acknowledged <= index) break;
    } else if (!satisfied(step.requires, now, teachingPit)) {
      break;
    } else if (step.confirm === true && acknowledged <= index) {
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

/**
 * The step Previous shows, from the one on screen.
 *
 * Previous is a view cursor over the derived step, not a way of undoing it:
 * the map stays as it is, and the reader looks back at what an earlier step
 * said. From the finish page (`shown` equal to the step count) it goes to the
 * last step.
 */
export const stepBack = (shown: number): number => Math.max(0, shown - 1);

/**
 * The step Next shows while looking back, or null once it reaches the step
 * the map is actually on, which is where the cursor lets go.
 */
export const stepForward = (shown: number, live: number): number | null =>
  shown + 1 >= live ? null : shown + 1;
