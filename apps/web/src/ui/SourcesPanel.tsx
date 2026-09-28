/**
 * "About the data" as a full-screen page over whatever the person was doing.
 *
 * **An overlay, not a screen in the session.** A popup on the map links here,
 * and a new session screen would unmount the map: the selected drain, the
 * layers and the view would all be gone on the way back (AC 1.1.4 and 1.1.5
 * ask for those to be kept). Opened over the current screen, Back returns the
 * person to exactly where they were.
 *
 * Usage, anywhere under `<Shell>`:
 *
 *   <SourceLink id="recorded" />          // "From council records ›"
 *   const { open } = useSources(); open('rate');
 *
 * **It behaves as a modal dialog.** Tab and Shift+Tab stay inside it, the rest
 * of the page is inert and does not scroll behind it, Escape and Back close
 * it, and focus returns to whatever opened it, so a keyboard user lands back on
 * the link they pressed rather than at the top of the document.
 */

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { type Credit, describeDatasets, licenceUrl } from './attribution.js';
import {
  SOURCE_LINKS,
  SOURCE_SECTIONS,
  SOURCES_PAGE,
  type SourceLinkId,
  type SourceSectionId,
  sectionAnchor,
} from './sources.js';
import { ink, line, radius, space, surface, text, type, weight } from './theme.js';

interface SourcesApi {
  /** Opens the page, scrolled to a section when one is given. */
  readonly open: (section?: SourceSectionId | null) => void;
}

const SourcesContext = createContext<SourcesApi>({ open: () => undefined });

export const useSources = (): SourcesApi => useContext(SourcesContext);

export function SourcesProvider({
  children,
  credits,
  notice,
}: {
  readonly children: ReactNode;
  readonly credits: readonly Credit[];
  readonly notice: string;
}) {
  // `undefined` is closed; `null` is open at the top.
  const [opened, setOpened] = useState<SourceSectionId | null | undefined>(undefined);
  // What had focus when the page opened, to hand focus back to on close.
  const opener = useRef<HTMLElement | null>(null);
  const open = useCallback((section: SourceSectionId | null = null) => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    setOpened(section);
  }, []);
  useEffect(() => {
    // Runs after the page has unmounted and its inert marks are gone.
    if (opened !== undefined || opener.current === null) return;
    if (opener.current.isConnected) opener.current.focus();
    opener.current = null;
  }, [opened]);
  const api = useMemo(() => ({ open }), [open]);
  return (
    <SourcesContext.Provider value={api}>
      {children}
      {opened !== undefined && (
        <SourcesPage
          section={opened}
          credits={credits}
          notice={notice}
          onClose={() => {
            setOpened(undefined);
          }}
        />
      )}
    </SourcesContext.Provider>
  );
}

/** A small grey link that opens the page at the section its id names. */
export function SourceLink({
  id,
  label,
  inline = false,
}: {
  readonly id: SourceLinkId;
  readonly label?: string;
  /** Take the surrounding text's size, as in the footer. */
  readonly inline?: boolean;
}) {
  const { open } = useSources();
  const link = SOURCE_LINKS[id];
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => {
        open(link.section);
      }}
      style={{
        padding: 0,
        border: 0,
        background: 'none',
        color: ink.muted,
        font: inline ? 'inherit' : type(text.small, { leading: 1.4 }),
        textDecoration: 'underline',
        textDecorationColor: line.strong,
        textUnderlineOffset: 2,
        cursor: 'pointer',
      }}
    >
      {label ?? link.label} <span aria-hidden>›</span>
    </button>
  );
}

function SourcesPage({
  section,
  credits,
  notice,
  onClose,
}: {
  readonly section: SourceSectionId | null;
  readonly credits: readonly Credit[];
  readonly notice: string;
  readonly onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);

  // The page behind: not focusable, not read out, and not scrolled.
  useEffect(() => {
    const self = dialog.current;
    const siblings = Array.from(self?.parentElement?.children ?? []).filter(
      (el): el is HTMLElement => el !== self && el instanceof HTMLElement && !el.inert,
    );
    for (const el of siblings) el.inert = true;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      for (const el of siblings) el.inert = false;
      document.body.style.overflow = overflow;
    };
  }, []);

  /** Tab past either end wraps to the other: the guards at each end catch it. */
  const wrapTo = (end: 'first' | 'last') => {
    const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => el.dataset.focusGuard === undefined,
    );
    (end === 'first' ? items[0] : items.at(-1))?.focus();
  };

  useEffect(() => {
    if (section === null) {
      heading.current?.focus();
      return;
    }
    const target = document.getElementById(sectionAnchor(section));
    target?.scrollIntoView({ block: 'start' });
    target?.focus();
  }, [section]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const jump = (id: SourceSectionId) => {
    document.getElementById(sectionAnchor(id))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-data-title"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: surface.page }}
    >
      <span
        tabIndex={0}
        data-focus-guard=""
        aria-hidden
        onFocus={() => {
          wrapTo('last');
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space(4),
          padding: `${String(space(3))}px ${String(space(6))}px`,
          borderBottom: `1px solid ${line.base}`,
          background: surface.raised,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: `${String(space(1))}px ${String(space(3))}px`,
            border: `1px solid ${line.base}`,
            borderRadius: radius.base,
            background: surface.raised,
            color: ink.strong,
            font: type(text.label, { weight: weight.medium, leading: 1.4 }),
          }}
        >
          <span aria-hidden>← </span>
          {SOURCES_PAGE.close}
        </button>
        <nav aria-label={SOURCES_PAGE.menuLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: space(3) }}>
          {SOURCE_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                jump(s.id);
              }}
              style={{ padding: 0, border: 0, background: 'none', color: ink.muted, font: type(text.small), cursor: 'pointer' }}
            >
              {s.title}
            </button>
          ))}
        </nav>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain' }}>
        <article style={{ maxWidth: 720, margin: '0 auto', padding: `${String(space(8))}px ${String(space(6))}px` }}>
          <h1
            id="about-data-title"
            ref={heading}
            tabIndex={-1}
            style={{ margin: 0, font: type(text.display, { weight: weight.semibold, leading: 1.2 }), color: ink.strong }}
          >
            {SOURCES_PAGE.title}
          </h1>
          <p style={{ margin: `${String(space(2))}px 0 ${String(space(8))}px`, font: type(text.lead), color: ink.muted }}>
            {SOURCES_PAGE.intro}
          </p>

          {SOURCE_SECTIONS.map((s) => (
            <section
              key={s.id}
              id={sectionAnchor(s.id)}
              tabIndex={-1}
              style={{ padding: `${String(space(6))}px 0`, borderTop: `1px solid ${line.base}`, outline: 'none' }}
            >
              <h2 style={{ margin: 0, font: type(text.title, { weight: weight.semibold, leading: 1.25 }), color: ink.strong }}>
                {s.title}
              </h2>
              <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.body, { weight: weight.medium }), color: ink.base }}>
                {s.summary}
              </p>
              <ul style={{ margin: `${String(space(3))}px 0 0`, paddingLeft: space(5), font: type(text.body, { leading: 1.6 }), color: ink.base }}>
                {s.points.map((point) => (
                  <li key={point} style={{ marginBottom: space(1) }}>
                    {point}
                  </li>
                ))}
              </ul>
              {s.source !== undefined && (
                <p style={{ margin: `${String(space(3))}px 0 0`, font: type(text.small, { leading: 1.5 }), color: ink.subtle }}>
                  Source: {s.source}
                </p>
              )}
              {s.id === 'privacy' && credits.length > 0 && (
                <p style={{ margin: `${String(space(3))}px 0 0`, font: type(text.small, { leading: 1.5 }), color: ink.subtle }}>
                  {credits.map((credit) => (
                    <span key={`${credit.publisher} ${credit.licence}`} style={{ display: 'block' }}>
                      {describeDatasets(credit.datasets)} © {credit.publisher}, licensed{' '}
                      <a href={licenceUrl(credit.licence)} target="_blank" rel="license noreferrer" style={{ color: ink.muted }}>
                        {credit.licence}
                      </a>
                      {credit.lastModified === null ? '' : `, last updated ${credit.lastModified}`}.
                    </span>
                  ))}
                  <span style={{ display: 'block' }}>{notice}</span>
                </p>
              )}
            </section>
          ))}
        </article>
      </div>
      <span
        tabIndex={0}
        data-focus-guard=""
        aria-hidden
        onFocus={() => {
          wrapTo('first');
        }}
      />
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
