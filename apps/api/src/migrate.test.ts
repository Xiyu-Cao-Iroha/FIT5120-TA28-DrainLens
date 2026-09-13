/**
 * The ordering rules, which are the part that can be wrong without failing.
 *
 * A migration runner that applies files in the wrong order still exits zero on
 * a fresh database most of the time, because most migrations do not depend on
 * each other. It goes wrong on the one that does, months later, on the
 * instance that matters. These are cheap to state and there is no reason to
 * find out the expensive way.
 */

import { describe, expect, it } from 'vitest';

import { BUNDLED, COUNCIL } from './load.js';
import { MigrateError, plan, sourceFrom, versionOf } from './migrate.js';

describe('reading a version off a filename', () => {
  it('takes the leading number', () => {
    expect(versionOf('001_init.sql')).toBe(1);
    expect(versionOf('012_add_population.sql')).toBe(12);
  });

  it('refuses a file whose order is not defined, naming it', () => {
    expect(() => versionOf('init.sql')).toThrow(MigrateError);
    expect(() => versionOf('init.sql')).toThrow('init.sql');
  });
});

describe('deciding what to apply', () => {
  it('orders by number, not by name', () => {
    // The failure a string sort produces: '010' sorts before '002', so the
    // tenth migration runs second and the table it alters does not exist yet.
    const files = ['010_tenth.sql', '002_second.sql', '001_init.sql'];
    expect(plan(files, new Set()).map((m) => m.version)).toEqual([1, 2, 10]);
  });

  it('skips what the ledger already holds', () => {
    const files = ['001_init.sql', '002_second.sql', '003_third.sql'];
    expect(plan(files, new Set([1, 2])).map((m) => m.file)).toEqual(['003_third.sql']);
  });

  it('applies nothing to a database that is already current', () => {
    expect(plan(['001_init.sql'], new Set([1]))).toEqual([]);
  });

  it('ignores what is not SQL, so a README beside the migrations is harmless', () => {
    expect(plan(['README.md', '001_init.sql'], new Set()).map((m) => m.file)).toEqual([
      '001_init.sql',
    ]);
  });

  it('refuses two files claiming one version rather than picking one', () => {
    // Whichever ran first would record the version, and the other would never
    // run again -- on every database, silently, forever.
    const files = ['002_areas.sql', '002_population.sql'];
    expect(() => plan(files, new Set())).toThrow(MigrateError);
    expect(() => plan(files, new Set())).toThrow('both claim version 2');
  });

  it('refuses an unnumbered migration rather than putting it last', () => {
    expect(() => plan(['001_init.sql', 'hotfix.sql'], new Set())).toThrow(MigrateError);
  });
});

/**
 * Which extent the job loads, which is the argument nobody can check by
 * looking at the service afterwards.
 *
 * A deployment that loaded the wrong one answers every route, draws a map and
 * says nothing is wrong; it is just a different city than the one that was
 * asked for. So each way of getting it wrong is a refusal here, and the
 * refusal says what the right values are.
 */
describe('choosing the extent to load', () => {
  it('defaults to the extent that ships, so a bare run means what it always did', () => {
    expect(sourceFrom([])).toBe(BUNDLED);
    expect(sourceFrom(['--schema-only'])).toBe(BUNDLED);
  });

  it('takes a published extent by name', () => {
    expect(sourceFrom(['--extent', 'city-of-melbourne'])).toBe(COUNCIL);
    expect(sourceFrom(['--extent', 'kensington'])).toBe(BUNDLED);
  });

  it('refuses an unknown extent, and lists the ones that exist', () => {
    // Never a fall back to the default: that is the failure that looks healthy.
    expect(() => sourceFrom(['--extent', 'melbourne'])).toThrow(MigrateError);
    expect(() => sourceFrom(['--extent', 'melbourne'])).toThrow(
      'city-of-melbourne, kensington',
    );
  });

  it('refuses a directory with no extent to write onto its rows', () => {
    expect(() => sourceFrom(['--data', '/tmp/whatever'])).toThrow('does not name its extent');
  });

  it('takes a directory when it is told what is in it', () => {
    const from = sourceFrom(['--data', '/tmp/rebuilt', '--extent', 'city-of-melbourne']);
    expect(from.extent).toBe('city-of-melbourne');
    expect(from.dir).not.toBe(COUNCIL.dir);
  });

  it('is not confused by --replace sitting between the flag and its value', () => {
    expect(sourceFrom(['--replace', '--extent', 'city-of-melbourne'])).toBe(COUNCIL);
    expect(sourceFrom(['--extent', 'city-of-melbourne', '--replace'])).toBe(COUNCIL);
  });

  it('refuses a flag whose value is the next flag', () => {
    // `--extent --schema-only` would otherwise look for an extent called
    // '--schema-only' and report that as the unknown one.
    expect(() => sourceFrom(['--extent', '--schema-only'])).toThrow('--extent needs a value');
    expect(() => sourceFrom(['--data'])).toThrow('--data needs a value');
  });
});
