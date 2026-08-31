/**
 * Tests for trace rendering.
 *
 * The orientation tests matter most. A pipe's vertex order carries no meaning
 * in the source, so an arrow that trusts it is right about half the time — and
 * a confidently wrong arrow about which way water flows is worse than none.
 */

import { describe, expect, it } from 'vitest';

import type { MapArtefact, Pipe } from '../map/artefact.js';
import type { Local } from '../map/viewport.js';
import { fit } from '../map/viewport.js';
import {
  ARROW_SPACING_M,
  TRACE_DAY,
  arrowsAlong,
  drawTrace,
  endingPoint,
  orientAwayFrom,
  pipesByRef,
  pitsByAsset,
  stoppedBecauseOfTheRecord,
} from './draw.js';
import { type Trace, traceDownstream } from './graph.js';

function mapWith(pipes: Pipe[], pits: { asset_number: number; c: Local }[]): MapArtefact {
  return {
    artefact: 'map-geometry',
    version: 1,
    extent: { name: 'test', min_e: 0, min_n: 0, width_m: 1000, height_m: 1000 },
    coordinates: 'metres',
    crs: 'test',
    sources: [
      {
        layer: 'pipe',
        dataset_id: 'd',
        publisher: 'p',
        licence: 'l',
        last_modified: '2023-01-01',
        features: pipes.length,
      },
    ],
    layers: {
      pipe: pipes,
      pit: pits.map((pit) => ({ g: 'point' as const, ...pit })),
    },
  };
}

const pipe = (ref: number, c: Local[]): Pipe => ({ g: 'line', c, ref });

/** A context that records the calls a test needs to assert on. */
function recordingContext() {
  const calls: { op: string; args: unknown[] }[] = [];
  const record =
    (op: string) =>
    (...args: unknown[]) => {
      calls.push({ op, args });
    };
  return {
    calls,
    context: {
      save: record('save'),
      restore: record('restore'),
      beginPath: record('beginPath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      stroke: record('stroke'),
      fill: record('fill'),
      arc: record('arc'),
      closePath: record('closePath'),
      translate: record('translate'),
      rotate: record('rotate'),
      set strokeStyle(value: string) {
        calls.push({ op: 'strokeStyle', args: [value] });
      },
      set fillStyle(value: string) {
        calls.push({ op: 'fillStyle', args: [value] });
      },
      set lineWidth(value: number) {
        calls.push({ op: 'lineWidth', args: [value] });
      },
      set lineJoin(value: string) {
        calls.push({ op: 'lineJoin', args: [value] });
      },
      set lineCap(value: string) {
        calls.push({ op: 'lineCap', args: [value] });
      },
    } as unknown as CanvasRenderingContext2D,
  };
}

describe('orientAwayFrom', () => {
  const line: Local[] = [
    [0, 0],
    [10, 0],
  ];

  it('leaves a line alone when it already runs away from the pit', () => {
    expect(orientAwayFrom(line, [0, 0])).toEqual(line);
  });

  it('reverses a line whose vertices were captured the other way round', () => {
    // The source orders vertices however the surveyor captured them, so this
    // is the normal case rather than a corrupt one.
    expect(orientAwayFrom(line, [10, 0])).toEqual([
      [10, 0],
      [0, 0],
    ]);
  });

  it('leaves a line alone when the pit is unknown', () => {
    expect(orientAwayFrom(line, undefined)).toEqual(line);
  });

  it('leaves a degenerate line alone', () => {
    expect(orientAwayFrom([[1, 1]], [0, 0])).toEqual([[1, 1]]);
  });

  it('orients by the nearer end, not by the first vertex', () => {
    const bent: Local[] = [
      [0, 0],
      [5, 5],
      [0, 10],
    ];
    expect(orientAwayFrom(bent, [0, 10])[0]).toEqual([0, 10]);
  });
});

describe('arrowsAlong', () => {
  it('spaces arrows along a straight line', () => {
    const arrows = arrowsAlong(
      [
        [0, 0],
        [100, 0],
      ],
      20,
    );
    expect(arrows.map((a) => Math.round(a.at[0]))).toEqual([10, 30, 50, 70, 90]);
  });

  it('points arrows along the direction of travel', () => {
    const east = arrowsAlong(
      [
        [0, 0],
        [50, 0],
      ],
      20,
    );
    const west = arrowsAlong(
      [
        [50, 0],
        [0, 0],
      ],
      20,
    );
    expect(east[0]!.angle).toBeCloseTo(0);
    expect(Math.abs(west[0]!.angle)).toBeCloseTo(Math.PI);
  });

  it('gives a short pipe one arrow rather than none', () => {
    // No arrow reads as "direction unknown", which is a different and untrue
    // statement about a pipe the record does describe.
    const arrows = arrowsAlong(
      [
        [0, 0],
        [2, 0],
      ],
      ARROW_SPACING_M,
    );
    expect(arrows).toHaveLength(1);
    expect(arrows[0]!.at).toEqual([1, 0]);
  });

  it('carries spacing across a bend instead of restarting at each vertex', () => {
    const arrows = arrowsAlong(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      10,
    );
    // Twenty metres of line at ten-metre spacing, first at five.
    expect(arrows).toHaveLength(2);
  });

  it('turns the corner rather than pointing through it', () => {
    const arrows = arrowsAlong(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      10,
    );
    expect(arrows[0]!.angle).toBeCloseTo(0);
    expect(arrows[1]!.angle).toBeCloseTo(Math.PI / 2);
  });

  it('ignores repeated vertices', () => {
    const arrows = arrowsAlong(
      [
        [0, 0],
        [0, 0],
        [20, 0],
      ],
      10,
    );
    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows.every((a) => Number.isFinite(a.angle))).toBe(true);
  });

  it('returns nothing for a line with no length or a spacing of zero', () => {
    expect(arrowsAlong([[0, 0]], 10)).toEqual([]);
    expect(
      arrowsAlong(
        [
          [0, 0],
          [10, 0],
        ],
        0,
      ),
    ).toEqual([]);
  });
});

describe('lookups', () => {
  const artefact = mapWith(
    [pipe(11, [[0, 0], [10, 0]])],
    [{ asset_number: 22, c: [0, 0] }],
  );

  it('keys pipes and pits by string, whichever type the artefact used', () => {
    // The trace artefact carries strings and the map carries numbers. A join
    // on raw values silently matches nothing and draws an empty path.
    expect(pipesByRef(artefact).get('11')?.ref).toBe(11);
    expect(pitsByAsset(artefact).get('22')).toEqual([0, 0]);
  });

  it('is empty for an artefact with no network layers', () => {
    const bare = { ...artefact, layers: {} };
    expect(pipesByRef(bare).size).toBe(0);
    expect(pitsByAsset(bare).size).toBe(0);
  });
});

describe('stoppedBecauseOfTheRecord', () => {
  it('separates a gap in the record from our own clip', () => {
    expect(stoppedBecauseOfTheRecord('unrecorded-destination')).toBe(true);
    expect(stoppedBecauseOfTheRecord('no-recorded-connection')).toBe(true);
    expect(stoppedBecauseOfTheRecord('cycle-guard')).toBe(true);
    expect(stoppedBecauseOfTheRecord('leaves-mapped-area')).toBe(false);
  });
});

describe('endingPoint', () => {
  const pipes = pipesByRef(mapWith([pipe(11, [[0, 0], [10, 0]])], []));
  const pits = pitsByAsset(
    mapWith([], [{ asset_number: 22, c: [0, 0] }]),
  );

  it('marks the far end of a pipe that could not be followed', () => {
    const at = endingPoint(
      { atPit: '22', pipe: '11', reason: 'unrecorded-destination', step: 0 },
      pipes,
      pits,
    );
    expect(at).toEqual([10, 0]);
  });

  it('marks the pit itself when no pipe was recorded', () => {
    const at = endingPoint(
      { atPit: '22', pipe: null, reason: 'no-recorded-connection', step: 0 },
      pipes,
      pits,
    );
    expect(at).toEqual([0, 0]);
  });

  it('falls back to the pit when the pipe is not in the map', () => {
    const at = endingPoint(
      { atPit: '22', pipe: 'absent', reason: 'unrecorded-destination', step: 0 },
      pipes,
      pits,
    );
    expect(at).toEqual([0, 0]);
  });
});

describe('drawTrace', () => {
  const artefact = mapWith(
    [pipe(1, [[100, 100], [200, 100]]), pipe(2, [[200, 100], [300, 100]])],
    [
      { asset_number: 10, c: [100, 100] },
      { asset_number: 20, c: [200, 100] },
      { asset_number: 30, c: [300, 100] },
    ],
  );
  const viewport = fit(800, 600, { widthM: 1000, heightM: 1000 });

  const chain = (): Trace =>
    traceDownstream(
      {
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
        links: {
          '10': [{ pipe: '1', to: '20' }],
          '20': [{ pipe: '2', to: '30' }],
          '30': [],
        },
      },
      '10',
    );

  it('strokes the traced pipes', () => {
    const { calls, context } = recordingContext();
    drawTrace(context, artefact, chain(), viewport);
    expect(calls.filter((c) => c.op === 'stroke').length).toBeGreaterThan(0);
  });

  it('draws a halo under the path so it reads over the network beneath it', () => {
    const { calls, context } = recordingContext();
    drawTrace(context, artefact, chain(), viewport);
    const widths = calls.filter((c) => c.op === 'lineWidth').map((c) => c.args[0]);
    expect(widths).toContain(7);
    expect(widths).toContain(3.5);
  });

  it('marks a stop in the record differently from one at the map edge', () => {
    const { calls, context } = recordingContext();
    drawTrace(context, artefact, chain(), viewport);
    const fills = calls.filter((c) => c.op === 'fillStyle').map((c) => c.args[0]);
    expect(fills).toContain(TRACE_DAY.stopIncomplete);
    expect(fills).not.toContain(TRACE_DAY.stopOutside);
  });

  it('marks a stop at the map edge in grey rather than the record colour', () => {
    // The complement of the test above, and the reason both exist: these two
    // endings are different facts about the council's record, and a map that
    // painted them the same colour would say the data ran out where it did not.
    const { calls, context } = recordingContext();
    const toTheEdge = traceDownstream(
      {
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
        links: {
          '10': [{ pipe: '1', to: '20' }],
          '20': [{ pipe: 'out', ends: 'leaves-mapped-area' }],
        },
      },
      '10',
    );
    drawTrace(context, artefact, toTheEdge, viewport);
    const fills = calls.filter((c) => c.op === 'fillStyle').map((c) => c.args[0]);
    expect(fills).toContain(TRACE_DAY.stopOutside);
    expect(fills).not.toContain(TRACE_DAY.stopIncomplete);
  });

  it('draws the start marker last so the path cannot cover it', () => {
    const { calls, context } = recordingContext();
    drawTrace(context, artefact, chain(), viewport);
    const fills = calls.filter((c) => c.op === 'fillStyle');
    expect(fills[fills.length - 1]?.args[0]).toBe(TRACE_DAY.start);
  });

  it('restores the context it saved', () => {
    // A trace that left its stroke style behind would silently repaint the
    // next thing drawn on this canvas.
    const { calls, context } = recordingContext();
    drawTrace(context, artefact, chain(), viewport);
    expect(calls.filter((c) => c.op === 'save')).toHaveLength(
      calls.filter((c) => c.op === 'restore').length,
    );
  });

  it('draws nothing but the start for a trace with no followable pipe', () => {
    const { calls, context } = recordingContext();
    const stopped = traceDownstream(
      {
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
        links: { '10': [] },
      },
      '10',
    );
    drawTrace(context, artefact, stopped, viewport);
    expect(calls.filter((c) => c.op === 'lineTo')).toHaveLength(0);
  });

  it('survives a trace naming a pipe the map does not carry', () => {
    const { context } = recordingContext();
    const orphan: Trace = {
      start: '10',
      pits: ['10'],
      pipes: [{ pipe: 'absent', from: '10', to: '20', step: 0 }],
      endings: [],
      steps: 1,
      incomplete: false,
    };
    expect(() => drawTrace(context, artefact, orphan, viewport)).not.toThrow();
  });
});
