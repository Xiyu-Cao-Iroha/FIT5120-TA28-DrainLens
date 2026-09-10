/**
 * What the guide puts within reach at each step.
 *
 * The rule is *everything on screen during a step is something the step is
 * about*, and it is worth a test rather than a glance because the failure is
 * quiet: an extra chip does not break anything, it just lets somebody press
 * past the instruction they were given and then read a sentence about a map
 * they have already left behind.
 */

import { describe, expect, it } from 'vitest';

import { chipsFor } from './Guide.js';
import { DRAINAGE_STEPS, type MapNow, stepIndex } from '../tutorial/drainage.js';

const NOTHING: MapNow = { pits: false, pipes: false, selectedPit: null, followingPit: null };

describe('which chips the guide offers', () => {
  it('offers only Pits while Pits is what is being asked for', () => {
    // The screenshot this was written from: step one says "Press Pits" with
    // Pipes sitting beside it, already pressable.
    expect(chipsFor(0, NOTHING)).toEqual(['pit']);
  });

  it('still offers only Pits while the reader is told what they just turned on', () => {
    // Step 1 is `pits-shown`, a `read`. Pipes is the *next* instruction, and
    // offering it early is offering it during someone else's sentence.
    expect(chipsFor(1, { ...NOTHING, pits: true })).toEqual(['pit']);
  });

  it('offers Pipes on the step that asks for it', () => {
    expect(chipsFor(2, { ...NOTHING, pits: true })).toEqual(['pit', 'pipe']);
  });

  it('keeps both once the reader is past them', () => {
    for (const at of [3, 4, 5]) {
      expect(chipsFor(at, { ...NOTHING, pits: true, pipes: true })).toEqual(['pit', 'pipe']);
    }
  });

  it('never takes away the chip for a layer that is on', () => {
    /*
     * The trap. Turning Pits off during the pipes step puts the guide back on
     * step one — `satisfied('pipes-on')` requires both — and a chip list keyed
     * only on the step would drop Pipes at that moment, leaving pipes drawn on
     * the map with no control to turn them off. A map holding something the
     * reader cannot take back is worse than a map offering one thing early.
     */
    const pipesOnPitsOff: MapNow = { ...NOTHING, pipes: true };
    const back = stepIndex(DRAINAGE_STEPS, pipesOnPitsOff, '1', 6);
    expect(back).toBe(0);
    expect(chipsFor(back, pipesOnPitsOff)).toEqual(['pit', 'pipe']);
  });

  it('never offers a layer this section is not about', () => {
    // The section-level narrowing, still true at every step: no terrain, no
    // water flow, no flood history.
    for (const at of [0, 1, 2, 3, 4, 5, 6]) {
      const keys = chipsFor(at, { pits: true, pipes: true, selectedPit: '1', followingPit: '1' });
      expect(keys.every((key) => key === 'pit' || key === 'pipe')).toBe(true);
    }
  });
});
