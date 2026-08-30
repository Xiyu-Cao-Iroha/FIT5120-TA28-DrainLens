const BASE = process.argv[2] ?? 'http://localhost:8099';
const N = Number(process.argv[3] ?? 100);

// Exactly what a first visit fetches, in the order the app asks for it.
const CRITICAL = [
  '/', '/assets/index-DHRtfLHh.js', '/assets/worker-DOAtLco3.js',
  '/data/map.json', '/data/derived.json', '/data/trace.json', '/data/addresses.json',
  '/data/scene/scene.json',
  '/data/scene/elevation.bin', '/data/scene/flow.bin',
  '/data/scene/depressions.bin', '/data/scene/coverage.bin',
];

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function timeOne(path) {
  const started = performance.now();
  const res = await fetch(BASE + path, { headers: { 'accept-encoding': 'gzip' } });
  const body = await res.arrayBuffer();
  return { ms: performance.now() - started, bytes: body.byteLength, status: res.status };
}

console.log(`sampling ${N}x per resource against ${BASE}\n`);
console.log('  resource                          p50      p95      max     bytes(wire)');
console.log('  ' + '-'.repeat(74));

const totals = [];
for (const path of CRITICAL) {
  const samples = [];
  let bytes = 0, status = 0;
  for (let i = 0; i < N; i++) {
    const r = await timeOne(path);
    samples.push(r.ms); bytes = r.bytes; status = r.status;
  }
  samples.sort((a, b) => a - b);
  totals.push({ path, p95: pct(samples, 95) });
  if (status !== 200) { console.log(`  ${path}  STATUS ${status}`); continue; }
  console.log(
    `  ${path.padEnd(32)} ${pct(samples,50).toFixed(2).padStart(7)}  ${pct(samples,95).toFixed(2).padStart(7)}  ${samples[samples.length-1].toFixed(2).padStart(7)}  ${bytes.toLocaleString().padStart(11)}`
  );
}

// The whole critical path, as the app actually loads it: four artefacts in
// parallel, then the scene's four arrays in parallel.
const runs = [];
for (let i = 0; i < N; i++) {
  const t = performance.now();
  await Promise.all(['/', '/assets/index-DHRtfLHh.js'].map(timeOne));
  await Promise.all(['/data/map.json','/data/derived.json','/data/trace.json','/data/addresses.json'].map(timeOne));
  await Promise.all(['/data/scene/scene.json','/data/scene/elevation.bin','/data/scene/flow.bin','/data/scene/depressions.bin','/data/scene/coverage.bin'].map(timeOne));
  runs.push(performance.now() - t);
}
runs.sort((a, b) => a - b);
console.log('\n  FULL CRITICAL PATH (everything a first visit needs)');
console.log(`    p50 ${pct(runs,50).toFixed(1)} ms   p95 ${pct(runs,95).toFixed(1)} ms   max ${runs[runs.length-1].toFixed(1)} ms`);
console.log(`\n  worst single resource at p95: ${totals.sort((a,b)=>b.p95-a.p95)[0].path} (${totals[0].p95.toFixed(1)} ms)`);
