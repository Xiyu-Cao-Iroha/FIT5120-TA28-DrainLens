/**
 * Bring a database to the state of this checkout: schema first, then rows.
 *
 * **One command, because there is only one state worth having.** Everything in
 * this database is derived from `apps/web/public/data/*.json` — there is no
 * content lifecycle separate from the checkout, no editor, and nothing a
 * migration could preserve that the artefacts do not already say. A schema
 * without the rows is not a half-finished deployment, it is a service that
 * answers 404 to everything, so applying migrations and loading are the same
 * operation here. `--schema-only` exists for the one case where they are not:
 * adding a column to an instance whose rows you do not want replaced.
 *
 * **A migration is responsible for its own transaction and for registering
 * itself.** `001_init.sql` opens with `BEGIN` and closes by inserting its own
 * version, which makes "applied" and "recorded" the same commit — a runner
 * that wrapped the file in a second transaction would have the file's `COMMIT`
 * end the runner's, and the version would then be written outside any
 * transaction at all. So this does not wrap. It checks afterwards that the
 * file registered itself and refuses to continue if it did not, because the
 * alternative is a database that silently re-runs the same migration forever.
 *
 * It is safe to run twice. The migrations are skipped once recorded, and the
 * load is a truncate-and-insert.
 *
 *   DATABASE_URL=... node apps/api/dist/migrate.js
 *   DATABASE_URL=... node apps/api/dist/migrate.js --schema-only
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import pg from 'pg';

import { load } from './load.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * `apps/api/src` and `apps/api/dist` are the same depth below the root, and
 * the container preserves that layout for exactly this reason.
 */
const MIGRATIONS = path.resolve(HERE, '../../../db/migrations');

export class MigrateError extends Error {}

/** The number a migration file leads with, or a refusal naming the file. */
export function versionOf(file: string): number {
  const match = /^(\d+)_/.exec(file);
  if (!match?.[1]) {
    throw new MigrateError(
      `${file} does not start with a version number, so its order is not defined`,
    );
  }
  return Number(match[1]);
}

/**
 * Which files to apply, in which order.
 *
 * Sorted by the number rather than by the name, so `010_` follows `009_`
 * instead of preceding `002_` the way a string sort would put it. Two files
 * claiming the same version is a refusal and not a coin toss: whichever ran
 * first would record the version and the other would never run again.
 */
export function plan(
  files: readonly string[],
  applied: ReadonlySet<number>,
): { file: string; version: number }[] {
  const sql = files.filter((f) => f.endsWith('.sql'));
  const seen = new Map<number, string>();

  const all = sql.map((file) => {
    const version = versionOf(file);
    const clash = seen.get(version);
    if (clash) {
      throw new MigrateError(`${clash} and ${file} both claim version ${String(version)}`);
    }
    seen.set(version, file);
    return { file, version };
  });

  return all.filter((m) => !applied.has(m.version)).sort((a, b) => a.version - b.version);
}

/**
 * The versions already in. An absent ledger means a database nobody has
 * migrated yet, which is not an error -- but any other failure is, and is
 * rethrown rather than read as "start from scratch" against an instance that
 * is merely unreachable.
 */
export async function appliedVersions(client: pg.ClientBase): Promise<Set<number>> {
  try {
    const result = await client.query<{ version: number }>(
      'SELECT version FROM schema_migration',
    );
    return new Set(result.rows.map((r) => r.version));
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') return new Set();
    throw error;
  }
}

/** Apply what is pending, and return the versions that ran. */
export async function migrate(client: pg.ClientBase): Promise<number[]> {
  const pending = plan(await readdir(MIGRATIONS), await appliedVersions(client));
  const ran: number[] = [];

  for (const { file, version } of pending) {
    await client.query(await readFile(path.join(MIGRATIONS, file), 'utf8'));

    // The convention, checked rather than assumed. A migration that ran
    // without recording itself would be re-applied on every deployment.
    const now = await appliedVersions(client);
    if (!now.has(version)) {
      throw new MigrateError(
        `${file} ran but did not insert version ${String(version)} into schema_migration`,
      );
    }
    ran.push(version);
  }

  return ran;
}

/** Migrate, then load, against `DATABASE_URL`. */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new MigrateError('DATABASE_URL is not set');

  const schemaOnly = argv.includes('--schema-only');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const ran = await migrate(client);
    process.stdout.write(
      ran.length === 0
        ? '  schema                 already current\n'
        : `  schema                 applied ${ran.map(String).join(', ')}\n`,
    );

    if (schemaOnly) {
      process.stdout.write('  rows                   left alone (--schema-only)\n');
      return;
    }

    await client.query('BEGIN');
    const counted = await load(client);
    await client.query('COMMIT');
    for (const [table, n] of Object.entries(counted)) {
      process.stdout.write(`  ${table.padEnd(22)} ${String(n).padStart(6)}\n`);
    }
  } finally {
    await client.end();
  }
}

/**
 * Start only when this file *is* the program -- compared as a path, for the
 * reason written out in `server.ts`: an `endsWith('.ts')` test is true of the
 * source and false of the `dist/*.js` that actually ships, and the failure is
 * a process that exits zero having done nothing.
 */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
