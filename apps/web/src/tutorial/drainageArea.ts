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

/*
  The wording is the design's, in the design's order: a press, what it showed,
  a press, what it showed, and a finish page. Each `read` step's prompt starts
  *Great!* as every guide's does since copy audit v2 (#43 to #51), and the
  caveat sits in `note` rather than in the heading.
*/
export const DRAINAGE_AREA_STEPS: Lesson['steps'] = [
  {
    kind: 'do',
    id: 'catchment-on',
    prompt: `Click ${CATCHMENT_CHIP} to see the area your street drains with.`,
    requires: 'catchment-on',
  },
  {
    kind: 'read',
    id: 'catchment-shown',
    prompt: 'Great! Rain inside this line is recorded as draining to the same place.',
    // The sentence that stops a boundary being read as a flood map. A
    // subcatchment says where water is recorded as going, and nothing about
    // how far any flood could reach (AC 6.1.4).
    note: 'It shows drainage, not how far a flood could reach.',
  },
  {
    kind: 'read',
    id: 'help-shown',
    prompt: 'Each part of the drainage is looked after by someone different, and the card says which.',
    note: 'Use it to report a problem to the right place.',
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
