/**
 * What the browser remembers while somebody is using DrainLens, and where it
 * is allowed to keep it.
 *
 * The answer to the second question is: in this object and nowhere else.
 *
 * The architecture holds the address, the chosen task and the scenario inputs
 * in memory for the life of the tab. Not `localStorage`, not `sessionStorage`,
 * not the URL, not `history.state`. That follows from AD1 — the product has no
 * accounts and no identity — and an address written to any of those is an
 * identity, sitting on a shared machine after the person has walked away.
 *
 * The rule here is absolute: **nothing in this file touches storage of any
 * kind.** `session.test.ts` enforces it by running a whole session against
 * traps in place of both storages, `history` and `document.cookie`, rather
 * than by reading the source — a rule checked by grep is a rule that a
 * refactor walks around.
 *
 * A guidance preference would be different in kind. "I have read the help box"
 * says nothing about who or where someone is, and if one is ever wanted it
 * belongs in its own module so that this file's rule stays absolute. Nothing
 * stores such a preference today.
 */

import type {
  BlockageSetting,
  ComparisonBand,
  InsufficiencyReason,
} from '@drainlens/schema';

/** Which screen the person is on. */
export type Screen =
  | 'address'
  | 'task'
  | 'explore'
  | 'scenario'
  | 'result'
  | 'unsupported';

/** The two guided tasks, plus the unguided map. */
export type Task = 'follow' | 'compare' | 'full-map';

export interface SupportedAddress {
  readonly id: string;
  readonly label: string;
  readonly eastingM: number;
  readonly northingM: number;
}

/**
 * Scenario inputs, each independently unset.
 *
 * `blockage` starts `null` rather than defaulting to clear, because AC 2.1.1
 * requires the person to choose it: a pre-selected assumption is one the
 * interface made and the person owns without knowing it.
 */
export interface ScenarioInputs {
  readonly pitId: string | null;
  readonly pitWasSuggested: boolean;
  readonly blockage: BlockageSetting | null;
  readonly rainfallMm: number;
}

export type Outcome =
  | { readonly kind: 'comparison'; readonly band: ComparisonBand }
  | { readonly kind: 'insufficient'; readonly reason: InsufficiencyReason };

export interface Session {
  readonly screen: Screen;
  readonly address: SupportedAddress | null;
  /** What they typed that turned out not to be supported, so the screen can say it back. */
  readonly rejectedAddress: string | null;
  readonly task: Task | null;
  readonly scenario: ScenarioInputs;
  readonly outcome: Outcome | null;
  readonly running: boolean;
}

/** The middle of the three published comparison amounts. */
export const DEFAULT_RAINFALL_MM = 40;

export const EMPTY_SCENARIO: ScenarioInputs = {
  pitId: null,
  pitWasSuggested: false,
  blockage: null,
  rainfallMm: DEFAULT_RAINFALL_MM,
};

export const INITIAL_SESSION: Session = {
  screen: 'address',
  address: null,
  rejectedAddress: null,
  task: null,
  scenario: EMPTY_SCENARIO,
  outcome: null,
  running: false,
};

export type SessionEvent =
  | { readonly type: 'address-accepted'; readonly address: SupportedAddress }
  /**
   * A different address chosen from the map, rather than from the first screen.
   *
   * Separate from `address-accepted` because that one sends the person back to
   * the task question, which is right when they have just arrived and wrong
   * when they are already reading a map -- searching from the map should move
   * the map. Everything else the two do is the same, including dropping a pit
   * that belongs to the old neighbourhood.
   */
  | { readonly type: 'address-moved'; readonly address: SupportedAddress }
  | { readonly type: 'address-rejected'; readonly typed: string }
  | { readonly type: 'task-chosen'; readonly task: Task }
  | { readonly type: 'pit-selected'; readonly pitId: string; readonly suggested: boolean }
  | { readonly type: 'blockage-selected'; readonly blockage: BlockageSetting }
  | { readonly type: 'rainfall-selected'; readonly rainfallMm: number }
  | { readonly type: 'comparison-started' }
  | { readonly type: 'comparison-finished'; readonly outcome: Outcome }
  | { readonly type: 'back' }
  | { readonly type: 'change-address' }
  | { readonly type: 'change-scenario' }
  | { readonly type: 'reset-choices' };

/** Where `back` goes from each screen. */
const BACK: Readonly<Record<Screen, Screen>> = {
  address: 'address',
  task: 'address',
  explore: 'task',
  scenario: 'task',
  result: 'scenario',
  unsupported: 'address',
};

export function reduce(session: Session, event: SessionEvent): Session {
  switch (event.type) {
    case 'address-moved':
      return {
        ...session,
        address: event.address,
        rejectedAddress: null,
        ...(session.address && session.address.id !== event.address.id
          ? {
              scenario: { ...session.scenario, pitId: null, pitWasSuggested: false },
              outcome: null,
            }
          : {}),
      };

    case 'address-accepted':
      return {
        ...session,
        screen: 'task',
        address: event.address,
        rejectedAddress: null,
        // A different address invalidates the pit, which belongs to the old
        // neighbourhood. The rainfall and blockage are the person's own
        // assumptions and survive.
        ...(session.address && session.address.id !== event.address.id
          ? {
              scenario: { ...session.scenario, pitId: null, pitWasSuggested: false },
              outcome: null,
            }
          : {}),
      };

    case 'address-rejected':
      return { ...session, screen: 'unsupported', rejectedAddress: event.typed };

    case 'task-chosen':
      return {
        ...session,
        screen: event.task === 'compare' ? 'scenario' : 'explore',
        task: event.task,
      };

    case 'pit-selected':
      return {
        ...session,
        scenario: { ...session.scenario, pitId: event.pitId, pitWasSuggested: event.suggested },
      };

    case 'blockage-selected':
      return { ...session, scenario: { ...session.scenario, blockage: event.blockage } };

    case 'rainfall-selected':
      return { ...session, scenario: { ...session.scenario, rainfallMm: event.rainfallMm } };

    case 'comparison-started':
      return { ...session, running: true, outcome: null };

    case 'comparison-finished':
      return { ...session, running: false, screen: 'result', outcome: event.outcome };

    case 'back':
      return { ...session, screen: BACK[session.screen] };

    case 'change-address':
      return { ...session, screen: 'address' };

    case 'change-scenario':
      // AC 2.2.4: the inputs are still there when they get back.
      return { ...session, screen: 'scenario' };

    case 'reset-choices':
      return { ...session, scenario: EMPTY_SCENARIO, outcome: null };

    default: {
      /*
       * Unreachable at compile time, and it has to be reachable at runtime.
       *
       * The assignment to `never` keeps the exhaustiveness check: a new event
       * type that nothing handles fails the build here rather than silently
       * doing nothing. The `return session` is for the case the compiler
       * cannot see — a module that is one version behind the one dispatching
       * to it. Without it the switch falls through, returns `undefined`, and
       * React replaces the whole session with nothing: the screen goes blank
       * and the stack points at whoever read `session.screen` first rather
       * than at the action nobody handled.
       *
       * That is not hypothetical. It happened here, with a stale dev-server
       * module serving a reducer that predated the action being dispatched.
       */
      const unhandled: never = event;
      void unhandled;
      return session;
    }
  }
}

/**
 * Whether the comparison can run, and if not, which control is missing.
 *
 * Returned rather than thrown: the setup screen needs to name the missing
 * choice at the control, and a thrown error would only reach a catch block.
 */
export function missingScenarioInput(scenario: ScenarioInputs): 'pit' | 'blockage' | null {
  if (scenario.pitId === null) return 'pit';
  if (scenario.blockage === null) return 'blockage';
  return null;
}

export const canRunComparison = (scenario: ScenarioInputs): boolean =>
  missingScenarioInput(scenario) === null;
