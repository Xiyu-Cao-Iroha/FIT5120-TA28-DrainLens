/**
 * The database agrees with the artefacts, or this fails.
 *
 * Every number below was first checked by hand against
 * `apps/web/public/data/*.json` and then written down here, which is the only
 * order that makes them worth anything: a test that asserts whatever the code
 * currently produces is a record of a bug as readily as of a feature.
 *
 * **Two of them are findings rather than counts.** Sixty-nine pipes name a
 * downstream pit that is not in this extent, which is why `upstr_pit` and
 * `dnstr_pit` are not foreign keys — a constraint would reject rows the
 * council record actually contains. And twenty-two pits have no recorded
 * object type, which is why that column is nullable and why the API omits the
 * key rather than sending an empty string.
 *
 * Needs Postgres:
 *
 *   docker compose -f db/docker-compose.yml up -d
 *   npm run test:db
 */

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { load } from '../src/load.js';
import { migrate } from '../src/migrate.js';
import { DATABASE_URL } from './url.js';

let client: pg.Client;

const one = async (sql: string): Promise<string> => {
  const result = await client.query<{ v: string }>(sql);
  return result.rows[0]?.v ?? '';
};

const count = async (table: string): Promise<number> =>
  Number(await one(`SELECT count(*)::text AS v FROM ${table}`));

beforeAll(async () => {
  client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  /*
    From scratch every run. A test that passes only against a database
    somebody loaded by hand last week is not testing the loader.

    **Through `migrate` rather than by reading `001_init.sql`.** This applied
    the first migration and nothing else, which was the same schema while
    there was one migration and quietly stopped being it: 004 added the two
    columns the loader now writes, and this file failed on them while
    `migrate.test.ts` — which uses `migrate` — did not. A second way of
    building the schema is a second schema.
  */
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(client);

  await client.query('BEGIN');
  await load(client);
  await client.query('COMMIT');
}, 120_000);

afterAll(async () => {
  await client.end();
});

describe('what the loader put in', () => {
  it('holds every recorded feature the map publishes', async () => {
    expect(await count('pit')).toBe(895);
    expect(await count('pipe')).toBe(893);
    expect(await count('road')).toBe(220);
    expect(await count('street_label')).toBe(163);
  });

  it('holds every derived shape, across all three layers', async () => {
    expect(await count('derived_shape')).toBe(394);
    expect(Number(await one(`SELECT count(*)::text AS v FROM derived_shape WHERE layer = 'channel'`))).toBe(38);
    expect(Number(await one(`SELECT count(*)::text AS v FROM derived_shape WHERE layer = 'low-point'`))).toBe(310);
    expect(Number(await one(`SELECT count(*)::text AS v FROM derived_shape WHERE layer = 'unavailable'`))).toBe(46);
  });

  it('holds the drainage graph and the vocabulary of ways a path can end', async () => {
    expect(await count('trace_link')).toBe(734);
    expect(await count('trace_reason')).toBe(4);
  });

  it('holds every area in the scope over six years, and ranks thirty of them', async () => {
    /*
      **This asserted thirty areas and 180 rows.** The tables held the board;
      they hold the scope now, because Epic 4's map has to draw all 281 and a
      map of thirty implies the other 251 are empty.

      AC 2.2.1.b has not moved: it caps what the board *shows*, and exactly
      thirty rows carry a `board_rank`. The cap is still a property of the
      data rather than a clause in a query.
    */
    expect(await count('flood_area')).toBe(1686);
    expect(await count('flood_area_coverage')).toBe(281);
    expect(
      Number(
        await one(
          'SELECT count(*)::text AS v FROM flood_area_coverage WHERE board_rank IS NOT NULL',
        ),
      ),
    ).toBe(30);
    expect(await one('SELECT area_name AS v FROM flood_area_coverage WHERE board_rank = 1')).toBe(
      'Bacchus Marsh',
    );
  });

  it('holds the population, one row per area per year', async () => {
    /*
      **This test used to assert that `population` is empty**, with a comment
      saying the dataset had not been reconciled against its own documentation.
      It has been now — 281 of 281 areas, by two joins that agree — so the
      invariant is superseded rather than wrong, and the assertion moves rather
      than disappearing. See `docs/POPULATION-DATA.md`.

      281 areas across the seven 30 Junes the reporting period touches.
    */
    expect(await count('population')).toBe(1967);
    expect(Number(await one(`SELECT count(DISTINCT area_code)::text AS v FROM population`))).toBe(281);
    expect(Number(await one(`SELECT count(DISTINCT as_at)::text AS v FROM population`))).toBe(7);
    expect(await one(`SELECT min(as_at)::text AS v FROM population`)).toBe('2009-06-30');
    expect(await one(`SELECT max(as_at)::text AS v FROM population`)).toBe('2015-06-30');
  });

  it('keeps the areas nobody lives in, because a population is still a fact', async () => {
    // Seven areas are under the 1,000 residents the Severity Score needs —
    // two airports, a racecourse, industrial land. They are not dropped: the
    // rule about what may be divided belongs to whoever divides, and a row
    // missing here would be indistinguishable from a join that failed.
    expect(
      Number(
        await one(
          `SELECT count(*)::text AS v FROM population
           WHERE as_at = '2012-06-30' AND persons < 1000`,
        ),
      ),
    ).toBe(7);
    expect(
      Number(
        await one(
          `SELECT count(*)::text AS v FROM population
           WHERE as_at = '2012-06-30' AND persons = 0`,
        ),
      ),
    ).toBe(3);
  });

  it('points every population row at a source that exists', async () => {
    // The foreign key already guarantees it; this says which one, because a
    // denominator whose publisher and licence cannot be named is a number the
    // page cannot show under AC 4.3.2.d.
    expect(
      await one(`SELECT DISTINCT dataset_id AS v FROM population`),
    ).toBe('3218.0');
    expect(
      await one(`SELECT publisher AS v FROM source WHERE dataset_id = '3218.0'`),
    ).toBe('Australian Bureau of Statistics');
  });

  it('leaves the SA1 grain empty, which is still the honest state', async () => {
    // `flood_incident` needs the pipeline to emit 13,339 regions it currently
    // discards at build time. The score is computed at SA2 from the published
    // rollups, so this stays empty and the comment in the migration stays true.
    expect(await count('flood_incident')).toBe(0);
  });

  it('joins the counts to the denominator, which it could not before', async () => {
    /*
      **This test used to assert the opposite**, and was written that way on
      purpose: the gap was real, and a gap nobody writes down is a gap nobody
      remembers. `population` was keyed by ASGS code and the flood tables by
      name, with nothing between them.

      `sa2_code` is the column that closed it. The query below is the Severity
      Score's own shape — six years of dispatches over the mid-period
      population — and the three numbers it returns were measured and written
      into `docs/SEVERITY-SCORE.md` before any of this ran.
    */
    const rate = await client.query<{ name: string; rate: string }>(`
      SELECT c.area_name AS name,
             round(sum(a.count)::numeric / p.persons * 1000, 2)::text AS rate
      FROM flood_area a
      JOIN flood_area_coverage c
        ON c.extent_scope = a.extent_scope AND c.area_name = a.area_name
      JOIN population p
        ON p.area_code = c.sa2_code AND p.as_at = '2012-06-30'
      WHERE p.persons >= 1000
      GROUP BY c.area_name, p.persons
      ORDER BY sum(a.count)::numeric / p.persons DESC, c.area_name
      LIMIT 3
    `);

    expect(rate.rows.map((r) => [r.name, Number(r.rate)])).toEqual([
      ['Riddells Creek', 17.18],
      ['Bacchus Marsh', 11.58],
      ['Gisborne', 11.35],
    ]);
  });

  it('has a denominator for every area, and residents in all but seven', async () => {
    // Seven areas are under the threshold a rate needs — two airports, a
    // racecourse, industrial land — and three of those would divide by zero.
    // Every one of the 281 still has a row: a population of fifteen is a fact,
    // and a missing row would be indistinguishable from a join that failed.
    expect(
      Number(
        await one(`
          SELECT count(*)::text AS v
          FROM flood_area_coverage c
          JOIN population p ON p.area_code = c.sa2_code AND p.as_at = '2012-06-30'
          WHERE p.persons >= 1000
        `),
      ),
    ).toBe(274);
    expect(
      Number(
        await one(`
          SELECT count(*)::text AS v FROM flood_area_coverage c
          LEFT JOIN population p ON p.area_code = c.sa2_code AND p.as_at = '2012-06-30'
          WHERE p.area_code IS NULL
        `),
      ),
    ).toBe(0);
  });
});

describe('what the loader refused to invent', () => {
  it('leaves a missing object type NULL rather than empty', async () => {
    expect(
      Number(await one(`SELECT count(*)::text AS v FROM pit WHERE object_type IS NULL`)),
    ).toBe(22);
    expect(Number(await one(`SELECT count(*)::text AS v FROM pit WHERE object_type = ''`))).toBe(0);
  });

  it('keeps the pipes that name a pit outside this extent', async () => {
    // The reason upstr_pit and dnstr_pit are not foreign keys. A constraint
    // would have rejected these sixty-nine rows, which are in the council
    // record and are the same fact the map shows as a path that stops.
    const orphans = Number(
      await one(`
        SELECT count(*)::text AS v FROM pipe p
        WHERE p.dnstr_pit IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM pit WHERE asset_number = p.dnstr_pit)
      `),
    );
    expect(orphans).toBe(69);
  });

  it('gives every layer a source that names a publisher and a licence', async () => {
    const unattributed = Number(
      await one(`
        SELECT count(*)::text AS v FROM source
        WHERE publisher IS NULL OR publisher = '' OR licence IS NULL OR licence = ''
      `),
    );
    expect(unattributed).toBe(0);
  });
});

describe('the board, rebuilt from rows', () => {
  it('reproduces the published top five, totals and all', async () => {
    const result = await client.query<{ area_name: string; total: string; complete: boolean }>(`
      SELECT a.area_name, SUM(a.count)::text AS total, c.complete
      FROM flood_area a
      JOIN flood_area_coverage c
        ON c.extent_scope = a.extent_scope AND c.area_name = a.area_name
      GROUP BY a.area_name, c.complete
      ORDER BY SUM(a.count) DESC, a.area_name
      LIMIT 5
    `);

    expect(
      result.rows.map((r) => [r.area_name, Number(r.total), r.complete]),
    ).toEqual([
      ['Bacchus Marsh', 209, true],
      ['Croydon', 196, true],
      ['Eltham', 179, true],
      ['Boronia - The Basin', 160, false],
      ['Dandenong', 133, false],
    ]);
  });

  it('finds the tie the artefact flagged rather than hiding it', async () => {
    // Ranks five and six are both 133. A board that ordered one above the
    // other without saying so would claim a difference the source does not
    // contain.
    const result = await client.query<{ area_name: string }>(`
      SELECT a.area_name
      FROM flood_area a
      GROUP BY a.area_name
      HAVING SUM(a.count) = 133
      ORDER BY a.area_name
    `);
    expect(result.rows.map((r) => r.area_name)).toEqual(['Dandenong', 'Gisborne']);
  });

  it('marks an area as incomplete exactly where a region was withheld', async () => {
    const mismatched = Number(
      await one(`
        SELECT count(*)::text AS v FROM flood_area_coverage
        WHERE complete <> (suppressed_regions = 0)
      `),
    );
    expect(mismatched).toBe(0);
  });
});

describe('loading twice', () => {
  it('leaves the same rows, not twice as many', async () => {
    // The loader truncates before it inserts, so a re-run is a replacement.
    // Without that, every deployment would double the map.
    await client.query('BEGIN');
    await load(client);
    await client.query('COMMIT');

    expect(await count('pit')).toBe(895);
    expect(await count('flood_area')).toBe(1686);
    // The board's ranks are an UPDATE over rows the same run inserted, so a
    // second load has to leave thirty of them and not sixty.
    expect(
      Number(
        await one(
          'SELECT count(*)::text AS v FROM flood_area_coverage WHERE board_rank IS NOT NULL',
        ),
      ),
    ).toBe(30);
  });
});
