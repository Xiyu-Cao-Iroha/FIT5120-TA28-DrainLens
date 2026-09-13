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

import { type MapNow, NOTHING_ON_MAP, satisfied, stepIndex } from './lesson.js';
import { GUIDED_SECTIONS, LESSONS, lessonFor } from './lessons.js';
import { SECTION_ORDER, SECTIONS } from './sections.js';
import { CHIP_KEYS, PANEL_KEYS } from '../map/modes.js';

const now = (over: Partial<MapNow> = {}): MapNow => ({ ...NOTHING_ON_MAP, ...over });

/** The lessons as pairs, so a failure names the section it is in. */
const written = GUIDED_SECTIONS.map((id) => [id, LESSONS[id]!] as const);

describe('which sections are on offer', () => {
  it('offers exactly the sections that have a lesson', () => {
    expect(GUIDED_SECTIONS).toEqual(['drainage', 'water-flow', 'low-areas']);
    for (const id of GUIDED_SECTIONS) expect(lessonFor(id)).toBeDefined();
  });

  it('leaves terrain out rather than offering an empty room', () => {
    // The whole map is gated on finishing all four. A fourth lesson that
    // walked somebody through nothing would open the gate and teach nothing.
    expect(GUIDED_SECTIONS).not.toContain('terrain');
    expect(lessonFor('terrain')).toBeUndefined();
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

  it('offers only one chip on the first step', () => {
    // The section narrows the map to its layers; the step narrows it to the
    // one being taught. Step one beside a control for step three is an
    // invitation to press the wrong thing.
    expect(lesson.chips(0, NOTHING_ON_MAP)).toHaveLength(1);
  });

  it('offers a chip for every layer its steps ask for, by the step that asks', () => {
    /*
     * The bug this catches: a step that says *press Water flow* with no Water
     * flow chip on screen. It waits forever, and nothing else fails.
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
    });
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
