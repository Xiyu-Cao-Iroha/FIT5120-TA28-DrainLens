/**
 * The Terrain layer for the whole council: pre-coloured 500 m tiles and one overview.
 *
 * `pipeline/.../terrain_tiles.py` does the colouring and shading at build time
 * and ships images: per tile a colour image on the fixed AHD ramp and a
 * hillshade multiply image, with the tile's contours and spot heights beside
 * them; and a 4 m overview of the whole extent. This file decides what to draw
 * at the current view and fetches what it needs.
 *
 * **Two levels, switched by a fixed scale, never by what is in view.** Below
 * half a pixel per metre the overview is drawn, because a hundred tiles would be
 * on screen and none of them legible. Above it the tiles in view are drawn
 * over the overview, which stays underneath any tile still loading so the
 * ground never flashes blank. Contours and spot heights come with the tiles and
 * are drawn only at tile scale.
 *
 * **The order is still Terrain V1.1's.** Colour under the roads, the shade
 * multiplied over the colour and the roads together. Where a tile is loaded its
 * shade replaces the overview's rather than multiplying on top of it — two
 * multiplies would darken that tile twice.
 *
 * Where the archive has no tile, the overview is transparent and there is no
 * tile, so the map's own flat ground shows: nothing is claimed about ground
 * nobody measured.
 */

import type { ContourLine, SpotHeight, TerrainMarks } from './terrainMarks.js';
import type { TerrainExtent } from './terrain.js';
import { type Viewport, toScreen } from './viewport.js';

export class TerrainTilesError extends Error {}

/** Below this many pixels per metre, the overview is drawn instead of tiles. */
export const TILE_SCALE_MIN = 0.5;

/** Tiles kept decoded at once. A screen at tile scale shows well under this. */
export const TILES_KEPT = 48;

export interface TileEntry {
  readonly tile: string;
  readonly tx: number;
  readonly ty: number;
  /** South-west corner, metres in the index's extent. */
  readonly e: number;
  readonly n: number;
}

export interface TerrainTileIndex {
  readonly artefact: 'terrain-tiles';
  readonly extent: TerrainExtent;
  readonly tileGrid: { readonly sizeM: number };
  readonly tiles: readonly TileEntry[];
  readonly overview: {
    readonly colour: string;
    readonly shade: string;
    readonly cellM: number;
    readonly width: number;
    readonly height: number;
  };
}

export function assertTerrainTileIndex(value: unknown): asserts value is TerrainTileIndex {
  const a = value as Partial<TerrainTileIndex> | null;
  if (a === null || typeof a !== 'object' || a.artefact !== 'terrain-tiles') {
    throw new TerrainTilesError('the terrain index is not one');
  }
  const extent = a.extent;
  if (
    !extent ||
    !Number.isFinite(extent.min_e) ||
    !Number.isFinite(extent.min_n) ||
    !(extent.width_m > 0) ||
    !(extent.height_m > 0)
  ) {
    throw new TerrainTilesError('the terrain index does not say where it is');
  }
  if (!((a.tileGrid?.sizeM ?? 0) > 0)) throw new TerrainTilesError('the terrain index does not say how big a tile is');
  if (!Array.isArray(a.tiles)) throw new TerrainTilesError('the terrain index lists no tiles');
  for (const tile of a.tiles) {
    if (typeof tile.tile !== 'string' || !Number.isFinite(tile.e) || !Number.isFinite(tile.n)) {
      throw new TerrainTilesError('a terrain tile has no name or corner');
    }
  }
  const o = a.overview;
  if (!o || typeof o.colour !== 'string' || typeof o.shade !== 'string' || !(o.cellM > 0) || !(o.width > 0) || !(o.height > 0)) {
    throw new TerrainTilesError('the terrain index has no overview');
  }
}

/** Offset from the index's frame into the frame of the map being drawn. */
export function offsetInto(
  extent: TerrainExtent,
  map: { readonly min_e?: number; readonly min_n?: number },
): readonly [number, number] {
  return [extent.min_e - (map.min_e ?? extent.min_e), extent.min_n - (map.min_n ?? extent.min_n)];
}

/** A rectangle in index metres, as screen pixels. */
function screenRect(
  e: number,
  n: number,
  widthM: number,
  heightM: number,
  offset: readonly [number, number],
  viewport: Viewport,
): { left: number; top: number; width: number; height: number } {
  const [left, top] = toScreen(viewport, [e + offset[0], n + heightM + offset[1]]);
  const [right, bottom] = toScreen(viewport, [e + widthM + offset[0], n + offset[1]]);
  return { left, top, width: right - left, height: bottom - top };
}

/** The tiles whose square is at least partly on screen. */
export function visibleTiles(
  index: TerrainTileIndex,
  viewport: Viewport,
  map: { readonly min_e?: number; readonly min_n?: number },
): readonly TileEntry[] {
  const offset = offsetInto(index.extent, map);
  const size = index.tileGrid.sizeM;
  return index.tiles.filter((tile) => {
    const r = screenRect(tile.e, tile.n, size, size, offset, viewport);
    return r.left + r.width > 0 && r.top + r.height > 0 && r.left < viewport.widthPx && r.top < viewport.heightPx;
  });
}

/** A contour as a tile publishes it: half-metre integers, first vertex then steps. */
export interface EncodedContour {
  readonly m: number;
  readonly major: boolean;
  readonly d: readonly number[];
}

export function decodeContour(line: EncodedContour, unitM: number): ContourLine {
  const c: [number, number][] = [];
  let e = 0;
  let n = 0;
  for (let i = 0; i + 1 < line.d.length; i += 2) {
    e = i === 0 ? line.d[0]! : e + line.d[i]!;
    n = i === 0 ? line.d[1]! : n + line.d[i + 1]!;
    c.push([e * unitM, n * unitM]);
  }
  return { m: line.m, major: line.major, c };
}

interface LoadedTile {
  readonly colour: CanvasImageSource;
  readonly shade: CanvasImageSource;
  readonly contours: readonly ContourLine[];
  readonly spots: readonly SpotHeight[];
}

export interface TileLoaders {
  readonly image: (url: string) => Promise<CanvasImageSource>;
  readonly json: (url: string) => Promise<unknown>;
}

const browserLoaders: TileLoaders = {
  image: async (url) => createImageBitmap(await (await fetch(url)).blob()),
  json: async (url) => (await fetch(url)).json(),
};

/**
 * The loaded images, fetched on demand and forgotten least-recently-used.
 *
 * `onChange` is called when something new has arrived, so the map can redraw;
 * a tile that fails to load is not retried in the same session, and its square
 * keeps the overview.
 */
export class TerrainTiles {
  readonly index: TerrainTileIndex;
  private readonly base: string;
  private readonly loaders: TileLoaders;
  private readonly onChange: () => void;
  private overview: { colour: CanvasImageSource; shade: CanvasImageSource } | null = null;
  private readonly loaded = new Map<string, LoadedTile>();
  private readonly pending = new Set<string>();
  private readonly failed = new Set<string>();

  constructor(base: string, index: TerrainTileIndex, onChange: () => void, loaders: TileLoaders = browserLoaders) {
    this.base = base;
    this.index = index;
    this.onChange = onChange;
    this.loaders = loaders;
  }

  /** Fetch the overview; the layer can draw once this resolves. */
  async start(): Promise<void> {
    const [colour, shade] = await Promise.all([
      this.loaders.image(`${this.base}/${this.index.overview.colour}`),
      this.loaders.image(`${this.base}/${this.index.overview.shade}`),
    ]);
    this.overview = { colour, shade };
    this.onChange();
  }

  get ready(): boolean {
    return this.overview !== null;
  }

  tile(name: string): LoadedTile | undefined {
    const held = this.loaded.get(name);
    if (held) {
      // Most recently used goes to the end.
      this.loaded.delete(name);
      this.loaded.set(name, held);
    }
    return held;
  }

  request(name: string): void {
    if (this.loaded.has(name) || this.pending.has(name) || this.failed.has(name)) return;
    this.pending.add(name);
    const url = `${this.base}/${name}`;
    Promise.all([
      this.loaders.image(`${url}/colour.webp`),
      this.loaders.image(`${url}/shade.webp`),
      this.loaders.json(`${url}/marks.json`),
    ])
      .then(([colour, shade, marks]) => {
        const m = marks as { unitM?: number; contours?: EncodedContour[]; spots?: SpotHeight[] };
        const unit = m.unitM ?? 0.5;
        this.loaded.set(name, {
          colour,
          shade,
          contours: (m.contours ?? []).map((line) => decodeContour(line, unit)),
          spots: m.spots ?? [],
        });
        while (this.loaded.size > TILES_KEPT) {
          const oldest = this.loaded.keys().next().value as string;
          this.loaded.delete(oldest);
        }
      })
      .catch(() => {
        this.failed.add(name);
      })
      .finally(() => {
        this.pending.delete(name);
        this.onChange();
      });
  }

  /** The overview images, once loaded. */
  get overviewImages(): { colour: CanvasImageSource; shade: CanvasImageSource } | null {
    return this.overview;
  }
}

function drawOverviewPart(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  tiles: TerrainTiles,
  viewport: Viewport,
  offset: readonly [number, number],
  part?: TileEntry,
): void {
  const { overview, extent, tileGrid } = tiles.index;
  if (part === undefined) {
    const r = screenRect(0, 0, extent.width_m, extent.height_m, offset, viewport);
    context.drawImage(image, r.left, r.top, r.width, r.height);
    return;
  }
  const size = tileGrid.sizeM;
  const sx = part.e / overview.cellM;
  const sy = overview.height - (part.n + size) / overview.cellM;
  const r = screenRect(part.e, part.n, size, size, offset, viewport);
  context.drawImage(image, sx, sy, size / overview.cellM, size / overview.cellM, r.left, r.top, r.width, r.height);
}

/** Colour, under the roads: the overview, then every loaded tile in view over it. */
export function drawTerrainColour(
  context: CanvasRenderingContext2D,
  tiles: TerrainTiles,
  viewport: Viewport,
  map: { readonly min_e?: number; readonly min_n?: number },
): void {
  const overview = tiles.overviewImages;
  if (!overview) return;
  const offset = offsetInto(tiles.index.extent, map);
  context.save();
  context.imageSmoothingEnabled = true;
  drawOverviewPart(context, overview.colour, tiles, viewport, offset);
  if (viewport.scale >= TILE_SCALE_MIN) {
    const size = tiles.index.tileGrid.sizeM;
    for (const entry of visibleTiles(tiles.index, viewport, map)) {
      const tile = tiles.tile(entry.tile);
      if (!tile) {
        tiles.request(entry.tile);
        continue;
      }
      const r = screenRect(entry.e, entry.n, size, size, offset, viewport);
      context.drawImage(tile.colour, r.left, r.top, r.width, r.height);
    }
  }
  context.restore();
}

/**
 * The shade, multiplied over the colour and the roads.
 *
 * At overview scale, the overview's shade. At tile scale, each visible tile's
 * own shade where it is loaded and the overview's shade for just that square
 * where it is not — never both on one square.
 */
export function drawTerrainShade(
  context: CanvasRenderingContext2D,
  tiles: TerrainTiles,
  viewport: Viewport,
  map: { readonly min_e?: number; readonly min_n?: number },
): void {
  const overview = tiles.overviewImages;
  if (!overview) return;
  const offset = offsetInto(tiles.index.extent, map);
  context.save();
  context.globalCompositeOperation = 'multiply';
  context.imageSmoothingEnabled = true;
  if (viewport.scale < TILE_SCALE_MIN) {
    drawOverviewPart(context, overview.shade, tiles, viewport, offset);
  } else {
    const size = tiles.index.tileGrid.sizeM;
    for (const entry of visibleTiles(tiles.index, viewport, map)) {
      const tile = tiles.tile(entry.tile);
      if (tile) {
        const r = screenRect(entry.e, entry.n, size, size, offset, viewport);
        context.drawImage(tile.shade, r.left, r.top, r.width, r.height);
      } else {
        drawOverviewPart(context, overview.shade, tiles, viewport, offset, entry);
      }
    }
  }
  context.restore();
}

/** The contours and spot heights of the loaded tiles in view, or null below tile scale. */
export function marksInView(
  tiles: TerrainTiles,
  viewport: Viewport,
  map: { readonly min_e?: number; readonly min_n?: number },
): TerrainMarks | null {
  if (viewport.scale < TILE_SCALE_MIN) return null;
  const contours: ContourLine[] = [];
  const spots: SpotHeight[] = [];
  for (const entry of visibleTiles(tiles.index, viewport, map)) {
    const tile = tiles.tile(entry.tile);
    if (!tile) continue;
    contours.push(...tile.contours);
    spots.push(...tile.spots);
  }
  return { contours, spots, extent: tiles.index.extent };
}

/** Load the index and the overview; resolves once the layer can draw. */
export async function loadTerrainTiles(
  base: string,
  onChange: () => void,
  loaders: TileLoaders = browserLoaders,
): Promise<TerrainTiles> {
  const index = await loaders.json(`${base}/index.json`);
  assertTerrainTileIndex(index);
  const tiles = new TerrainTiles(base, index, onChange, loaders);
  await tiles.start();
  return tiles;
}
