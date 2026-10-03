/**
 * What a finished guide offers next.
 *
 * Figma G5, and the team's request of 4 October: the end of a guide should
 * carry the next one rather than only a way back to the list, and the way to
 * the full map should be there too — with a word first where guides are still
 * unread.
 *
 * **The warning is a recommendation, not a gate.** Everything on the full map
 * is reachable without any guide at all, and a product that locked it would be
 * making a claim about the reader rather than about the map. What it does is
 * name the guides that are still unread, and hold the button for a moment so
 * the sentence is read rather than clicked past.
 *
 * **That pause is a reversal, and it is deliberately smaller than the one it
 * reverses.** A five-second countdown in front of the Full map was removed on
 * 14 September because it stood between a reader and the map on every visit.
 * This one appears only at the end of a guide, only while something is unread,
 * and runs for three seconds.
 */

import { useEffect, useState } from 'react';

import { type Learned, type SectionId, SECTION_ORDER, SECTIONS } from '../tutorial/sections.js';
import { PATHS } from './Home.js';
import { FULL_MAP } from '../ui/terms.js';
import { brand, ink, line, radius, space, surface, text, type, weight } from '../ui/theme.js';

/** How long the full map's button is held while a guide is unread. */
export const HOLD_SECONDS = 3;

/** The guide after this one that has not been done, if there is one. */
export function nextGuide(
  after: SectionId,
  learned: Learned,
  guided: readonly SectionId[],
): SectionId | null {
  const order = SECTION_ORDER.filter((id) => guided.includes(id));
  const from = order.indexOf(after);
  // Round the list once from where they are, so finishing the last guide
  // offers the first one they skipped rather than nothing.
  for (let step = 1; step <= order.length; step += 1) {
    const id = order[(from + step) % order.length];
    if (id !== undefined && id !== after && !learned[id]) return id;
  }
  return null;
}

/** The guides still unread, in the order the chooser lists them. */
export const unread = (learned: Learned, guided: readonly SectionId[]): readonly SectionId[] =>
  SECTION_ORDER.filter((id) => guided.includes(id) && !learned[id]);

/** *Recorded drainage, Low areas and Your drainage area* — as a sentence. */
export function listed(ids: readonly SectionId[]): string {
  const names = ids.map((id) => SECTIONS[id].label);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${String(names.at(-1))}`;
}

/** The sentence over the hold, which says what it is advising and why. */
export const beforeTheMap = (ids: readonly SectionId[]): string =>
  `We suggest finishing ${listed(ids)} before exploring the ${FULL_MAP.toLowerCase()}.`;

/** The card that offers the next guide (Figma G5). */
export function NextGuide({
  id,
  onStart,
}: {
  readonly id: SectionId;
  readonly onStart: (section: SectionId) => void;
}) {
  return (
    <div
      style={{
        padding: space(4),
        borderRadius: radius.base,
        background: surface.raised,
        border: `1px solid ${line.base}`,
        display: 'flex',
        flexDirection: 'column',
        gap: space(2),
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: ink.subtle,
        }}
      >
        Next guide
      </span>
      <span style={{ font: type(text.label, { weight: weight.semibold }), color: ink.strong }}>
        {SECTIONS[id].label}
      </span>
      {/* The card's own sentence, so the next guide is described here the way
          it is described on the chooser rather than in new words. */}
      <span style={{ font: type(text.small, { leading: 1.5 }), color: ink.muted }}>
        {PATHS.find((path) => path.mode === id)?.body ?? ''}
      </span>
      <button
        type="button"
        onClick={() => {
          onStart(id);
        }}
        style={{
          marginTop: space(1),
          padding: `${String(space(2))}px ${String(space(4))}px`,
          borderRadius: radius.pill,
          border: `1px solid ${brand.base}`,
          background: brand.base,
          color: ink.inverse,
          font: type(text.small, { weight: weight.semibold }),
          cursor: 'pointer',
        }}
      >
        Start next guide →
      </button>
    </div>
  );
}

/**
 * The way to the full map, with the word first where guides are unread.
 *
 * Shown at the foot of a finished guide, centred, as the team asked.
 */
export function ExploreFullMap({
  learned,
  guided,
  onOpen,
}: {
  readonly learned: Learned;
  readonly guided: readonly SectionId[];
  readonly onOpen: () => void;
}) {
  const [asked, setAsked] = useState(false);
  const left = unread(learned, guided);

  return (
    <div style={{ textAlign: 'center' }}>
      <button
        type="button"
        onClick={() => {
          if (left.length === 0) onOpen();
          else setAsked(true);
        }}
        style={{
          padding: `${String(space(2))}px ${String(space(4))}px`,
          borderRadius: radius.pill,
          border: `1px solid ${line.base}`,
          background: surface.raised,
          color: ink.base,
          font: type(text.small, { weight: weight.semibold }),
          cursor: 'pointer',
        }}
      >
        Explore {FULL_MAP.toLowerCase()}
      </button>

      {asked && left.length > 0 && (
        <BeforeTheMap
          left={left}
          onCancel={() => {
            setAsked(false);
          }}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

function BeforeTheMap({
  left,
  onCancel,
  onOpen,
}: {
  readonly left: readonly SectionId[];
  readonly onCancel: () => void;
  readonly onOpen: () => void;
}) {
  const [heldFor, setHeldFor] = useState(0);
  const waiting = HOLD_SECONDS - heldFor;

  useEffect(() => {
    if (heldFor >= HOLD_SECONDS) return undefined;
    const timer = window.setTimeout(() => {
      setHeldFor((seconds) => seconds + 1);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [heldFor]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={beforeTheMap(left)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: space(4),
        background: 'rgba(16, 32, 40, 0.45)',
      }}
    >
      <div
        style={{
          maxWidth: 440,
          padding: space(5),
          borderRadius: radius.base,
          background: surface.raised,
          border: `1px solid ${line.base}`,
          textAlign: 'left',
        }}
      >
        <p
          style={{
            margin: `0 0 ${String(space(3))}px`,
            font: type(text.label, { weight: weight.semibold, leading: 1.4 }),
            color: ink.strong,
          }}
        >
          {beforeTheMap(left)}
        </p>
        <p style={{ margin: `0 0 ${String(space(4))}px`, font: type(text.small, { leading: 1.5 }), color: ink.muted }}>
          The {FULL_MAP.toLowerCase()} shows everything at once. The guides are what explain each
          layer, and nothing on the map is hidden until you have read them.
        </p>
        <div style={{ display: 'flex', gap: space(2), flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onOpen}
            disabled={waiting > 0}
            style={{
              padding: `${String(space(2))}px ${String(space(4))}px`,
              borderRadius: radius.pill,
              border: `1px solid ${waiting > 0 ? line.base : brand.base}`,
              background: waiting > 0 ? surface.sunken : brand.base,
              color: waiting > 0 ? ink.subtle : ink.inverse,
              font: type(text.small, { weight: weight.semibold }),
              cursor: waiting > 0 ? 'default' : 'pointer',
            }}
          >
            {waiting > 0
              ? `Continue to ${FULL_MAP.toLowerCase()} (${String(waiting)})`
              : `Continue to ${FULL_MAP.toLowerCase()}`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: `${String(space(2))}px ${String(space(4))}px`,
              borderRadius: radius.pill,
              border: `1px solid ${line.base}`,
              background: surface.raised,
              color: ink.base,
              font: type(text.small, { weight: weight.semibold }),
              cursor: 'pointer',
            }}
          >
            Keep going with the guides
          </button>
        </div>
      </div>
    </div>
  );
}
