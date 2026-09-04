/**
 * What a first visit fetches, discovered rather than hard-coded.
 *
 * Vite hashes the asset filenames on every build, so a list written by hand
 * stops matching the next build and the "after" measurement silently probes
 * URLs that 404 — which looks fast. The list is read from the served
 * `index.html` and `scene.json` instead, so the same script works against a
 * local build and against a deployment, which is the only thing that makes the
 * two numbers comparable.
 */

import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';

/** Artefacts the application fetches by fixed path. */
const FIXED = [
  '/data/map.json',
  '/data/derived.json',
  '/data/trace.json',
  '/data/addresses.json',
  '/data/flood-history.json',
];

/**
 * The deployment sits behind an access gate, and an unauthenticated
 * measurement is the worst kind of wrong: fast, plausible, and of nothing.
 *
 * Every request would be answered 401 in a few hundred bytes. The p95 would
 * come out better than the real one, the transfer figure would collapse, and
 * nothing in the output would say the tool had never reached the site. So the
 * credentials are read from the environment at run time — never a flag, which
 * would put a password in a shell history, and never a file, which would put
 * one in the repository.
 *
 *   DRAINLENS_BASIC_AUTH='user:password' node tools/perf/measure.mjs <url> 100
 *
 * Absent, the tool measures without credentials, which is right for a local
 * build and is caught below for a gated one.
 */
function authHeaders() {
  const pair = process.env.DRAINLENS_BASIC_AUTH;
  if (!pair) return {};
  return { authorization: `Basic ${Buffer.from(pair).toString('base64')}` };
}

/** `fetch`, with the gate's credentials if there are any, refusing a 401. */
async function get(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) {
    throw new Error(
      [
        `401 from ${url}`,
        '  The target is behind the access gate and this run has no credentials.',
        "  Set DRAINLENS_BASIC_AUTH='user:password' and run it again. Measuring",
        '  401 responses would report a first visit that never happened.',
      ].join('\n'),
    );
  }
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res;
}

export async function criticalPath(base) {
  const html = await (await get(base + '/')).text();

  // Vite emits <script type="module" src="/assets/index-HASH.js">.
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
  const modulePreloads = [...html.matchAll(/href="([^"]+\.js)"/g)].map((m) => m[1]);
  const entry = [...new Set([...scripts, ...modulePreloads])];

  // The worker is kept in the path although the scenario hook that starts it
  // is no longer enabled on any reachable screen. It is 4 KB against a
  // megabyte, and a critical path that is a ceiling rather than a floor is the
  // safe direction for this number to be wrong in.
  //
  // The worker is never referenced from the HTML — `new Worker(new URL(...))`
  // puts its hashed name inside the bundle. A first visit fetches it as soon
  // as the scenario hook mounts, so leaving it out understates the visit; it
  // is recovered by reading the bundle rather than by guessing the hash.
  const workers = new Set();
  for (const asset of entry) {
    const code = await (await get(base + asset)).text();
    for (const match of code.matchAll(/["'`](\/?assets\/worker-[A-Za-z0-9_-]+\.js)["'`]/g)) {
      workers.add(match[1].startsWith('/') ? match[1] : `/${match[1]}`);
    }
  }

  const assets = [...entry, ...workers];

  const scene = await (await get(base + '/data/scene/scene.json')).json();

  /**
   * The arrays a reachable screen actually fetches, which is now one.
   *
   * This used to be `elevation`, `flow`, `depressions` and `coverage` — the
   * four `loadScene` reads. `loadScene` runs in the scenario worker, and
   * `useScenario` is enabled only on the scenario and result screens, neither
   * of which is on any route in the Iteration 1 interface. What is left is
   * `terrain.ts`, which reads the header and `elevation` for the ground
   * surface.
   *
   * So five arrays totalling about 4.5 MB are published and fetched by
   * nothing. Measuring them would report a first visit nobody makes, which is
   * the same error as measuring 401s and harder to notice.
   *
   * **It goes back to four the moment the comparison is reachable again**, so
   * this list is checked against `useScenario`'s `enabled` argument rather
   * than trusted. Verified against the source on 5 September.
   */
  const REACHABLE = ['elevation'];
  const arrays = REACHABLE.map((name) => `/data/scene/${scene.arrays[name].file}`);

  return {
    document: ['/'],
    code: assets,
    artefacts: [...FIXED, '/data/scene/scene.json'],
    scene: arrays,
    all: ['/', ...assets, ...FIXED, '/data/scene/scene.json', ...arrays],
  };
}

export const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];

/**
 * One request, timed, with the bytes that actually crossed the wire.
 *
 * Counted off the socket rather than read from `content-length`. The first
 * version trusted that header, which is correct only when the server knows
 * the compressed length in advance: a server that pre-compresses sends it,
 * and nginx compressing on the fly sends chunked with no length at all. Run
 * against nginx, the header was absent, the fallback used the decoded size,
 * and the tool reported **6.42 MB at a 100% ratio for a response that was
 * gzipped the whole time**.
 *
 * That is worse than a wrong number. This script exists so a "before" and an
 * "after" are the same measurement, and a figure that depends on which server
 * answered is not one.
 */
export function timeOne(base, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(base + path);
    const transport = url.protocol === 'https:' ? https : http;
    const started = performance.now();

    const req = transport.request(
      url,
      { headers: { 'accept-encoding': 'gzip', ...authHeaders() } },
      (res) => {
        let wireBytes = 0;
        let decodedBytes = 0;
        res.on('data', (chunk) => {
          wireBytes += chunk.length;
        });

        const done = () =>
          resolve({
            ms: performance.now() - started,
            status: res.statusCode,
            wireBytes,
            decodedBytes: decodedBytes || wireBytes,
          });

        if (String(res.headers['content-encoding'] ?? '').includes('gzip')) {
          const gunzip = zlib.createGunzip();
          gunzip.on('data', (chunk) => {
            decodedBytes += chunk.length;
          });
          gunzip.on('end', done);
          gunzip.on('error', reject);
          res.pipe(gunzip);
        } else {
          res.on('end', done);
        }
      },
    );

    req.on('error', reject);
    req.setTimeout(30_000, () => req.destroy(new Error(`timed out: ${path}`)));
    req.end();
  });
}

