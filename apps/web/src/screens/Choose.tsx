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
 * **An unfinished card says *Start guide*, and pressing it does.** It had a
 * padlock and *Finish the guide to unlock this*, which read as the card being
 * locked when pressing it was exactly what the reader should do.
 *
 * *Skip to Full map* is the way past all of it, and it goes through the
 * notice rather than around it — see `LockedMap`.
 *
 * **The fifth card is the blocked-drain comparison, and it is not a guide**
 * (review 2, item 6). It sits in the same row, drawn the same way, because
 * somebody choosing what to explore first should see every way in on one
 * screen. It is not in `SECTIONS`, has no entry in `Learned` and is never
 * counted in *N guides completed*: pressing it asks for an address and opens
 * the comparison, exactly as the homepage's button does.
 */

import type { ReactNode } from 'react';

import { COMPARE_ACCENT, COMPARE_CARD, CompareThumb } from './BlockedDrain.js';
import { PATHS, PathThumb } from './Home.js';
import { SECTIONS, type Learned, type SectionId, countLearned } from '../tutorial/sections.js';
import { FULL_MAP } from '../ui/terms.js';
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
  /** The comparison: an address first, then the setup. Not a guide. */
  readonly onCompare: () => void;
  readonly onSkip: () => void;
  readonly onBack: () => void;
}

export function Choose({ learned, guided, onStart, onCompare, onSkip, onBack }: ChooseProps) {
  const done = countLearned(learned);

  return (
    // Full-bleed, so the landscape reaches the edges of the window rather than
    // the edges of the column. See `.choose__backdrop` for the wash over it.
    <div className="choose__backdrop">
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
          <button type="button" onClick={onBack} style={secondary}>
            ← Back
          </button>
          <button type="button" onClick={onSkip} style={secondary}>
            Skip to {FULL_MAP} →
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
            ? `Each guide takes about two minutes. Choose one, or open the ${FULL_MAP.toLowerCase()}.`
            : `${String(done)} guide${done === 1 ? '' : 's'} completed. You can continue or open the ${FULL_MAP.toLowerCase()}.`}
        </p>

        <div
          style={{
            display: 'grid',
            // 200 rather than 230 so the five fit one row at the column's
            // 1180 px; at 230 the fifth wrapped and sat alone under the first.
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: space(5),
          }}
        >
          {PATHS.map((path) => {
            const ready = guided.includes(path.mode);
            return (
              <Card
                key={path.mode}
                thumb={<PathThumb mode={path.mode} />}
                title={path.title}
                body={path.body}
                accent={path.accent}
                done={learned[path.mode]}
                ready={ready}
                status={ready ? SECTIONS[path.mode].locked : 'Terrain guide coming soon'}
                onStart={() => {
                  onStart(path.mode);
                }}
              />
            );
          })}
          {/*
            Never `done`: there is nothing to finish, and a tick on it would
            read as a fifth guide completed.
          */}
          <Card
            thumb={<CompareThumb />}
            title={COMPARE_CARD.title}
            body={COMPARE_CARD.body}
            accent={COMPARE_ACCENT}
            done={false}
            ready
            status="Start comparison"
            onStart={onCompare}
          />
        </div>
      </div>
    </div>
  );
}

function Card({
  thumb,
  title,
  body,
  accent,
  done,
  ready,
  status,
  onStart,
}: {
  readonly thumb: ReactNode;
  readonly title: string;
  readonly body: string;
  readonly accent: string;
  readonly done: boolean;
  readonly ready: boolean;
  /** Over the picture while the card is not done: what pressing it does. */
  readonly status: string;
  readonly onStart: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        onClick={ready ? onStart : undefined}
        disabled={!ready}
        // A title that is a question keeps its question mark rather than
        // gaining a full stop after it.
        aria-label={`${title}${/[.?!]$/.test(title) ? '' : '.'} ${done ? 'Guide completed' : status}.`}
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
          and at four cards of unequal copy it did not: the overlay landed on
          its own caption. One container, one box.
        */}
        <span style={{ position: 'relative', display: 'block' }}>
          {thumb}
          {/*
            Finished is said in the card's corner, not in a chip under it (copy
            audit v2, #13). The chip carried a second name for the same guide,
            and readers could not tell a label from a button or another feature.
            Hidden from a screen reader, which already hears *Guide completed*.
          */}
          {done && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: space(2),
                right: space(2),
                padding: `${String(space(1))}px ${String(space(2))}px`,
                borderRadius: radius.pill,
                background: 'rgba(245, 248, 247, 0.95)',
                boxShadow: shadow.resting,
                font: type(text.small, { weight: weight.semibold, leading: 1.2 }),
                color: '#1a5d4d',
              }}
            >
              Done ✓
            </span>
          )}
          {!done && (
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
              <span
                style={{
                  font: type(text.label, { weight: weight.medium, leading: 1.35 }),
                  textAlign: 'center',
                }}
              >
                {status}
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
    </div>
  );
}

/**
 * The two ways off this screen, shaped as buttons (review 2, item 9).
 *
 * They were bare text over the landscape, and a line of words at the top of a
 * painting does not read as something to press. The site's secondary button:
 * the same border, radius, fill and padding as the address screen's Back and
 * Home, so the controls that leave a screen look alike on every screen.
 */
const secondary = {
  border: `1px solid ${line.strong}`,
  borderRadius: radius.base,
  background: surface.raised,
  padding: `${String(space(2))}px ${String(space(4))}px`,
  font: type(text.label, { weight: weight.semibold }),
  color: ink.strong,
  cursor: 'pointer',
} as const;
