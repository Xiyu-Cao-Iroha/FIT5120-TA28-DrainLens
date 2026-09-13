/**
 * What the council recorded about one pit, and where its water goes next.
 *
 * AC 1.2.1.c pushes provenance down to the individual value, so every field
 * here is either shown with its recorded label or listed as not recorded.
 * There is no third option: an empty row and an absent row say different
 * things, and the person reading this has no way to tell a field we chose not
 * to display from one the council never filled in.
 *
 * The wording lives in this file as data rather than inline in the markup,
 * for the same reason as `scenario/outcome.ts` — sentences that carry a claim
 * about certainty are reviewable in one place and are not reviewable scattered
 * through JSX.
 */

import { useState } from 'react';

import type { MapArtefact, Pit } from '../map/artefact.js';
import { sectionFor } from '../crosssection/section.js';
import { CrossSection, SectionNotes } from './CrossSection.js';
import { type Trace, type TraceArtefact, endingsByReason } from '../trace/graph.js';
import { stoppedBecauseOfTheRecord } from '../trace/draw.js';

const RECORDED_BADGE = 'Official recorded data';

/**
 * The fields the pit layer carries, in the order a person reads them.
 *
 * Depth is deliberately absent. Invert values are missing for 95.4% of the
 * council's pits and the surviving fraction is internally inconsistent, so a
 * depth row would be empty almost always and untrustworthy the rest of the
 * time. AC 1.1.7.f is served by saying so, not by showing a blank.
 */
const FIELDS: readonly { readonly key: keyof Pit; readonly label: string }[] = [
  { key: 'asset_number', label: 'Asset number' },
  { key: 'asset_description', label: 'Description' },
  { key: 'object_type_lupvalue', label: 'Type' },
];

export const NOT_RECORDED = 'Not recorded';

export const DEPTH_NOTE =
  'Pit depth is not shown. The council record leaves it out for almost every ' +
  'pit in this area, and filling the gap with an estimate would present a ' +
  'guess as a measurement.';

/** One line per way a path can stop, in the person's words rather than ours. */
export const ENDING_LABELS: Readonly<Record<string, string>> = {
  'no-recorded-connection': 'the record has no pipe leaving that pit',
  'unrecorded-destination': 'a pipe leaves, but the record does not say where it goes',
  'leaves-mapped-area': 'the pipe continues outside the mapped area',
  'cycle-guard': 'the recorded connections loop back on themselves',
};

export const NO_OUTLET_NOTE =
  'This area has no recorded outfall, so a path always ends where the record ' +
  'ends rather than where the water leaves the drainage system.';

/**
 * The three limits, in the words somebody who is not an engineer would use.
 *
 * These are a summary and they are not a replacement. `DEPTH_IS_ABSENT` and
 * `NO_CAPACITY_CLAIM` are still on the card, in full, behind *View technical
 * details*, because the difference between "we do not show depth" and "no
 * depth is recorded for any pit in this area" is the difference between a
 * choice we made and a fact about the council's record -- and the criteria are
 * written against the second.
 *
 * What this fixes is who reads them. A block of qualification under a drawing
 * is read by the person who was already going to read it; three sentences with
 * a heading are read by the person the drawing was for.
 */
export const PLAIN_LIMITS: readonly {
  readonly title: string;
  readonly said: string;
  readonly icon: 'depth' | 'blockages' | 'capacity';
}[] = [
  {
    title: 'Depth',
    said: 'We don\u2019t know how deep the pipes or pit are.',
    icon: 'depth',
  },
  {
    title: 'Blockages',
    said: 'We don\u2019t know whether the pipes are blocked.',
    icon: 'blockages',
  },
  {
    title: 'Capacity',
    said: 'Pipe size alone does not tell us how much water the system can carry.',
    icon: 'capacity',
  },
];

const LABEL: React.CSSProperties = { fontSize: 12, letterSpacing: 0.6, color: '#61707c' };

const BADGE: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: 11,
  background: '#dcece6',
  color: '#1f5b4e',
};

export interface PitDetailProps {
  readonly pit: Pit;
  readonly map: MapArtefact;
  readonly artefact: TraceArtefact;
  readonly trace: Trace | null;
  readonly onFollow: () => void;
  readonly onClear: () => void;
}

export function PitDetail({ pit, map, artefact, trace, onFollow, onClear }: PitDetailProps) {
  const [sectionOpen, setSectionOpen] = useState(false);
  const asset = pit.asset_number === undefined ? null : String(pit.asset_number);
  const links = asset === null ? undefined : artefact.links[asset];
  const followable = links !== undefined && links.some((link) => link.to !== undefined);
  const hasRecord = links !== undefined && links.length > 0;

  const outcome = sectionFor(map, pit);

  return (
    <div>
      {/*
        The drawing first. A resident opening a pit gets a picture of what a
        pit is and what runs through it before they get an asset number: the
        fields answer a question you can only ask once you know what you are
        looking at.
      */}
      <CrossSection outcome={outcome} />

      <PlainLimits />

      <button
        type="button"
        onClick={() => setSectionOpen((open) => !open)}
        aria-expanded={sectionOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          margin: '14px 0 12px',
          paddingTop: 14,
          borderTop: '1px solid #e6ebe4',
          background: 'none',
          border: 'none',
          borderTopWidth: 1,
          borderTopStyle: 'solid',
          borderTopColor: '#e6ebe4',
          font: 'inherit',
          fontWeight: 500,
          textAlign: 'left',
          color: '#1f5b4e',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 14,
            transform: sectionOpen ? 'rotate(180deg)' : 'none',
            transformOrigin: '50% 45%',
          }}
        >
          ⌄
        </span>
        {sectionOpen ? 'Hide technical details' : 'View technical details'}
      </button>

      {sectionOpen && (
        <div style={{ marginBottom: 12 }}>
          <span style={LABEL}>SELECTED PIT</span>
          <div style={{ margin: '4px 0 8px' }}>
            <span style={BADGE}>{RECORDED_BADGE}</span>
          </div>

          <dl
            style={{
              margin: '0 0 12px',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '4px 12px',
            }}
          >
            {FIELDS.map(({ key, label }) => {
              const value = pit[key];
              const recorded = value !== undefined && value !== null && String(value).trim() !== '';
              return (
                <div key={key} style={{ display: 'contents' }}>
                  <dt style={{ color: '#5b6e7e' }}>{label}</dt>
                  {/*
                    "Not recorded" was #94a2ae -- 2.6:1, the faintest text in
                    the product, on the words that say the council holds no
                    value. A product whose argument is that absence should be
                    visible was rendering absence at a quarter of the contrast
                    of presence. It is quieter than a recorded value and it is
                    legible.
                  */}
                  <dd style={{ margin: 0, color: recorded ? '#1e2b36' : '#61707c' }}>
                    {recorded ? String(value) : NOT_RECORDED}
                  </dd>
                </div>
              );
            })}
          </dl>

          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#5b6e7e' }}>{DEPTH_NOTE}</p>

          <SectionNotes outcome={outcome} />
        </div>
      )}

      {trace === null ? (
        <>
          <button
            type="button"
            disabled={!followable}
            onClick={onFollow}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: followable ? '#1f6f5c' : '#dde3dd',
              color: followable ? '#ffffff' : '#61707c',
              font: 'inherit',
              cursor: followable ? 'pointer' : 'default',
            }}
          >
            Follow the recorded downstream path
          </button>
          {!followable && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#61707c' }}>
              {hasRecord
                ? 'Every pipe leaving this pit stops at the edge of the record, so there is no path to follow.'
                : 'The record has no pipe leaving this pit, so there is no path to follow.'}
            </p>
          )}
        </>
      ) : (
        <TraceSummary trace={trace} onClear={onClear} />
      )}
    </div>
  );
}

/**
 * What the followed path did.
 *
 * The count of stops is given before the reasons, because "it stopped in four
 * places" is the fact that changes how much of this path a person should
 * trust, and the reasons only qualify it.
 */
function TraceSummary({ trace, onClear }: { readonly trace: Trace; readonly onClear: () => void }) {
  const reasons = endingsByReason(trace);
  const brokenRecord = trace.endings.filter((ending) =>
    stoppedBecauseOfTheRecord(ending.reason),
  ).length;

  return (
    <div style={{ paddingTop: 10, borderTop: '1px solid #e6ebe4' }}>
      <span style={LABEL}>FOLLOWED PATH</span>
      <p style={{ margin: '6px 0 8px' }}>
        {trace.pipes.length === 0 ? (
          'No pipe could be followed from this pit.'
        ) : (
          <>
            <strong>
              {trace.pipes.length} recorded {trace.pipes.length === 1 ? 'pipe' : 'pipes'}
            </strong>{' '}
            across {trace.steps} {trace.steps === 1 ? 'step' : 'steps'} downstream.
          </>
        )}
      </p>

      <p style={{ margin: '0 0 6px' }}>
        The path stops in {trace.endings.length} {trace.endings.length === 1 ? 'place' : 'places'}
        {brokenRecord > 0 ? ':' : ', all at the edge of the mapped area:'}
      </p>
      <ul style={{ margin: '0 0 10px', paddingLeft: 18, color: '#4a5b68' }}>
        {reasons.map(({ reason, count }) => (
          <li key={reason} style={{ marginBottom: 3 }}>
            {count > 1 ? `${count} × ` : ''}
            {ENDING_LABELS[reason] ?? reason}
          </li>
        ))}
      </ul>

      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#5b6e7e' }}>{NO_OUTLET_NOTE}</p>

      <button
        type="button"
        onClick={onClear}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          color: '#1f6f5c',
          cursor: 'pointer',
        }}
      >
        Clear the followed path
      </button>
    </div>
  );
}

/**
 * What the data does not show, before anybody has to ask.
 *
 * Three columns on a card wide enough and one under the other when it is not.
 * The wording is a teammate's, from the 7 September list, and it is
 * deliberately plainer than the sentences it summarises: "we do not know how
 * deep the pipes are" is a thing a resident can act on, and "no invert level
 * is recorded for any pit in this area" is a thing an engineer can check.
 * Both are on the card.
 */
const ICON_INK = '#2f5b70';
const ALERT = '#e07b1f';

/**
 * The three icons, drawn rather than fetched.
 *
 * Inline SVG for the reason every other mark in this product is inline: an
 * icon font or a sprite from a CDN would make the reader's browser tell a
 * third party which page they are on, and this product's contract says it does
 * not do that. They are also the only three icons here, so a library would be
 * several hundred kilobytes to save sixty lines.
 */
function LimitIcon({ kind }: { readonly kind: 'depth' | 'blockages' | 'capacity' }) {
  const common = { width: 30, height: 30, viewBox: '0 0 32 32', 'aria-hidden': true } as const;

  if (kind === 'depth') {
    // Two surfaces we cannot measure between: the dotted lines are the unknown
    // ones, which is the whole point of the card.
    return (
      <svg {...common}>
        <line x1="6" y1="5" x2="26" y2="5" stroke={ICON_INK} strokeWidth="1.6" strokeDasharray="2 3" strokeLinecap="round" />
        <line x1="6" y1="27" x2="26" y2="27" stroke={ICON_INK} strokeWidth="1.6" strokeDasharray="2 3" strokeLinecap="round" />
        <line x1="16" y1="10" x2="16" y2="22" stroke={ICON_INK} strokeWidth="1.6" />
        <polygon points="16,6.5 12.6,11.5 19.4,11.5" fill={ICON_INK} />
        <polygon points="16,25.5 12.6,20.5 19.4,20.5" fill={ICON_INK} />
      </svg>
    );
  }

  if (kind === 'blockages') {
    // A length of pipe with a question over it.
    return (
      <svg {...common}>
        <path
          d="M6 11h11v10H6z"
          fill="none"
          stroke={ICON_INK}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <ellipse cx="6" cy="16" rx="2.6" ry="5" fill="none" stroke={ICON_INK} strokeWidth="1.8" />
        <line x1="17" y1="11" x2="17" y2="21" stroke={ICON_INK} strokeWidth="1.8" />
        <circle cx="23.5" cy="21.5" r="7" fill={ALERT} />
        <text
          x="23.5"
          y="25"
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill="#ffffff"
        >
          ?
        </text>
      </svg>
    );
  }

  // A gauge, because capacity is the thing people expect a size to be a
  // reading of, and it is not.
  return (
    <svg {...common}>
      <path
        d="M4.5 23a11.5 11.5 0 1 1 23 0"
        fill="none"
        stroke={ICON_INK}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line x1="16" y1="23" x2="10" y2="14.5" stroke={ICON_INK} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="23" r="1.9" fill={ICON_INK} />
      <line x1="6.5" y1="16.5" x2="8.4" y2="17.6" stroke={ICON_INK} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="16" y1="11.5" x2="16" y2="13.7" stroke={ICON_INK} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="25.5" y1="16.5" x2="23.6" y2="17.6" stroke={ICON_INK} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * What the data does not show, before anybody has to ask.
 *
 * Three columns divided by hairlines where there is room for them, one under
 * another where there is not. That rule is in `base.css` as a container query
 * rather than here, because it depends on the width of the box this sits in —
 * a 296-pixel map callout on one screen, and a wider panel elsewhere — and a
 * style attribute cannot ask a question about its own container.
 *
 * The wording is the design owner's, and it is deliberately plainer than the
 * sentences it replaced: "we don't know how deep the pipes are" is something a
 * resident can act on.
 */
function PlainLimits() {
  return (
    <div
      className="limits"
      style={{
        marginTop: 12,
        padding: '14px 16px',
        background: '#fdf7ec',
        border: '1px solid #eadfc6',
        borderRadius: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <circle cx="11" cy="11" r="11" fill={ALERT} />
          <rect x="10" y="5" width="2" height="8" rx="1" fill="#ffffff" />
          <circle cx="11" cy="16" r="1.3" fill="#ffffff" />
        </svg>
        <strong style={{ fontSize: 15, color: '#1e2b36' }}>
          {'What the data doesn\u2019t show'}
        </strong>
      </div>

      <div className="limits__row">
        {PLAIN_LIMITS.map((limit) => (
          <div className="limits__item" key={limit.title}>
            <LimitIcon kind={limit.icon} />
            <div>
              <strong style={{ display: 'block', fontSize: 13, color: '#1e2b36', marginBottom: 2 }}>
                {limit.title}
              </strong>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: '#5b6e7e' }}>
                {limit.said}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
