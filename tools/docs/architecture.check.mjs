/**
 * Does any text in the figure run outside its own box?
 *
 *   node tools/docs/architecture.check.mjs docs/architecture.svg out.html
 *
 * Node cannot answer that: the width of a line depends on the font, and the
 * font lives in the browser. So this writes a self-contained page that
 * measures every text run with getComputedTextLength and names the ones that
 * overflow. Serve the page and read it. Putting it under apps/web/public is
 * the quickest way, because the web dev server is already there.
 *
 * The generator computes box heights from content, so a long line cannot push
 * text out of the bottom. Width it cannot know, which is what this covers.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const [, , svgPath, outPath] = process.argv;
const svg = readFileSync(svgPath, 'utf8');

const page = `<!doctype html>
<meta charset="utf-8">
<title>architecture figure check</title>
<body style="margin:0;background:#fff;font:13px ui-monospace,monospace">
<pre id="report" style="padding:16px;white-space:pre-wrap"></pre>
${svg}
<script>
const svg = document.querySelector('svg');

// The page frame is the widest rect; it has no text of its own to hold.
const boxes = [...svg.querySelectorAll('rect')]
  .map((r) => ({
    x: +r.getAttribute('x'),
    y: +r.getAttribute('y'),
    w: +r.getAttribute('width'),
    h: +r.getAttribute('height'),
  }))
  .filter((r) => r.w < 1100);

const over = [];
for (const t of svg.querySelectorAll('text')) {
  const x = +t.getAttribute('x');
  const y = +t.getAttribute('y');
  const len = t.getComputedTextLength();
  const anchor = t.getAttribute('text-anchor');
  const left = anchor === 'middle' ? x - len / 2 : anchor === 'end' ? x - len : x;
  const right = left + len;

  // The smallest box the run starts inside is the one that has to hold it.
  let host = null;
  for (const b of boxes) {
    const inside = left >= b.x && left <= b.x + b.w && y - 6 >= b.y && y <= b.y + b.h;
    if (inside && (!host || b.w * b.h < host.w * host.h)) host = b;
  }
  if (!host) continue; // a zone label or a footer bullet, bounded by the page

  const limit = host.x + host.w - 10;
  const floor = host.y + host.h - 2;
  if (right > limit) over.push(Math.round(right - limit) + 'px past the right edge: ' + t.textContent);
  if (y > floor) over.push(Math.round(y - floor) + 'px below the bottom edge: ' + t.textContent);
}

const runs = svg.querySelectorAll('text').length;
document.getElementById('report').textContent = over.length
  ? over.length + ' of ' + runs + ' runs overflow:\\n\\n' + over.join('\\n')
  : 'every one of ' + runs + ' text runs fits its box, across ' + boxes.length + ' boxes';
</script>
`;

writeFileSync(outPath, page, 'utf8');
console.log(`wrote ${outPath} · serve it and read the report at the top`);
