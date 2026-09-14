/**
 * The retired names stay retired.
 *
 * The copy review found one concept under two or three names across the site;
 * the fix was one set of names in `terms.ts`. A name that comes back in one
 * string is the review's finding again, so this reads every source file the
 * site is built from — comments stripped, because a comment explaining why a
 * word was retired has to be able to say the word — and fails on any retired
 * term left in what is shown.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FULL_MAP, LAYER, RETIRED_TERMS, SOURCE } from './terms.js';

const SRC = path.resolve(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const at = path.join(dir, name);
    if (statSync(at).isDirectory()) return sources(at);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.ts$/.test(name) || at.endsWith(path.join('ui', 'terms.ts'))) return [];
    return [at];
  });
}

/** Block comments, including JSX comment blocks, and line comments out; strings and JSX text stay. */
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

describe('the names the site uses', () => {
  it('shows none of the retired terms anywhere a resident reads', () => {
    const found: string[] = [];
    for (const file of sources(SRC)) {
      const code = withoutComments(readFileSync(file, 'utf8'));
      for (const term of RETIRED_TERMS) {
        if (code.includes(term)) found.push(`${path.relative(SRC, file)}: ${term}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('gives each source and layer one short name', () => {
    expect(SOURCE).toEqual({ recorded: 'Council record', derived: 'Calculated by DrainLens', setting: 'Your setting' });
    expect(Object.values(LAYER)).toEqual([
      'Drain pits',
      'Drain pipes',
      'Likely water paths',
      'Low areas',
      'Ground height',
      'Limited ground data',
    ]);
    expect(FULL_MAP).toBe('Full map');
  });
});
