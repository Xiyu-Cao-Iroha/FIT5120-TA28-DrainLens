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
import { useEffect, useRef } from 'react';

import { type MapArtefact, boundsOf } from './artefact.js';
import { type DerivedArtefact, drawDerived } from './derived.js';
import { drawMap } from './draw.js';
import { type Viewport, fit } from './viewport.js';
import { ink, line, radius, shadow, space, surface, text, type, weight } from '../ui/theme.js';

/**
 * How far in the drawing sits.
 *
 * Zoomed to a neighbourhood rather than the whole square kilometre. At full
 * extent the network is a dense mesh with no legible feature in it; at this
 * scale you can follow one street and see the pits along it, which is what the
 * page is claiming the product does.
 */
const ZOOM = 2.4;

export interface FramedMapProps {
  readonly artefact: MapArtefact;
  readonly derived: DerivedArtefact;
}

export function FramedMap({ artefact, derived }: FramedMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

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
      const viewport: Viewport = { ...base, scale: base.scale * ZOOM };

      drawMap(context, artefact, viewport, { showPipes: true, showPits: true });
      drawDerived(context, derived, viewport, {});
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(frame);
    return () => {
      observer.disconnect();
    };
  }, [artefact, derived]);

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
      </div>
    </div>
  );
}
