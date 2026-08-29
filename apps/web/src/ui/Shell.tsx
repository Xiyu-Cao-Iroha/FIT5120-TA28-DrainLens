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

export const INDICATIVE = 'Indicative local information';

export const PILOT_BADGE = 'Kensington pilot · illustrative prototype geometry';

export interface ShellProps {
  readonly children: ReactNode;
  /** Shown at the right of the header, for "How this works" and the like. */
  readonly actions?: ReactNode;
  /** Where the person is, when they are somewhere with a way back. */
  readonly crumbs?: ReactNode;
}

export function Shell({ children, actions, crumbs }: ShellProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        font: '15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif',
        color: '#1e2b36',
        background: '#f6f8f4',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          background: '#ffffff',
          borderBottom: '1px solid #e6ebe4',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#243b53',
            color: '#ffffff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 15,
          }}
        >
          ≈
        </span>
        <span>
          <strong style={{ display: 'block', lineHeight: 1.2 }}>DrainLens</strong>
          <span style={{ fontSize: 12, color: '#6b7a88' }}>Local drainage explorer</span>
        </span>
        <span style={{ marginLeft: 'auto' }}>{actions}</span>
      </header>

      <div
        role="note"
        style={{
          padding: '7px 20px',
          background: '#fdf7e3',
          borderBottom: '1px solid #f0e4bd',
          fontSize: 13,
          color: '#6b5b28',
        }}
      >
        <span aria-hidden>ⓘ </span>
        {INDICATIVE}
      </div>

      {crumbs !== undefined && (
        <nav
          aria-label="Breadcrumb"
          style={{
            padding: '8px 20px',
            fontSize: 13,
            color: '#6b7a88',
            borderBottom: '1px solid #edf1ea',
            background: '#ffffff',
          }}
        >
          {crumbs}
        </nav>
      )}

      <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'auto' }}>
        {children}
      </main>
    </div>
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
        margin: '14px 0 0',
        padding: '9px 12px',
        background: '#fff4f2',
        border: '1px solid #f3d5cf',
        borderRadius: 8,
        fontSize: 13,
        color: '#8a4b3d',
      }}
    >
      <strong>Stand-in address list.</strong> {note}
    </p>
  );
}
