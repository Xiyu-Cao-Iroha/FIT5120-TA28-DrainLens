import { defineConfig } from 'vitest/config';

/**
 * The tests that need a database, kept out of the suite everybody runs.
 *
 * `vitest.config.ts` is the gate: under five seconds, on any machine, with
 * nothing installed but Node. Tests that need Postgres cannot meet either half
 * of that — they are slower, and without Docker running they do not fail, they
 * refuse to start. Putting them in the default run would mean nobody could
 * test anything without a container.
 *
 * That is the same rule the main config states for slow tests, applied to a
 * different reason for being unrunnable.
 *
 *   docker compose -f db/docker-compose.yml up -d
 *   npm run test:db
 *
 * There is no coverage threshold here. Coverage is a claim about the unit
 * suite; this suite exists to prove that the SQL and the artefacts agree,
 * which is a different question and is not measured in percent.
 */
export default defineConfig({
  test: {
    include: ['apps/*/test-db/**/*.test.ts'],
    environment: 'node',
    // A load of nine hundred pits is not a millisecond, and the first run also
    // pulls the schema up.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One database, one schema. Files running in parallel would truncate each
    // other's rows halfway through an assertion.
    fileParallelism: false,
  },
});
