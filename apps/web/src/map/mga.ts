/**
 * MGA Zone 55 to latitude and longitude, in the browser.
 *
 * Everything this product holds is in metres from an extent's corner, which is
 * the right frame for drawing and the wrong one for telling somebody where to
 * go. A pinned location in a report has to leave here as something a council
 * officer can open in a map, and that means degrees.
 *
 * **A port, not a second implementation.** `pipeline/src/drainlens_pipeline/
 * geo.py` has carried this projection since the first build, and its forward
 * direction agrees with the eastings and northings the City of Melbourne
 * publishes beside latitude and longitude **across all 63,721 address records,
 * to within a millimetre**. These are the same two functions in TypeScript,
 * and the test freezes values taken from that Python so the port inherits the
 * agreement rather than claiming its own.
 *
 * The inverse is Newton on the forward projection, for the reason the Python
 * gives: a second hand-typed series would have its own transcription risks and
 * nothing to check it against.
 */

const A = 6378137.0;
const F = 1 / 298.257222101;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const LON0 = (147.0 * Math.PI) / 180;
const FALSE_EASTING = 500000.0;
const FALSE_NORTHING = 10000000.0;

/** Easting and northing in MGA Zone 55, in metres. */
export interface Mga {
  readonly eastingM: number;
  readonly northingM: number;
}

/** Latitude and longitude in degrees, GDA94. */
export interface Degrees {
  readonly latitude: number;
  readonly longitude: number;
}

/** Project geographic coordinates to MGA Zone 55. */
export function toMga55({ latitude, longitude }: Degrees): Mga {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  const n = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
  const t = Math.tan(lat) ** 2;
  const c = EP2 * Math.cos(lat) ** 2;
  const a = Math.cos(lat) * (lon - LON0);
  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * lat -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * lat) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * lat) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * lat));

  return {
    eastingM:
      FALSE_EASTING +
      K0 *
        n *
        (a +
          ((1 - t + c) * a ** 3) / 6 +
          ((5 - 18 * t + t ** 2 + 72 * c - 58 * EP2) * a ** 5) / 120),
    northingM:
      FALSE_NORTHING +
      K0 *
        (m +
          n *
            Math.tan(lat) *
            (a ** 2 / 2 +
              ((5 - t + 9 * c + 4 * c ** 2) * a ** 4) / 24 +
              ((61 - 58 * t + t ** 2 + 600 * c - 330 * EP2) * a ** 6) / 720)),
  };
}

/** The inverse, to a millimetre. */
export function fromMga55({ eastingM, northingM }: Mga): Degrees {
  // Two or three steps from a flat-earth first guess, which is good to a few
  // hundred metres anywhere inside a zone.
  let latitude = (northingM - FALSE_NORTHING) / 111_320.0;
  let longitude =
    (LON0 * 180) / Math.PI +
    (eastingM - FALSE_EASTING) / (111_320.0 * Math.cos((latitude * Math.PI) / 180) || 1.0);

  const step = 1e-7; // degrees, for the finite-difference Jacobian
  for (let pass = 0; pass < 8; pass += 1) {
    const here = toMga55({ latitude, longitude });
    const de = eastingM - here.eastingM;
    const dn = northingM - here.northingM;
    if (Math.abs(de) < 1e-6 && Math.abs(dn) < 1e-6) break;

    const byLat = toMga55({ latitude: latitude + step, longitude });
    const byLon = toMga55({ latitude, longitude: longitude + step });
    const j11 = (byLat.eastingM - here.eastingM) / step;
    const j21 = (byLat.northingM - here.northingM) / step;
    const j12 = (byLon.eastingM - here.eastingM) / step;
    const j22 = (byLon.northingM - here.northingM) / step;

    const det = j11 * j22 - j12 * j21;
    if (det === 0) throw new Error('the projection is not invertible here');
    latitude += (de * j22 - dn * j12) / det;
    longitude += (dn * j11 - de * j21) / det;
  }

  return { latitude, longitude };
}

/**
 * A map link for a point, as plain text a report can carry.
 *
 * OpenStreetMap because it needs no account and no app, and because a link
 * into somebody's product is a recommendation this project has not made. Six
 * decimal places is about 0.1 m, which is finer than the pin can be placed.
 *
 * **It is written into the reader's own clipboard or printed page, nowhere
 * else.** Nothing here requests it, stores it or sends it (AC 6.3.3).
 */
export function mapLink(at: Mga): string {
  const { latitude, longitude } = fromMga55(at);
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=19/${lat}/${lon}`;
}
