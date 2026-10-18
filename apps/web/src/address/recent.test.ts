/**
 * The recent-address list: what it keeps, what it drops, and what it leaves
 * alone.
 */

import { describe, expect, it } from 'vitest';

import { type AddressIndex, type IndexedAddress } from '@drainlens/address';

import { MAX_RECENT, recall, remember } from './recent.js';
import type { SupportedAddress } from '../session.js';

const held = (id: string, label: string): SupportedAddress => ({
  id,
  label,
  eastingM: 316_800,
  northingM: 5_815_100,
});

const indexed = (id: string, number: string, street: string): IndexedAddress => ({
  id,
  label: `${number} ${street}, Kensington`,
  number,
  street,
  suburb: 'Kensington',
  e: 316_800,
  n: 5_815_100,
  at: 0,
});

const A = held('a', '46 Gatehouse Drive, Kensington');
const B = held('b', '13 Neale Street, Kensington');
const C = held('c', '10 Bellair Street, Kensington');

const INDEX: AddressIndex = {
  area: 'kensington',
  addresses: [
    indexed('a', '46', 'Gatehouse Drive'),
    indexed('b', '13', 'Neale Street'),
    indexed('c', '10', 'Bellair Street'),
  ],
};

describe('remember', () => {
  it('puts the newest at the front', () => {
    expect(remember(remember([], A), B).map((a) => a.id)).toEqual(['b', 'a']);
  });

  it('moves an address already held rather than holding it twice', () => {
    const list = remember(remember(remember([], A), B), A);
    expect(list.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('keeps the list at MAX_RECENT, dropping the oldest', () => {
    const many = Array.from({ length: MAX_RECENT + 3 }, (_, n) =>
      held(`id-${String(n)}`, `${String(n)} Somewhere Street`),
    );
    const list = many.reduce<readonly SupportedAddress[]>(remember, []);
    expect(list).toHaveLength(MAX_RECENT);
    // Newest first, so the survivors are the last MAX_RECENT chosen.
    expect(list[0]?.id).toBe(`id-${String(MAX_RECENT + 2)}`);
    expect(list.map((a) => a.id)).not.toContain('id-0');
  });

  it('hands back the very same array when there is nothing to change', () => {
    /*
      **Identity, not equality, and the comment in `recent.ts` says why.**
      `reduce` calls this after every event in the application; a new array
      each time would invalidate the `useMemo` that resolves the list against
      62,397 addresses, on every frame of a map drag.
    */
    const one = remember([], A);
    expect(remember(one, A)).toBe(one);
    expect(remember(one, null)).toBe(one);
  });

  it('is not emptied by clearing the address', () => {
    // `address-cleared` sets the address to null. Nobody unsearched anything.
    expect(remember(remember([], A), null).map((a) => a.id)).toEqual(['a']);
  });
});

describe('recall', () => {
  it('returns the full index rows, in the order the list holds them', () => {
    const rows = recall(INDEX, [B, A]);
    expect(rows.map((a) => a.id)).toEqual(['b', 'a']);
    // What the session cannot carry and a suggestion row needs.
    expect(rows[0]?.street).toBe('Neale Street');
    expect(rows[0]?.suburb).toBe('Kensington');
  });

  it('leaves out the address the screen is already on', () => {
    expect(recall(INDEX, [C, B, A], 'b').map((a) => a.id)).toEqual(['c', 'a']);
  });

  it('drops an id this index does not hold', () => {
    /*
      The fallback index covers less than the API does. An address searched
      while the database was answering cannot be put on a map drawn from the
      smaller index, and a row that fails on the press is worse than a
      shorter list.
    */
    expect(recall(INDEX, [held('gone', '1 Nowhere Road, Elsewhere'), A]).map((a) => a.id)).toEqual([
      'a',
    ]);
  });

  it('answers nothing for an empty list without touching the index', () => {
    const trap: AddressIndex = {
      area: 'kensington',
      get addresses(): readonly IndexedAddress[] {
        throw new Error('recall read the index for an empty list');
      },
    };
    expect(recall(trap, [])).toEqual([]);
  });
});
