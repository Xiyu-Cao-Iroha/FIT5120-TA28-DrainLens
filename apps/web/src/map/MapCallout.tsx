/**
 * What the map knows about the thing you pressed, said next to the thing you
 * pressed.
 *
 * **AC 1.1.7.b asks for a popup, and this is the first time the map has had
 * one.** The information used to live in a panel pinned to the left edge, 320
 * pixels wide and as tall as it needed to be. That panel was a reasonable
 * thing to build and it was not what the criterion says: pressing a pit on the
 * right of the screen moved the answer to the far left, so the mark and the
 * information about it were never in view together, and on a laptop the panel
 * covered a quarter of the map somebody had come to read.
 *
 * **Two depths, because the criterion asks for two different things.** AC
 * 1.1.7.c wants *a short plain-English explanation*, and AC 1.1.7.f wants
 * every missing and uncertain value identified — which for a pit is a
 * cross-section, three recorded fields and the reason a downstream path stops.
 * Those do not fit in one card and should not: the short sentence is what the
 * card says, and *More information* opens the rest in place. Nothing was
 * dropped when the panel went; it moved behind a disclosure that names itself.
 *
 * **It is placed by `ui/callout.ts`**, the same arithmetic the guided tour
 * uses, because it is the same problem: a small target at a known position, a
 * card of a known size, and a box neither may leave.
 */

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import { type Box, caretAt, placeCard, spotlightFor } from '../ui/callout.js';
import {
  basis as basisTone,
  brand,
  ink,
  line,
  radius,
  shadow,
  space,
  text,
  type,
  weight,
} from '../ui/theme.js';

/** Half the width of the mark a callout points at, in pixels. */
const MARK_RADIUS_PX = 12;

const WIDTH = 296;

/**
 * How tall the card may grow before it scrolls inside itself.
 *
 * Opened, a pit's card carries three recorded fields, the depth note, a
 * cross-section link and a downstream path — around 590 pixels, which is more
 * than the map is tall on a laptop. Left uncapped it stops fitting either
 * above or below the pit, falls back to the centre of the map with no caret,
 * and covers the controls. Capped, it stays attached to the thing it is about
 * and scrolls, which is the trade a popup should make: a card that has left
 * the mark behind is a panel again.
 */
const MAX_HEIGHT = 360;

export interface MapCalloutProps {
  /** Where the thing is, in the canvas's own pixels. */
  readonly at: readonly [number, number];
  /** The canvas, so the card can be kept inside it. */
  readonly within: { readonly width: number; readonly height: number };
  readonly title: string;
  /**
   * The badge, where one applies to the whole card.
   *
   * Omitted on the address callout: the address is the person's own and is
   * neither recorded by the council nor derived by us, while the sentence
   * inside it *is* derived and carries its own badge. One label over both
   * would put their house into a dataset.
   */
  readonly basis?: 'Official recorded data' | 'System-derived result';
  readonly children: ReactNode;
  /** The relevant next action, where there is one — AC 1.1.7.e. */
  readonly action?: { readonly label: string; readonly onPress: () => void };
  /** The rest of what is recorded, opened in place rather than elsewhere. */
  readonly more?: ReactNode;
  readonly onClose: () => void;
}

export function MapCallout({
  at,
  within,
  title,
  basis,
  children,
  action,
  more,
  onClose,
}: MapCalloutProps) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(150);

  // Measured rather than guessed, because the card grows by a cross-section
  // when More information is opened and a placement computed against the
  // closed height would then hang off the bottom of the map.
  useLayoutEffect(() => {
    const measured = cardRef.current?.getBoundingClientRect().height;
    if (measured !== undefined && measured > 0) setHeight(measured);
  }, [open, title, children]);

  const spot = spotlightFor(
    { x: at[0] - MARK_RADIUS_PX, y: at[1] - MARK_RADIUS_PX, width: MARK_RADIUS_PX * 2, height: MARK_RADIUS_PX * 2 },
    2,
  );
  const card: Box = { x: 0, y: 0, width: WIDTH, height };
  const placement = placeCard(spot, card, within);
  const tone =
    basis === undefined
      ? null
      : basis === 'Official recorded data'
        ? basisTone.recorded
        : basisTone.derived;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={title}
      style={{
        position: 'absolute',
        left: placement.left,
        top: placement.top,
        width: WIDTH,
        maxWidth: 'calc(100% - 32px)',
        maxHeight: `min(${String(MAX_HEIGHT)}px, calc(100% - 32px))`,
        overflow: 'auto',
        zIndex: 6,
        padding: space(4),
        background: 'rgba(255, 255, 255, 0.97)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${line.base}`,
        borderRadius: radius.large,
        boxShadow: shadow.floating,
      }}
    >
      {placement.caret !== 'none' && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: `calc(${String(caretAt(spot, placement, card) * 100)}% - 5px)`,
            ...(placement.caret === 'top' ? { top: -6 } : { bottom: -6 }),
            width: 10,
            height: 10,
            background: 'rgba(255, 255, 255, 0.97)',
            borderLeft: `1px solid ${line.base}`,
            borderTop: `1px solid ${line.base}`,
            transform: placement.caret === 'top' ? 'rotate(45deg)' : 'rotate(225deg)',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: space(2) }}>
        <strong
          style={{
            flex: 1,
            font: type(text.body, { weight: weight.semibold, leading: 1.3 }),
            color: ink.strong,
          }}
        >
          {title}
        </strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            padding: 0,
            lineHeight: 1,
            font: type(text.body),
            color: ink.subtle,
          }}
        >
          ×
        </button>
      </div>

      {basis !== undefined && tone !== null && (
        <span
          style={{
            display: 'inline-block',
            margin: `${String(space(2))}px 0`,
            padding: `1px ${String(space(2))}px`,
            borderRadius: radius.pill,
            background: tone.fill,
            color: tone.ink,
            font: type(text.micro, { weight: weight.medium, leading: 1.5 }),
          }}
        >
          {basis}
        </span>
      )}

      <div style={{ font: type(text.label, { leading: 1.55 }), color: ink.muted }}>{children}</div>

      {action && (
        <button
          type="button"
          onClick={action.onPress}
          style={{
            display: 'block',
            width: '100%',
            marginTop: space(3),
            paddingTop: space(3),
            borderTop: `1px solid ${line.hair}`,
            border: 'none',
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: line.hair,
            background: 'none',
            textAlign: 'left',
            font: type(text.label, { weight: weight.semibold }),
            color: brand.ink,
          }}
        >
          {action.label} →
        </button>
      )}

      {more !== undefined && (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            style={{
              display: 'block',
              width: '100%',
              marginTop: space(3),
              paddingTop: space(3),
              border: 'none',
              borderTop: `1px solid ${line.hair}`,
              background: 'none',
              textAlign: 'left',
              font: type(text.label, { weight: weight.medium }),
              color: ink.muted,
            }}
          >
            {open ? 'Less information ⌃' : 'More information ⌄'}
          </button>
          {open && <div style={{ marginTop: space(3) }}>{more}</div>}
        </>
      )}
    </div>
  );
}
