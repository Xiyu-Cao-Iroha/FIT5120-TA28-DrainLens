/**
 * The screen the session says we are on, and nothing more.
 *
 * All navigation goes through the reducer in `session.ts`, so the rule that
 * the address never reaches storage is enforced in one tested place rather
 * than at every screen that happens to touch it.
 */

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { type AddressIndex, type PackedIndex, unpack } from './address/search.js';
import { demonstrationAddress } from './address/demonstration.js';
import { type MapArtefact, assertUsable } from './map/artefact.js';
import { type DerivedArtefact, assertDerived } from './map/derived.js';
import { type TraceArtefact, assertTrace, traceDownstream } from './trace/graph.js';
import { MapView } from './screens/MapView.js';
import { FloodHistory } from './screens/FloodHistory.js';
import { type FloodHistoryArtefact, assertFloodHistory } from './history/artefact.js';
import { useAreas } from './history/useAreas.js';
import { FloodMap } from './screens/FloodMap.js';
import { Guide } from './screens/Guide.js';
import { Choose } from './screens/Choose.js';
import { Home } from './screens/Home.js';
import { LockedMap } from './screens/LockedMap.js';
import { SECTIONS, type SectionId } from './tutorial/sections.js';
import { progress } from './tutorial/progress.js';
import { GUIDED_SECTIONS } from './tutorial/lessons.js';
import { Landing } from './screens/Landing.js';
import { Result } from './screens/Result.js';
import { Comparing, ScenarioChoices, ScenarioReview } from './screens/ScenarioSetup.js';
import { ComparisonMap } from './screens/ComparisonMap.js';
import { DrainsUnavailable, FindingDrains, NoMatch } from './screens/NoMatch.js';
import { TaskSelect } from './screens/TaskSelect.js';
import { type DifferenceArea, footprintCorners, intoMapFrame } from './map/difference.js';
import type { Local } from './map/viewport.js';
import { comparableNear } from './scenario/eligibility.js';
import { ink, line, radius, shadow, space, surface, text, type, weight } from './ui/theme.js';
import type { Action } from './scenario/outcome.js';
import { useScenario } from './scenario/useScenario.js';
import { useScenarioSupport } from './scenario/support.js';
import { BOARD_CHANGES_NOTICE, FLOOD_CHANGES_NOTICE, creditsForSources } from './ui/attribution.js';
import type { SolvedPosition } from './scenario/worker.js';
import {
  INITIAL_SESSION,
  type Session,
  type SessionEvent,
  type SupportedAddress,
  reduce,
} from './session.js';
import { Shell } from './ui/Shell.js';
import { FULL_MAP } from './ui/terms.js';
import { Spinner } from './ui/Spinner.js';
import { Tour } from './ui/Tour.js';
import {
  API_BASE,
  API_EXTENT,
  BUNDLED_EXTENT,
  fetchArtefact,
  fetchTogether,
} from './data/source.js';
import { tourGate } from './ui/tourGate.js';
import { type Credit, creditsFor } from './ui/attribution.js';

/*
  The sections of the guide that have steps written used to be a hand-kept
  array here. It is `GUIDED_SECTIONS` in `tutorial/lessons.ts` now, derived
  from the lessons that exist — one place to add a section rather than two, and
  the drift it removes would have shown as a card offering a guide that opens
  an empty room.
*/

interface Loaded {
  readonly map: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly trace: TraceArtefact;
  readonly index: AddressIndex;
  readonly history: FloodHistoryArtefact;
  readonly fixtureNote: string | undefined;
  /** `city-of-melbourne` or `kensington`, depending on which answered. */
  readonly extentName: string;
}

async function load(): Promise<Loaded> {
  // Four artefacts come from the database through the API, each falling back
  // to the copy in this container if it cannot answer. `source.ts` says why
  // the fallback exists and why it is not hidden.
  //
  // The flood history is 5.4 KB and joins the others rather than being
  // fetched when the board opens: a separate round trip for five kilobytes
  // buys a loading state nobody needed.
  const at = (path: string) => (API_BASE === '' ? null : `${API_BASE}${path}`);

  // A fallback that says nothing is indistinguishable from an API nobody is
  // using. The footer tells a visitor which source answered; this tells
  // whoever is looking at a console *why*, which the footer cannot.
  const note = (url: string, reason: string) => {
    console.warn(`DrainLens: ${url} did not answer (${reason}); using the bundled copy`);
  };

  /*
    The three that describe one place, fetched as a set.

    The API's extent is the whole council and the container's is the pilot
    square kilometre, so these three have to come from the same side or the
    derived layers land a kilometre and a half from the streets they belong
    to. `fetchTogether` makes that structural rather than hoped for.
  */
  const place = await fetchTogether<[MapArtefact, DerivedArtefact, TraceArtefact]>([
    {
      api: at(`/api/map/${API_EXTENT}`),
      bundled: '/data/map.json',
      guard: assertUsable,
      onFallback: note,
    },
    {
      api: at(`/api/derived/${API_EXTENT}`),
      bundled: '/data/derived.json',
      guard: assertDerived,
      onFallback: note,
    },
    {
      api: at(`/api/trace/${API_EXTENT}`),
      bundled: '/data/trace.json',
      guard: assertTrace,
      onFallback: note,
    },
  ]);
  const [map, derived, trace] = place.values;

  const [history, addresses] = await Promise.all([
    fetchArtefact<FloodHistoryArtefact>({
      api: at('/api/flood-history'),
      bundled: '/data/flood-history.json',
      guard: assertFloodHistory,
      onFallback: note,
    }),
    // **Never from a server, and not routed through `fetchArtefact` so that no
    // later edit there can change that.** The landing page tells a resident the
    // search runs in their browser and that nothing about the address is sent
    // anywhere; an address index fetched from an API would still keep that
    // promise, and an index fetched *per query* would not. Bundled is the shape
    // that cannot drift into the second.
    fetch('/data/addresses.json').then((r) => r.json()),
  ]);

  // Unpacked once, here, rather than on every keystroke. The shipped shape
  // groups addresses by street and leaves out what it can rebuild; `unpack`
  // refuses an index whose groups do not line up rather than repairing it.
  //
  // **Into the frame of the map that was actually served.** The index is the
  // one artefact that never comes from the API, so it arrives in its own
  // extent's frame whichever map is under it. Unshifted, every pin once landed
  // 1.5 km west and 6 km south of the house. Since 14 September the index is
  // the council's: over the council map the shift is zero, and over the
  // Kensington fallback `unpack` clips it to the square kilometre and marks it
  // `clipped`, so the search can say why a council address is not found.
  const packed = addresses as PackedIndex & { fixture?: string };
  const index = unpack(packed, map.extent);

  return {
    map,
    derived,
    trace,
    history: history.value,
    index,
    fixtureNote: packed.fixture,
    // Which extent is actually on screen, so the interface can say so rather
    // than leaving somebody to notice the map got smaller.
    extentName: place.from === 'api' ? API_EXTENT : BUNDLED_EXTENT,
  };
}

export function App() {
  /*
    Seeded from the device, then mirrored back to it.

    The session is the authoritative copy and `progress` is a mirror, which is
    the only arrangement where a browser that refuses to store anything still
    lets somebody finish the guide -- they just start again next time. Reading
    it here rather than inside the reducer keeps `session.ts`'s rule intact:
    nothing in that file touches storage of any kind, and a test enforces it by
    running a whole session against traps rather than by reading the source.
  */
  const [session, dispatch] = useReducer(reduce, INITIAL_SESSION, (initial) => ({
    ...initial,
    learned: progress.read(),
  }));
  useEffect(() => {
    progress.write(session.learned);
  }, [session.learned]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /*
    Started as soon as somebody asks for the comparison, not when step 1 opens.

    The eligibility check runs straight after the address resolves and needs
    the worker's list of comparable drains. Starting the worker on the address
    screen, while the comparison is waiting for an address, means the list is
    usually there by the time one is chosen — and a visit that never asks for
    the comparison still downloads none of it.
  */
  const scenario = useScenario(
    '/data/scene-tiles',
    COMPARISON_SCREENS.has(session.screen) ||
      ((session.screen === 'address' || session.screen === 'unsupported') && session.pendingTask === 'compare'),
  );
  // The flood map's three artefacts, 83 KB, fetched when the map is opened
  // and not on the way past. Same argument as the scenario scene.
  //
  // The flood history board asks for the same load when a reader first wants
  // its ranking per 1,000 residents, and not merely for being opened. One hook
  // here rather than one per screen, so the board and the map share a single
  // fetch whichever is reached first.
  const [boardWantsAreas, setBoardWantsAreas] = useState(false);
  const areas = useAreas(session.screen === 'flood-map' || (session.screen === 'history' && boardWantsAreas));
  // Every position the last run solved. The rainfall control on the result
  // reads these, so changing the amount cannot start a second calculation and
  // therefore cannot return a different answer for the same inputs (AC 2.2).
  const [positions, setPositions] = useState<readonly SolvedPosition[]>([]);
  // Metres per grid cell, from the run that produced `positions`. Held beside
  // them so the two can never describe different grids.
  const [cellSizeM, setCellSizeM] = useState(1);
  // The window the last successful run was calculated in, for placing its
  // difference on whichever map is served.
  const [windowOrigin, setWindowOrigin] = useState<{ readonly minE: number; readonly minN: number } | null>(null);
  const [measuredShare, setMeasuredShare] = useState<number | null>(null);
  // Names each run, so Cancel can drop an answer that arrives afterwards. See `Session.run`.
  const runs = useRef(0);

  /*
    The eligibility check: the nearest comparable drain within the radius, and
    the others by distance. Null until there is an address, a map and the
    worker's list. Against the pits the served map draws, so the drain it
    highlights is always one the person can see and press.
  */
  const eligibility = useMemo(
    () =>
      loaded === null || session.address === null || !scenario.ready
        ? null
        : comparableNear(
            [session.address.eastingM, session.address.northingM],
            loaded.map.layers.pit ?? [],
            scenario.supported,
          ),
    [loaded, session.address, scenario.ready, scenario.supported],
  );
  // No match: the reducer decides what that may do, and only step 1 stops.
  useEffect(() => {
    if (session.screen === 'drain' && eligibility !== null && eligibility.nearest === null) {
      dispatch({ type: 'drains-none-nearby' });
    }
  }, [session.screen, eligibility]);

  useEffect(() => {
    load()
      .then(setLoaded)
      .catch((error: unknown) => setProblem(String(error)));
  }, []);

  // Above the early returns, because the loading and failure screens render
  // through the same Shell. Empty until the artefact arrives: there is nothing
  // of the council's on screen yet, so there is nothing yet to attribute.
  const credits = loaded === null ? [] : creditsFor(loaded.map);

  if (problem !== null) {
    return (
      <Shell>
        <p style={{ padding: 24 }}>{problem}</p>
      </Shell>
    );
  }
  if (loaded === null) {
    return (
      <Shell>
        <Spinner label="Loading the map…" />
      </Shell>
    );
  }

  const crumb = (label: string, onClick?: () => void, current = false) =>
    onClick && !current ? (
      <button
        key={label}
        type="button"
        onClick={onClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          color: '#1f6f5c',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    ) : (
      <strong key={label} style={{ color: current ? '#1e2b36' : undefined }}>
        {label}
      </strong>
    );

  // Decorative: it repeats a gap the layout already makes, so a screen
  // reader is not given it. It is still coloured to be seen, because a
  // separator nobody can see is a pair of crumbs that look like one.
  const separator = (
    <span aria-hidden style={{ margin: '0 8px', color: ink.subtle }}>
      ›
    </span>
  );

  switch (session.screen) {
    case 'home':
      return (
        <Shell
          at={session.screen}
          credits={credits}
          extentName={loaded.extentName}
          actions={
            <HomeNav
              onOpenMap={() => {
                dispatch({ type: 'get-started' });
              }}
              onOpenHistory={() => {
                dispatch({ type: 'history-opened' });
              }}
            />
          }
        >
          <Home
            history={loaded.history}
            onOpenMap={(mode) => {
              /*
                Everything on the homepage now goes to the four cards.

                A card here that started its section directly would be a second
                front door with different manners -- one that skips the screen
                showing what is done and what is left. The chooser is where
                that choice is made, and the cards here describe rather than
                dispatch.
              */
              void mode;
              dispatch({ type: 'get-started' });
            }}
            // The chooser's "Skip to Full map", so the link named after the
            // full map opens it -- through the same notice, which the reducer
            // puts in front of every way in.
            onOpenFullMap={() => {
              dispatch({ type: 'map-opened', from: 'home' });
            }}
            onOpenHistory={() => {
              dispatch({ type: 'history-opened' });
            }}
            // The same event the board's "Open the area map" dispatches, so
            // the picture of the map and the board's button open one screen.
            onOpenFloodMap={() => {
              dispatch({ type: 'flood-map-opened' });
            }}
            /*
              The one card here that dispatches rather than describes, and for
              the opposite reason to the four above it: they all arrive at the
              same chooser, and this arrives somewhere the chooser only reaches
              the same way. It needs an address, so the reducer sends it to the
              address screen and remembers what it was for.
            */
            onCompare={() => {
              dispatch({ type: 'task-wanted', task: 'compare', from: 'home' });
            }}
          />
        </Shell>
      );

    case 'flood-map': {
      const back = () => {
        dispatch({ type: 'back' });
      };
      return (
        <Shell
          at={session.screen}
          credits={
            areas.data === null
              ? []
              : creditsForSources([areas.data.scope.source, areas.data.scope.geographySource, areas.data.population.source])
          }
          creditNotice={FLOOD_CHANGES_NOTICE}
          crumbs={
            <>
              {crumb('Home', () => {
                dispatch({ type: 'go-home' });
              })}
              {separator}
              {crumb('Flood history', back)}
              {separator}
              {crumb('Map', undefined, true)}
            </>
          }
        >
          {areas.problem !== null ? (
            /*
              The guard's own sentence, not "something went wrong". It names
              the field that is wrong, which is the difference between a
              defect somebody can act on and one they can only report.
            */
            <p style={{ padding: 24, color: ink.muted }}>
              The map cannot be drawn: {areas.problem}
            </p>
          ) : areas.data === null ? (
            <p style={{ padding: 24, color: ink.muted }}>Loading the areas…</p>
          ) : (
            <FloodMap
              areas={areas.data.areas}
              scope={areas.data.scope}
              population={areas.data.population}
              points={areas.data.points}
              events={areas.data.events}
              onBack={back}
            />
          )}
        </Shell>
      );
    }

    case 'history':
      return (
        <Shell
          at={session.screen}
          credits={creditsForSources([
            loaded.history.source,
            loaded.history.geographySource,
            // The rate divides by the ABS's population, so once it can be on
            // screen the ABS is credited beside the SES.
            areas.data === null ? undefined : areas.data.population.source,
          ])}
          creditNotice={BOARD_CHANGES_NOTICE}
          back={{
            label: 'Home',
            onBack: () => {
              dispatch({ type: 'go-home' });
            },
          }}
          crumbs={crumb('Flood history', undefined, true)}
        >
          <FloodHistory
            artefact={loaded.history}
            areas={areas}
            onNeedAreas={() => {
              setBoardWantsAreas(true);
            }}
            onOpenAreas={() => {
              dispatch({ type: 'flood-map-opened' });
            }}
            onOpenMap={() => {
              dispatch({ type: 'map-opened', from: 'history' });
            }}
            onBack={() => {
              dispatch({ type: 'go-home' });
            }}
          />
        </Shell>
      );

    case 'address':
    case 'unsupported':
      return (
        <Shell at={session.screen} credits={credits}
          extentName={loaded.extentName}>
          <Landing
            index={loaded.index}
            fixtureNote={loaded.fixtureNote}
            // The comparison's own words when it is the task waiting.
            task={session.pendingTask}
            // The title follows the guide card that was pressed (copy audit v2, #16).
            section={session.guideSection}
            onFound={(address) =>
              dispatch({
                type: 'address-accepted',
                address: {
                  id: address.id,
                  label: address.label,
                  eastingM: address.e,
                  northingM: address.n,
                },
              })
            }
            onUnsupported={(typed) => dispatch({ type: 'address-rejected', typed })}
            // The chooser, or the homepage -- the reducer knows which, from
            // whether a guide section is pending.
            onBack={() => {
              dispatch({ type: 'address-abandoned' });
            }}
            onHome={() => {
              dispatch({ type: 'go-home' });
            }}
          />
        </Shell>
      );

    case 'choose':
      return (
        <Shell at={session.screen} credits={credits}
          extentName={loaded.extentName} masthead={false}>
          <Choose
            learned={session.learned}
            guided={GUIDED_SECTIONS}
            onStart={(section) => {
              dispatch({ type: 'guide-chosen', section });
            }}
            // Not a guide: the address search, then the comparison, and Back
            // from the address returns here.
            onCompare={() => {
              dispatch({ type: 'task-wanted', task: 'compare', from: 'choose' });
            }}
            onSkip={() => {
              dispatch({ type: 'map-opened', from: 'home' });
            }}
            onBack={() => {
              dispatch({ type: 'go-home' });
            }}
          />
        </Shell>
      );

    case 'locked':
      return (
        <Shell
          at={session.screen}
          credits={credits}
          extentName={loaded.extentName}
          masthead={false}
          back={{
            label: session.mapOrigin === 'history' ? 'Flood history' : 'Home',
            onBack: () => {
              dispatch({ type: 'leave-map' });
            },
          }}
          crumbs={crumb(FULL_MAP, undefined, true)}
        >
          <LockedMap
            map={loaded.map}
            learned={session.learned}
            extentName={loaded.extentName}
            /*
              Only the sections that have a guide written. Offering a card
              whose guide has no steps in it would be a button that opens an
              empty room, which is worse than not offering it. The others join
              this list as they land.
            */
            available={GUIDED_SECTIONS}
            onStartGuide={(section) => {
              dispatch({ type: 'guide-chosen', section });
            }}
            onOpenAnyway={() => {
              dispatch({ type: 'lock-passed' });
            }}
            onBack={() => {
              dispatch({ type: 'leave-map' });
            }}
          />
        </Shell>
      );

    case 'guide':
      return (
        <Shell
          at={session.screen}
          credits={credits}
          extentName={loaded.extentName}
          masthead={false}
          back={{
            label: 'Address',
            onBack: () => {
              dispatch({ type: 'back' });
            },
          }}
          crumbs={crumb(SECTIONS[session.guideSection ?? 'drainage'].label, undefined, true)}
          trailing={
            // The way out of the guide, which is a different thing from the
            // way back one step. Asked for by name: somebody three steps in
            // who wants out should not have to press Back three times.
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'go-home' });
              }}
              style={{
                border: `1px solid ${line.base}`,
                borderRadius: radius.base,
                background: surface.raised,
                color: ink.base,
                padding: `${String(space(2))}px ${String(space(3))}px`,
                font: type(text.label, { weight: weight.medium }),
                cursor: 'pointer',
              }}
            >
              Home
            </button>
          }
        >
          {session.address === null || session.guideSection === null ? null : (
            <Guide
              map={loaded.map}
              derived={loaded.derived}
              trace={loaded.trace}
              index={loaded.index}
              address={session.address}
              section={session.guideSection}
              onFinish={() => {
                dispatch({ type: 'guide-finished' });
              }}
            />
          )}
        </Shell>
      );

    case 'task':
      return (
        <Shell
          at={session.screen}
          credits={credits}
          extentName={loaded.extentName}
          crumbs={
            <>
              {crumb('Home', () => {
                dispatch({ type: 'go-home' });
              })}
              {separator}
              {crumb('Address search', () => {
                dispatch({ type: 'change-address' });
              })}
              {separator}
              {crumb('Choose a task', undefined, true)}
            </>
          }
        >
          <TaskSelect
            address={session.address!}
            onChoose={(task) => dispatch({ type: 'task-chosen', task })}
            onChangeAddress={() => dispatch({ type: 'change-address' })}
          />
        </Shell>
      );

    case 'drain':
    case 'scenario':
    case 'review':
    case 'result':
    case 'no-match': {
      const startComparison = (): void => {
        const { pitId, blockage, rainfallMm } = session.scenario;
        runs.current += 1;
        const run = runs.current;
        if (pitId === null || blockage === null || rainfallMm === null) {
          dispatch({ type: 'comparison-started', run });
          dispatch({
            type: 'comparison-finished',
            run,
            outcome: { kind: 'insufficient', reason: 'invalid_inlet' },
          });
          return;
        }

        // By asset number. The worker finds the drain's window and the cell
        // the pipeline snapped it to; nothing here works a cell out from the
        // map geometry, which is how every drain once came back invalid.
        dispatch({ type: 'comparison-started', run });
        void scenario.run(pitId, blockage, rainfallMm).then((result) => {
          // Cancelled, or overtaken by another run: nothing of this answer is kept.
          if (run !== runs.current) return;
          // Cleared on failure: leaving the previous run's positions attached
          // would let the control offer answers to a question nobody asked.
          setPositions(result.status === 'successful' ? result.positions : []);
          if (result.status === 'successful') {
            setCellSizeM(result.cellSizeM);
            setWindowOrigin(result.origin);
            setMeasuredShare(result.measuredShare);
          }
          dispatch({
            type: 'comparison-finished',
            run,
            outcome:
              result.status === 'successful'
                ? { kind: 'comparison', band: result.band }
                : { kind: 'insufficient', reason: result.reason },
          });
        });
      };

      const cancel = (): void => {
        runs.current += 1;
        dispatch({ type: 'comparison-cancelled' });
      };

      const onAction = (action: Action) => {
        switch (action) {
          case 'change-scenario':
          case 'review-scenario':
            // Step 2, keeping the drain and the choices (AC 3.2.1.a, b).
            dispatch({ type: 'change-scenario' });
            return;
          case 'choose-another-pit':
          case 'return-to-map':
            // Step 1 around the address, or the full map the drain came from.
            // The condition and the rainfall are kept either way.
            dispatch({ type: 'drains-reopened' });
            return;
          case 'try-again':
            // Runs the same comparison again. It used to dispatch a failure
            // without calling the engine at all, so the button could only
            // ever reproduce the screen it was pressed on.
            startComparison();
            return;
          case 'change-address':
            dispatch({ type: 'another-address-wanted' });
            return;
        }
      };

      const address = session.address;
      const addressAt: Local | null = address === null ? null : [address.eastingM, address.northingM];
      const pitId = session.scenario.pitId;
      const pitAt = pitId === null ? null : pitPosition(loaded, pitId);
      const distanceM =
        addressAt === null || pitAt === null ? null : Math.hypot(pitAt[0] - addressAt[0], pitAt[1] - addressAt[1]);
      const outcome = session.outcome;
      const fromMap = session.scenarioOrigin === 'map';

      // The difference layer, and only where there is one to draw.
      //
      // Read from the position matching the amount currently selected, so the
      // rainfall control moves the highlight with the number beside it rather
      // than leaving the map showing the amount the run happened to end on.
      // Null off the result screen and null for an insufficient outcome: a
      // highlight with no finding beside it is a claim nobody made.
      const differenceShown: DifferenceArea | null =
        session.screen === 'result' && outcome?.kind === 'comparison'
          ? {
              cells: intoMapFrame(
                positions.find((p) => p.rainfallMm === session.scenario.rainfallMm)?.higherAreasM ?? [],
                windowOrigin ?? { minE: loaded.map.extent.min_e, minN: loaded.map.extent.min_n },
                loaded.map.extent,
              ),
              cellSizeM,
            }
          : null;

      /*
        What the view is fitted to, and when it is fitted again.

        On a new address, the address and the nearest comparable drain. Once a
        drain is chosen, the address and that drain, fitted again for the
        narrower map beside the step-2 panel: the review of 15 September found
        step 2 still at whatever zoom step 1 had been left on, with the chosen
        drain small among rings a street away. On a returned result, the
        address, the drain and the whole footprint. From the full map, the
        drain alone.
      */
      const fit: { key: string; points: Local[] } =
        session.screen === 'result' && session.run !== null
          ? {
              key: `result:${String(session.run)}`,
              points: [
                ...(addressAt === null ? [] : [addressAt]),
                ...(pitAt === null ? [] : [pitAt]),
                ...footprintCorners(differenceShown),
              ],
            }
          : address !== null && session.screen !== 'drain' && pitAt !== null
            ? { key: `address:${address.id}:drain:${pitId ?? ''}`, points: [addressAt!, pitAt] }
          : address !== null
            ? {
                key: `address:${address.id}`,
                points: [addressAt!, ...(eligibility?.nearest ? [eligibility.nearest.at] : [])],
              }
            : { key: 'from-map', points: pitAt === null ? [] : [pitAt] };

      /*
        The breadcrumb is the steps so far: Address search › Choose a drain ›
        Choices › Review, or Result. Nothing ahead of the current step is
        shown, and nothing is pressable while a run is in progress — leaving
        mid-run is Cancel's job, which says what happens to the answer.
      */
      const running = session.running;
      const step = session.screen;
      const reached = (at: 'drain' | 'scenario' | 'review' | 'result') =>
        ({ drain: 1, scenario: 2, review: 3, result: 3, 'no-match': 0 })[step] >= { drain: 1, scenario: 2, review: 3, result: 3 }[at];
      const crumbs = (
        <>
          {fromMap
            ? crumb(FULL_MAP, running ? undefined : () => dispatch({ type: 'back' }))
            : crumb('Address search', running ? undefined : () => dispatch({ type: 'another-address-wanted' }))}
          {step === 'no-match' && (
            <>
              {separator}
              {crumb('No drain nearby', undefined, true)}
            </>
          )}
          {!fromMap && reached('drain') && (
            <>
              {separator}
              {crumb('Choose a drain', running ? undefined : () => dispatch({ type: 'drains-reopened' }), step === 'drain')}
            </>
          )}
          {reached('scenario') && (
            <>
              {separator}
              {crumb(
                'Choices',
                running ? undefined : () => dispatch({ type: step === 'review' ? 'choices-changed' : 'change-scenario' }),
                step === 'scenario',
              )}
            </>
          )}
          {step === 'review' && (
            <>
              {separator}
              {crumb('Review', undefined, true)}
            </>
          )}
          {step === 'result' && (
            <>
              {separator}
              {crumb('Result', undefined, true)}
            </>
          )}
        </>
      );

      const shell = (children: React.ReactNode) => (
        <Shell at={session.screen} credits={credits} extentName={loaded.extentName} crumbs={crumbs}>
          {children}
        </Shell>
      );

      const fullMap = () => {
        dispatch({ type: 'map-opened', from: 'home' });
      };

      if (step === 'no-match') {
        const example = demonstrationAddress(loaded.index);
        return shell(
          <NoMatch
            addressLabel={address?.label ?? null}
            onAnotherAddress={() => dispatch({ type: 'another-address-wanted' })}
            onExample={
              example === undefined || example.id === address?.id
                ? undefined
                : () =>
                    dispatch({
                      type: 'example-address-chosen',
                      address: { id: example.id, label: example.label, eastingM: example.e, northingM: example.n },
                    })
            }
            onFullMap={fullMap}
          />,
        );
      }

      // Every map step needs the worker's list before it can mark a drain as
      // testable, and step 1 needs the eligibility check's answer too.
      if (!scenario.ready && scenario.failure !== null) {
        return shell(<DrainsUnavailable onRetry={scenario.retry} onFullMap={fullMap} />);
      }
      if (!scenario.ready || (step === 'drain' && (eligibility === null || eligibility.nearest === null))) {
        return shell(<FindingDrains nearAddress={address !== null} />);
      }

      const panel =
        step === 'drain' ? null : step === 'result' && outcome !== null ? (
          <Result
            outcome={
              outcome.kind === 'comparison'
                ? { status: 'successful', band: outcome.band }
                : { status: 'insufficient-information', reason: outcome.reason }
            }
            scenario={session.scenario}
            positions={positions}
            measuredShare={measuredShare}
            onRainfall={(rainfallMm) => {
              const solved = positions.find((p) => p.rainfallMm === rainfallMm);
              if (solved === undefined) return;
              dispatch({ type: 'result-rainfall', rainfallMm, band: solved.band });
            }}
            onAction={onAction}
          />
        ) : running ? (
          <Comparing blockage={session.scenario.blockage} onCancel={cancel} />
        ) : step === 'review' ? (
          <ScenarioReview
            address={address}
            scenario={session.scenario}
            distanceM={distanceM}
            onRun={startComparison}
            onChange={() => dispatch({ type: 'choices-changed' })}
          />
        ) : (
          <ScenarioChoices
            scenario={session.scenario}
            distanceM={distanceM}
            onBlockage={(blockage) => dispatch({ type: 'blockage-selected', blockage })}
            onRainfall={(rainfallMm) => dispatch({ type: 'rainfall-selected', rainfallMm })}
            onReview={() => dispatch({ type: 'choices-reviewed' })}
          />
        );

      return shell(
        <div className={panel === null ? 'comparison comparison--map-only' : 'comparison'}>
          {panel !== null && (
            // Keyed on the step, so each step's panel starts at its top and slides in.
            <aside key={step === 'result' ? 'result' : running ? 'comparing' : step} className="comparison__panel">
              {panel}
            </aside>
          )}
          <div className="comparison__map">
            <ComparisonMapPane
              loaded={loaded}
              step={step}
              addressAt={addressAt}
              addressLabel={address?.label ?? null}
              eligibility={eligibility}
              supported={scenario.supported}
              withoutGround={scenario.withoutGround}
              pitId={pitId}
              difference={differenceShown}
              fitKey={fit.key}
              fitPoints={fit.points}
              locked={running}
              onChoose={(chosen, suggested) => {
                dispatch({ type: 'pit-selected', pitId: chosen, suggested });
              }}
            />
          </div>
        </div>,
      );
    }

    default:
      return (
        <MapScreen
          credits={credits}
          loaded={loaded}
          session={session}
          dispatch={dispatch}
          crumb={crumb}
        />
      );
  }
}

/**
 * The map, its frame, and the tour that points at the frame's controls.
 *
 * A component of its own because the tour is state, and the screen it belongs
 * to was the default arm of a switch inside `App` — where a `useState` cannot
 * go. The tour also has to sit outside `MapView`: its button belongs on the
 * breadcrumb row, which is the Shell's, and its overlay covers the whole
 * window rather than the map pane.
 */
function MapScreen({
  credits,
  loaded,
  session,
  dispatch,
  crumb,
}: {
  readonly credits: readonly Credit[];
  readonly loaded: Loaded;
  readonly session: Session;
  readonly dispatch: (event: SessionEvent) => void;
  readonly crumb: (label: string, onClick?: () => void, current?: boolean) => React.ReactNode;
}) {
  const [touring, setTouring] = useState(false);
  // Which drains the comparison can use, for the pit card's way in (AC 3.1.1).
  const scenarioSupport = useScenarioSupport(true);

  /*
    Open it once, for somebody who has not had it.

    In an effect rather than in the initial state, because it writes: the
    first thing it does is record that the tour has been shown, so a person
    who dismisses it immediately is not met with it again on their way back
    in. Recorded on opening rather than on finishing, so somebody who closes
    the tab halfway through has still been offered it.

    Nothing here waits for the map. A step whose target is not on screen
    yet degrades to a card with no spotlight -- `useTargetBox` returns null
    and re-measures on the next resize -- and by this point `loaded` has
    already resolved, so the controls are in the same commit as this effect.
  */
  useEffect(() => {
    if (tourGate.seen()) return;
    tourGate.remember();
    setTouring(true);
  }, []);

  return (
    <Shell
      at={session.screen}
      credits={credits}
          extentName={loaded.extentName}
      // Inside the map, the name at the top tells somebody something they
      // worked out by arriving. The row below carries the way back out.
      masthead={false}
      /*
        The Back control names where it goes, because the map has two ways
        in -- the homepage and the flood board -- and with two possible
        origins a bare "Back" is a guess.

        The trail beside it is one crumb now. It used to lead with a
        clickable Home, which was doing two jobs badly: a breadcrumb says
        where you *are*, and a person looking for the way out does not read
        a location as an exit. The button is the exit; the crumb says where
        they are.
      */
      back={{
        label: session.mapOrigin === 'history' ? 'Flood history' : 'Home',
        onBack: () => {
          dispatch({ type: 'leave-map' });
        },
      }}
      crumbs={crumb(
        session.task === 'full-map' ? FULL_MAP : 'Explore drainage',
        undefined,
        true,
      )}
      trailing={
        <TourButton
          onOpen={() => {
            setTouring(true);
          }}
        />
      }
    >
      <MapView
        /*
          Remounted on every arrival, so the map cannot open carrying a pit
          card, a traced path or a set of chips from the last visit. It was
          already true by accident -- React unmounts this on the way out --
          and this makes it true on purpose. See `mapOpenings` in session.ts.
        */
        key={session.mapOpenings}
        map={loaded.map}
        derived={loaded.derived}
        trace={loaded.trace}
        address={session.address}
        task={session.task}
        mode={session.mapMode}
        index={loaded.index}
        onAddress={(picked) =>
          dispatch({
            type: 'address-moved',
            address: {
              id: picked.id,
              label: picked.label,
              eastingM: picked.e,
              northingM: picked.n,
            },
          })
        }
        onClearAddress={() => {
          dispatch({ type: 'address-cleared' });
        }}
        scenarioSupport={scenarioSupport}
        onCompare={(pitId) => {
          dispatch({ type: 'scenario-from-map', pitId });
        }}
      />
      {touring && (
        <Tour
          onClose={() => {
            setTouring(false);
          }}
        />
      )}
    </Shell>
  );
}

/**
 * The way back in, for anybody who has already been shown it.
 *
 * **This used to say the tour does not open by itself, and why.** The argument
 * was that deciding whether this *is* a first visit means writing something to
 * the browser and reading it back, and that a product whose position is that
 * it holds nothing about you should not begin by storing a fact about you in
 * order to be helpful. It is written out here rather than deleted, because the
 * reversal is the decision worth being able to find.
 *
 * What changed is the weighing, not the principle. A first-time visitor
 * arriving on a map with no basemap, four layers and a mode switch should not
 * have to find a button to be told what they are looking at, and the thing
 * being stored — `drainlens.tour.seen`, holding `"1"` — says only that
 * somebody on this browser has been shown it once. No address, no identifier,
 * no timestamp, no count. `tourGate.ts` states what is written and what is
 * not, and `session.ts` still writes nothing at all.
 *
 * The button stays, because "seen once" and "understood" are different, and a
 * tour that can only be seen once is a tour somebody will want back.
 */
function TourButton({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space(2),
        padding: `${String(space(1))}px ${String(space(3))}px`,
        border: `1px solid ${line.base}`,
        borderRadius: radius.base,
        background: surface.raised,
        color: ink.strong,
        font: type(text.label, { weight: weight.medium, leading: 1.4 }),
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M5.9 6.1a2.1 2.1 0 1 1 2.5 2.1v1.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8.4" cy="11.6" r="0.95" fill="currentColor" />
      </svg>
      Tutorial
    </button>
  );
}

/**
 * The map beside the scenario panel.
 *
 * AC 2.2.1.d (Aug-27 set): the selected pit and its recorded downstream path stay visible
 * while a result is on screen. Without them the difference is highlighted over
 * a map that has forgotten which drain the person was asking about, and the
 * result reads as a statement about the whole neighbourhood.
 *
 * `MapCanvas` directly rather than `MapView`, because the panel is suppressed
 * here anyway and this map is driven by the scenario rather than by its own
 * selection.
 */
/**
 * The homepage's navigation: the two places it can send you.
 *
 * **It used to carry three in-page anchors as well** — *What you can do*, *How
 * it works*, *About the data* — and they are gone from 4 September. A header
 * that mixes two kinds of control teaches neither: three of the five scrolled
 * the page you were already on and two opened a different one, and nothing in
 * the row said which was which. What is left is only the second kind.
 *
 * They also disappeared below 820px, which meant the header a person met on a
 * laptop and the header they met on a phone were different headers. This one
 * is the same everywhere, which is the second reason to prefer it: the narrow
 * layout was already the honest one.
 *
 * The sections themselves keep their ids — they are named by the acceptance
 * criteria and are still there to scroll to.
 */
function HomeNav({
  onOpenMap,
  onOpenHistory,
}: {
  readonly onOpenMap: () => void;
  readonly onOpenHistory: () => void;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: space(5) }}>
      <button
        type="button"
        onClick={onOpenHistory}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: type(text.label, { weight: weight.medium }),
          color: ink.muted,
        }}
      >
        Flood history
      </button>
      <button
        type="button"
        onClick={onOpenMap}
        style={{
          padding: `${String(space(2))}px ${String(space(4))}px`,
          font: type(text.label, { weight: weight.semibold }),
          color: ink.inverse,
          background: ink.strong,
          border: 'none',
          borderRadius: radius.base,
        }}
      >
        Get started →
      </button>
    </span>
  );
}

/**
 * The comparison's map, with the selected drain's recorded downstream path.
 *
 * AC 3.1.1.c and 3.1.3.c: the selected drain and its path stay visible while
 * the choices are made and while a result is on screen. Without them the
 * difference is highlighted over a map that has forgotten which drain the
 * person was asking about, and the result reads as a statement about the
 * whole neighbourhood.
 */
function ComparisonMapPane({
  loaded,
  step,
  addressAt,
  addressLabel,
  eligibility,
  supported,
  withoutGround,
  pitId,
  difference,
  fitKey,
  fitPoints,
  locked,
  onChoose,
}: {
  readonly loaded: Loaded;
  readonly step: 'drain' | 'scenario' | 'review' | 'result';
  readonly addressAt: Local | null;
  readonly addressLabel: string | null;
  readonly eligibility: ReturnType<typeof comparableNear> | null;
  readonly supported: ReadonlySet<string>;
  readonly withoutGround: ReadonlySet<string>;
  readonly pitId: string | null;
  readonly difference: DifferenceArea | null;
  readonly fitKey: string;
  readonly fitPoints: readonly Local[];
  readonly locked: boolean;
  readonly onChoose: (pitId: string, suggested: boolean) => void;
}) {
  const followed = useMemo(
    () => (pitId === null || step === 'drain' ? null : traceDownstream(loaded.trace, pitId)),
    [loaded.trace, pitId, step],
  );

  return (
    <ComparisonMap
      map={loaded.map}
      step={step}
      address={addressAt}
      addressLabel={addressLabel}
      eligibility={eligibility}
      supported={supported}
      withoutGround={withoutGround}
      selectedPitId={pitId}
      trace={followed}
      difference={difference}
      fitKey={fitKey}
      fitPoints={fitPoints}
      locked={locked}
      onChoose={onChoose}
    />
  );
}

/** Where a pit is on the served map, in local metres, or null. */
function pitPosition(loaded: Loaded, pitId: string): Local | null {
  const pit = (loaded.map.layers.pit ?? []).find((p) => String(p.asset_number ?? '') === pitId);
  return pit === undefined ? null : [pit.c[0], pit.c[1]];
}

/**
 * Every screen of the blocked-drain comparison, for the worker and the layout.
 *
 * `no-match` is one of them so that *Try an example address* finds the worker
 * already holding its list.
 */
const COMPARISON_SCREENS: ReadonlySet<Session['screen']> = new Set<Session['screen']>([
  'drain',
  'scenario',
  'review',
  'result',
  'no-match',
]);
