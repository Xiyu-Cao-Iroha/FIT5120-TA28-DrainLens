/**
 * The screen the session says we are on, and nothing more.
 *
 * All navigation goes through the reducer in `session.ts`, so the rule that
 * the address never reaches storage is enforced in one tested place rather
 * than at every screen that happens to touch it.
 */

import { useEffect, useMemo, useReducer, useState } from 'react';

import type { AddressIndex } from './address/search.js';
import { type MapArtefact, assertUsable } from './map/artefact.js';
import { type DerivedArtefact, assertDerived } from './map/derived.js';
import { type TraceArtefact, assertTrace, traceDownstream } from './trace/graph.js';
import { EVERYTHING, MapView } from './screens/MapView.js';
import { MapCanvas } from './map/MapCanvas.js';
import { FloodHistory } from './screens/FloodHistory.js';
import { type FloodHistoryArtefact, assertFloodHistory } from './history/artefact.js';
import { Home } from './screens/Home.js';
import { Landing } from './screens/Landing.js';
import { Result } from './screens/Result.js';
import { ScenarioSetup } from './screens/ScenarioSetup.js';
import { TaskSelect } from './screens/TaskSelect.js';
import type { DifferenceArea } from './map/difference.js';
import { ink, line, radius, shadow, space, surface, text, type, weight } from './ui/theme.js';
import type { Action } from './scenario/outcome.js';
import { useScenario } from './scenario/useScenario.js';
import type { SceneDrain, SolvedPosition } from './scenario/worker.js';
import {
  INITIAL_SESSION,
  type Session,
  type SessionEvent,
  type SupportedAddress,
  reduce,
} from './session.js';
import { Shell } from './ui/Shell.js';
import { Tour } from './ui/Tour.js';
import { type Credit, creditsFor } from './ui/attribution.js';

interface Loaded {
  readonly map: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly trace: TraceArtefact;
  readonly index: AddressIndex;
  readonly history: FloodHistoryArtefact;
  readonly fixtureNote: string | undefined;
}

async function load(): Promise<Loaded> {
  // The flood history is 5.4 KB and joins the others rather than being
  // fetched when the board opens: a separate round trip for five kilobytes
  // buys a loading state nobody needed.
  const [map, derived, trace, addresses, history] = await Promise.all([
    fetch('/data/map.json').then((r) => r.json()),
    fetch('/data/derived.json').then((r) => r.json()),
    fetch('/data/trace.json').then((r) => r.json()),
    fetch('/data/addresses.json').then((r) => r.json()),
    fetch('/data/flood-history.json').then((r) => r.json()),
  ]);

  assertUsable(map);
  assertDerived(derived);
  assertTrace(trace);
  assertFloodHistory(history);

  const index = addresses as AddressIndex & { fixture?: string };
  if (!Array.isArray(index.addresses)) {
    throw new Error('the address index carries no addresses');
  }
  return { map, derived, trace, index, history, fixtureNote: index.fixture };
}

export function App() {
  const [session, dispatch] = useReducer(reduce, INITIAL_SESSION);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Only the two comparison screens use it, and neither is reachable in the
  // Iteration 1 interface. See the note at the top of `useScenario`.
  const scenario = useScenario(
    '/data/scene',
    session.screen === 'scenario' || session.screen === 'result',
  );
  // Every position the last run solved. The rainfall control on the result
  // reads these, so changing the amount cannot start a second calculation and
  // therefore cannot return a different answer for the same inputs (AC 2.2).
  const [positions, setPositions] = useState<readonly SolvedPosition[]>([]);
  // Metres per grid cell, from the run that produced `positions`. Held beside
  // them so the two can never describe different grids.
  const [cellSizeM, setCellSizeM] = useState(1);
  // The scenario panel is 420px of a laptop screen. Reading a result means
  // looking at the map it is about, and a teammate reported not being able to.
  const [panelOpen, setPanelOpen] = useState(true);

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
        <p style={{ padding: 24 }}>Loading the pilot area…</p>
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

  const separator = <span style={{ margin: '0 8px', color: '#c3cdba' }}>›</span>;

  switch (session.screen) {
    case 'home':
      return (
        <Shell
          credits={credits}
          actions={
            <HomeNav
              onOpenMap={() => {
                dispatch({ type: 'map-opened' });
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
              dispatch({ type: 'map-opened', from: 'home', ...(mode ? { mode } : {}) });
            }}
            onOpenHistory={() => {
              dispatch({ type: 'history-opened' });
            }}
          />
        </Shell>
      );

    case 'history':
      return (
        <Shell
          credits={credits}
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
        <Shell credits={credits}>
          <Landing
            index={loaded.index}
            fixtureNote={loaded.fixtureNote}
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
          />
        </Shell>
      );

    case 'task':
      return (
        <Shell
          credits={credits}
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

    case 'scenario':
    case 'result': {
      const onAction = (action: Action) => {
        switch (action) {
          case 'change-scenario':
          case 'review-scenario':
            dispatch({ type: 'change-scenario' });
            return;
          case 'choose-another-pit':
            // Keep the rainfall and the blockage: they were the person's own
            // assumptions and the pit is the thing that did not work.
            dispatch({ type: 'change-scenario' });
            return;
          case 'try-again':
            dispatch({ type: 'comparison-started' });
            dispatch({ type: 'comparison-finished', outcome: { kind: 'insufficient', reason: 'scenario_calculation_failed' } });
            return;
          case 'change-address':
            dispatch({ type: 'change-address' });
            return;
          case 'return-to-map':
            dispatch({ type: 'task-chosen', task: 'full-map' });
            return;
        }
      };

      const outcome = session.outcome;
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
              cells:
                positions.find((p) => p.rainfallMm === session.scenario.rainfallMm)
                  ?.higherAreasM ?? [],
              cellSizeM,
            }
          : null;
      return (
        <Shell
          credits={credits}
          crumbs={
            <>
              {crumb('Address search', () => dispatch({ type: 'change-address' }))}
              {separator}
              {crumb('Choose a task', () => dispatch({ type: 'task-chosen', task: 'compare' }))}
              {separator}
              {crumb('Compare scenario', () => dispatch({ type: 'change-scenario' }), session.screen === 'scenario')}
              {session.screen === 'result' && (
                <>
                  {separator}
                  {crumb('Result', undefined, true)}
                </>
              )}
            </>
          }
        >
          <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
            <div
              style={{
                width: panelOpen ? 420 : 0,
                flexShrink: 0,
                overflow: panelOpen ? 'auto' : 'hidden',
                borderRight: panelOpen ? `1px solid ${line.base}` : 'none',
                background: surface.raised,
                transition: 'width 160ms ease',
              }}
              aria-hidden={!panelOpen}
            >
              {session.screen === 'result' && outcome !== null ? (
                <Result
                  outcome={
                    outcome.kind === 'comparison'
                      ? { status: 'successful', band: outcome.band }
                      : { status: 'insufficient-information', reason: outcome.reason }
                  }
                  scenario={session.scenario}
                  positions={positions}
                  onRainfall={(rainfallMm) => {
                    const solved = positions.find((p) => p.rainfallMm === rainfallMm);
                    if (solved === undefined) return;
                    dispatch({ type: 'rainfall-selected', rainfallMm });
                    dispatch({
                      type: 'comparison-finished',
                      outcome: { kind: 'comparison', band: solved.band },
                    });
                  }}
                  onAction={onAction}
                />
              ) : (
                <ScenarioSetup
                  address={session.address!}
                  scenario={session.scenario}
                  suggestedPitId={
                    session.scenario.pitId === null
                      ? nearestInlet(loaded, session.address, scenario.drains)
                      : null
                  }
                  onUsePit={(pitId, suggested) => dispatch({ type: 'pit-selected', pitId, suggested })}
                  onBlockage={(blockage) => dispatch({ type: 'blockage-selected', blockage })}
                  onRainfall={(rainfallMm) => dispatch({ type: 'rainfall-selected', rainfallMm })}
                  onRun={() => {
                    // The scene's own cell for this asset. Never recomputed
                    // from the map geometry: the pipeline snaps drains onto
                    // the flow field, so a cell worked out here disagrees with
                    // the scene for every drain in the extent.
                    const drain = scenario.drains.find(
                      (d) => d.assetNumber === session.scenario.pitId,
                    );
                    const cell = drain?.isInlet === true ? drain.cell : null;
                    if (cell === null || session.scenario.blockage === null) {
                      // A pit the scene does not place cannot carry a
                      // scenario, and that is an inlet problem rather than a
                      // crash.
                      dispatch({ type: 'comparison-started' });
                      dispatch({
                        type: 'comparison-finished',
                        outcome: { kind: 'insufficient', reason: 'invalid_inlet' },
                      });
                      return;
                    }

                    dispatch({ type: 'comparison-started' });
                    void scenario
                      .run(cell, session.scenario.blockage, session.scenario.rainfallMm)
                      .then((result) => {
                        // Cleared on failure: leaving the previous run's
                        // positions attached would let the control offer
                        // answers to a question nobody asked.
                        setPositions(result.status === 'successful' ? result.positions : []);
                        if (result.status === 'successful') setCellSizeM(result.cellSizeM);
                        dispatch({
                          type: 'comparison-finished',
                          outcome:
                            result.status === 'successful'
                              ? { kind: 'comparison', band: result.band }
                              : { kind: 'insufficient', reason: result.reason },
                        });
                      });
                  }}
                  onReset={() => dispatch({ type: 'reset-choices' })}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              {/*
                Over the map rather than beside it, so the button does not
                move when the panel does — a control that runs away from the
                cursor as it works is one people stop trusting.
              */}
              <button
                type="button"
                onClick={() => setPanelOpen((open) => !open)}
                aria-expanded={panelOpen}
                style={{
                  position: 'absolute',
                  top: space(3),
                  left: space(3),
                  zIndex: 2,
                  padding: `${String(space(2))}px ${String(space(3))}px`,
                  borderRadius: radius.base,
                  border: `1px solid ${line.base}`,
                  // Translucent, because it sits over the map and a solid
                  // chip would punch a white hole in the thing it floats on.
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(6px)',
                  font: type(text.label, { weight: weight.medium }),
                  color: ink.strong,
                  boxShadow: shadow.floating,
                }}
              >
                {panelOpen ? '‹ Hide panel' : '› Show panel'}
              </button>
              <MapCanvasPane
                loaded={loaded}
                session={session}
                suggestedPitId={
                  session.scenario.pitId === null
                    ? nearestInlet(loaded, session.address, scenario.drains)
                    : null
                }
                scenarioDrains={
                  new Set(scenario.drains.filter((d) => d.isInlet).map((d) => d.assetNumber))
                }
                difference={differenceShown}
                onPickPit={(pitId) =>
                  dispatch({ type: 'pit-selected', pitId, suggested: false })
                }
              />
            </div>
          </div>
        </Shell>
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

  return (
    <Shell
      credits={credits}
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
        session.task === 'full-map' ? 'Full map' : 'Explore drainage',
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
 * The way in, and the reason the tour needs no stored state.
 *
 * It does not open by itself on a first visit. Deciding whether this *is* a
 * first visit means writing something to the browser and reading it back, and
 * a product whose position is that it holds nothing about you should not begin
 * by storing a fact about you in order to be helpful. A control that is always
 * there costs a person one press and costs the product nothing.
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
        Explore map →
      </button>
    </span>
  );
}

function MapCanvasPane({
  loaded,
  session,
  suggestedPitId,
  scenarioDrains,
  difference,
  onPickPit,
}: {
  readonly loaded: Loaded;
  readonly session: Session;
  readonly suggestedPitId: string | null;
  /** The finished comparison's difference cells, or null off the result screen. */
  readonly difference: DifferenceArea | null;
  /** Asset numbers the scene places as inlets. Anything else cannot run. */
  readonly scenarioDrains: ReadonlySet<string>;
  readonly onPickPit: (pitId: string) => void;
}) {
  const pitId = session.scenario.pitId;
  const followed = useMemo(
    () => (pitId === null ? null : traceDownstream(loaded.trace, pitId)),
    [loaded.trace, pitId],
  );

  return (
    <MapCanvas
      artefact={loaded.map}
      derived={loaded.derived}
      show={EVERYTHING}
      selectedPit={pitId === null ? null : Number(pitId)}
      // Shown only while nothing is chosen. A suggestion the panel names by
      // asset number and the map does not mark leaves the person holding an
      // identifier with no way to find it — which is what a teammate hit.
      suggestedPit={pitId === null && suggestedPitId !== null ? Number(suggestedPitId) : null}
      address={
        session.address === null
          ? null
          : [session.address.eastingM, session.address.northingM]
      }
      trace={followed}
      difference={difference}
      onSelect={(hit) => {
        // Only a pit, and only one the engine can use. Tapping a pipe or a
        // junction here would silently set a scenario the engine is bound to
        // reject, which is how a wrong answer looks exactly like a right one.
        if (hit?.kind !== 'pit') return;
        const asset = String(hit.feature.asset_number ?? '');
        if (scenarioDrains.has(asset)) onPickPit(asset);
      }}
    />
  );
}

/**
 * The nearest inlet to the address, as the setup screen's suggestion.
 *
 * A real pit, not a placeholder. The first version of this screen carried
 * `P-14` from the design mock, and because no real pit has that identifier the
 * comparison never reached the engine at all — it fell into the guard for a
 * pit the scene cannot place and reported an unusable inlet. A wrong answer
 * that looked exactly like a right one.
 *
 * Only inlets are offered. A junction or a submerged node cannot carry a
 * surface blockage, and suggesting one would set a scenario the engine is
 * bound to reject.
 */
function nearestInlet(
  loaded: Loaded,
  address: SupportedAddress | null,
  drains: readonly SceneDrain[],
): string | null {
  const pits = loaded.map.layers.pit ?? [];
  if (address === null || pits.length === 0 || drains.length === 0) return null;

  // Only what the engine will accept. Reading "is this an inlet?" off the
  // asset description instead was how a suggestion the scene cannot place
  // reached the screen, and the comparison then failed on the person rather
  // than on us.
  const usable = new Set(
    drains.filter((drain) => drain.isInlet).map((drain) => drain.assetNumber),
  );

  let bestId: string | null = null;
  let bestDistance = Infinity;
  for (const pit of pits) {
    const asset = String(pit.asset_number ?? '');
    if (!usable.has(asset)) continue;
    const distance = Math.hypot(pit.c[0] - address.eastingM, pit.c[1] - address.northingM);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = asset;
    }
  }
  return bestId;
}
