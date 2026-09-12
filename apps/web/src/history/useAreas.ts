/**
 * The flood map's artefacts, loaded when the map is opened and not before.
 *
 * Three files, 83 KB between them, for a screen most visits never reach. That
 * is small beside the scenario scene's five megabytes, and it is the same
 * argument: the homepage should not pay for a page nobody asked for. `scene/`
 * was moved behind its own screen for exactly this reason, and adding 83 KB to
 * every first visit would be un-learning it one directory over.
 *
 * **Bundled only, deliberately for now.** The API serves the board but has no
 * route for these yet, so there is nothing to fall back *from*; wiring them
 * through `fetchArtefact` would produce a footer claiming a source that was
 * never asked. When the routes exist this is where that changes, and the
 * guards are already the ones the API's responses would have to satisfy.
 */

import { useEffect, useState } from 'react';

import {
  type MapArea,
  type PointsArtefact,
  type PopulationArtefact,
  type ScopeAreas,
  assertPoints,
  assertPopulation,
  assertScopeAreas,
  joinAreas,
} from './severity.js';

export interface AreaData {
  readonly areas: readonly MapArea[];
  readonly scope: ScopeAreas;
  readonly population: PopulationArtefact;
  readonly points: PointsArtefact;
}

export interface AreaLoad {
  readonly data: AreaData | null;
  /** The sentence to show instead of a map, or null while all is well. */
  readonly problem: string | null;
}

/** Fetch, check and join the three. Exported so it can be tested without React. */
export async function loadAreas(
  get: (url: string) => Promise<unknown> = async (url) => (await fetch(url)).json(),
): Promise<AreaData> {
  const [scope, population, points] = await Promise.all([
    get('/data/sa2-areas.json'),
    get('/data/population.json'),
    get('/data/sa2-points.json'),
  ]);
  assertScopeAreas(scope);
  assertPopulation(population);
  assertPoints(points);
  // The join refuses rather than dropping: an area missing from the map is
  // indistinguishable from an area with nothing recorded in it.
  return { areas: joinAreas(scope, population, points), scope, population, points };
}

export function useAreas(enabled: boolean): AreaLoad {
  const [data, setData] = useState<AreaData | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || data !== null) return;
    let live = true;
    loadAreas().then(
      (loaded) => {
        if (live) setData(loaded);
      },
      (error: unknown) => {
        // Named, not swallowed. The guards say which field is wrong and that
        // sentence is more use on screen than "something went wrong".
        if (live) setProblem(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      live = false;
    };
  }, [enabled, data]);

  return { data, problem };
}
