/**
 * The deployment measurement, run identically before and after.
 *
 *   node tools/perf/measure.mjs http://localhost:8099 100
 *   node tools/perf/measure.mjs https://the-deployed-url 100
 *
 * W4 asks for p95 latency and the external-fetch failure rate recorded before
 * and after every deployment. The comparison is only worth anything if both
 * sides are the same script against the same critical path, which is why the
 * path is discovered rather than listed and why this file is in the repository
 * rather than in somebody's shell history.
 *
 * **Where it is run from matters and the task list says so.** A number taken
 * on a laptop measures that laptop's link. Run the "after" from the deployment
 * host, or from the same laptop as the "before" — but say which, because the
 * two are not interchangeable.
 */

import { criticalPath, percentile, timeOne } from './critical-path.mjs';

const BASE = (process.argv[2] ?? 'http://localhost:8099').replace(/\/$/, '');
const N = Number(process.argv[3] ?? 100);

const ms = (v) => v.toFixed(2).padStart(8);

const path = await criticalPath(BASE);

console.log(`\nDrainLens deployment measurement`);
console.log(`  target   ${BASE}`);
console.log(`  samples  ${N} per resource`);
console.log(`  taken    ${new Date().toISOString()}\n`);

console.log('  resource                            p50       p95       max     wire(gzip)');
console.log('  ' + '-'.repeat(78));

let failures = 0;
let attempts = 0;
let wireTotal = 0;
let decodedTotal = 0;

for (const resource of path.all) {
  const samples = [];
  let last = null;
  for (let i = 0; i < N; i += 1) {
    attempts += 1;
    try {
      const result = await timeOne(BASE, resource);
      if (result.status !== 200) failures += 1;
      samples.push(result.ms);
      last = result;
    } catch {
      failures += 1;
    }
  }
  if (samples.length === 0) {
    console.log(`  ${resource.padEnd(34)} every request failed`);
    continue;
  }
  samples.sort((a, b) => a - b);
  wireTotal += last.wireBytes;
  decodedTotal += last.decodedBytes;
  console.log(
    `  ${resource.padEnd(34)}${ms(percentile(samples, 50))}${ms(percentile(samples, 95))}` +
      `${ms(samples[samples.length - 1])}  ${last.wireBytes.toLocaleString().padStart(12)}`,
  );
}

// The whole first visit, in the order and concurrency the application uses.
const visits = [];
for (let i = 0; i < N; i += 1) {
  const started = performance.now();
  await Promise.all([...path.document, ...path.code].map((p) => timeOne(BASE, p)));
  await Promise.all(path.artefacts.map((p) => timeOne(BASE, p)));
  await Promise.all(path.scene.map((p) => timeOne(BASE, p)));
  visits.push(performance.now() - started);
}
visits.sort((a, b) => a - b);

console.log('\n  FIRST VISIT — every resource, at the concurrency the app uses');
console.log(
  `    p50 ${percentile(visits, 50).toFixed(1)} ms` +
    `   p95 ${percentile(visits, 95).toFixed(1)} ms` +
    `   max ${visits[visits.length - 1].toFixed(1)} ms`,
);

console.log('\n  TRANSFER');
console.log(
  `    ${(wireTotal / 1048576).toFixed(2)} MB over the wire, expanding to ` +
    `${(decodedTotal / 1048576).toFixed(2)} MB  (${((wireTotal / decodedTotal) * 100).toFixed(0)}%)`,
);

console.log('\n  FETCH FAILURES');
console.log(
  `    ${failures} of ${attempts} requests  (${((failures / attempts) * 100).toFixed(2)}%)`,
);
console.log(
  '\n  The scenario engine is not measured here: it is CPU-bound in a worker and\n' +
    '  deployment cannot change it. See docs/DEPLOYMENT-BASELINE.md.\n',
);
