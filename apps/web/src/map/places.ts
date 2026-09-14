/**
 * Suburb names on the drainage map.
 *
 * Reported from review: zoomed out to the whole council, the full map is a
 * pale street network with no names on it, and a resident cannot find the
 * CBD, let alone their own suburb. Street names only appear once there is room
 * for them, which is exactly the zoom at which nobody needs to be told which
 * suburb they are looking at. So the overview gets suburb names, and they give
 * way to the street names as the map closes in.
 *
 * **Anchors are MGA zone 55 on GDA94 (EPSG:28355), not local metres.** Every
 * artefact here is in metres from its *own* extent's corner, and the site
 * opens either the council extent or — when the database is down — the bundled
 * Kensington square kilometre, whose corner is 1,500 m east and 6,000 m north
 * of the council's. A table of local positions would be right for one of them
 * and silently wrong for the other; `pipeline/reframe.py` records that this
 * repository has shipped that exact bug once. The shift to local happens in
 * `placesIn`, from whichever extent is actually loaded.
 *
 * **Where the numbers come from.** Measured on 14 September 2026 from two
 * artefacts already in the repository, both projected by the pipeline's own
 * `geo.to_mga55`, so no second projection is involved:
 *
 * - *ABS SA2* — the median position of the council's own drain pits
 *   (`apps/api/data/city-of-melbourne/map.json`, 21,113 of them) that fall
 *   inside that ASGS 2011 statistical area's boundary
 *   (`public/data/sa2-points.json`). The median of the *pits* rather than the
 *   area's own centroid because four of these suburbs — Carlton North,
 *   Flemington, Port Melbourne, South Yarra — are split with a neighbouring
 *   council, and the pits are where the City of Melbourne's part of them is.
 *   A commonly quoted centre for Port Melbourne is 2.8 km from this anchor, in
 *   Port Phillip, where this map has no streets at all. Every median was
 *   checked to lie inside its own area.
 * - *streets* — for the two suburbs with no SA2 of their own. West Melbourne's
 *   2011 SA2 is only the docks and rail yards; its houses sit inside the North
 *   Melbourne SA2, so the anchor is the mean of four intersections on the
 *   council's centrelines (Hawke × Adderley, Adderley × Dudley, Spencer ×
 *   Dudley, King × Rosslyn). South Wharf is part of the Southbank SA2, and its
 *   anchor is the mean of the centres of South Wharf Promenade and Convention
 *   Centre Place.
 *
 * `places.test.ts` re-checks all of it against those same two files: each SA2
 * anchor inside the area it came from, and each anchor within walking distance
 * of named streets that are unambiguously in that suburb.
 */

import type { Local, Viewport } from './viewport.js';

export interface Place {
  /** As written on the map, before it is set in capitals. */
  readonly name: string;
  /** MGA zone 55 easting, GDA94. */
  readonly e: number;
  /** MGA zone 55 northing, GDA94. */
  readonly n: number;
  /**
   * Which name survives a collision, lowest first.
   *
   * Not size or population: the CBD is the name every other one is read
   * against, and Kensington is where the pilot is, so those two are the last
   * to go. Suburbs the council only partly covers come after the ones it
   * covers whole, because their name over the council's corner of them is the
   * less useful of the two readings.
   */
  readonly rank: number;
  /** How the anchor was measured — see the module comment. */
  readonly basis: 'sa2' | 'streets';
  /** The ASGS 2011 area the anchor was taken from, or the one it falls in. */
  readonly sa2: string;
}

export const PLACES: readonly Place[] = [
  { name: 'Melbourne CBD', e: 320674, n: 5812866, rank: 1, basis: 'sa2', sa2: 'Melbourne' },
  { name: 'Kensington', e: 317280, n: 5814994, rank: 2, basis: 'sa2', sa2: 'Kensington' },
  { name: 'Southbank', e: 321059, n: 5811614, rank: 3, basis: 'sa2', sa2: 'Southbank' },
  { name: 'Docklands', e: 319081, n: 5812261, rank: 4, basis: 'sa2', sa2: 'Docklands' },
  { name: 'Carlton', e: 321035, n: 5814315, rank: 5, basis: 'sa2', sa2: 'Carlton' },
  { name: 'North Melbourne', e: 319240, n: 5814217, rank: 6, basis: 'sa2', sa2: 'North Melbourne' },
  { name: 'East Melbourne', e: 322260, n: 5812842, rank: 7, basis: 'sa2', sa2: 'East Melbourne' },
  { name: 'Parkville', e: 319723, n: 5815867, rank: 8, basis: 'sa2', sa2: 'Parkville' },
  { name: 'West Melbourne', e: 319428, n: 5813344, rank: 9, basis: 'streets', sa2: 'North Melbourne' },
  { name: 'South Wharf', e: 319669, n: 5811678, rank: 10, basis: 'streets', sa2: 'Southbank' },
  // Split with a neighbouring council: the anchor is in the City of Melbourne's part.
  { name: 'South Yarra', e: 322323, n: 5810404, rank: 11, basis: 'sa2', sa2: 'South Yarra - West' },
  { name: 'Flemington', e: 316617, n: 5815632, rank: 12, basis: 'sa2', sa2: 'Flemington Racecourse' },
  { name: 'Port Melbourne', e: 316513, n: 5811446, rank: 13, basis: 'sa2', sa2: 'Port Melbourne Industrial' },
  { name: 'Carlton North', e: 320499, n: 5816223, rank: 14, basis: 'sa2', sa2: 'Carlton North - Princes Hill' },
];

/** The part of an artefact's header that says where its frame is. */
export interface Frame {
  readonly min_e: number;
  readonly min_n: number;
  readonly width_m: number;
  readonly height_m: number;
}

export interface LocalPlace {
  readonly place: Place;
  readonly at: Local;
}

/**
 * The places inside this extent, in its own frame.
 *
 * Inside the extent, not merely near it. A name whose anchor is off the map
 * would be drawn at the edge of ground that is not that suburb — on the
 * Kensington fallback, "North Melbourne" hanging off the east side of a square
 * kilometre that is all Kensington.
 */
export function placesIn(extent: Frame, places: readonly Place[] = PLACES): LocalPlace[] {
  const found: LocalPlace[] = [];
  for (const place of places) {
    const east = place.e - extent.min_e;
    const north = place.n - extent.min_n;
    if (east < 0 || east > extent.width_m || north < 0 || north > extent.height_m) continue;
    found.push({ place, at: [east, north] });
  }
  return found;
}

/**
 * At or below this many pixels per metre, suburb names are fully drawn.
 *
 * About three kilometres across a laptop map: a handful of suburbs on screen,
 * which is the widest view in which a suburb name is still the most useful
 * thing to read. The council overview is 0.09–0.13.
 */
export const PLACE_FULL_SCALE = 0.35;

/**
 * At or above this, they are gone.
 *
 * Just past `LABEL_MIN_SCALE` (0.55), so the street names arrive while the
 * suburb names are leaving and the two are never both at full strength — a
 * suburb name in full ink across a street name is a street the person cannot
 * read. It also keeps them off the guide's framed map, which opens at about
 * three pixels a metre and is one street, not a suburb.
 */
export const PLACE_HIDDEN_SCALE = 0.7;

/**
 * How strongly to draw suburb names at this scale, from 1 to 0.
 *
 * A fade rather than a switch. Names that blink out at a wheel notch read as
 * something having failed to load, and the fade is over a zoom range a
 * trackpad crosses in a fraction of a second anyway.
 */
export function placeOpacity(scale: number): number {
  if (scale <= PLACE_FULL_SCALE) return 1;
  if (scale >= PLACE_HIDDEN_SCALE) return 0;
  return (PLACE_HIDDEN_SCALE - scale) / (PLACE_HIDDEN_SCALE - PLACE_FULL_SCALE);
}

/** Thin space between letters: tracking that renders on every canvas. */
const THIN_SPACE = '\u2009';

/**
 * A suburb name in the map's capitals, letter-spaced.
 *
 * Spaced with characters rather than the canvas `letterSpacing` property,
 * which older Safari does not have — there the names would quietly lose the
 * one thing that tells them apart from a street name.
 */
export const tracked = (name: string): string => [...name.toUpperCase()].join(THIN_SPACE);

export interface PlaceCandidate {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly widthPx: number;
  readonly rank: number;
}

/** Half the height of a suburb name, halo included. */
export const PLACE_HALF_HEIGHT_PX = 8;

/**
 * Clear space kept around each name.
 *
 * More than the street names get. Two suburb names that merely touch read as
 * one long name — "DOCKLANDS SOUTH WHARF" — which is a place that does not
 * exist.
 */
export const PLACE_PADDING_PX = 6;

/**
 * Which suburb names to draw: in rank order, dropping any that would collide.
 *
 * A name that would overlap one already placed is left out rather than nudged.
 * Moving a suburb name moves it towards a different suburb, and on this map a
 * name in the wrong place is worse than a name missing. The names that are
 * wholly off the canvas are left out before they can claim any space.
 */
export function placeNames(
  candidates: readonly PlaceCandidate[],
  viewport: Pick<Viewport, 'widthPx' | 'heightPx'>,
): PlaceCandidate[] {
  const placed: PlaceCandidate[] = [];
  const boxes: { left: number; right: number; top: number; bottom: number }[] = [];
  for (const candidate of [...candidates].sort((a, b) => a.rank - b.rank)) {
    const half = candidate.widthPx / 2;
    const box = {
      left: candidate.x - half - PLACE_PADDING_PX,
      right: candidate.x + half + PLACE_PADDING_PX,
      top: candidate.y - PLACE_HALF_HEIGHT_PX - PLACE_PADDING_PX,
      bottom: candidate.y + PLACE_HALF_HEIGHT_PX + PLACE_PADDING_PX,
    };
    const offCanvas =
      candidate.x + half < 0 ||
      candidate.x - half > viewport.widthPx ||
      candidate.y + PLACE_HALF_HEIGHT_PX < 0 ||
      candidate.y - PLACE_HALF_HEIGHT_PX > viewport.heightPx;
    if (offCanvas) continue;
    const collides = boxes.some(
      (other) =>
        box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top,
    );
    if (collides) continue;
    boxes.push(box);
    placed.push(candidate);
  }
  return placed;
}
