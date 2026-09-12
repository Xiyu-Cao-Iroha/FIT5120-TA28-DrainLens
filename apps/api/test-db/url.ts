/**
 * Where the database tests look for a database.
 *
 * **One copy, because there were four and one of them was different.**
 * `both.test.ts` read `DATABASE_URL` with no fallback, so on a laptop running
 * only `docker compose -f db/docker-compose.yml up -d` — which is what
 * `README.md` and `DEVELOPMENT.md` tell you to run — it reached `pg`'s own
 * default of `localhost:5432` and failed with `ECONNREFUSED` while its three
 * neighbours passed against 5433.
 *
 * CI sets the variable, so the disagreement was invisible there and the file
 * looked healthy on every pull request. It is the kind of thing that is only
 * ever found by somebody running the suite the way the documentation says to.
 *
 * 5433 rather than 5432 is deliberate: the port is unusual so that the suite
 * cannot connect to a Postgres somebody already had running and start dropping
 * schemas in it. `beforeAll` here runs `DROP SCHEMA public CASCADE`.
 */
export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://drainlens:drainlens-local-only@localhost:5433/drainlens';
