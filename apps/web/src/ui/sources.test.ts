/**
 * The "About the data" page keeps its promises.
 *
 * Every link on the site opens a section that exists, every section says which
 * acceptance criteria it answers, and the copy follows the audit's rules.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { RETIRED_TERMS } from './terms.js';
import { SOURCE_LINKS, SOURCE_SECTIONS, SOURCES_PAGE } from './sources.js';
import type { PopulationArtefact, ScopeAreas } from '../history/severity.js';

const SRC = path.resolve(__dirname, '..');
const DATA = path.resolve(__dirname, '../../public/data');

/** Every source file the site is built from, tests and this page's own table left out. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const at = path.join(dir, name);
    if (statSync(at).isDirectory()) return sourceFiles(at);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.ts$/.test(name) || at.endsWith(path.join('ui', 'sources.ts'))) return [];
    return [at];
  });
}

/** As in terms.test.ts: comments out, strings and JSX text kept. */
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

const ids = SOURCE_SECTIONS.map((s) => s.id);
const shown = [
  SOURCES_PAGE.title,
  SOURCES_PAGE.intro,
  SOURCES_PAGE.footerLink,
  ...SOURCE_SECTIONS.flatMap((s) => [s.title, s.summary, ...s.points, s.source ?? '']),
  ...Object.values(SOURCE_LINKS).map((l) => l.label),
];

describe('About the data', () => {
  it('has one section per id, and every link opens one of them', () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const link of Object.values(SOURCE_LINKS)) {
      if (link.section !== null) expect(ids).toContain(link.section);
    }
  });

  it('names the criteria behind every section and every link', () => {
    for (const s of SOURCE_SECTIONS) expect(s.ac.length).toBeGreaterThan(0);
    for (const l of Object.values(SOURCE_LINKS)) expect(l.ac.length).toBeGreaterThan(0);
  });

  it('has no link that nothing on the site renders', () => {
    /*
      A simple grep, like terms.test.ts: an id counts as wired when a file that
      uses the About the data page (it imports SourcesPanel or sources) names
      it in quotes, as <SourceLink id="minimum" /> or a table of ids such as
      the legend's groups. Copy audit v4 wired every entry; one left over is
      a label describing a link that no longer exists.
    */
    const users = sourceFiles(SRC)
      .map((file) => withoutComments(readFileSync(file, 'utf8')))
      .filter((code) => /from '[./]*(ui\/)?(SourcesPanel|sources)\.js'/.test(code));
    const unwired = Object.keys(SOURCE_LINKS).filter(
      (id) => !users.some((code) => code.includes(`"${id}"`) || code.includes(`'${id}'`)),
    );
    expect(unwired).toEqual([]);
  });

  it('works the rate example out from the published figures', () => {
    // The example is typed into the page, so it is checked against the data.
    const scope = JSON.parse(readFileSync(path.join(DATA, 'sa2-areas.json'), 'utf8')) as ScopeAreas;
    const population = JSON.parse(readFileSync(path.join(DATA, 'population.json'), 'utf8')) as PopulationArtefact;
    const area = scope.areas.find((a) => a.name === 'Bacchus Marsh');
    const persons = population.areas.find((a) => a.code === area?.code)?.persons[
      population.asAt.indexOf(population.denominator)
    ];
    expect(area?.complete).toBe(true);
    const rate = SOURCE_SECTIONS.find((s) => s.id === 'rate');
    const example = rate?.points.find((p) => p.startsWith('Example:')) ?? '';
    const people = (persons ?? 0).toLocaleString('en-AU');
    expect(example).toContain(`${String(area?.total)} responses and ${people} residents`);
    expect(example).toContain(`= ${((1000 * (area?.total ?? 0)) / (persons ?? 1)).toFixed(2)}.`);
    expect(population.denominator).toBe('2012-06-30');
    expect(rate?.points.join(' ')).toContain('on 30 June 2012');
    expect(rate?.points.join(' ')).toContain(
      `fewer than ${population.minimumResidents.toLocaleString('en-AU')} residents`,
    );
  });

  it('says the checked events come from official sources, not news reports', () => {
    const events = SOURCE_SECTIONS.find((s) => s.id === 'events');
    expect(events?.points.join(' ')).toContain('We do not use news reports.');
    expect(events?.source).toMatch(/^Official publications only/);
    expect(events?.points.at(-1)).toMatch(/does not mean it has never flooded/);
  });

  it('writes SES out in full before using the short form', () => {
    const history = SOURCE_SECTIONS.find((s) => s.id === 'flood-history');
    expect(history?.summary).toContain('Victoria State Emergency Service (SES)');
  });

  it('uses no long dashes, no call-outs and no retired terms', () => {
    for (const line of shown) {
      expect(line).not.toMatch(/[—–]/);
      expect(line.toLowerCase()).not.toContain('call-out');
      for (const term of RETIRED_TERMS) expect(line).not.toContain(term);
    }
  });
});
