/**
 * Ground height, step by step.
 *
 * Figma Terrain Tutorial, 16 September: an entry screen, nine steps and a
 * finish page. It is the fourth section and the last one written, and it is
 * different from the other three in three ways, each of them the design's:
 *
 * - **Ground height is behind the Layers button**, not a chip, so the first
 *   two steps are *open the panel* and *tick the box*, and the map in this
 *   guide has the Layers button the other guides hide.
 * - **Most of it is reading the map, not switching it.** Three steps are
 *   questions with one right answer (`quiz` in `lesson.ts`), three are
 *   explanations, and the last step switches the layer back off.
 * - **It names real heights.** The design's *3.5 m AHD* and its markers A and
 *   B were drawn on a picture. Here they are spot heights and a contour from
 *   the published tiles near the address, chosen by `terrainPoints.ts`, so the
 *   steps are a function of those (`terrainSteps`). Where the data cannot
 *   support a step, the step keeps its place and says it in general words, with
 *   no marker: a guide that invented a height to fill a sentence would be
 *   teaching somebody to trust a number nobody measured.
 *
 * **The colours were checked against the ramp that draws the layer**
 * (`map/terrain.ts` `RAMP`, and the same nodes in the tile index's settings):
 * 0 m is a pale grey-green, the ramp passes through yellow at 2 to 3 m and
 * ends in orange and clay at 10 to 40 m. The design's *Green shows lower
 * ground* is right in direction; *pale green* is what the low end looks like.
 * The bar under step 3 is the ramp itself, not the design's brighter picture
 * of it.
 */

import { LAYER } from '../ui/terms.js';
import type { GuideMarker, GuideOverlay } from '../map/guideMarks.js';
import type { GuideMark, Lesson, Step } from './lesson.js';
import type { GuideSpot, HeightPair, HeightSpot, TerrainPoints } from './terrainPoints.js';

/** A height as the map writes it: one decimal, a true minus sign. */
export const metres = (heightM: number): string =>
  (heightM < 0 ? '−' : '') + Math.abs(heightM).toFixed(1);

/**
 * Step 4's card line, honest about ground at or below the zero point.
 *
 * Kensington's ground runs down to about -3 m on the river bank, and "about
 * -0.5 metres above" is not a sentence.
 */
export function aboveZero(heightM: number): string {
  if (heightM === 0) return 'About level with the shared zero point.';
  const how = heightM > 0 ? 'above' : 'below';
  return `About ${metres(Math.abs(heightM))} metres ${how} the shared zero point.`;
}

/** Step 5's comparison line, in whichever direction is true. */
export function compareLine(here: number, other: number): string {
  const how = other > here ? 'higher' : 'lower';
  return `${metres(other)} m is ${how} than ${metres(here)} m.`;
}

const OPEN_LAYERS: Step = {
  kind: 'do',
  id: 'layers-opened',
  prompt: 'Open the layer menu',
  body: `Select Layers to find ${LAYER.ground}.`,
  requires: 'layers-opened',
  // Past tense, because Previous shows it again after the panel may have shut.
  done: 'Done. You opened the layer menu.',
};

const SHOW_GROUND: Step = {
  kind: 'do',
  id: 'terrain-shown',
  prompt: 'Show ground height',
  body: `Select ${LAYER.ground} to colour the map by ground height.`,
  requires: 'terrain-shown',
  // Past tense: step nine turns it off again, and Previous shows this after.
  done: `Done. You turned on ${LAYER.ground}.`,
};

function colours(pair: HeightPair | null): Step {
  const body = 'Pale green shows lower ground. Orange shows higher ground.';
  if (pair === null) {
    // No two spots in view differ enough to ask about. The colours can still
    // be read; there is just nothing to point at.
    return {
      kind: 'read',
      id: 'higher-ground',
      prompt: 'Read the colours',
      body,
      card: { kind: 'ramp' },
      highlight: 'terrain-legend',
    };
  }
  return {
    kind: 'quiz',
    id: 'higher-ground',
    prompt: 'Which marker is on higher ground?',
    body,
    card: { kind: 'ramp' },
    options: [
      { label: 'A', correct: pair.higher === 'A' },
      { label: 'B', correct: pair.higher === 'B' },
    ],
    right: `Correct. ${pair.higher} is on higher ground.`,
    wrong: 'Not quite. The more orange the ground, the higher it is. Look at the colour under each marker.',
    mark: 'height-pair',
    highlight: 'terrain-legend',
  };
}

/*
  AHD is spelled out here, once, because this is the step that is about it
  (the site's rule: an abbreviation gets its full form the first time it is
  used). Its zero is "close to average sea level" rather than "sea level":
  the datum was fixed to mean sea level at tide gauges in 1971, and the sea
  has not stayed there.
*/
function zeroPoint(spot: HeightSpot | null): Step {
  const base = {
    kind: 'read',
    id: 'ahd',
    prompt: "AHD is the map's shared zero point",
    body:
      'AHD stands for Australian Height Datum. It gives every height the same starting point, so different places can be compared. Its zero is close to average sea level.',
    highlight: 'terrain-legend',
  } as const;
  if (spot === null) return base;
  const h = spot.here.heightM;
  return {
    ...base,
    card: { kind: 'height', value: `${metres(h)} m AHD`, text: aboveZero(h) },
    mark: 'height-spot',
  };
}

function heightNumber(spot: HeightSpot | null): Step {
  if (spot === null) {
    return {
      kind: 'read',
      id: 'height-number',
      prompt: 'Read the height number',
      body: 'A number marked ≈ on the map is the estimated ground height at that point, in metres AHD.',
    };
  }
  const h = spot.here.heightM;
  return {
    kind: 'read',
    id: 'height-number',
    prompt: 'Read the height number',
    body: `≈ ${metres(h)} m AHD is the estimated ground height at this point.`,
    card: {
      kind: 'reading',
      value: `≈ ${metres(h)} m AHD`,
      note: '≈ means estimated',
      compare: spot.other === null ? null : compareLine(h, spot.other.heightM),
    },
    mark: spot.other === null ? 'height-spot' : 'height-compare',
  };
}

function contourLine(points: TerrainPoints | null): Step {
  const body = 'Every place on the same contour line has the same ground height.';
  const contour = points?.contour ?? null;
  if (contour === null) {
    return { kind: 'read', id: 'contour', prompt: 'Follow one contour line', body };
  }
  return {
    kind: 'quiz',
    id: 'contour',
    prompt: 'Follow one contour line',
    body,
    question: 'Are A and B at the same height?',
    questionHint: 'Follow the green line from A to B.',
    options: [
      { label: 'No', correct: false },
      { label: 'Yes, same height', correct: true },
    ],
    // Written as the map labels the line, so the two can be matched.
    right: `Correct. A and B are both on the ${String(contour.m)} m line.`,
    wrong: 'Not quite. The green line joins A and B, so they are at the same height.',
    mark: 'contour',
  };
}

/*
  An illustration, not data: the two cards over the map are drawn, and say
  so. Finding two real slopes that differ this plainly inside one view of the
  river flats is not something the ground of most addresses can do.
*/
const STEEPER: Step = {
  kind: 'quiz',
  id: 'steeper',
  prompt: 'Where is the ground steeper?',
  body: 'Compare the space between the contour lines.',
  question: 'Which side is steeper?',
  options: [
    { label: 'A · Far apart', correct: false },
    { label: 'B · Close lines', correct: true },
  ],
  right: 'Correct. Close lines show a steeper slope.',
  wrong: 'Not quite. When lines are close together, the height changes over a short distance.',
  more: {
    title: 'Contour intervals',
    items: [
      { sample: 'thin', text: 'Thin lines show a 1 m change in ground height.' },
      { sample: 'bold', text: 'A bold line marks every 5 m.' },
    ],
  },
  mark: 'slope-example',
};

const SHADING: Step = {
  kind: 'read',
  id: 'shading',
  prompt: 'Shading shows slope, not height',
  body: 'Light and dark areas make the shape of the ground easier to see.',
  card: {
    kind: 'warning',
    title: 'Dark does not mean lower or wetter.',
    text: 'Use colours and height numbers to decide what is higher.',
  },
};

const HIDE_GROUND: Step = {
  kind: 'do',
  id: 'terrain-off',
  prompt: 'Hide ground height',
  body: `Select Layers, then clear ${LAYER.ground}.`,
  requires: 'terrain-off',
  done: 'Done. You can turn it on whenever you need it.',
  confirm: true,
};

/** The nine steps, given what the ground near the address can support. */
export function terrainSteps(points: TerrainPoints | null): readonly Step[] {
  return [
    OPEN_LAYERS,
    SHOW_GROUND,
    colours(points?.pair ?? null),
    zeroPoint(points?.spot ?? null),
    heightNumber(points?.spot ?? null),
    contourLine(points),
    STEEPER,
    SHADING,
    HIDE_GROUND,
  ];
}

export const TERRAIN: Lesson = {
  steps: terrainSteps(null),
  withGround: terrainSteps,
  finished: {
    badge: 'Guide complete',
    headline: 'You can now read the ground',
    unlocked: `Use ${LAYER.ground} to compare higher and lower places.`,
  },
  intro: {
    duration: '6 minutes',
    heading: 'Learn to read ground height',
    body: 'See higher and lower ground, read Australian Height Datum (AHD) heights and use contour lines.',
  },
  // No chips: Ground height is behind the Layers button, which is the first
  // thing this guide teaches.
  chips: () => [],
  teachingPit: false,
  previous: true,
  mapChrome: { layersButton: true, legend: true, wide: true },
};

/**
 * The marks for a step, from its `mark` and the chosen points.
 *
 * Null when the step has no mark or its data is missing: no marker is better
 * than one standing on a guess. `slope-example` is drawn by the guide itself,
 * since it is an illustration and not a place.
 */
export function marksFor(mark: GuideMark | undefined, points: TerrainPoints | null): GuideOverlay | null {
  if (mark === undefined || points === null) return null;
  const heightAt = (spot: GuideSpot, id: string): GuideMarker => ({
    id,
    at: spot.at,
    label: '',
    caption: `≈ ${metres(spot.heightM)} m`,
  });
  switch (mark) {
    case 'height-pair':
      return points.pair === null
        ? null
        : {
            markers: [
              { id: 'a', at: points.pair.a.at, label: 'A' },
              { id: 'b', at: points.pair.b.at, label: 'B' },
            ],
          };
    case 'height-spot':
      return points.spot === null ? null : { markers: [heightAt(points.spot.here, 'here')] };
    case 'height-compare':
      return points.spot === null
        ? null
        : {
            markers: [
              heightAt(points.spot.here, 'here'),
              ...(points.spot.other === null ? [] : [heightAt(points.spot.other, 'other')]),
            ],
          };
    case 'contour':
      return points.contour === null
        ? null
        : {
            line: {
              points: points.contour.line,
              label: `${String(points.contour.m)} m`,
              labelAt: points.contour.labelAt,
            },
            markers: [
              { id: 'a', at: points.contour.a, label: 'A' },
              { id: 'b', at: points.contour.b, label: 'B' },
            ],
          };
    case 'slope-example':
      return null;
  }
}
