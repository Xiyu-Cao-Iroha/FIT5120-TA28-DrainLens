/**
 * The frame every screen sits in.
 *
 * **There is no advisory strip across the top any more.** It said *General
 * information only · not a flood warning* on every screen, and the review of 14
 * September asked for it to go: by then every screen said the same thing in
 * its own place — the footer's always-visible *Not a flood warning*, the
 * homepage's closing note, the notice before the full map, and the provenance
 * tag on every layer — and a fifth copy pinned above all of them took a row
 * of the map repeating what the reader had already been told.
 */

import { type ReactNode, useEffect, useRef } from 'react';

import { CHANGES_NOTICE, type Credit } from './attribution.js';
import {
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
import { COVERAGE } from './terms.js';
import { SourceLink, SourcesProvider } from './SourcesPanel.js';

export interface ShellProps {
  readonly children: ReactNode;
  /**
   * Which screen this is, so a new one starts at the top.
   *
   * **The scrolling element is this shell's, not the screen's.** React keeps
   * the same `<main>` across a screen change, and it keeps its scroll offset
   * with it — so pressing *See flood history* from the band two thirds of the
   * way down the homepage landed two thirds of the way down the flood board,
   * under a heading nobody had read the top of.
   *
   * A person who changes screen has not asked to stay where they were. A
   * person who presses Back has, but this product has no history stack to
   * restore a position from, so the honest default is the top.
   */
  readonly at?: string;
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
   * The right-hand end of the breadcrumb row.
   *
   * One caller uses it, for the map's *tutorial* control. It is here rather
   * than in `actions` because the header is the site's own furniture — name,
   * navigation — and this is a control that belongs to one screen. The
   * prototype put it on this row for the same reason.
   */
  readonly trailing?: ReactNode;
  /**
   * The name and mark at the top, which the map does without.
   *
   * On the homepage the masthead says what this is to somebody who has just
   * arrived. On the map it says it again to somebody who is already inside,
   * and costs 56 pixels of the thing they came for — stacked with the
   * breadcrumb, the map was starting well down a laptop window. Nothing goes
   * with it: the mark is not a link, and the way back is the Back control on
   * the row below.
   *
   * **The footer is not part of this and cannot be turned off.** Its summary
   * line says *Not a flood warning*, and the screen most likely to be mistaken
   * for an official flood map is exactly the screen this prop exists for.
   */
  readonly masthead?: boolean;
  /**
   * Who the data belongs to, read from the artefacts.
   *
   * Optional only so a screen can render before the artefacts have loaded.
   * Once they have, this is not optional in any sense that matters: CC BY 4.0
   * requires the credit to be visible wherever the work is.
   */
  readonly credits?: readonly Credit[];
  /** What was changed from the sources, for the credit. Defaults to the drainage map's. */
  readonly creditNotice?: string;
  /**
   * Which extent is on screen, so the footer can say when the map got smaller.
   *
   * Where the artefacts came from used to be said as well, and the copy review
   * of 14 September cut it: which server answered is not something a resident
   * can act on. What they can act on is the consequence -- the fallback covers
   * one square kilometre instead of the council -- and that is still said.
   */
  readonly extentName?: string;
}

export function Shell({
  children,
  actions,
  crumbs,
  back,
  trailing,
  masthead = true,
  credits,
  creditNotice,
  extentName,
  at,
}: ShellProps) {
  const scrolling = useRef<HTMLElement | null>(null);
  // Not `scrollTo({ behavior: 'smooth' })`: a screen that arrives already
  // scrolled and then slides to the top is a page that looks like it moved
  // under the reader.
  useEffect(() => {
    scrolling.current?.scrollTo(0, 0);
  }, [at]);

  return (
    <SourcesProvider credits={credits ?? []} notice={creditNotice ?? CHANGES_NOTICE}>
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
      {masthead && (
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
      )}

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
          {trailing !== undefined && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>{trailing}</span>
          )}
        </nav>
      )}

      <main
        ref={scrolling}
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'auto' }}
      >
        {children}
      </main>

      {credits !== undefined && credits.length > 0 && (
        <Attribution extentName={extentName} />
      )}
    </div>
    </SourcesProvider>
  );
}

/**
 * The line shown when the map is the bundled fallback.
 *
 * The database holds the whole City of Melbourne and the container holds one
 * square kilometre of Kensington, so when the instance is stopped the map does
 * not merely come from somewhere else -- **it gets smaller**. Left unsaid,
 * somebody finds that out by finding their street missing. The full extent
 * needs no line: it is what `COVERAGE` already says.
 */
const SMALLER_MAP: Record<string, string> = {
  kensington:
    'The full council map is not available right now, so this map shows only one square kilometre of Kensington.',
};

/**
 * The data credit, on every screen.
 *
 * CC BY 4.0 requires the attribution to be reachable by the person using the
 * work. It used to be spelled out on every screen as dataset ids, which the
 * copy review of 14 September found nobody could read; it now sits one press
 * behind a line that names what is there. Collapsed, which the licence
 * permits; not absent, which it does not.
 */
function Attribution({
  extentName,
}: {
  // Required but possibly undefined, not optional: `exactOptionalPropertyTypes`
  // treats those as different, and the caller always passes the key.
  readonly extentName: string | undefined;
}) {
  const smaller = extentName === undefined ? undefined : SMALLER_MAP[extentName];
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
      {smaller !== undefined && (
        <p role="status" style={{ margin: `0 0 ${String(space(1))}px`, color: ink.muted }}>
          {smaller}
        </p>
      )}
      {/*
        The credits and the changes notice moved into "About the data"
        (ui/SourcesPanel.tsx, section "privacy"), one press away as before.
        "Not a flood warning" stays visible on every screen.
      */}
      <p style={{ margin: 0 }}>
        Not a flood warning · <SourceLink id="footer" inline />
      </p>
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
 * The coverage badge, which is a claim about scope rather than a label.
 *
 * Exported because the landing page and the homepage both carry it, and two
 * copies of a sentence about what this product does *not* cover is how they
 * drift apart. The sentence itself is `COVERAGE.map`, for the same reason.
 */
export function CoverageBadge() {
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
      {COVERAGE.map}
    </span>
  );
}
