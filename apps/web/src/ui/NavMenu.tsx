/**
 * A navigation item that is a link and a short menu at once.
 *
 * *Flood history* is two screens: the areas ranked, and the same areas drawn
 * as a map. The map was reachable only from a button half way down the
 * ranked page and from a card on the homepage, so from the map there was no
 * way back to the ranking, and from anywhere else in the site no way to the
 * map at all. The team asked for it on 15 October.
 *
 * **The label still goes to the ranked page**, which is the team's decision
 * of the same day. A parent that both navigates and opens a menu is the one
 * people mis-click, so the two jobs are two controls: the label is the link
 * it has always been, and the caret beside it opens the list. The list
 * includes the label's own destination, because a menu that leaves out the
 * page you are on cannot tell you what the section contains.
 *
 * **It opens on hover, and not only on hover** (team, 15 October). A pointer
 * resting on the item is the quickest way in and is what the team asked for.
 * It cannot be the only way in: hover does not exist on a touch screen and
 * cannot be reached from a keyboard, so the caret still toggles on a press
 * and still opens on Down, and the caret stays visible as the one sign that
 * a menu is there at all for the readers who cannot hover to find out.
 *
 * **The menu touches the item it hangs from**, with no gap, and leaving is
 * given `LEAVE_MS` before it closes. Both are about the same thing: a gap or
 * an instant close makes the menu shut while the pointer is on its way to
 * it, which reads as the menu refusing to be used. The delay is cancelled
 * the moment the pointer comes back.
 *
 * **The menu is positioned `fixed`.** Under 560 px the navigation row
 * scrolls sideways (`.shell__actions` in `base.css`), and a menu positioned
 * against a scrolling box is a menu with its bottom cut off. Fixed takes it
 * out of that box. Where it goes is measured when it opens, and a scroll or
 * a resize closes it rather than letting it drift away from its button.
 */

import { useEffect, useId, useRef, useState } from 'react';

import { brand, ink, line, radius, shadow, space, surface, text, type, weight } from './theme.js';

/**
 * The shape of one item in the site navigation.
 *
 * Shared with `NavLink` in `App.tsx` rather than written twice, because a
 * link and a menu sitting in the same row have to be the same size.
 */
export const navItem = {
  padding: `${String(space(2))}px ${String(space(3))}px`,
  borderRadius: radius.base,
  font: type(text.label, { weight: weight.medium, leading: 1.4 }),
  whiteSpace: 'nowrap',
} as const;

/**
 * How long the pointer may be off the item before the menu closes.
 *
 * Long enough to cross from the label to the first row without the menu
 * going out from under the pointer, short enough that leaving on purpose
 * does not feel like the menu is hanging about.
 */
const LEAVE_MS = 160;

/**
 * Bring the item the reader is on into view, where the row scrolls.
 *
 * Under 560 px the navigation does not wrap or hide behind a menu: it
 * scrolls sideways, which was the right call and is untouched. What it
 * costs is that the row starts at its left end, so an item far enough along
 * it begins off screen, and the reader is given no sign of where they are.
 * Four items were already wider than a 375 px phone; *Comparison* made it
 * five on 15 October.
 *
 * `inline: 'nearest'` moves the row by the least that shows the item, and
 * `block: 'nearest'` keeps it from scrolling the page underneath: the
 * header is at the top and already in view, so there is nothing to do
 * vertically and nothing is done.
 */
export function useShowWhenCurrent<T extends HTMLElement>(current: boolean) {
  const self = useRef<T | null>(null);

  useEffect(() => {
    if (!current) return;
    const node = self.current;
    if (node === null || typeof node.scrollIntoView !== 'function') return;
    node.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [current]);

  return self;
}

/** One destination under a navigation item. */
export interface NavMenuItem {
  readonly label: string;
  /** This is the screen on show, so it is marked rather than offered. */
  readonly current: boolean;
  readonly onOpen: () => void;
}

export function NavMenu({
  label,
  here,
  onHere,
  onOpen,
  items,
}: {
  readonly label: string;
  /** Either of this item's screens is on show, so the row is marked. */
  readonly here: boolean;
  /** The label's own destination is the one on show, so it is not a link. */
  readonly onHere: boolean;
  readonly onOpen: () => void;
  readonly items: readonly NavMenuItem[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ readonly left: number; readonly top: number } | null>(null);
  const caret = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const self = useShowWhenCurrent<HTMLSpanElement>(here);
  const leaving = useRef<number | null>(null);

  /** Any pending close is off: the pointer is back, or a press has decided. */
  const stay = () => {
    if (leaving.current === null) return;
    window.clearTimeout(leaving.current);
    leaving.current = null;
  };

  // A timer outliving the component would set state on nothing.
  useEffect(() => stay, []);

  const shut = (toCaret: boolean) => {
    stay();
    setOpen(false);
    if (toCaret) caret.current?.focus();
  };

  /*
    Everything that should put it away: a press anywhere else, the page
    moving under it, and the window changing size. Scroll is listened for in
    the capture phase because the row itself scrolls on a phone, and a
    scroll inside an element does not bubble to the window.
  */
  useEffect(() => {
    if (!open) return undefined;

    const elsewhere = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target === null) return;
      if (list.current?.contains(target) === true) return;
      if (caret.current?.contains(target) === true) return;
      setOpen(false);
    };
    const away = () => {
      setOpen(false);
    };

    document.addEventListener('mousedown', elsewhere);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    return () => {
      document.removeEventListener('mousedown', elsewhere);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', away);
    };
  }, [open]);

  /** Under the whole item, left edges lined up. */
  const show = (focusFirst: boolean) => {
    stay();
    const box = caret.current?.parentElement?.getBoundingClientRect();
    // No gap: see `LEAVE_MS` above. The menu hangs off the item's own edge.
    if (box !== undefined) setAt({ left: box.left, top: box.bottom });
    setOpen(true);
    if (!focusFirst) return;
    // After the menu exists. One frame is enough and needs no timer.
    requestAnimationFrame(() => {
      list.current?.querySelector('button')?.focus();
    });
  };

  const step = (from: HTMLElement, by: 1 | -1) => {
    const all = [...(list.current?.querySelectorAll('button') ?? [])];
    if (all.length === 0) return;
    const was = all.indexOf(from as HTMLButtonElement);
    all[(was + by + all.length) % all.length]?.focus();
  };

  return (
    <span
      ref={self}
      onMouseEnter={() => {
        show(false);
      }}
      onMouseLeave={() => {
        stay();
        leaving.current = window.setTimeout(() => {
          leaving.current = null;
          setOpen(false);
        }, LEAVE_MS);
      }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        borderBottom: here ? `2px solid ${brand.base}` : '2px solid transparent',
      }}
    >
      <button
        type="button"
        onClick={onHere ? undefined : onOpen}
        {...(onHere ? { 'aria-current': 'page' as const } : {})}
        style={{
          ...navItem,
          paddingRight: space(1),
          border: 'none',
          background: 'none',
          color: here ? ink.strong : ink.base,
          fontWeight: here ? weight.semibold : weight.medium,
          borderRadius: 0,
          cursor: onHere ? 'default' : 'pointer',
        }}
      >
        {label}
      </button>

      <button
        type="button"
        ref={caret}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: choose a page`}
        onClick={() => {
          if (open) shut(false);
          else show(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          show(true);
        }}
        style={{
          ...navItem,
          paddingLeft: space(1),
          paddingRight: space(2),
          border: 'none',
          background: 'none',
          color: here ? ink.strong : ink.base,
          borderRadius: 0,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        <span aria-hidden style={{ fontSize: 10 }}>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && at !== null && (
        <div
          id={id}
          ref={list}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            const on = event.target as HTMLElement;
            if (event.key === 'Escape') {
              event.preventDefault();
              shut(true);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              step(on, 1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              step(on, -1);
            } else if (event.key === 'Tab') {
              setOpen(false);
            }
          }}
          style={{
            position: 'fixed',
            left: at.left,
            top: at.top,
            zIndex: 40,
            minWidth: 184,
            padding: space(1),
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${line.base}`,
            borderRadius: radius.base,
            background: surface.raised,
            boxShadow: shadow.lifted,
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              {...(item.current ? { 'aria-current': 'page' as const } : {})}
              onClick={() => {
                setOpen(false);
                if (!item.current) item.onOpen();
              }}
              style={{
                ...navItem,
                textAlign: 'left',
                border: 'none',
                background: item.current ? brand.wash : 'none',
                color: item.current ? ink.strong : ink.base,
                fontWeight: item.current ? weight.semibold : weight.medium,
                cursor: item.current ? 'default' : 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
