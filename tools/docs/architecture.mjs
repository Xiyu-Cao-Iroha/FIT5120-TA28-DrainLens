/**
 * The system architecture figure.
 *
 *   node tools/docs/architecture.mjs docs/system-architecture.svg
 *
 * **Generated rather than drawn, because the architecture keeps changing.**
 * Between 3 and 5 September this system gained a database, an API, a
 * migration job and a frontend that reads from all three; a figure drawn by
 * hand in that week would have been wrong within a day and nobody would have
 * been able to tell by looking at it. Re-run this after a change and diff the
 * SVG.
 *
 * Box heights are computed from their content and rows are placed from those
 * heights, so a wording change cannot silently push text through a border --
 * which is exactly what the first hand-positioned version did.
 *
 * Monochrome on purpose: the figure goes into a report and onto a projector,
 * and every distinction in it survives a black-and-white printer. Nothing is
 * encoded in hue because nothing here is coloured.
 *
 * The numbers in it are measured, not remembered. Two were wrong in the first
 * draft -- map.json's size had been copied from a transfer measurement, which
 * is a different quantity, and FORBIDDEN_WIRE_KEYS was counted by eye as
 * fifteen when it holds sixteen.
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

// --- content ---------------------------------------------------------------

const sources = {
  title: 'Published data',
  tag: 'four datasets, three publishers',
  lines: [
    'Stormwater pits · drainpipes · road corridors',
    'street names · street addresses',
    'City of Melbourne Open Data Portal, CC BY 4.0',
    '',
    'Photogrammetric point cloud, about 4 GB, fetched',
    'a tile at a time by HTTP range request',
    '',
    'VICSES incidents per SA1, 2009–2015, CC BY 4.0',
    'ABS ASGS 2011 for the area names, CC BY 2.5 AU',
  ],
};

const pipeline = {
  title: 'Python pipeline',
  tag: 'pipeline/ · 18 modules · 377 tests',
  lines: [
    'Ground filter over the point cloud, then bare-earth',
    'surface → conditioned surface → D8 flow field →',
    'depressions → the derived layers on the map',
    '',
    'Drainage graph and downstream trace resolved here,',
    'because map.json cannot tell a pipe clipped at our',
    'boundary from one the council never finished',
    '',
    'Flood board: incidents joined to SA1 names',
  ],
};

const artefacts = {
  title: 'Versioned artefacts',
  tag: 'apps/web/public/data · committed to the repository',
  lines: [
    'map.json  318 KB — pits, pipes, roads, street labels',
    'derived.json  183 KB — the calculated layers',
    'trace.json  37 KB — the downstream graph',
    'flood-history.json  5 KB — thirty ranked areas',
    'addresses.json  678 KB — 4,089 addresses',
    'scene/ — a header and six binary arrays',
    '',
    'Every value carries a basis saying where it came',
    'from: recorded, derived, assumed or inferred.',
  ],
};

const migrate = {
  title: 'Cloud Run job — drainlens-migrate',
  tag: 'built from the same image as the API',
  lines: [
    'Applies numbered migrations, then loads the',
    'published artefacts. Truncate-and-insert inside one',
    'transaction, so re-running it is a replacement.',
  ],
};

const sql = {
  title: 'Cloud SQL — PostgreSQL 16',
  tag: 'db-f1-micro · no authorised network',
  lines: [
    'Sixteen tables. Reached only through the Cloud SQL',
    'connector, over TLS, with IAM — a public address',
    'that accepts no direct connection.',
    '',
    'The connection string lives in Secret Manager, never',
    'in a deploy command and never in the repository.',
    '',
    'Derived from the artefacts rather than written by the',
    'pipeline: one derivation, one writer, one truth.',
    '',
    'flood_incident and population are declared and left',
    'empty — the SA1 grain is in no published artefact,',
    'and invented rows would be worse than none.',
  ],
};

const site = {
  title: 'Cloud Run — drainlens',
  tag: 'nginx · static · Basic Auth at the edge',
  lines: [
    'index.html, hashed bundles, the self-hosted font, and',
    'the artefact copies the browser falls back to.',
    '',
    'The htpasswd file is built at start-up from the',
    'environment. Without it the container refuses to start',
    'rather than serving an ungated site.',
  ],
};

const api = {
  title: 'Cloud Run — drainlens-api',
  tag: 'Node · Hono · read-only',
  lines: [
    'GET /health',
    'GET /api/map/:extent',
    'GET /api/derived/:extent',
    'GET /api/trace/:extent',
    'GET /api/flood-history',
    '',
    'No POST, and no route takes a body. An extent id and',
    'an area name are the only inputs and both are',
    'published. CORS allow-list · public, max-age=300.',
  ],
};

const panels = [
  {
    title: 'The map',
    lines: [
      'One affine transform on a canvas. No map library, no',
      'basemap, no third-party tile ever requested. Metres',
      'from the extent corner, so nothing is reprojected.',
    ],
  },
  {
    title: 'Address search — stays here',
    lines: [
      'Resolved in the browser against the bundled index.',
      'No endpoint accepts an address or a coordinate, and',
      'none of it reaches storage, the URL or history.',
    ],
  },
  {
    title: 'Scenario engine',
    lines: [
      'packages/scenario, in a Web Worker. Built and tested,',
      'and on no Iteration 1 route: AC 1.1.1 requires the',
      'blockage comparison to be absent from this iteration.',
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
const sqlH = Math.max(heightOf(sql), migrateH + 34 + siteH);

const Z3 = R2b + siteH + 74;
const R3 = Z3 + 22;
const panelH = Math.max(...panels.map((p) => heightOf(p)));
const outerH = 58 + panelH + 18;

const footTop = R3 + outerH + 34;
const H = footTop + 88;

// --- draw ------------------------------------------------------------------

push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="DrainLens system architecture">`);
push('<title>DrainLens system architecture</title>');
push(`<defs><marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${INK}"/></marker></defs>`);
push(`<rect width="${W}" height="${H}" fill="${PAPER}"/>`);

push(text(M, 46, 'DrainLens — system architecture', { size: 19, weight: 600 }));
push(text(M, 68, 'Iteration 1, as deployed 5 September 2026 · Cloud Run and Cloud SQL, australia-southeast1, project fit5120-504507', { size: 11, fill: MUTED }));
push(`<line x1="${M}" y1="84" x2="${W - M}" y2="84" stroke="${RULE}" stroke-width="1"/>`);

zone(Z1, 'Build time — offline, run by hand, never deployed');
box({ ...sources, ...COL[0], y: R1, h: row1H });
box({ ...pipeline, ...COL[1], y: R1, h: row1H });
box({ ...artefacts, ...COL[2], y: R1, h: row1H });
arrow(COL[0].x + COL[0].w + 2, R1 + row1H / 2, COL[1].x - 4, R1 + row1H / 2);
arrow(COL[1].x + COL[1].w + 2, R1 + row1H / 2, COL[2].x - 4, R1 + row1H / 2);

zone(Z2, 'Deployed — Google Cloud');
box({ ...migrate, ...COL[1], y: R2, h: migrateH });
box({ ...sql, ...COL[2], y: R2, h: sqlH });
box({ ...site, ...COL[0], y: R2b, h: siteH });
box({ ...api, ...COL[1], y: R2b, h: siteH });

arrow(COL[1].x + COL[1].w + 2, R2 + migrateH / 2, COL[2].x - 4, R2 + migrateH / 2, { label: 'writes' });
arrow(COL[1].x + COL[1].w + 2, R2b + siteH / 2, COL[2].x - 4, R2b + siteH / 2, { label: 'reads' });
arrow(COL[2].x + 120, R1 + row1H + 2, COL[1].x + COL[1].w / 2 + 40, R2 - 4, {
  label: 'loaded from',
  anchor: 'start',
  lx: COL[2].x + 30,
  ly: R2 - 14,
});

zone(Z3, 'In the browser');
box({ x: M, y: R3, w: W - 2 * M, h: outerH, title: 'React + TypeScript, one canvas', tag: 'apps/web · 642 unit tests · session state in memory for the life of the tab, and one localStorage key: drainlens.tour.seen' });

const innerW = 340;
panels.forEach((p, i) => {
  box({ ...p, x: M + 16 + i * (innerW + 22), y: R3 + 58, w: innerW, h: panelH, fill: SURFACE });
});

arrow(COL[0].x + COL[0].w / 2, R2b + siteH + 2, COL[0].x + COL[0].w / 2, R3 - 4, {
  label: 'page, bundle, fallback copies',
  anchor: 'start',
  lx: COL[0].x + COL[0].w / 2 + 10,
  ly: Z3 - 26,
});
arrow(COL[1].x + COL[1].w / 2, R2b + siteH + 2, COL[1].x + COL[1].w / 2, R3 - 4, {
  label: 'four artefacts',
  anchor: 'start',
  lx: COL[1].x + COL[1].w / 2 + 10,
  ly: Z3 - 26,
});
push(text(W - M, Z3 - 48, 'Each of the four is asked of the API first and falls back to the copy in the site container. The footer names which answered.', { size: 10, fill: MUTED, anchor: 'end' }));

push(`<line x1="${M}" y1="${footTop}" x2="${W - M}" y2="${footTop}" stroke="${RULE}" stroke-width="1"/>`);
push(text(M, footTop + 20, 'WHAT MUST STAY TRUE', { size: 10, weight: 600, fill: MUTED, spacing: '0.09em' }));
[
  'AD1 — no identity and no retained IP. The _Default sink excludes LOG_ID(run.googleapis.com/requests) for both services, verified with a positive control, and Cloud SQL logs no connections.',
  'No arrow points upward out of the browser. Every edge into it is a read, and no request carries anything that names a person — FORBIDDEN_WIRE_KEYS refuses sixteen such keys structurally.',
  'packages/schema holds one definition of provenance and vocabulary for the site and the API, so a decision made there cannot drift between them.',
].forEach((line, i) => push(text(M, footTop + 42 + i * 16, '— ' + line, { size: 10 })));

push('</svg>');

writeFileSync(process.argv[2], out.join('\n') + '\n', 'utf8');
console.log(`wrote ${process.argv[2]} — ${W} x ${H}`);
