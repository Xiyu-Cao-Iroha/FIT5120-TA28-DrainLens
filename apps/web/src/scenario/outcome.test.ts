/**
 * The wording is the product here, so it is tested like code.
 *
 * These assertions are not style checks. Each one is a claim the interface
 * would otherwise be free to break silently: that an unusable area does not
 * send somebody round a loop picking pits, that a band and a missing answer
 * never read as the same kind of thing, and that no screen quietly starts
 * talking about depth or timing.
 */

import { COMPARISON_BANDS, INSUFFICIENCY_REASONS } from '@drainlens/schema';
import { describe, expect, it } from 'vitest';

import {
  ACTION_LABELS,
  BANDS,
  HOW_IT_WAS_PRODUCED,
  INSUFFICIENT,
  RESULT_DISCLAIMER,
  presentationFor,
} from './outcome.js';

describe('every outcome the engine can return has words', () => {
  it('covers all the comparison bands', () => {
    for (const band of COMPARISON_BANDS) {
      expect(BANDS[band], `no presentation for band ${band}`).toBeDefined();
    }
    expect(Object.keys(BANDS).sort()).toEqual([...COMPARISON_BANDS].sort());
  });

  it('covers all four insufficiency reasons', () => {
    for (const reason of INSUFFICIENCY_REASONS) {
      expect(INSUFFICIENT[reason], `no presentation for reason ${reason}`).toBeDefined();
    }
    expect(Object.keys(INSUFFICIENT).sort()).toEqual([...INSUFFICIENCY_REASONS].sort());
  });

  it('gives every action a label', () => {
    const used = new Set(
      [...Object.values(BANDS), ...Object.values(INSUFFICIENT)].flatMap((p) => p.actions),
    );
    for (const action of used) {
      expect(ACTION_LABELS[action], `no label for action ${action}`).toBeTruthy();
    }
  });
});

describe('a band and a missing answer are different kinds of thing', () => {
  it('uses a different heading for each', () => {
    // "No clear difference" is an answer. "Comparison unavailable" is the
    // absence of one. A resident acting on the first is reasonable; acting on
    // the second, believing it was the first, is not.
    for (const band of COMPARISON_BANDS) {
      expect(BANDS[band].title).toBe('Difference from the all-clear baseline');
    }
    for (const reason of INSUFFICIENCY_REASONS) {
      expect(INSUFFICIENT[reason].title).toBe('Comparison unavailable');
    }
  });

  it('never reports an insufficiency as a comparison result', () => {
    for (const reason of INSUFFICIENT_VALUES()) {
      expect(reason.comparison.toLowerCase()).not.toContain('no clear');
      expect(reason.comparison.toLowerCase()).not.toContain('higher than');
    }
  });

  it('draws a difference only when there is one', () => {
    expect(BANDS['higher-than-baseline'].showsDifference).toBe(true);
    expect(BANDS['no-clear-change'].showsDifference).toBe(false);
    for (const reason of INSUFFICIENT_VALUES()) {
      expect(reason.showsDifference).toBe(false);
    }
  });
});

describe('each reason offers a way out that can actually help', () => {
  it('does not send somebody with no terrain to pick another pit', () => {
    // The failure this whole table exists to prevent. Every pit in an area
    // with no terrain fails identically, so "choose another pit" is a loop.
    const terrain = INSUFFICIENT.terrain_unavailable;
    expect(terrain.actions).not.toContain('choose-another-pit');
    expect(terrain.actions).toContain('change-address');
    expect(terrain.body).toContain('will not fix this');
  });

  it('does send somebody with an unusable inlet to pick another pit', () => {
    expect(INSUFFICIENT.invalid_inlet.actions).toContain('choose-another-pit');
  });

  it('offers a retry only where retrying could work', () => {
    expect(INSUFFICIENT.scenario_calculation_failed.actions).toContain('try-again');
    expect(INSUFFICIENT.terrain_unavailable.actions).not.toContain('try-again');
    expect(INSUFFICIENT.invalid_inlet.actions).not.toContain('try-again');
  });

  it('always leaves at least one way out', () => {
    for (const presentation of [...Object.values(BANDS), ...INSUFFICIENT_VALUES()]) {
      expect(presentation.actions.length).toBeGreaterThan(0);
    }
  });

  it('says the identifier survives when the record does not', () => {
    // The provenance rule at field level: what is recorded stays recorded, and
    // what is missing is marked missing rather than filled in.
    expect(INSUFFICIENT.invalid_inlet.body).toContain('identifier');
    expect(INSUFFICIENT.invalid_inlet.body).toContain('unavailable');
  });
});

describe('what no result may claim', () => {
  const everything = [
    RESULT_DISCLAIMER,
    ...Object.values(BANDS).flatMap((p) => [p.finding, p.body]),
    ...INSUFFICIENT_VALUES().flatMap((p) => [p.finding, p.body]),
    ...HOW_IT_WAS_PRODUCED.flatMap((step) => [step.title, step.body]),
  ].join(' ');

  it('never states a depth', () => {
    expect(everything).not.toMatch(/\b\d+(\.\d+)?\s?(mm|cm|m|metres|metre)\s+(deep|of water)/i);
    expect(everything.toLowerCase()).not.toContain('flood depth of');
  });

  it('never says when water arrives', () => {
    expect(everything.toLowerCase()).not.toMatch(/\bminutes\b|\bhours\b|\bwithin \d/);
  });

  it('says outright what it is not', () => {
    const said = RESULT_DISCLAIMER.toLowerCase();
    expect(said).toContain('not a live flood prediction');
    expect(said).toContain('depth');
    expect(said).toContain('when water would reach');
  });

  it('never calls the ground surface a LiDAR model', () => {
    // D2 found the source is photogrammetric. The one word the interface must
    // not use about it.
    expect(everything.toLowerCase()).not.toContain('lidar');
    const step = HOW_IT_WAS_PRODUCED.find((s) => s.title === 'Local information used');
    expect(step?.body).toContain('aerial imagery');
  });

  it('says only the difference is shown, in the step that explains reading it', () => {
    const step = HOW_IT_WAS_PRODUCED.find((s) => s.title === 'How to read it');
    expect(step?.body).toContain('all-clear baseline');
    expect(step?.body.toLowerCase()).toContain('nothing here is a depth');
  });
});

describe('picking a presentation', () => {
  it('takes the band when the comparison succeeded', () => {
    expect(presentationFor({ status: 'successful', band: 'higher-than-baseline' })).toBe(
      BANDS['higher-than-baseline'],
    );
  });

  it('takes the reason when it did not', () => {
    expect(
      presentationFor({ status: 'insufficient-information', reason: 'invalid_inlet' }),
    ).toBe(INSUFFICIENT.invalid_inlet);
  });
});

function INSUFFICIENT_VALUES() {
  return Object.values(INSUFFICIENT);
}
