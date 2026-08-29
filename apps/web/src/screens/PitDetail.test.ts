/**
 * Tests for the pit panel's wording.
 *
 * The panel makes claims about the council's record, so the sentences are the
 * thing under test rather than the markup. Each case below is a statement that
 * would be false if the wrong branch were chosen.
 */

import { describe, expect, it } from 'vitest';

import { DEPTH_NOTE, ENDING_LABELS, NOT_RECORDED, NO_OUTLET_NOTE } from './PitDetail.js';
import { TERMINATIONS, type TraceArtefact, endingsByReason, traceDownstream } from '../trace/graph.js';

const artefact = (links: TraceArtefact['links']): TraceArtefact => ({
  artefact: 'drainage-trace',
  version: 1,
  basis: 'sourceProvided',
  note: '',
  source: {},
  terminations: {
    'no-recorded-connection': 'a',
    'unrecorded-destination': 'b',
    'leaves-mapped-area': 'c',
    'cycle-guard': 'd',
  },
  counts: {},
  links,
});

describe('wording', () => {
  it('has a label for every way a path can stop', () => {
    // A missing label falls back to the raw reason slug, which is our word
    // rather than the person's.
    for (const reason of TERMINATIONS) {
      expect(ENDING_LABELS[reason]).toBeTruthy();
    }
  });

  it('never tells the person a path reached an outlet', () => {
    // There is no recorded outfall anywhere in the extent, so any sentence
    // claiming one would be describing a drainage system we cannot see.
    const all = [...Object.values(ENDING_LABELS), NO_OUTLET_NOTE, DEPTH_NOTE].join(' ').toLowerCase();
    expect(all).not.toMatch(/reaches the outlet|reaches an outlet|the water leaves here/);
    expect(NO_OUTLET_NOTE).toMatch(/no recorded outfall/);
  });

  it('distinguishes a gap in the record from the edge of the map', () => {
    expect(ENDING_LABELS['unrecorded-destination']).toMatch(/does not say where/);
    expect(ENDING_LABELS['leaves-mapped-area']).toMatch(/outside the mapped area/);
    expect(ENDING_LABELS['unrecorded-destination']).not.toEqual(
      ENDING_LABELS['leaves-mapped-area'],
    );
  });

  it('says depth is absent from the record rather than showing a blank', () => {
    expect(DEPTH_NOTE).toMatch(/not shown/);
    expect(DEPTH_NOTE).toMatch(/guess as a measurement/);
  });

  it('names an unrecorded field rather than leaving it empty', () => {
    expect(NOT_RECORDED).toBe('Not recorded');
  });
});

describe('what the summary counts', () => {
  it('reports one line per reason rather than one per stop', () => {
    const trace = traceDownstream(
      artefact({
        A: [
          { pipe: 'a', to: 'B' },
          { pipe: 'b', to: 'C' },
        ],
        B: [],
        C: [],
      }),
      'A',
    );
    expect(trace.endings).toHaveLength(2);
    expect(endingsByReason(trace)).toHaveLength(1);
  });

  it('treats a path that only left the mapped area as complete', () => {
    // The panel switches to "all at the edge of the mapped area" on this, and
    // saying the record ran out would be untrue: it did not, we stopped drawing.
    const trace = traceDownstream(
      artefact({ A: [{ pipe: 'out', ends: 'leaves-mapped-area' }] }),
      'A',
    );
    expect(trace.incomplete).toBe(false);
  });

  it('treats a path with any gap in the record as incomplete', () => {
    const trace = traceDownstream(
      artefact({
        A: [
          { pipe: 'out', ends: 'leaves-mapped-area' },
          { pipe: 'gone', ends: 'unrecorded-destination' },
        ],
      }),
      'A',
    );
    expect(trace.incomplete).toBe(true);
  });

  it('offers no path to follow when every pipe stops at the record edge', () => {
    // The button is disabled on this, and the explanation differs from the one
    // for a pit with no pipe at all.
    const links = artefact({ A: [{ pipe: 'gone', ends: 'unrecorded-destination' }] }).links['A']!;
    expect(links.some((link) => link.to !== undefined)).toBe(false);
    expect(links.length).toBeGreaterThan(0);
  });

  it('offers no path to follow when the pit has no recorded pipe', () => {
    const links = artefact({ A: [] }).links['A']!;
    expect(links).toHaveLength(0);
  });
});
