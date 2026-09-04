/**
 * The guided tour: a dark overlay with a hole in it, and a card beside the
 * hole.
 *
 * **The hole is the point.** An overlay that dims everything, including the
 * control it is talking about, leaves a person reading *"press this button"*
 * over a button they can no longer see. So the target keeps its own
 * brightness and everything else goes dark, which is what the prototype's
 * hand-drawn circles were standing in for.
 *
 * **It is drawn with four rectangles, not one with a hole punched in it.** A
 * `box-shadow` spread of several thousand pixels does the same job in one
 * element and is the usual trick, but it paints a shadow the size of the
 * document on every step change and on every resize. Four divs cost nothing
 * and are what they look like.
 *
 * **Three things the prototype did not have, which a modal of seven steps
 * cannot ship without.** Escape closes it. *Skip* closes it, because being
 * made to press OK seven times to reach the map is a worse first minute than
 * no tour at all. And focus is held inside the card — with the map still
 * reachable by Tab behind a dark sheet, somebody navigating by keyboard is
 * operating an interface they cannot see.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  type Box,
  type Placement,
  TOUR_STEPS,
  type TourTarget,
  caretAt,
  placeCard,
  spotlightFor,
} from './tourPlan.js';
import {
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
} from './theme.js';

const SHEET = 'rgba(15, 23, 42, 0.62)';
const CARD_WIDTH = 340;

/** Where the control is now, or null while there is nothing to point at. */
function useTargetBox(target: TourTarget): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const node = document.querySelector(`[data-tour="${target}"]`);
      if (!node) {
        setBox(null);
        return;
      }
      const rect = node.getBoundingClientRect();
      setBox({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    };

    measure();
    // The chips wrap, the panel folds and the window resizes. A hole measured
    // once is in the right place until the first of those happens.
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [target]);

  return box;
}

export interface TourProps {
  readonly onClose: () => void;
}

export function Tour({ onClose }: TourProps) {
  const [index, setIndex] = useState(0);
  const step = TOUR_STEPS[index];
  const cardRef = useRef<HTMLDivElement | null>(null);
  const okRef = useRef<HTMLButtonElement | null>(null);
  const [cardHeight, setCardHeight] = useState(180);

  const target = useTargetBox(step?.target ?? 'address');
  const last = index === TOUR_STEPS.length - 1;

  const advance = useCallback(() => {
    setIndex((current) => {
      if (current + 1 >= TOUR_STEPS.length) {
        onClose();
        return current;
      }
      return current + 1;
    });
  }, [onClose]);

  const retreat = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  // Escape leaves and the arrow keys walk the steps. Bound to the document
  // rather than to the card, so it works before focus has landed anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowRight') {
        advance();
      } else if (event.key === 'ArrowLeft') {
        retreat();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [advance, retreat, onClose]);

  // Focus moves to the card on every step, so a screen reader announces the
  // new sentence rather than leaving somebody on a button whose meaning
  // changed underneath them.
  useEffect(() => {
    okRef.current?.focus();
  }, [index]);

  useLayoutEffect(() => {
    const height = cardRef.current?.getBoundingClientRect().height;
    if (height !== undefined && height > 0) setCardHeight(height);
  }, [index, target]);

  if (!step) return null;

  const view = { width: window.innerWidth, height: window.innerHeight };
  const card: Box = { x: 0, y: 0, width: CARD_WIDTH, height: cardHeight };
  const spot = target === null ? null : spotlightFor(target);
  const placement: Placement =
    spot === null
      ? {
          left: (view.width - CARD_WIDTH) / 2,
          top: view.height / 2 - cardHeight / 2,
          caret: 'none',
        }
      : placeCard(spot, card, view);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Map tour, step ${String(index + 1)} of ${String(TOUR_STEPS.length)}`}
      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
    >
      {spot === null ? (
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: SHEET }} />
      ) : (
        <>
          {/* Above, below, left and right of the hole. */}
          <Sheet style={{ left: 0, right: 0, top: 0, height: Math.max(0, spot.y) }} />
          <Sheet style={{ left: 0, right: 0, top: spot.y + spot.height, bottom: 0 }} />
          <Sheet style={{ left: 0, width: Math.max(0, spot.x), top: spot.y, height: spot.height }} />
          <Sheet style={{ left: spot.x + spot.width, right: 0, top: spot.y, height: spot.height }} />
          {/*
            A ring around the hole, so it reads as chosen rather than as a
            patch the overlay failed to cover.
          */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: spot.x,
              top: spot.y,
              width: spot.width,
              height: spot.height,
              borderRadius: radius.base,
              boxShadow: `0 0 0 2px ${surface.raised}`,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      <div
        ref={cardRef}
        style={{
          position: 'absolute',
          left: placement.left,
          top: placement.top,
          width: CARD_WIDTH,
          maxWidth: `calc(100vw - ${String(space(8))}px)`,
          padding: space(5),
          background: surface.raised,
          border: `1px solid ${line.base}`,
          borderRadius: radius.large,
          boxShadow: shadow.lifted,
        }}
      >
        {spot !== null && placement.caret !== 'none' && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: `calc(${String(caretAt(spot, placement, card) * 100)}% - 5px)`,
              ...(placement.caret === 'top' ? { top: -6 } : { bottom: -6 }),
              width: 10,
              height: 10,
              background: surface.raised,
              borderLeft: `1px solid ${line.base}`,
              borderTop: `1px solid ${line.base}`,
              transform: placement.caret === 'top' ? 'rotate(45deg)' : 'rotate(225deg)',
            }}
          />
        )}

        <p
          style={{
            margin: `0 0 ${String(space(2))}px`,
            font: type(text.micro, { weight: weight.semibold }),
            letterSpacing: tracking.caps,
            textTransform: 'uppercase',
            color: ink.subtle,
          }}
        >
          Step {index + 1} of {TOUR_STEPS.length}
        </p>

        <p style={{ margin: 0, font: type(text.label, { leading: 1.6 }), color: ink.base }}>
          {step.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: space(3), marginTop: space(4) }}>
          <button
            ref={okRef}
            type="button"
            onClick={advance}
            style={{
              padding: `${String(space(2))}px ${String(space(5))}px`,
              border: 'none',
              borderRadius: radius.base,
              background: ink.strong,
              color: ink.inverse,
              font: type(text.label, { weight: weight.semibold }),
            }}
          >
            {last ? 'Done' : 'OK'}
          </button>

          {index > 0 && (
            <button
              type="button"
              onClick={retreat}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: type(text.label, { weight: weight.medium }),
                color: ink.muted,
              }}
            >
              Back
            </button>
          )}

          {/*
            Last in the row and last in the tab order, so leaving is always
            available and never the first thing offered.
          */}
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              padding: 0,
              font: type(text.label, { weight: weight.medium }),
              color: ink.subtle,
            }}
          >
            {last ? 'Close' : 'Skip'}
          </button>
        </div>
      </div>

      {/*
        The end of the tab order, sending focus back to the card. A sentinel
        rather than a keydown handler that inspects the focused element: the
        browser already knows what is focusable inside the card, and a
        hand-written list of selectors goes wrong the first time the card
        gains a control nobody updated it for.
      */}
      <span
        tabIndex={0}
        aria-hidden
        onFocus={() => {
          okRef.current?.focus();
        }}
      />
    </div>
  );
}

function Sheet({ style }: { readonly style: React.CSSProperties }) {
  return <div aria-hidden style={{ position: 'absolute', background: SHEET, ...style }} />;
}
