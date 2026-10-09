/**
 * Epic 6's guide against the frames it was rebuilt from.
 *
 * **Written because the previous version of this list was not checked against
 * anything.** Three of its four steps were mine, the design had four other
 * ones, and nothing in the suite could tell. The assertions below name the
 * frame each step comes from, so the next person to change a prompt has to
 * either match a frame or change the line that cites it.
 */

import { describe, expect, it } from 'vitest';

import { BLOCKED_DRAIN, PROBLEM_TYPES, REPORT_HEADING } from '../report/problems.js';
import { CATCHMENT_CHIP } from '../catchment/wording.js';
import { DRAINAGE_AREA_STEPS } from './drainageArea.js';
import { NOTHING_ON_MAP, latch, satisfied, stepIndex, usesReport } from './lesson.js';

const ids = DRAINAGE_AREA_STEPS.map((step) => step.id);

describe('the steps are the design’s four frames', () => {
  it('asks for the chip, then the boundary, then the report, then a problem type', () => {
    expect(ids).toEqual([
      'catchment-on', // D1
      'catchment-shown', // D2
      'report-open', // D3
      'problem-choose', // D4
      'contact-shown', // D4b
    ]);
  });

  it('no longer sends anybody to the organisations fold', () => {
    // It was step three until 10 October and is on no frame in the file.
    // The fold itself stays on the card; the guide does not point at it.
    const prompts = DRAINAGE_AREA_STEPS.map((step) => step.prompt).join(' ');
    expect(prompts).not.toMatch(/organisations/i);
  });

  it('names the controls by the same constants the screens render', () => {
    // A prompt that spells a label out by hand goes stale the day the label
    // changes, and says *click X* about something called Y.
    expect(DRAINAGE_AREA_STEPS[0]?.prompt).toContain(CATCHMENT_CHIP);
    expect(DRAINAGE_AREA_STEPS[2]?.prompt).toContain(REPORT_HEADING);
    expect(DRAINAGE_AREA_STEPS[3]?.prompt).toContain(BLOCKED_DRAIN);
  });

  it('names a problem type that exists', () => {
    expect(PROBLEM_TYPES.map((problem) => problem.label)).toContain(BLOCKED_DRAIN);
  });

  it('opens its feedback on the sentence, not on praise', () => {
    // Figma D2 has no *Great!*. That opener was a house convention of mine
    // and `lessons.test.ts` used to require it.
    const feedback = DRAINAGE_AREA_STEPS.filter((step) => step.kind === 'read');
    expect(feedback).toHaveLength(2);
    for (const step of feedback) {
      expect(step.prompt).not.toMatch(/^(Great|Nice|Good)\b/);
    }
  });

  it('keeps the two sentences that bound what the boundary means', () => {
    // AC 6.1.4, and the promise the report flow must not quietly drop.
    const second = DRAINAGE_AREA_STEPS[1];
    expect(second?.kind === 'read' ? second.note : undefined).toBe(
      'It shows drainage, not how far a flood could reach.',
    );
    const last = DRAINAGE_AREA_STEPS[4];
    expect(last?.kind === 'read' ? last.note : undefined).toBe(
      'DrainLens does not send the report for you.',
    );
  });
});

describe('what the guide waits for', () => {
  const walk = (now: Parameters<typeof satisfied>[1]): number =>
    stepIndex(DRAINAGE_AREA_STEPS, now, null, 99);

  it('does not move off the chip until the boundary is drawn', () => {
    expect(walk(NOTHING_ON_MAP)).toBe(0);
    expect(walk({ ...NOTHING_ON_MAP, catchment: true })).toBe(2);
  });

  it('waits on the report panel, then on a problem type', () => {
    const drawn = { ...NOTHING_ON_MAP, catchment: true };
    expect(walk(drawn)).toBe(2);

    const opened = latch(drawn, { ...drawn, reportOpened: true });
    expect(walk(opened)).toBe(3);

    const chosen = latch(opened, { ...opened, problemChosen: true });
    expect(walk(chosen)).toBe(5);
  });

  it('latches both, so closing the panel does not send the reader back', () => {
    // The panel can be closed and a chosen problem can be changed. Neither
    // un-does the press the step was waiting for.
    const drawn = { ...NOTHING_ON_MAP, catchment: true };
    const opened = latch(drawn, { ...drawn, reportOpened: true });
    const closedAgain = latch(opened, { ...opened, reportOpened: false });
    expect(satisfied('report-opened', closedAgain, null)).toBe(true);
  });
});

describe('the report flow is reachable from inside this guide', () => {
  it('says so from its own steps, not from the lesson’s name', () => {
    // The map hides *Report a problem* during a guide. This is the one
    // lesson that needs it, and `MapView` asks this rather than matching
    // on an id.
    expect(usesReport(DRAINAGE_AREA_STEPS)).toBe(true);
  });
});
