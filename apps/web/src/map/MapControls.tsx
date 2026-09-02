/**
 * The map's own furniture: zoom, recentre, and a scale bar.
 *
 * These live with the canvas rather than with the screen using it, because
 * they are properties of a map rather than of a task — every screen that shows
 * this map wants the same three, and a screen that has to wire them up itself
 * is a screen that can forget to.
 *
 * The scale bar is not decoration. This map has no basemap and no familiar
 * imagery to judge size against, and the product's own sentences are about
 * distance — "about 45 m from your selected address", "a low area about 10 m
 * to the east". Without a bar those numbers have nothing on screen to check
 * themselves against.
 */
import type { CSSProperties, ReactNode } from 'react';

import { ink, line, radius, shadow, space, surface, text, type, weight } from '../ui/theme.js';

/** One press of + or −. Gentler than a wheel notch, which is a whole gesture. */
export const STEP = 1.55;

/**
 * Nice round distances a bar may show, in metres.
 *
 * A bar reading "37 m" is arithmetic; one reading "50 m" is a measurement
 * somebody can carry across the map by eye.
 */
const NICE_M = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000] as const;

/** The widest a bar may be drawn, in pixels. */
const MAX_BAR_PX = 108;

/** Exported for the test that asserts a bar never exceeds it. */
export const MAX_BAR_PX_FOR_TEST = MAX_BAR_PX;

/**
 * The largest nice distance that fits, and how wide it is.
 *
 * Falls back to the smallest step when even that overflows, so a very zoomed
 * out view draws a short honest bar rather than nothing at all.
 */
export function scaleBar(pixelsPerMetre: number): { metres: number; widthPx: number } {
  for (let i = NICE_M.length - 1; i >= 0; i -= 1) {
    const metres = NICE_M[i]!;
    const widthPx = metres * pixelsPerMetre;
    if (widthPx <= MAX_BAR_PX) return { metres, widthPx };
  }
  const smallest = NICE_M[0]!;
  return { metres: smallest, widthPx: smallest * pixelsPerMetre };
}

const SURFACE: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.94)',
  backdropFilter: 'blur(6px)',
  border: `1px solid ${line.base}`,
  borderRadius: radius.base,
  boxShadow: shadow.floating,
};

function ControlButton({
  label,
  glyph,
  onPress,
  disabled = false,
}: {
  readonly label: string;
  readonly glyph: ReactNode;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: 34,
        height: 34,
        display: 'grid',
        placeItems: 'center',
        border: 'none',
        background: disabled ? 'transparent' : surface.raised,
        color: disabled ? line.strong : ink.base,
        padding: 0,
      }}
    >
      {glyph}
    </button>
  );
}

const Plus = (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden focusable="false">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const Minus = (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden focusable="false">
    <path d="M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const Crosshair = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden focusable="false">
    <circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export interface MapControlsProps {
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  /** Absent when no address is selected — there is nowhere to return to. */
  readonly onRecentre?: (() => void) | undefined;
  /** Pixels per metre, for the bar. */
  readonly scale: number;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  onRecentre,
  scale,
}: MapControlsProps) {
  const bar = scaleBar(scale);

  return (
    <div
      style={{
        position: 'absolute',
        right: space(4),
        bottom: space(4),
        zIndex: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: space(2),
      }}
    >
      <div
        style={{
          ...SURFACE,
          display: 'flex',
          alignItems: 'center',
          gap: space(2),
          padding: `${String(space(1))}px ${String(space(2))}px`,
        }}
      >
        <span
          className="tabular"
          style={{ font: type(text.micro, { weight: weight.medium, leading: 1.6 }), color: ink.muted }}
        >
          {bar.metres} m
        </span>
        <span
          aria-hidden
          style={{
            width: Math.round(bar.widthPx),
            height: 6,
            borderLeft: `2px solid ${ink.subtle}`,
            borderRight: `2px solid ${ink.subtle}`,
            borderBottom: `2px solid ${ink.subtle}`,
          }}
        />
      </div>

      {onRecentre && (
        <div style={{ ...SURFACE, overflow: 'hidden' }}>
          <ControlButton
            label="Recentre on the selected address"
            glyph={Crosshair}
            onPress={onRecentre}
          />
        </div>
      )}

      <div style={{ ...SURFACE, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ControlButton label="Zoom in" glyph={Plus} onPress={onZoomIn} disabled={!canZoomIn} />
        <span aria-hidden style={{ height: 1, background: line.hair }} />
        <ControlButton label="Zoom out" glyph={Minus} onPress={onZoomOut} disabled={!canZoomOut} />
      </div>
    </div>
  );
}
