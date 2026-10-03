/**
 * What a finished guide offers next, and what it says before the full map.
 *
 * The rule worth holding is that the suggestion is a suggestion: the dialog
 * names what is unread and the button opens the map anyway. A version of this
 * that could refuse would be making a claim about the reader.
 */

import { describe, expect, it } from 'vitest';

import { HOLD_SECONDS, beforeTheMap, listed, nextGuide, unread } from './GuideEnding.js';
import { GUIDED_SECTIONS } from '../tutorial/lessons.js';
import { type Learned, SECTION_ORDER } from '../tutorial/sections.js';

const none: Learned = Object.fromEntries(SECTION_ORDER.map((id) => [id, false])) as Learned;
const after = (done: readonly string[]): Learned =>
  Object.fromEntries(SECTION_ORDER.map((id) => [id, done.includes(id)])) as Learned;

describe('which guide comes next', () => {
  it('offers the next one in the chooser’s order', () => {
    expect(nextGuide('drainage', after(['drainage']), GUIDED_SECTIONS)).toBe('water-flow');
  });

  it('skips the ones already done', () => {
    expect(nextGuide('drainage', after(['drainage', 'water-flow']), GUIDED_SECTIONS)).toBe(
      'low-areas',
    );
  });

  it('comes round to one that was skipped rather than offering nothing', () => {
    // Finishing the last guide first should still offer the first one.
    const done = after(['heavy-rain']);
    expect(nextGuide('heavy-rain', done, GUIDED_SECTIONS)).toBe('drainage');
  });

  it('offers nothing once every guide is done', () => {
    expect(nextGuide('drainage', after([...GUIDED_SECTIONS]), GUIDED_SECTIONS)).toBeNull();
  });
});

describe('what it says before the full map', () => {
  it('names the guides that are still unread, in the chooser’s order', () => {
    const left = unread(after(['drainage', 'water-flow']), GUIDED_SECTIONS);
    expect(left).toEqual(['low-areas', 'terrain', 'drainage-area', 'heavy-rain']);
  });

  it('reads as a sentence rather than a list', () => {
    expect(listed(['drainage', 'water-flow'])).toBe(
      'Local drainage pits and pipes and Where rainwater may move',
    );
    expect(listed(['drainage'])).toBe('Local drainage pits and pipes');
    expect(listed([])).toBe('');
  });

  it('suggests rather than requires', () => {
    expect(beforeTheMap(['drainage'])).toMatch(/^We suggest finishing/);
    expect(beforeTheMap(['drainage'])).not.toMatch(/must|cannot|need to/i);
  });

  it('holds the button for long enough to read and no longer', () => {
    // A five-second countdown in front of the full map was removed on
    // 14 September for standing between a reader and the map on every visit.
    // This one is at the end of a guide, only while something is unread.
    expect(HOLD_SECONDS).toBeLessThan(5);
    expect(HOLD_SECONDS).toBeGreaterThan(0);
  });
});
