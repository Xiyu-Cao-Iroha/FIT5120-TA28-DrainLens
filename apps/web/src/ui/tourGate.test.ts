/**
 * The gate, including the cases a browser only produces when it is unhappy.
 *
 * Every one of these is reachable in a real browser — a fresh visitor, a
 * returning one, a private window with site data blocked, a full quota — and
 * none of them is reachable by clicking around in a healthy one. That is the
 * whole reason `makeTourGate` takes its store rather than reaching for
 * `localStorage` itself.
 */

import { describe, expect, it } from 'vitest';

import { makeTourGate } from './tourGate.js';

/** A store that behaves, holding whatever is put in it. */
function workingStore(initial: Record<string, string> = {}): Storage {
  const held = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => {
      held.set(key, value);
    },
    removeItem: (key: string) => {
      held.delete(key);
    },
    clear: () => {
      held.clear();
    },
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

/** A store that throws on everything, the way a blocked one does. */
function hostileStore(): Storage {
  const refuse = () => {
    throw new Error('site data is blocked');
  };
  return {
    getItem: refuse,
    setItem: refuse,
    removeItem: refuse,
    clear: refuse,
    key: refuse,
    length: 0,
  } as unknown as Storage;
}

describe('a visitor who has not seen it', () => {
  it('is shown the tour', () => {
    expect(makeTourGate(workingStore()).seen()).toBe(false);
  });

  it('is not shown it twice', () => {
    const gate = makeTourGate(workingStore());
    gate.remember();
    expect(gate.seen()).toBe(true);
  });

  it('is not shown it again on a later visit, which is a different gate', () => {
    // The point of writing to the device rather than to memory: a new page
    // load builds a new gate over the same store.
    const store = workingStore();
    makeTourGate(store).remember();
    expect(makeTourGate(store).seen()).toBe(true);
  });
});

describe('what is actually written', () => {
  it('is one key holding one character, and nothing else', () => {
    // If this ever fails because somebody added a timestamp or a step count,
    // that is the test doing its job: the argument for storing anything here
    // is that what is stored says nothing about the person.
    const store = workingStore();
    makeTourGate(store).remember();
    expect(store.getItem('drainlens.tour.seen')).toBe('1');
  });

  it('does not treat some other value in that key as having seen it', () => {
    const gate = makeTourGate(workingStore({ 'drainlens.tour.seen': 'maybe' }));
    expect(gate.seen()).toBe(false);
  });
});

describe('a browser that will not co-operate', () => {
  it('shows the tour when the store cannot be read', () => {
    // Unreadable is read as "not seen". Showing it to somebody who has had it
    // costs a keystroke; withholding it from somebody who has not is the
    // failure this exists to prevent.
    expect(makeTourGate(hostileStore()).seen()).toBe(false);
  });

  it('still does not show it twice in the same tab', () => {
    // The write throws and there is nothing to do about it, but the person
    // going back to the map should not meet the tour again on the way in.
    const gate = makeTourGate(hostileStore());
    gate.remember();
    expect(gate.seen()).toBe(true);
  });

  it('does the same when there is no store at all', () => {
    const gate = makeTourGate(null);
    expect(gate.seen()).toBe(false);
    gate.remember();
    expect(gate.seen()).toBe(true);
  });
});
