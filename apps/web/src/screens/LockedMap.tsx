/**
 * The whole map, before the guide has been finished.
 *
 * **The five seconds are only defensible if they buy the reader something**,
 * and what they buy is a disclosure. This is the one moment in the product
 * where somebody is about to read a square kilometre of drainage data without
 * having been told what it is, and the four lines in `LOCK_NOTICE` are the
 * four things they would otherwise have to work out: the extent, that a path
 * stopping is the record stopping, that the water layers are ours and nobody
 * else's, and that none of it is a forecast.
 *
 * A timed gate is close enough to WCAG 2.2.1 to be worth saying out loud: the
 * countdown is announced rather than only drawn, the button says why it cannot
 * be pressed yet rather than being silently inert, and nothing behind it is
 * withheld permanently — five seconds later it opens whether or not any of the
 * guide has been done.
 *
 * **The map is drawn behind, dimmed and inert.** A lock over a blank page says
 * "there is nothing here"; a lock over the streets says "this is what is here,
 * and here is what it means first". Its pointer events are off, so the dimming
 * is not the only thing stopping a press.
 */

import { useEffect, useState } from 'react';

import type { MapArtefact } from '../map/artefact.js';
import { MapCanvas } from '../map/MapCanvas.js';
import {
  LOCK_NOTICE,
  LOCK_NOTICE_SECONDS,
  type Learned,
  SECTIONS,
  countLearned,
  nextSection,
  SECTION_ORDER,
} from '../tutorial/sections.js';
import type { SectionId } from '../tutorial/sections.js';
import {
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

export interface LockedMapProps {
  readonly map: MapArtefact;
  readonly learned: Learned;
  /** Sections that have a guide written. The rest cannot be offered yet. */
  readonly available: readonly SectionId[];
  readonly onStartGuide: (section: SectionId) => void;
  readonly onOpenAnyway: () => void;
  readonly onBack: () => void;
}

export function LockedMap({
  map,
  learned,
  available,
  onStartGuide,
  onOpenAnyway,
  onBack,
}: LockedMapProps) {
  const [left, setLeft] = useState(LOCK_NOTICE_SECONDS);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => {
      setLeft((n) => n - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [left]);

  // The next section that has a guide, which is not always the next section.
  const suggested = nextSection(learned);
  const offer =
    suggested !== null && available.includes(suggested)
      ? suggested
      : (available.find((id) => !learned[id]) ?? null);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35 }}
      >
        <MapCanvas artefact={map} showPits={false} showPipes={false} />
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: space(6),
          background: 'rgba(23, 36, 46, 0.24)',
        }}
      >
        <section
          aria-label="Before you open the whole map"
          style={{
            maxWidth: 620,
            width: '100%',
            background: surface.raised,
            border: `1px solid ${line.base}`,
            borderRadius: radius.large,
            boxShadow: shadow.lifted,
            padding: space(8),
            display: 'flex',
            flexDirection: 'column',
            gap: space(5),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: space(3) }}>
            <Lock />
            <h2 style={{ margin: 0, font: type(text.title), color: ink.strong }}>
              Before you open the whole map
            </h2>
          </div>

          <ul
            style={{
              margin: 0,
              paddingLeft: space(5),
              display: 'flex',
              flexDirection: 'column',
              gap: space(3),
              font: type(text.body, { leading: 1.5 }),
              color: ink.base,
            }}
          >
            {LOCK_NOTICE.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>

          <p style={{ margin: 0, font: type(text.label), color: ink.muted }}>
            {countLearned(learned) === 0
              ? `The guide covers all four in about two minutes, one at a time.`
              : `${String(countLearned(learned))} of ${String(SECTION_ORDER.length)} parts of the guide finished.`}
          </p>

          <div style={{ display: 'flex', gap: space(3), flexWrap: 'wrap' }}>
            {offer !== null && (
              <button
                type="button"
                onClick={() => {
                  onStartGuide(offer);
                }}
                style={{
                  padding: `${String(space(3))}px ${String(space(5))}px`,
                  border: 'none',
                  borderRadius: radius.base,
                  background: '#1f6f5c',
                  color: ink.inverse,
                  font: type(text.label, { weight: weight.medium }),
                  cursor: 'pointer',
                }}
              >
                Start with {SECTIONS[offer].label} →
              </button>
            )}

            <button
              type="button"
              onClick={onOpenAnyway}
              disabled={left > 0}
              // Said rather than only shown. A control that is inert without
              // explaining itself is read as broken, and a screen reader is
              // given nothing at all by a greyed-out fill.
              aria-describedby="lock-countdown"
              style={{
                padding: `${String(space(3))}px ${String(space(5))}px`,
                border: `1px solid ${left > 0 ? line.base : line.strong}`,
                borderRadius: radius.base,
                background: surface.raised,
                color: left > 0 ? ink.subtle : ink.base,
                font: type(text.label, { weight: weight.medium }),
                cursor: left > 0 ? 'default' : 'pointer',
              }}
            >
              {left > 0 ? `Open the whole map (${String(left)})` : 'Open the whole map'}
            </button>

            <button
              type="button"
              onClick={onBack}
              style={{
                padding: `${String(space(3))}px ${String(space(4))}px`,
                border: 'none',
                background: 'none',
                color: ink.muted,
                font: type(text.label),
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          </div>

          <p
            id="lock-countdown"
            aria-live="polite"
            style={{ margin: 0, font: type(text.small), color: ink.subtle }}
          >
            {left > 0
              ? `You can open the whole map in ${String(left)} second${left === 1 ? '' : 's'}.`
              : 'You can open the whole map now.'}
          </p>
        </section>
      </div>
    </div>
  );
}

function Lock() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect
        x="4.5"
        y="10.5"
        width="15"
        height="10"
        rx="2"
        fill="none"
        stroke={ink.strong}
        strokeWidth="1.6"
      />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        fill="none"
        stroke={ink.strong}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
