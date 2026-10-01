/**
 * The mark that says a page is working rather than broken.
 *
 * An arc rather than a full ring, because a ring with no gap does not read as
 * turning: the gap is the only thing that makes the rotation visible, and a
 * spinner nobody can see rotating is a static circle beside the word
 * "Loading".
 *
 * Drawn in SVG and rotated by a class in `base.css`. The animation is there
 * because a keyframe cannot be written as a style attribute, and because the
 * reduced-motion rule belongs beside it — see the note in that file for why
 * this animation slows rather than stops.
 */

import { brand, ink, line, space, text, type } from './theme.js';

export interface SpinnerProps {
  /** Said beside it, and to a screen reader instead of it. */
  readonly label: string;
  readonly size?: number;
}

export function Spinner({ label, size = 22 }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space(3),
        padding: space(6),
        font: type(text.label, { leading: 1.5 }),
        color: ink.muted,
      }}
    >
      <svg
        className="spinner"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden
        focusable="false"
      >
        {/* The whole ring, quiet: it gives the arc something to travel over. */}
        <circle cx="12" cy="12" r="9" fill="none" stroke={line.base} strokeWidth="2.5" />
        {/*
          A quarter of the circumference. 2*pi*9 is 56.5, so 14 on and 42.5 off
          is exactly one quarter -- written as the arithmetic rather than as a
          number somebody would have to reverse-engineer.
        */}
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke={brand.ink}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${String(2 * Math.PI * 9 * 0.25)} ${String(2 * Math.PI * 9 * 0.75)}`}
        />
      </svg>
      {label}
    </div>
  );
}
