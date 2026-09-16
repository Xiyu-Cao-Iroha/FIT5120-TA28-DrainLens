/**
 * Which sections have a guide written.
 *
 * **This is the one list, and the chooser reads it.** It was a hand-kept array
 * in `App.tsx` — `const GUIDED_SECTIONS = ['drainage']` — sitting a long way
 * from the lessons it was describing, which is two places to remember when a
 * third one lands. Here a lesson is offered because a lesson exists.
 *
 * All four have one since 16 September, when the ground height guide was
 * built from the Figma Terrain Tutorial. Until then `terrain` was left out and
 * its card said *Terrain guide coming soon*, which was the honest state rather
 * than a stub: a lesson that walked somebody through nothing would teach
 * nothing.
 */

import type { Lesson } from './lesson.js';
import { SECTION_ORDER, type SectionId } from './sections.js';
import { DRAINAGE } from './drainage.js';
import { LOW_AREAS } from './lowAreas.js';
import { TERRAIN } from './terrain.js';
import { WATER_FLOW } from './waterFlow.js';

export const LESSONS: Partial<Record<SectionId, Lesson>> = {
  drainage: DRAINAGE,
  'water-flow': WATER_FLOW,
  'low-areas': LOW_AREAS,
  terrain: TERRAIN,
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
