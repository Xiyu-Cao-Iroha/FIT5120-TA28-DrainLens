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
];




export async function criticalPath(base) {
  const html = await (await fetch(base + '/')).text();

  // Vite emits <script type="module" src="/assets/index-HASH.js">.
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
  const modulePreloads = [...html.matchAll(/href="([^"]+\.js)"/g)].map((m) => m[1]);
  const entry = [...new Set([...scripts, ...modulePreloads])];

  // The worker is never referenced from the HTML — `new Worker(new URL(...))`
  // puts its hashed name inside the bundle. A first visit fetches it as soon
  // as the scenario hook mounts, so leaving it out understates the visit; it
  // is recovered by reading the bundle rather than by guessing the hash.
  const workers = new Set();
  for (const asset of entry) {
    const code = await (await fetch(base + asset)).text();
    for (const match of code.matchAll(/["'`](\/?assets\/worker-[A-Za-z0-9_-]+\.js)["'`]/g)) {
      workers.add(match[1].startsWith('/') ? match[1] : `/${match[1]}`);
    }
  }

  const assets = [...entry, ...workers];

  const scene = await (await fetch(base + '/data/scene/scene.json')).json();
  // Only the four arrays `loadScene` actually reads. `rim-depth` and
  // `measured` are declared in the header and never fetched, so counting them
  // would overstate what a visit costs.
  const LOADED = ['elevation', 'flow', 'depressions', 'coverage'];
  const arrays = LOADED.map((name) => `/data/scene/${scene.arrays[name].file}`);

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
      { headers: { 'accept-encoding': 'gzip' } },
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

