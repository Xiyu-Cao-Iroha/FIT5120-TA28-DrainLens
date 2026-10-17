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
 *
 * And again on 17 October, when the team added three steps in the middle:
 * the guide now walks the reader through choosing the drain the report is
 * about, which the product could always do and the guide never mentioned.
 */

import { describe, expect, it } from 'vitest';

import { PROBLEM_TYPES, SPOT_A_PROBLEM } from '../report/problems.js';
import { REPORT_PROBLEM, REPORT_PROBLEM_STEPS } from './reportProblem.js';
import { NOTHING_ON_MAP, latch, satisfied, stepIndex, usesReport } from './lesson.js';

const ids = REPORT_PROBLEM_STEPS.map((step) => step.id);

describe('the steps are the design’s six frames', () => {
  it('asks for the chip, a problem, a drain, and then reads the row it landed in', () => {
    expect(ids).toEqual([
      'report-open', // E6 / 01
      'problem-choose', // E6 / 02
      'drain-pick', // E6 / 03
      'drain-tap', // E6 / 04
      'drain-confirm', // E6 / 05
      'drain-reviewed', // E6 / 06
    ]);
  });

  it('keeps the whole drain choice on the guide’s own map', () => {
    /*
      The team's note is explicit that none of these steps may open the full
      map, and nothing here does: the three new waits are on state the map
      reports about itself (`drain-picking`, `drain-candidate`,
      `drain-chosen`), and the map they are about is whichever one the
      reader is looking at. In a guide that is the frame beside the step.
    */
    const waits = REPORT_PROBLEM_STEPS.filter((step) => step.kind === 'do');
    expect(waits.map((step) => step.requires)).toEqual([
      'report-opened',
      'problem-chosen',
      'drain-picking',
      'drain-candidate',
      'drain-chosen',
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
    // changes, and says *select X* about something called Y.
    expect(REPORT_PROBLEM_STEPS[0]?.prompt).toBe(`Select ${SPOT_A_PROBLEM}.`);
  });

  it('names no problem type, because the reader picks what they can see', () => {
    // D2 rings *Blocked or flooded street drain* as an example and the step
    // beside it says *Choose the problem you can see*. Any of the five ends
    // the step.
    const prompts = REPORT_PROBLEM_STEPS.map((step) => step.prompt).join(' ');
    for (const problem of PROBLEM_TYPES) expect(prompts).not.toContain(problem.label);
  });

  it('ends by pointing at the row the answer landed in, not at the map', () => {
    // The team's note: *orange outline encloses the complete Which drain
    // information*, and not the whole map or a Full Map button.
    const last = REPORT_PROBLEM_STEPS.at(-1);
    expect(last?.kind).toBe('read');
    expect(last?.points).toBe('which-drain');
    expect(last?.kind === 'read' ? last.note : '').toMatch(/^Which drain now shows your selection/);
  });

  it('names what this guide finished, rather than counting all of them', () => {
    // It was D5's *Well done! You finished all 7 guides.*, which is true of
    // a reader who worked through the list and not of one who jumped here.
    expect(REPORT_PROBLEM.finished.headline).toBe('You finished the report guide.');
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

  it('then waits on a problem type before it asks about a drain', () => {
    const opened = latch(NOTHING_ON_MAP, { ...NOTHING_ON_MAP, reportOpened: true });
    const chosen = latch(opened, { ...opened, problemChosen: true });
    expect(walk(chosen)).toBe(2);
  });

  it('walks the drain choice in order, and does not go back when it is done', () => {
    /*
      Each of the three undoes the state the one before it read: confirming
      leaves the picker and clears the tapped drain. Latched, they hold, and
      a reader who finishes the guide stays finished. Unlatched, pressing
      *Use this drain* would have sent them back two steps.
    */
    let now = latch(NOTHING_ON_MAP, { ...NOTHING_ON_MAP, reportOpened: true, problemChosen: true });
    now = latch(now, { ...now, drainPicking: true });
    expect(walk(now)).toBe(3);
    now = latch(now, { ...now, drainCandidate: true });
    expect(walk(now)).toBe(4);
    now = latch(now, { ...now, drainChosen: true, drainPicking: false, drainCandidate: false });
    // Past the last step, because this walk acknowledges every reading: the
    // point is that it is forward of where it was, not back at step three.
    expect(walk(now)).toBe(REPORT_PROBLEM_STEPS.length);
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
