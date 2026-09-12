/**
 * What the task chooser offers, and where each offer goes.
 *
 * The cards are data, so they can be checked without rendering: one array of
 * four strings each, and a reducer that knows what to do with the task name.
 * That pairing is the thing worth testing. A card whose words describe the
 * comparison and whose `task` says `'follow'` looks right on screen, reads
 * right in review, and opens the wrong screen — and nothing else in the
 * repository would notice, because the reducer's own tests pass the task name
 * as a literal rather than taking it from the card.
 *
 * **This file exists because the entry it checks was deleted once.** AC 1.1.1
 * required the comparison to be absent from the Iteration 1 interface and it
 * was removed correctly; AC 3.1.1 requires it back. Neither state was held by
 * a test, which meant both were one careless edit from being wrong.
 */

import { describe, expect, it } from 'vitest';

import { GUIDED } from './TaskSelect.js';
import { INITIAL_SESSION, reduce } from '../session.js';

/** Where the reducer sends a task, which is what pressing the card does. */
const screenFor = (task: (typeof GUIDED)[number]['task']) =>
  reduce(INITIAL_SESSION, { type: 'task-chosen', task }).screen;

describe('the tasks this screen offers', () => {
  it('offers the drain-blockage comparison, which AC 3.1.1 requires', () => {
    // Iteration 1 removed it under AC 1.1.1. This is the criterion that puts
    // it back, and the only place in the interface it is currently reachable.
    expect(GUIDED.map((option) => option.task)).toContain('compare');
  });

  it('sends each card to a screen, and the comparison card to the comparison', () => {
    // The task name is read off the card rather than written here, so a card
    // wired to the wrong screen fails even though the reducer is right.
    const comparison = GUIDED.find((option) => option.title.includes('blockage'));
    expect(comparison).toBeDefined();
    expect(screenFor(comparison!.task)).toBe('scenario');

    for (const option of GUIDED) expect(screenFor(option.task)).not.toBe(INITIAL_SESSION.screen);
  });

  it('gives every card the four pieces the screen draws', () => {
    // A card missing its action label renders a button with an arrow and
    // nothing after it, which is a defect that only a person would see.
    for (const option of GUIDED) {
      for (const field of ['title', 'body', 'action'] as const) {
        expect(option[field].length).toBeGreaterThan(0);
      }
    }
  });

  it('describes the comparison as an assumption rather than a prediction', () => {
    /*
      AC 3.1.2.d and 3.1.2.e are about labels inside the setup screen, but the
      card is where somebody decides what this is, and a card promising to
      tell them whether their street will flood is the claim the whole product
      is built not to make. The words below are the ones that would make it.
    */
    const words = /\b(forecast|predict|will flood|flood risk|guarantee)\b/i;
    for (const option of GUIDED) {
      expect(`${option.title} ${option.body} ${option.action}`).not.toMatch(words);
    }
  });
});
