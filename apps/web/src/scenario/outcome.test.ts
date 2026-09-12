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
  BASIS_COLOURS,
  BASIS_LABELS,
  HOW_IT_WAS_PRODUCED,
  HOW_STRONGLY_TO_READ_IT,
  INSUFFICIENT,
  LIMITATIONS,
  NO_CLEAR_CHANGE_MEANS,
  RAINFALL_CONTROL_NOTE,
  RAINFALL_EXPLAINED,
  RESULT_DISCLAIMER,
  WHAT_IS_UNCERTAIN,
  WHY_NO_CLEAR_CHANGE,
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
    // "No clear change" is an answer. "Insufficient information" is the
    // absence of one. A resident acting on the first is reasonable; acting on
    // the second, believing it was the first, is not.
    for (const band of COMPARISON_BANDS) {
      expect(BANDS[band].title).toBe('Difference from the all-clear baseline');
    }
    for (const reason of INSUFFICIENCY_REASONS) {
      expect(INSUFFICIENT[reason].title).toBe('Insufficient information');
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

describe('the rainfall control note', () => {
  it('says the control is about accumulation, not about time', () => {
    // AC 2.2.2.d (Aug-27 set). A control that slides left to right looks exactly like a
    // timeline; the model's variable is how much has fallen, never how long
    // it took, and this sentence is what stands between the two readings.
    expect(RAINFALL_CONTROL_NOTE).toMatch(/as rainfall accumulates/i);
    expect(RAINFALL_CONTROL_NOTE).toMatch(/does not show when/i);
  });

  it('claims nothing about arrival, speed or duration', () => {
    expect(RAINFALL_CONTROL_NOTE).not.toMatch(/how (fast|long|quickly)/i);
    expect(RAINFALL_CONTROL_NOTE).not.toMatch(/minutes?|hours?/i);
  });
});

describe('bases', () => {
  it('names all three kinds of thing on the result screen', () => {
    expect(Object.keys(BASIS_LABELS).sort()).toEqual(['assumption', 'derived', 'recorded']);
  });

  it('gives each one its own colour, so the badges are distinguishable', () => {
    const backgrounds = Object.values(BASIS_COLOURS).map((c) => c.background);
    expect(new Set(backgrounds).size).toBe(backgrounds.length);
  });

  it('calls the chosen settings an assumption rather than data', () => {
    // The distinction the whole screen turns on: a blockage setting the
    // person chose is a fact about them, not about their street.
    expect(BASIS_LABELS.assumption).toMatch(/assumption/i);
    expect(BASIS_LABELS.assumption).not.toMatch(/data|recorded|measured/i);
    expect(BASIS_LABELS.recorded).toMatch(/recorded/i);
  });
});

describe('what is missing or uncertain', () => {
  it('lists the limitations a person would want before acting', () => {
    expect(WHAT_IS_UNCERTAIN.length).toBeGreaterThanOrEqual(3);
    for (const item of WHAT_IS_UNCERTAIN) {
      expect(item.title.trim()).not.toBe('');
      expect(item.body.trim()).not.toBe('');
    }
  });

  it('names the capture fraction as an assumption, with its number', () => {
    const item = WHAT_IS_UNCERTAIN.find((i) => /drain takes/i.test(i.title));
    expect(item?.body).toContain('60%');
    expect(item?.body).toMatch(/assumption and not a measurement/i);
  });

  it('gives the measured share of ground rather than a vague hedge', () => {
    // A caveat with no number in it is decoration.
    const item = WHAT_IS_UNCERTAIN.find((i) => /ground surface/i.test(i.title));
    expect(item?.body).toContain('52.1%');
  });

  it('rules out every underground claim AD6 forbids', () => {
    const depth = WHAT_IS_UNCERTAIN.find((i) => /depth/i.test(i.title));
    expect(depth?.body).toMatch(/not pipe capacity/i);
    expect(depth?.body).toMatch(/not whether a pipe is adequate/i);
  });

  it('never calls the ground surface a LiDAR product', () => {
    const everything = WHAT_IS_UNCERTAIN.map((i) => `${i.title} ${i.body}`).join(' ');
    expect(everything.toLowerCase()).not.toContain('lidar');
  });
});

describe('why no clear difference', () => {
  it('gives the person a reason rather than only a verdict', () => {
    expect(WHY_NO_CLEAR_CHANGE.length).toBeGreaterThanOrEqual(3);
    for (const item of WHY_NO_CLEAR_CHANGE) {
      expect(item.title.trim()).not.toBe('');
      expect(item.body.trim()).not.toBe('');
    }
  });

  it('explains the redundancy rather than apologising for the model', () => {
    const all = WHY_NO_CLEAR_CHANGE.map((i) => `${i.title} ${i.body}`).join(' ').toLowerCase();
    expect(all).toMatch(/captured within the next few|drains below/);
    expect(all).not.toMatch(/sorry|unfortunately|limitation of this tool|failed/);
  });

  it('refuses to report a rise finer than the ground data', () => {
    // The trap: showing millimetres would look like a result and would be
    // some hundreds of times finer than the surface's own accuracy.
    const all = WHY_NO_CLEAR_CHANGE.map((i) => i.body).join(' ');
    expect(all).toMatch(/25 centimetres/);
    expect(all).toMatch(/below what the data can support/i);
  });

  it('does not put a millimetre figure on screen as a finding', () => {
    const all = WHY_NO_CLEAR_CHANGE.map((i) => i.body).join(' ');
    expect(all).not.toMatch(/\d+(\.\d+)?\s?mm/);
  });
});

describe('the Iteration 2 wording', () => {
  it('names the two bands in the criteria\'s own words', () => {
    // AC 3.1.3.e: Higher than baseline, No clear change.
    expect(BANDS['higher-than-baseline'].comparison).toBe('Higher than baseline');
    expect(BANDS['no-clear-change'].comparison).toBe('No clear change');
    expect(Object.values(BANDS).map((b) => b.band).join(' ')).not.toMatch(/DIFFERENCE/);
  });

  it('says what No clear change does not mean', () => {
    // AC 3.3.2.h and 3.1.3.f. Found missing from the screen on 13 September.
    expect(NO_CLEAR_CHANGE_MEANS).toMatch(/did not identify a clear difference from the all-clear baseline/);
    expect(NO_CLEAR_CHANGE_MEANS).toMatch(/does not mean the selected drain has no blockage or flood concern/);
    expect(NO_CLEAR_CHANGE_MEANS).toMatch(/no effect in a real flood/);
  });

  it('lists all nine limitations, a to i, in order', () => {
    expect(LIMITATIONS).toHaveLength(9);
    const [a, b, c, d, e, f, g, h, i] = LIMITATIONS;
    expect(a).toMatch(/blockage condition is an assumption/i);
    expect(b).toMatch(/not a weather observation or forecast/i);
    expect(c).toMatch(/rainfall amount at which a drain would fail/i);
    expect(d).toMatch(/pipe hydraulic capacity is not modelled/i);
    expect(e).toMatch(/does not show a validated flood depth or water depth/i);
    expect(f).toMatch(/when floodwater would arrive/i);
    expect(g).toMatch(/flood probability or a risk score/i);
    expect(h).toBe(NO_CLEAR_CHANGE_MEANS);
    expect(i).toMatch(/only shows differences from the all-clear baseline/i);
  });

  it('explains accumulated rainfall as a simplified total, without intensity, duration or forecast', () => {
    // AC 3.2.3.c, d and e.
    expect(RAINFALL_EXPLAINED).toMatch(/simplified total/);
    expect(RAINFALL_EXPLAINED).toMatch(/does not model how intense the rain is or how long it lasts/);
    expect(RAINFALL_EXPLAINED).toMatch(/not a weather forecast or a prediction of a future storm/);
  });

  it('does not let the rainfall control imply a steady climb', () => {
    // AC 3.2.2.d.
    expect(RAINFALL_CONTROL_NOTE).toMatch(/need not grow steadily with rainfall/);
  });

  it('states the simplified assumptions with their numbers, and how strongly to read the result', () => {
    const step = HOW_IT_WAS_PRODUCED.find((s) => s.title === 'Simplified assumptions');
    expect(step?.body).toContain('60%');
    expect(step?.body).toContain('0.05 m³');
    expect(step?.body).toMatch(/evenly/);
    expect(HOW_STRONGLY_TO_READ_IT).toMatch(/not how much/);
    expect(HOW_STRONGLY_TO_READ_IT).toMatch(/not that the drain does not matter/);
  });

  it('calls the ground surface photogrammetric', () => {
    const item = WHAT_IS_UNCERTAIN.find((i) => /ground surface/i.test(i.title));
    expect(item?.body).toMatch(/photogrammetric/);
    expect([...LIMITATIONS, RAINFALL_EXPLAINED, HOW_STRONGLY_TO_READ_IT].join(' ').toLowerCase()).not.toContain('lidar');
  });
});
