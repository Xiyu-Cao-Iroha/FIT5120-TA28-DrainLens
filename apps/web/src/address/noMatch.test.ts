/**
 * The two silences a search box can have, and why they are different.
 *
 * Reported on 3 October: typing *parkville* gave nothing, with no suggestion
 * list and no sentence. The index holds Parkville; what the reporter had was
 * the Kensington fallback, which is that index clipped to one square
 * kilometre. One of those is the reader's spelling and the other is the
 * product's limit, and a box that says nothing looks broken either way.
 */

import { describe, expect, it } from 'vitest';

import { noMatch, searchable } from './noMatch.js';
import type { AddressIndex, IndexedAddress } from './search.js';

const at = (suburb: string): IndexedAddress => ({
  id: `x/${suburb}`,
  label: `1 Smith Street, ${suburb}`,
  number: '1',
  street: 'Smith Street',
  suburb,
  e: 1,
  n: 1,
  at: 0,
});

const index = (suburbs: readonly string[], clipped = false): AddressIndex => ({
  area: 'city-of-melbourne',
  addresses: suburbs.map(at),
  ...(clipped ? { clipped: true } : {}),
});

describe('what it says when nothing matched', () => {
  it('says nothing at all while there are matches', () => {
    expect(noMatch(index(['Kensington']), 'kens', 3)).toBeNull();
  });

  it('says nothing on the first keystroke, which matches everything and nothing', () => {
    expect(noMatch(index(['Kensington']), 'k', 0)).toBeNull();
    expect(noMatch(index(['Kensington']), '  ', 0)).toBeNull();
  });

  it('names the place that was typed, so the reader can see the typo', () => {
    const said = noMatch(index(['Kensington', 'Flemington']), 'parkvile', 0);
    expect(said).toContain('parkvile');
    expect(said).toContain('Kensington');
  });

  it('blames the map rather than the reader where the map is the clipped one', () => {
    const said = noMatch(index(['Kensington', 'Flemington'], true), 'parkville', 0);
    expect(said).toMatch(/full council map is not available/);
    expect(said).toContain('Flemington and Kensington');
    // Not the reader's spelling: the word they typed is not quoted back.
    expect(said).not.toContain('parkville');
  });
});

describe('listing what can be searched', () => {
  it('reads as a sentence for a short list', () => {
    expect(searchable(index(['Kensington', 'Flemington']))).toBe('Flemington and Kensington');
  });

  it('counts the rest once the list would stop being readable', () => {
    const many = ['Melbourne', 'Carlton', 'Docklands', 'Kensington', 'Parkville', 'Southbank'];
    expect(searchable(index(many))).toBe('Carlton, Docklands, Kensington, Melbourne and 2 more');
  });

  it('uses one and, wherever the list ends', () => {
    // It read "… Docklands and East Melbourne, and 10 more" on the deployed
    // build: two conjunctions in a line somebody reads when they are already
    // not finding what they wanted.
    const many = ['Melbourne', 'Carlton', 'Docklands', 'Kensington', 'Parkville', 'Southbank'];
    for (const list of [searchable(index(many)), searchable(index(['A', 'B', 'C']))]) {
      expect(list.split(' and ')).toHaveLength(2);
    }
  });
});
