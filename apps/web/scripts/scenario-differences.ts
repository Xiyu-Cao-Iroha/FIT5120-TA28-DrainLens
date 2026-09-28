/**
 * Build `public/data/scenario-differences.json`: which drains the blocked-drain
 * comparison shows a difference for, at which setting and rainfall amount.
 *
 * It runs the engine the worker runs (`@drainlens/scenario`), on windows
 * assembled the way the worker assembles them (`src/scenario/sceneTiles.ts`,
 * `worker.engineInput`), for every drain the scene tile index gives a window.
 * The clear baseline does not depend on which drain is blocked, so it is
 * solved once per window. See `src/scenario/differences.ts` for why the file
 * exists.
 *
 * About four hours on one core, so it is sharded. From the repository root:
 *
 *   for i in $(seq 0 19); do SHARD=$i SHARDS=20 npx vite-node apps/web/scripts/scenario-differences.ts & done; wait
 *   MERGE=1 SHARDS=20 npx vite-node apps/web/scripts/scenario-differences.ts
 *
 * Shards write `scenario-differences.shard-N.jsonl` beside this file; the merge
 * writes the artefact and deletes them. Rerun whenever the scene tiles, the
 * engine or its assumptions change.
 */

import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { DEFAULT_ASSUMPTIONS, solvePosition } from '@drainlens/scenario';

import { loadIndex, loadWindow } from '../src/scenario/sceneTiles.js';
import { POSITIONS_MM } from '../src/scenario/useScenario.js';
import { engineInput } from '../src/scenario/worker.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TILES = path.resolve(HERE, '../public/data/scene-tiles');
const OUT = path.resolve(HERE, '../public/data/scenario-differences.json');
const SHARD = Number(process.env.SHARD ?? 0);
const SHARDS = Number(process.env.SHARDS ?? 1);
const shardFile = (n: number) => path.join(HERE, `scenario-differences.shard-${String(n)}.jsonl`);
const SETTINGS = ['partly-blocked', 'fully-blocked'] as const;

const fetcher = {
  json: async (url: string): Promise<unknown> => JSON.parse(readFileSync(url, 'utf8')) as unknown,
  gunzip: async (url: string): Promise<ArrayBuffer> => {
    const buf = gunzipSync(readFileSync(url));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  },
};

interface Row {
  readonly asset: string;
  readonly counts?: Partial<Record<(typeof SETTINGS)[number], number[]>>;
}

if (process.env.MERGE === '1') {
  const drains: Record<string, Partial<Record<(typeof SETTINGS)[number], number[]>>> = {};
  let rows = 0;
  for (let n = 0; n < SHARDS; n += 1) {
    const file = shardFile(n);
    if (!existsSync(file)) throw new Error(`shard ${String(n)} has not run`);
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      const row = JSON.parse(line) as Row;
      rows += 1;
      if (row.counts === undefined) continue;
      const kept = Object.fromEntries(
        Object.entries(row.counts).filter(([, counts]) => counts.some((c) => c > 0)),
      );
      if (Object.keys(kept).length > 0) drains[row.asset] = kept;
    }
  }
  const sorted = Object.fromEntries(Object.entries(drains).sort(([a], [b]) => Number(a) - Number(b)));
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        artefact: 'scenario-differences',
        version: 1,
        note: `Drains for which the blocked-drain comparison finds more water than with a clear drain, per setting and rainfall amount: the number of cells above the ${String(DEFAULT_ASSUMPTIONS.noticeableVolumeM3)} m3 threshold. Worked out in advance with the same engine and scene tiles the site uses, over ${String(rows)} drains; only drains with a difference are listed. A statement about the model, not about real flooding.`,
        rainfallMm: [...POSITIONS_MM],
        drains: sorted,
      },
      null,
      1,
    )}\n`,
  );
  for (let n = 0; n < SHARDS; n += 1) rmSync(shardFile(n));
  console.log(`${String(Object.keys(sorted).length)} of ${String(rows)} drains show a difference`);
} else {
  const index = await loadIndex(TILES, fetcher);
  const byWindow = new Map<string, string[]>();
  for (const [asset, [tx, ty]] of Object.entries(index.windows)) {
    const key = `${String(tx)},${String(ty)}`;
    byWindow.set(key, [...(byWindow.get(key) ?? []), asset]);
  }
  const keys = [...byWindow.keys()].sort();
  rmSync(shardFile(SHARD), { force: true });
  for (let k = 0; k < keys.length; k += 1) {
    if (k % SHARDS !== SHARD) continue;
    const key = keys[k]!;
    const [tx, ty] = key.split(',').map(Number) as [number, number];
    const loaded = await loadWindow(TILES, index, [tx, ty], fetcher);
    const input = engineInput(loaded);
    const baseline = POSITIONS_MM.map((mm) => solvePosition(input, 'clear', null, mm).pondedM3);
    for (const asset of byWindow.get(key) ?? []) {
      const drain = loaded.header.drains.find((d) => d.assetNumber === asset && d.isInlet);
      // The engine refuses a cell whose first drain is not an inlet; so does this.
      const first = drain === undefined ? undefined : input.drains.find((d) => d.cell === drain.cell);
      if (drain === undefined || first?.isInlet === false) {
        appendFileSync(shardFile(SHARD), `${JSON.stringify({ asset })}\n`);
        continue;
      }
      const counts: Row['counts'] = {};
      for (const setting of SETTINGS) {
        counts[setting] = POSITIONS_MM.map((mm, i) => {
          const blocked = solvePosition(input, setting, drain.cell, mm).pondedM3;
          const clear = baseline[i]!;
          let cells = 0;
          for (let c = 0; c < blocked.length; c += 1) {
            if (blocked[c]! - clear[c]! > DEFAULT_ASSUMPTIONS.noticeableVolumeM3) cells += 1;
          }
          return cells;
        });
      }
      appendFileSync(shardFile(SHARD), `${JSON.stringify({ asset, counts })}\n`);
    }
    console.log(`shard ${String(SHARD)}: window ${key}`);
  }
}
