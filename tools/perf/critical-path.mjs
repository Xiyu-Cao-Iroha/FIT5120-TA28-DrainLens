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

export async function timeOne(base, path) {
  const started = performance.now();
  const response = await fetch(base + path, { headers: { 'accept-encoding': 'gzip' } });
  const body = await response.arrayBuffer();
  return {
    ms: performance.now() - started,
    status: response.status,
    // Node's fetch decompresses transparently, so the decoded length is not
    // what crossed the wire. The header is.
    wireBytes: Number(response.headers.get('content-length') ?? body.byteLength),
    decodedBytes: body.byteLength,
  };
}
