/**
 * The pilot square kilometre, drawn once, as the landing page's own image.
 *
 * The landing page used to be a form in the middle of an empty page. A product
 * whose entire argument is *look at the ground you live on* was showing none
 * of it until after you had typed your address — and the thing it was hiding
 * is the only genuinely beautiful asset it has.
 *
 * **It costs nothing extra.** `map.json` and `derived.json` are already
 * fetched before this screen renders. What is deliberately *not* drawn is the
 * ground surface: that needs `elevation.bin`, 788 KB over the wire, and
 * doubling a first visit for a background image is not a trade this product
 * should make. Roads, pipes, pits and the derived water paths are enough — a
 * fine line drawing of a drainage network is a better hero than a colour wash
 * anyway, because you can see it is a *record* rather than a picture.
 *
 * It is inert: no pan, no zoom, no hit testing, and `aria-hidden`, because it
 * is illustration here rather than instrument. The instrument is two screens
 * away and behaves completely differently.
 */
import { useEffect, useRef } from 'react';

import { type MapArtefact, boundsOf } from './artefact.js';
import { type DerivedArtefact, drawDerived } from './derived.js';
import { drawMap } from './draw.js';
import { type Viewport, fit } from './viewport.js';

/**
 * How much of the extent to show.
 *
 * Slightly more than fits, so the drawing runs off every edge. A map with its
 * whole boundary visible reads as a diagram of a rectangle; one that continues
 * past the frame reads as a place.
 */
const OVERSCAN = 2.05;

export interface HeroMapProps {
  readonly artefact: MapArtefact;
  readonly derived: DerivedArtefact;
  /** Where in the extent to centre, in local metres. Defaults to the middle. */
  readonly centre?: readonly [number, number];
}

export function HeroMap({ artefact, derived, centre }: HeroMapProps) {
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
      const viewport: Viewport = {
        ...base,
        scale: base.scale * OVERSCAN,
        centre: centre ?? base.centre,
      };

      drawMap(context, artefact, viewport, { showPipes: true, showPits: true, showLabels: false });
      drawDerived(context, derived, viewport, {});
    };

    paint();

    // Redrawn on resize because this is a single paint rather than a live
    // canvas: without it, the drawing stays at the width the page opened at.
    const observer = new ResizeObserver(paint);
    observer.observe(frame);
    return () => {
      observer.disconnect();
    };
  }, [artefact, derived, centre]);

  return (
    <div ref={frameRef} aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}
