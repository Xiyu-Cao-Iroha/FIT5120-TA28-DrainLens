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
  COMPARE_LOADING,
  type PitSupport,
  type ScenarioSupport,
  UNSUPPORTED_TEXT,
  supportOf,
} from '../scenario/support.js';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { addressForEnter, nextActive } from '../address/enter.js';
import type { AddressIndex, IndexedAddress, Match } from '../address/search.js';
import { MAX_SUGGESTIONS, search } from '../address/search.js';
import { noMatch } from '../address/noMatch.js';
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
import { boundaryInMapFrame, boundaryInView } from '../map/catchmentBoundary.js';
import { type Subcatchment, type SubcatchmentsArtefact, areaFor } from '../catchment/artefact.js';
import { DRAINAGE_AREA } from '../catchment/wording.js';
import { PREPARE_HEADING } from '../prepare/actions.js';
import {
  BEFORE_RAIN_CHIP,
  NO_ADDRESS_FOR_CHECKS,
  NO_PLACES,
  PLACE_RADIUS_M,
  NO_PLACES_MEANS,
  type Place,
  type Relevance,
  checkButton,
  numberOf,
  placeTitle,
  placesNear,
} from '../prepare/places.js';
import { Sidebar, sidebarWidth } from './Sidebar.js';
import { PlaceCard, PreparePlan } from './PrepareForRain.js';
import { ReportProblem } from './ReportProblem.js';
import { type ProblemId, REPORT_HEADING } from '../report/problems.js';
import {
  PICK_DRAIN,
  PICK_RADIUS_M,
  PIN_PLACE,
  type ReportPlace,
  drainTitle,
  distanceLine,
} from '../report/place.js';
import { OPERATOR_LABEL, operatorLine } from '../catchment/help.js';
import { CARD_WIDTH, DrainageArea, MapNote, MapNoteStack, WhoCanHelpLevels } from './DrainageArea.js';
import type { AddressCatchmentsArtefact } from '../catchment/artefact.js';
import { SourceLink } from '../ui/SourcesPanel.js';
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
import { brand, ink, line, radius, shadow, space, surface, text, tracking, type, weight } from '../ui/theme.js';
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
  /**
   * The drainage areas and which one each address is in, or null.
   *
   * Null is the honest state when the files have not loaded: the address card
   * then offers no drainage area rather than an empty one.
   */
  readonly catchments?: { readonly areas: SubcatchmentsArtefact; readonly assignment: AddressCatchmentsArtefact } | null;
  /**
   * What the reader has said about each numbered place, and how to say more.
   *
   * Held in the session rather than here, because it survives a step back to
   * the address screen and a return, and dies with the tab (AC 5.4.1).
   */
  readonly relevance?: Readonly<Record<number, Relevance>>;
  readonly onReviewPlace?: ((place: number, relevance: Relevance) => void) | undefined;
  readonly onResetPlaces?: (() => void) | undefined;
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
   * The map tour is running.
   *
   * Three of its seven steps point at a chip, and the row can be collapsed
   * to one button -- so a reader who had folded it was shown *Drain pits are
   * street drains* over a map with no Drain pits on it. While the tour runs
   * the row is not collapsible, which both unfolds it and keeps it unfolded
   * for the steps that come after.
   */
  readonly touring?: boolean | undefined;
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
  panel: panelAllowed = true,
  catchments = null,
  relevance = {},
  onReviewPlace,
  onResetPlaces,
  index,
  onAddress,
  onClearAddress,
  chipKeys,
  layersButton = true,
  pulseChip = null,
  touring = false,
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
  /*
    The address's own drainage area, read from the published answer.

    `indexed` is the index's record for this address: the lookup is by street
    and published position, and the session carries a label and a coordinate.
    Matching on the label is matching on what the person searched for.
  */

  const indexed =
    address === null ? null : (index?.addresses.find((entry) => entry.label === address.label) ?? null);
  const area: Subcatchment | null = areaFor(catchments?.areas ?? null, catchments?.assignment ?? null, indexed);
  const catchmentRings =
    catchments === null || area === null
      ? null
      : boundaryInMapFrame(area.rings, catchments.areas.extent, map.extent);
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

  /*
    Epic 5's places: the published markers near the address, numbered.

    Worked out here rather than in the session, because they are a fact about
    the map and the address rather than a thing the reader chose — and because
    the markers arrive asynchronously, so a session that held them would hold
    them stale.
  */
  const addressEastingM = address?.eastingM ?? null;
  const addressNorthingM = address?.northingM ?? null;
  /*
    Held across renders.

    `placesNear` returns a new array every call, and this list is read by the
    effect that reports the map to a guide. An unheld list made that effect
    fire on every render, the guide set state, and the two rendered each other
    until React gave up -- with the map half laid out, which is how it showed.
  */
  const places = useMemo(
    () =>
      placesNear(
        addressEastingM === null || addressNorthingM === null
          ? null
          : [addressEastingM, addressNorthingM],
        warningPoints ?? [],
      ),
    [addressEastingM, addressNorthingM, warningPoints],
  );
  /** The place whose card is open, or null. */
  const [openPlace, setOpenPlace] = useState<number | null>(null);
  /** Whether the plan is open. The guide's first step waits on it. */
  const [planOpen, setPlanOpen] = useState(false);
  /*
    The reporting pathway, which is its own thing (AC 6.2.3).

    It carries a drain only where the reader had one selected when they opened
    it, which is the only way a drain can reach a report: nothing is attached
    because it happens to be near, and `Remove` takes it off again.
  */
  /** A reminder's explanation has been opened, which the guide waits on. */
  const [whyOpen, setWhyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPlace, setReportPlace] = useState<ReportPlace>(null);
  const openReport = (place: ReportPlace) => {
    setReportPlace(place);
    setReportOpen(true);
  };
  /*
    The map handed over to a report (Figma R1 and R3).

    While this is set the map is an input rather than something to read: the
    chrome is gone, only the drains near the address are drawn, and a press
    answers the question on the banner. `panel` below is how everything else
    gets out of the way -- every card on this map is already written to it.
  */
  const [reportProblem, setReportProblem] = useState<ProblemId | null>(null);
  const [picking, setPicking] = useState<'drain' | 'pin' | null>(null);
  const [candidate, setCandidate] = useState<{
    readonly assetNumber: string;
    readonly distanceM: number | null;
  } | null>(null);
  const [pinAt, setPinAt] = useState<Local | null>(null);
  const [pinNote, setPinNote] = useState('');
  const panel = panelAllowed && picking === null;
  /*
    The sidebar (Figma P1 and AI1), and what the rest of the chrome does
    about it.

    Its width comes from the canvas's own width, and the canvas is pointedly
    not resized to make room: the panel is drawn over the map's right edge, so
    the two cannot end up as inputs to each other. Everything else moves --
    the controls come in by `panelWidth`, the chips fold to one button and the
    legend folds itself away -- because a map whose whole chrome is in the one
    corner the panel wants is the screenshot that asked for this.
  */
  /*
    Where the map's chrome ends, measured.

    The search box and the chips share one row, and on a narrow window the
    chips wrap under the search box -- so the row is one line tall or two,
    and the cards below it were drawn at a fixed 64 pixels either way.
    `ResizeObserver` is what makes this honest: it fires on a wrap, which no
    window-resize handler would catch when the wrap is caused by the sidebar
    opening rather than by the window changing.
  */
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const [chromeBottom, setChromeBottom] = useState(64);
  useEffect(() => {
    const row = chromeRef.current;
    const under = row?.offsetParent;
    if (row === null || under === null || under === undefined) return undefined;
    /*
      The lowest edge of anything in the chrome that is over the card column.

      Not the row's own height: the legend is in this row and it is tall, but
      it is at the right-hand end, and pushing the cards below it would give
      up 200 pixels of map for a box the cards never touch. Not the chips'
      height either, because on a narrow window the legend wraps onto a line
      of its own and then it *is* above them.

      So it is measured per child, against the column's own 300 pixels: only
      what actually overlaps them counts.
    */
    const measure = () => {
      const top = under.getBoundingClientRect().top;
      const left = space(3);
      const right = left + CARD_WIDTH;
      let lowest = row.getBoundingClientRect().top;
      for (const child of row.children) {
        const box = child.getBoundingClientRect();
        if (box.right > left && box.left < right && box.bottom > lowest) lowest = box.bottom;
      }
      setChromeBottom(Math.round(lowest - top + space(3)));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(row);
    for (const child of row.children) watch.observe(child);
    return () => {
      watch.disconnect();
    };
  }, [panel]);

  const panelWidth = viewport === null ? 0 : sidebarWidth(viewport.widthPx);
  /*
    The before-rain layer opens something, always (change list, item 11).

    Reported from the guide: step two says *decide whether Place 1 applies to
    you* over a map with nothing open on it, and the reader has to work out
    that the thing to press is a small warning triangle somewhere among the
    streets. The design opens the first place's card for them, so the step is
    about the decision rather than about finding the control.

    Where there are no places it opens the address card instead, which is
    where the *none near this address* sentence is. An address with nothing to
    check is a result and has to look like one; silence looks like a layer
    that did not load.

    Once per address and per switch-on: `opened` is the key it has already
    done, so a reader who closes the card is not handed it again on the next
    render.
  */
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    /*
      Never inside a guide. A guide drives its own sequence, and Epic 5's
      first step is *Click Check before heavy rain* -- a button on the address
      card, which the place card suppresses. Opening the place card for the
      reader made the guide's own instruction point at something that was not
      on the screen.
    */
    if (guided || !layers.beforeRain || address === null) {
      openedFor.current = null;
      return;
    }
    const key = `${address.label}:${String(places.length)}`;
    if (openedFor.current === key) return;
    openedFor.current = key;
    /*
      Nothing near the address needs no card opened for it: the note in the
      corner stack below says so, and says it whether or not the plan is open.
      Opening the address card as well put the same two sentences on the
      screen twice.
    */
    if (places.length === 0) return;
    setOpenPlace((current) => current ?? places[0]?.number ?? null);
  }, [guided, layers.beforeRain, address, places]);

  /*
    The opening view for the before-rain layer: the whole 200 m (item 5).

    An address accepted with this layer on used to leave the map at whatever
    scale it was at, so a numbered marker 180 m away was off the screen and
    the reader was asked to decide about a place they could not see. The fit
    is the square that definitely contains every place, because 200 m is what
    `placesNear` means by near -- so the radius the product uses and the
    radius it shows are the same number, read from the same constant.

    Keyed on the address, so it fits once when the address arrives and leaves
    the reader's own panning alone afterwards.
  */
  const placesFit = useMemo((): MapCanvasProps['fit'] => {
    if (!layers.beforeRain || address === null) return null;
    const r = PLACE_RADIUS_M;
    const corners: readonly Local[] = [
      [address.eastingM - r, address.northingM - r],
      [address.eastingM + r, address.northingM + r],
    ];
    return { key: `places:${address.label}`, points: corners, reservePanel: false };
  }, [layers.beforeRain, address]);

  /*
    The plan and an open place card are no longer exclusive.

    They were, and the cost was reported on 8 October: answering a place left
    the reader on a map with the card gone and no way back to the plan except
    the address pin. The plan is a sidebar beside the map and the card is
    anchored on the map, so both fit -- the card is kept clear of the sidebar
    by `calloutWithin` below.
  */
  const planShowing = panel && viewport !== null && planOpen;
  const sidebarOpen = planShowing && panelWidth > 0;
  /*
    Too narrow for a sidebar, so the plan goes back in the card it used to
    live in. Not a good screen -- the design has a sheet for this and the
    sheet is not built -- but a worse screen than a sidebar is still better
    than a window where the plan button does nothing.
  */
  const planInCard = planShowing && panelWidth === 0 && openPlace === null;

  /*
    The box a callout may not leave.

    The sidebar is drawn over the canvas rather than beside it -- the map is
    deliberately not re-fitted when the plan opens, so that what the reader is
    looking at does not move under them. A card placed against the canvas's
    full width can therefore end up behind the sidebar, which is how a place
    card and an open plan used to be impossible to have at once.
  */
  const calloutWithin =
    viewport === null
      ? { width: 0, height: 0 }
      : { width: viewport.widthPx - (sidebarOpen ? panelWidth : 0), height: viewport.heightPx };

  const planPanel = (
    <PreparePlan
      address={address?.label ?? ''}
      places={places}
      relevance={relevance}
      onShowOnMap={(place) => {
        setOpenPlace(place.number);
      }}
      onWhyOpen={() => {
        setWhyOpen(true);
      }}
      {...(onResetPlaces === undefined ? {} : { onReset: onResetPlaces })}
      {...(guided
        ? {}
        : {
            onReport: () => {
              setPlanOpen(false);
              openReport(null);
            },
            onCheckDrains: () => {
              // Step 3's first button. The recorded drains are a layer, so
              // showing them is switching it on rather than going anywhere.
              if (!layers.pit) toggle('pit');
            },
          })}
    />
  );
  const leavePicking = () => {
    setPicking(null);
    setCandidate(null);
    setPinAt(null);
    setPinNote('');
  };
  /*
    Whether the before-rain callout on the address is showing.

    Its own state rather than the address card's: the full card is suppressed
    in the guides, and this callout is the only place AC 5.1.1's button can be
    where it is. Pressing the chip again brings it back.
  */
  const [beforeRainCallout, setBeforeRainCallout] = useState(true);
  useEffect(() => {
    setBeforeRainCallout(true);
  }, [address, layers.beforeRain]);
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
  /*
    The drains near the address, and only those (Figma R1).

    The whole council's 21,113 pits on one screen is not a question anybody
    can answer, and the banner says *only drains near this address are shown*
    -- so it has to be true. Without an address there is nothing to be near
    and the reader is sent to the pin instead.
  */
  const pickable = useMemo(() => {
    if (address === null) return [];
    const pits = map.layers.pit ?? [];
    return pits.filter(
      (pit) =>
        Math.hypot(pit.c[0] - address.eastingM, pit.c[1] - address.northingM) <= PICK_RADIUS_M,
    );
  }, [map, address]);
  const pickingMap = useMemo(
    () => ({ ...map, layers: { ...map.layers, pit: pickable, pipe: [] } }),
    [map, pickable],
  );

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
  // A count rather than the answers themselves: the effect below reports it to
  // a guide, and a number compares where an object would not.
  const placesReviewed = places.filter(
    (place) => (relevance[place.number] ?? null) !== null,
  ).length;
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
      catchment: layers.catchment,
      planOpen,
      placesReviewed,
      whyOpen,
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
    // Epic 6's chip: the guide waits for the press, so the report has to
    // run when it changes.
    layers.catchment,
    // Epic 5's two, for the same reason.
    planOpen,
    placesReviewed,
    whyOpen,
    onMapNow,
  ]);

  return (
    <>
      <MapCanvas
        controlsInset={sidebarOpen ? panelWidth : 0}
        artefact={picking === 'drain' ? pickingMap : map}
        derived={derived}
        show={visibilityOf(picking === null ? layers : NOTHING_ON)}
        selectedPit={selected}
        // Only while the pits are drawn. A ring around a pit on a map with no
        // pits on it is a mark with nothing under it.
        suggestedPit={pitsDrawn ? highlightPit : null}
        {...(openAcrossM === undefined ? {} : { openAcrossM })}
        fit={placesFit ?? fit}
        terrain={layers.terrain ? terrain : null}
        terrainVersion={terrainVersion}
        showPits={picking === 'drain' ? true : picking === null && pitsDrawn}
        showPipes={picking === null && layers.pipe}
        address={address === null ? null : [address.eastingM, address.northingM]}
        trace={followed}
        catchment={layers.catchment ? catchmentRings : null}
        warnings={layers.lowPoint || layers.beforeRain ? warningPoints : null}
        numberOfWarning={(point) => (layers.beforeRain ? numberOf(places, point) : null)}
        onWarningPress={(sign) => {
          // Pressing a sign lets go of whatever else was open: two cards on
          // one map is one too many.
          setHit(null);
          setFollowing(null);
          setMinimised(false);
          /*
            A numbered marker opens its place, which is what the number is
            for. It used to set `warning` like any other sign, and the card
            that reads `warning` is gated on the low-areas layer -- so with
            only before-rain on, pressing a numbered triangle did nothing at
            all. The guide tells the reader the other places are numbered on
            the map; pressing one has to reach them.
          */
          const numbered = layers.beforeRain ? numberOf(places, sign) : null;
          if (numbered !== null) {
            setWarning(null);
            setOpenPlace(numbered);
            return;
          }
          // An unnumbered sign is a low area like any other, and it says so.
          // It lets go of an open place for the same reason every other press
          // here does: two cards on one map is one too many.
          setOpenPlace(null);
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
        {...(picking === 'pin'
          ? {
              onGround: (point: Local) => {
                setPinAt(point);
              },
            }
          : {})}
        onSelect={(next) => {
          if (picking === 'drain') {
            // A press answers the banner's question and opens nothing else.
            if (next?.kind === 'pit' && next.feature.asset_number !== undefined) {
              setCandidate({
                assetNumber: String(next.feature.asset_number),
                distanceM:
                  address === null
                    ? null
                    : Math.round(
                        Math.hypot(
                          next.feature.c[0] - address.eastingM,
                          next.feature.c[1] - address.northingM,
                        ),
                      ),
              });
            }
            return;
          }
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

      {/*
        The map as an input (Figma R1 and R3): a banner saying what to press,
        a way out, and the card that confirms what was pressed.
      */}
      {picking !== null && (
        <>
          <div
            style={{
              position: 'absolute',
              top: space(4),
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 5,
              display: 'flex',
              gap: space(4),
              alignItems: 'flex-start',
              maxWidth: 420,
              padding: `${String(space(2))}px ${String(space(3))}px`,
              borderRadius: radius.base,
              background: surface.raised,
              border: `1px solid ${line.base}`,
              boxShadow: '0 6px 20px rgba(16, 32, 40, 0.10)',
            }}
          >
            <span>
              <span
                style={{
                  display: 'block',
                  font: type(text.small, { weight: weight.semibold }),
                  color: ink.strong,
                }}
              >
                {picking === 'drain' ? PICK_DRAIN.title : PIN_PLACE.title}
              </span>
              <span style={{ display: 'block', font: type(text.micro), color: ink.muted }}>
                {picking === 'drain' ? PICK_DRAIN.near(address?.label ?? null) : PIN_PLACE.then}
              </span>
            </span>
            <button type="button" onClick={leavePicking} style={planLinkStyle}>
              {PICK_DRAIN.cancel}
            </button>
          </div>

          {picking === 'drain' && candidate === null && (
            <div
              style={{
                position: 'absolute',
                bottom: space(4),
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                textAlign: 'center',
              }}
            >
              <span style={{ display: 'block', font: type(text.micro), color: ink.muted }}>
                Your answers stay in this browser.
              </span>
              <button
                type="button"
                onClick={() => {
                  setPicking('pin');
                }}
                style={{
                  marginTop: space(1),
                  padding: `${String(space(1))}px ${String(space(3))}px`,
                  borderRadius: radius.pill,
                  border: `1px solid ${line.base}`,
                  background: surface.raised,
                  color: ink.base,
                  font: type(text.small),
                  cursor: 'pointer',
                }}
              >
                {PICK_DRAIN.notOnMap}
              </button>
            </div>
          )}

          {picking === 'drain' && candidate !== null && (
            <MapNoteStack at="bottom">
              <MapNote title={drainTitle({ kind: 'drain', assetNumber: candidate.assetNumber, street: null, distanceM: candidate.distanceM })}>
                <p style={{ margin: `0 0 ${String(space(2))}px`, font: type(text.small), color: ink.muted }}>
                  {distanceLine(
                    { kind: 'drain', assetNumber: candidate.assetNumber, street: null, distanceM: candidate.distanceM },
                    address?.label ?? null,
                  )}
                </p>
                <span style={{ display: 'flex', gap: space(2), flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setReportPlace({
                        kind: 'drain',
                        assetNumber: candidate.assetNumber,
                        street: null,
                        distanceM: candidate.distanceM,
                      });
                      leavePicking();
                    }}
                    style={pickFilledStyle}
                  >
                    Use this drain
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCandidate(null);
                    }}
                    style={pickOutlineStyle}
                  >
                    Pick another
                  </button>
                </span>
              </MapNote>
            </MapNoteStack>
          )}

          {/*
            Where the pin went, drawn over the canvas rather than in it.

            The card alone confirms the press without showing the place, and
            a reader who tapped a few metres off has nothing to correct
            against. The canvas draws the address pin and nothing else that
            moves, so this is one absolutely positioned mark instead.
          */}
          {picking === 'pin' && pinAt !== null && viewport !== null && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: toScreen(viewport, pinAt)[0] - 9,
                top: toScreen(viewport, pinAt)[1] - 22,
                width: 18,
                height: 18,
                borderRadius: '50% 50% 50% 0',
                transform: 'rotate(-45deg)',
                background: brand.base,
                border: `2px solid ${ink.inverse}`,
                boxShadow: '0 2px 6px rgba(16, 32, 40, 0.35)',
                zIndex: 5,
                pointerEvents: 'none',
              }}
            />
          )}

          {picking === 'pin' && pinAt !== null && (
            <MapNoteStack at="bottom">
              <MapNote title={PIN_PLACE.card}>
                <input
                  value={pinNote}
                  onChange={(event) => {
                    setPinNote(event.target.value);
                  }}
                  placeholder={PIN_PLACE.placeholder}
                  aria-label={PIN_PLACE.then}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: space(2),
                    borderRadius: radius.small,
                    border: `1px solid ${line.base}`,
                    font: type(text.small),
                    color: ink.base,
                  }}
                />
                <span style={{ display: 'flex', gap: space(2), marginTop: space(2), flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setReportPlace({
                        kind: 'pin',
                        note: pinNote.trim(),
                        at: { eastingM: pinAt[0] + map.extent.min_e, northingM: pinAt[1] + map.extent.min_n },
                      });
                      leavePicking();
                    }}
                    style={pickFilledStyle}
                  >
                    {PIN_PLACE.use}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPinAt(null);
                    }}
                    style={pickOutlineStyle}
                  >
                    {PIN_PLACE.back}
                  </button>
                </span>
              </MapNote>
            </MapNoteStack>
          )}
        </>
      )}

      {panel && (
        <div
          ref={chromeRef}
          style={{
            position: 'absolute',
            left: space(4),
            right: space(4) + (sidebarOpen ? panelWidth : 0),
            top: space(4),
            transition: 'right 160ms ease',
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
              collapsible={!guided && !touring}
              fold={sidebarOpen}
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
          {/*
            Not while the Layers panel is open.

            The panel hangs from a button at the chips' right-hand end and is
            288 wide; the legend begins just past that end, and on a window
            narrow enough for the legend to wrap onto its own line the panel
            drops straight onto it -- two white boxes overlapping, which
            reads as clipped text rather than as two cards. Folding the
            legend only made the box it covered smaller.

            Hidden rather than folded, because the panel is the same question
            answered in more detail: it lists every layer and lets the reader
            turn them on. It comes back, as it was, the moment they close it.
          */}
          {legend && !layersOpen && (
            <MapLegend
              state={layers}
              fold={sidebarOpen}
              pulseTerrain={highlight === 'terrain-legend'}
            />
          )}
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
          within={calloutWithin}
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
          within={calloutWithin}
          title={publicLabelOf(hit.feature)}
          // A grey source line at the foot, not a badge (copy audit v4, #30).
          source="recorded"
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
          {/*
            The comparison, or why it is not offered yet.

            The index this reads is fetched the first time a drain is pressed
            and is held by this screen, so every return to the map fetches it
            again -- and while it is null the card used to render nothing at
            all. Reported on 8 October as the button not coming back after a
            comparison: it does, a moment later, and silence in between reads
            as a button that has been taken away.
          */}
          {onCompare !== undefined &&
            (scenarioSupport === null ? (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5b6e7e' }}>{COMPARE_LOADING}</p>
            ) : (
              <CompareEntry
                support={supportOf(scenarioSupport, String(hit.feature.asset_number ?? ''))}
                onCompare={() => {
                  onCompare(String(hit.feature.asset_number ?? ''));
                }}
              />
            ))}
        </MapCallout>
      )}

      {panel && viewport !== null && hit?.kind === 'pipe' && onScreen(midpoint(hit.feature.c), viewport) && (
        <MapCallout
          at={toScreen(viewport, midpoint(hit.feature.c))}
          within={calloutWithin}
          title={`Pipe ${String(hit.feature.ref ?? '')}`.trim()}
          // The same source line as the pit card; the pipe card had the badge too.
          source="recorded"
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
          {/*
            AC 6.2.2: who the record says operates this pipe, in its own three
            states. 853 of the council's pipes carry a code the portal does not
            explain, and this says so rather than naming an organisation for
            them.
          */}
          <span style={{ display: 'block', marginTop: space(2), color: ink.muted }}>
            {OPERATOR_LABEL}: {operatorLine(hit.feature.operator)}
          </span>
        </MapCallout>
      )}

      {/*
        The warning sign's card: the requested sentence and nothing else.

        No source line and no caveat, on purpose. It is advice about a place,
        asked for in exactly these words, and the industry mentor asked for no
        further explanation on it; copy audit v4 (#62) left the source line to
        the team, and the low areas' legend group says they are estimated. Hidden with the sign when the map
        zooms out past it, and back when it zooms in again, like a pit's card
        whose pit has left the screen.
      */}
      {panel &&
        viewport !== null &&
        warning !== null &&
        warningsVisible(layers.lowPoint || layers.beforeRain, viewport.scale) &&
        onScreen(warning.c, viewport) && (
        <MapCallout
          at={toScreen(viewport, warning.c)}
          within={calloutWithin}
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
        1.1.9.c — and ends with "Estimated by DrainLens ›" (copy audit v4,
        #59, #60) for the figure, not a source for the card: the address is
        the person's own and belongs to no dataset.

        It does not draw while a feature is selected: two cards on one map is
        one card too many, and the one somebody just pressed is the one they
        are reading.
      */}
      {/*
        Epic 6's two cards, each drawn by its own chip, as the design has them
        (Figma D2 and D4): a corner of the map rather than a popup anchored on
        a feature, because neither is about a point — one is about the area the
        boundary encloses, the other about the system as a whole.
      */}
      {/*
        One card at a time, as the design has it: step four shows Who can help
        and not the area card behind it. Two stacked cards on a phone-width map
        is the thing the map chrome was broken up to avoid.
      */}
      {/*
        Not while the report is open: both of these are corner cards and they
        share the corner. The report is opened from this card, so without the
        exclusion the report lands exactly on top of the thing it came from --
        which is the same defect as the one the change list opened with, in
        the other direction.
      */}
      {/*
        Before-rain with no address: the layer is on, the markers are drawn,
        and nothing says the checks are about an address nobody has given.
        The subcatchment card says so; this is the same sentence in the same
        situation.
      */}
      

      

      {/*
        The map's corner cards, in one column rather than four pins at one
        spot (reported 8 October, with a screenshot of two of them happening
        at once).

        `chromeBottom` is measured: the chip row wraps onto a second line on
        any window narrow enough, and every card was drawn at a fixed 64
        pixels whether the chrome ended there or not. The order below is the
        order they stack in, and it is deliberate -- the report is the thing
        the reader just asked for, so it comes first.
      */}
      <MapNoteStack top={chromeBottom}>
        {panel && viewport !== null && reportOpen && (
          <MapNote title={REPORT_HEADING}>
            <ReportProblem
              address={address?.label ?? null}
              place={reportPlace}
              chosen={reportProblem}
              onChoose={setReportProblem}
              onPick={() => {
                // The map takes over. The report card is still open behind it
                // and comes back with whatever was picked.
                setCandidate(null);
                setPinAt(null);
                setPicking(address === null ? 'pin' : 'drain');
              }}
              onForgetPlace={() => {
                // *Change* is what the design calls it, so it goes back to the
                // map rather than just emptying the row.
                setReportPlace(null);
                setCandidate(null);
                setPinAt(null);
                setPicking(address === null ? 'pin' : 'drain');
              }}
            />
            <span style={{ display: 'block', marginTop: space(3) }}>
              <button
                type="button"
                onClick={() => {
                  setReportOpen(false);
                  setReportProblem(null);
                }}
                style={planLinkStyle}
              >
                Close
              </button>
            </span>
          </MapNote>
        )}

        {planInCard && (
          <MapNote title={PREPARE_HEADING}>{planPanel}</MapNote>
        )}

        {panel && viewport !== null && layers.catchment && !reportOpen && (
          <MapNote title={DRAINAGE_AREA}>
            <DrainageArea
              area={area}
              hasAddress={address !== null}
              onBack={() => {
                // The chip is what drew this card; taking it off is the way
                // back, and it takes the boundary with it.
                toggle('catchment');
              }}
              {...(guided
                ? {}
                : {
                    // Not inside a guide. A guide teaches one thing at a time,
                    // and this opens a card taller than the guide's map frame
                    // over a step that was asking about something else.
                    onReport: () => {
                      openReport(null);
                    },
                  })}
            />
            {catchmentRings !== null && !boundaryInView(catchmentRings, viewport) && (
              <span style={{ display: 'block', marginTop: space(2), color: ink.subtle }}>
                The boundary is outside this view. Zoom out to see it.
              </span>
            )}
          </MapNote>
        )}

        {panel && viewport !== null && layers.beforeRain && address === null && !planOpen && (
          <MapNote title={BEFORE_RAIN_CHIP}>{NO_ADDRESS_FOR_CHECKS}</MapNote>
        )}

        {/*
          Nothing near this address, said as a result rather than as a footnote
          (AC 5.1.3).

          It was two lines at the bottom of the address card, and the address
          card is hidden while the plan is open -- so a reader who opened the
          plan was left with the same two lines in small type inside a sidebar.
          Reported on 8 October: *the user will not go looking in the sidebar
          for it*. An absence of marks is the answer to what they asked, so it
          is a card of its own, in the column the other answers appear in, and
          it stays there with the plan open.
        */}
        {panel && viewport !== null && layers.beforeRain && address !== null && places.length === 0 && (
          <MapNote title={BEFORE_RAIN_CHIP}>
            {NO_PLACES}
            <span style={{ display: 'block', marginTop: space(2) }}>{NO_PLACES_MEANS}</span>
            {!planOpen && (
              <span style={{ display: 'block', marginTop: space(3) }}>
                <button
                  type="button"
                  onClick={() => {
                    setAddressCardOpen(false);
                    setPlanOpen(true);
                  }}
                  style={planLinkStyle}
                >
                  {checkButton(places)}
                </button>
              </span>
            )}
          </MapNote>
        )}
      </MapNoteStack>

      {/*
        The address's own card for this layer, where the map suppresses the
        full one (Figma G1).

        The guides hide the address card — they are teaching one thing at a
        time — but AC 5.1.1 puts this button on the address, and the design
        draws it there in the guide too. So it gets a card of its own: the
        address, and the way into the plan.
      */}
      {panel &&
        viewport !== null &&
        address !== null &&
        !addressCard &&
        beforeRainCallout &&
        layers.beforeRain &&
        !planOpen &&
        openPlace === null &&
        onScreen([address.eastingM, address.northingM], viewport) && (
          <MapCallout
            at={toScreen(viewport, [address.eastingM, address.northingM])}
            within={calloutWithin}
            title={address.label}
            onClose={() => {
              // Closing it leaves the layer on: the markers are the point, and
              // the chip is what takes them off.
              setBeforeRainCallout(false);
            }}
          >
            <button
              type="button"
              onClick={() => {
                setPlanOpen(true);
                setOpenPlace(places[0]?.number ?? null);
              }}
              style={{
                padding: `${String(space(1))}px ${String(space(3))}px`,
                borderRadius: radius.pill,
                border: `1px solid ${brand.tint}`,
                background: brand.wash,
                color: brand.ink,
                font: type(text.small, { weight: weight.semibold }),
                cursor: 'pointer',
              }}
            >
              {checkButton(places)}
            </button>
          </MapCallout>
        )}

      {/*
        One place's card (Figma G2). Opened by the button above and by a press
        on a numbered marker, and closed when its answer sends the reader on.
      */}
      {/*
        The card hides with the marker it points at.

        Zoomed out past `WARNING_MIN_SCALE` the canvas stops drawing the signs
        -- a sign over a whole neighbourhood is a claim about a street nobody
        can see -- and the card stayed, anchored to a triangle that was not
        there. Panned away, the same. `warningsVisible(true, ...)` is the rule
        the canvas draws by, read from the same function rather than restated,
        so the two cannot drift. `openPlace` is left alone: zoom back in and
        the card is where it was, which is how the pit card behaves.
      */}
      {panel &&
        viewport !== null &&
        openPlace !== null &&
        warningsVisible(true, viewport.scale) &&
        (() => {
        const place = places.find((candidate) => candidate.number === openPlace);
        if (place === undefined) return null;
        if (!onScreen(place.at, viewport)) return null;
        const next = places.find((candidate) => candidate.number === place.number + 1);
        return (
          <MapCallout
            at={toScreen(viewport, place.at)}
            within={calloutWithin}
            title={placeTitle(place)}
            onClose={() => {
              setOpenPlace(null);
            }}
          >
            <PlaceCard
              place={place}
              relevance={relevance[place.number] ?? null}
              onReview={(answer) => {
                onReviewPlace?.(place.number, answer);
                /*
                  The answer sends the reader on, as the design draws it: to
                  the next numbered place, and to the plan, which is where the
                  answer has just changed something. Staying on a card whose
                  question has been answered leaves the reader looking for what
                  their press did.

                  Both, not one or the other. Until 8 October this only moved
                  to the next card, and on the last one it closed and left a
                  bare map: the plan was reachable again only by finding the
                  address pin and pressing the button on its card.
                */
                setPlanOpen(true);
                setOpenPlace(next?.number ?? null);
              }}
              {...(next === undefined
                ? {}
                : {
                    // Without answering: a reader may want to read all three
                    // before deciding any of them.
                    onNext: () => {
                      setOpenPlace(next.number);
                    },
                  })}
            />
            <span style={{ display: 'block', marginTop: space(2) }}>
              <button
                type="button"
                onClick={() => {
                  // It says the plan, so it opens the plan. It used to only
                  // close this card, which was true while the card could only
                  // be reached from a plan that was already open behind it.
                  setOpenPlace(null);
                  setPlanOpen(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: type(text.small),
                  color: ink.muted,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  cursor: 'pointer',
                }}
              >
                Back to the plan
              </button>
            </span>
          </MapCallout>
        );
      })()}

      {/* The plan itself (Figma P1), which the place card sits in front of. */}
      {sidebarOpen && (
        <Sidebar
          title={PREPARE_HEADING}
          {...(address === null ? {} : { subtitle: address.label })}
          width={panelWidth}
          onClose={() => {
            setPlanOpen(false);
          }}
        >
          {planPanel}
        </Sidebar>
      )}

      {/* The reporting pathway itself (Epic 6, AC 6.3.1 to 6.3.4). */}
      

      {panel &&
        viewport !== null &&
        address !== null &&
        hit === null &&
        warning === null &&
        !layers.catchment &&
        !planOpen &&
        openPlace === null &&
        addressCard &&
        addressCardOpen &&
        onScreen([address.eastingM, address.northingM], viewport) && (
        <MapCallout
          at={toScreen(viewport, [address.eastingM, address.northingM])}
          within={calloutWithin}
          title={address.label}
          onClose={() => {
            setAddressCardOpen(false);
          }}
        >
          {explanation === null && groundTrend === null ? (
            <>
              No place where water may flow or collect was found close to this address.
              <span style={{ display: 'block', marginTop: space(2) }}>
                <SourceLink id="derived" />
              </span>
            </>
          ) : (
            <AddressInsight ground={groundTrend} near={explanation} />
          )}
          {guided && (
            <span style={{ display: 'block', marginTop: 8, color: ink.subtle }}>
              Select a drain pit or pipe to read what the council recorded about it.
            </span>
          )}
          {/*
            AC 5.1.1: the count where there are places, the same words without
            it where there are none — and the plan is reachable either way,
            because the general actions are for every home.
          */}
          {layers.beforeRain && (
            <span style={{ display: 'block', marginTop: space(2) }}>
              <button
                type="button"
                onClick={() => {
                  setAddressCardOpen(false);
                  setPlanOpen(true);
                  setOpenPlace(places[0]?.number ?? null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: type(text.small, { weight: weight.semibold }),
                  color: ink.base,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  cursor: 'pointer',
                }}
              >
                {checkButton(places)}
              </button>
            </span>
          )}

          {/*
            The way to the layer the card is already talking about.

            The card says *water may pool about 20 m away* and then leaves the
            reader to work out that there is a layer which draws exactly that.
            The change list of 8 October asks for the button, and for it to
            say which way it goes rather than being a switch with no state:
            off, it offers to open the layer; on, it says the layer is already
            open, and pressing it takes the layer off again. Both sentences
            are the design's own.
          */}
          <span style={{ display: 'block', marginTop: space(2) }}>
            <button
              type="button"
              aria-pressed={layers.lowPoint}
              onClick={() => {
                toggle('lowPoint');
              }}
              style={{
                padding: `${String(space(1))}px ${String(space(3))}px`,
                borderRadius: radius.small,
                border: `1px solid ${layers.lowPoint ? brand.tint : line.base}`,
                background: layers.lowPoint ? brand.wash : surface.raised,
                color: layers.lowPoint ? brand.ink : ink.base,
                font: type(text.small, { weight: weight.semibold }),
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {layers.lowPoint ? LOW_AREAS_SHOWN : OPEN_LOW_AREAS}
            </button>
          </span>
        </MapCallout>
      )}
    </>
  );
}

/** The two states of the address card's low-areas button (change list, item 2). */
const OPEN_LOW_AREAS = 'Open low areas to see where water may pool';
const LOW_AREAS_SHOWN = 'Low areas already show on map';

/** Filled and outline, for the two choices a picking card offers. */
const pickFilledStyle = {
  padding: `${String(space(1))}px ${String(space(3))}px`,
  borderRadius: radius.small,
  border: `1px solid ${brand.base}`,
  background: brand.base,
  color: ink.inverse,
  font: type(text.small, { weight: weight.semibold }),
  cursor: 'pointer',
} as const;

const pickOutlineStyle = {
  padding: `${String(space(1))}px ${String(space(3))}px`,
  borderRadius: radius.small,
  border: `1px solid ${line.base}`,
  background: surface.raised,
  color: ink.base,
  font: type(text.small, { weight: weight.semibold }),
  cursor: 'pointer',
} as const;

/** The map's own underlined link, for the ways between its cards. */
const planLinkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: type(text.small),
  color: brand.ink,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
} as const;

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
      {/*
        Nothing found, said out loud.

        An empty box that simply shows no list is indistinguishable from a
        broken one, which is how it was reported on 3 October.
      */}
      {noMatch(index, typed, matches.length) !== null && (
        <p
          role="status"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 6,
            margin: 0,
            padding: space(2),
            background: surface.raised,
            border: `1px solid ${line.base}`,
            borderRadius: radius.base,
            boxShadow: shadow.lifted,
            font: type(text.small, { leading: 1.45 }),
            color: ink.muted,
          }}
        >
          {noMatch(index, typed, matches.length)}
        </p>
      )}

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
