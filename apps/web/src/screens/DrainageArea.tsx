/**
 * *My drainage area*: which area an address is in, and what receives its water.
 *
 * Epic 6's first screen, and the shape of it comes from what the criteria
 * refuse rather than from what they ask for. AC 6.1.2 forbids naming a
 * receiving drain the classification does not support, AC 6.1.3 forbids
 * presenting a count of the part we hold as a count of the area, and AC 6.1.4
 * forbids presenting either recorded date as a survey date or the portal's
 * metadata date as the record's own. So the card is: one sentence about where
 * the water goes, the figures with their coverage beside them, the record's
 * year, and everything that could be mistaken for something else folded under
 * *More information* where it is labelled.
 *
 * **The card does not compute.** Every number is read from the artefact, which
 * is the one the pipeline built and the data checks hold; the only arithmetic
 * is choosing a unit (`wording.ts`).
 */

import { type ReactNode, useId, useState } from 'react';

import type { Subcatchment } from '../catchment/artefact.js';
import {
  AREA_SOURCE,
  BOUNDARY_LIMITS,
  COUNTS_COVER,
  CLASS_NAME,
  LAYER_EDITED,
  LAYER_EDITED_ON,
  MAY_NOT_REFLECT_DEVELOPMENT,
  NOT_EVERY_PIPE,
  NOT_THE_SAME_RISK,
  NO_ADDRESS_YET,
  NO_AREA_FOUND,
  NO_AREA_MEANS,
  RECORD_UPDATED,
  areaLine,
  coverageLine,
  dateLine,
  lowAreasLine,
  pipeLengthLine,
  receivingLine,
  updatedLine,
  widerNames,
} from '../catchment/wording.js';
import { AREA_ROW_LABEL, DRAINAGE_LEVELS, GENERAL_ROLES_ONLY } from '../catchment/help.js';
import { SourceLink } from '../ui/SourcesPanel.js';
import { brand, ink, line, radius, space, surface, text, type, weight } from '../ui/theme.js';

/**
 * The area for this address, or the honest absence of one.
 *
 * `null` is 5 Webb Dock, Port Melbourne — the council's one address inside no
 * recorded area — and anything the assignment does not cover. AC 6.1.5 says
 * what to do with it: say so, substitute nothing, and leave the rest of the
 * map alone.
 */
export function DrainageArea({
  area,
  hasAddress = true,
  onReport,
  onBack,
}: {
  readonly area: Subcatchment | null;
  /**
   * Whether an address has been chosen at all.
   *
   * `false` is a different sentence from `area === null`: one is a question
   * nobody has asked yet, the other is a question this could not answer.
   */
  readonly hasAddress?: boolean;
  /**
   * The reporting pathway, from the card about who looks after what.
   *
   * Epic 6's two halves meet here (AC 6.2.3): the card says which
   * organisation holds which part, and the button is how a reader acts on
   * that. It used to be on a second card behind a second chip -- the card
   * that was removed on 8 October, because turning it on made this one
   * disappear.
   */
  readonly onReport?: (() => void) | undefined;
  /**
   * Close the card, as the design's *Back to address* does (Figma D4).
   *
   * It takes the layer off, which is what put the card there: a close that
   * left the boundary drawn would be a card you cannot get back without
   * finding the chip, and a boundary with nothing explaining it.
   */
  readonly onBack?: (() => void) | undefined;
}) {
  const moreId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const rolesId = useId();
  const [rolesOpen, setRolesOpen] = useState(false);

  const back =
    onBack === undefined ? null : (
      <p style={{ margin: `0 0 ${String(space(2))}px` }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: type(text.small, { weight: weight.semibold }),
            color: brand.ink,
            cursor: 'pointer',
          }}
        >
          ‹ Back to the map
        </button>
      </p>
    );

  if (!hasAddress) {
    return (
      <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
        {back}
        <p style={{ margin: 0 }}>{NO_ADDRESS_YET}</p>
        <span style={{ display: 'block', marginTop: space(2) }}>
          <SourceLink id="drainageArea" />
        </span>
      </div>
    );
  }

  if (area === null) {
    return (
      <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
        <p style={{ margin: 0 }}>{NO_AREA_FOUND}</p>
        <p style={{ margin: `${String(space(2))}px 0 0`, color: ink.muted }}>{NO_AREA_MEANS}</p>
        <span style={{ display: 'block', marginTop: space(2) }}>
          <SourceLink id="drainageArea" />
        </span>
      </div>
    );
  }

  const updated = updatedLine(area);
  const coverage = coverageLine(area);
  const summary = area.summary;
  const wider = widerNames(area);

  return (
    <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
      {back}
      <p style={{ margin: 0, font: type(text.label, { weight: weight.semibold }), color: ink.strong }}>
        {area.displayName}
      </p>
      <p style={{ margin: `2px 0 ${String(space(2))}px`, font: type(text.micro), color: ink.subtle }}>
        {AREA_SOURCE}
      </p>

      {/* AC 6.1.2: one sentence, chosen by the approved class and no other. */}
      <p style={{ margin: `0 0 ${String(space(3))}px` }}>{receivingLine(area)}</p>

      {/*
        Three tiles, as the design draws them (Figma D4).

        Low areas was a fourth and is not here any more. It was a sentence
        where the others are a number, it is the one figure that reads as a
        statement about risk, and the change list of 8 October asks for it
        out. The count is still in More information, labelled, where somebody
        looking for it will find it.
      */}
      {summary !== undefined && (
        <div style={{ display: 'flex', gap: space(2), marginBottom: space(3) }}>
          <Tile label="Area" value={areaLine(area) ?? 'Not recorded'} />
          <Tile label="Drain pits" value={summary.pits.toLocaleString('en-AU')} />
          <Tile label="Drain pipes" value={pipeLengthLine(summary.pipeLengthM)} />
        </div>
      )}

      {/*
        Who looks after what (AC 6.2.1), on the card about the area rather
        than on a card of its own.

        Two rows, because two of the three levels are about this area: the
        streets inside it and the drain it flows into. The third is private
        property, which is in the fold below with the sentence that keeps all
        three from being read as ownership.
      */}
      <p
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: brand.ink,
        }}
      >
        Who looks after it
      </p>
      <dl style={{ margin: `0 0 ${String(space(2))}px` }}>
        {DRAINAGE_LEVELS.filter((level) => level.id !== 'private').map((level) => (
          <div
            key={level.id}
            style={{
              display: 'flex',
              gap: space(3),
              alignItems: 'baseline',
              justifyContent: 'space-between',
              padding: `${String(space(1))}px 0`,
              borderBottom: `1px solid ${line.hair}`,
            }}
          >
            <dt style={{ margin: 0, color: ink.muted }}>{AREA_ROW_LABEL[level.id] ?? level.title}</dt>
            <dd
              style={{
                margin: 0,
                font: type(text.small, { weight: weight.semibold }),
                color: ink.strong,
                textAlign: 'right',
              }}
            >
              {level.who}
            </dd>
          </div>
        ))}
      </dl>

      <details
        open={rolesOpen}
        onToggle={(event) => {
          setRolesOpen((event.currentTarget as HTMLDetailsElement).open);
        }}
        style={{ marginBottom: space(3) }}
      >
        <summary aria-controls={rolesId} style={{ cursor: 'pointer', color: brand.ink }}>
          Why are there different organisations?
        </summary>
        <div id={rolesId} style={{ marginTop: space(2) }}>
          <WhoCanHelpLevels />
        </div>
      </details>

      {onReport !== undefined && (
        <button
          type="button"
          onClick={onReport}
          style={{
            display: 'block',
            width: '100%',
            marginBottom: space(3),
            padding: space(3),
            borderRadius: radius.base,
            border: `1px solid ${line.strong}`,
            background: surface.raised,
            color: ink.strong,
            font: type(text.label, { weight: weight.semibold }),
            cursor: 'pointer',
          }}
        >
          Report a problem ›
        </button>
      )}

      <details
        open={moreOpen}
        onToggle={(event) => {
          setMoreOpen((event.currentTarget as HTMLDetailsElement).open);
        }}
        style={{ borderTop: `1px solid ${line.hair}`, paddingTop: space(2) }}
      >
        <summary
          aria-controls={moreId}
          style={{ cursor: 'pointer', font: type(text.small, { weight: weight.semibold }), color: ink.base }}
        >
          More information
        </summary>
        <div id={moreId} style={{ marginTop: space(2) }}>
          {/*
            The sentences that keep the card from being read as more than it
            is. They were above the fold until 8 October, and the change list
            is right that there were too many of them up there: what matters
            at a glance is the area, the figures and who to tell. None of them
            is dropped, because each is a criterion -- AC 6.1.2's last line,
            AC 6.1.3, and what the counts cover.
          */}
          <p style={{ margin: `0 0 ${String(space(1))}px`, color: ink.muted }}>{NOT_EVERY_PIPE}</p>
          <p style={{ margin: `0 0 ${String(space(1))}px`, color: ink.muted }}>{NOT_THE_SAME_RISK}</p>
          <p style={{ margin: `0 0 ${String(space(1))}px`, color: ink.muted }}>{COUNTS_COVER}</p>
          {coverage !== null && (
            <p style={{ margin: `0 0 ${String(space(2))}px`, color: ink.muted }}>{coverage}</p>
          )}

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: `${String(space(1))}px ${String(space(3))}px`,
              margin: `0 0 ${String(space(2))}px`,
            }}
          >
            <Figure label="Low areas" value={lowAreasLine(area)} />
            {wider.map((pair) => (
              <Figure key={pair.label} label={pair.label} value={pair.value} />
            ))}
          </dl>

          {/*
            Two dates, two labels, never merged: AC 6.1.4 says neither is the
            date the boundary was surveyed, and the portal's own metadata date
            is not this record's.
          */}
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: `${String(space(1))}px ${String(space(3))}px`,
              margin: `0 0 ${String(space(2))}px`,
            }}
          >
            {updated !== null && <Figure label="Record year" value={updated} />}
            <Figure label={RECORD_UPDATED} value={dateLine(area.lastUpdated) ?? 'Not recorded'} />
            <Figure label={LAYER_EDITED} value={dateLine(LAYER_EDITED_ON) ?? LAYER_EDITED_ON} />
            <Figure label="Receiving drain type" value={CLASS_NAME[area.class]} />
          </dl>

          <p style={{ margin: `0 0 ${String(space(1))}px`, color: ink.muted }}>
            {MAY_NOT_REFLECT_DEVELOPMENT}
          </p>
          <p style={{ margin: `0 0 ${String(space(1))}px`, color: ink.muted }}>{BOUNDARY_LIMITS}</p>
          <span style={{ display: 'block', marginTop: space(2) }}>
            <SourceLink id="drainageArea" />
          </span>
        </div>
      </details>
    </div>
  );
}

/** One of the three figures the design shows as a tile (Figma D4). */
function Tile({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div
      style={{
        flex: '1 0 0',
        minWidth: 0,
        padding: space(2),
        background: surface.sunken,
        borderRadius: radius.small,
      }}
    >
      <span style={{ display: 'block', font: type(text.label, { weight: weight.semibold }), color: ink.strong }}>
        {value}
      </span>
      <span style={{ display: 'block', font: type(text.micro), color: ink.subtle }}>{label}</span>
    </div>
  );
}

function Figure({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <>
      <dt style={{ margin: 0, font: type(text.micro), color: ink.subtle, whiteSpace: 'nowrap' }}>{label}</dt>
      <dd style={{ margin: 0, font: type(text.small), color: ink.strong }}>{value}</dd>
    </>
  );
}

/** The link that opens the card, in the address callout. */
export const OPEN_DRAINAGE_AREA = 'Recorded subcatchment area ›';

/** The style the opening link shares with the callout's other links. */
export const openLinkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: type(text.small, { weight: weight.semibold }),
  color: ink.base,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
  borderRadius: radius.small,
} as const;

/**
 * A card in a corner of the map, for a layer that is about no single point.
 *
 * The map's other cards are callouts: they point at a pit, a pipe, a sign, an
 * address. These two do not — one is about the area the boundary encloses and
 * the other about the drainage system as a whole — so they sit in a corner
 * rather than claiming a spot on the ground, which is how the design draws
 * them (Figma D2 and D4).
 */
/** How wide a corner card is. The map reads it to know what they cover. */
export const CARD_WIDTH = 300;

export function MapNote({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section
      aria-label={title}
      style={{
        pointerEvents: 'auto',
        width: CARD_WIDTH,
        maxWidth: '100%',
        padding: space(3),
        background: surface.raised,
        border: `1px solid ${line.base}`,
        borderRadius: radius.base,
        boxShadow: '0 6px 20px rgba(16, 32, 40, 0.10)',
      }}
    >
      <h2
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.label, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Where the corner cards go, and the reason they are a column.
 *
 * Each card used to pin itself to the same corner at the same offset -- `top:
 * 64`, a guess at how tall the map's chrome is. Two of them were therefore
 * exactly on top of each other whenever two could be open, and all of them
 * were underneath the chip row as soon as the row wrapped onto a second line,
 * which it does on any window narrow enough to make the chips wrap. Reported
 * on 8 October with a screenshot of both happening at once.
 *
 * So the offset is measured rather than guessed -- `top` is the bottom edge
 * of the chrome, handed down by whoever drew it -- and the cards are laid out
 * in a column, so a second card goes *under* the first instead of over it.
 * The column scrolls rather than running off the bottom of the map.
 */
export function MapNoteStack({
  at = 'top',
  top = 64,
  children,
}: {
  readonly at?: 'top' | 'bottom';
  /** The bottom edge of the map's own chrome, in pixels. Ignored at the bottom. */
  readonly top?: number;
  readonly children: ReactNode;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: space(3),
        ...(at === 'top'
          ? { top, maxHeight: `calc(100% - ${String(top + 32)}px)` }
          : { bottom: space(3), maxHeight: 'calc(100% - 96px)' }),
        display: 'flex',
        flexDirection: 'column',
        gap: space(2),
        overflowY: 'auto',
        // The column is only as wide as its cards, so the map beside it still
        // takes a drag. Each card turns pointer events back on for itself.
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The three levels, numbered, as the design's card draws them (Figma D4).
 *
 * Each is a level of the system, an example a reader would recognise, and who
 * to tell. The hedged role sentences and the "these are general roles" line
 * are under *More information* on the drainage-area card: this card is the one
 * somebody reads while deciding who to call, and AC 6.2.1's caution belongs
 * where it can be read without hunting, which is why it is repeated here in
 * one line rather than left to the other card.
 */
export function WhoCanHelpLevels() {
  return (
    <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {DRAINAGE_LEVELS.map((level, index) => (
          <li key={level.id} style={{ display: 'flex', gap: space(2), marginBottom: space(2) }}>
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 20,
                height: 20,
                borderRadius: radius.pill,
                background: brand.base,
                color: ink.inverse,
                font: type(text.micro, { weight: weight.semibold }),
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {index + 1}
            </span>
            <span>
              <span style={{ display: 'block', font: type(text.small, { weight: weight.semibold }), color: ink.strong }}>
                {level.title}
              </span>
              <span style={{ display: 'block', font: type(text.micro), color: ink.subtle }}>{level.example}</span>
              <span style={{ display: 'block', color: brand.ink }}>{level.who}</span>
            </span>
          </li>
        ))}
      </ol>
      <p style={{ margin: 0, font: type(text.micro, { leading: 1.5 }), color: ink.muted }}>{GENERAL_ROLES_ONLY}</p>
    </div>
  );
}
