/**
 * The shape of the map-geometry artefact, as `drainlens_pipeline.network`
 * writes it.
 *
 * Coordinates are metres east and north of the extent's south-west corner, to
 * a decimetre. There is no projection in this application and there must not
 * be one: the pipeline did that work, and a second transform here would be a
 * second place for the map and the model to disagree about where a pit is.
 */

import type { Local } from './viewport.js';

export type LayerKind = 'road' | 'pipe' | 'pit' | 'street-name';

interface Shape<G extends string, C> {
  readonly g: G;
  readonly c: C;
}

export type PointFeature = Shape<'point', Local>;
export type LineFeature = Shape<'line', readonly Local[]>;
export type PolygonFeature = Shape<'polygon', readonly (readonly Local[])[]>;

export type Pit = PointFeature & {
  readonly asset_number?: number;
  readonly asset_description?: string;
  readonly object_type_lupvalue?: string;
};

export type Pipe = LineFeature & {
  readonly ref?: number;
  readonly upstr_pit?: number;
  readonly dnstr_pit?: number;
  readonly diameter?: number;
  readonly material?: string;
};

export type Road = PolygonFeature & {
  readonly str_type?: string;
  readonly seg_descr?: string;
};

export type StreetName = LineFeature & {
  readonly name?: string;
  readonly maplabel?: string;
};

export interface MapSource {
  readonly layer: LayerKind;
  readonly dataset_id: string;
  readonly publisher: string;
  readonly licence: string;
  readonly last_modified: string;
  readonly features: number;
}

export interface MapArtefact {
  readonly artefact: 'map-geometry';
  readonly version: number;
  readonly extent: {
    readonly name: string;
    readonly min_e: number;
    readonly min_n: number;
    readonly width_m: number;
    readonly height_m: number;
  };
  readonly coordinates: string;
  readonly crs: string;
  readonly sources: readonly MapSource[];
  readonly layers: {
    readonly road?: readonly Road[];
    readonly pipe?: readonly Pipe[];
    readonly pit?: readonly Pit[];
    readonly 'street-name'?: readonly StreetName[];
  };
}

export class ArtefactError extends Error {}

/**
 * Check an artefact before anything draws it.
 *
 * A map that silently renders half a layer is worse than one that refuses to
 * open: the person cannot tell that a pit is missing, and neither can we.
 */
export function assertUsable(value: unknown): asserts value is MapArtefact {
  const artefact = value as Partial<MapArtefact> | null;
  if (!artefact || typeof artefact !== 'object') {
    throw new ArtefactError('the map artefact is not an object');
  }
  if (artefact.artefact !== 'map-geometry') {
    throw new ArtefactError(
      `expected a map-geometry artefact, got ${String(artefact.artefact)}`,
    );
  }
  const extent = artefact.extent;
  if (!extent || !(extent.width_m > 0) || !(extent.height_m > 0)) {
    throw new ArtefactError('the artefact declares an extent with no area');
  }
  if (!artefact.layers || typeof artefact.layers !== 'object') {
    throw new ArtefactError('the artefact carries no layers');
  }
  if (!Array.isArray(artefact.sources) || artefact.sources.length === 0) {
    // §5.5: nothing is displayed without a basis. An artefact that cannot say
    // where its contents came from cannot be put on screen.
    throw new ArtefactError('the artefact names no sources, so nothing in it can be attributed');
  }
}

export const boundsOf = (artefact: MapArtefact) => ({
  widthM: artefact.extent.width_m,
  heightM: artefact.extent.height_m,
});
