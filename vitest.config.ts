import { defineConfig } from 'vitest/config';

/**
 * Coverage thresholds are the numbers the team committed to in its Week 4 KPI
 * assessment, not aspirations: 88% overall, and 90% for every module that
 * carries a judgement. `packages/schema` and `packages/scenario` are entirely
 * judgement-carrying, so both are held to the higher figure from their first
 * iteration.
 *
 * The suite is also required to finish in under five seconds. Anything that
 * would breach that belongs behind a separate script, not in this run.
 */
export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/index.ts',
        '**/*.d.ts',
        // Covered by `npm run test:db`, not by this run, and excluded here so
        // that the percentage stays a statement about the unit suite rather
        // than a number nobody can act on. It is not untested: twelve tests in
        // `apps/api/test-db/load.test.ts` load it against a real Postgres and
        // reconcile every table against the published artefacts. Excluding it
        // *before* those existed would have been hiding untested code behind a
        // gate, which is a different thing entirely.
        //
        // The same applies to the loader, the queries and the server: all
        // three are exercised by `npm run test:db` against a real Postgres --
        // twenty-four tests, four of which run the frontend's own guards over
        // the API's responses. Excluding any of them *before* those tests
        // existed would have been hiding untested code behind a gate; the
        // exclusion came second, and each file was red first.
        'apps/api/src/load.ts',
        'apps/api/src/queries.ts',
        'apps/api/src/server.ts',
      ],
      thresholds: {
        lines: 88,
        functions: 88,
        branches: 88,
        statements: 88,
        'packages/schema/src/**': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        'packages/scenario/src/**': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  },
});
