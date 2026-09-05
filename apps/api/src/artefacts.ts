/**
 * Rows in, artefacts out — and nothing here touches a database.
 *
 * This is the whole reason the API can be trusted to replace a static file:
 * the frontend's `assertUsable`, `assertDerived`, `assertTrace` and
 * `assertFloodHistory` are unchanged, so whatever comes out of here has to
 * satisfy the same guards the published files satisfy. Those guards refuse an
 * artefact that cannot qualify itself — one that names no source, or no
 * reporting period, or no sentence saying what a count is — and they do not
 * care whether the bytes came from `nginx` or from Postgres.
 *
 * Keeping the shaping pure and in one file has a second purpose. Everything
 * that carries a judgement is testable without a server: that a withheld count
 * is not a zero, that an area whose count is withheld is marked incomplete,
 * that ties are found rather than assumed. The SQL is integration-tested
 * against a real Postgres behind a separate script; this is unit-tested in the
 * suite everybody runs.
 */

/** A count the publisher withheld for privacy. Not zero, and never summed as one. */
export const WITHHELD = null;

export interface IncidentRow {
  readonly sa2_name: string;
  readonly financial_year: string;
  /** `null` where the publisher withheld it. */
  readonly count: number | null;
  readonly sa1_code_2011: string;
}

export interface AreaTotal {
  readonly name: string;
  readonly total: number;
  readonly byYear: readonly number[];
  readonly regions: number;
  readonly suppressedRegions: number;
  /** False where any count inside this area was withheld, making the total a floor. */
  readonly complete: boolean;
}

/**
 * Sum an area's incidents without ever treating a withheld count as a zero.
 *
 * **The distinction is the whole point of the nullable column.** 144 of the
 * 13,339 regions are withheld, and an area containing one has a total that is
 * a floor rather than a figure: the board shows those with a `+`. Summing
 * `COALESCE(count, 0)` in SQL would produce a number that looks exact, ranks
 * confidently, and is wrong by an unknown amount — which is worse than a
 * number that admits what it is missing.
 *
 * `years` is passed rather than discovered, so an area with no incidents in
 * 2012-13 gets a zero in that position instead of a shorter array that would
 * silently misalign every sparkline drawn from it.
 */
export function totalsByArea(
  rows: readonly IncidentRow[],
  years: readonly string[],
): AreaTotal[] {
  const byName = new Map<
    string,
    { total: number; byYear: number[]; regions: Set<string>; withheld: Set<string> }
  >();

  for (const row of rows) {
    let area = byName.get(row.sa2_name);
    if (!area) {
      area = {
        total: 0,
        byYear: years.map(() => 0),
        regions: new Set(),
        withheld: new Set(),
      };
      byName.set(row.sa2_name, area);
    }

    area.regions.add(row.sa1_code_2011);

    if (row.count === WITHHELD) {
      area.withheld.add(row.sa1_code_2011);
      continue;
    }

    const slot = years.indexOf(row.financial_year);
    // A year the artefact does not publish is dropped rather than appended.
    // Appending would push every later year one place along and quietly
    // rewrite six sparklines.
    if (slot === -1) continue;

    area.total += row.count;
    area.byYear[slot] = (area.byYear[slot] ?? 0) + row.count;
  }

  return [...byName.entries()].map(([name, a]) => ({
    name,
    total: a.total,
    byYear: a.byYear,
    regions: a.regions.size,
    suppressedRegions: a.withheld.size,
    complete: a.withheld.size === 0,
  }));
}

export interface RankedArea extends AreaTotal {
  readonly rank: number;
  /** True where an adjacent published area recorded the same total. */
  readonly tied: boolean;
}

/**
 * Rank by total, and say where the ranking is sharper than the counts under it.
 *
 * Ties are marked rather than broken silently. Ranks five and six were both
 * 133 the first time this data was ranked, and a board that presented one
 * above the other without saying so would be claiming a difference the source
 * does not contain.
 *
 * Equal totals share a rank — standard competition ranking — so two areas at
 * 133 are both rank 5 and the next is rank 7. The alternative, numbering them
 * 5 and 6 by whatever order the rows arrived in, makes the database's row
 * order into a finding.
 */
export function rank(areas: readonly AreaTotal[]): RankedArea[] {
  const sorted = [...areas].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return sorted.map((area, index) => {
    const previous = sorted[index - 1];
    const next = sorted[index + 1];
    const tied = previous?.total === area.total || next?.total === area.total;

    // Competition ranking: the first of a tied group carries the rank, and
    // everyone level with it shares it.
    let position = index + 1;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (sorted[i]?.total !== area.total) break;
      position = i + 1;
    }

    return { ...area, rank: position, tied };
  });
}

export interface MapRow {
  readonly asset_number?: string | number;
  readonly e_m?: number;
  readonly n_m?: number;
  readonly description?: string | null;
  readonly object_type?: string | null;
}

/**
 * Round a coordinate back to the decimetre the artefacts publish.
 *
 * Postgres returns `double precision` and JavaScript prints every bit of it,
 * so a value stored as `454.8` comes back and serialises as `454.8` — but a
 * value that went through any arithmetic returns `454.80000000000007`. The
 * artefacts are quoted to a decimetre because the survey does not support
 * more, and a payload that suddenly carries twelve decimals is claiming a
 * precision the source never had.
 */
export const decimetre = (v: number): number => Math.round(v * 10) / 10;

export interface PitFeature {
  readonly g: 'point';
  readonly c: readonly [number, number];
  readonly asset_number?: number;
  readonly asset_description?: string;
  readonly object_type_lupvalue?: string;
}

/**
 * One pit, in the shape `map.json` publishes.
 *
 * Absent fields are **omitted rather than sent as null**. The frontend draws a
 * distinction between "the council record has no value here" and "this key was
 * not in the payload", and `PitDetail` renders the first as *Not recorded*.
 * A `null` would arrive as a value and print as one.
 */
export function pitFeature(row: {
  readonly asset_number: string | number;
  readonly e_m: number;
  readonly n_m: number;
  readonly description: string | null;
  readonly object_type: string | null;
}): PitFeature {
  return {
    g: 'point',
    c: [decimetre(row.e_m), decimetre(row.n_m)],
    asset_number: Number(row.asset_number),
    ...(row.description === null ? {} : { asset_description: row.description }),
    ...(row.object_type === null ? {} : { object_type_lupvalue: row.object_type }),
  };
}
