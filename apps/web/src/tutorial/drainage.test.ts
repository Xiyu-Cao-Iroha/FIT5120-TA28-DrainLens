/**
 * Where the guide is, given what the map shows.
 *
 * The property worth protecting is that the step is **derived** rather than
 * counted. A counter that only goes up drifts away from the map the moment
 * somebody switches a layer back off, and then the sentence beside the map
 * describes a map that is not there — with nobody to notice, because a counter
 * cannot disagree with itself.
 */

import { describe, expect, it } from 'vitest';

import { DRAINAGE_STEPS } from './drainage.js';
import {
  type MapNow,
  NOTHING_ON_MAP,
  type Requirement,
  finished,
  satisfied,
  stepIndex,
} from './lesson.js';

const PIT = '1144882';

const now = (over: Partial<MapNow> = {}): MapNow => ({ ...NOTHING_ON_MAP, ...over });

/** Everything done, which is the state the last step leaves behind. */
const ALL_DONE = now({
  pits: true,
  pipes: true,
  selectedPit: PIT,
  followingPit: PIT,
});

describe('the shape of the section', () => {
  it('asks for something at every step that can be acted on', () => {
    // A `do` step with no requirement would be a `read` step with extra words,
    // and a `read` step with a requirement would wait for something no button
    // can produce. Both are silent stalls.
    for (const step of DRAINAGE_STEPS) {
      if (step.kind === 'do') expect(step.requires).toBeTruthy();
      expect(step.prompt.length).toBeGreaterThan(10);
    }
  });

  it('teaches the two controls before the pit that needs them', () => {
    // Pressing a pit before the pits are drawn is not a step, it is a guess.
    const ids = DRAINAGE_STEPS.map((s) => s.id);
    expect(ids.indexOf('pits-on')).toBeLessThan(ids.indexOf('pit-selected'));
    expect(ids.indexOf('pipes-on')).toBeLessThan(ids.indexOf('trace-following'));
  });

  it('has a unique id for every step', () => {
    const ids = DRAINAGE_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('what each requirement is waiting for', () => {
  it.each([
    ['pits-on', now({ pits: true }), true],
    ['pits-on', now(), false],
    ['pipes-on', now({ pits: true, pipes: true }), true],
    ['pipes-on', now({ pipes: true }), false],
  ] as const)('%s against a map', (requires: Requirement, map: MapNow, met: boolean) => {
    expect(satisfied(requires, map, PIT)).toBe(met);
  });

  it('keeps the pits on as a condition of the pipes step', () => {
    // Turning the pits off to see the pipes alone leaves the words beside the
    // map describing a map that is no longer there.
    expect(satisfied('pipes-on', now({ pipes: true, pits: false }), PIT)).toBe(false);
  });

  it('accepts only the pit the guide asked for', () => {
    // Not strictness for its own sake: the next step presses "Show connected
    // pipe", and 215 of the 895 pits in this extent have nothing to show.
    expect(satisfied('pit-selected', now({ selectedPit: PIT }), PIT)).toBe(true);
    expect(satisfied('pit-selected', now({ selectedPit: '1144727' }), PIT)).toBe(false);
  });

  it('is never satisfied when the guide has no pit to point at', () => {
    // `chooseTeachingPit` returns null on an artefact with no candidate. The
    // step must stall visibly rather than pass on a null comparison.
    expect(satisfied('pit-selected', now({ selectedPit: null }), null)).toBe(false);
    expect(satisfied('trace-following', now({ followingPit: null }), null)).toBe(false);
  });
});

describe('walking the section', () => {
  it('starts at the first step on a map with nothing on it', () => {
    expect(stepIndex(DRAINAGE_STEPS, now(), PIT, 0)).toBe(0);
  });

  it('moves on when the map does, without a Next', () => {
    expect(stepIndex(DRAINAGE_STEPS, now({ pits: true }), PIT, 0)).toBe(1);
  });

  it('holds a read step until it is acknowledged', () => {
    // Index 1 is a `read`. The map cannot say whether a sentence was read, so
    // this is the one thing Next exists for.
    expect(stepIndex(DRAINAGE_STEPS, now({ pits: true, pipes: true }), PIT, 0)).toBe(1);
    expect(stepIndex(DRAINAGE_STEPS, now({ pits: true, pipes: true }), PIT, 2)).toBe(3);
  });

  it('goes back when the map goes back', () => {
    // The whole reason the index is derived. Somebody who turns Pits off on
    // step 5 is looking at a map the words no longer describe.
    const forward = stepIndex(DRAINAGE_STEPS, ALL_DONE, PIT, DRAINAGE_STEPS.length);
    expect(forward).toBe(DRAINAGE_STEPS.length);

    const back = stepIndex(
      DRAINAGE_STEPS,
      { ...ALL_DONE, pits: false },
      PIT,
      DRAINAGE_STEPS.length,
    );
    expect(back).toBe(0);
  });

  it('does not run ahead on an acknowledgement alone', () => {
    // Next on a `read` step must not carry you past the `do` step after it.
    expect(stepIndex(DRAINAGE_STEPS, now({ pits: true }), PIT, 99)).toBe(2);
  });

  it('finishes only when every step is behind you', () => {
    expect(finished(DRAINAGE_STEPS, ALL_DONE, PIT, DRAINAGE_STEPS.length)).toBe(true);
    expect(finished(DRAINAGE_STEPS, ALL_DONE, PIT, 0)).toBe(false);
    expect(finished(DRAINAGE_STEPS, now({ pits: true }), PIT, 99)).toBe(false);
  });

  it('cannot be finished by following a pit the guide did not choose', () => {
    const wrong = { ...ALL_DONE, selectedPit: '1144727', followingPit: '1144727' };
    expect(finished(DRAINAGE_STEPS, wrong, PIT, DRAINAGE_STEPS.length)).toBe(false);
  });
});
