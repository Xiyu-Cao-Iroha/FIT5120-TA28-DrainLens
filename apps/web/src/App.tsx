/**
 * The screen the session says we are on, and nothing more.
 *
 * All navigation goes through the reducer in `session.ts`, so the rule that
 * the address never reaches storage is enforced in one tested place rather
 * than at every screen that happens to touch it.
 */

import { useEffect, useReducer, useState } from 'react';

import type { AddressIndex } from './address/search.js';
import { type MapArtefact, assertUsable } from './map/artefact.js';
import { type DerivedArtefact, assertDerived } from './map/derived.js';
import { MapView } from './screens/MapView.js';
import { Landing } from './screens/Landing.js';
import { Result } from './screens/Result.js';
import { ScenarioSetup } from './screens/ScenarioSetup.js';
import { TaskSelect } from './screens/TaskSelect.js';
import type { Action } from './scenario/outcome.js';
import { useScenario } from './scenario/useScenario.js';
import { INITIAL_SESSION, type SupportedAddress, reduce } from './session.js';
import { Shell } from './ui/Shell.js';

interface Loaded {
  readonly map: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly index: AddressIndex;
  readonly fixtureNote: string | undefined;
}

async function load(): Promise<Loaded> {
  const [map, derived, addresses] = await Promise.all([
    fetch('/data/map.json').then((r) => r.json()),
    fetch('/data/derived.json').then((r) => r.json()),
    fetch('/data/addresses.json').then((r) => r.json()),
  ]);

  assertUsable(map);
  assertDerived(derived);

  const index = addresses as AddressIndex & { fixture?: string };
  if (!Array.isArray(index.addresses)) {
    throw new Error('the address index carries no addresses');
  }
  return { map, derived, index, fixtureNote: index.fixture };
}

export function App() {
  const [session, dispatch] = useReducer(reduce, INITIAL_SESSION);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const scenario = useScenario('/data/scene');

  useEffect(() => {
    load()
      .then(setLoaded)
      .catch((error: unknown) => setProblem(String(error)));
  }, []);

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
    case 'address':
    case 'unsupported':
      return (
        <Shell>
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
          crumbs={
            <>
              {crumb('Address search', () => dispatch({ type: 'change-address' }))}
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
      return (
        <Shell
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
                width: 420,
                flexShrink: 0,
                overflow: 'auto',
                borderRight: '1px solid #e6ebe4',
                background: '#ffffff',
              }}
            >
              {session.screen === 'result' && outcome !== null ? (
                <Result
                  outcome={
                    outcome.kind === 'comparison'
                      ? { status: 'successful', band: outcome.band }
                      : { status: 'insufficient-information', reason: outcome.reason }
                  }
                  scenario={session.scenario}
                  onAction={onAction}
                />
              ) : (
                <ScenarioSetup
                  address={session.address!}
                  scenario={session.scenario}
                  suggestedPitId={
                    session.scenario.pitId === null
                      ? nearestInlet(loaded, session.address)
                      : null
                  }
                  onUsePit={(pitId, suggested) => dispatch({ type: 'pit-selected', pitId, suggested })}
                  onBlockage={(blockage) => dispatch({ type: 'blockage-selected', blockage })}
                  onRainfall={(rainfallMm) => dispatch({ type: 'rainfall-selected', rainfallMm })}
                  onRun={() => {
                    const pit = loaded.map.layers.pit?.find(
                      (p) => String(p.asset_number) === session.scenario.pitId,
                    );
                    const cell = cellOf(pit, loaded);
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
                      .then((result) =>
                        dispatch({
                          type: 'comparison-finished',
                          outcome:
                            result.status === 'successful'
                              ? { kind: 'comparison', band: result.band }
                              : { kind: 'insufficient', reason: result.reason },
                        }),
                      );
                  }}
                  onReset={() => dispatch({ type: 'reset-choices' })}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <MapCanvasPane loaded={loaded} />
            </div>
          </div>
        </Shell>
      );
    }

    default:
      return (
        <Shell
          crumbs={
            <>
              {crumb('Address search', () => dispatch({ type: 'change-address' }))}
              {separator}
              {crumb('Choose a task', () => dispatch({ type: 'back' }))}
              {separator}
              {crumb(session.task === 'full-map' ? 'Full map' : 'Explore drainage', undefined, true)}
            </>
          }
        >
          <MapView
            map={loaded.map}
            derived={loaded.derived}
            address={session.address}
            task={session.task}
            onBack={() => dispatch({ type: 'back' })}
          />
        </Shell>
      );
  }
}

/** The map beside the scenario panel, with everything derived shown. */
function MapCanvasPane({ loaded }: { readonly loaded: Loaded }) {
  return (
    <MapView
      map={loaded.map}
      derived={loaded.derived}
      address={null}
      task="full-map"
      onBack={() => undefined}
      panel={false}
    />
  );
}

/**
 * Which grid cell a pit sits in.
 *
 * The map ships pits in local metres and the engine indexes cells, so the two
 * frames meet here — in one place, using the grid the artefact declares rather
 * than a constant, so a change to the cell size cannot leave this stale.
 */
function cellOf(
  pit: { readonly c: readonly [number, number] } | undefined,
  loaded: Loaded,
): number | null {
  if (!pit) return null;
  const { width_m, height_m } = loaded.map.extent;
  const cell = 1;
  const cols = Math.round(width_m / cell);
  const rows = Math.round(height_m / cell);
  const col = Math.floor(pit.c[0] / cell);
  const row = rows - 1 - Math.floor(pit.c[1] / cell);
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  return row * cols + col;
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
function nearestInlet(loaded: Loaded, address: SupportedAddress | null): string | null {
  const pits = loaded.map.layers.pit ?? [];
  if (address === null || pits.length === 0) return null;

  let bestId: string | null = null;
  let bestDistance = Infinity;
  for (const pit of pits) {
    const description = String(pit.asset_description ?? '').toLowerCase();
    if (!description.includes('entry') && !description.includes('grated')) continue;
    const distance = Math.hypot(pit.c[0] - address.eastingM, pit.c[1] - address.northingM);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = String(pit.asset_number ?? '');
    }
  }
  return bestId;
}
