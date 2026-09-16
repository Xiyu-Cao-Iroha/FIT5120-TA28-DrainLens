/**
 * What each lesson puts within reach, and the invariants all three share.
 *
 * The rule is *everything on screen during a step is something the step is
 * about*, and it is worth a test rather than a glance because the failure is
 * quiet: an extra chip does not break anything, it just lets somebody press
 * past the instruction they were given and then read a sentence about a map
 * they have already left behind.
 *
 * These run over every lesson rather than over one, because the second and
 * third were written by copying the first — which is exactly the situation
 * where a property that holds in one place and not the others goes unnoticed.
 */

import { describe, expect, it } from 'vitest';

import {
  type MapNow,
  type Step,
  NOTHING_ON_MAP,
  chipFor,
  highlightFor,
  latch,
  satisfied,
  stepBack,
  stepForward,
  stepIndex,
} from './lesson.js';
import { GUIDED_SECTIONS, LESSONS, lessonFor } from './lessons.js';
import { SECTION_ORDER, SECTIONS } from './sections.js';
import { CHIP_KEYS, PANEL_KEYS } from '../map/modes.js';

const now = (over: Partial<MapNow> = {}): MapNow => ({ ...NOTHING_ON_MAP, ...over });

/**
 * Whether the step after this one is the feedback for it.
 *
 * It is after a `do` step, unless that step says its own `done` line, which
 * the ground height guide's do: the step after one of those is the next thing
 * to learn, not praise for the last press.
 */
const isPressFeedback = (before: Step | undefined): boolean =>
  before?.kind === 'do' && before.done === undefined;

/** The lessons as pairs, so a failure names the section it is in. */
const written = GUIDED_SECTIONS.map((id) => [id, LESSONS[id]!] as const);

describe('which sections are on offer', () => {
  it('offers exactly the sections that have a lesson', () => {
    expect(GUIDED_SECTIONS).toEqual(['drainage', 'water-flow', 'low-areas', 'terrain']);
    for (const id of GUIDED_SECTIONS) expect(lessonFor(id)).toBeDefined();
  });

  it('offers terrain now that it has steps, and every section has one', () => {
    // It was left out until 16 September rather than offered as an empty
    // room: a lesson that walked somebody through nothing would count as
    // finished and teach nothing.
    expect(lessonFor('terrain')?.steps.length).toBeGreaterThan(0);
    expect(GUIDED_SECTIONS).toEqual(SECTION_ORDER);
  });

  it('offers them in the order the cards sit in', () => {
    // Derived from `SECTION_ORDER` rather than from the object's key order,
    // which is whichever order somebody happened to type the lessons in.
    const expected = SECTION_ORDER.filter((id) => id in LESSONS);
    expect(GUIDED_SECTIONS).toEqual(expected);
  });
});

describe.each(written)('%s', (id, lesson) => {
  it('asks for something at every step that can be acted on', () => {
    for (const step of lesson.steps) {
      if (step.kind === 'do') expect(step.requires).toBeTruthy();
      else expect(step.prompt.length).toBeGreaterThan(0);
    }
  });

  it('has a unique id for every step', () => {
    const ids = lesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('opens on step one with nothing on the map', () => {
    expect(stepIndex(lesson.steps, NOTHING_ON_MAP, null, 0)).toBe(0);
  });

  it('starts with a step that asks for something, not one that talks', () => {
    // A lesson that opens by explaining has not yet given anybody a reason to
    // read it. Every one of these opens by turning a layer on.
    expect(lesson.steps[0]?.kind).toBe('do');
  });

  it('ends on a step, and the finish panel says what was unlocked', () => {
    expect(lesson.finished.headline.length).toBeGreaterThan(0);
    expect(lesson.finished.unlocked.length).toBeGreaterThan(0);
  });

  it('offers at most one chip on the first step', () => {
    // The section narrows the map to its layers; the step narrows it to the
    // one being taught. Step one beside a control for step three is an
    // invitation to press the wrong thing. Ground height offers none: its
    // layer is behind the Layers button, which its map shows instead.
    const chips = lesson.chips(0, NOTHING_ON_MAP);
    expect(chips.length).toBeLessThanOrEqual(1);
    if (chips.length === 0) expect(lesson.mapChrome?.layersButton).toBe(true);
  });

  it('shows the Layers button exactly when a step asks for something behind it', () => {
    const behind = lesson.steps.some(
      (s) => s.kind === 'do' && ['layers-opened', 'terrain-shown', 'terrain-off'].includes(s.requires),
    );
    expect(lesson.mapChrome?.layersButton ?? false).toBe(behind);
  });

  it('offers a chip for every layer its steps ask for, by the step that asks', () => {
    /*
     * The bug this catches: a step that says *Select Likely water paths* with
     * no chip for it on screen. It waits forever, and nothing else fails.
     */
    const wanted: Partial<Record<string, string>> = {
      'pits-on': 'pit',
      'pipes-on': 'pipe',
      'water-flow-on': 'channel',
      'low-areas-on': 'lowPoint',
      'unmeasured-on': 'unavailable',
    };
    lesson.steps.forEach((step, at) => {
      if (step.kind !== 'do') return;
      const key = wanted[step.requires];
      if (key === undefined) return; // pit-selected and trace-following are not chips
      expect(lesson.chips(at, NOTHING_ON_MAP)).toContain(key);
      // And the chip the guide outlines while this step waits is that same
      // chip, so the outline never points at one that is not on screen
      // (copy audit v2, #21).
      expect(chipFor(step.requires)).toBe(key);
    });
  });

  it('keeps to the audit writing rules', () => {
    /*
     * Copy audit v2, appendix A: an instruction is one sentence of at most 16
     * words; the feedback after a correct press starts with praise and stays
     * within 12 words; no em dashes; the finish page says well done.
     *
     * The ground height guide's finish page is its design's (Figma Terrain
     * Tutorial, frame 10): a *Guide complete* chip and a heading, not the
     * well-done sentence. It is the one lesson with a `badge`.
     */
    const words = (s: string) => s.trim().split(/\s+/).length;
    lesson.steps.forEach((step, at) => {
      expect(step.prompt).not.toContain('—');
      expect(step.body ?? '').not.toContain('—');
      if (step.kind === 'do') {
        expect(words(step.prompt)).toBeLessThanOrEqual(16);
        expect(step.prompt).not.toMatch(/^Select\b/);
      } else if (isPressFeedback(lesson.steps[at - 1])) {
        expect(step.prompt).toMatch(/^(Great|Nice|Good)\b/);
        expect(words(step.prompt)).toBeLessThanOrEqual(12);
      }
    });
    if (lesson.finished.badge === undefined) {
      expect(lesson.finished.headline).toMatch(/^Well done! You finished the .+ guide\.$/);
    }
    expect(lesson.finished.body).toBeUndefined();
  });

  it('never takes away the chip for a layer that is on', () => {
    /*
     * The trap. Every lesson has a step whose requirement depends on an
     * earlier layer, so turning that layer off sends the guide backwards —
     * and a chip list keyed only on the step would drop the later layer at
     * the same moment, leaving it drawn with no control to remove it. A map
     * holding something the reader cannot take back is worse than a map
     * offering one thing early.
     */
    const everything = now({
      pits: true,
      pipes: true,
      channel: true,
      lowPoints: true,
      unmeasured: true,
    });
    const atStart = lesson.chips(0, everything);
    const atEnd = lesson.chips(lesson.steps.length, everything);
    expect(atStart).toEqual(atEnd);
  });

  it('only offers chips the map actually draws', () => {
    const drawable = new Set([...CHIP_KEYS, ...PANEL_KEYS]);
    for (const key of lesson.chips(lesson.steps.length, NOTHING_ON_MAP)) {
      expect(drawable.has(key)).toBe(true);
    }
  });

  it('is finished by doing what it asks, and not before', () => {
    // Walked rather than asserted: satisfy each `do` in turn, acknowledge each
    // `read`, and check the guide is only finished at the end.
    let state = NOTHING_ON_MAP;
    const pit = lesson.teachingPit ? '1144908' : null;
    lesson.steps.forEach((step, at) => {
      expect(stepIndex(lesson.steps, state, pit, at)).toBe(at);
      if (step.kind === 'do') {
        state = turnOn(state, step.requires, pit);
        expect(satisfied(step.requires, state, pit)).toBe(true);
        // A step that holds for its done line is still here until Next.
        if (step.confirm === true) expect(stepIndex(lesson.steps, state, pit, at)).toBe(at);
      }
    });
    expect(stepIndex(lesson.steps, state, pit, lesson.steps.length)).toBe(lesson.steps.length);
  });

  it('has a label on its card', () => {
    expect(SECTIONS[id].label.length).toBeGreaterThan(0);
  });
});

/** The smallest change to the map that satisfies one requirement. */
function turnOn(state: MapNow, requires: string, pit: string | null): MapNow {
  switch (requires) {
    case 'pits-on':
      return { ...state, pits: true };
    case 'pipes-on':
      return { ...state, pits: true, pipes: true };
    case 'water-flow-on':
      return { ...state, channel: true };
    case 'low-areas-on':
      return { ...state, lowPoints: true };
    case 'unmeasured-on':
      return { ...state, unmeasured: true };
    case 'pit-selected':
      return { ...state, selectedPit: pit };
    case 'trace-following':
      return { ...state, followingPit: pit };
    case 'layers-opened':
      return latch(state, { ...state, layersOpen: true });
    case 'terrain-shown':
      return latch(state, { ...state, terrain: true });
    case 'terrain-off':
      return latch(state, { ...state, terrain: false });
    default:
      throw new Error(`no way to satisfy ${requires}`);
  }
}

describe('only drainage points at a particular pit', () => {
  it('is the one lesson that needs a teaching pit chosen', () => {
    // The other two ask for a layer. Choosing a pit for them would be a few
    // hundred graph walks that nothing reads.
    expect(lessonFor('drainage')?.teachingPit).toBe(true);
    expect(lessonFor('water-flow')?.teachingPit).toBe(false);
    expect(lessonFor('low-areas')?.teachingPit).toBe(false);
    expect(lessonFor('terrain')?.teachingPit).toBe(false);
  });

  it('and it is the only one whose steps ask for a feature', () => {
    for (const [id, lesson] of written) {
      const featureSteps = lesson.steps.filter(
        (s) => s.kind === 'do' && (s.requires === 'pit-selected' || s.requires === 'trace-following'),
      );
      if (id === 'drainage') expect(featureSteps.length).toBeGreaterThan(0);
      else expect(featureSteps).toHaveLength(0);
    }
  });
});

describe('what the ground height guide added to every lesson', () => {
  const doStep = (requires: Parameters<typeof satisfied>[0], extra: Partial<Step> = {}): Step =>
    ({ kind: 'do', id: requires, prompt: 'Do it', requires, ...extra }) as Step;
  const quiz: Step = {
    kind: 'quiz',
    id: 'q',
    prompt: 'Which?',
    options: [
      { label: 'A', correct: true },
      { label: 'B', correct: false },
    ],
    right: 'Yes.',
    wrong: 'No.',
  };

  it('latches an opened panel and a shown layer, and nothing else', () => {
    const opened = latch(NOTHING_ON_MAP, now({ layersOpen: true, terrain: true }));
    expect(opened).toMatchObject({ layersOpened: true, terrainShown: true });
    const closed = latch(opened, now({ layersOpen: false, terrain: false, pits: true }));
    expect(closed).toMatchObject({
      layersOpen: false,
      terrain: false,
      pits: true,
      layersOpened: true,
      terrainShown: true,
    });
    expect(latch(NOTHING_ON_MAP, NOTHING_ON_MAP)).toEqual(NOTHING_ON_MAP);
  });

  it('reads the three new requirements', () => {
    expect(satisfied('layers-opened', NOTHING_ON_MAP, null)).toBe(false);
    expect(satisfied('layers-opened', now({ layersOpen: true }), null)).toBe(true);
    expect(satisfied('layers-opened', now({ layersOpened: true }), null)).toBe(true);
    expect(satisfied('terrain-shown', now({ terrain: true }), null)).toBe(true);
    expect(satisfied('terrain-shown', now({ terrainShown: true }), null)).toBe(true);
    expect(satisfied('terrain-shown', NOTHING_ON_MAP, null)).toBe(false);
    expect(satisfied('terrain-off', NOTHING_ON_MAP, null)).toBe(true);
    expect(satisfied('terrain-off', now({ terrain: true, terrainShown: true }), null)).toBe(false);
    for (const r of ['layers-opened', 'terrain-shown', 'terrain-off'] as const) expect(chipFor(r)).toBeNull();
  });

  it('lets step two stay done while a later step asks for the opposite', () => {
    const steps = [doStep('terrain-shown'), doStep('terrain-off')];
    const shownThenOff = latch(latch(NOTHING_ON_MAP, now({ terrain: true })), now({ terrain: false }));
    expect(stepIndex(steps, now({ terrain: true }), null, 0)).toBe(1);
    expect(stepIndex(steps, shownThenOff, null, 0)).toBe(2);
    // Without the latch, turning it off would go back to the first step.
    expect(stepIndex(steps, now({ terrain: false }), null, 0)).toBe(0);
  });

  it('holds a question until Next, like a read step', () => {
    expect(stepIndex([quiz], NOTHING_ON_MAP, null, 0)).toBe(0);
    expect(stepIndex([quiz], NOTHING_ON_MAP, null, 1)).toBe(1);
  });

  it('outlines the Layers button until the panel is open, then the switch', () => {
    const show = doStep('terrain-shown');
    expect(highlightFor(doStep('layers-opened'), NOTHING_ON_MAP)).toBe('layers');
    expect(highlightFor(show, NOTHING_ON_MAP)).toBe('layers');
    expect(highlightFor(show, now({ layersOpen: true }))).toBe('terrain-toggle');
    expect(highlightFor(doStep('terrain-off'), now({ layersOpen: true }))).toBe('terrain-toggle');
    expect(highlightFor(doStep('pits-on'), NOTHING_ON_MAP)).toBeNull();
    expect(highlightFor(doStep('pits-on', { highlight: 'terrain-legend' }), NOTHING_ON_MAP)).toBe('terrain-legend');
    expect(highlightFor(quiz, NOTHING_ON_MAP)).toBeNull();
    expect(highlightFor({ ...quiz, highlight: 'terrain-legend' }, NOTHING_ON_MAP)).toBe('terrain-legend');
  });

  it('walks Previous back, and Next forward to where the map is', () => {
    expect(stepBack(0)).toBe(0);
    expect(stepBack(4)).toBe(3);
    // From the finish page of nine steps, to the last step.
    expect(stepBack(9)).toBe(8);
    expect(stepForward(2, 5)).toBe(3);
    // Reaching the live step lets go of the cursor.
    expect(stepForward(4, 5)).toBeNull();
    expect(stepForward(8, 9)).toBeNull();
  });
});
