/**
 * The product, shown as the product: the real map inside a window frame.
 *
 * An earlier attempt put this same drawing loose beside the writing and it
 * read as a screenshot somebody had pasted into a layout — because with no
 * frame and an arbitrary crop, that is exactly what it was. The frame is what
 * changes it: a bordered card with the product's own chrome along the top says
 * "this is the thing", where a bleeding crop says "here is some texture".
 *
 * It costs nothing extra. `map.json` and `derived.json` are already fetched
 * before this renders. The ground surface is deliberately absent — that needs
 * `elevation.bin`, 788 KB, and doubling a first visit for a picture is not a
 * trade this product should make.
 */
import { useEffect, useMemo, useRef } from 'react';

import { type MapArtefact, type Pit, boundsOf } from './artefact.js';
import { type DerivedArtefact, drawDerived } from './derived.js';
import { drawMap } from './draw.js';
import { type Viewport, fit } from './viewport.js';
import {
  basis,
  brand,
  ink,
  line,
  radius,
  shadow,
  space,
  surface,
  text,
  type,
  weight,
} from '../ui/theme.js';

/**
 * How far in the drawing sits.
 *
 * Zoomed to a neighbourhood rather than the whole square kilometre. At full
 * extent the network is a dense mesh with no legible feature in it; at this
 * scale you can follow one street and see the pits along it, which is what the
 * page is claiming the product does.
 */
const ZOOM = 2.4;

/**
 * Where the named pit sits in the frame, as a fraction of it.
 *
 * Left of centre and slightly above it, because the card that names the pit
 * hangs off it to the right and must not run out of frame. The viewport is
 * then solved backwards from this rather than the pit being hunted for after
 * the fact — which is what makes the card's tail meet the marker at every
 * width the frame is ever given.
 */
const PIT_AT: readonly [number, number] = [0.3, 0.42];

/**
 * The pit the preview names.
 *
 * **It has to be a pit with a pipe leaving it**, because the card says *Show
 * connected pipe* and a card that says that about a pit with no recorded
 * connection is describing something the product would not do. That is the
 * whole selection rule; among those, the one nearest the middle of the extent
 * wins, so the view around it is neighbourhood rather than edge.
 *
 * Returns null rather than falling back to any pit at all. A preview is worth
 * less than a claim that is not true, and the frame draws perfectly well
 * without a card on it.
 */
export function previewPit(artefact: MapArtefact): Pit | null {
  const pits = artefact.layers.pit ?? [];
  const pipes = artefact.layers.pipe ?? [];
  if (pits.length === 0) return null;

  const connected = new Set<number>();
  for (const pipe of pipes) {
    if (typeof pipe.upstr_pit === 'number') connected.add(pipe.upstr_pit);
  }
  if (connected.size === 0) return null;

  const midE = artefact.extent.width_m / 2;
  const midN = artefact.extent.height_m / 2;

  let best: Pit | null = null;
  let bestDistance = Infinity;
  for (const pit of pits) {
    if (pit.asset_number === undefined || !connected.has(pit.asset_number)) continue;
    const distance = Math.hypot(pit.c[0] - midE, pit.c[1] - midN);
    // Strictly nearer, so ties go to the earlier pit and the choice is stable
    // across rebuilds that do not move anything.
    if (distance < bestDistance) {
      bestDistance = distance;
      best = pit;
    }
  }
  return best;
}

export interface FramedMapProps {
  readonly artefact: MapArtefact;
  readonly derived: DerivedArtefact;
}

export function FramedMap({ artefact, derived }: FramedMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pit = useMemo(() => previewPit(artefact), [artefact]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    const paint = () => {
      const { width, height } = frame.getBoundingClientRect();
      if (width < 2 || height < 2) return;

      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${String(width)}px`;
      canvas.style.height = `${String(height)}px`;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const base = fit(width, height, boundsOf(artefact));
      const scale = base.scale * ZOOM;
      // Solved from where the pit has to land, not chosen and then measured.
      // `toScreen` is x = w/2 + (e - cE)·s and y = h/2 - (n - cN)·s, so this is
      // that inverted for the centre, with the minus sign in the northing.
      const centre: Viewport['centre'] = pit
        ? [
            pit.c[0] - (PIT_AT[0] - 0.5) * (width / scale),
            pit.c[1] + (PIT_AT[1] - 0.5) * (height / scale),
          ]
        : base.centre;
      const viewport: Viewport = { ...base, scale, centre };

      drawMap(context, artefact, viewport, {
        showPipes: true,
        showPits: true,
        ...(pit?.asset_number === undefined ? {} : { selectedPit: pit.asset_number }),
      });
      drawDerived(context, derived, viewport, {});
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(frame);
    return () => {
      observer.disconnect();
    };
  }, [artefact, derived, pit]);

  return (
    <div
      aria-hidden
      className="home__preview"
      style={{
        background: surface.raised,
        border: `1px solid ${line.base}`,
        borderRadius: radius.large,
        boxShadow: shadow.lifted,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* The product's own chrome, so the card reads as the application. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space(2),
          padding: `${String(space(2))}px ${String(space(3))}px`,
          borderBottom: `1px solid ${line.hair}`,
          background: surface.raised,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" focusable="false">
          <circle cx="7" cy="7" r="4.6" fill="none" stroke={ink.subtle} strokeWidth="1.5" />
          <path d="m10.6 10.6 3.4 3.4" stroke={ink.subtle} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span style={{ font: type(text.small), color: ink.subtle }}>
          32 Altona Street, Kensington
        </span>
        <span
          style={{
            marginLeft: 'auto',
            padding: `2px ${String(space(2))}px`,
            borderRadius: radius.small,
            background: '#1f6f5c',
            color: surface.raised,
            font: type(text.micro, { weight: weight.semibold, leading: 1.6 }),
          }}
        >
          Drainage
        </span>
      </div>

      <div ref={frameRef} style={{ position: 'relative', flex: 1, minHeight: 260 }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        {pit && <PitCallout />}
      </div>
    </div>
  );
}

/**
 * The card the map shows when a pit is selected, drawn here as part of the
 * picture.
 *
 * **It is rendered only when there is a real pit for it to point at**, and
 * `previewPit` picks one with a pipe recorded leaving it — because the card
 * says *Show connected pipe*, and a preview that promises something the
 * product would not do for the person who came in and looked is the worst
 * thing that could be on this page. The badge is the same *Official recorded
 * data* the map puts on this layer everywhere else, and the sentence claims
 * nothing about depth, capacity or blockage, because the product does not
 * know those and says so further down.
 *
 * It is not interactive, and the whole frame is `aria-hidden`: this is a
 * picture of the application, like the search field and the mode pill in the
 * chrome above it. The route into the real thing is the button beside it.
 */
function PitCallout() {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${String(PIT_AT[0] * 100)}%`,
        top: `${String(PIT_AT[1] * 100)}%`,
        // Clear of the marker's own label, which the map draws above the pit
        // with the asset number in it.
        marginLeft: 36,
        marginTop: -16,
        width: 'min(64%, 232px)',
        padding: space(3),
        background: surface.raised,
        border: `1px solid ${line.base}`,
        borderRadius: radius.large,
        boxShadow: shadow.lifted,
      }}
    >
      {/* The tail, pointing back at the marker the viewport was solved for. */}
      <span
        style={{
          position: 'absolute',
          left: -6,
          top: 20,
          width: 10,
          height: 10,
          background: surface.raised,
          borderLeft: `1px solid ${line.base}`,
          borderBottom: `1px solid ${line.base}`,
          transform: 'rotate(45deg)',
        }}
      />
      {/*
        No asset number here. The map already draws it on the marker this card
        points at, and the same identifier twice, six pixels apart, reads as
        two things rather than one.
      */}
      <strong
        style={{
          display: 'block',
          font: type(text.label, { weight: weight.semibold, leading: 1.25 }),
          color: ink.strong,
        }}
      >
        Drainage pit
      </strong>

      <span
        style={{
          display: 'inline-block',
          margin: `${String(space(2))}px 0`,
          padding: `1px ${String(space(2))}px`,
          borderRadius: radius.pill,
          background: basis.recorded.fill,
          color: basis.recorded.ink,
          font: type(text.micro, { weight: weight.medium, leading: 1.5 }),
        }}
      >
        Official recorded data
      </span>

      <p style={{ margin: 0, font: type(text.small, { leading: 1.45 }), color: ink.muted }}>
        This pit collects surface water from the street and connects it to the recorded
        drainage network.
      </p>

      <span
        style={{
          display: 'block',
          marginTop: space(3),
          paddingTop: space(2),
          borderTop: `1px solid ${line.hair}`,
          font: type(text.small, { weight: weight.semibold, leading: 1.4 }),
          color: brand.ink,
        }}
      >
        Show connected pipe →
      </span>
    </div>
  );
}
