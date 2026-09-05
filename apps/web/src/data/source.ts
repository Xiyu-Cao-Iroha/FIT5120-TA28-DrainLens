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

/** The extent this pilot covers. One, and the API takes it as a path segment. */
export const EXTENT = 'kensington';

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
