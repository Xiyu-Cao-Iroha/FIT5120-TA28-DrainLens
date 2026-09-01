/**
 * Choosing what to look at.
 *
 * The screen exists because the two guided tasks answer different questions
 * and want different layers on by default. Asking first is what lets the
 * follow view open with two layers and one instruction instead of everything
 * at once, which is AC 1.1.2.
 *
 * The third option is deliberately not a task. Somebody who wants the whole
 * map should be able to have it, and should be told that it comes without the
 * guidance the other two carry.
 */

import { useState } from 'react';

import type { Task } from '../session.js';
import type { SupportedAddress } from '../session.js';
import {
  brand,
  ink,
  line,
  radius,
  shadow,
  space,
  surface,
  text,
  tracking,
  type,
  weight,
} from '../ui/theme.js';

/**
 * The address mark, drawn.
 *
 * The obvious character is a circled dot, and the shipped subset does not have
 * one — so setting it as text hands this single character to whatever face the
 * reader's system supplies, at a different weight and baseline from the
 * address beside it. See `public/fonts/README.md`.
 */
function PlaceMark() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2.1" fill="currentColor" />
    </svg>
  );
}

/**
 * A button that answers for its own hover state.
 *
 * React has no `:hover`, and the alternative -- a stylesheet rule per button --
 * puts the look of a control somewhere other than the control. One piece of
 * state in one small component is the cheaper trade.
 */
function ActionButton({
  label,
  variant,
  onClick,
}: {
  readonly label: string;
  readonly variant: 'filled' | 'outline';
  readonly onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const filled = variant === 'filled';
  const background = filled
    ? hovered
      ? brand.hover
      : brand.base
    : hovered
      ? brand.wash
      : surface.raised;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      style={{
        alignSelf: 'flex-start',
        padding: `${String(space(3))}px ${String(space(4))}px`,
        font: type(text.label, { weight: weight.semibold }),
        color: filled ? ink.inverse : brand.ink,
        background,
        border: filled ? 'none' : `1px solid ${hovered ? brand.tint : line.strong}`,
        borderRadius: radius.base,
        transition: 'background-color 120ms ease, border-color 120ms ease',
      }}
    >
      {label}
    </button>
  );
}

export interface TaskSelectProps {
  readonly address: SupportedAddress;
  readonly onChoose: (task: Task) => void;
  readonly onChangeAddress: () => void;
}

const GUIDED: readonly {
  readonly task: Task;
  readonly title: string;
  readonly body: string;
  readonly action: string;
}[] = [
  {
    task: 'follow',
    title: 'Follow local water and drainage',
    body: 'See where rainwater may move near this address, and follow the recorded drainage connections downstream.',
    action: 'Follow water and drainage',
  },
  {
    task: 'compare',
    title: 'Compare a drain-blockage scenario',
    body: 'Choose a drainage pit, a blockage assumption and an accumulated rainfall amount, then compare the result against all drains clear.',
    action: 'Set up a comparison',
  },
];

export function TaskSelect({ address, onChoose, onChangeAddress }: TaskSelectProps) {
  return (
    <div
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: `${String(space(9))}px ${String(space(6))}px ${String(space(16))}px`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space(4), flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: space(2),
            font: type(text.label),
            color: ink.muted,
          }}
        >
          <PlaceMark />
          {address.label}
        </span>
        <button
          type="button"
          onClick={onChangeAddress}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: brand.ink,
            font: type(text.label, { weight: weight.medium }),
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            padding: 0,
          }}
        >
          Change address
        </button>
      </div>

      <h1
        style={{
          margin: `${String(space(5))}px 0 ${String(space(2))}px`,
          font: type(text.display, { weight: weight.bold, leading: 1.15 }),
          letterSpacing: tracking.display,
          color: ink.strong,
        }}
      >
        What would you like to understand?
      </h1>
      <p style={{ margin: `0 0 ${String(space(7))}px`, color: ink.muted, maxWidth: 620 }}>
        Choose a task to see the most relevant information first. You can change tasks or open
        other map layers at any time.
      </p>

      <div
        style={{
          display: 'grid',
          gap: space(4),
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        }}
      >
        {GUIDED.map((option) => (
          <section
            key={option.task}
            style={{
              padding: space(5),
              background: surface.raised,
              border: `1px solid ${line.base}`,
              borderRadius: radius.large,
              boxShadow: shadow.resting,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h2
              style={{
                margin: `0 0 ${String(space(2))}px`,
                font: type(text.lead, { weight: weight.semibold, leading: 1.3 }),
                letterSpacing: tracking.title,
                color: ink.strong,
              }}
            >
              {option.title}
            </h2>
            <p
              style={{
                margin: `0 0 ${String(space(5))}px`,
                color: ink.muted,
                font: type(text.label, { leading: 1.55 }),
                flex: 1,
              }}
            >
              {option.body}
            </p>
            <ActionButton
              label={`→ ${option.action}`}
              variant="filled"
              onClick={() => {
                onChoose(option.task);
              }}
            />
          </section>
        ))}
      </div>

      <p
        style={{
          margin: `${String(space(8))}px 0 ${String(space(3))}px`,
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          color: ink.subtle,
          textTransform: 'uppercase',
        }}
      >
        Or explore on your own
      </p>
      <section
        style={{
          padding: space(5),
          background: surface.raised,
          border: `1px solid ${line.base}`,
          borderRadius: radius.large,
          boxShadow: shadow.resting,
          display: 'flex',
          gap: space(4),
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ flex: '1 1 260px' }}>
          <h2
            style={{
              margin: `0 0 ${String(space(1))}px`,
              font: type(text.lead, { weight: weight.semibold, leading: 1.3 }),
              letterSpacing: tracking.title,
              color: ink.strong,
            }}
          >
            Explore the full map{' '}
            <span
              style={{
                font: type(text.micro, { weight: weight.medium }),
                padding: `${String(space(1))}px ${String(space(2))}px`,
                borderRadius: radius.pill,
                background: surface.sunken,
                color: ink.subtle,
                verticalAlign: 'middle',
              }}
            >
              No guided steps
            </span>
          </h2>
          <span style={{ color: ink.muted, font: type(text.label, { leading: 1.55 }) }}>
            View all available terrain, surface-water and drainage information at once, without a
            guided task.
          </span>
        </span>
        <ActionButton
          label="→ Open full map"
          variant="outline"
          onClick={() => {
            onChoose('full-map');
          }}
        />
      </section>
    </div>
  );
}
