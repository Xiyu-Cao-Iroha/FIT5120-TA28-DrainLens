import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_RAINFALL_MM,
  EMPTY_SCENARIO,
  INITIAL_SESSION,
  type Session,
  type SessionEvent,
  type SupportedAddress,
  canRunComparison,
  missingScenarioInput,
  reduce,
} from './session.js';

const GATEHOUSE: SupportedAddress = {
  id: 'kensington/46-gatehouse-drive',
  label: '46 Gatehouse Drive, Kensington',
  eastingM: 316_820,
  northingM: 5_815_140,
};

const NEALE: SupportedAddress = {
  id: 'kensington/13-neale-street',
  label: '13 Neale Street, Kensington',
  eastingM: 316_640,
  northingM: 5_814_980,
};

const play = (events: readonly SessionEvent[], from: Session = INITIAL_SESSION): Session =>
  events.reduce(reduce, from);

describe('the golden path', () => {
  it('runs address to result without leaving anything unset', () => {
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'compare' },
      { type: 'pit-selected', pitId: 'P-14', suggested: false },
      { type: 'blockage-selected', blockage: 'fully-blocked' },
      { type: 'rainfall-selected', rainfallMm: 40 },
      { type: 'comparison-started' },
      { type: 'comparison-finished', outcome: { kind: 'comparison', band: 'higher-than-baseline' } },
    ]);

    expect(end.screen).toBe('result');
    expect(end.address).toBe(GATEHOUSE);
    expect(end.running).toBe(false);
    expect(end.outcome).toEqual({ kind: 'comparison', band: 'higher-than-baseline' });
  });

  it('starts on a page that asks nothing, with nothing chosen', () => {
    // The address field was the first screen until a homepage was added. It
    // is the right first *question* once somebody has decided to use this,
    // and the wrong one before: it asks a stranger to type where they live in
    // order to find out what the site does.
    expect(INITIAL_SESSION.screen).toBe('home');
    expect(INITIAL_SESSION.address).toBeNull();
    expect(INITIAL_SESSION.task).toBeNull();
    expect(INITIAL_SESSION.outcome).toBeNull();
  });

  it('sends the follow task to the map and the compare task to the setup', () => {
    const after = (task: 'follow' | 'compare' | 'full-map') =>
      play([{ type: 'address-accepted', address: GATEHOUSE }, { type: 'task-chosen', task }]).screen;

    expect(after('compare')).toBe('scenario');
    expect(after('follow')).toBe('explore');
    expect(after('full-map')).toBe('explore');
  });
});

describe('scenario inputs', () => {
  it('leaves the blockage unchosen rather than assuming one', () => {
    // AC 2.1.1 (Aug-27 set). A pre-selected assumption is one the interface made and the
    // person carries without ever having agreed to it.
    expect(EMPTY_SCENARIO.blockage).toBeNull();
    expect(canRunComparison(EMPTY_SCENARIO)).toBe(false);
  });

  it('opens on the middle published comparison amount', () => {
    expect(EMPTY_SCENARIO.rainfallMm).toBe(DEFAULT_RAINFALL_MM);
  });

  it('names the missing control in the order the setup asks for them', () => {
    expect(missingScenarioInput(EMPTY_SCENARIO)).toBe('pit');
    expect(missingScenarioInput({ ...EMPTY_SCENARIO, pitId: 'P-14' })).toBe('blockage');
    expect(
      missingScenarioInput({ ...EMPTY_SCENARIO, pitId: 'P-14', blockage: 'clear' }),
    ).toBeNull();
  });

  it('remembers whether the pit was suggested or actually chosen', () => {
    // The setup screen has to say "this is a suggested nearby drain, not your
    // choice yet", and it cannot say that if the two look the same in state.
    const suggested = play([{ type: 'pit-selected', pitId: 'P-14', suggested: true }]);
    const chosen = play([{ type: 'pit-selected', pitId: 'P-14', suggested: false }]);
    expect(suggested.scenario.pitWasSuggested).toBe(true);
    expect(chosen.scenario.pitWasSuggested).toBe(false);
  });

  it('keeps the inputs when the person goes back to change the scenario', () => {
    // AC 2.2.4 (Aug-27 set).
    const end = play([
      { type: 'pit-selected', pitId: 'P-14', suggested: false },
      { type: 'blockage-selected', blockage: 'partly-blocked' },
      { type: 'rainfall-selected', rainfallMm: 60 },
      { type: 'comparison-finished', outcome: { kind: 'comparison', band: 'no-clear-change' } },
      { type: 'change-scenario' },
    ]);

    expect(end.screen).toBe('scenario');
    expect(end.scenario).toEqual({
      pitId: 'P-14',
      pitWasSuggested: false,
      blockage: 'partly-blocked',
      rainfallMm: 60,
    });
  });

  it('clears everything on reset, including a result that no longer describes the inputs', () => {
    const end = play([
      { type: 'pit-selected', pitId: 'P-14', suggested: false },
      { type: 'blockage-selected', blockage: 'clear' },
      { type: 'comparison-finished', outcome: { kind: 'comparison', band: 'no-clear-change' } },
      { type: 'reset-choices' },
    ]);
    expect(end.scenario).toEqual(EMPTY_SCENARIO);
    expect(end.outcome).toBeNull();
  });
});

describe('changing the address', () => {
  it('drops the pit, which belonged to the old neighbourhood', () => {
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'pit-selected', pitId: 'P-14', suggested: true },
      { type: 'blockage-selected', blockage: 'fully-blocked' },
      { type: 'rainfall-selected', rainfallMm: 60 },
      { type: 'address-accepted', address: NEALE },
    ]);

    expect(end.scenario.pitId).toBeNull();
    expect(end.scenario.pitWasSuggested).toBe(false);
    expect(end.outcome).toBeNull();
  });

  it('keeps the assumptions, which were the person’s and not the map’s', () => {
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'blockage-selected', blockage: 'fully-blocked' },
      { type: 'rainfall-selected', rainfallMm: 60 },
      { type: 'address-accepted', address: NEALE },
    ]);

    expect(end.scenario.blockage).toBe('fully-blocked');
    expect(end.scenario.rainfallMm).toBe(60);
  });

  it('leaves everything alone when the same address is re-entered', () => {
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'pit-selected', pitId: 'P-14', suggested: false },
      { type: 'address-accepted', address: GATEHOUSE },
    ]);
    expect(end.scenario.pitId).toBe('P-14');
  });

  it('says an unsupported address back rather than guessing at one', () => {
    // AC 1.1.8: explain, do not fabricate.
    const end = play([{ type: 'address-rejected', typed: '1 Example Road, Outside Pilot' }]);
    expect(end.screen).toBe('unsupported');
    expect(end.rejectedAddress).toBe('1 Example Road, Outside Pilot');
    expect(end.address).toBeNull();
  });

  it('forgets the rejection once a supported address is accepted', () => {
    const end = play([
      { type: 'address-rejected', typed: 'somewhere else' },
      { type: 'address-accepted', address: GATEHOUSE },
    ]);
    expect(end.rejectedAddress).toBeNull();
  });
});

describe('going back', () => {
  it.each([
    ['task', 'address'],
    ['explore', 'task'],
    ['scenario', 'task'],
    ['result', 'scenario'],
    ['unsupported', 'address'],
  ] as const)('from %s returns to %s', (from, to) => {
    expect(reduce({ ...INITIAL_SESSION, screen: from }, { type: 'back' }).screen).toBe(to);
  });

  it('has nowhere to go from the first screen', () => {
    const first = INITIAL_SESSION.screen;
    expect(reduce(INITIAL_SESSION, { type: 'back' }).screen).toBe(first);
  });

  it('goes back from the address field to the homepage, not to itself', () => {
    // Somebody who opened the address field to look at it needs a way out
    // that is not the browser button.
    const asked = reduce(INITIAL_SESSION, { type: 'change-address' });
    expect(asked.screen).toBe('address');
    expect(reduce(asked, { type: 'back' }).screen).toBe('home');
  });
});

describe('the insufficient-information outcome', () => {
  it('is a different kind of thing from a comparison band', () => {
    // The distinction the architecture insists on: "no clear change" is an
    // answer, "insufficient information" is the absence of one. A single
    // string field for both is how they get confused.
    const end = play([
      { type: 'comparison-finished', outcome: { kind: 'insufficient', reason: 'terrain_unavailable' } },
    ]);

    expect(end.outcome).toEqual({ kind: 'insufficient', reason: 'terrain_unavailable' });
    expect(end.screen).toBe('result');
  });

  it('carries the reason, because the four of them need different words and actions', () => {
    const reasons = [
      'terrain_unavailable',
      'invalid_inlet',
      'scenario_calculation_failed',
      'comparison_not_comparable',
    ] as const;

    for (const reason of reasons) {
      const end = play([{ type: 'comparison-finished', outcome: { kind: 'insufficient', reason } }]);
      expect(end.outcome).toEqual({ kind: 'insufficient', reason });
    }
  });
});

describe('nothing about the person leaves memory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Traps in place of the real storage, so a write is caught rather than looked for. */
  function trapStorage() {
    const writes: string[] = [];
    const trap = (name: string): Storage =>
      ({
        getItem: vi.fn(() => null),
        setItem: vi.fn((key: string) => {
          writes.push(`${name}.setItem(${key})`);
          return undefined;
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(() => null),
        length: 0,
      }) as unknown as Storage;

    vi.stubGlobal('localStorage', trap('localStorage'));
    vi.stubGlobal('sessionStorage', trap('sessionStorage'));
    vi.stubGlobal('history', {
      pushState: vi.fn((_: unknown, __: string, url?: string) => {
        writes.push(`history.pushState(${String(url)})`);
      }),
      replaceState: vi.fn((_: unknown, __: string, url?: string) => {
        writes.push(`history.replaceState(${String(url)})`);
      }),
      state: null,
    });
    vi.stubGlobal('document', {
      get cookie() {
        return '';
      },
      set cookie(value: string) {
        writes.push(`document.cookie(${value})`);
      },
    });
    return writes;
  }

  const wholeSession: readonly SessionEvent[] = [
    { type: 'address-rejected', typed: '1 Example Road, Outside Pilot' },
    { type: 'address-accepted', address: GATEHOUSE },
    { type: 'task-chosen', task: 'compare' },
    { type: 'pit-selected', pitId: 'P-14', suggested: true },
    { type: 'blockage-selected', blockage: 'fully-blocked' },
    { type: 'rainfall-selected', rainfallMm: 60 },
    { type: 'comparison-started' },
    { type: 'comparison-finished', outcome: { kind: 'comparison', band: 'higher-than-baseline' } },
    { type: 'change-scenario' },
    { type: 'back' },
    { type: 'change-address' },
    { type: 'address-accepted', address: NEALE },
    { type: 'reset-choices' },
  ];

  it('writes to no storage, no history entry and no cookie across a whole session', () => {
    const writes = trapStorage();
    play(wholeSession);
    expect(writes).toEqual([]);
  });

  it('would notice if it did', () => {
    // A guard nobody has seen fail is a guard nobody should trust.
    const writes = trapStorage();
    globalThis.localStorage.setItem('drainlens-address', GATEHOUSE.label);
    expect(writes).toEqual(['localStorage.setItem(drainlens-address)']);
  });

  it('holds the address only on the object the caller can drop', () => {
    // The whole mechanism: close the tab and the state is gone, because there
    // was never a copy of it anywhere else.
    const end = play(wholeSession);
    expect(end.address).toBe(NEALE);
    expect(JSON.stringify(INITIAL_SESSION)).not.toContain('Neale');
  });
});

describe('searching from the map', () => {
  it('moves the map instead of sending the person back to the task question', () => {
    // The distinction the two actions exist for. `address-accepted` is what
    // the first screen sends and it goes on to ask what you want to do;
    // searching while already reading a map should leave you reading a map.
    const reading = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
    ]);
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
      { type: 'address-moved', address: NEALE },
    ]);

    // Whatever screen they were on, they are still on it -- and in particular
    // not back at the task question, which is where `address-accepted` goes.
    expect(end.screen).toBe(reading.screen);
    expect(end.screen).not.toBe('task');
    expect(end.address).toEqual(NEALE);
  });

  it('still drops a pit that belonged to the old neighbourhood', () => {
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
      { type: 'pit-selected', pitId: 'P-14', suggested: true },
      { type: 'address-moved', address: NEALE },
    ]);

    expect(end.scenario.pitId).toBeNull();
    expect(end.outcome).toBeNull();
  });

  it('keeps the assumptions, which were the person’s and not the map’s', () => {
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
      { type: 'blockage-selected', blockage: 'fully-blocked' },
      { type: 'rainfall-selected', rainfallMm: 60 },
      { type: 'address-moved', address: NEALE },
    ]);

    expect(end.scenario.blockage).toBe('fully-blocked');
    expect(end.scenario.rainfallMm).toBe(60);
  });

  it('keeps everything when the same address is chosen again', () => {
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
      { type: 'pit-selected', pitId: 'P-14', suggested: false },
      { type: 'address-moved', address: GATEHOUSE },
    ]);

    expect(end.scenario.pitId).toBe('P-14');
  });
});

describe('an action the reducer does not know', () => {
  it('leaves the session untouched instead of erasing it', () => {
    // The compiler makes this unreachable, which is why the cast is needed to
    // reach it. It is reachable in a browser: a module one version behind the
    // one dispatching to it sends an action this build has never heard of.
    // Falling through used to return `undefined`, which React accepted as the
    // new session and which blanked the entire screen.
    const start = play([{ type: 'address-accepted', address: GATEHOUSE }]);
    const after = reduce(start, { type: 'from-the-future' } as unknown as SessionEvent);

    expect(after).toBe(start);
    expect(after.screen).toBe(start.screen);
  });
});

describe('opening the map from the homepage', () => {
  it('goes straight there without asking for an address first', () => {
    const end = reduce(INITIAL_SESSION, { type: 'map-opened' });

    expect(end.screen).toBe('explore');
    // No address is invented on the way. The map opens over the pilot area
    // with nothing selected, and the search along its top is how somebody
    // names one — a guessed address would put a marker on a street nobody
    // asked about.
    expect(end.address).toBeNull();
  });

  it('opens unguided, because nobody chose a task on the way in', () => {
    expect(reduce(INITIAL_SESSION, { type: 'map-opened' }).task).toBe('full-map');
  });

  it('keeps whatever the person had already chosen', () => {
    const busy = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'blockage-selected', blockage: 'fully-blocked' },
      { type: 'go-home' },
    ]);
    const end = reduce(busy, { type: 'map-opened' });

    expect(end.address).toEqual(GATEHOUSE);
    expect(end.scenario.blockage).toBe('fully-blocked');
  });

  it('carries the mode the card named — AC 1.1.2', () => {
    expect(reduce(INITIAL_SESSION, { type: 'map-opened', mode: 'water-flow' }).mapMode).toBe(
      'water-flow',
    );
  });

  it('names no mode when the way in did not', () => {
    expect(reduce(INITIAL_SESSION, { type: 'map-opened' }).mapMode).toBeNull();
  });

  it('replaces the mode rather than keeping the previous card’s', () => {
    const again = play([
      { type: 'map-opened', mode: 'terrain' },
      { type: 'go-home' },
      { type: 'map-opened', mode: 'low-areas' },
    ]);

    expect(again.mapMode).toBe('low-areas');
  });

  it('opens the flood history without taking an address to it', () => {
    const busy = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'go-home' },
    ]);
    const end = reduce(busy, { type: 'history-opened' });

    expect(end.screen).toBe('history');
    // The board is about six years of recorded incidents across Greater
    // Melbourne. Clearing the address would lose the person's work; using it
    // would imply the board says something about their street, which is the
    // reading the page exists to prevent. So it is carried and not consulted.
    expect(end.address).toEqual(GATEHOUSE);
  });

  it('remembers which page opened the map, and goes back to it — AC 1.1.10', () => {
    // Two ways in, so a Back that always went home would be right half the
    // time and silently wrong the other half.
    const viaHome = play([{ type: 'map-opened', from: 'home' }, { type: 'leave-map' }]);
    expect(viaHome.screen).toBe('home');

    const viaBoard = play([
      { type: 'history-opened' },
      { type: 'map-opened', from: 'history' },
      { type: 'leave-map' },
    ]);
    expect(viaBoard.screen).toBe('history');
  });

  it('treats an unnamed origin as the homepage', () => {
    expect(play([{ type: 'map-opened' }, { type: 'leave-map' }]).screen).toBe('home');
  });

  it('replaces the origin rather than keeping the first one', () => {
    const end = play([
      { type: 'history-opened' },
      { type: 'map-opened', from: 'history' },
      { type: 'leave-map' },
      { type: 'go-home' },
      { type: 'map-opened', from: 'home' },
      { type: 'leave-map' },
    ]);
    expect(end.screen).toBe('home');
  });

  it('goes back from the flood history to the homepage it was opened from', () => {
    const end = play([{ type: 'history-opened' }, { type: 'back' }]);
    expect(end.screen).toBe('home');
  });

  it('forgets the mode when a task is chosen instead', () => {
    // The other way into the map. A mode left over from an earlier trip
    // through the homepage would override the task's own defaults, and the
    // person would be looking at the answer to a question they left behind.
    const viaTask = play([
      { type: 'map-opened', mode: 'terrain' },
      { type: 'go-home' },
      { type: 'change-address' },
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
    ]);

    expect(viaTask.screen).toBe('explore');
    expect(viaTask.mapMode).toBeNull();
  });
});
