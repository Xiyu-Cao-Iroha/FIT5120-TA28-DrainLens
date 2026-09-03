/**
 * The frame every screen sits in.
 *
 * The banner is not decoration and does not scroll away. This product shows a
 * simplified comparison built from a filtered photogrammetric surface, and the
 * one thing a resident must never take from it is that they are looking at an
 * official flood map. The line stays on every screen for the same reason the
 * provenance labels stay on every layer: the moment it is somewhere else, the
 * screen someone is actually reading does not carry it.
 */

import type { ReactNode } from 'react';

import {
  CHANGES_NOTICE,
  type Credit,
  LICENCE_URL,
  describeDatasets,
} from './attribution.js';
import {
  advisory,
  brand,
  ink,
  line,
  radius,
  space,
  surface,
  text,
  tracking,
  type,
  weight,
} from './theme.js';

export const INDICATIVE = 'Indicative local information';

export const PILOT_BADGE = 'Kensington pilot · illustrative prototype geometry';

/**
 * Drawn, not typed.
 *
 * The obvious character for this is `ⓘ`, and Source Sans 3 does not have it —
 * so setting it as text hands one glyph on every screen to whatever face the
 * reader's system supplies, in a different weight and on a different baseline
 * from the sentence beside it. Four characters in this interface are in that
 * position; all four are drawn instead. See `public/fonts/README.md`.
 */
function InfoMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="4.6" r="0.95" fill="currentColor" />
      <path
        d="M8 7.1v4.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export interface ShellProps {
  readonly children: ReactNode;
  /** Shown at the right of the header, for "How this works" and the like. */
  readonly actions?: ReactNode;
  /** Where the person is, when they are somewhere with a way back. */
  readonly crumbs?: ReactNode;
  /**
   * The way out, drawn as a control rather than as a place.
   *
   * A breadcrumb says where you *are*; the first crumb happens to be
   * clickable, which is not the same thing as a way back and is not read as
   * one. Screens that were opened from somewhere pass `back` and get a button
   * that says so, at the top left where a person looks for it.
   */
  readonly back?: { readonly label: string; readonly onBack: () => void };
  /**
   * Who the data belongs to, read from the artefacts.
   *
   * Optional only so a screen can render before the artefacts have loaded.
   * Once they have, this is not optional in any sense that matters: CC BY 4.0
   * requires the credit to be visible wherever the work is.
   */
  readonly credits?: readonly Credit[];
}

export function Shell({ children, actions, crumbs, back, credits }: ShellProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        font: type(text.body),
        color: ink.base,
        background: surface.page,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space(3),
          padding: `${String(space(3))}px ${String(space(6))}px`,
          background: surface.raised,
          borderBottom: `1px solid ${line.base}`,
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.base,
            background: ink.strong,
            color: ink.inverse,
            display: 'grid',
            placeItems: 'center',
            fontSize: 17,
            lineHeight: 1,
          }}
        >
          ≈
        </span>
        <span>
          <strong
            style={{
              display: 'block',
              font: type(text.lead, { weight: weight.semibold, leading: 1.15 }),
              letterSpacing: tracking.title,
              color: ink.strong,
            }}
          >
            DrainLens
          </strong>
          <span
            style={{
              font: type(text.small, { leading: 1.3 }),
              color: ink.subtle,
            }}
          >
            Local drainage explorer
          </span>
        </span>
        <span style={{ marginLeft: 'auto' }}>{actions}</span>
      </header>

      <div
        role="note"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space(2),
          padding: `${String(space(2))}px ${String(space(6))}px`,
          background: advisory.fill,
          borderBottom: `1px solid ${advisory.line}`,
          font: type(text.label, { leading: 1.4 }),
          color: advisory.ink,
          flexShrink: 0,
        }}
      >
        <InfoMark />
        {INDICATIVE}
      </div>

      {(crumbs !== undefined || back !== undefined) && (
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space(4),
            padding: `${String(space(2))}px ${String(space(6))}px`,
            font: type(text.label, { leading: 1.4 }),
            color: ink.subtle,
            borderBottom: `1px solid ${line.hair}`,
            background: surface.raised,
            flexShrink: 0,
          }}
        >
          {back !== undefined && (
            <button
              type="button"
              onClick={back.onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: space(1),
                padding: `${String(space(1))}px ${String(space(3))}px`,
                border: `1px solid ${line.base}`,
                borderRadius: radius.base,
                background: surface.raised,
                color: ink.strong,
                font: type(text.label, { weight: weight.medium, leading: 1.4 }),
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span aria-hidden>←</span> {back.label}
            </button>
          )}
          {crumbs}
        </nav>
      )}

      <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'auto' }}>
        {children}
      </main>

      {credits !== undefined && credits.length > 0 && <Attribution credits={credits} />}
    </div>
  );
}

/**
 * The data credit, on every screen.
 *
 * CC BY 4.0 requires the attribution to be visible to the person using the
 * work, so it sits in the frame rather than behind a link — the same argument
 * as the indicative banner above it. It is small and quiet, which the licence
 * permits; it is not absent, which the licence does not.
 */
function Attribution({ credits }: { readonly credits: readonly Credit[] }) {
  return (
    <footer
      style={{
        flexShrink: 0,
        padding: `${String(space(2))}px ${String(space(6))}px`,
        background: surface.raised,
        borderTop: `1px solid ${line.base}`,
        font: type(text.micro, { leading: 1.5 }),
        color: ink.subtle,
      }}
    >
      {credits.map((credit) => (
        <span key={`${credit.publisher} ${credit.licence}`} style={{ marginRight: space(3) }}>
          {describeDatasets(credit.datasets)} © {credit.publisher}, licensed{' '}
          <a
            href={LICENCE_URL}
            target="_blank"
            rel="license noreferrer"
            style={{ color: ink.muted, textDecorationColor: line.strong }}
          >
            {credit.licence}
          </a>
          {credit.lastModified === null ? '' : `, last updated ${credit.lastModified}`}.{' '}
        </span>
      ))}
      <span>{CHANGES_NOTICE}</span>
    </footer>
  );
}

/**
 * The warning shown while the address index is a stand-in.
 *
 * A search that can resolve two addresses would otherwise look like a search
 * that found nothing for everybody else's. Saying so is cheap; letting someone
 * conclude their street is not covered when it simply is not indexed yet is
 * the sort of quiet wrong this product is built to avoid.
 */
export function FixtureNotice({ note }: { readonly note: string }) {
  return (
    <p
      role="status"
      style={{
        margin: `${String(space(4))}px 0 0`,
        padding: `${String(space(3))}px ${String(space(3))}px`,
        background: '#fff5f2',
        border: '1px solid #f2d6cf',
        borderRadius: radius.base,
        font: type(text.label),
        color: '#8a4b3d',
      }}
    >
      <strong style={{ fontWeight: weight.semibold }}>Stand-in address list.</strong> {note}
    </p>
  );
}

/**
 * The pilot badge, which is a claim about scope rather than a label.
 *
 * Exported because the landing page and the task page both carry it, and two
 * copies of a sentence about what this product does *not* cover is how they
 * drift apart.
 */
export function PilotBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: `${String(space(1))}px ${String(space(3))}px`,
        borderRadius: radius.pill,
        background: brand.wash,
        border: `1px solid ${brand.tint}`,
        font: type(text.small, { weight: weight.medium, leading: 1.5 }),
        color: brand.ink,
      }}
    >
      {PILOT_BADGE}
    </span>
  );
}
