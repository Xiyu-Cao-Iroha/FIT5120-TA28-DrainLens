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
import { AddressMark } from '../ui/AddressMark.js';
import { FULL_MAP } from '../ui/terms.js';
import { advisory, brand, ink, line, radius, shadow, space, surface, text, tracking, type, weight } from '../ui/theme.js';

export interface ChooseProps {
  readonly learned: Learned;
  /**
   * The address the guides will open on, or `null` before one is given.
   *
   * Shown here because it is kept from now on (4 October): a reader who is
   * about to start a third guide should be able to see which street it will
   * be about, and change it, without starting it to find out. Before there is
   * one there is nothing to say, so nothing is drawn -- an empty *Current
   * address* is a field somebody forgot to fill in.
   */
  readonly address: string | null;
  /** Ask for a different one. The guides reopen on whatever comes back. */
  readonly onChangeAddress?: (() => void) | undefined;
  /** The sections with a guide written. The rest cannot be started yet. */
  readonly guided: readonly SectionId[];
  readonly onStart: (section: SectionId) => void;
  /** The comparison: an address first, then the setup. Not a guide. */
  readonly onCompare: () => void;
  readonly onSkip: () => void;
  readonly onBack: () => void;
}

/**
 * The offer where there is no address yet.
 *
 * Shaped like `AddressMark`, which stands in the same place once there is
 * one, so that giving an address replaces the control rather than moving the
 * page about. Outlined rather than filled: the guides above it can be started
 * without an address, and this is an offer, not the next step.
 */
const setAddress = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${String(space(2))}px ${String(space(4))}px`,
  border: `1px solid ${brand.base}`,
  borderRadius: radius.pill,
  background: surface.raised,
  font: type(text.small, { weight: weight.semibold }),
  color: brand.ink,
  cursor: 'pointer',
} as const;

/** The quiet underlined control beside an address that can be changed. */
const changeLink = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: brand.ink,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
} as const;

export function Choose({
  learned,
  guided,
  address,
  onChangeAddress,
  onStart,
  onCompare,
  onSkip,
  onBack,
}: ChooseProps) {
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
            ? 'Each guide takes a few minutes. '
            : `${String(done)} of ${String(SECTION_COUNT)} guides done. `}
          {/*
            Only where there is one.

            *Every guide uses the same address* was printed whether or not
            there was an address, and arriving at the full map clears it -- so
            the sentence named a thing that was not on the screen, which the
            8 October list reported as the address bar having disappeared. The
            two guides that need one ask for it; this says so instead of
            promising something already chosen.
          */}
          {address === null
            ? 'The two guides that use an address will ask for one.'
            : 'Every guide uses the same address.'}
        </p>

        {/*
          The address, between the subtitle and the cards, because every card
          below uses it. It was above the heading, where it read as a leftover
          from the screen before.

          With no address the slot is not empty: *Change* used to live inside
          the mark, so a reader without one had no way to set an address from
          the screen that tells them two of the guides need it. They had to
          start one of those guides to be asked.
        */}
        <div style={{ margin: `-${String(space(8))}px 0 ${String(space(10))}px`, textAlign: 'center' }}>
          {address === null ? (
            onChangeAddress !== undefined && (
              <button type="button" onClick={onChangeAddress} style={setAddress}>
                Set your address
              </button>
            )
          ) : (
            <AddressMark
              address={address}
              {...(onChangeAddress === undefined ? {} : { onChange: onChangeAddress })}
            />
          )}
        </div>

        <GroupHeading>Learn the map</GroupHeading>
        <div style={{ ...grid, marginBottom: space(10) }}>
          {LEARN_THE_MAP.map((mode) => {
            const path = PATHS.find((candidate) => candidate.mode === mode);
            if (path === undefined) return null;
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
            read as another guide completed.
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

        <GroupHeading badge="New">Use your address</GroupHeading>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: space(5),
          }}
        >
          {USE_YOUR_ADDRESS.map((mode) => {
            const path = PATHS.find((candidate) => candidate.mode === mode);
            if (path === undefined) return null;
            const ready = guided.includes(path.mode);
            return (
              <WideCard
                key={path.mode}
                thumb={<PathThumb mode={path.mode} />}
                title={path.title}
                body={path.body}
                accent={path.accent}
                done={learned[path.mode]}
                ready={ready}
                onStart={() => {
                  onStart(path.mode);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The two groups, in the design's order (Figma T1).
 *
 * The division is not decoration: the first five are about the map and can be
 * read anywhere, and the two below do something with the reader's own
 * address. The comparison goes in the first group, where it already was --
 * it is not a guide, and the group is not called *guides*.
 */
const LEARN_THE_MAP = ['drainage', 'water-flow', 'terrain', 'low-areas'] as const;
const USE_YOUR_ADDRESS = ['heavy-rain', 'drainage-area'] as const;

/** How many guides there are to finish, for *n of seven*. */
const SECTION_COUNT = Object.keys(SECTIONS).length;

const grid = {
  display: 'grid',
  // 200 rather than 230 so the five fit one row at the column's 1180 px; at
  // 230 the fifth wrapped and sat alone under the first.
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: space(5),
} as const;

function GroupHeading({ children, badge }: { readonly children: ReactNode; readonly badge?: string }) {
  return (
    <p
      style={{
        display: 'flex',
        gap: space(2),
        alignItems: 'center',
        margin: `0 0 ${String(space(3))}px`,
        font: type(text.micro, { weight: weight.semibold }),
        letterSpacing: tracking.caps,
        textTransform: 'uppercase',
        color: brand.ink,
      }}
    >
      {children}
      {badge !== undefined && (
        <span
          style={{
            padding: `1px ${String(space(2))}px`,
            borderRadius: radius.pill,
            background: advisory.fill,
            border: `1px solid ${advisory.line}`,
            color: advisory.ink,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          {badge}
        </span>
      )}
    </p>
  );
}

/**
 * The wider card the address group uses (Figma T1): picture beside the words.
 *
 * It carries a real *Start guide* button rather than a label over the
 * picture, because these two are the ones the design is pointing at and a
 * button is what a reader presses when they have decided.
 */
function WideCard({
  thumb,
  title,
  body,
  accent,
  done,
  ready,
  onStart,
}: {
  readonly thumb: ReactNode;
  readonly title: string;
  readonly body: string;
  readonly accent: string;
  readonly done: boolean;
  readonly ready: boolean;
  readonly onStart: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        overflow: 'hidden',
        border: `1px solid ${done ? accent : line.base}`,
        borderRadius: radius.large,
        background: surface.raised,
        boxShadow: shadow.lifted,
      }}
    >
      <div style={{ flex: '0 0 40%', minWidth: 0, position: 'relative' }} aria-hidden>
        {thumb}
      </div>
      <div style={{ flex: '1 0 0', minWidth: 0, padding: space(5) }}>
        <p style={{ margin: 0, font: type(text.lead, { weight: weight.semibold }), color: ink.strong }}>
          {title}
        </p>
        <p style={{ margin: `${String(space(2))}px 0 ${String(space(4))}px`, color: ink.muted }}>{body}</p>
        <button
          type="button"
          onClick={ready ? onStart : undefined}
          disabled={!ready}
          style={{
            padding: `${String(space(2))}px ${String(space(4))}px`,
            borderRadius: radius.base,
            border: 'none',
            background: ready ? brand.base : line.base,
            color: ink.inverse,
            font: type(text.label, { weight: weight.semibold }),
            cursor: ready ? 'pointer' : 'default',
          }}
        >
          {done ? 'Done ✓  Start again →' : 'Start guide →'}
        </button>
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
