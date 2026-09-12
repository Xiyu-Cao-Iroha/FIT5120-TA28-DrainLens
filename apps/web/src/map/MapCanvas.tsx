/**
 * The canvas, and the gestures that move it.
 *
 * There is no map library here on purpose. The extent is a fixed square
 * kilometre, north-up, shipped in its own metre-based frame — so there is no
 * global projection to handle, no tile pyramid, no level-of-detail switching
 * and no third-party basemap to depend on. What is left is an affine transform
 * and a draw call, and a library for that would be several hundred kilobytes
 * solving problems this product does not have.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { type MapArtefact, boundsOf } from './artefact.js';
import { type DerivedArtefact, type DerivedVisibility, drawDerived } from './derived.js';
import { drawMap, pressedThePin } from './draw.js';
import { type Hit, pick, selectableLayers } from './hit.js';
import {
  MAX_SCALE,
  type Local,
  type Viewport,
  clamp,
  fit,
  focus,
  pan,
  scaleToContain,
  scaleToCover,
  toScreen,
  zoomAt,
} from './viewport.js';
import { drawTrace } from '../trace/draw.js';
import { type DifferenceArea, drawDifference } from './difference.js';
import { drawTerrain } from './terrain.js';
import { MapControls, STEP } from './MapControls.js';
import type { Trace } from '../trace/graph.js';

/** Beyond this the pointer was dragging the map, not tapping something on it. */
const DRAG_SLOP_PX = 4;

export interface MapCanvasProps {
  readonly artefact: MapArtefact;
  readonly derived?: DerivedArtefact | null;
  readonly show?: DerivedVisibility;
  readonly selectedPit?: number | null;
  /** Offered but not confirmed — drawn as a ring, not a fill. */
  readonly suggestedPit?: number | null;
  /** The painted terrain raster, or null when it is off or not loaded. */
  readonly terrain?: HTMLCanvasElement | null;
  /**
   * How many metres wide the view is when it opens, instead of `LOCAL_SCALE`.
   *
   * Expressed in metres rather than in pixels per metre so that it means the
   * same thing in a frame of any size — which is the whole reason it exists.
   * `LOCAL_SCALE` is 3 px/m, and in the guide's 560-pixel frame that is 187
   * metres of a square kilometre: enough to see one street and not enough to
   * find the pit you are being asked to press.
   */
  readonly openAcrossM?: number;
  /**
   * Hold the opening view: no pan, no zoom, and no controls offering either.
   *
   * **For the guide, where moving the map is not one of the things being
   * taught.** Every step says press *this* — a chip, a marked pit, a button on
   * its card — and a reader who has dragged the map somewhere else is being
   * asked to press something that is no longer on screen, with nothing telling
   * them why. The lesson has one place in it.
   *
   * Selecting still works. This takes away *moving* the view, not using what
   * is in it, and the difference is the whole point: a map you cannot press is
   * a picture, and the guide's first claim is that this is the real map.
   */
  readonly locked?: boolean;
  readonly showPipes?: boolean;
  readonly showPits?: boolean;
  /**
   * The selected address, in local metres.
   *
   * The map opens centred on it and marks it — AC 1.1.3.b, and AC 1.1.9.b
   * again when the address changes from the map itself. It is
   * only the *opening* view: once somebody has panned, a re-render must not
   * drag them back, so this is read when the viewport is first built.
   */
  readonly address?: Local | null;
  /** A followed downstream path, drawn over the network it was read from. */
  readonly trace?: Trace | null;
  /**
   * Where a finished comparison puts more water than its baseline.
   *
   * Null on every screen but the result: this is the answer to one question
   * that has been asked, not a property of the map.
   */
  readonly difference?: DifferenceArea | null;
  readonly onSelect?: (hit: Hit | null) => void;
  /**
   * The address pin was pressed.
   *
   * Separate from `onSelect` rather than a third kind of `Hit`, because the
   * pin is not a feature: it is the person's own location, drawn from no
   * artefact, and everything downstream that switches on a hit is asking a
   * question about the council's record. A pin that arrived as a `Hit` would
   * have to be excluded again at every one of those places.
   */
  readonly onAddressPress?: () => void;
  /**
   * The current viewport, whenever it changes.
   *
   * The map owns its own pan and zoom — that is view state and nothing above
   * it should be re-rendering on every drag. But a caller that wants to put
   * something *at* a feature needs the same transform the canvas drew with,
   * and deriving a second one outside would be two answers to one question.
   * So the viewport is reported rather than lifted.
   */
  readonly onViewport?: (viewport: Viewport | null) => void;
}

export function MapCanvas({
  artefact,
  derived = null,
  show,
  selectedPit = null,
  suggestedPit = null,
  terrain = null,
  openAcrossM,
  locked = false,
  showPipes = true,
  showPits = true,
  address = null,
  trace = null,
  difference = null,
  onSelect,
  onAddressPress,
  onViewport,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: number } | null>(null);
  // Held in a ref rather than read in the effect, so that changing the
  // address does not re-run the resize effect and yank a panned map back.
  const openingRef = useRef<Local | null>(address);
  // The address the view has already been moved to. A *re-render* must not
  // drag a panned map back, which is what `openingRef` protects against — but
  // a genuinely different address must, or searching for one from the map
  // leaves you looking at the old neighbourhood with a new name on the panel.
  const movedToRef = useRef<Local | null>(address);
  const bounds = boundsOf(artefact);
/**
   * How far out zooming may go, for one viewport.
   *
   * Declared here because both zoom handlers and the control's disabled state
   * must use the same number — a wheel that stops at one floor and a button
   * that stops at another is two maps.
   */
  const floorOf = (v: Viewport) => scaleToContain(v.widthPx, v.heightPx, bounds);

  // Size to the element, in device pixels, so the map is not a blurred
  // upscale on the screens most people will open it on.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const resize = () => {
      const { width, height } = frame.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      setViewport((current) =>
        current === null
          ? openingRef.current === null
            ? fit(width, height, bounds)
            : focus(
                width,
                height,
                bounds,
                openingRef.current,
                openAcrossM === undefined ? undefined : width / openAcrossM,
              )
          : clamp({ ...current, widthPx: width, heightPx: height }, bounds),
      );
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [bounds.widthM, bounds.heightM, openAcrossM]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewport === null) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewport.widthPx * ratio);
    canvas.height = Math.round(viewport.heightPx * ratio);
    canvas.style.width = `${viewport.widthPx}px`;
    canvas.style.height = `${viewport.heightPx}px`;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Recorded first, derived over it. A derivation drawn under the network it
    // was calculated from would look like the ground the network sits in.
    // The ground first: everything else sits on it, and a network drawn under
    // its own terrain would read as buried rather than as underground.
    //
    // `drawMap` opens by filling the whole canvas, so it has to be told the
    // ground is already painted. Without that it erases the terrain before
    // drawing a single road over it.
    if (terrain) drawTerrain(context, terrain, viewport, bounds);
    drawMap(context, artefact, viewport, {
      selectedPit,
      suggestedPit,
      address,
      showPipes,
      showPits,
      groundAlreadyDrawn: terrain !== null,
    });
    if (derived) drawDerived(context, derived, viewport, show ? { show } : {});
    // Over the derived layers, under the followed path. The difference is the
    // answer to the question that was just asked, so nothing calculated
    // beforehand should cover it — but a trace the person is actively
    // following is a second question, and it stays on top of the first.
    if (difference) drawDifference(context, difference, viewport);
    // The followed path goes on top of both. It is the answer to the
    // question the person just asked, and a derived layer drawn over it
    // would bury the thing they are looking for.
    if (trace) drawTrace(context, artefact, trace, viewport);
  }, [artefact, derived, show, viewport, selectedPit, suggestedPit, address, trace,
      terrain, showPipes, showPits, difference]);

  const at = useCallback((event: React.PointerEvent | React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return [event.clientX - (rect?.left ?? 0), event.clientY - (rect?.top ?? 0)] as const;
  }, []);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      if (locked || viewport === null) return;
      const factor = Math.exp(-event.deltaY * 0.0015);
      setViewport(clamp(zoomAt(viewport, factor, at(event), bounds, floorOf(viewport)), bounds));
    },
    [locked, viewport, bounds, at],
  );

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, moved: 0 };
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || viewport === null) return;
      /*
        Locked: the pointer still moves, and the view does not.

        `drag.moved` keeps accumulating, which matters -- `onPointerUp` uses it
        to tell a press from a drag, and a lock that stopped counting would
        turn every swipe across the map into a selection of whatever happened
        to be under the finger when it lifted.
      */
      if (locked) {
        drag.moved += Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y);
        drag.x = event.clientX;
        drag.y = event.clientY;
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
      setViewport(clamp(pan(viewport, dx, dy), bounds));
    },
    [locked, viewport, bounds],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || viewport === null) return;
      // A drag that ends over a pit is still a drag. Selecting on it would
      // change what the panel is about every time somebody moved the map.
      if (drag.moved > DRAG_SLOP_PX) return;

      // The pin first, and only when it is drawn. It stands *above* the point
      // it marks, in space no feature occupies, so testing it before the
      // network cannot steal a press from a pit -- and testing it after would
      // let a pipe running under the pin's head take one from the pin.
      const press = at(event);
      if (address && pressedThePin(press, toScreen(viewport, address))) {
        onAddressPress?.();
        return;
      }

      /*
        Only what is drawn can be selected.

        `pick` was given every layer the artefact carries, whatever the
        switches said, so turning Pits off hid the markers and left them
        selectable: a press on blank ground opened a card about a pit that was
        not on the map. The rule belongs here rather than inside `pick`,
        because this is the one place that knows what was painted -- the same
        two flags go to the draw call a few lines above.
      */
      onSelect?.(
        pick(
          press,
          viewport,
          selectableLayers(artefact.layers, { pits: showPits, pipes: showPipes }),
        ),
      );
    },
    [viewport, artefact, onSelect, at, address, onAddressPress, showPits, showPipes],
  );

  // Reported, not lifted: the caller is told where the transform ended up and
  // does not get to set it. Keyed on the viewport object, which only changes
  // when the map really moved.
  useEffect(() => {
    onViewport?.(viewport);
  }, [viewport, onViewport]);

  // Move when the address actually changes, and only then.
  useEffect(() => {
    if (address === null) return;
    const held = movedToRef.current;
    if (held !== null && held[0] === address[0] && held[1] === address[1]) return;
    movedToRef.current = address;
    setViewport((current) =>
      current === null
        ? current
        : clamp(focus(current.widthPx, current.heightPx, bounds, address, current.scale), bounds),
    );
  }, [address, bounds]);

  const zoomBy = useCallback(
    (factor: number) => {
      if (!viewport) return;
      // About the centre of the canvas, not the pointer: somebody pressing a
      // button is looking at the middle of the map, while somebody turning a
      // wheel is looking at whatever is under their cursor.
      const centre: [number, number] = [viewport.widthPx / 2, viewport.heightPx / 2];
      setViewport(clamp(zoomAt(viewport, factor, centre, bounds, floorOf(viewport)), bounds));
    },
    [viewport, bounds],
  );

  /*
    How far out is far enough: the scale at which the whole extent is on screen.

    **It used to be the covering scale**, on the reasoning that below it the map
    would sit in a frame of nothing. That was written for a square kilometre in
    a roughly square pane, where covering and containing are nearly the same
    thing. The council extent is 8.5 by 9 km and a browser pane is wide and
    short: covering it leaves **41% of its height** on screen and no gesture
    that reaches the rest, under a button that says *Open the whole map*.

    The opening view still covers, so nothing about a first visit changes. What
    changes is that zooming out no longer stops early — and `drawMap` paints
    the ground only inside the extent, so the margin reads as *the map ends
    here* rather than as empty land.
  */
  const minScale = viewport === null ? 0 : floorOf(viewport);

  return (
    <div
      ref={frameRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        // `grab` promises the map moves. Locked, it does not, and a cursor
        // that says otherwise is the interface making a claim it will not keep.
        style={{ display: 'block', cursor: locked ? 'default' : 'grab' }}
      />
      {viewport && (
          <MapControls
            // Locked, this is the scale bar and nothing else. The bar is not a
            // control -- it is how "about 20 m from your address" is checked
            // against the screen -- and this map has no basemap to judge size
            // against without it.
            locked={locked}
            scale={viewport.scale}
            canZoomIn={viewport.scale < MAX_SCALE - 1e-6}
            canZoomOut={viewport.scale > minScale + 1e-6}
            onZoomIn={() => {
              zoomBy(STEP);
            }}
            onZoomOut={() => {
              zoomBy(1 / STEP);
            }}
            onRecentre={
              address === null
                ? undefined
                : () => {
                    setViewport((current) =>
                      current === null
                        ? current
                        : clamp(
                            focus(current.widthPx, current.heightPx, bounds, address, current.scale),
                            bounds,
                          ),
                    );
                  }
            }
          />
        )}
      </div>
    );
}
