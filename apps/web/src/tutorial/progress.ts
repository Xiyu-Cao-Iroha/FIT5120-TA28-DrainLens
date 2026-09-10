/**
 * Which sections of the guide this device has finished.
 *
 * **This is the second thing DrainLens stores on a visitor's machine, and it
 * is deliberately the same shape as the first.** `tourGate.ts` holds one key
 * with one character; this holds one key with four, one per section in
 * `SECTION_ORDER`, each `'1'` or `'0'`. It carries no address, no identifier,
 * no timestamp and no count of attempts — nothing that could be read back to
 * say who, when, or what they looked at. It says what the page has shown, not
 * who was shown it, which is the line AD1 draws and the same one the tour
 * crossed on 5 September.
 *
 * **The session in memory is authoritative; this is a best-effort mirror.**
 * A store that throws — a private window, blocked site data, some embedded
 * webviews — must not make the guide unusable, so a failed read starts you at
 * nothing learned and a failed write costs you the progress on reload and
 * nothing else. The guide still runs, and the whole map is still reachable
 * through the notice.
 *
 * **A value that is not exactly four `0`/`1` characters reads as nothing
 * learned.** Not as an error, and not as partial credit: a half-parsed
 * progress string is how somebody ends up locked out of a section they
 * finished, and re-watching a two-minute guide is the cheaper failure.
 */

import { NOTHING_LEARNED, SECTION_ORDER, type Learned } from './sections.js';

const KEY = 'drainlens.learned';

/** The browser's store, or null when reading it is not allowed. */
function deviceStore(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    // Accessing the property itself throws when site data is blocked. That is
    // not the same as storage being empty and must not be read as one.
    return null;
  }
}

/** `"1000"` — one character per section, in `SECTION_ORDER`. */
export function encode(learned: Learned): string {
  return SECTION_ORDER.map((id) => (learned[id] ? '1' : '0')).join('');
}

/** The inverse, and the only place a stored value is trusted. */
export function decode(raw: string | null): Learned {
  if (raw === null) return NOTHING_LEARNED;
  if (raw.length !== SECTION_ORDER.length) return NOTHING_LEARNED;
  if (!/^[01]+$/.test(raw)) return NOTHING_LEARNED;

  const learned: Record<string, boolean> = {};
  SECTION_ORDER.forEach((id, index) => {
    learned[id] = raw[index] === '1';
  });
  return learned as Learned;
}

export interface Progress {
  /** What this device has finished, as far as it can be read. */
  readonly read: () => Learned;
  /** Mirror the session's state onto the device. Never throws. */
  readonly write: (learned: Learned) => void;
}

/**
 * A gate over one store. Constructed rather than global so a test can hold its
 * own — including one that throws, which is the case that has no other way of
 * being reached.
 */
export function makeProgress(store: Storage | null = deviceStore()): Progress {
  return {
    read: () => {
      if (!store) return NOTHING_LEARNED;
      try {
        return decode(store.getItem(KEY));
      } catch {
        return NOTHING_LEARNED;
      }
    },

    write: (learned) => {
      if (!store) return;
      try {
        store.setItem(KEY, encode(learned));
      } catch {
        // Full quota, or a store that reads and refuses writes. There is
        // nothing to do about it and nothing to tell the person: the guide
        // they are in the middle of is the same guide either way, and the
        // session in memory already knows what they have finished.
      }
    },
  };
}

/** The one the application uses. */
export const progress = makeProgress();
