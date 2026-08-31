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
import { drawMap } from './draw.js';
import { type Hit, pick } from './hit.js';
import { type Local, type Viewport, clamp, fit, focus, pan, zoomAt } from './viewport.js';
import { drawTrace } from '../trace/draw.js';
import { drawTerrain } from './terrain.js';
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
  readonly showPipes?: boolean;
  readonly showPits?: boolean;
  /**
   * The selected address, in local metres.
   *
   * The map opens centred on it and marks it — AC 1.1.2.a and 1.1.3.a. It is
   * only the *opening* view: once somebody has panned, a re-render must not
   * drag them back, so this is read when the viewport is first built.
   */
  readonly address?: Local | null;
  /** A followed downstream path, drawn over the network it was read from. */
  readonly trace?: Trace | null;
  readonly onSelect?: (hit: Hit | null) => void;
}

export function MapCanvas({
  artefact,
  derived = null,
  show,
  selectedPit = null,
  suggestedPit = null,
  terrain = null,
  showPipes = true,
  showPits = true,
  address = null,
  trace = null,
  onSelect,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: number } | null>(null);
  // Held in a ref rather than read in the effect, so that changing the
  // address does not re-run the resize effect and yank a panned map back.
  const openingRef = useRef<Local | null>(address);
  const bounds = boundsOf(artefact);

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
            : focus(width, height, bounds, openingRef.current)
          : clamp({ ...current, widthPx: width, heightPx: height }, bounds),
      );
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [bounds.widthM, bounds.heightM]);

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
    // The followed path goes on top of both. It is the answer to the
    // question the person just asked, and a derived layer drawn over it
    // would bury the thing they are looking for.
    if (trace) drawTrace(context, artefact, trace, viewport);
  }, [artefact, derived, show, viewport, selectedPit, suggestedPit, address, trace,
      terrain, showPipes, showPits]);

  const at = useCallback((event: React.PointerEvent | React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return [event.clientX - (rect?.left ?? 0), event.clientY - (rect?.top ?? 0)] as const;
  }, []);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      if (viewport === null) return;
      const factor = Math.exp(-event.deltaY * 0.0015);
      setViewport(clamp(zoomAt(viewport, factor, at(event), bounds), bounds));
    },
    [viewport, bounds, at],
  );

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, moved: 0 };
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || viewport === null) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
      setViewport(clamp(pan(viewport, dx, dy), bounds));
    },
    [viewport, bounds],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || viewport === null) return;
      // A drag that ends over a pit is still a drag. Selecting on it would
      // change what the panel is about every time somebody moved the map.
      if (drag.moved > DRAG_SLOP_PX) return;
      onSelect?.(pick(at(event), viewport, artefact.layers));
    },
    [viewport, artefact, onSelect, at],
  );

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
        style={{ display: 'block', cursor: 'grab' }}
      />
    </div>
  );
}
