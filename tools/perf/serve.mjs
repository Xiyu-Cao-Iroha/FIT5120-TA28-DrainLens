import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, extname } from 'node:path';

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] ?? 8099);

// The MIME types that matter. A module worker served as anything other than a
// JavaScript type is refused by the browser outright.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.bin': 'application/octet-stream',
};

const cache = new Map();

createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  const file = join(ROOT, path === '/' ? 'index.html' : decodeURIComponent(path));
  try {
    await stat(file);
    let entry = cache.get(file);
    if (!entry) {
      const raw = await readFile(file);
      entry = { raw, gz: gzipSync(raw, { level: 6 }), type: TYPES[extname(file)] ?? 'application/octet-stream' };
      cache.set(file, entry);
    }
    const wantsGzip = (req.headers['accept-encoding'] ?? '').includes('gzip');
    res.writeHead(200, {
      'content-type': entry.type,
      ...(wantsGzip ? { 'content-encoding': 'gzip' } : {}),
      'content-length': wantsGzip ? entry.gz.length : entry.raw.length,
      'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    });
    res.end(wantsGzip ? entry.gz : entry.raw);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on ${PORT}`));
