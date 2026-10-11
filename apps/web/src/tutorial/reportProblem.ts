/**
 * Spot a drainage problem, step by step — Epic 6's guide.
 *
 * From the team's Figma (file `atD5fleOrhvMjJ5m0pXYGt`, D1 to D3 and D5).
 *
 * **The drainage area is no longer what this guide teaches.** Until
 * 11 October it was: press the boundary chip, read that rain inside the line
 * is recorded as draining to the same place, and only then go on to
 * reporting. The design was rewritten the same day. The frames are now
 * titled *Report guide*, the card on the chooser is *Spot a drainage
 * problem?*, and the subcatchment appears in none of the three steps.
 *
 * The boundary itself has not gone anywhere. It is still a layer, still on
 * the full map, and still has its own card and its section of About the
 * data. What changed is what the guide is for, which is the team's to decide
 * and was decided twice.
 *
 * **Three steps, two of them presses.** Press the *Spot a problem?* chip,
 * choose the problem you can see, read who to contact. The third is a `read`
 * because the panel appears on the choice: there is nothing left to press.
 *
 * **The chip is new.** D1 draws *Spot a problem?* in the guide's chip row,
 * where the other guides put the layer they are about, and the reporting
 * panel is not a layer. `usesReport` turns it on for a lesson whose steps ask
 * for the report, so it exists in this guide and nowhere else.
 *
 * The section id is still `drainage-area`, because `SectionId` is `MapMode`
 * and the modes are the homepage's four ways into the map. Renaming it would
 * be a different change from this one.
 */

import { type Lesson } from './lesson.js';
import { NOT_SENT_YET_SHORT, SPOT_A_PROBLEM } from '../report/problems.js';

export const REPORT_PROBLEM_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    // Figma D1. No line under the heading there, and none here: the chip is
    // ringed and the panel it opens is the next step's subject.
    id: 'report-open',
    prompt: `Click ${SPOT_A_PROBLEM}.`,
    requires: 'report-opened',
  },
  {
    kind: 'do',
    // Figma D2, which rings *Blocked or flooded street drain* and names no
    // problem in the step. Any of the five finishes it: the step asks the
    // reader to choose what they can see, and the frame rings an example.
    id: 'problem-choose',
    prompt: 'Choose the problem you can see.',
    hint: 'Each problem shows who to contact.',
    requires: 'problem-chosen',
  },
  {
    kind: 'read',
    // Figma D3.
    id: 'contact-shown',
    prompt: 'This is who to contact and what to tell them.',
    note: `Copy or print the details. ${NOT_SENT_YET_SHORT}`,
  },
];

export const REPORT_PROBLEM: Lesson = {
  steps: REPORT_PROBLEM_STEPS,
  finished: {
    /*
      Figma D5, word for word, including the claim about all seven.

      It is the last guide in `SECTION_ORDER`, and the chooser counts seven,
      so a reader who reaches this page by working through the list has in
      fact finished them all. A reader who jumps straight here has not, which
      the design accepts and the chooser corrects the moment they go back.
    */
    headline: 'Well done! You finished all 7 guides.',
    unlocked:
      'Your address and plan are set up there. Report a drainage problem from the full map at any time.',
  },
  /*
    No layer chip at all.

    Every other guide is about something drawn on the map and offers the chip
    that draws it. This one is about a panel, and D1 to D3 show one control in
    the chip row: *Spot a problem?*, which `usesReport` puts there.
  */
  chips: () => [],
  teachingPit: false,
  previous: true,
};
