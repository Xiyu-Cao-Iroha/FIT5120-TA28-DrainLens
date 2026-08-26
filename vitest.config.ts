import { defineConfig } from 'vitest/config';

/**
 * Coverage thresholds are the numbers the team committed to in its Week 4 KPI
 * assessment, not aspirations: 88% overall, and 90% for every module that
 * carries a judgement. `packages/schema` is entirely judgement-carrying, so it
 * is held to the higher figure from its first iteration.
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
      exclude: ['**/*.test.ts', '**/index.ts', '**/*.d.ts'],
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
      },
    },
  },
});
