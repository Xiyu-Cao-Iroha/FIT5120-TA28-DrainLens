/**
 * The map, with the modes the way in asked for.
 *
 * Three things can decide what is on when it opens, in order of precedence: a
 * mode chosen on the homepage (AC 1.1.2), the guided task, or nothing at all —
 * in which case every mode is on, because nothing has been narrowed yet.
 *
 * **One `LayerState`, and the controls write to it directly.** The chips are
 * Drain pits, Drain pipes, Likely water paths and Low areas; Ground height and
 * Limited ground data sit behind the Layers button. Which control lives where is `modes.ts`,
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

import {
  COMPARE_HERE,
  type PitSupport,
  type ScenarioSupport,
  UNSUPPORTED_TEXT,
  supportOf,
} from '../scenario/support.js';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { addressForEnter, nextActive } from '../address/enter.js';
import type { AddressIndex, IndexedAddress, Match } from '../address/search.js';
import { MAX_SUGGESTIONS, search } from '../address/search.js';
import type { MapArtefact } from '../map/artefact.js';
import type { DerivedArtefact } from '../map/derived.js';
import type { Hit } from '../map/hit.js';
import { MapCallout, MinimisedCallout } from '../map/MapCallout.js';
import { PIT_SUMMARY, publicLabelOf, surfaceEntryOf } from '../crosssection/section.js';
import { MapCanvas, type MapCanvasProps } from '../map/MapCanvas.js';
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
import type { Highlight, MapNow } from '../tutorial/lesson.js';
import { GuideMarks } from '../map/GuideOverlayView.js';
import type { GuideOverlay } from '../map/guideMarks.js';
import { legibility } from '../map/legibility.js';
import { waterNearby } from '../map/nearby.js';
import { AddressInsight } from '../map/AddressInsight.js';
import { type AddressGroundArtefact, groundAt, loadAddressGround } from '../map/addressGround.js';
import { type TerrainTiles, loadTerrainTiles } from '../map/terrainTiles.js';
import {
  WARNING_BODY,
  WARNING_TITLE,
  type WarningPoint,
  loadWarnings,
  warningsVisible,
} from '../map/warnings.js';
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
   * The guide narrows both. Its first instruction is *press Drain pits*, and a row
   * of four chips turns that into a search.
   */
  readonly chipKeys?: readonly LayerKey[] | undefined;
  readonly layersButton?: boolean | undefined;
  /** The chip the guide's step is waiting on, outlined. See `LayerChips`. */
  readonly pulseChip?: LayerKey | null | undefined;
  /**
   * Something else the guide's step points at: the Layers button, the Ground
   * height switch in its panel, or the legend's ground-height scale.
   */
  readonly highlight?: Highlight | null | undefined;
  /**
   * Marks the guide draws over the map, in the map's frame.
   *
   * The ground height guide's lettered markers and highlighted contour (Figma
   * Terrain Tutorial, 16 September). Drawn over the canvas and under the
   * controls, and moved with the view. See `map/guideMarks.ts`.
   */
  readonly overlay?: GuideOverlay | null | undefined;
  /**
   * The canvas's viewport, whenever it changes. The guide reads the first
   * one to choose points inside the view it opens on.
   */
  readonly onViewport?: ((viewport: Viewport | null) => void) | undefined;
  /**
   * What is on when the map opens, overriding the mode and the task.
   *
   * **The guide needs this and found out the hard way.** It opened with
   * `task="follow"`, which is the guided preset — pits, pipes, water flow and
   * the ground all on — so its first two instructions were already satisfied
   * and it began at step 3 of 6, beside a map drawing a layer whose chip it
   * had deliberately hidden. A guide whose first words are *press Drain pits* has to
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
  /**
   * Points to fit the view to, refitted when `key` changes. See `MapCanvas`.
   *
   * The guide's step that asks for its ringed pit frames the address and that
   * pit together, because the pit is not always inside the opening view.
   */
  readonly fit?: MapCanvasProps['fit'] | undefined;
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
   * of*; a box repeating "Drain pits — Council record" is a second
   * voice on the same sentence.
   */
  readonly legend?: boolean | undefined;
  /**
   * Which drains a comparison can be calculated for, once known.
   *
   * With `onCompare`, a pit's card offers the comparison on a drain that
   * supports one and says why not on one that does not (AC 3.1.1). Absent, the
   * card is as it was: the guide and the side-by-side map have no comparison.
   */
  readonly scenarioSupport?: ScenarioSupport | null | undefined;
  readonly onCompare?: ((pitId: string) => void) | undefined;
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
  pulseChip = null,
  highlight = null,
  overlay = null,
  onViewport,
  openWith,
  highlightPit = null,
  onMapNow,
  addressCard = true,
  openAcrossM,
  fit = null,
  legend = true,
  scenarioSupport = null,
  onCompare,
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
  const [terrain, setTerrain] = useState<TerrainTiles | null>(null);
  const [terrainVersion, setTerrainVersion] = useState(0);
  // The transform the canvas drew with, reported upward so a callout can be
  // put at a feature rather than beside the map.
  const [viewport, setViewport] = useState<Viewport | null>(null);
  useEffect(() => {
    onViewport?.(viewport);
  }, [viewport, onViewport]);
  // Whether the Layers panel is open, which the guide's first step waits on.
  const [layersOpen, setLayersOpen] = useState(false);
  const panelChanged = useCallback((open: boolean) => {
    setLayersOpen(open);
  }, []);
  // Dismissed by the person, not by the address changing: picking a new
  // address should say something about the new one.
  const [addressCardOpen, setAddressCardOpen] = useState(addressCard);
  useEffect(() => {
    setAddressCardOpen(addressCard);
    // A new address is a new question. Leaving the previous pit selected would
    // answer the old one beside the new mark.
    setHit(null);
    setFollowing(null);
    setWarning(null);
  }, [address, addressCard]);

  // The index and the council overview, once; tiles arrive as the map is
  // looked at. A failure leaves the layer off rather than breaking the map: the
  // terrain is context, and the recorded network is what the person came for.
  useEffect(() => {
    let live = true;
    loadTerrainTiles('/data/terrain-tiles', () => {
      if (live) setTerrainVersion((v) => v + 1);
    })
      .then((tiles) => {
        if (live) setTerrain(tiles);
      })
      .catch(() => {
        if (live) setTerrain(null);
      });
    return () => {
      live = false;
    };
  }, []);

  /*
    The signs on especially deep low areas, for the extent that was served.

    Keyed on the map's extent rather than loaded once like the ground index,
    because the points are in the map's own frame: the council's file drawn
    over the Kensington fallback would put every sign a kilometre and a half
    from its hollow. `loadWarnings` refuses a file for another extent, and a
    failure leaves the signs off -- the low areas still draw, which is what
    the layer is.
  */
  const [warningPoints, setWarningPoints] = useState<readonly WarningPoint[] | null>(null);
  /** The sign whose card is open. One card on the map at a time, as ever. */
  const [warning, setWarning] = useState<WarningPoint | null>(null);
  const { name: extentName, width_m: extentWidth, height_m: extentHeight } = map.extent;
  useEffect(() => {
    let live = true;
    setWarningPoints(null);
    setWarning(null);
    loadWarnings({ name: extentName, width_m: extentWidth, height_m: extentHeight })
      .then((artefact) => {
        if (live) setWarningPoints(artefact.points);
      })
      .catch(() => {
        if (live) setWarningPoints(null);
      });
    return () => {
      live = false;
    };
  }, [extentName, extentWidth, extentHeight]);

  // Which way the ground falls around each address, precomputed. Loaded once;
  // if it cannot be, the card still says what is near and says nothing about
  // the ground rather than guessing.
  const [groundIndex, setGroundIndex] = useState<AddressGroundArtefact | null>(null);
  useEffect(() => {
    let live = true;
    loadAddressGround()
      .then((artefact) => {
        if (live) setGroundIndex(artefact);
      })
      .catch(() => {
        if (live) setGroundIndex(null);
      });
    return () => {
      live = false;
    };
  }, []);
  const groundTrend = useMemo(
    () => (address === null || groundIndex === null ? null : groundAt(groundIndex, address.id)),
    [address, groundIndex],
  );

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

    The other half of the same defect as the hit test: with Drain pits off, the
    pit card stayed open beside a map that no longer drew the pit it was about,
    and pressing "Show connected drain pipe" traced a path through features nobody
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
    // The sign goes with the layer it belongs to, for the same reason.
    if (key === 'lowPoint' && layers.lowPoint) setWarning(null);
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
  const terrainOn = layers.terrain;
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
      terrain: terrainOn,
      layersOpen,
      // The map says what is true now; the guide latches these (`latch`).
      layersOpened: layersOpen,
      terrainShown: terrainOn,
    });
  }, [
    terrainOn,
    layersOpen,
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
        fit={fit}
        terrain={layers.terrain ? terrain : null}
        terrainVersion={terrainVersion}
        showPits={pitsDrawn}
        showPipes={layers.pipe}
        address={address === null ? null : [address.eastingM, address.northingM]}
        trace={followed}
        warnings={layers.lowPoint ? warningPoints : null}
        onWarningPress={(sign) => {
          // Pressing a sign lets go of whatever else was open: two cards on
          // one map is one too many.
          setHit(null);
          setFollowing(null);
          setMinimised(false);
          setWarning(sign);
        }}
        onViewport={setViewport}
        onAddressPress={() => {
          // The pin is the way back to the address card after it has been
          // closed. Whatever was selected is let go: two cards on one map is
          // one too many, which is the rule the address card is already
          // written to.
          setHit(null);
          setFollowing(null);
          setMinimised(false);
          setWarning(null);
          setAddressCardOpen(true);
        }}
        onSelect={(next) => {
          setHit(next);
          setWarning(null);
          setMinimised(false);
          // Selecting something else abandons the path. Leaving it drawn
          // would attach the previous answer to the new question.
          if (next?.kind !== 'pit' || String(next.feature.asset_number) !== following) {
            setFollowing(null);
          }
        }}
      />

      {viewport !== null && overlay !== null && <GuideMarks overlay={overlay} viewport={viewport} />}

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
              pulse={pulseChip}
              pulseLayers={highlight === 'layers'}
              pulsePanelKey={highlight === 'terrain-toggle' ? 'terrain' : null}
              onPanelChange={panelChanged}
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
          {legend && <MapLegend state={layers} pulseTerrain={highlight === 'terrain-legend'} />}
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
            {legible.inView.toLocaleString('en-AU')} drain pits are in view.
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
          title={`Drain pit ${String(hit.feature.asset_number)}`}
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
          title={publicLabelOf(hit.feature)}
          // No source badge (copy audit v2, #30). Where the record comes from
          // is said once, under View technical details in `PitDetail`.
          action={
            followed === null
              ? {
                  label: 'Show connected drain pipe',
                  onPress: () => {
                    setFollowing(String(hit.feature.asset_number));
                  },
                }
              : {
                  label: 'Hide the connected drain pipe',
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
          {onCompare !== undefined && scenarioSupport !== null && (
            <CompareEntry
              support={supportOf(scenarioSupport, String(hit.feature.asset_number ?? ''))}
              onCompare={() => {
                onCompare(String(hit.feature.asset_number ?? ''));
              }}
            />
          )}
        </MapCallout>
      )}

      {panel && viewport !== null && hit?.kind === 'pipe' && onScreen(midpoint(hit.feature.c), viewport) && (
        <MapCallout
          at={toScreen(viewport, midpoint(hit.feature.c))}
          within={{ width: viewport.widthPx, height: viewport.heightPx }}
          title={`Pipe ${String(hit.feature.ref ?? '')}`.trim()}
          // No source badge, as on the pit card (copy audit v2, #30).
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
        The warning sign's card: the requested sentence and nothing else.

        No basis badge and no caveat, on purpose. It is advice about a place,
        asked for in exactly these words, and what the low areas are and are
        not is said beside the layer already. Hidden with the sign when the map
        zooms out past it, and back when it zooms in again, like a pit's card
        whose pit has left the screen.
      */}
      {panel &&
        viewport !== null &&
        warning !== null &&
        warningsVisible(layers.lowPoint, viewport.scale) &&
        onScreen(warning.c, viewport) && (
        <MapCallout
          at={toScreen(viewport, warning.c)}
          within={{ width: viewport.widthPx, height: viewport.heightPx }}
          title={WARNING_TITLE}
          onClose={() => {
            setWarning(null);
          }}
        >
          {WARNING_BODY}
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
        warning === null &&
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
          {explanation === null && groundTrend === null ? (
            'No place where water may flow or collect was found close to this address.'
          ) : (
            <>
              {/* No source badge: copy audit v2, #60. The legend's About this data says it once. */}
              <AddressInsight ground={groundTrend} near={explanation} />
            </>
          )}
          {guided && (
            <span style={{ display: 'block', marginTop: 8, color: ink.subtle }}>
              Select a drain pit or pipe to read what the council recorded about it.
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
 *
 * **Enter chooses, and the arrow keys move through the list** (15 September
 * user test: Enter did nothing, and only a click chose). The field is a
 * combobox over a listbox, with the suggestion the arrows are on named in
 * `aria-activedescendant`, so focus stays in the field and typing carries on
 * from wherever the arrows left it. Which address Enter takes when no
 * suggestion is highlighted is `addressForEnter`: the first screen's rule.
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
  // The suggestion the arrow keys are on, or -1 for the typed text itself.
  const [active, setActive] = useState(-1);
  const listId = useId();

  const matches: Match[] = useMemo(
    () => (typed.trim().length >= 2 ? search(index, typed, MAX_SUGGESTIONS) : []),
    [index, typed],
  );
  const highlighted = active >= 0 && active < matches.length ? active : -1;
  const optionId = (at: number) => `${listId}-option-${String(at)}`;

  const pick = (chosen: IndexedAddress) => {
    onPick(chosen);
    setTyped('');
    setActive(-1);
  };

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
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              if (matches.length === 0) return;
              // Otherwise the caret jumps to the start or end of the text.
              event.preventDefault();
              setActive(nextActive(highlighted, matches.length, event.key));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const chosen = matches[highlighted]?.address ?? addressForEnter(index, typed);
              if (chosen) pick(chosen);
            } else if (event.key === 'Escape' && highlighted >= 0) {
              setActive(-1);
            }
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          placeholder={address?.label ?? 'Search an address'}
          aria-label="Search for an address"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          {...(highlighted >= 0 ? { 'aria-activedescendant': optionId(highlighted) } : {})}
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
              setActive(-1);
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
          id={listId}
          role="listbox"
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
          {/*
            Options rather than buttons: a button inside an option is a
            control inside a control, and the field already owns the keyboard.
            A press still chooses, and the pointer moves the highlight so the
            arrows carry on from where it was.
          */}
          {matches.map((match, at) => (
            <li
              key={match.address.id}
              id={optionId(at)}
              role="option"
              aria-selected={at === highlighted}
              onMouseDown={(event) => {
                // Keep focus in the field, so the list is not blurred away
                // before the press lands.
                event.preventDefault();
              }}
              onMouseEnter={() => {
                setActive(at);
              }}
              onClick={() => {
                pick(match.address);
              }}
              style={{
                padding: `${String(space(2))}px ${String(space(2))}px`,
                borderRadius: radius.small,
                background: at === highlighted ? surface.sunken : 'transparent',
                font: type(text.label),
                color: ink.base,
                cursor: 'pointer',
              }}
            >
              {match.address.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Re-exported so the scenario screens keep the visibility they always had. */
export const EVERYTHING = visibilityOf(ALL_ON);

/**
 * The way into the comparison from a drain on the map, or why there is none.
 *
 * AC 3.1.1 asks for the explorer to open from the local drainage map. On a
 * drain that cannot be compared the card says why instead of offering a button
 * that is bound to fail — and says, every time, that this is a limit of the
 * calculation and not a finding about the drain (3.1.1.e).
 */
function CompareEntry({ support, onCompare }: { readonly support: PitSupport; readonly onCompare: () => void }) {
  if (support === 'supported') {
    return (
      <button
        type="button"
        onClick={onCompare}
        style={{
          display: 'block',
          width: '100%',
          marginTop: 10,
          padding: '9px 12px',
          fontWeight: 600,
          color: '#ffffff',
          background: '#0f8b8d',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        {COMPARE_HERE} →
      </button>
    );
  }
  return (
    <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5b6e7e' }}>{UNSUPPORTED_TEXT[support]}</p>
  );
}
