/**
 * Your drainage area, step by step — Epic 6's guide.
 *
 * Built from the team's Figma for Iteration 3 (file `atD5fleOrhvMjJ5m0pXYGt`,
 * screens D1 to D5), which settled a question this repository had answered
 * differently: the drainage area is **a guide**, not a card hanging off the
 * address. The first version of this work put a *My drainage area ›* link in
 * the address callout and opened a popup; the design asks for the thing every
 * other layer gets — a chip you press, with a step beside it saying what the
 * press did. The facts are the same and the delivery is not, and the design
 * is the team's to decide.
 *
 * **One chip, one press, and the rest is reading.** Press the chip and the
 * boundary is drawn. It is a `do` step, so the guide waits for the press
 * rather than describing it — the rule the other four guides are built on.
 *
 * There were two presses until 8 October. The second was *Who can help*, a
 * chip that drew nothing on the map and opened a card that pushed the
 * drainage-area card off the screen — reported as the area card not appearing
 * at all. Who looks after which part is now a section of the card about the
 * area, where it was always about, so the guide's last step reads it there
 * instead of pressing a second chip to summon it.
 *
 * **What the steps may not say.** The receiving drain is named only where the
 * classification register has approved it (AC 6.1.2), so the guide's wording
 * is about the *area* rather than about what receives it: a step that said
 * *your street drains to the Maribyrnong* would be the one claim the Epic 6
 * definition of done forbids without an approval. The card the chip draws
 * carries the hedged sentence, and changes with the register rather than with
 * this file.
 */

import { type Lesson } from './lesson.js';
import { CATCHMENT_CHIP } from '../catchment/wording.js';
import { BLOCKED_DRAIN, NOT_SENT_YET_SHORT, REPORT_HEADING } from '../report/problems.js';

/*
  The wording is the design's, and so is the order, and from 10 October both
  were read off the frames rather than remembered.

  **The previous version of this list was mine and three of its four steps
  were not in Figma.** It asked the reader to open *Why are there different
  organisations?*, a fold inside the card, and then told them each part of
  the drainage is looked after by someone different. The design's third and
  fourth frames are about reporting: press *Report a problem*, choose a
  problem type, and read who to contact and what to have ready. The guide
  taught the card; the design teaches what the card is for.

  Two differences from the frames are deliberate and are not oversights.

  **The step counter will read five, and Figma's reads four.** D4 and D4b
  are both *4 of 4* there: choosing a problem type and seeing the contact
  panel are one numbered step in two states. This engine counts `steps`, and
  a `do` followed by the `read` that confirms it is how every other guide in
  this product is built. Grouping them is an engine change, not a wording
  one, and it is worth doing only if the number is what somebody noticed.

  **Step two does not name the drain and the frame does.** D2 reads *Rain
  inside this line is recorded as draining to the Kensington West Main
  Drain.* Epic 6's definition of done is that no subcatchment is described
  as a Melbourne Water drain without an approved classification, and most
  addresses are unclassified today, so a prompt that named one for every
  address would be wrong for most of them. The card beside the prompt names
  it correctly for each class already, through `receivingLine`.
*/
export const DRAINAGE_AREA_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'catchment-on',
    prompt: `Click ${CATCHMENT_CHIP} to see the recorded boundary for this address.`,
    requires: 'catchment-on',
  },
  {
    kind: 'read',
    // Figma D2, which opens on the sentence rather than on *Great!*. That
    // prefix was a house convention of mine from copy audit v2 and appears
    // on no frame in this file.
    id: 'catchment-shown',
    prompt: 'Rain inside this line is recorded as draining to the same place.',
    // The sentence that stops a boundary being read as a flood map. A
    // subcatchment says where water is recorded as going, and nothing about
    // how far any flood could reach (AC 6.1.4).
    note: 'It shows drainage, not how far a flood could reach.',
  },
  {
    kind: 'do',
    id: 'report-open',
    // Figma D3, in the design's words, question and all.
    prompt: `See a blocked drain or a damaged grate? Click ${REPORT_HEADING}.`,
    requires: 'report-opened',
  },
  {
    kind: 'do',
    id: 'problem-choose',
    // Figma D4. It names one problem type because the frame does; any of
    // the five satisfies the step, since each one answers what the note
    // promises.
    prompt: `Choose ${BLOCKED_DRAIN}.`,
    hint: 'Each problem type shows who to contact.',
    requires: 'problem-chosen',
  },
  {
    kind: 'read',
    // Figma D4b.
    id: 'contact-shown',
    prompt: 'This is who to contact and what to prepare.',
    note: NOT_SENT_YET_SHORT,
  },
];

export const DRAINAGE_AREA: Lesson = {
  steps: DRAINAGE_AREA_STEPS,
  finished: {
    // The house sentence, which the lesson tests hold. The design's own
    // finish page reads *Well done! You finished all 7 guides* — that is the
    // all-sections state the chooser already tracks, not this guide's line.
    headline: 'Well done! You finished the drainage area guide.',
    unlocked:
      'Your drainage area and who to tell about a problem are on the full map, whenever you need them.',
  },
  /*
    Only the chip the current step is about, plus anything already on.

    The boundary stays available once it is drawn — step four is about the
    second chip and the reader should still be able to take the first one off
    — which is what `now` is for.
  */
  chips: () => ['catchment'],
  teachingPit: false,
  previous: true,
};
