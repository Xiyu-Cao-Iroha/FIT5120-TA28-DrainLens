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
import { SECTION_ORDER, allLearned, countLearned } from './tutorial/sections.js';

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

  it('leaves the address screen for the chooser when a guide sent you there', () => {
    /*
     * The address screen was the one screen in the guided path with no way
     * out on it -- no Back, no Home, only the browser's own button. It has
     * both now, and *where* Back goes is decided here rather than in the
     * view: a pending guide section is exactly what says the chooser asked
     * for the address, and having the view read that would put the rule in
     * two places.
     */
    const chosen = play([{ type: 'get-started' }, { type: 'guide-chosen', section: 'drainage' }]);
    expect(chosen.screen).toBe('address');
    expect(reduce(chosen, { type: 'address-abandoned' }).screen).toBe('choose');
  });

  it('leaves it for the homepage when nothing was waiting for the address', () => {
    const asked = reduce(INITIAL_SESSION, { type: 'change-address' });
    expect(reduce(asked, { type: 'address-abandoned' }).screen).toBe('home');
  });

  it('asks for the address once, not once per section', () => {
    /*
     * It asked every time, which was invisible while there was one lesson and
     * became a toll gate the moment there were three: finish drainage, come
     * back to the four, pick water flow, and be asked for the address you gave
     * ninety seconds ago. Found by walking the second lesson, not by a test.
     */
    const first = play([{ type: 'get-started' }, { type: 'guide-chosen', section: 'drainage' }]);
    expect(first.screen).toBe('address');

    const withAddress = reduce(first, { type: 'address-accepted', address: GATEHOUSE });
    expect(withAddress.screen).toBe('guide');

    const second = reduce(
      reduce(withAddress, { type: 'guide-finished' }),
      { type: 'guide-chosen', section: 'water-flow' },
    );
    expect(second.screen).toBe('guide');
    expect(second.guideSection).toBe('water-flow');
    expect(second.address).toEqual(GATEHOUSE);
  });

  it('keeps the chosen section, because Back is not un-choosing it', () => {
    const chosen = play([{ type: 'get-started' }, { type: 'guide-chosen', section: 'drainage' }]);
    expect(reduce(chosen, { type: 'address-abandoned' }).guideSection).toBe('drainage');
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

describe('arriving at the map', () => {
  /*
   * The map must start clean every time — no pit selected, no path traced, no
   * chips left on from the last visit. That was true only because React
   * unmounted the screen on the way out; nothing said so and nothing tested
   * it. The map is keyed on this count now, so the guarantee is structural.
   */
  /*
   * `map-opened` stopped landing on the map on 11 September: it lands on the
   * notice, and `lock-passed` is what reaches the map. These tests were
   * written against the one-step route and are edited rather than deleted,
   * because the property is unchanged — an arrival is an arrival however many
   * screens it took, and the rule still lives in one place in the reducer.
   */
  const OPEN_MAP: readonly SessionEvent[] = [{ type: 'map-opened' }, { type: 'lock-passed' }];

  it('counts an arrival however the person got there', () => {
    expect(play(OPEN_MAP).mapOpenings).toBe(1);
    expect(
      play([
        { type: 'address-accepted', address: GATEHOUSE },
        { type: 'task-chosen', task: 'follow' },
      ]).mapOpenings,
    ).toBe(1);
  });

  it('does not count the notice, which is not the map', () => {
    // Reading a disclosure and then turning back has not started anything.
    expect(play([{ type: 'map-opened' }]).mapOpenings).toBe(0);
    expect(play([{ type: 'map-opened' }]).screen).toBe('locked');
  });

  it('counts leaving and coming back as a second arrival', () => {
    const end = play([...OPEN_MAP, { type: 'leave-map' }, ...OPEN_MAP]);
    expect(end.mapOpenings).toBe(2);
  });

  it('does not count anything done while already on the map', () => {
    // Otherwise every search would throw away the layers the person had set,
    // which is the opposite failure and just as bad.
    const end = play([
      ...OPEN_MAP,
      { type: 'address-moved', address: NEALE },
      { type: 'address-cleared' },
      { type: 'pit-selected', pitId: 'P-14', suggested: false },
    ]);
    expect(end.mapOpenings).toBe(1);
    expect(end.screen).toBe('explore');
  });

  it('does not count screens that are not the map', () => {
    expect(play([{ type: 'history-opened' }]).mapOpenings).toBe(0);
    expect(play([{ type: 'address-accepted', address: GATEHOUSE }]).mapOpenings).toBe(0);
  });
});

describe('the whole map, before the guide is finished', () => {
  const ALL_FOUR: readonly SessionEvent[] = SECTION_ORDER.flatMap((section) => [
    { type: 'guide-chosen', section },
    { type: 'guide-finished' },
  ]);

  it('meets the notice on every route in, not just one', () => {
    // The rule is in the reducer rather than at each route, because there are
    // three ways to the map today and a lock written three times will be
    // right at two of them.
    expect(play([{ type: 'map-opened' }]).screen).toBe('locked');
    expect(play([{ type: 'map-opened', mode: 'terrain' }]).screen).toBe('locked');
    expect(play([{ type: 'map-opened', from: 'history' }]).screen).toBe('locked');
  });

  it('keeps the mode and the origin through the notice', () => {
    // Otherwise reading four lines costs you the card you pressed and the page
    // you came from, and Back stops obeying AC 1.1.10.
    const end = play([
      { type: 'map-opened', mode: 'low-areas', from: 'history' },
      { type: 'lock-passed' },
    ]);
    expect(end.mapMode).toBe('low-areas');
    expect(end.mapOrigin).toBe('history');
  });

  it('opens whether or not any of the guide was done', () => {
    // Not a paywall. Five seconds buys a disclosure; it does not withhold the
    // product from somebody who declines the lesson.
    expect(play([{ type: 'map-opened' }, { type: 'lock-passed' }]).screen).toBe('explore');
  });

  it('stops appearing once all four sections are finished', () => {
    const taught = play(ALL_FOUR);
    expect(allLearned(taught.learned)).toBe(true);
    expect(reduce(taught, { type: 'map-opened' }).screen).toBe('explore');
  });

  it('still appears when three of the four are finished', () => {
    // All or nothing, which is the model the design owner chose. Three
    // sections is not a partial unlock, it is three sections.
    const three = play(ALL_FOUR.slice(0, 6));
    expect(countLearned(three.learned)).toBe(3);
    expect(reduce(three, { type: 'map-opened' }).screen).toBe('locked');
  });

  it('records nothing about having passed it', () => {
    // A decision about one press, not a fact about the person. Passing the
    // notice must not quietly count as having learned anything.
    const passed = play([{ type: 'map-opened' }, { type: 'lock-passed' }]);
    expect(countLearned(passed.learned)).toBe(0);
  });

  it('goes back where it came from rather than one screen up', () => {
    expect(play([{ type: 'map-opened', from: 'history' }, { type: 'leave-map' }]).screen).toBe(
      'history',
    );
  });
});

describe('starting and finishing a section of the guide', () => {
  it('asks where you live before it can point at a pit near you', () => {
    const end = play([{ type: 'guide-chosen', section: 'drainage' }]);
    expect(end.screen).toBe('address');
    expect(end.guideSection).toBe('drainage');
  });

  it('hands the address to the guide rather than to the task question', () => {
    // The same screen answers two questions now, and which one it is
    // answering is the whole of the difference.
    const guided = play([
      { type: 'guide-chosen', section: 'drainage' },
      { type: 'address-accepted', address: GATEHOUSE },
    ]);
    expect(guided.screen).toBe('guide');

    const unguided = play([{ type: 'address-accepted', address: GATEHOUSE }]);
    expect(unguided.screen).toBe('task');
  });

  it('marks only the section that was running', () => {
    const end = play([
      { type: 'guide-chosen', section: 'water-flow' },
      { type: 'guide-finished' },
    ]);
    expect(end.learned['water-flow']).toBe(true);
    expect(countLearned(end.learned)).toBe(1);
    expect(end.guideSection).toBeNull();
  });

  it('does nothing when no section is running', () => {
    // `guide-finished` reaching the reducer from outside a section would
    // otherwise mark whatever was last chosen, or crash on null.
    const start = INITIAL_SESSION;
    expect(reduce(start, { type: 'guide-finished' })).toBe(start);
  });

  it('carries the section through as the map mode', () => {
    // So that finishing the guide and then opening the map shows the thing
    // just taught rather than whatever was last looked at.
    expect(play([{ type: 'guide-chosen', section: 'terrain' }]).mapMode).toBe('terrain');
  });
});

describe('letting the address go', () => {
  /*
   * There was no way to do this, and the shape of the gap is worth keeping.
   * The map's search box shows a chosen address as its *placeholder* and
   * clears what was typed, so the clear button — which appeared only when
   * there was typed text — vanished at the exact moment there was something
   * to clear. The mark stayed on the map with no control that removed it.
   */
  it('drops the address without moving off the map', () => {
    const reading = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
    ]);
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
      { type: 'address-cleared' },
    ]);

    expect(end.address).toBeNull();
    expect(end.screen).toBe(reading.screen);
  });

  it('drops a pit chosen near it, for the same reason a new address does', () => {
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
      { type: 'pit-selected', pitId: 'P-14', suggested: true },
      { type: 'address-cleared' },
    ]);

    expect(end.scenario.pitId).toBeNull();
    expect(end.scenario.pitWasSuggested).toBe(false);
    expect(end.outcome).toBeNull();
  });

  it('keeps the assumptions, which were never about the address', () => {
    // Same rule as `address-moved`: the blockage setting and the rainfall are
    // the person's, and re-asking for them would be the map forgetting
    // something it was told.
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-chosen', task: 'follow' },
      { type: 'blockage-selected', blockage: 'fully-blocked' },
      { type: 'rainfall-selected', rainfallMm: 60 },
      { type: 'address-cleared' },
    ]);

    expect(end.scenario.blockage).toBe('fully-blocked');
    expect(end.scenario.rainfallMm).toBe(60);
  });

  it('clears a rejected address too, so no stale complaint survives it', () => {
    const end = play([
      { type: 'address-rejected', typed: '12 Nowhere Street' },
      { type: 'address-cleared' },
    ]);

    expect(end.rejectedAddress).toBeNull();
  });

  it('is harmless when there is no address', () => {
    expect(play([{ type: 'address-cleared' }]).address).toBeNull();
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
  it('meets the notice first, and never asks for an address', () => {
    /*
     * This said "goes straight there" until 11 September, when the guide's
     * lock landed. The half that changed is the destination; the half that
     * matters is unchanged and is why the test is edited rather than deleted:
     * no route to the map invents an address or demands one.
     */
    const notice = reduce(INITIAL_SESSION, { type: 'map-opened' });
    expect(notice.screen).toBe('locked');
    expect(notice.address).toBeNull();

    const end = reduce(notice, { type: 'lock-passed' });
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

describe('a task chosen before there is an address', () => {
  /*
    AC 3.1.1 needs the comparison offered from the homepage, and the homepage
    has no address. The route is: name the task, be asked for an address, then
    arrive at the task — and the reducer is the only thing that remembers what
    the address was collected for.

    **The screen that used to carry this choice had no way in.** `screen:
    'task'` is set by `address-accepted` with no guide section running, and
    after the homepage was rebuilt around the guide, every route to the address
    screen set one. That is why the tests below check both destinations: where
    a pending task goes, and that an address given with nothing pending still
    lands on the task question.
  */

  it('collects an address first, then opens what was asked for', () => {
    const asked = play([{ type: 'task-wanted', task: 'compare' }]);
    expect(asked.screen).toBe('address');
    expect(asked.task).toBeNull();

    const arrived = play([{ type: 'address-accepted', address: GATEHOUSE }], asked);
    expect(arrived.screen).toBe('scenario');
    expect(arrived.task).toBe('compare');
  });

  it('goes straight there when an address is already in hand', () => {
    // The homepage is not the only place this can be dispatched from, and
    // somebody who has already named their street should not be asked twice.
    const end = play([
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-wanted', task: 'compare' },
    ]);
    expect(end.screen).toBe('scenario');
  });

  it('still sends an address given for no particular task to the task question', () => {
    // The other destination, and the one that restores a screen nothing could
    // reach: changing an address from inside the comparison and re-entering it
    // lands on `Choose a task`, which is what the breadcrumb already claims.
    const end = play([
      { type: 'task-wanted', task: 'compare' },
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'change-address' },
      { type: 'address-accepted', address: NEALE },
    ]);
    expect(end.screen).toBe('task');
  });

  it('drops a pending task when the address screen is backed out of', () => {
    /*
      The failure this prevents: press the comparison card, change your mind,
      go and read the flood board, then give an address somewhere else for an
      unrelated reason and be dropped into a comparison you abandoned. The
      pending guide section is deliberately *not* dropped the same way — the
      chooser sets it again every time it is used, and the homepage does not.
    */
    const end = play([
      { type: 'task-wanted', task: 'compare' },
      { type: 'address-abandoned' },
    ]);
    expect(end.screen).toBe('home');
    expect(end.pendingTask).toBeNull();

    expect(play([{ type: 'address-accepted', address: GATEHOUSE }], end).screen).toBe('task');
  });

  it('does not let a pending task outlive a trip home', () => {
    const end = play([{ type: 'task-wanted', task: 'compare' }, { type: 'go-home' }]);
    expect(end.pendingTask).toBeNull();
  });

  it('leaves the guide in charge when both are waiting', () => {
    // A section is chosen from the chooser, which is reached from the map,
    // which can be reached after a pending task is set. The section is the
    // more recent answer and it is the one being taught.
    const end = play([
      { type: 'task-wanted', task: 'compare' },
      { type: 'guide-chosen', section: 'drainage' },
      { type: 'address-accepted', address: GATEHOUSE },
    ]);
    expect(end.screen).toBe('guide');
  });
});

describe('the breadcrumb back to the task question', () => {
  it('goes to the task question rather than the screen it was pressed on', () => {
    // It dispatched `task-chosen` with the task already chosen, so the crumb
    // labelled `Choose a task` returned to the comparison. A mislabelled
    // control, unnoticed for as long as its destination was unreachable.
    const end = play([
      { type: 'task-wanted', task: 'compare' },
      { type: 'address-accepted', address: GATEHOUSE },
      { type: 'task-reconsidered' },
    ]);
    expect(end.screen).toBe('task');
  });

  it('stays put with no address, because the task question shows one', () => {
    expect(play([{ type: 'task-reconsidered' }]).screen).toBe('home');
  });
})

describe('rainfall is one of the validated levels', () => {
  it('ignores an amount the explorer does not offer', () => {
    // AC 3.2.3.b. A stored 35 mm would be shown in the summary as a choice.
    const start = reduce(INITIAL_SESSION, { type: 'rainfall-selected', rainfallMm: 60 });
    expect(start.scenario.rainfallMm).toBe(60);
    for (const mm of [35, 0, 120, 500]) {
      expect(reduce(start, { type: 'rainfall-selected', rainfallMm: mm }).scenario.rainfallMm).toBe(60);
    }
  });
});

describe('opening the comparison from a drain on the map', () => {
  it('goes straight to the comparison with that drain chosen and nothing else assumed', () => {
    // AC 3.1.1: from the local drainage map. No address is needed.
    const onMap = reduce(INITIAL_SESSION, { type: 'map-opened' });
    const next = reduce({ ...onMap, screen: 'explore' }, { type: 'scenario-from-map', pitId: '1144908' });
    expect(next.screen).toBe('scenario');
    expect(next.scenario.pitId).toBe('1144908');
    expect(next.scenario.pitWasSuggested).toBe(false);
    expect(next.scenario.blockage).toBeNull();
    expect(next.address).toBeNull();
  });

  it('goes back to the map it came from, not to a task question it never saw', () => {
    const next = reduce({ ...INITIAL_SESSION, screen: 'explore' }, { type: 'scenario-from-map', pitId: '1' });
    expect(reduce(next, { type: 'back' }).screen).toBe('explore');
  });

  it('still goes back to the task question when opened from one', () => {
    const address = { id: 'a', label: '46 Gatehouse Drive', eastingM: 1, northingM: 1 };
    const withAddress = { ...INITIAL_SESSION, address, screen: 'task' as const };
    const fromMap = reduce({ ...withAddress, screen: 'explore' }, { type: 'scenario-from-map', pitId: '1' });
    const fromTask = reduce(fromMap, { type: 'task-chosen', task: 'compare' });
    expect(reduce(fromTask, { type: 'back' }).screen).toBe('task');
  });
});
