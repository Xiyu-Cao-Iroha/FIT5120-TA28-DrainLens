/**
 * The map, with the modes the way in asked for.
 *
 * Three things can decide what is on when it opens, in order of precedence: a
 * mode chosen on the homepage (AC 1.1.2), the guided task, or nothing at all —
 * in which case every mode is on, because nothing has been narrowed yet.
 *
 * **The two levels of control are combined here and nowhere else.** `modes`
 * is the chip row, `sub` is what sits behind the Layers button, and
 * `effectiveLayers` is the single function that turns the pair into the
 * `LayerState` the canvas draws. The canvas has never heard of a mode.
 *
 * **The chrome is deliberately in pieces.** It used to be one 310px panel
 * carrying the address, the instruction, the sentence about nearby water, six
 * layer checkboxes and whatever was selected — over the top-left corner of a
 * one-kilometre map, which is a lot of map to cover to read a list. Each part
 * now sits where it belongs: controls along the top, the legend at the bottom,
 * and the selected feature in a card that only exists when something is
 * selected.
 */

import { useEffect, useMemo, useState } from 'react';

import type { AddressIndex, IndexedAddress, Match } from '../address/search.js';
import { MAX_SUGGESTIONS, search } from '../address/search.js';
import type { MapArtefact } from '../map/artefact.js';
import type { DerivedArtefact } from '../map/derived.js';
import type { Hit } from '../map/hit.js';
import { MapCanvas } from '../map/MapCanvas.js';
import { MapLegend, ModeChips } from '../map/MapLayers.js';
import {
  ALL_MODES,
  GUIDED_MODES,
  type MapMode,
  type ModeState,
  type SubLayerKey,
  type SubLayerState,
  effectiveLayers,
  openingModes,
  subLayersWith,
  visibilityOf,
} from '../map/modes.js';
import { NEARBY_BASIS, describeWaterNearby } from '../map/nearby.js';
import { loadTerrain, rasterise } from '../map/terrain.js';
import type { SupportedAddress, Task } from '../session.js';
import { type TraceArtefact, traceDownstream } from '../trace/graph.js';
import {
  basis as basisTone,
  ink,
  line,
  radius,
  shadow,
  space,
  surface,
  text,
  tracking,
  type,
  weight,
} from '../ui/theme.js';
import { PitDetail } from './PitDetail.js';

/**
 * What the map opens with.
 *
 * A mode chosen on the homepage wins, because it is the most recent thing the
 * person said. The guided task is the next-best signal, and the unguided map
 * turns everything on including the hatching — somebody who asked for the whole
 * pilot area has asked to see where it is thin as well.
 */
function openingState(
  mode: MapMode | null,
  guided: boolean,
): { readonly modes: ModeState; readonly sub: SubLayerState } {
  if (mode !== null) return { modes: openingModes(mode), sub: subLayersWith(false) };
  if (guided) return { modes: GUIDED_MODES, sub: subLayersWith(false) };
  return { modes: ALL_MODES, sub: subLayersWith(true) };
}

export interface MapViewProps {
  readonly map: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly trace: TraceArtefact;
  readonly address: SupportedAddress | null;
  readonly task: Task | null;
  /** A mode named on the way in, which decides what is on when the map opens. */
  readonly mode?: MapMode | null;
  readonly onBack: () => void;
  /** The side panel is suppressed when the map sits beside another one. */
  readonly panel?: boolean;
  /** Present only where the map is the whole screen and search makes sense. */
  readonly index?: AddressIndex | undefined;
  readonly onAddress?: ((address: IndexedAddress) => void) | undefined;
}

export function MapView({
  map,
  derived,
  trace,
  address,
  task,
  mode = null,
  onBack,
  panel = true,
  index,
  onAddress,
}: MapViewProps) {
  // Also decides whether the map offers a next step, which only a guided task
  // has. Arriving from a homepage mode card is `full-map`: a mode is a view,
  // not an instruction, and nobody asked to be walked through anything.
  const guided = task !== 'full-map';
  const opening = openingState(mode, guided);
  const [modes, setModes] = useState<ModeState>(opening.modes);
  const [sub, setSub] = useState<SubLayerState>(opening.sub);
  const [hit, setHit] = useState<Hit | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const [terrain, setTerrain] = useState<HTMLCanvasElement | null>(null);
  const [chromeOpen, setChromeOpen] = useState(true);

  // Painted once, then reused for every pan and zoom. A failure here leaves
  // the layer off rather than breaking the map: the terrain is context, and
  // the recorded network is what the person came for.
  useEffect(() => {
    let live = true;
    loadTerrain('/data/scene')
      .then((raster) =>
        rasterise(raster, (w, h) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          return canvas;
        }),
      )
      .then((painted) => {
        if (live) setTerrain(painted);
      })
      .catch(() => {
        if (live) setTerrain(null);
      });
    return () => {
      live = false;
    };
  }, []);

  const explanation = useMemo(
    () =>
      address === null
        ? null
        : describeWaterNearby(derived, [address.eastingM, address.northingM]),
    [derived, address],
  );

  const selected = hit?.kind === 'pit' ? (hit.feature.asset_number ?? null) : null;

  // Recomputed only when the followed pit changes. The traversal is cheap,
  // but it runs inside a render that also happens on every pan.
  const followed = useMemo(
    () => (following === null ? null : traceDownstream(trace, following)),
    [trace, following],
  );

  const layers = useMemo(() => effectiveLayers(modes, sub), [modes, sub]);

  const toggleMode = (key: MapMode) => {
    setModes((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleSub = (key: SubLayerKey) => {
    setSub((current) => ({ ...current, [key]: !current[key] }));
  };

  // The terrain chip cannot be pressed until its raster exists. Shown disabled
  // rather than hidden: a control that vanishes reads as a control that was
  // never there, and this one is named by AC 1.1.4.
  const notYet: MapMode[] = terrain === null ? ['terrain'] : [];

  return (
    <>
      <MapCanvas
        artefact={map}
        derived={derived}
        show={visibilityOf(layers)}
        selectedPit={selected}
        terrain={layers.terrain ? terrain : null}
        showPits={layers.pit}
        showPipes={layers.pipe}
        address={address === null ? null : [address.eastingM, address.northingM]}
        trace={followed}
        onSelect={(next) => {
          setHit(next);
          // Selecting something else abandons the path. Leaving it drawn
          // would attach the previous answer to the new question.
          if (next?.kind !== 'pit' || String(next.feature.asset_number) !== following) {
            setFollowing(null);
          }
        }}
      />

      {panel && (
        <div
          style={{
            position: 'absolute',
            left: space(4),
            right: space(4),
            top: space(4),
            zIndex: 4,
            display: 'flex',
            gap: space(3),
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto', display: 'flex', gap: space(3), flexWrap: 'wrap' }}>
            {index && onAddress && <MapSearch index={index} address={address} onPick={onAddress} />}
            <ModeChips
              modes={modes}
              sub={sub}
              onToggleMode={toggleMode}
              onToggleSub={toggleSub}
              unavailableModes={notYet}
            />
          </div>
        </div>
      )}

      {panel && <MapLegend state={layers} />}

      {panel && (
        <aside
          style={{
            position: 'absolute',
            left: space(4),
            top: 64,
            width: 320,
            maxHeight: 'calc(100% - 84px)',
            overflow: 'auto',
            zIndex: 3,
            padding: `${String(space(4))}px ${String(space(4))}px`,
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${line.base}`,
            borderRadius: radius.large,
            boxShadow: shadow.floating,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: space(2) }}>
            <span style={{ flex: 1 }}>
              <span
                style={{
                  display: 'block',
                  font: type(text.micro, { weight: weight.semibold }),
                  letterSpacing: tracking.caps,
                  textTransform: 'uppercase',
                  color: ink.subtle,
                }}
              >
                Selected address
              </span>
              <strong
                style={{
                  display: 'block',
                  marginTop: space(1),
                  font: type(text.body, { weight: weight.semibold, leading: 1.35 }),
                  color: ink.strong,
                }}
              >
                {address?.label ?? 'No address selected'}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setChromeOpen((v) => !v);
              }}
              aria-expanded={chromeOpen}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: type(text.label, { weight: weight.medium }),
                color: ink.muted,
              }}
            >
              {chromeOpen ? '‹ Hide' : '› More'}
            </button>
          </div>

          {chromeOpen && (
            <>
              {guided && (
                <p
                  style={{
                    margin: `${String(space(3))}px 0 0`,
                    padding: `${String(space(3))}px ${String(space(3))}px`,
                    background: basisTone.recorded.fill,
                    borderRadius: radius.base,
                    font: type(text.label, { leading: 1.5 }),
                    color: ink.base,
                  }}
                >
                  <strong style={{ display: 'block', fontWeight: weight.semibold }}>
                    Your next step
                  </strong>
                  Select a highlighted surface-water path or a nearby drainage pit.
                </p>
              )}

              {explanation !== null && (
                <p
                  style={{
                    margin: `${String(space(3))}px 0 0`,
                    padding: `${String(space(3))}px ${String(space(3))}px`,
                    background: basisTone.derived.fill,
                    borderRadius: radius.base,
                    font: type(text.label, { leading: 1.5 }),
                    color: ink.base,
                  }}
                >
                  {explanation}
                  <Badge basis={NEARBY_BASIS} />
                </p>
              )}

              <div
                style={{
                  marginTop: space(4),
                  paddingTop: space(3),
                  borderTop: `1px solid ${line.hair}`,
                  minHeight: 44,
                }}
              >
                {hit === null ? (
                  <span style={{ color: ink.subtle, font: type(text.label) }}>
                    Select a drainage pit or pipe.
                  </span>
                ) : hit.kind === 'pit' ? (
                  <PitDetail
                    pit={hit.feature}
                    map={map}
                    artefact={trace}
                    trace={followed}
                    onFollow={() => {
                      setFollowing(String(hit.feature.asset_number));
                    }}
                    onClear={() => {
                      setFollowing(null);
                    }}
                  />
                ) : (
                  <>
                    <strong style={{ color: ink.strong }}>Pipe {hit.feature.ref}</strong>
                    <div style={{ color: ink.muted, font: type(text.label) }}>
                      {hit.feature.diameter ? `${String(hit.feature.diameter)} mm · ` : ''}
                      {hit.feature.material}
                    </div>
                    <Badge basis="Official recorded data" />
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onBack}
                style={{
                  marginTop: space(4),
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: type(text.label, { weight: weight.medium }),
                  color: '#1a5d4d',
                }}
              >
                ← Back to choose a task
              </button>
            </>
          )}
        </aside>
      )}
    </>
  );
}

/**
 * Searching from the map, rather than going back to the first screen.
 *
 * The same index and the same `search`, so a match here means exactly what a
 * match there means. Choosing one hands the address up to the session — the
 * map does not move itself, because the address is a decision the whole
 * application shares rather than a view state this screen owns.
 */
function MapSearch({
  index,
  address,
  onPick,
}: {
  readonly index: AddressIndex;
  readonly address: SupportedAddress | null;
  readonly onPick: (address: IndexedAddress) => void;
}) {
  const [typed, setTyped] = useState('');
  const [focused, setFocused] = useState(false);

  const matches: Match[] = useMemo(
    () => (typed.trim().length >= 2 ? search(index, typed, MAX_SUGGESTIONS) : []),
    [index, typed],
  );

  return (
    <div style={{ position: 'relative', width: 268 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space(2),
          padding: `${String(space(2))}px ${String(space(3))}px`,
          background: surface.raised,
          border: `1px solid ${focused ? '#1f6f5c' : line.base}`,
          borderRadius: radius.base,
          boxShadow: shadow.floating,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden focusable="false">
          <circle cx="7" cy="7" r="4.6" fill="none" stroke={ink.subtle} strokeWidth="1.5" />
          <path d="m10.6 10.6 3.4 3.4" stroke={ink.subtle} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          placeholder={address?.label ?? 'Search an address'}
          aria-label="Search for an address"
          autoComplete="off"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            font: type(text.label),
            color: ink.strong,
          }}
        />
        {typed !== '' && (
          <button
            type="button"
            onClick={() => {
              setTyped('');
            }}
            aria-label="Clear the search"
            style={{ background: 'none', border: 'none', padding: 0, color: ink.subtle }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden focusable="false">
              <path
                d="m4 4 8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/*
        Shown whenever there is something to show, rather than only while the
        field has focus. Gating it on focus meant a delayed blur could hide the
        list out from under a click, or leave it hidden after a programmatic
        focus that fired no event -- a list that is sometimes there is worse
        than one that is always there while you are typing.
      */}
      {matches.length > 0 && (
        <ul
          aria-label="Matching addresses"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 6,
            listStyle: 'none',
            margin: 0,
            padding: space(1),
            background: surface.raised,
            border: `1px solid ${line.base}`,
            borderRadius: radius.base,
            boxShadow: shadow.lifted,
          }}
        >
          {matches.map((match) => (
            <li key={match.address.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(match.address);
                  setTyped('');
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: `${String(space(2))}px ${String(space(2))}px`,
                  border: 'none',
                  borderRadius: radius.small,
                  background: 'transparent',
                  font: type(text.label),
                  color: ink.base,
                }}
              >
                {match.address.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Badge({ basis }: { readonly basis: string }) {
  const tone = basis === 'Official recorded data' ? basisTone.recorded : basisTone.derived;
  return (
    <span
      style={{
        display: 'inline-block',
        marginTop: space(2),
        padding: `1px ${String(space(2))}px`,
        borderRadius: radius.pill,
        font: type(text.micro, { leading: 1.5 }),
        background: tone.fill,
        color: tone.ink,
      }}
    >
      {basis}
    </span>
  );
}

/** Re-exported so the scenario screens keep the visibility they always had. */
export const EVERYTHING = visibilityOf(effectiveLayers(ALL_MODES, subLayersWith(true)));
