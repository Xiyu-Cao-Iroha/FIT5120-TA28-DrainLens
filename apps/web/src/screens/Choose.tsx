/**
 * What do you want to explore first?
 *
 * The front door, from 11 September. *Get started* on the homepage lands here
 * rather than on the map, which is the mentor's point made structural: the
 * journey used to be somebody arriving at a square kilometre with four layers
 * and no basemap and being left to it.
 *
 * **The four cards are the homepage's four cards**, drawn from the same
 * `PATHS` and the same `PathThumb`. Two definitions would drift, and the drift
 * would be a card whose picture here is not the layer it opens there.
 *
 * **A locked card is still pressable, and that is the point of it.** The
 * padlock says the *layer on the whole map* is locked, not that the card is:
 * pressing it is exactly what somebody who has not done that part should do.
 * A card that refused the press would leave nothing on the screen that starts
 * anything.
 *
 * *Skip to Whole Map* is the way past all of it, and it goes through the
 * notice rather than around it — see `LockedMap`.
 */

import type { MapMode } from '../map/modes.js';
import { PATHS, PathThumb } from './Home.js';
import { SECTIONS, type Learned, type SectionId, countLearned } from '../tutorial/sections.js';
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
} from '../ui/theme.js';

export interface ChooseProps {
  readonly learned: Learned;
  /** The sections with a guide written. The rest cannot be started yet. */
  readonly guided: readonly SectionId[];
  readonly onStart: (section: SectionId) => void;
  readonly onSkip: () => void;
  readonly onBack: () => void;
}

export function Choose({ learned, guided, onStart, onSkip, onBack }: ChooseProps) {
  const done = countLearned(learned);

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: `${String(space(8))}px ${String(space(6))}px ${String(space(14))}px`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space(4),
          marginBottom: space(10),
        }}
      >
        <button type="button" onClick={onBack} style={quiet}>
          ← Back
        </button>
        <button type="button" onClick={onSkip} style={quiet}>
          Skip to Whole Map →
        </button>
      </div>

      <h1
        style={{
          margin: `0 0 ${String(space(3))}px`,
          textAlign: 'center',
          font: type(text.display, { weight: weight.semibold, leading: 1.2 }),
          letterSpacing: tracking.display,
          color: ink.strong,
        }}
      >
        What do you want to explore first?
      </h1>

      <p
        style={{
          margin: `0 auto ${String(space(12))}px`,
          maxWidth: 640,
          textAlign: 'center',
          font: type(text.body, { leading: 1.6 }),
          color: ink.muted,
        }}
      >
        {done === 0
          ? 'Each part takes about two minutes on your own street. Finish all four and the whole map opens.'
          : `${String(done)} of 4 finished. Finish all four and the whole map opens.`}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: space(6),
        }}
      >
        {PATHS.map((path) => (
          <Card
            key={path.mode}
            mode={path.mode}
            title={path.title}
            body={path.body}
            accent={path.accent}
            done={learned[path.mode]}
            ready={guided.includes(path.mode)}
            onStart={() => {
              onStart(path.mode);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Card({
  mode,
  title,
  body,
  accent,
  done,
  ready,
  onStart,
}: {
  readonly mode: MapMode;
  readonly title: string;
  readonly body: string;
  readonly accent: string;
  readonly done: boolean;
  readonly ready: boolean;
  readonly onStart: () => void;
}) {
  const locked = !done;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space(3) }}>
      <button
        type="button"
        onClick={ready ? onStart : undefined}
        disabled={!ready}
        aria-label={
          done
            ? `${title}. This part of the guide is finished.`
            : ready
              ? `${title}. Start this part of the guide.`
              : `${title}. This part of the guide is not written yet.`
        }
        style={{
          position: 'relative',
          display: 'block',
          padding: 0,
          textAlign: 'left',
          overflow: 'hidden',
          border: `1px solid ${done ? accent : line.base}`,
          borderRadius: radius.large,
          background: surface.raised,
          boxShadow: done ? shadow.lifted : shadow.resting,
          cursor: ready ? 'pointer' : 'default',
          font: 'inherit',
          color: 'inherit',
        }}
      >
        {/*
          The overlay wraps the picture rather than being positioned against
          the whole card. Measured against the card it was a percentage that
          had to agree with however tall the words underneath happened to be,
          and at four cards of unequal copy it did not: the lock landed on its
          own caption. One container, one box.
        */}
        <span style={{ position: 'relative', display: 'block' }}>
          <PathThumb mode={mode} />
          {locked && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space(2),
                background: 'rgba(23, 36, 46, 0.62)',
                color: '#ffffff',
                padding: space(3),
              }}
            >
              <Padlock />
              <span
                style={{
                  font: type(text.label, { weight: weight.medium, leading: 1.35 }),
                  textAlign: 'center',
                }}
              >
                {ready ? 'Finish the guide to unlock this' : 'Guide coming soon'}
              </span>
            </span>
          )}
        </span>
        <span style={{ display: 'block', height: 3, background: accent }} />
        <span style={{ display: 'block', padding: space(4) }}>
          <span
            style={{
              display: 'block',
              marginBottom: space(2),
              font: type(text.body, { weight: weight.semibold, leading: 1.3 }),
              color: ink.strong,
            }}
          >
            {title}
          </span>
          <span style={{ display: 'block', font: type(text.label, { leading: 1.5 }), color: ink.muted }}>
            {body}
          </span>
        </span>

      </button>

      <span
        style={{
          font: type(text.label, { weight: weight.medium }),
          color: done ? '#1a5d4d' : ink.base,
          textAlign: 'center',
        }}
      >
        {done ? '✓ ' : ''}
        {SECTIONS[mode].label}
      </span>
    </div>
  );
}

function Padlock() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect
        x="4.5"
        y="10.5"
        width="15"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

const quiet = {
  border: 'none',
  background: 'none',
  padding: space(2),
  font: type(text.lead, { weight: weight.semibold }),
  color: ink.strong,
  cursor: 'pointer',
} as const;
