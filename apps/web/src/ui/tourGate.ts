/**
 * Whether this device has been shown the tour.
 *
 * **This is the one thing DrainLens stores on a visitor's machine, and it was
 * deliberately not stored until now.** The original decision — written where
 * the tour's button is defined — was that a product whose position is that it
 * holds nothing about you should not begin by writing a fact about you in
 * order to be helpful. That decision was reversed on purpose: a first-time
 * visitor should not have to discover a button to be told what the map is,
 * and a tour that reopens on every visit is a worse imposition than a single
 * boolean.
 *
 * What the key holds is the whole of what it holds: `"1"`. It says that
 * somebody, on this browser, has been shown the tour once. It carries no
 * address, no identifier, no timestamp and no count — nothing that could be
 * read back to say who, when, or what they looked at. Everything AD1 is about
 * is still true, and the address rule in `INTERFACE-CONTRACT.md` is untouched:
 * `session.ts` still writes to nothing at all.
 *
 * **It also keeps an in-tab memory, which is not redundancy.** Some browsers
 * throw on `localStorage` rather than returning null — site data blocked,
 * some embedded webviews — and a gate that could only remember through
 * storage would reopen the tour every time somebody re-entered the map in
 * that session. The in-memory flag makes the worst case "once per tab"
 * instead of "every time".
 */

const KEY = 'drainlens.tour.seen';
const SEEN = '1';

/** The browser's store, or null when reading it is not allowed. */
function deviceStore(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    // Accessing the property itself throws when site data is blocked. This is
    // not the same as storage being empty, and it must not be read as one.
    return null;
  }
}

export interface TourGate {
  /** Has the tour been shown before, on this device or in this tab? */
  readonly seen: () => boolean;
  /** Record that it has been. Called when the tour opens, not when it ends. */
  readonly remember: () => void;
}

/**
 * A gate over one store. Constructed rather than global so a test can hold its
 * own — including one that throws, which is the case that has no other way of
 * being reached.
 */
export function makeTourGate(store: Storage | null = deviceStore()): TourGate {
  let seenThisTab = false;

  return {
    seen: () => {
      if (seenThisTab) return true;
      if (!store) return false;
      try {
        return store.getItem(KEY) === SEEN;
      } catch {
        // Unreadable is treated as "not seen" rather than "seen": showing the
        // tour to somebody who has had it is a small cost, and withholding it
        // from somebody who has not is the failure this exists to prevent.
        return false;
      }
    },

    remember: () => {
      // In memory first, so the tab is covered even when the write fails.
      seenThisTab = true;
      if (!store) return;
      try {
        store.setItem(KEY, SEEN);
      } catch {
        // Full quota, or a store that accepts reads and refuses writes. There
        // is nothing to do about it and nothing to tell the person: the tour
        // they are about to see is the same tour either way.
      }
    },
  };
}

/** The one the application uses. */
export const tourGate = makeTourGate();
