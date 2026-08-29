/**
 * The transform between the map's own frame and the canvas.
 *
 * The pipeline ships geometry as **metres east and north of the extent's
 * south-west corner**, so the whole of the projection problem was solved at
 * build time and what is left here is an affine transform: a scale in pixels
 * per metre and a centre.
 *
 * The one thing to get right is the vertical. Northing increases towards the
 * top of the map; a canvas `y` increases towards the bottom. The sign flip
 * lives in `toScreen` and `toLocal` and nowhere else, because a second copy of
 * it is how a map ends up mirrored in one layer and not another — and a
 * mirrored map is a map that renders, pans, and points at the wrong house.
 */

/** A point in the map's own frame: metres east, metres north, from the corner. */
export type Local = readonly [east: number, north: number];

/** A point on the canvas: pixels right, pixels down, from the top-left. */
export type Screen = readonly [x: number, y: number];

export interface Bounds {
  readonly widthM: number;
  readonly heightM: number;
}

export interface Viewport {
  readonly widthPx: number;
  readonly heightPx: number;
  /** Pixels per metre. */
  readonly scale: number;
  /** The local point at the centre of the canvas. */
  readonly centre: Local;
}

/**
 * How far past a full-extent view the person may zoom.
 *
 * At one metre per pixel the artefacts are at their native resolution and
 * anything further is enlargement, not detail. A little is useful for tapping
 * a pit on a phone; a lot invites reading precision into a surface whose
 * source is quoted at 25 cm.
 */
export const MAX_SCALE = 4;

export class ViewportError extends Error {}

export function toScreen(viewport: Viewport, point: Local): Screen {
  const [east, north] = point;
  const [centreE, centreN] = viewport.centre;
  return [
    viewport.widthPx / 2 + (east - centreE) * viewport.scale,
    // Northing up, canvas y down. The only minus sign in the file.
    viewport.heightPx / 2 - (north - centreN) * viewport.scale,
  ];
}

export function toLocal(viewport: Viewport, point: Screen): Local {
  const [x, y] = point;
  const [centreE, centreN] = viewport.centre;
  return [
    centreE + (x - viewport.widthPx / 2) / viewport.scale,
    centreN - (y - viewport.heightPx / 2) / viewport.scale,
  ];
}

/** The smallest scale that still fills the canvas with map. */
export function scaleToCover(widthPx: number, heightPx: number, bounds: Bounds): number {
  if (widthPx <= 0 || heightPx <= 0) {
    throw new ViewportError('a canvas with no area has no viewport');
  }
  if (bounds.widthM <= 0 || bounds.heightM <= 0) {
    throw new ViewportError('an extent with no area has no viewport');
  }
  return Math.max(widthPx / bounds.widthM, heightPx / bounds.heightM);
}

/** The whole extent, centred, filling the canvas. */
export function fit(widthPx: number, heightPx: number, bounds: Bounds): Viewport {
  return {
    widthPx,
    heightPx,
    scale: scaleToCover(widthPx, heightPx, bounds),
    centre: [bounds.widthM / 2, bounds.heightM / 2],
  };
}

/**
 * Pixels per metre the guided view opens at.
 *
 * AC 1.1.2 asks for a *local* map. At the scale that fits the whole extent a
 * house is one dot in a square kilometre, which answers "where is my address"
 * with "somewhere in Kensington". Three pixels per metre puts roughly 300 m
 * across a laptop pane — a few blocks, which is the distance the question
 * "where does water near me go" is actually about.
 */
export const LOCAL_SCALE = 3;

/**
 * The whole extent, centred on `at`, at `scale`.
 *
 * Clamped, so asking to centre on an address near the boundary moves the view
 * as far as it can and no further rather than opening onto blank ground
 * outside the pilot area. At a scale that fits the extent this is `fit` — the
 * clamp pins the centre — which is what the full-map task wants: the marker
 * still marks, and the map still shows everything.
 */
export function focus(
  widthPx: number,
  heightPx: number,
  bounds: Bounds,
  at: Local,
  scale: number = LOCAL_SCALE,
): Viewport {
  const smallest = scaleToCover(widthPx, heightPx, bounds);
  return clamp(
    {
      widthPx,
      heightPx,
      scale: Math.min(Math.max(scale, smallest), MAX_SCALE),
      centre: at,
    },
    bounds,
  );
}

export const pan = (viewport: Viewport, dxPx: number, dyPx: number): Viewport => ({
  ...viewport,
  centre: [
    viewport.centre[0] - dxPx / viewport.scale,
    // Dragging the map down moves the view north.
    viewport.centre[1] + dyPx / viewport.scale,
  ],
});

/**
 * Zoom while holding one screen point still.
 *
 * Anchoring on the cursor is what makes a wheel or a pinch feel like the map
 * rather than the window is moving. Zooming about the centre instead leaves
 * whatever the person was looking at somewhere else afterwards.
 */
export function zoomAt(
  viewport: Viewport,
  factor: number,
  anchor: Screen,
  bounds: Bounds,
): Viewport {
  if (!(factor > 0)) throw new ViewportError('a zoom factor must be positive');

  const held = toLocal(viewport, anchor);
  const floor = scaleToCover(viewport.widthPx, viewport.heightPx, bounds);
  const scale = Math.min(Math.max(viewport.scale * factor, floor), MAX_SCALE);

  const zoomed: Viewport = { ...viewport, scale };
  const movedTo = toLocal(zoomed, anchor);
  return {
    ...zoomed,
    centre: [
      zoomed.centre[0] + (held[0] - movedTo[0]),
      zoomed.centre[1] + (held[1] - movedTo[1]),
    ],
  };
}

/**
 * Keep the canvas full of map.
 *
 * Panning to the edge and finding blank space reads as a broken map, and here
 * it would be worse than that: the blank is outside the pilot area, which the
 * product is careful never to imply it knows anything about.
 */
export function clamp(viewport: Viewport, bounds: Bounds): Viewport {
  const halfWidthM = viewport.widthPx / 2 / viewport.scale;
  const halfHeightM = viewport.heightPx / 2 / viewport.scale;

  const clampAxis = (value: number, halfSpanM: number, extentM: number): number =>
    halfSpanM * 2 >= extentM
      ? extentM / 2 // the canvas is wider than the map, so centre it
      : Math.min(Math.max(value, halfSpanM), extentM - halfSpanM);

  return {
    ...viewport,
    centre: [
      clampAxis(viewport.centre[0], halfWidthM, bounds.widthM),
      clampAxis(viewport.centre[1], halfHeightM, bounds.heightM),
    ],
  };
}

/** The map rectangle currently on screen, for skipping what cannot be seen. */
export function visibleBounds(viewport: Viewport): {
  minE: number;
  minN: number;
  maxE: number;
  maxN: number;
} {
  const [minE, maxN] = toLocal(viewport, [0, 0]);
  const [maxE, minN] = toLocal(viewport, [viewport.widthPx, viewport.heightPx]);
  return { minE, minN, maxE, maxN };
}
