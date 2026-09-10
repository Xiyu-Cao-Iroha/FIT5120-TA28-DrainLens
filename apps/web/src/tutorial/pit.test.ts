/**
 * Which pit the guide points at.
 *
 * The behaviour is checked against fixtures, because a fixture is the only way
 * to write down the cases the real artefact does not contain — a pit that
 * leads nowhere, a tie, a candidate outside the radius.
 *
 * **The claim about the real data lives in `tools/data/check-guide.mjs`**,
 * which CI runs: that every one of the 4,089 published addresses has an inlet
 * with a downstream within reach. That is a claim about *the artefact* rather
 * than about this function, a fixture could only prove the fixture, and
 * checking it here costs four and a half seconds in a suite already over its
 * gate. The failure it catches is silent — an artefact where some address has
 * no candidate, so the guide points four hundred metres away and asks the
 * reader to press something that is not on their screen.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { TEACHING_RADIUS_M, chooseTeachingPit } from './pit.js';
import type { Pit } from '../map/artefact.js';
import type { Local } from '../map/viewport.js';
import { type Link, type TraceArtefact, traceDownstream } from '../trace/graph.js';
import { surfaceEntryOf } from '../crosssection/section.js';
import { type PackedIndex, unpack } from '../address/search.js';

const pit = (asset_number: number, c: Local, type = 'Grated Side Entry'): Pit =>
  ({ g: 'point', c, asset_number, object_type_lupvalue: type }) as unknown as Pit;

const traceOf = (links: Record<string, readonly Link[]>): TraceArtefact =>
  ({ artefact: 'drainage-trace', links, terminations: {}, counts: {} }) as unknown as TraceArtefact;

/** a → b → c → d, so a is three hops deep and c is one. */
const CHAIN = traceOf({
  '1': [{ pipe: 'p1', to: '2' }],
  '2': [{ pipe: 'p2', to: '3' }],
  '3': [{ pipe: 'p3', to: '4' }],
  '4': [],
});

describe('what makes a pit worth pointing at', () => {
  it('refuses a pit whose record stops at the pit', () => {
    // 215 of 895 in the real extent. Pressing "Show connected pipe" on one of
    // these draws nothing, which is the bug the reader cannot diagnose: they
    // pressed what they were told to press.
    const chosen = chooseTeachingPit([0, 0], [pit(4, [1, 0])], CHAIN);
    expect(chosen).toBeNull();
  });

  it('refuses a pit the record does not call a way in', () => {
    // A junction leads somewhere and is still the wrong thing to teach on:
    // the sentence beside it says water runs off the street and in.
    const junction = pit(1, [1, 0], 'Junction');
    expect(chooseTeachingPit([0, 0], [junction], CHAIN)).toBeNull();
  });

  it('takes an inlet that leads somewhere', () => {
    const chosen = chooseTeachingPit([0, 0], [pit(1, [3, 4])], CHAIN);
    expect(chosen?.pit.asset_number).toBe(1);
    expect(chosen?.steps).toBe(3);
    expect(chosen?.distanceM).toBeCloseTo(5);
  });

  it('reads "inlet" the same way the pit card does', () => {
    // Both go through `surfaceEntryOf`. If they ever disagreed, the guide
    // would point at a pit whose own card says water does not enter there.
    const chosen = chooseTeachingPit([0, 0], [pit(1, [1, 0], 'Grated Kerbside')], CHAIN);
    expect(chosen).not.toBeNull();
  });
});

describe('choosing between candidates', () => {
  it('prefers the longer path over the nearer pit', () => {
    // A one-pipe trace teaches less than a three-pipe one, and within a couple
    // of hundred metres the walk is the same walk.
    const near = pit(3, [1, 0]); // one hop
    const far = pit(1, [50, 0]); // three hops
    expect(chooseTeachingPit([0, 0], [near, far], CHAIN)?.pit.asset_number).toBe(1);
  });

  it('breaks a tie on distance', () => {
    const tie = traceOf({ '1': [{ pipe: 'a', to: '9' }], '2': [{ pipe: 'b', to: '9' }], '9': [] });
    const chosen = chooseTeachingPit([0, 0], [pit(1, [30, 0]), pit(2, [10, 0])], tie);
    expect(chosen?.pit.asset_number).toBe(2);
  });

  it('ignores the long path outside the radius when a shorter one is inside', () => {
    const inside = pit(3, [10, 0]); // one hop, near
    const outside = pit(1, [TEACHING_RADIUS_M + 50, 0]); // three hops, too far
    expect(chooseTeachingPit([0, 0], [inside, outside], CHAIN)?.pit.asset_number).toBe(3);
  });

  it('falls back to the nearest candidate when none is within the radius', () => {
    // A radius chosen from today's artefact is a radius a new artefact can
    // invalidate in silence. Degrading to "the nearest one" is visibly odd;
    // returning nothing would look like the guide is broken.
    const far = pit(1, [TEACHING_RADIUS_M * 3, 0]);
    const further = pit(3, [TEACHING_RADIUS_M * 4, 0]);
    expect(chooseTeachingPit([0, 0], [far, further], CHAIN)?.pit.asset_number).toBe(1);
  });

  it('returns null when the artefact holds no candidate at all', () => {
    // A data problem, and the screen that asks for this can say so far better
    // than a stack trace can.
    expect(chooseTeachingPit([0, 0], [pit(4, [1, 0])], CHAIN)).toBeNull();
  });
});

describe('against the published artefacts', () => {
  const read = (name: string): unknown =>
    JSON.parse(
      readFileSync(path.resolve(__dirname, '../../public/data', name), 'utf8'),
    ) as unknown;

  const map = read('map.json') as { layers: { pit: readonly Pit[] } };
  const trace = read('trace.json') as TraceArtefact;
  // Unpacked the way the browser unpacks it. The index ships grouped by
  // street with the label left out, and a test reading the raw file would be
  // testing a shape nothing else in the product sees.
  const index = unpack(read('addresses.json') as PackedIndex);

  /*
    A smoke test, not the invariant. The claim that *every* one of the 4,089
    addresses has a candidate is checked by `tools/data/check-guide.mjs`, which
    CI runs: it costs four and a half seconds here, and this suite is already
    over its five-second gate. Buying that assurance at twice the price of the
    thing it protects is the trade this file declines to make.
  */
  it.each(['46 Gatehouse Drive, Kensington', '13 Neale Street, Kensington'])(
    'points %s at an inlet that leads somewhere',
    (label) => {
      // The two demonstration addresses -- what a walkthrough actually uses.
      const address = index.addresses.find((a) => a.label === label);
      expect(address).toBeDefined();
      const chosen = chooseTeachingPit(
        [address?.e ?? 0, address?.n ?? 0],
        map.layers.pit,
        trace,
      );
      expect(chosen?.steps ?? 0).toBeGreaterThan(0);
      expect(chosen?.distanceM ?? Infinity).toBeLessThanOrEqual(TEACHING_RADIUS_M);
    },
  );

  it('reads the real artefacts rather than a fixture shaped like them', () => {
    // The guard on the guard. If these files ever stop parsing into the shape
    // above, the two tests before this go green against nothing.
    expect(map.layers.pit.length).toBeGreaterThan(800);
    expect(index.addresses.length).toBeGreaterThan(4000);
  });

  it('counts the same teachable pits as the CI script does: 368 of 895', () => {
    /*
     * `tools/data/check-guide.mjs` restates this rule in plain JavaScript
     * because it cannot import a TypeScript module, and a restated rule can
     * drift from the one it restates — silently, and in the direction that
     * matters least, with the script passing while the app picks differently.
     *
     * This number is the tie between them, and it earned its place on the
     * first run. Three readings of "leads somewhere" were tried:
     *
     * - **378**, counting any entry in `links` — wrong, because 10 of those
     *   entries are *terminations*, the record saying the path stops here;
     * - **365**, walking down `links[id][0]` — wrong the other way, because
     *   `traceDownstream` takes the *deepest* branch, so a pit whose first
     *   link terminates and whose second leads onward is a dead end to that
     *   walk and teachable to the application;
     * - **368**, at least one link naming a pit to go to. What both use now.
     *
     * The middle one is the reason this test exists: it passed the script and
     * disagreed with the app, which is precisely the drift a restated rule
     * makes and precisely the direction nobody would notice.
     */
    const teachable = map.layers.pit.filter(
      (p) =>
        p.asset_number !== undefined &&
        surfaceEntryOf(p) === 'recorded-inlet' &&
        traceDownstream(trace, String(p.asset_number)).steps >= 1,
    );
    expect(teachable.length).toBe(368);
    expect(map.layers.pit.length).toBe(895);
  });
});
