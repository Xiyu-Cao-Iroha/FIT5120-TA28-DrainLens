/**
 * The system architecture figure.
 *
 *   node tools/docs/architecture.mjs docs/architecture.svg
 *
 * **Generated rather than drawn, because the architecture keeps changing.**
 * The Iteration 1 version of this file said so after the system gained a
 * database, an API and a migration job in three days. Iteration 3 proved the
 * point again: between 9 and 10 October it gained an address route over
 * Postgres and a private inference service, and the hand-drawn figure written
 * on 10 October was out of date by the afternoon. Re-run this after a change
 * and diff the SVG.
 *
 * Box heights are computed from their content and rows are placed from those
 * heights, so a wording change cannot silently push text through a border.
 *
 * Monochrome on purpose: the figure goes into a report and onto a projector,
 * and every distinction in it survives a black-and-white printer.
 *
 * **No em dash or en dash anywhere in it.** The team's rule of 10 October
 * covers deliverable documents, and this is one. The Iteration 1 figure used
 * them as separators and as the bullet mark; the middle dot does both jobs
 * here and the house style already used it.
 *
 * The numbers are measured, not remembered. Counted for this revision:
 * 32 pipeline modules, 713 pipeline tests, 101 Node test files holding 1,725
 * tests, 18 tables, 12 JSON artefacts, 424 terrain tiles. Two numbers in the
 * hand-drawn draft were wrong, which is the argument for generating it.
 */

import { writeFileSync } from 'node:fs';

const INK = '#1A1A1A';
const MUTED = '#6B6B6B';
const HAIR = '#DDDDDD';
const RULE = '#999999';
const SURFACE = '#F4F4F4';
const PAPER = '#FFFFFF';

const FONT = "'Segoe UI', Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif";

const W = 1160;
const M = 32;

const STEP = 15;
const GAP = 8;
const FIRST_WITH_TAG = 74;
const FIRST_NO_TAG = 58;
const BOTTOM = 18;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const out = [];
const push = (s) => out.push(s);

const text = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size ?? 11}" ` +
  `font-weight="${o.weight ?? 400}" fill="${o.fill ?? INK}" ` +
  `${o.anchor ? `text-anchor="${o.anchor}" ` : ''}` +
  `${o.spacing ? `letter-spacing="${o.spacing}" ` : ''}>${esc(s)}</text>`;

/** How tall a node has to be for its own content. */
function heightOf({ tag, lines = [] }) {
  if (lines.length === 0) return (tag ? FIRST_WITH_TAG : FIRST_NO_TAG) + BOTTOM - STEP;
  let y = tag ? FIRST_WITH_TAG : FIRST_NO_TAG;
  let last = y;
  lines.forEach((line, i) => {
    if (i > 0) y += lines[i - 1] === '' ? GAP : STEP;
    if (line !== '') last = y;
  });
  return last + BOTTOM;
}

function zone(y, label) {
  push(text(M, y, label.toUpperCase(), { size: 10, weight: 600, fill: MUTED, spacing: '0.09em' }));
  push(`<line x1="${M}" y1="${y + 9}" x2="${W - M}" y2="${y + 9}" stroke="${HAIR}" stroke-width="1"/>`);
}

function box(node) {
  const { x, y, w, h, title, tag, lines = [], fill = PAPER } = node;
  push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${INK}" stroke-width="1"/>`);
  push(text(x + 16, y + 26, title, { size: 13, weight: 600 }));
  const top = tag ? y + 42 : y + 26;
  if (tag) push(text(x + 16, y + 42, tag, { size: 10, fill: MUTED }));
  push(`<line x1="${x + 16}" y1="${top + 12}" x2="${x + w - 16}" y2="${top + 12}" stroke="${HAIR}" stroke-width="1"/>`);

  let ly = y + (tag ? FIRST_WITH_TAG : FIRST_NO_TAG);
  lines.forEach((line, i) => {
    if (i > 0) ly += lines[i - 1] === '' ? GAP : STEP;
    if (line !== '') push(text(x + 16, ly, line, { size: 10.5 }));
  });
}

function arrow(x1, y1, x2, y2, { label, anchor = 'middle', lx, ly } = {}) {
  push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1.25" marker-end="url(#head)"/>`);
  if (!label) return;
  push(text(lx ?? (x1 + x2) / 2, ly ?? (y1 + y2) / 2 - 8, label, { size: 10, fill: MUTED, anchor }));
}

/** The same arrow, for a route that has to go around something. */
function elbow(points, { label, anchor = 'start', lx, ly } = {}) {
  push(
    `<polyline points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" ` +
      `stroke="${INK}" stroke-width="1.25" marker-end="url(#head)"/>`,
  );
  if (label) push(text(lx, ly, label, { size: 10, fill: MUTED, anchor }));
}

// --- content ---------------------------------------------------------------

const sources = {
  title: 'Published data',
  tag: 'six datasets, four publishers',
  lines: [
    'Stormwater pits · drainpipes · road corridors',
    'street names · street addresses',
    'City of Melbourne Open Data Portal, CC BY 4.0',
    '',
    'Photogrammetric point cloud, about 4 GB, fetched',
    'a tile at a time by HTTP range request',
    '',
    'Melbourne Water subcatchments, from the feature',
    'service: 35 of 3,409 reach the council extent',
    '',
    'VICSES incidents per SA1, 2009 to 2015, CC BY 4.0',
    'ABS ASGS 2011 for the area names, CC BY 2.5 AU',
  ],
};

const pipeline = {
  title: 'Python pipeline',
  tag: 'pipeline/ · 32 modules · 713 tests',
  lines: [
    'Ground filter over the point cloud, then bare-earth',
    'surface, conditioned surface, D8 flow field,',
    'depressions, and the derived layers on the map',
    '',
    'Drainage graph and downstream trace resolved here,',
    'because map.json cannot tell a pipe clipped at our',
    'boundary from one the council never finished',
    '',
    'Each address matched to one subcatchment against',
    'the service geometry, not the drawn rings: 62,396 of',
    '62,397 in exactly one, none in two, one in none',
  ],
};

const artefacts = {
  title: 'Versioned artefacts',
  tag: 'apps/web/public/data · committed to the repository',
  lines: [
    'addresses.json  1.4 MB · 62,397 addresses, by street',
    'map.json  348 KB · pits, pipes, roads, street labels',
    'derived.json  172 KB · the calculated layers',
    'sa2-points.json  180 KB · the flood area boundaries',
    'address-catchments.json  120 KB · address to area',
    'subcatchments.json  64 KB · 35 boundaries',
    'trace.json  40 KB · the downstream graph',
    'five smaller files, and 424 terrain tiles as WebP',
    '',
    'Every value carries a basis saying where it came',
    'from: recorded, derived, assumed or inferred.',
  ],
};

const migrate = {
  title: 'Cloud Run job · drainlens-migrate',
  tag: 'built from the same image as the API',
  lines: [
    'Applies numbered migrations, then loads the published',
    'artefacts in one transaction. Six migrations so far;',
    '006 added the addresses, which used to be a file only.',
  ],
};

const sql = {
  title: 'Cloud SQL · PostgreSQL 16',
  tag: 'db-f1-micro · no authorised network',
  lines: [
    'Eighteen tables. Reached only through the Cloud SQL',
    'connector, over TLS, with IAM: a public address that',
    'accepts no direct connection.',
    '',
    'The connection string lives in Secret Manager, never',
    'in a deploy command and never in the repository.',
    '',
    'Derived from the artefacts rather than written by the',
    'pipeline: one derivation, one writer, one truth.',
    '',
    'address and address_street arrived on 10 October.',
    'Until then no table held an address, and the search',
    'ran only in the browser. DATABASE-DESIGN.md records',
    'what moving that line cost.',
  ],
};

const site = {
  title: 'Cloud Run · drainlens-dev',
  tag: 'nginx · static · Basic Auth in the container · min 1, max 2',
  lines: [
    'index.html, hashed bundles, the self-hosted font, and',
    'a copy of every artefact the browser falls back to.',
    '',
    'The htpasswd file is built at start-up from the',
    'environment. Without it the container refuses to start',
    'rather than serving an ungated site.',
  ],
};

const api = {
  title: 'Cloud Run · drainlens-api',
  tag: 'Node · Hono · public · min 1, max 2',
  lines: [
    'GET  /health',
    'GET  /api/map/:extent · /api/derived/:extent',
    'GET  /api/trace/:extent · /api/flood-history',
    'POST /api/addresses/search',
    'POST /api/chat',
    '',
    'The two POSTs are new in Iteration 3 and are the only',
    'routes that take a body. Neither is cached and neither',
    'is logged: the request log is excluded at the sink.',
    '',
    'CORS allow-list. Artefacts max-age=300, the two POSTs',
    'no-store.',
  ],
};

const ai = {
  title: 'Cloud Run · drainlens-ai',
  tag: 'FastAPI · private, no public URL · min 1, max 1 · 8 GiB',
  lines: [
    'Llama 3.2 3B as GGUF, with ChromaDB over the official',
    'guidance documents. Reached only by drainlens-api,',
    'with a Google identity token and roles/run.invoker.',
    '',
    'Measured on 10 October: 12 to 35 seconds an answer,',
    'and over a minute on the first after an idle period.',
  ],
};

/**
 * The four panels are a quarter of the page wide, so their lines are wrapped
 * by hand to fit. tools/docs/architecture.check.html measures every run
 * against its own box; keep it passing rather than guessing at line lengths.
 */
const panels = [
  {
    title: 'The map',
    lines: [
      'One affine transform on a canvas.',
      'No map library, no basemap, and no',
      'third-party tile ever requested.',
      'Metres from the extent corner.',
    ],
  },
  {
    title: 'Address search · both ways',
    lines: [
      'Suggestions come from the bundled',
      'index on every keystroke and reach',
      'no server. A submitted search goes',
      'to the API, and falls back to that',
      'same index. packages/address ranks',
      'for both, so one house cannot get',
      'two answers.',
    ],
  },
  {
    title: 'Scenario engine',
    lines: [
      'packages/scenario, in a Web Worker.',
      'On a route since Iteration 2: the',
      'clear against blocked comparison',
      'runs in the browser, not a server.',
    ],
  },
  {
    title: 'The report, and the question',
    lines: [
      'The report is built here and printed',
      'or copied here. Street and suburb',
      'only, never the house number.',
      '',
      'A question typed into the assistant',
      'is the one thing a reader sends.',
      'It carries no address.',
    ],
  },
];

// --- layout ----------------------------------------------------------------

const COL = [
  { x: M, w: 330 },
  { x: 394, w: 330 },
  { x: 756, w: 372 },
];

const row1H = Math.max(heightOf(sources), heightOf(pipeline), heightOf(artefacts));

const Z1 = 110;
const R1 = Z1 + 22;

const Z2 = R1 + row1H + 40;
const R2 = Z2 + 22;
const migrateH = heightOf(migrate);
const siteH = Math.max(heightOf(site), heightOf(api));
const R2b = R2 + migrateH + 34;
const aiH = heightOf(ai);
const R2c = R2b + siteH + 34;

// The database box is drawn down to the foot of the service row beside it, so
// the deployed zone has one bottom line rather than three ragged ones.
const sqlH = Math.max(heightOf(sql), migrateH + 34 + siteH);

const Z3 = R2c + aiH + 74;
const R3 = Z3 + 22;
const panelH = Math.max(...panels.map((p) => heightOf(p)));
const outerH = 58 + panelH + 18;

const footTop = R3 + outerH + 34;
const H = footTop + 104;

// --- draw ------------------------------------------------------------------

const CLAIM =
  'DrainLens system architecture as deployed on 10 October 2026: a build-time Python pipeline, three Cloud Run services, Cloud SQL, ' +
  'and a browser that holds a fallback copy of every artefact and runs the blockage comparison itself.';

push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(CLAIM)}">`);
push('<title>DrainLens system architecture</title>');
push(`<defs><marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${INK}"/></marker></defs>`);
push(`<rect width="${W}" height="${H}" fill="${PAPER}"/>`);

push(text(M, 46, 'DrainLens · system architecture', { size: 19, weight: 600 }));
push(text(M, 68, 'Iteration 3, as deployed 10 October 2026 · Cloud Run and Cloud SQL, australia-southeast1, project fit5120-504507', { size: 11, fill: MUTED }));
push(`<line x1="${M}" y1="84" x2="${W - M}" y2="84" stroke="${RULE}" stroke-width="1"/>`);

zone(Z1, 'Build time · offline, run by hand, never deployed');
box({ ...sources, ...COL[0], y: R1, h: row1H });
box({ ...pipeline, ...COL[1], y: R1, h: row1H });
box({ ...artefacts, ...COL[2], y: R1, h: row1H });
arrow(COL[0].x + COL[0].w + 2, R1 + row1H / 2, COL[1].x - 4, R1 + row1H / 2);
arrow(COL[1].x + COL[1].w + 2, R1 + row1H / 2, COL[2].x - 4, R1 + row1H / 2);

zone(Z2, 'Deployed · Google Cloud');
box({ ...migrate, ...COL[1], y: R2, h: migrateH });
box({ ...sql, ...COL[2], y: R2, h: sqlH });
box({ ...site, ...COL[0], y: R2b, h: siteH });
box({ ...api, ...COL[1], y: R2b, h: siteH });
box({ ...ai, ...COL[2], y: R2c, h: aiH });

arrow(COL[1].x + COL[1].w + 2, R2 + migrateH / 2, COL[2].x - 4, R2 + migrateH / 2, { label: 'writes' });
arrow(COL[1].x + COL[1].w + 2, R2b + siteH / 2, COL[2].x - 4, R2b + siteH / 2, { label: 'reads' });
arrow(COL[1].x + COL[1].w - 70, R2b + siteH + 2, COL[2].x + 70, R2c - 4, {
  label: 'POST /chat, identity token',
  anchor: 'start',
  lx: COL[2].x + 80,
  ly: R2c - 10,
});

// The job loads the artefacts; the site image carries its own copy of them.
// Two consequences of one folder, so both leave the same box.
arrow(COL[2].x + 150, R1 + row1H + 2, COL[1].x + COL[1].w / 2 + 50, R2 - 4, {
  label: 'loaded by the job',
  anchor: 'start',
  lx: COL[2].x + 36,
  ly: R2 - 16,
});
elbow(
  [
    [COL[2].x + 20, R1 + row1H + 2],
    [COL[2].x + 20, R1 + row1H + 20],
    [COL[0].x + COL[0].w / 2, R1 + row1H + 20],
    [COL[0].x + COL[0].w / 2, R2b - 4],
  ],
  {
    label: 'baked into the site image',
    lx: COL[0].x + COL[0].w / 2 + 10,
    ly: R2 + migrateH / 2,
  },
);

zone(Z3, 'In the browser');
box({
  x: M,
  y: R3,
  w: W - 2 * M,
  h: outerH,
  title: 'React + TypeScript, one canvas',
  tag: 'apps/web · 101 test files, 1,725 tests across the workspace · session state in memory for the life of the tab, and one localStorage key: drainlens.tour.seen',
});

const innerW = (W - 2 * M - 32 - 3 * 18) / 4;
panels.forEach((p, i) => {
  box({ ...p, x: M + 16 + i * (innerW + 18), y: R3 + 58, w: innerW, h: panelH, fill: SURFACE });
});

arrow(COL[0].x + COL[0].w / 2, R2b + siteH + 2, COL[0].x + COL[0].w / 2, R3 - 4, {
  label: 'page, bundle, fallback copies',
  anchor: 'start',
  lx: COL[0].x + COL[0].w / 2 + 10,
  ly: Z3 - 26,
});
// From the API, not from the database: nothing in the browser can reach
// Cloud SQL, and a figure that implies otherwise is worse than no figure.
arrow(COL[1].x + COL[1].w / 2, R2b + siteH + 2, COL[1].x + COL[1].w / 2, R3 - 4, {
  label: 'six routes, asked first',
  anchor: 'start',
  lx: COL[1].x + COL[1].w / 2 + 10,
  ly: Z3 - 26,
});
// Not "the footer names which answered": the copy review of 14 September cut
// that line, on the ground that a resident cannot act on which server replied.
push(text(W - M, Z3 - 48, 'Every artefact is asked of the API first and falls back to the copy in the site container. The footer does not say which answered, only that the fallback map is smaller.', { size: 10, fill: MUTED, anchor: 'end' }));

push(`<line x1="${M}" y1="${footTop}" x2="${W - M}" y2="${footTop}" stroke="${RULE}" stroke-width="1"/>`);
push(text(M, footTop + 20, 'WHAT MUST STAY TRUE', { size: 10, weight: 600, fill: MUTED, spacing: '0.09em' }));
[
  'AD1 · no accounts and no retained IP. The _Default sink excludes LOG_ID(run.googleapis.com/requests), re-verified on 10 October with a positive control: real traffic that afternoon, zero request-log entries in seven days.',
  'Two things now leave the browser and both were decided, not drifted: a submitted address search and a typed question. Neither is stored, neither is cached on what was typed, and the report still leaves by no route at all.',
  'The house number does not travel. The report shows street and suburb, and ReportWhere has no field for a number, so no future caller can pass one.',
  'packages/schema holds one definition of provenance and vocabulary, and packages/address one ranking for the browser and the API, so a decision made in either cannot drift between its two callers.',
].forEach((line, i) => push(text(M, footTop + 42 + i * 16, '·  ' + line, { size: 10 })));

push('</svg>');

writeFileSync(process.argv[2], out.join('\n') + '\n', 'utf8');
console.log(`wrote ${process.argv[2]} · ${W} x ${H}`);
