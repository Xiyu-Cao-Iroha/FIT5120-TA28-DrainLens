/**
 * The map's right-hand sidebar.
 *
 * Epic 5's panel, as the design draws it (Figma `atD5fleOrhvMjJ5m0pXYGt`, P1
 * and AI1): a column down the right edge of the map, full height, with the
 * title and the address at the top and everything else scrolling under them.
 *
 * It replaces a floating card for a reason that showed up as soon as there
 * was something long to put in one. A card in a corner is right for a note
 * about a pit: it is short, it is about the thing under it, and it goes away.
 * The preparation plan is neither short nor about a point on the map, and in
 * a 300-pixel card it was a column of text the width of a phone sitting on
 * top of the map it is about, with the legend and the zoom controls
 * underneath it.
 *
 * **The map keeps its size and the chrome moves out of the way.** The panel
 * is drawn over the right edge, as the design draws it, and while it is open
 * the zoom, recentre and scale controls sit against its left edge instead of
 * the window's, the legend folds itself away and the layer chips collapse to
 * one button. The canvas is deliberately *not* resized: its width decides how
 * wide this panel is, so taking the panel's width off the canvas would make
 * each one an input to the other, and the two would argue every time somebody
 * dragged the window across a threshold.
 */

import { type ReactNode } from 'react';

import { ink, line, radius, shadow, space, surface, text, type, weight } from '../ui/theme.js';

/**
 * How wide, in pixels.
 *
 * A number rather than a `clamp()` because the map has to subtract it: the
 * canvas is drawn to a size this file decides, and a width only CSS knows
 * cannot be taken off it.
 */
export const SIDEBAR_WIDTH = 400;

/** The width used where the window cannot spare the full one. */
export const SIDEBAR_NARROW = 300;

/** What the sidebar is, at a given map width. `0` means there is no room. */
export function sidebarWidth(mapWidth: number): number {
  if (mapWidth >= 900) return SIDEBAR_WIDTH;
  if (mapWidth >= 620) return SIDEBAR_NARROW;
  return 0;
}

export function Sidebar({
  title,
  subtitle,
  width,
  onClose,
  children,
}: {
  readonly title: string;
  /** The address, under the title, where there is one (Figma P1). */
  readonly subtitle?: string | undefined;
  readonly width: number;
  readonly onClose?: (() => void) | undefined;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        background: surface.raised,
        borderLeft: `1px solid ${line.base}`,
        boxShadow: shadow.lifted,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          gap: space(2),
          alignItems: 'flex-start',
          padding: `${String(space(4))}px ${String(space(4))}px ${String(space(3))}px`,
          borderBottom: `1px solid ${line.hair}`,
        }}
      >
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <h2 style={{ margin: 0, font: type(text.lead, { weight: weight.bold }), color: ink.strong }}>
            {title}
          </h2>
          {subtitle !== undefined && subtitle !== '' && (
            <p style={{ margin: `${String(space(1))}px 0 0`, font: type(text.small), color: ink.muted }}>
              {subtitle}
            </p>
          )}
        </div>
        {onClose !== undefined && (
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              border: 'none',
              borderRadius: radius.small,
              background: 'none',
              font: type(text.lead),
              color: ink.muted,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        )}
      </header>

      <div style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', padding: space(4) }}>
        {children}
      </div>
    </section>
  );
}
