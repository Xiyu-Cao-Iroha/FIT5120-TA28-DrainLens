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
import { placeTitle } from '../report/place.js';
import { SPOT_A_PROBLEM } from '../report/problems.js';

export const REPORT_PROBLEM_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    // Figma D1, and the 17 October frame that renumbers it 1 of 6. No line
    // under the heading there, and none here: the chip is ringed and the
    // panel it opens is the next step's subject.
    id: 'report-open',
    prompt: `Select ${SPOT_A_PROBLEM}.`,
    requires: 'report-opened',
  },
  {
    kind: 'do',
    // D2, which rings *Blocked or flooded street drain* and names no problem
    // in the step. Any of the five finishes it: the step asks the reader to
    // choose what they can see, and the frame rings an example -- which the
    // 17 October hint now says in as many words, because a ringed example
    // read as the answer.
    id: 'problem-choose',
    prompt: 'Choose the problem you can see.',
    hint: 'This is one example. Choose the category that matches what you see.',
    requires: 'problem-chosen',
  },
  {
    /*
      The three steps from here are new on 17 October.

      The product has been able to do all of this since the report flow was
      built: the button hands the map over, a tap offers the drain, and a
      confirm saves it. What it never did was walk anybody through it, so a
      reader reached *Which drain* and a line saying nothing was chosen,
      with the guide already finished.
    */
    kind: 'do',
    id: 'drain-pick',
    prompt: 'Choose the drain to report.',
    hint: 'Select the button, choose a drain on the map, then confirm it.',
    requires: 'drain-picking',
  },
  {
    kind: 'do',
    id: 'drain-tap',
    prompt: 'Choose a drain on this map.',
    // *The highlighted dot is only an example* is the design's line and it
    // is about the prototype's own ring, which this product does not draw;
    // what it guards against is a reader looking for the one dot the mock
    // marks. The rest is the instruction.
    hint: 'Tap the drain marker that matches the problem.',
    requires: 'drain-candidate',
  },
  {
    kind: 'do',
    id: 'drain-confirm',
    prompt: 'Confirm the selected drain.',
    hint: 'Check the street and distance, then select Use this drain.',
    requires: 'drain-chosen',
    // Its own feedback, so the reading step after it can be an instruction
    // rather than praise. See the same note in Epic 5.
    done: 'That drain is in your report.',
  },
  {
    /*
      The reading the three new steps were for: the row that was empty now
      names the drain the reader chose. It points at that row rather than
      at the map, which is the team's own instruction.
    */
    kind: 'read',
    id: 'drain-reviewed',
    points: 'which-drain',
    prompt: 'Review the recorded drain.',
    note: `${placeTitle(null)} now shows your selection. Select Next to finish.`,
  },
];

export const REPORT_PROBLEM: Lesson = {
  steps: REPORT_PROBLEM_STEPS,
  finished: {
    /*
      The 17 October frame, which says what this guide finished rather than
      how many guides there are.

      It was D5's *Well done! You finished all 7 guides.*, word for word,
      with a note here that the claim is true of a reader who worked through
      the list and not of one who jumped straight here. The new frame
      removes the question by not counting.
    */
    headline: 'You finished the report guide.',
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
