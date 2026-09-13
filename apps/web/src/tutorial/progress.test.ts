/**
 * What the guide is allowed to remember about a device, and what it does when
 * it cannot remember anything.
 *
 * The interesting property is the shape of the stored value: one key, four
 * characters, each `0` or `1`. Anything else reads as nothing learned. It is
 * asserted here rather than described in a comment because the rule this is
 * protecting — AD1, no identity — is the one nobody would notice being broken
 * by a field quietly added to a JSON blob.
 */

import { describe, expect, it } from 'vitest';

import { decode, encode, makeProgress } from './progress.js';
import { NOTHING_LEARNED, SECTION_ORDER, type Learned } from './sections.js';

const workingStore = (initial: Record<string, string> = {}): Storage => {
  const held = new Map(Object.entries(initial));
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => {
      held.set(key, value);
    },
    removeItem: (key) => {
      held.delete(key);
    },
    clear: () => {
      held.clear();
    },
    key: (index) => [...held.keys()][index] ?? null,
    get length() {
      return held.size;
    },
  } as Storage;
};

const throwingStore = (): Storage =>
  ({
    getItem: () => {
      throw new Error('site data blocked');
    },
    setItem: () => {
      throw new Error('site data blocked');
    },
  }) as unknown as Storage;

const learned = (...ids: readonly string[]): Learned =>
  Object.fromEntries(SECTION_ORDER.map((id) => [id, ids.includes(id)])) as Learned;

describe('what is written to the device', () => {
  it('is one key holding four characters, and nothing else', () => {
    const store = workingStore();
    makeProgress(store).write(learned('drainage'));

    expect(store.length).toBe(1);
    expect(store.getItem('drainlens.learned')).toBe('1000');
  });

  it('carries no address, identifier, timestamp or count', () => {
    // The rule AD1 is about. A value of four characters cannot hold any of
    // them, which is the reason for the shape rather than a happy accident.
    const store = workingStore();
    makeProgress(store).write(learned('drainage', 'terrain'));

    const raw = store.getItem('drainlens.learned') ?? '';
    expect(raw).toMatch(/^[01]{4}$/);
    expect(raw.length).toBe(SECTION_ORDER.length);
  });

  it('round-trips every combination', () => {
    // All sixteen, not a sample: the failure worth catching is one section's
    // position in the string being off by one, which shows on some
    // combinations and not others.
    for (let mask = 0; mask < 1 << SECTION_ORDER.length; mask += 1) {
      const state = Object.fromEntries(
        SECTION_ORDER.map((id, index) => [id, Boolean(mask & (1 << index))]),
      ) as Learned;
      expect(decode(encode(state))).toEqual(state);
    }
  });
});

describe('a stored value that is not what we wrote', () => {
  it.each([
    ['too short', '100'],
    ['too long', '10000'],
    ['not binary', '1x00'],
    ['a JSON blob somebody upgraded us to', '{"drainage":true}'],
    ['empty', ''],
    ['whitespace', '    '],
  ])('reads %s as nothing learned', (_name, raw) => {
    expect(decode(raw)).toEqual(NOTHING_LEARNED);
  });

  it('reads a missing key as nothing learned', () => {
    expect(decode(null)).toEqual(NOTHING_LEARNED);
  });

  it('never returns partial credit from a malformed value', () => {
    // The tempting failure: parse what you can and trust the prefix. That is
    // how somebody ends up locked out of a section they finished, and the
    // cheaper failure is watching a two-minute guide again.
    expect(decode('11')).toEqual(NOTHING_LEARNED);
  });
});

describe('a device that will not store anything', () => {
  it('reads as nothing learned rather than throwing', () => {
    expect(makeProgress(throwingStore()).read()).toEqual(NOTHING_LEARNED);
  });

  it('swallows a failed write, because the session already knows', () => {
    expect(() => {
      makeProgress(throwingStore()).write(learned('drainage'));
    }).not.toThrow();
  });

  it('works with no store at all', () => {
    const none = makeProgress(null);
    expect(none.read()).toEqual(NOTHING_LEARNED);
    expect(() => {
      none.write(learned('drainage'));
    }).not.toThrow();
  });
});

describe('reading back what was written', () => {
  it('returns the sections that were finished', () => {
    const store = workingStore();
    const gate = makeProgress(store);
    gate.write(learned('drainage', 'low-areas'));

    expect(gate.read()).toEqual(learned('drainage', 'low-areas'));
  });

  it('replaces rather than merges, so a section can be taken back', () => {
    const store = workingStore();
    const gate = makeProgress(store);
    gate.write(learned('drainage', 'terrain'));
    gate.write(learned('drainage'));

    expect(gate.read()).toEqual(learned('drainage'));
  });
});
