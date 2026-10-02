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
import { SourceLink } from '../ui/SourcesPanel.js';
import { ink, line, radius, space, text, type, weight } from '../ui/theme.js';

/**
 * The area for this address, or the honest absence of one.
 *
 * `null` is 5 Webb Dock, Port Melbourne — the council's one address inside no
 * recorded area — and anything the assignment does not cover. AC 6.1.5 says
 * what to do with it: say so, substitute nothing, and leave the rest of the
 * map alone.
 */
export function DrainageArea({ area }: { readonly area: Subcatchment | null }) {
  const moreId = useId();
  const [moreOpen, setMoreOpen] = useState(false);

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
      <p style={{ margin: 0, font: type(text.label, { weight: weight.semibold }), color: ink.strong }}>
        {area.displayName}
      </p>
      <p style={{ margin: `2px 0 ${String(space(2))}px`, font: type(text.micro), color: ink.subtle }}>
        {AREA_SOURCE}
      </p>

      {/* AC 6.1.2: one sentence, chosen by the approved class and no other. */}
      <p style={{ margin: `0 0 ${String(space(2))}px` }}>{receivingLine(area)}</p>
      <p style={{ margin: `0 0 ${String(space(3))}px`, color: ink.muted }}>{NOT_EVERY_PIPE}</p>

      {summary !== undefined && (
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: `${String(space(1))}px ${String(space(3))}px`,
            margin: `0 0 ${String(space(2))}px`,
          }}
        >
          <Figure label="Recorded area" value={areaLine(area) ?? 'Not recorded'} />
          <Figure label="Stormwater pits" value={summary.pits.toLocaleString('en-AU')} />
          <Figure label="Mapped drainpipe" value={pipeLengthLine(summary.pipeLengthM)} />
          <Figure label="Low areas" value={lowAreasLine(area)} />
        </dl>
      )}

      {/*
        The two sentences that keep the figures from being read as more than
        they are: what they cover, and what sharing an area does not mean.
      */}
      <p style={{ margin: `0 0 ${String(space(1))}px`, color: ink.muted }}>{COUNTS_COVER}</p>
      {coverage !== null && (
        <p style={{ margin: `0 0 ${String(space(1))}px`, color: ink.muted }}>{coverage}</p>
      )}
      <p style={{ margin: `0 0 ${String(space(2))}px`, color: ink.muted }}>{NOT_THE_SAME_RISK}</p>

      {/* AC 6.1.4: the year on the card, from this record's own date. */}
      {updated !== null && <p style={{ margin: `0 0 ${String(space(2))}px` }}>{updated}</p>}

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
          {wider.length > 0 && (
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: `${String(space(1))}px ${String(space(3))}px`,
                margin: `0 0 ${String(space(2))}px`,
              }}
            >
              {wider.map((pair) => (
                <Figure key={pair.label} label={pair.label} value={pair.value} />
              ))}
            </dl>
          )}

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
            <Figure label={RECORD_UPDATED} value={dateLine(area.lastUpdated) ?? 'Not recorded'} />
            <Figure label={LAYER_EDITED} value={dateLine(LAYER_EDITED_ON) ?? LAYER_EDITED_ON} />
            <Figure label="Receiving drain type" value={CLASS_NAME[area.class]} />
          </dl>

          <p style={{ margin: `0 0 ${String(space(1))}px`, color: ink.muted }}>
            {MAY_NOT_REFLECT_DEVELOPMENT}
          </p>
          <p style={{ margin: 0, color: ink.muted }}>{BOUNDARY_LIMITS}</p>
          <span style={{ display: 'block', marginTop: space(2) }}>
            <SourceLink id="drainageArea" />
          </span>
        </div>
      </details>
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
export const OPEN_DRAINAGE_AREA = 'My drainage area ›';

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
