/**
 * The four things somebody is told before the full map opens.
 *
 * These are the plainest sentences in the product — everything else here is
 * hedged. A plain sentence that is false is not a smaller error than a hedged
 * one, so the contents are asserted rather than trusted to a reviewer's eye.
 */

import { describe, expect, it } from 'vitest';

import {
  NOTHING_LEARNED,
  SECTIONS,
  SECTION_ORDER,
  allLearned,
  countLearned,
  guideTitleOf,
  lockNotice,
  nextSection,
} from './sections.js';

const learned = (...ids: readonly string[]) =>
  Object.fromEntries(SECTION_ORDER.map((id) => [id, ids.includes(id)])) as Record<
    string,
    boolean
  > as never;

describe('the disclosure before the full map', () => {
  it('says how much ground is actually on screen, for each extent', () => {
    /*
     * It read "one square kilometre of Kensington" for as long as that was the
     * only extent. The database now holds the whole council, so on the first
     * day the API answered, the screen whose entire purpose is to say what the
     * reader is about to look at opened by telling them it was seventy-five
     * times smaller than it is.
     */
    expect(lockNotice('city-of-melbourne').said[0]).toBe('The map covers the City of Melbourne.');
    expect(lockNotice('kensington').said[0]).toContain('one square kilometre of Kensington');
    expect(lockNotice('kensington').said[0]).not.toContain('City of Melbourne');
  });

  it('says the calculated layers are drawn only where the ground data allows', () => {
    // A reader looking at a street with no water paths on it has to be able to
    // tell "no water goes here" from "there was not enough ground data here".
    for (const name of ['kensington', 'city-of-melbourne']) {
      const ground = lockNotice(name).more.find((s) => s.includes('ground data')) ?? '';
      expect(ground).toContain('only where enough ground data is available');
      expect(ground).not.toContain('drainage record');
    }
  });

  it('says the safety line up front and folds the record line, for any extent', () => {
    // Copy audit v2, #52: the extent and "not a flood warning" are the two
    // said before the button; the other two are behind More information.
    for (const name of ['kensington', 'city-of-melbourne', 'something-else']) {
      const { said, more } = lockNotice(name);
      expect(said[1]).toContain('not live flood warnings');
      expect(more.some((s) => s.includes('may mean the council record ends there'))).toBe(true);
    }
  });

  it('is two lines said and two folded, whatever the extent', () => {
    // Short enough to read before pressing the button beside it.
    for (const name of ['kensington', 'city-of-melbourne', 'unknown']) {
      expect(lockNotice(name).said).toHaveLength(2);
      expect(lockNotice(name).more).toHaveLength(2);
    }
  });

  it('falls back to the narrower claim for an extent it does not know', () => {
    // Claiming less ground than is on screen is the safe direction to be wrong
    // in; claiming more is the direction that misleads.
    expect(lockNotice('unknown').said[0]).toContain('one square kilometre');
  });
});

describe('what has been finished', () => {
  it('starts with nothing learned', () => {
    expect(countLearned(NOTHING_LEARNED)).toBe(0);
    expect(allLearned(NOTHING_LEARNED)).toBe(false);
  });

  it('counts the guide as done only when all four are', () => {
    expect(allLearned(learned('drainage', 'water-flow', 'low-areas'))).toBe(false);
    expect(allLearned(learned(...SECTION_ORDER))).toBe(true);
  });

  it('offers the first unfinished section, not the one after the last finished', () => {
    // Somebody who takes them out of order is still pointed at something they
    // have not done rather than at the end of the list.
    expect(nextSection(learned('water-flow'))).toBe('drainage');
    expect(nextSection(learned('drainage'))).toBe('water-flow');
    expect(nextSection(learned(...SECTION_ORDER))).toBeNull();
  });

  it('has a section for every map mode, keyed by its own id', () => {
    // The sections are the four modes AC 1.1.2 names. A section whose id did
    // not match a mode would be a fifth way of thinking about the map.
    for (const id of SECTION_ORDER) {
      expect(SECTIONS[id].id).toBe(id);
      expect(SECTIONS[id].label.length).toBeGreaterThan(3);
    }
    expect(SECTION_ORDER).toHaveLength(4);
  });
});

describe('what the header calls a guide', () => {
  it('is the card label, except where the design names the guide', () => {
    expect(guideTitleOf('terrain')).toBe('Ground height guide');
    expect(SECTIONS.terrain.label).toBe('The shape of the ground');
    for (const id of ['drainage', 'water-flow', 'low-areas'] as const) {
      expect(guideTitleOf(id)).toBe(SECTIONS[id].label);
    }
  });
});
