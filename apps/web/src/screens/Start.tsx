/**
 * The two things this product does, as a choice rather than as a layout.
 *
 * Team request, 4 October. *Flood history* used to sit in the header beside
 * *Get started*, which put a page about the past across Greater Melbourne at
 * the same weight as the way into everything else, and left somebody who
 * pressed *Get started* in a flow that had quietly decided for them.
 *
 * So the header carries one control, and pressing it asks the one question the
 * product can honestly ask first: **are you here about your own street, or
 * about what has happened before?** They are different questions with
 * different evidence behind them — one is the ground and the drains in the
 * City of Melbourne, the other is recorded call-outs across Greater Melbourne
 * — and the homepage has always said so in words. This is the same sentence
 * as a fork.
 */

import type { ReactNode } from 'react';

import { FLOOD } from '../ui/terms.js';

import { brand, ink, line, radius, space, surface, text, tracking, type, weight } from '../ui/theme.js';

/** What the two cards say. Here rather than inline, so a test can read them. */
export const START_CHOICES = [
  {
    id: 'explore',
    title: 'Explore drains and get prepared',
    body: 'Street drains near your address, where rain may flow, your drainage area, and what to check before heavy rain.',
    scope: 'City of Melbourne',
    action: 'Choose a guide →',
  },
  {
    id: 'history',
    title: 'Flood history',
    body: `Which areas had the most flood emergencies, from recorded ${FLOOD.unit} over six financial years.`,
    scope: 'Greater Melbourne',
    action: 'Open the flood history →',
  },
] as const;

export function Start({
  onExplore,
  onHistory,
  onBack,
}: {
  readonly onExplore: () => void;
  readonly onHistory: () => void;
  readonly onBack: () => void;
}) {
  const press = { explore: onExplore, history: onHistory } as const;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: `${String(space(8))}px ${String(space(6))}px` }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          marginBottom: space(8),
          font: type(text.label, { weight: weight.medium }),
          color: ink.muted,
          cursor: 'pointer',
        }}
      >
        ← Back
      </button>

      <h1
        style={{
          margin: `0 0 ${String(space(3))}px`,
          textAlign: 'center',
          font: type(text.display, { weight: weight.semibold, leading: 1.2 }),
          letterSpacing: tracking.display,
          color: ink.strong,
        }}
      >
        What would you like to look at?
      </h1>
      <p
        style={{
          margin: `0 auto ${String(space(10))}px`,
          maxWidth: 620,
          textAlign: 'center',
          font: type(text.body, { leading: 1.6 }),
          color: ink.muted,
        }}
      >
        Two different questions, with different records behind them. Neither is a flood warning.
      </p>

      <div
        style={{
          display: 'grid',
          gap: space(5),
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        }}
      >
        {START_CHOICES.map((choice) => (
          <Choice key={choice.id} onPress={press[choice.id]}>
            <span
              style={{
                font: type(text.micro, { weight: weight.semibold }),
                letterSpacing: tracking.caps,
                textTransform: 'uppercase',
                color: ink.subtle,
              }}
            >
              {choice.scope}
            </span>
            <span style={{ font: type(text.title, { weight: weight.semibold }), color: ink.strong }}>
              {choice.title}
            </span>
            <span style={{ font: type(text.body, { leading: 1.55 }), color: ink.muted }}>
              {choice.body}
            </span>
            <span
              style={{
                marginTop: 'auto',
                paddingTop: space(4),
                font: type(text.label, { weight: weight.semibold }),
                color: brand.ink,
              }}
            >
              {choice.action}
            </span>
          </Choice>
        ))}
      </div>
    </div>
  );
}

function Choice({ onPress, children }: { readonly onPress: () => void; readonly children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space(2),
        alignItems: 'flex-start',
        textAlign: 'left',
        minHeight: 240,
        padding: space(5),
        borderRadius: radius.large,
        border: `1px solid ${line.base}`,
        background: surface.raised,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
