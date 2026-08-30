const BASE = 'http://localhost:8099';
const FILES = ['/','/assets/index-DHRtfLHh.js','/assets/worker-DOAtLco3.js','/data/map.json',
  '/data/derived.json','/data/trace.json','/data/addresses.json','/data/scene/scene.json',
  '/data/scene/elevation.bin','/data/scene/flow.bin','/data/scene/depressions.bin','/data/scene/coverage.bin'];
let wire = 0, raw = 0;
console.log('  resource                        wire(gzip)      raw   ratio');
for (const p of FILES) {
  const res = await fetch(BASE + p, { headers: { 'accept-encoding': 'gzip' } });
  const w = Number(res.headers.get('content-length'));
  const r = (await res.arrayBuffer()).byteLength;
  wire += w; raw += r;
  console.log(`  ${p.padEnd(30)} ${w.toLocaleString().padStart(10)} ${r.toLocaleString().padStart(9)}  ${(w/r*100).toFixed(0).padStart(4)}%`);
}
console.log(`  ${'TOTAL'.padEnd(30)} ${wire.toLocaleString().padStart(10)} ${raw.toLocaleString().padStart(9)}  ${(wire/raw*100).toFixed(0).padStart(4)}%`);
console.log(`\n  first visit transfers ${(wire/1048576).toFixed(2)} MB, expands to ${(raw/1048576).toFixed(2)} MB`);
