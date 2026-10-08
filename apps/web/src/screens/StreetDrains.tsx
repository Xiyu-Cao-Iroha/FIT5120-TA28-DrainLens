/**
 * Step 3 of the plan: every recorded street drain within the ring (Figma S1–S4).
 *
 * **A list, because the map alone was not an answer.** The plan's third step
 * used to switch the Drain pits layer on and leave the reader with a few
 * hundred identical circles. The design asks for the drains to be *grouped by
 * street, your street first, no ranking* — which is the shape of a thing you
 * can read down rather than hunt across.
 *
 * **Grouping is not ranking, and the panel says so twice.** Its first sentence
 * is *this is every recorded drain nearby, not a selection*; the order is the
 * reader's own street, then the streets with the most drains, because those
 * are the ones a street name helps with. Nothing here says a drain is more
 * likely to block than another, and nothing here could.
 */

import { useId, useState } from 'react';

import { quietButton } from '../ui/controls.js';

import {
  type DrainGroup,
  NAMED_GROUPS,
  type NamedDrain,
  type StreetDrains as Found,
} from '../drains/nearby.js';
import {
  BACK_TO_PLAN,
  NO_DRAINS_STILL,
  OTHER_DRAINS,
  OTHER_DRAINS_WHY,
  STREET_DRAINS_HEADING,
  STREET_DRAINS_STEP,
  SWEEP_DETAIL,
  SWEEP_SUMMARY,
  drainCount,
  moreStreets,
  noDrains,
  noOwnStreet,
} from '../drains/wording.js';
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
} from '../ui/theme.js';

export function StreetDrains({
  address,
  found,
  yourStreet,
  selected = null,
  onSelect,
  onBack,
}: {
  readonly address: string;
  readonly found: Found;
  /** The reader's own street, where the index knew one. */
  readonly yourStreet: string | null;
  /** The drain whose card is open on the map, so the list can mark it. */
  readonly selected?: string | null;
  readonly onSelect: (drain: NamedDrain) => void;
  readonly onBack: () => void;
}) {
  const named = found.groups.filter((group) => group.street !== null);
  const other = found.groups.find((group) => group.street === null) ?? null;
  const shown = named.slice(0, NAMED_GROUPS);
  const rolled = named.slice(NAMED_GROUPS);
  const ownStreetMissing = yourStreet !== null && !found.groups.some((group) => group.yours);

  return (
    <div style={{ font: type(text.small, { leading: 1.55 }), color: ink.base }}>
      <p style={{ margin: 0 }}>
        <button type="button" onClick={onBack} style={quietButton}>
          ‹ {BACK_TO_PLAN}
        </button>
      </p>

      <p
        style={{
          margin: `${String(space(3))}px 0 ${String(space(1))}px`,
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
          color: brand.ink,
        }}
      >
        {STREET_DRAINS_STEP}
      </p>
      <h2
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.lead, { weight: weight.semibold, leading: 1.2 }),
          color: ink.strong,
        }}
      >
        {STREET_DRAINS_HEADING}
      </h2>

      {found.total === 0 ? (
        <>
          <p style={{ margin: 0 }}>{noDrains(address)}</p>
          <p style={{ margin: `${String(space(2))}px 0 0`, color: ink.muted }}>{NO_DRAINS_STILL}</p>
        </>
      ) : (
        <>
          <p style={{ margin: 0, color: ink.muted }}>{drainCount(found.total, address)}</p>

          <SweepNote />

          {ownStreetMissing && (
            <p style={{ margin: `${String(space(3))}px 0 0`, color: ink.muted }}>{noOwnStreet(yourStreet)}</p>
          )}

          {shown.map((group, at) => (
            <Group
              key={group.street ?? 'other'}
              group={group}
              open={at === 0}
              selected={selected}
              onSelect={onSelect}
            />
          ))}

          {rolled.length > 0 && (
            <Roll label={moreStreets(rolled.length)}>
              {rolled.map((group) => (
                <Group
                  key={group.street ?? 'other'}
                  group={group}
                  open={false}
                  selected={selected}
                  onSelect={onSelect}
                />
              ))}
            </Roll>
          )}

          {other !== null && (
            <>
              <Group group={other} open={false} selected={selected} onSelect={onSelect} />
              <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.micro), color: ink.subtle }}>
                {OTHER_DRAINS_WHY}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * What may be swept, and the four things that may not be done.
 *
 * Folded: it is advice about something the reader may not have decided to do,
 * and its first line is the whole offer. Open, it carries the boundary — never
 * lift the cover, never reach inside, never stand in the road.
 */
function SweepNote() {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        margin: `${String(space(3))}px 0 0`,
        padding: space(2),
        border: `1px solid ${advisory.line}`,
        borderRadius: radius.base,
        background: advisory.fill,
        color: advisory.ink,
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((was) => !was);
        }}
        style={{
          display: 'flex',
          gap: space(2),
          alignItems: 'baseline',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          font: type(text.small, { weight: weight.semibold, leading: 1.45 }),
          color: advisory.ink,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span>{SWEEP_SUMMARY}</span>
        <span aria-hidden>{open ? '⌃' : '⌄'}</span>
      </button>
      {open && (
        <p id={id} style={{ margin: `${String(space(2))}px 0 0`, font: type(text.small, { leading: 1.55 }) }}>
          {SWEEP_DETAIL}
        </p>
      )}
    </div>
  );
}

/** One street, its count, and the drains under it. */
function Group({
  group,
  open: initially,
  selected,
  onSelect,
}: {
  readonly group: DrainGroup;
  readonly open: boolean;
  readonly selected: string | null;
  readonly onSelect: (drain: NamedDrain) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(initially);
  const name = group.street === null ? OTHER_DRAINS : group.yours ? `${group.street} · your street` : group.street;

  return (
    <div
      style={{
        marginTop: space(2),
        ...(open
          ? {
              padding: space(2),
              border: `1px solid ${line.base}`,
              borderRadius: radius.base,
              background: surface.raised,
            }
          : { borderTop: `1px solid ${line.hair}`, paddingTop: space(2) }),
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((was) => !was);
        }}
        style={{
          display: 'flex',
          gap: space(2),
          alignItems: 'baseline',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          font: type(text.small, { weight: group.yours || group.street === null ? weight.semibold : weight.regular }),
          color: ink.strong,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span>
          <span aria-hidden style={{ marginRight: space(2), color: ink.subtle }}>
            {open ? '⌄' : '›'}
          </span>
          {name}
        </span>
        <span style={{ color: ink.muted }}>{group.drains.length}</span>
      </button>

      {open && (
        <ul id={id} style={{ margin: `${String(space(2))}px 0 0`, padding: 0, listStyle: 'none' }}>
          {group.drains.map((drain) => (
            <li key={drain.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(drain);
                }}
                {...(drain.id === selected ? { 'aria-current': 'true' as const } : {})}
                style={{
                  display: 'flex',
                  gap: space(2),
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: `${String(space(1))}px ${String(space(1))}px`,
                  border: 'none',
                  borderRadius: radius.small,
                  background: drain.id === selected ? brand.wash : 'none',
                  font: type(text.small),
                  color: ink.base,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'inline-flex', gap: space(2), alignItems: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
                    <circle cx="5" cy="5" r="4" fill="none" stroke={brand.base} strokeWidth="1.6" />
                  </svg>
                  {drain.label}
                </span>
                <span aria-hidden style={{ color: ink.subtle }}>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The streets the panel does not name, behind one row. */
function Roll({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: space(2), borderTop: `1px solid ${line.hair}`, paddingTop: space(2) }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((was) => !was);
        }}
        style={{
          display: 'block',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          font: type(text.small),
          color: ink.strong,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span aria-hidden style={{ marginRight: space(2), color: ink.subtle }}>
          {open ? '⌄' : '›'}
        </span>
        {label}
      </button>
      {open && <div id={id}>{children}</div>}
    </div>
  );
}


