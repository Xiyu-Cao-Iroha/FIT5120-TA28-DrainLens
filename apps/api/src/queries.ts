/**
 * Rebuild each artefact from rows, in the shape it has always had.
 *
 * **The frontend does not change and its guards are not relaxed.** Whatever
 * comes out of here is handed to the same `assertUsable`, `assertDerived`,
 * `assertTrace` and `assertFloodHistory` that guard the published files, and
 * the integration suite proves it by importing those functions rather than a
 * copy of them. If a query drops a field, the guard refuses the payload and a
 * test goes red — which is the whole reason this migration is safe to make.
 *
 * The envelope — the note saying what a layer is not, the reporting period,
 * the basis — is stored whole and served whole. The data is assembled from
 * columns. That division is the one in `db/migrations/001_init.sql`: rows for
 * what you query, jsonb for what you serve back untouched.
 */

import type pg from 'pg';

import { decimetre, pitFeature } from './artefacts.js';

export class NotFound extends Error {}

/** Greater Melbourne, which the flood board covers and no pilot extent does. */
export const FLOOD_EXTENT = 'greater-melbourne';

/**
 * The prose and provenance an artefact carries around its data.
 *
 * **Named by extent as well as by name, since migration 002.** It used to be
 * keyed on the name alone, which was unambiguous while one extent existed and
 * became a way for one extent's sentences to answer for another's rows the
 * moment a second was loaded -- a wrong answer with the right shape, which is
 * the failure mode this repository spends most of its comments on.
 */
async function envelope(
  client: pg.ClientBase,
  name: string,
  extentId: string,
): Promise<Record<string, unknown>> {
  const result = await client.query<{ envelope: Record<string, unknown> }>(
    `SELECT envelope FROM artefact_envelope WHERE name = $1 AND extent_id = $2`,
    [name, extentId],
  );
  const row = result.rows[0];
  if (!row) throw new NotFound(`no ${name} artefact has been loaded for ${extentId}`);
  return row.envelope;
}

/**
 * `map.json`: roads, pipes, pits and street labels for one extent.
 *
 * Ordered by primary key rather than left to the planner. An unordered query
 * is free to return rows in whatever order a vacuum last left them, and a map
 * whose bytes change between identical requests defeats caching and makes any
 * diff of two responses unreadable.
 */
export async function mapArtefact(
  client: pg.ClientBase,
  extent: string,
): Promise<Record<string, unknown>> {
  const base = await envelope(client, 'map', extent);

  const pits = await client.query<{
    asset_number: string;
    e_m: number;
    n_m: number;
    description: string | null;
    object_type: string | null;
  }>(
    `SELECT asset_number, e_m, n_m, description, object_type
     FROM pit WHERE extent_id = $1 ORDER BY asset_number`,
    [extent],
  );
  if (pits.rowCount === 0) throw new NotFound(`no extent called ${extent}`);

  const pipes = await client.query<{
    // Nullable since migration 003. It was `string` here while it was the
    // primary key, and the type said what the schema said.
    ref: string | null;
    upstr_pit: string | null;
    dnstr_pit: string | null;
    diameter_mm: number | null;
    material: string | null;
    path: [number, number][];
  }>(
    `SELECT ref, upstr_pit, dnstr_pit, diameter_mm, material, path
     FROM pipe WHERE extent_id = $1 ORDER BY id`,
    [extent],
  );

  const roads = await client.query<{
    str_type: string | null;
    seg_descr: string | null;
    rings: [number, number][][];
  }>(
    `SELECT str_type, seg_descr, rings FROM road WHERE extent_id = $1 ORDER BY id`,
    [extent],
  );

  const labels = await client.query<{
    name: string;
    maplabel: string | null;
    path: [number, number][];
  }>(
    `SELECT name, maplabel, path FROM street_label WHERE extent_id = $1 ORDER BY id`,
    [extent],
  );

  return {
    ...base,
    layers: {
      road: roads.rows.map((r) => ({
        g: 'polygon',
        c: r.rings,
        ...(r.str_type === null ? {} : { str_type: r.str_type }),
        ...(r.seg_descr === null ? {} : { seg_descr: r.seg_descr }),
      })),
      pipe: pipes.rows.map((r) => ({
        g: 'line',
        c: r.path,
        // Omitted rather than nulled, exactly as the file does it: the
        // frontend reads an absent key as "the council record has none".
        //
        // `ref` joined the others on 11 September, and the way it was found is
        // the argument for the deep comparison in `tools/deploy/verify-api.mjs`.
        // It stopped being the primary key in migration 003 and this line was
        // not revisited, so `Number(null)` made **reference number 0** for the
        // 85 council pipes the council identified with nothing -- a value that
        // is not missing, is not flagged, and looks exactly like an asset id.
        // Every check that compares shapes passed.
        ...(r.ref === null ? {} : { ref: Number(r.ref) }),
        ...(r.upstr_pit === null ? {} : { upstr_pit: Number(r.upstr_pit) }),
        ...(r.dnstr_pit === null ? {} : { dnstr_pit: Number(r.dnstr_pit) }),
        ...(r.diameter_mm === null ? {} : { diameter: r.diameter_mm }),
        ...(r.material === null ? {} : { material: r.material }),
      })),
      pit: pits.rows.map(pitFeature),
      'street-name': labels.rows.map((r) => ({
        g: 'line',
        c: r.path,
        name: r.name,
        ...(r.maplabel === null ? {} : { maplabel: r.maplabel }),
      })),
    },
  };
}

/** `derived.json`: the calculated layers, each still labelled as calculated. */
export async function derivedArtefact(
  client: pg.ClientBase,
  extent: string,
): Promise<Record<string, unknown>> {
  const base = await envelope(client, 'derived', extent);

  const shapes = await client.query<{
    layer: string;
    geometry: string;
    coordinates: unknown;
  }>(
    `SELECT layer, geometry, coordinates FROM derived_shape
     WHERE extent_id = $1 ORDER BY layer, id`,
    [extent],
  );
  if (shapes.rowCount === 0) throw new NotFound(`no derived layers for ${extent}`);

  const layers: Record<string, { g: string; c: unknown }[]> = {};
  for (const row of shapes.rows) {
    (layers[row.layer] ??= []).push({ g: row.geometry, c: row.coordinates });
  }

  return { ...base, layers };
}

/** `trace.json`: the downstream graph, and the ways a path can end. */
export async function traceArtefact(
  client: pg.ClientBase,
  extent: string,
): Promise<Record<string, unknown>> {
  const base = await envelope(client, 'trace', extent);

  // Left join from `pit`, so a pit with nothing leaving it comes back as an
  // empty array rather than vanishing. `traceDownstream` documents the two as
  // different questions -- an absent key is "a pit we do not carry", an empty
  // array is "the record says there is no pipe" -- and dropping the 215 empty
  // keys converts the second into the first without changing what is drawn.
  const links = await client.query<{
    from_pit: string;
    via_pipe: string | null;
    to_pit: string | null;
    ends: string | null;
  }>(
    `SELECT p.asset_number AS from_pit, l.via_pipe, l.to_pit, l.ends
     FROM pit p
     LEFT JOIN trace_link l
       ON l.extent_id = p.extent_id AND l.from_pit = p.asset_number
     WHERE p.extent_id = $1
     ORDER BY p.asset_number, l.position`,
    [extent],
  );
  if (links.rowCount === 0) throw new NotFound(`no trace for ${extent}`);

  const byPit: Record<string, { pipe: string; to?: string; ends?: string }[]> = {};
  for (const row of links.rows) {
    const outgoing = (byPit[row.from_pit] ??= []);
    if (row.via_pipe === null) continue; // the left join's empty side
    // A link names the pit it reaches, or the reason the record cannot. Never
    // both: sending `to: null` alongside a dropped reason is what made
    // thirty-seven pipes walk into a pit that does not exist.
    outgoing.push({
      pipe: row.via_pipe,
      ...(row.to_pit === null ? { ends: row.ends ?? '' } : { to: row.to_pit }),
    });
  }

  const reasons = await client.query<{ reason: string; sentence: string }>(
    `SELECT reason, sentence FROM trace_reason WHERE extent_id = $1 ORDER BY reason`,
    [extent],
  );

  return {
    ...base,
    links: byPit,
    terminations: Object.fromEntries(reasons.rows.map((r) => [r.reason, r.sentence])),
  };
}

/**
 * `flood-history.json`: the ranked board.
 *
 * The ranking is done in SQL down to the totals and then finished in
 * TypeScript, because the two judgements that matter — a withheld count is not
 * a zero, and equal totals share a rank — are already written and tested in
 * `artefacts.ts`. Expressing them a second time as window functions would be a
 * second implementation of the same rule.
 *
 * **`board_rank IS NOT NULL` is AC 2.2.1.b, and it is not a `LIMIT`.** These
 * tables hold all 281 areas in the scope since the map needed them; the board
 * is the thirty the pipeline ranked. Selecting `LIMIT 30` here would move a
 * cap that Iteration 1 recorded as enforced in the data into one SQL clause,
 * where changing it would break nothing else. Asking for the rows that carry a
 * rank keeps the count a property of what was loaded.
 *
 * The order within them is still recomputed rather than read from
 * `board_rank`, because the tie flag depends on neighbouring totals and that
 * rule lives in one place.
 */
export async function floodHistoryArtefact(
  client: pg.ClientBase,
): Promise<Record<string, unknown>> {
  const base = await envelope(client, 'flood-history', FLOOD_EXTENT);
  const years =
    ((base.reportingPeriod as { years?: readonly string[] } | undefined)?.years) ?? [];

  const rows = await client.query<{
    area_name: string;
    financial_year: string;
    count: number;
    regions: number;
    suppressed_regions: number;
    complete: boolean;
  }>(`
    SELECT a.area_name, a.financial_year, a.count,
           c.regions, c.suppressed_regions, c.complete
    FROM flood_area a
    JOIN flood_area_coverage c
      ON c.extent_scope = a.extent_scope AND c.area_name = a.area_name
    WHERE c.board_rank IS NOT NULL
    ORDER BY a.area_name, a.financial_year
  `);
  if (rows.rowCount === 0) throw new NotFound('no flood history has been loaded');

  const byArea = new Map<
    string,
    { byYear: number[]; regions: number; suppressed: number; complete: boolean }
  >();
  for (const row of rows.rows) {
    let area = byArea.get(row.area_name);
    if (!area) {
      area = {
        byYear: years.map(() => 0),
        regions: row.regions,
        suppressed: row.suppressed_regions,
        complete: row.complete,
      };
      byArea.set(row.area_name, area);
    }
    const slot = years.indexOf(row.financial_year);
    if (slot !== -1) area.byYear[slot] = row.count;
  }

  const totals = [...byArea.entries()].map(([name, a]) => ({
    name,
    total: a.byYear.reduce((sum, n) => sum + n, 0),
    byYear: a.byYear,
    regions: a.regions,
    suppressedRegions: a.suppressed,
    complete: a.complete,
  }));

  const sorted = [...totals].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const areas = sorted.map((area, index) => {
    const previous = sorted[index - 1];
    const next = sorted[index + 1];
    return {
      rank: index + 1,
      name: area.name,
      total: area.total,
      byYear: area.byYear,
      regions: area.regions,
      suppressedRegions: area.suppressedRegions,
      complete: area.complete,
      tied: previous?.total === area.total || next?.total === area.total,
    };
  });

  return { ...base, areas };
}

/**
 * The few numbers the health check needs, and nothing about anybody.
 *
 * `areas` counts the board, not the table. It did both until the tables grew
 * from thirty areas to 281, and a health check whose number silently changed
 * meaning would have been read as "the board grew" by everything watching it —
 * including `verify-api.mjs`, which compares it against the published
 * artefact's own length.
 *
 * `scopeAreas` is the new number rather than a redefinition of the old one.
 */
export async function loaded(
  client: pg.ClientBase,
): Promise<{ pits: number; areas: number; scopeAreas: number }> {
  const result = await client.query<{ pits: string; areas: string; scope: string }>(`
    SELECT (SELECT count(*) FROM pit)::text AS pits,
           (SELECT count(*) FROM flood_area_coverage WHERE board_rank IS NOT NULL)::text AS areas,
           (SELECT count(*) FROM flood_area_coverage)::text AS scope
  `);
  return {
    pits: Number(result.rows[0]?.pits ?? 0),
    areas: Number(result.rows[0]?.areas ?? 0),
    scopeAreas: Number(result.rows[0]?.scope ?? 0),
  };
}

export { decimetre };
