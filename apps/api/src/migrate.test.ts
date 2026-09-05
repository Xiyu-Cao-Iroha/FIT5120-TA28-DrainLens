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

import { MigrateError, plan, versionOf } from './migrate.js';

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
