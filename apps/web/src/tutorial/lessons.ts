/**
 * Which sections have a guide written.
 *
 * **This is the one list, and the chooser reads it.** It was a hand-kept array
 * in `App.tsx` — `const GUIDED_SECTIONS = ['drainage']` — sitting a long way
 * from the lessons it was describing, which is two places to remember when a
 * third one lands. Here a lesson is offered because a lesson exists.
 *
 * `terrain` has none yet, so its card stays *Guide coming soon* and its
 * section cannot be started. That is the honest state rather than a stub: the
 * whole map is gated on finishing all four, and a fourth lesson that walked
 * somebody through nothing would open the gate without teaching anything.
 */

import type { Lesson } from './lesson.js';
import { SECTION_ORDER, type SectionId } from './sections.js';
import { DRAINAGE } from './drainage.js';
import { LOW_AREAS } from './lowAreas.js';
import { WATER_FLOW } from './waterFlow.js';

export const LESSONS: Partial<Record<SectionId, Lesson>> = {
  drainage: DRAINAGE,
  'water-flow': WATER_FLOW,
  'low-areas': LOW_AREAS,
};

/**
 * The sections a person can start, in the order the cards sit in.
 *
 * Filtered from `SECTION_ORDER` rather than read off the object above, so the
 * order is the declared one and not whichever order somebody happened to type
 * the lessons in.
 */
export const GUIDED_SECTIONS: readonly SectionId[] = SECTION_ORDER.filter((id) => id in LESSONS);

export const lessonFor = (section: SectionId): Lesson | undefined => LESSONS[section];
