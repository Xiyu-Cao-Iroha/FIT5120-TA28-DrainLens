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
import { MapCallout, MinimisedCallout } from '../map/MapCallout.js';
import { PIT_SUMMARY, surfaceEntryOf } from '../crosssection/section.js';
import { MapCanvas } from '../map/MapCanvas.js';
import { type Local, type Viewport, toScreen } from '../map/viewport.js';
import { LayerChips, MapLegend } from '../map/MapLayers.js';
import {
  ALL_ON,
  GUIDED_ON,
  type LayerKey,
  type LayerState,
  type MapMode,
  NOTHING_ON,
  openingLayers,
  visibilityOf,
} from '../map/modes.js';
import type { MapNow } from '../tutorial/lesson.js';
import { legibility } from '../map/legibility.js';
import { NEARBY_BASIS, waterNearby } from '../map/nearby.js';
import { WaterCompass } from '../map/WaterCompass.js';
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
 * person said. The guided task is the next-best signal — its layers are what
 * its question needs.
 *
 * **The unguided map opens with nothing on at all**, which used to be
 * everything on, and was briefly everything but the ground. The reasoning is
 * in `modes.ts` beside `NOTHING_ON`; the short version is that "everything" is
 * the densest thing this product draws and it was what a first visit met.
 * Somebody who asked for the whole pilot area is choosing what to look at, and
 * the chips and the Layers panel are where that choice is made.
 */
function openingState(mode: MapMode | null, guided: boolean): LayerState {
  if (mode !== null) return openingLayers(mode);
  return guided ? GUIDED_ON : NOTHING_ON;
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
  /**
   * Let the address go again.
   *
   * Required alongside `onAddress` rather than optional beside it: a screen
   * that can set an address from here and cannot take it back is the defect
   * this pair exists to prevent, so the search box is not rendered without
   * both. The gate is structural because a missing handler would otherwise be
   * a button that does nothing, which is worse than no button.
   */
  readonly onClearAddress?: (() => void) | undefined;
  /**
   * Which chips to offer, and whether the Layers button is there.
   *
   * The guide narrows both. Its first instruction is *press Pits*, and a row
   * of four chips turns that into a search.
   */
  readonly chipKeys?: readonly LayerKey[] | undefined;
  readonly layersButton?: boolean | undefined;
  /**
   * What is on when the map opens, overriding the mode and the task.
   *
   * **The guide needs this and found out the hard way.** It opened with
   * `task="follow"`, which is the guided preset — pits, pipes, water flow and
   * the ground all on — so its first two instructions were already satisfied
   * and it began at step 3 of 6, beside a map drawing a layer whose chip it
   * had deliberately hidden. A guide whose first words are *press Pits* has to
   * open on a map with no pits on it, and that is a fact about the guide
   * rather than about any task, so it is said here rather than inferred.
   */
  readonly openWith?: LayerState | undefined;
  /**
   * A pit to ring without selecting — the guide's *press this one*.
   *
   * `MapCanvas` already draws this as `suggestedPit`, "offered but not
   * confirmed, drawn as a ring rather than a fill", which is exactly what the
   * guide is doing: pointing, not choosing on the reader's behalf.
   */
  readonly highlightPit?: number | null | undefined;
  /**
   * What the map is showing, whenever it changes.
   *
   * **Reported, not lifted**, for the same reason the viewport is: the map
   * owns its layers and its selection, and the guide reads them to work out
   * which step it is on. A guide that *set* them could walk itself through
   * its own instructions, which is a guide that teaches nothing.
   */
  readonly onMapNow?: ((now: MapNow) => void) | undefined;
  /**
   * The card that opens beside the address pin, naming what is near it.
   *
   * Off in the guide, and the reason is size rather than taste. The card
   * carries a compass, two distances and a provenance tag; against a full
   * screen it sits in a corner, and inside the guide's 560-pixel frame it
   * covered most of the map it was annotating. The pin stays either way.
   */
  readonly addressCard?: boolean | undefined;
  /** How wide the opening view is, in metres. See `MapCanvas`. */
  readonly openAcrossM?: number | undefined;
  /** Hold the view where it opened: no pan, no zoom. See `MapCanvas`. */
  readonly locked?: boolean | undefined;
  /**
   * The map legend, off in the guide.
   *
   * It sits in the top right and is 260 pixels wide, which in the guide's
   * frame is a third of the map — and the pit the guide rings is labelled with
   * its asset number, drawn to the right of the marker, so a pit near the top
   * of the view had its number running under the legend. Two things covering
   * the thing being pointed at, and this is the second.
   *
   * It is also saying what the guide is in the middle of saying. The step
   * beside the map reads *those are the structures the council has a record
   * of*; a box repeating "Drainage pits — recorded by the council" is a second
   * voice on the same sentence.
   */
  readonly legend?: boolean | undefined;
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
  onClearAddress,
  chipKeys,
  layersButton = true,
  openWith,
  highlightPit = null,
  onMapNow,
  addressCard = true,
  openAcrossM,
  locked = false,
  legend = true,
}: MapViewProps) {
  // Also decides whether the map offers a next step, which only a guided task
  // has. Arriving from a homepage mode card is `full-map`: a mode is a view,
  // not an instruction, and nobody asked to be walked through anything.
  const guided = task !== 'full-map';
  const [layers, setLayers] = useState<LayerState>(() => openWith ?? openingState(mode, guided));
  const [hit, setHit] = useState<Hit | null>(null);
  /**
   * The pit's card is folded away, and the pit is still selected.
   *
   * Two states rather than one, because "I have finished with this pit" and
   * "I want to see what is under this card" are different intentions and the
   * card only offered the first. Reset whenever the selection changes: a new
   * pit is a new question, and answering it with a folded card would look
   * like the press did nothing.
   */
  const [minimised, setMinimised] = useState(false);
  const [following, setFollowing] = useState<string | null>(null);
  const [terrain, setTerrain] = useState<HTMLCanvasElement | null>(null);
  // The transform the canvas drew with, reported upward so a callout can be
  // put at a feature rather than beside the map.
  const [viewport, setViewport] = useState<Viewport | null>(null);
  // Dismissed by the person, not by the address changing: picking a new
  // address should say something about the new one.
  const [addressCardOpen, setAddressCardOpen] = useState(addressCard);
  useEffect(() => {
    setAddressCardOpen(addressCard);
    // A new address is a new question. Leaving the previous pit selected would
    // answer the old one beside the new mark.
    setHit(null);
    setFollowing(null);
  }, [address, addressCard]);

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
        : waterNearby(derived, [address.eastingM, address.northingM]),
    [derived, address],
  );

  const selected = hit?.kind === 'pit' ? (hit.feature.asset_number ?? null) : null;

  // Recomputed only when the followed pit changes. The traversal is cheap,
  // but it runs inside a render that also happens on every pan.
  const followed = useMemo(
    () => (following === null ? null : traceDownstream(trace, following)),
    [trace, following],
  );

  /*
    Switching a layer off also lets go of anything selected on it.

    The other half of the same defect as the hit test: with Pits off, the pit
    card stayed open beside a map that no longer drew the pit it was about,
    and pressing "Show connected pipe" traced a path through features nobody
    could see. A card that outlives its layer is a claim about a map that is
    no longer on screen.

    Turning the layer back on does not bring the selection back, and that is
    deliberate: restoring it would be guessing that the person still wanted
    the pit they had before they went looking at something else.
  */
  const toggle = (key: LayerKey) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
    if (key === 'pit' && layers.pit && hit?.kind === 'pit') {
      setHit(null);
      setFollowing(null);
    }
    if (key === 'pipe' && layers.pipe) {
      // The trace is drawn as pipes, so it goes with them even when what is
      // selected is the pit at the top of it.
      setFollowing(null);
      if (hit?.kind === 'pipe') setHit(null);
    }
  };

  // The terrain chip cannot be pressed until its raster exists. Shown disabled
  // rather than hidden: a control that vanishes reads as a control that was
  // never there, and this one is named by AC 1.1.4.
  const notYet: LayerKey[] = terrain === null ? ['terrain'] : [];

  /*
    Too many pits on screen to be pits.

    The pilot extent never reached this: 895 drains over a square kilometre are
    legible at any zoom the product offers. The council extent is 21,113 over
    76.5 km2, and the full view puts 18,840 of them on one screen -- a texture
    that happens to be made of drains. `legibility` counts what is in view
    rather than reading the zoom, because density is not uniform and any scale
    strict enough for the CBD hides Kensington.
  */
  const pitPoints = useMemo(
    () => (map.layers.pit ?? []).map((pit) => pit.c),
    [map.layers.pit],
  );
  const legible = useMemo(() => legibility(pitPoints, viewport), [pitPoints, viewport]);
  const pitsDrawn = layers.pit && legible.drawPits;

  /*
    Reported on every change, and only on a change.

    The dependency list is the four facts rather than the objects holding them,
    so a pan does not tell the guide anything: `hit` is a new object every
    press and `layers` a new object every toggle, and reporting on either would
    re-run the guide's step arithmetic on movements that cannot affect it.
  */
  const pitsOn = layers.pit;
  const pipesOn = layers.pipe;
  const channelOn = layers.channel;
  const lowPointsOn = layers.lowPoint;
  const unmeasuredOn = layers.unavailable;
  const selectedId = selected === null ? null : String(selected);
  useEffect(() => {
    onMapNow?.({
      pits: pitsOn,
      pipes: pipesOn,
      channel: channelOn,
      lowPoints: lowPointsOn,
      unmeasured: unmeasuredOn,
      selectedPit: selectedId,
      followingPit: following,
    });
  }, [
    pitsOn,
    pipesOn,
    channelOn,
    lowPointsOn,
    unmeasuredOn,
    selectedId,
    following,
    onMapNow,
  ]);

  return (
    <>
      <MapCanvas
        artefact={map}
        derived={derived}
        show={visibilityOf(layers)}
        selectedPit={selected}
        // Only while the pits are drawn. A ring around a pit on a map with no
        // pits on it is a mark with nothing under it.
        suggestedPit={pitsDrawn ? highlightPit : null}
        {...(openAcrossM === undefined ? {} : { openAcrossM })}
        locked={locked}
        terrain={layers.terrain ? terrain : null}
        showPits={pitsDrawn}
        showPipes={layers.pipe}
        address={address === null ? null : [address.eastingM, address.northingM]}
        trace={followed}
        onViewport={setViewport}
        onAddressPress={() => {
          // The pin is the way back to the address card after it has been
          // closed. Whatever was selected is let go: two cards on one map is
          // one too many, which is the rule the address card is already
          // written to.
          setHit(null);
          setFollowing(null);
          setMinimised(false);
          setAddressCardOpen(true);
        }}
        onSelect={(next) => {
          setHit(next);
          setMinimised(false);
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
            {index && onAddress && onClearAddress && (
              <MapSearch
                index={index}
                address={address}
                onPick={onAddress}
                onClear={onClearAddress}
              />
            )}
            <LayerChips
              state={layers}
              onToggle={toggle}
              unavailableKeys={notYet}
              layersButton={layersButton}
              {...(chipKeys === undefined ? {} : { keys: chipKeys })}
            />
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
          {legend && <MapLegend state={layers} />}
        </div>
      )}

      {/*
        Said, not silently done.

        The switch is on and the marks are not there, which reads as a broken
        map unless something accounts for it — the same mistake as a control
        that vanishes, which this map already refuses to make with the terrain
        chip. The count is in the sentence because "there are eighteen thousand
        of them here" and "something is wrong" are different things to be told,
        and only one of them is true.
      */}
      {panel && layers.pit && !legible.drawPits && (
        <div
          role="status"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: space(6),
            zIndex: 5,
            maxWidth: 420,
            padding: `${String(space(3))}px ${String(space(4))}px`,
            background: surface.raised,
            border: `1px solid ${line.base}`,
            borderRadius: radius.base,
            boxShadow: shadow.floating,
            font: type(text.label, { leading: 1.45 }),
            color: ink.base,
            textAlign: 'center',
          }}
        >
          <strong style={{ color: ink.strong }}>
            {legible.inView.toLocaleString('en-AU')} drainage pits are in view.
          </strong>{' '}
          Zoom in to see them individually — at this scale they are closer together than
          they can be drawn or pressed.
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
      {panel && viewport !== null && hit?.kind === 'pit' && minimised && onScreen(hit.feature.c, viewport) && (
        <MinimisedCallout
          at={toScreen(viewport, hit.feature.c)}
          within={{ width: viewport.widthPx, height: viewport.heightPx }}
          title={`Drainage pit ${String(hit.feature.asset_number)}`}
          onExpand={() => {
            setMinimised(false);
          }}
          onClose={() => {
            setHit(null);
            setFollowing(null);
          }}
        />
      )}

      {panel && viewport !== null && hit?.kind === 'pit' && !minimised && onScreen(hit.feature.c, viewport) && (
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
          onMinimise={() => {
            setMinimised(true);
          }}
          onClose={() => {
            setHit(null);
            setFollowing(null);
          }}
        >
          {PIT_SUMMARY[surfaceEntryOf(hit.feature)]}
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
        addressCard &&
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
              <WaterCompass near={explanation} />
              <Badge basis={NEARBY_BASIS} />
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
  onClear,
}: {
  readonly index: AddressIndex;
  readonly address: SupportedAddress | null;
  readonly onPick: (address: IndexedAddress) => void;
  readonly onClear: () => void;
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
        {/*
          Shown whenever there is something to clear, which includes a chosen
          address and did not used to.

          A chosen address is displayed as the field's *placeholder* -- the
          typed text is cleared on picking one -- so gating this button on
          `typed` made it disappear at the one moment it was most needed: the
          address was on the map, named in the box, and there was no control
          anywhere that took it back. The two cases are one button because
          they are one intention, and the label says which is about to happen.
        */}
        {(typed !== '' || address !== null) && (
          <button
            type="button"
            onClick={() => {
              setTyped('');
              // Only when there is one. Clearing a half-typed search should
              // not throw away the address the map is centred on.
              if (address !== null) onClear();
            }}
            aria-label={address === null ? 'Clear the search' : 'Clear the address'}
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
