/**
 * The ground height guide's steps, with and without the data behind them.
 *
 * The rule under test is the one the module opens with: where the ground near
 * an address cannot support a step, the step keeps its place and its id and
 * says it in general words, with no marker and no number.
 */

import { describe, expect, it } from 'vitest';

import { LAYER } from '../ui/terms.js';
import { type Step, NOTHING_ON_MAP, stepIndex } from './lesson.js';
import { TERRAIN, aboveZero, compareLine, marksFor, metres, terrainSteps } from './terrain.js';
import type { ContourPick, GuideSpot, TerrainPoints } from './terrainPoints.js';

const spot = (id: string, heightM: number): GuideSpot => ({ id, at: [10, 20], heightM });
const contour: ContourPick = {
  m: 3,
  major: false,
  line: [
    [0, 0],
    [100, 0],
  ],
  a: [20, 0],
  b: [80, 0],
  labelAt: [50, 0],
  alongM: 60,
};
const FULL: TerrainPoints = {
  pair: { a: spot('a', 2), b: spot('b', 3.5), higher: 'B' },
  spot: { here: spot('h', 3), other: spot('o', 2) },
  contour,
};
const NONE: TerrainPoints = { pair: null, spot: null, contour: null };

/** Every string a step shows. */
function shown(step: Step): string[] {
  const card = step.card;
  let cardText: string[] = [];
  if (card?.kind === 'height') cardText = [card.value, card.text];
  if (card?.kind === 'reading') cardText = [card.value, card.note, card.compare ?? ''];
  if (card?.kind === 'warning') cardText = [card.title, card.text];
  const quiz =
    step.kind === 'quiz'
      ? [step.question ?? '', step.questionHint ?? '', step.right, step.wrong, ...step.options.map((o) => o.label)]
      : [];
  const done = step.kind === 'do' ? [step.done ?? ''] : [];
  return [step.prompt, step.body ?? '', ...cardText, ...quiz, ...done];
}

describe('how heights are written', () => {
  it('writes one decimal and a true minus sign', () => {
    expect(metres(3)).toBe('3.0');
    expect(metres(-0.5)).toBe('−0.5');
  });

  it('says below for ground under the zero point, and level at it', () => {
    expect(aboveZero(3.5)).toBe('About 3.5 metres above the shared zero point.');
    expect(aboveZero(-1.5)).toBe('About 1.5 metres below the shared zero point.');
    expect(aboveZero(0)).toBe('About level with the shared zero point.');
  });

  it('compares in whichever direction is true', () => {
    expect(compareLine(3, 6)).toBe('6.0 m is higher than 3.0 m.');
    expect(compareLine(3, 2)).toBe('2.0 m is lower than 3.0 m.');
  });
});

describe('the nine steps', () => {
  const ids = (points: TerrainPoints | null) => terrainSteps(points).map((s) => s.id);

  it('keeps the same ids in the same order whatever the data', () => {
    expect(ids(FULL)).toHaveLength(9);
    expect(ids(null)).toEqual(ids(FULL));
    expect(ids(NONE)).toEqual(ids(FULL));
    expect(TERRAIN.steps.map((s) => s.id)).toEqual(ids(FULL));
  });

  it('asks the three questions when the data allows', () => {
    const kinds = terrainSteps(FULL).map((s) => s.kind);
    expect(kinds).toEqual(['do', 'do', 'quiz', 'read', 'read', 'quiz', 'quiz', 'read', 'do']);
  });

  it('turns the two data questions into explanations without data, and names no height', () => {
    const steps = terrainSteps(NONE);
    expect(steps.map((s) => s.kind)).toEqual(['do', 'do', 'read', 'read', 'read', 'read', 'quiz', 'read', 'do']);
    for (const step of steps) {
      // The steepness question is an illustration, with no data in it.
      if (step.id === 'steeper') continue;
      expect(step.mark).toBeUndefined();
      expect(shown(step).join(' ')).not.toMatch(/\d(\.\d)? m\b/);
    }
  });

  it('names the real heights, and the letter the data says is higher', () => {
    const [, , colours, zero, reading, line] = terrainSteps(FULL);
    expect(colours?.kind === 'quiz' && colours.right).toBe('Correct. B is on higher ground.');
    expect(colours?.kind === 'quiz' && colours.options.filter((o) => o.correct).map((o) => o.label)).toEqual(['B']);
    expect(zero?.card).toEqual({
      kind: 'height',
      value: '3.0 m AHD',
      text: 'About 3.0 metres above the shared zero point.',
    });
    expect(reading?.card).toEqual({
      kind: 'reading',
      value: '≈ 3.0 m AHD',
      note: '≈ means estimated',
      compare: '2.0 m is lower than 3.0 m.',
    });
    expect(line?.kind === 'quiz' && line.right).toBe('Correct. A and B are both on the 3 m line.');
  });

  it('shows one height when there is nothing to compare it with, and says below for ground under zero', () => {
    const steps = terrainSteps({ ...FULL, spot: { here: spot('h', -0.5), other: null } });
    const reading = steps[4];
    expect(reading?.mark).toBe('height-spot');
    expect(reading?.card?.kind === 'reading' && reading.card.compare).toBeNull();
    const zero = steps[3];
    expect(zero?.card?.kind === 'height' && zero.card.text).toBe('About 0.5 metres below the shared zero point.');
  });

  it('has exactly one right answer on every question', () => {
    for (const step of terrainSteps(FULL)) {
      if (step.kind === 'quiz') expect(step.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it('spells AHD out on the step about it', () => {
    expect(terrainSteps(FULL)[3]?.body).toContain('Australian Height Datum');
  });

  it('keeps to the copy rules: no em dashes, the layer by its one name', () => {
    for (const points of [FULL, NONE]) {
      for (const step of terrainSteps(points)) {
        for (const line of shown(step)) {
          expect(line).not.toContain('—');
          expect(line).not.toMatch(/Ground Height|ground-height/);
        }
      }
    }
    expect(terrainSteps(FULL)[0]?.body).toBe(`Select Layers to find ${LAYER.ground}.`);
  });

  it('holds on the last step until Next, so its done line is read', () => {
    const steps = terrainSteps(FULL);
    const off = { ...NOTHING_ON_MAP, layersOpened: true, terrainShown: true, terrain: false };
    expect(stepIndex(steps, off, null, 8)).toBe(8);
    expect(stepIndex(steps, off, null, 9)).toBe(9);
    expect(stepIndex(steps, { ...off, terrain: true }, null, 9)).toBe(8);
  });
});

describe('the marks for each step', () => {
  it('draws nothing without data or without a mark', () => {
    expect(marksFor(undefined, FULL)).toBeNull();
    expect(marksFor('height-pair', null)).toBeNull();
    for (const mark of ['height-pair', 'height-spot', 'height-compare', 'contour', 'slope-example'] as const) {
      expect(marksFor(mark, NONE)).toBeNull();
    }
    expect(marksFor('slope-example', FULL)).toBeNull();
  });

  it('letters the pair A and B at their spots', () => {
    expect(marksFor('height-pair', FULL)?.markers?.map((m) => [m.label, m.at])).toEqual([
      ['A', FULL.pair?.a.at],
      ['B', FULL.pair?.b.at],
    ]);
  });

  it('captions heights as the map labels them', () => {
    expect(marksFor('height-spot', FULL)?.markers?.map((m) => m.caption)).toEqual(['≈ 3.0 m']);
    expect(marksFor('height-compare', FULL)?.markers?.map((m) => m.caption)).toEqual(['≈ 3.0 m', '≈ 2.0 m']);
    const alone = { ...FULL, spot: { here: spot('h', 3), other: null } };
    expect(marksFor('height-compare', alone)?.markers).toHaveLength(1);
  });

  it('draws the contour with its value and A and B on it', () => {
    const marks = marksFor('contour', FULL);
    expect(marks?.line).toEqual({ points: contour.line, label: '3 m', labelAt: contour.labelAt });
    expect(marks?.markers?.map((m) => [m.label, m.at])).toEqual([
      ['A', contour.a],
      ['B', contour.b],
    ]);
  });
});

describe('the lesson', () => {
  it('opens on an entry screen, offers Previous and dresses the map for the layer', () => {
    expect(TERRAIN.intro?.heading).toBe('Learn to read ground height');
    expect(TERRAIN.previous).toBe(true);
    expect(TERRAIN.mapChrome).toEqual({ layersButton: true, legend: true, wide: true });
    expect(TERRAIN.chips(0, NOTHING_ON_MAP)).toEqual([]);
    expect(TERRAIN.finished.badge).toBe('Guide complete');
  });
});
