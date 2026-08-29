/**
 * Tests for downstream traversal.
 *
 * The fixtures are shapes the Kensington extent actually contains — a fan-out,
 * a loop, a pipe whose destination was never recorded, a pipe that leaves the
 * mapped area — rather than shapes invented to reach a branch.
 */

import { describe, expect, it } from 'vitest';

import {
  type Link,
  type TraceArtefact,
  TraceError,
  assertTrace,
  endingsByReason,
  traceDownstream,
} from './graph.js';

function artefact(links: Record<string, readonly Link[]>): TraceArtefact {
  return {
    artefact: 'drainage-trace',
    version: 1,
    basis: 'sourceProvided',
    note: 'test',
    source: {},
    terminations: {
      'no-recorded-connection': 'no pipe recorded',
      'unrecorded-destination': 'destination not recorded',
      'leaves-mapped-area': 'continues outside the map',
      'cycle-guard': 'the record loops',
    },
    counts: {},
    links,
  };
}

describe('assertTrace', () => {
  it('accepts the artefact the pipeline writes', () => {
    expect(() => assertTrace(artefact({ A: [] }))).not.toThrow();
  });

  it('refuses anything that is not a trace artefact', () => {
    expect(() => assertTrace({ artefact: 'map-geometry' })).toThrow(TraceError);
    expect(() => assertTrace(null)).toThrow(TraceError);
  });

  it('refuses a trace that does not declare a sourceProvided basis', () => {
    // This layer is labelled official recorded data on screen. An artefact
    // that arrived by derivation must not be able to wear that label.
    const derived = { ...artefact({ A: [] }), basis: 'derived' };
    expect(() => assertTrace(derived)).toThrow(/sourceProvided/);
  });

  it('refuses a trace that does not say what its terminations mean', () => {
    const wordless = artefact({ A: [] }) as unknown as Record<string, unknown>;
    wordless['terminations'] = { 'no-recorded-connection': 'only this one' };
    expect(() => assertTrace(wordless)).toThrow(/cycle-guard|unrecorded|leaves/);
  });
});

describe('traceDownstream', () => {
  it('follows a chain to its end', () => {
    const trace = traceDownstream(
      artefact({
        A: [{ pipe: 'p1', to: 'B' }],
        B: [{ pipe: 'p2', to: 'C' }],
        C: [],
      }),
      'A',
    );
    expect(trace.pits).toEqual(['A', 'B', 'C']);
    expect(trace.pipes.map((p) => p.pipe)).toEqual(['p1', 'p2']);
    expect(trace.steps).toBe(2);
  });

  it('records how many steps downstream each pipe was reached', () => {
    const trace = traceDownstream(
      artefact({ A: [{ pipe: 'p1', to: 'B' }], B: [{ pipe: 'p2', to: 'C' }], C: [] }),
      'A',
    );
    expect(trace.pipes.map((p) => p.step)).toEqual([0, 1]);
  });

  it('fans out rather than collapsing branches', () => {
    // Multiple downstream pipes are the normal case in this data. Following
    // only the first would hide half the drainage from the person.
    const trace = traceDownstream(
      artefact({
        A: [
          { pipe: 'left', to: 'B' },
          { pipe: 'right', to: 'C' },
        ],
        B: [],
        C: [],
      }),
      'A',
    );
    expect(trace.pits).toEqual(['A', 'B', 'C']);
    expect(trace.pipes.map((p) => p.pipe).sort()).toEqual(['left', 'right']);
  });

  it('lets two branches rejoin without drawing the shared pit twice', () => {
    const trace = traceDownstream(
      artefact({
        A: [
          { pipe: 'left', to: 'B' },
          { pipe: 'right', to: 'C' },
        ],
        B: [{ pipe: 'b', to: 'D' }],
        C: [{ pipe: 'c', to: 'D' }],
        D: [],
      }),
      'A',
    );
    expect(trace.pits.filter((pit) => pit === 'D')).toHaveLength(1);
  });

  it('terminates on a loop instead of following it forever', () => {
    const trace = traceDownstream(
      artefact({ A: [{ pipe: 'p1', to: 'B' }], B: [{ pipe: 'p2', to: 'A' }] }),
      'A',
    );
    expect(trace.pits).toEqual(['A', 'B']);
    expect(trace.endings).toContainEqual({
      atPit: 'B',
      pipe: 'p2',
      reason: 'cycle-guard',
      step: 1,
    });
  });

  it('terminates on a pit that points at itself', () => {
    const trace = traceDownstream(artefact({ A: [{ pipe: 'p1', to: 'A' }] }), 'A');
    expect(trace.pits).toEqual(['A']);
    expect(trace.endings[0]?.reason).toBe('cycle-guard');
  });

  it('keeps an unrecorded destination separate from a pipe that leaves the map', () => {
    // These are different facts about the council's record and the interface
    // says different things about them. Merging them would be a false claim.
    const trace = traceDownstream(
      artefact({
        A: [
          { pipe: 'gone', ends: 'unrecorded-destination' },
          { pipe: 'out', ends: 'leaves-mapped-area' },
        ],
      }),
      'A',
    );
    expect(trace.endings.map((e) => e.reason)).toEqual([
      'unrecorded-destination',
      'leaves-mapped-area',
    ]);
  });

  it('reports a pit with no downstream pipe as a stop, not an arrival', () => {
    const trace = traceDownstream(artefact({ A: [] }), 'A');
    expect(trace.endings).toEqual([
      { atPit: 'A', pipe: null, reason: 'no-recorded-connection', step: 0 },
    ]);
  });

  it('never produces an ending that claims an outlet', () => {
    const trace = traceDownstream(artefact({ A: [] }), 'A');
    for (const ending of trace.endings) {
      expect(ending.reason).not.toMatch(/outlet/);
    }
  });

  it('answers about a pit it does not carry with an empty path, not a throw', () => {
    const trace = traceDownstream(artefact({ A: [] }), 'somewhere-else');
    expect(trace.pits).toEqual(['somewhere-else']);
    expect(trace.pipes).toEqual([]);
    expect(trace.endings[0]?.reason).toBe('no-recorded-connection');
  });

  it('counts a path that only leaves the mapped area as complete', () => {
    // Nothing is missing from the record here: we simply stopped drawing. The
    // panel should not tell the person the data ran out when it did not.
    const trace = traceDownstream(
      artefact({ A: [{ pipe: 'out', ends: 'leaves-mapped-area' }] }),
      'A',
    );
    expect(trace.incomplete).toBe(false);
  });

  it('counts a path with an unrecorded destination as incomplete', () => {
    const trace = traceDownstream(
      artefact({ A: [{ pipe: 'gone', ends: 'unrecorded-destination' }] }),
      'A',
    );
    expect(trace.incomplete).toBe(true);
  });

  it('terminates on a long chain within its own bound', () => {
    const links: Record<string, readonly Link[]> = {};
    for (let i = 0; i < 500; i += 1) links[`n${i}`] = [{ pipe: `p${i}`, to: `n${i + 1}` }];
    links['n500'] = [];
    const trace = traceDownstream(artefact(links), 'n0');
    expect(trace.pits).toHaveLength(501);
    expect(trace.steps).toBe(500);
  });
});

describe('endingsByReason', () => {
  it('groups repeated reasons into one line each', () => {
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
    expect(endingsByReason(trace)).toEqual([{ reason: 'no-recorded-connection', count: 2 }]);
  });

  it('orders by count, then by the fixed reason order', () => {
    // Stable ordering matters: two traces that stopped the same way should
    // not present their reasons in a different order.
    const trace = traceDownstream(
      artefact({
        A: [
          { pipe: 'a', ends: 'leaves-mapped-area' },
          { pipe: 'b', ends: 'unrecorded-destination' },
          { pipe: 'c', ends: 'unrecorded-destination' },
        ],
      }),
      'A',
    );
    expect(endingsByReason(trace)).toEqual([
      { reason: 'unrecorded-destination', count: 2 },
      { reason: 'leaves-mapped-area', count: 1 },
    ]);
  });

  it('returns nothing for a trace that never stopped', () => {
    expect(endingsByReason({ ...traceDownstream(artefact({}), 'A'), endings: [] })).toEqual([]);
  });
});
