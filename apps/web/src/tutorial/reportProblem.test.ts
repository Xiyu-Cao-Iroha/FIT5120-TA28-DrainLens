/**
 * Epic 6's guide against the frames it was rebuilt from.
 *
 * **Written because the previous version of this list was not checked
 * against anything.** Three of its four steps were mine, the design had
 * other ones, and nothing in the suite could tell. The assertions below name
 * the frame each step comes from, so the next person to change a prompt has
 * to either match a frame or change the line that cites it.
 *
 * Rebuilt again on 11 October, when the frames themselves changed: D1 to D5
 * are now *Report guide*, and the subcatchment boundary they used to open on
 * is in none of them.
 */

import { describe, expect, it } from 'vitest';

import { PROBLEM_TYPES, SPOT_A_PROBLEM } from '../report/problems.js';
import { REPORT_PROBLEM, REPORT_PROBLEM_STEPS } from './reportProblem.js';
import { NOTHING_ON_MAP, latch, satisfied, stepIndex, usesReport } from './lesson.js';

const ids = REPORT_PROBLEM_STEPS.map((step) => step.id);

describe('the steps are the design’s three frames', () => {
  it('asks for the chip, then a problem type, then reads who to contact', () => {
    expect(ids).toEqual([
      'report-open', // D1
      'problem-choose', // D2
      'contact-shown', // D3
    ]);
  });

  it('has dropped the drainage area, which the frames no longer teach', () => {
    const words = JSON.stringify(REPORT_PROBLEM_STEPS);
    expect(words).not.toMatch(/subcatchment|drainage area|boundary/i);
    // And asks for no layer at all, which is why it offers no chip.
    expect(REPORT_PROBLEM.chips(0, NOTHING_ON_MAP)).toEqual([]);
  });

  it('names the control by the same constant the map renders', () => {
    // A prompt that spells a label out by hand goes stale the day the label
    // changes, and says *click X* about something called Y.
    expect(REPORT_PROBLEM_STEPS[0]?.prompt).toBe(`Click ${SPOT_A_PROBLEM}.`);
  });

  it('names no problem type, because the reader picks what they can see', () => {
    // D2 rings *Blocked or flooded street drain* as an example and the step
    // beside it says *Choose the problem you can see*. Any of the five ends
    // the step.
    const prompts = REPORT_PROBLEM_STEPS.map((step) => step.prompt).join(' ');
    for (const problem of PROBLEM_TYPES) expect(prompts).not.toContain(problem.label);
  });

  it('ends on the sentence D3 puts under its heading', () => {
    const last = REPORT_PROBLEM_STEPS[2];
    expect(last?.kind === 'read' ? last.note : undefined).toBe(
      'Copy or print the details. DrainLens does not send the report for you.',
    );
  });

  it('finishes with D5, which claims all seven rather than naming itself', () => {
    expect(REPORT_PROBLEM.finished.headline).toBe('Well done! You finished all 7 guides.');
  });
});

describe('what the guide waits for', () => {
  const walk = (now: Parameters<typeof satisfied>[1]): number =>
    stepIndex(REPORT_PROBLEM_STEPS, now, null, 99);

  it('does not move off the chip until the panel is open', () => {
    expect(walk(NOTHING_ON_MAP)).toBe(0);
    const opened = latch(NOTHING_ON_MAP, { ...NOTHING_ON_MAP, reportOpened: true });
    expect(walk(opened)).toBe(1);
  });

  it('then waits on a problem type, and finishes on the reading', () => {
    const opened = latch(NOTHING_ON_MAP, { ...NOTHING_ON_MAP, reportOpened: true });
    const chosen = latch(opened, { ...opened, problemChosen: true });
    expect(walk(chosen)).toBe(3);
  });

  it('latches both, so closing the panel does not send the reader back', () => {
    // The panel can be closed and a chosen problem can be changed. Neither
    // un-does the press the step was waiting for.
    const opened = latch(NOTHING_ON_MAP, { ...NOTHING_ON_MAP, reportOpened: true });
    const closedAgain = latch(opened, { ...opened, reportOpened: false });
    expect(satisfied('report-opened', closedAgain, null)).toBe(true);
  });
});

describe('the report flow is reachable from inside this guide', () => {
  it('says so from its own steps, not from the lesson’s name', () => {
    // The map hides the reporting pathway during a guide. This is the one
    // lesson that needs it, and `MapView` asks this rather than matching on
    // an id. It is also what puts the chip in the guide's chip row.
    expect(usesReport(REPORT_PROBLEM_STEPS)).toBe(true);
  });
});
