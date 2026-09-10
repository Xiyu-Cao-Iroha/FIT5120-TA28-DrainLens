/**
 * Where an artefact comes from: the API over the database, or the copy that
 * ships in the container.
 *
 * **The database is the source, and the bundled file is the floor.** Until
 * now the site was entirely static and therefore could not be broken by
 * anything outside its own container. Reading from a service changes that,
 * and the service in question sits on a Cloud SQL instance that is expected to
 * be *stopped between demonstrations to save money* — so "the API is
 * unavailable" is not a rare failure here, it is a planned state.
 *
 * A site that went blank in that state would be a worse product than the one
 * that did not use its database at all. So each artefact is asked of the API
 * first and falls back to the file beside it, and the interface says which
 * answered. That last part is what keeps this honest: a fallback nobody can
 * see is indistinguishable from an API nobody is using.
 *
 * **The address index is deliberately not here.** It is the one artefact that
 * must never be fetched per-query from anywhere, because the landing page
 * promises a resident that the search runs in their browser and that nothing
 * about the address is sent anywhere. It stays bundled, and `App.tsx` fetches
 * it directly so that no future edit to this file can quietly route it
 * through a server.
 */

/**
 * The extent in the container, and the extent in the database.
 *
 * **They are different, and that is the whole of the expansion.** The database
 * holds `city-of-melbourne` — 21,113 pits over 76.5 km² — and the container
 * ships `kensington`, the square kilometre it has shipped since August. When
 * the API answers, the map is the council; when the Cloud SQL instance is
 * stopped, which is the normal state between demonstrations, the map is the
 * square kilometre and the footer says where it came from.
 *
 * They cannot both be in the database. Kensington is *inside* the council, so
 * its 895 pits are 895 of the same assets with the same `asset_number`, and
 * that is a global primary key: one asset is not two rows in two coordinate
 * frames. Nothing needs them both — see `apps/api/test-db/both.test.ts`.
 */
export const BUNDLED_EXTENT = 'kensington';
export const API_EXTENT = 'city-of-melbourne';

/**
 * The derived layers cover one square kilometre of whichever map is showing.
 *
 * Surface-water paths, low points and the data-quality hatching are calculated
 * from a measured ground surface, and that surface exists for Kensington and
 * nowhere else: 6.6 million points over one square kilometre. Expanding the
 * recorded network did not expand the terrain, and inventing paths across the
 * other 75.5 km² would be exactly the fabrication this product refuses.
 *
 * **They arrive already in the frame of the map they are drawn over**, because
 * `pipeline/reframe.py` moves them at build time. Every artefact's
 * coordinates are metres from its own extent's corner, so Kensington's origin
 * is the council's (1500, 6000) — and Kensington-frame shapes over a
 * council-frame map would land a kilometre and a half west and six kilometres
 * south, silently, looking like a map. Doing it once at build time is why
 * nothing here has to know that two frames exist.
 *
 * What the browser does have to know is that they *cover* less than the map
 * does. The artefact carries a `covers` sentence saying so.
 */
export const DERIVED_COVERS = 'covers';

/**
 * The API's origin, or an empty string for "do not ask a server at all".
 *
 * Empty by default, which is what a developer running `npm run dev` gets: a
 * checkout should not reach across the internet to a production database
 * because somebody opened it. The container sets `VITE_API_BASE` at build time
 * — see the `ARG` in the root `Dockerfile` — so the deployed site does.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/**
 * How long to wait before deciding the API is not going to answer.
 *
 * A stopped Cloud SQL instance does not refuse a connection quickly; the
 * request hangs while Cloud Run waits on a database that is not there. Four
 * seconds is longer than the API's measured p95 by more than an order of
 * magnitude (85 ms for the largest artefact) and short enough that a visitor
 * meets the bundled copy rather than a blank page.
 */
export const API_TIMEOUT_MS = 4000;

export type Origin = 'api' | 'bundled';

export interface Fetched<T> {
  readonly value: T;
  readonly from: Origin;
}

export interface ArtefactRequest<T> {
  /** The API URL, or null to skip the API entirely. */
  readonly api: string | null;
  /** The copy in the container. Always tried if the API does not answer. */
  readonly bundled: string;
  /**
   * The artefact's own guard. It runs on **both** paths and is not relaxed for
   * either: a payload the browser would refuse from a file is refused from the
   * database too, and refusing it is what makes the fallback happen.
   */
  readonly guard: (value: unknown) => void;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  /** Told why the API was not used, so a caller can log or show it. */
  readonly onFallback?: (url: string, reason: string) => void;
}

async function attempt(
  url: string,
  guard: (value: unknown) => void,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<unknown> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`answered ${String(response.status)}`);
  const value: unknown = await response.json();
  guard(value);
  return value;
}

/**
 * Ask the API, and fall back to the bundled copy for any reason at all.
 *
 * Any reason is deliberate. A 500, a timeout, a CORS rejection, a network that
 * is not there, JSON that will not parse, and a payload the guard refuses are
 * all the same fact from a visitor's point of view — the database cannot
 * answer this right now — and treating them differently would mean choosing
 * which failures are allowed to show somebody a broken map.
 *
 * If the bundled copy also fails, this throws. There is nothing left to try
 * and the site cannot draw anything, which is the state `App` already has a
 * screen for.
 */
export async function fetchArtefact<T>(request: ArtefactRequest<T>): Promise<Fetched<T>> {
  const fetchImpl = request.fetchImpl ?? fetch;
  const timeoutMs = request.timeoutMs ?? API_TIMEOUT_MS;

  if (request.api !== null && request.api !== '') {
    try {
      const value = await attempt(request.api, request.guard, fetchImpl, timeoutMs);
      return { value: value as T, from: 'api' };
    } catch (error) {
      request.onFallback?.(request.api, error instanceof Error ? error.message : String(error));
    }
  }

  const value = await attempt(request.bundled, request.guard, fetchImpl, timeoutMs);
  return { value: value as T, from: 'bundled' };
}

/**
 * Fetch a set of artefacts that must agree, and fall back as a set.
 *
 * **`mixed` was harmless until the two extents had different sizes.** The map,
 * the derived layers and the trace describe one place in one coordinate frame:
 * metres from that extent's south-west corner. While both copies were
 * Kensington, an API map beside a bundled derived layer was the same square
 * kilometre either way and nobody could tell. Now the API's map is the council
 * and the container's is the square kilometre, and mixing them draws the water
 * paths a kilometre and a half from the streets they run down — on screen,
 * silently, looking like a map.
 *
 * So the choice is made once for all of them: **every one from the API, or
 * every one from the container.** One artefact refusing is the whole set
 * refusing, which costs a visitor the larger map in a case where they were
 * going to get a wrong one.
 *
 * The flood board is deliberately not in here. It is Greater Melbourne over
 * six financial years, it carries no coordinates, and it cannot disagree with
 * a map about where anything is.
 */
export async function fetchTogether<T extends readonly unknown[]>(
  requests: { readonly [K in keyof T]: ArtefactRequest<T[K]> },
): Promise<{ readonly values: T; readonly from: Origin }> {
  const list = requests as readonly ArtefactRequest<unknown>[];

  if (list.every((r) => r.api !== null && r.api !== '')) {
    try {
      const values = await Promise.all(
        list.map((r) =>
          attempt(
            r.api as string,
            r.guard,
            r.fetchImpl ?? fetch,
            r.timeoutMs ?? API_TIMEOUT_MS,
          ),
        ),
      );
      return { values: values as unknown as T, from: 'api' };
    } catch (error) {
      // Reported once for the set rather than once per artefact: they failed
      // as a set, and three lines in a console would suggest three faults.
      const why = error instanceof Error ? error.message : String(error);
      list[0]?.onFallback?.('the API', why);
    }
  }

  const values = await Promise.all(
    list.map((r) => attempt(r.bundled, r.guard, r.fetchImpl ?? fetch, r.timeoutMs ?? API_TIMEOUT_MS)),
  );
  return { values: values as unknown as T, from: 'bundled' };
}

/**
 * One word for where a screenful of artefacts came from.
 *
 * `mixed` is a real state and not a rounding error: the API can answer three
 * requests and time out on the fourth. Reporting that as "the database" would
 * be a claim about data that did not come from it.
 */
export function served(origins: readonly Origin[]): Origin | 'mixed' {
  if (origins.length === 0) return 'bundled';
  const first = origins[0];
  if (first === undefined) return 'bundled';
  return origins.every((o) => o === first) ? first : 'mixed';
}
