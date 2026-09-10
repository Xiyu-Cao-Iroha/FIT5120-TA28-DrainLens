/**
 * The four things somebody is told before the whole map opens.
 *
 * These are the sentences the five-second wait exists to buy, and they are the
 * plainest ones in the product — everything else here is hedged. A plain
 * sentence that is false is not a smaller error than a hedged one, so the
 * contents are asserted rather than trusted to a reviewer's eye.
 */

import { describe, expect, it } from 'vitest';

import {
  LOCK_NOTICE_SECONDS,
  NOTHING_LEARNED,
  SECTIONS,
  SECTION_ORDER,
  allLearned,
  countLearned,
  lockNotice,
  nextSection,
} from './sections.js';

const learned = (...ids: readonly string[]) =>
  Object.fromEntries(SECTION_ORDER.map((id) => [id, ids.includes(id)])) as Record<
    string,
    boolean
  > as never;

describe('the disclosure before the whole map', () => {
  it('says how much ground is actually on screen, for each extent', () => {
    /*
     * It read "one square kilometre of Kensington" for as long as that was the
     * only extent. The database now holds the whole council, so on the first
     * day the API answered, the screen whose entire purpose is to say what the
     * reader is about to look at opened by telling them it was seventy-five
     * times smaller than it is.
     */
    expect(lockNotice('city-of-melbourne')[0]).toContain('City of Melbourne');
    expect(lockNotice('city-of-melbourne')[0]).not.toContain('one square kilometre');
    expect(lockNotice('kensington')[0]).toContain('one square kilometre');
  });

  it('says the ground was measured somewhere smaller than the map', () => {
    // The recorded network expanded and the terrain did not. A reader looking
    // at 75 km² with no water paths on it has to be able to tell "no water
    // goes here" from "nobody measured this ground".
    const wide = lockNotice('city-of-melbourne');
    expect(wide.some((s) => s.includes('nothing is claimed'))).toBe(true);
  });

  it('keeps the two sentences that are true of any extent', () => {
    for (const name of ['kensington', 'city-of-melbourne', 'something-else']) {
      const notice = lockNotice(name);
      expect(notice.some((s) => s.includes('that is not a loading failure'))).toBe(true);
      expect(notice.some((s) => s.includes('not a flood warning'))).toBe(true);
    }
  });

  it('is always four lines, whatever the extent', () => {
    // Five seconds is only defensible against something a person can read in
    // five seconds.
    for (const name of ['kensington', 'city-of-melbourne', 'unknown']) {
      expect(lockNotice(name)).toHaveLength(4);
    }
  });

  it('falls back to the narrower claim for an extent it does not know', () => {
    // Claiming less ground than is on screen is the safe direction to be wrong
    // in; claiming more is the direction that misleads.
    expect(lockNotice('unknown')[0]).toContain('one square kilometre');
  });

  it('waits five seconds, which is what the four lines are worth', () => {
    expect(LOCK_NOTICE_SECONDS).toBe(5);
  });
});

describe('what has been finished', () => {
  it('starts with nothing learned', () => {
    expect(countLearned(NOTHING_LEARNED)).toBe(0);
    expect(allLearned(NOTHING_LEARNED)).toBe(false);
  });

  it('unlocks the map only when all four are done', () => {
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
