/**
 * The map, with the modes the way in asked for.
 *
 * Three things can decide what is on when it opens, in order of precedence: a
 * mode chosen on the homepage (AC 1.1.2), the guided task, or nothing at all —
 * in which case every mode is on, because nothing has been narrowed yet.
 *
 * **One `LayerState`, and the controls write to it directly.** The chips are
 * Pits, Pipes, Water flow and Low areas; Terrain and the data-quality hatching
 * sit behind the Layers button. Which control lives where is `modes.ts`,
 * along with the note on why that departs from AC 1.1.4 and 1.1.5.
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
import { MapCallout } from '../map/MapCallout.js';
import { MapCanvas } from '../map/MapCanvas.js';
import { type Local, type Viewport, toScreen } from '../map/viewport.js';
import { LayerChips, MapLegend } from '../map/MapLayers.js';
import {
  ALL_ON,
  GUIDED_ON,
  type LayerKey,
  type LayerState,
  type MapMode,
  openingLayers,
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
function openingState(mode: MapMode | null, guided: boolean): LayerState {
  if (mode !== null) return openingLayers(mode);
  return guided ? GUIDED_ON : ALL_ON;
}

export interface MapViewProps {
  readonly map: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly trace: TraceArtefact;
  readonly address: SupportedAddress | null;
  readonly task: Task | null;
  /** A mode named on the way in, which decides what is on when the map opens. */
  readonly mode?: MapMode | null;
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
  panel = true,
  index,
  onAddress,
}: MapViewProps) {
  // Also decides whether the map offers a next step, which only a guided task
  // has. Arriving from a homepage mode card is `full-map`: a mode is a view,
  // not an instruction, and nobody asked to be walked through anything.
  const guided = task !== 'full-map';
  const [layers, setLayers] = useState<LayerState>(() => openingState(mode, guided));
  const [hit, setHit] = useState<Hit | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const [terrain, setTerrain] = useState<HTMLCanvasElement | null>(null);
  // The transform the canvas drew with, reported upward so a callout can be
  // put at a feature rather than beside the map.
  const [viewport, setViewport] = useState<Viewport | null>(null);
  // Dismissed by the person, not by the address changing: picking a new
  // address should say something about the new one.
  const [addressCardOpen, setAddressCardOpen] = useState(true);
  useEffect(() => {
    setAddressCardOpen(true);
    // A new address is a new question. Leaving the previous pit selected would
    // answer the old one beside the new mark.
    setHit(null);
    setFollowing(null);
  }, [address]);

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

  const toggle = (key: LayerKey) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  };

  // The terrain chip cannot be pressed until its raster exists. Shown disabled
  // rather than hidden: a control that vanishes reads as a control that was
  // never there, and this one is named by AC 1.1.4.
  const notYet: LayerKey[] = terrain === null ? ['terrain'] : [];

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
        onViewport={setViewport}
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
            <LayerChips state={layers} onToggle={toggle} unavailableKeys={notYet} />
          </div>

          {/*
            The legend, at the top right and in the same row as the controls
            rather than pinned to a corner of its own. Two absolutely
            positioned overlays cannot see each other, so on a narrow window
            the chips wrapped onto a second line and landed on top of it. Here
            flexbox keeps them apart: `marginLeft: auto` holds the legend to
            the right, and if there is no room for both it wraps below the
            chips instead of under them.
          */}
          <MapLegend state={layers} />
        </div>
      )}

      {/*
        What was pressed, said where it was pressed — AC 1.1.7.b.

        This replaced a 320-pixel panel pinned to the left edge. The panel was
        not what the criterion asks for and it was not what a person needs: a
        pit on the right of the screen put the answer as far from the question
        as the window allowed, and the panel covered a quarter of the map on a
        laptop. Nothing it held was dropped. The short explanation is on the
        card, and everything AC 1.1.7.f requires — the recorded fields, the
        cross-section, the reason a path stops — is behind *More information*,
        which opens in place.
      */}
      {panel && viewport !== null && hit?.kind === 'pit' && onScreen(hit.feature.c, viewport) && (
        <MapCallout
          at={toScreen(viewport, hit.feature.c)}
          within={{ width: viewport.widthPx, height: viewport.heightPx }}
          title="Drainage pit"
          basis="Official recorded data"
          action={
            followed === null
              ? {
                  label: 'Show connected pipe',
                  onPress: () => {
                    setFollowing(String(hit.feature.asset_number));
                  },
                }
              : {
                  label: 'Hide the connected pipe',
                  onPress: () => {
                    setFollowing(null);
                  },
                }
          }
          more={
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
          }
          onClose={() => {
            setHit(null);
            setFollowing(null);
          }}
        >
          This pit collects surface water from the street and connects it to the recorded
          drainage network.
        </MapCallout>
      )}

      {panel && viewport !== null && hit?.kind === 'pipe' && onScreen(midpoint(hit.feature.c), viewport) && (
        <MapCallout
          at={toScreen(viewport, midpoint(hit.feature.c))}
          within={{ width: viewport.widthPx, height: viewport.heightPx }}
          title={`Pipe ${String(hit.feature.ref ?? '')}`.trim()}
          basis="Official recorded data"
          onClose={() => {
            setHit(null);
          }}
        >
          {hit.feature.diameter === undefined && hit.feature.material === undefined ? (
            'The record names this pipe but holds neither a diameter nor a material for it.'
          ) : (
            <>
              {hit.feature.diameter !== undefined && `${String(hit.feature.diameter)} mm wide. `}
              {hit.feature.material !== undefined && `Made of ${hit.feature.material}. `}
              Recorded underground, so its depth is not shown — the council record leaves that
              out for almost every asset here.
            </>
          )}
        </MapCallout>
      )}

      {/*
        The address callout, and the mentor's *"even a small popup"* for the
        pin. It carries what the panel used to say about the address — AC
        1.1.9.c — and the derived sentence keeps its own badge rather than
        borrowing the card's, because the address is the person's own and
        belongs to no dataset.

        It does not draw while a feature is selected: two cards on one map is
        one card too many, and the one somebody just pressed is the one they
        are reading.
      */}
      {panel &&
        viewport !== null &&
        address !== null &&
        hit === null &&
        addressCardOpen &&
        onScreen([address.eastingM, address.northingM], viewport) && (
        <MapCallout
          at={toScreen(viewport, [address.eastingM, address.northingM])}
          within={{ width: viewport.widthPx, height: viewport.heightPx }}
          title={address.label}
          onClose={() => {
            setAddressCardOpen(false);
          }}
        >
          {explanation === null ? (
            'No surface-water path or low area was measured close enough to this address to say anything about it.'
          ) : (
            <>
              {explanation} <Badge basis={NEARBY_BASIS} />
            </>
          )}
          {guided && (
            <span style={{ display: 'block', marginTop: 8, color: ink.subtle }}>
              Select a drainage pit or pipe to read what the council recorded about it.
            </span>
          )}
        </MapCallout>
      )}
    </>
  );
}

/**
 * Is the thing the card points at still on the map?
 *
 * Panning does not clear a selection — losing it because you looked next door
 * would be worse — but a card whose anchor has left the canvas is placed by
 * the clamp alone and sits against an edge pointing at nothing. Off screen,
 * the card goes with it and comes back when the mark does.
 */
function onScreen(point: Local, viewport: Viewport): boolean {
  const [x, y] = toScreen(viewport, point);
  return x >= 0 && y >= 0 && x <= viewport.widthPx && y <= viewport.heightPx;
}

/** The middle vertex of a polyline, which is where a pipe's card points. */
function midpoint(path: readonly Local[]): Local {
  const middle = path[Math.floor(path.length / 2)];
  return middle ?? [0, 0];
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
    <div data-tour="address" style={{ position: 'relative', width: 268 }}>
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
export const EVERYTHING = visibilityOf(ALL_ON);
