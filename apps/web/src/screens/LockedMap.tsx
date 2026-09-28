/**
 * The full map, before the guide has been finished.
 *
 * **A disclosure, not a gate.** This is the one moment in the product where
 * somebody is about to read the drainage data without having been told what
 * it is. `lockNotice` says the two things they must know before pressing:
 * the extent, and that none of it is a live flood warning. The rest (a line
 * ending may be the record ending; the calculated layers are drawn only where
 * the ground data allows) is *More about the map ›*, which opens About the
 * data (copy audit v4, #52; v2 had it behind a *More information* fold). Four
 * lines in front of a button were skipped whole. *Open the full map* works at once — the
 * five-second countdown that stood in front of it was removed in the copy
 * review of 14 September.
 *
 * **The map is drawn behind, dimmed and inert.** A notice over a blank page says
 * "there is nothing here"; a notice over the streets says "this is what is here,
 * and here is what it means first". Its pointer events are off, so the dimming
 * is not the only thing stopping a press.
 */

import type { MapArtefact } from '../map/artefact.js';
import { MapCanvas } from '../map/MapCanvas.js';
import {
  type Learned,
  SECTIONS,
  countLearned,
  lockNotice,
  nextSection,
} from '../tutorial/sections.js';
import type { SectionId } from '../tutorial/sections.js';
import { SourceLink } from '../ui/SourcesPanel.js';
import { FULL_MAP } from '../ui/terms.js';
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
  /** Which extent is on screen. The disclosure is different for each. */
  readonly extentName: string;
  /** Sections that have a guide written. The rest cannot be offered yet. */
  readonly available: readonly SectionId[];
  readonly onStartGuide: (section: SectionId) => void;
  readonly onOpenAnyway: () => void;
  readonly onBack: () => void;
}

export function LockedMap({
  map,
  learned,
  extentName,
  available,
  onStartGuide,
  onOpenAnyway,
  onBack,
}: LockedMapProps) {
  const done = countLearned(learned);
  const fullMap = FULL_MAP.toLowerCase();
  const notice = lockNotice(extentName);

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
          aria-label={`Before you open the ${fullMap}`}
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
          <h2 style={{ margin: 0, font: type(text.title), color: ink.strong }}>
            Before you open the {fullMap}
          </h2>

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
            {notice.said.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>

          <p style={{ margin: `-${String(space(2))}px 0 0` }}>
            <SourceLink id="mapNotice" />
          </p>

          <p style={{ margin: 0, font: type(text.label), color: ink.muted }}>
            {done === 0
              ? `Try a short guide, or open the ${fullMap}.`
              : `${String(done)} guide${done === 1 ? '' : 's'} completed. You can continue or open the ${fullMap}.`}
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
              style={{
                padding: `${String(space(3))}px ${String(space(5))}px`,
                border: `1px solid ${line.strong}`,
                borderRadius: radius.base,
                background: surface.raised,
                color: ink.base,
                font: type(text.label, { weight: weight.medium }),
                cursor: 'pointer',
              }}
            >
              Open the {fullMap}
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
        </section>
      </div>
    </div>
  );
}
