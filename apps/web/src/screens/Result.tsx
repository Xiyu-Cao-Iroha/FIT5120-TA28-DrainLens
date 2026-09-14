/**
 * The result: one map, one finding, and what it is not.
 *
 * AD7. There is no all-clear view and no blockage view to switch between —
 * only the difference between them. Two of the three views would be absolute
 * water depths, which this model does not compute and must not appear to.
 *
 * **Laid out as the Blockage Flow prototype's C6 and C7 from 15 September**:
 * the finding, the purple's one meaning, the comparison summary, two links for
 * how it was calculated and what it does not show, and two ways on. What the
 * screen said before is all still here, and two things are deliberately *not*
 * behind a link: the disclaimer, and what *No clear difference* does not mean
 * (AC 3.3.2.h, "should not be buried under More information").
 *
 * The insufficient states share this shell rather than living somewhere else,
 * because they are results too: the person asked a question and this is the
 * answer. What differs is that the summary says the comparison was not made,
 * the map draws no difference, and the way out is the one that can help.
 */

import { useState } from 'react';

import { DIFFERENCE_FILL } from '../map/difference.js';
import {
  ACTION_LABELS,
  type Action,
  BASIS_COLOURS,
  BASIS_LABELS,
  type Basis,
  DIFFERENCE_LEGEND,
  HOW_IT_WAS_PRODUCED,
  HOW_STRONGLY_TO_READ_IT,
  LIMITATIONS,
  NO_CLEAR_CHANGE_MEANS,
  type Outcome,
  RAINFALL_CONTROL_NOTE,
  RESULT_DISCLAIMER,
  WHAT_IS_UNCERTAIN,
  WHY_NO_CLEAR_CHANGE,
  groundUncertainty,
  presentationFor,
} from '../scenario/outcome.js';
import type { SolvedPosition } from '../scenario/worker.js';
import { StepBadge, blockageTitle } from './ScenarioSetup.js';
import type { ScenarioInputs } from '../session.js';
import { TOTAL_RAINFALL } from '../ui/terms.js';
import { alert, brand, ink, line, radius, space, surface, text, tracking, type, weight } from '../ui/theme.js';

export interface ResultProps {
  readonly outcome: Outcome;
  readonly scenario: ScenarioInputs;
  /** Positions this run already solved. Empty when there was no comparison. */
  readonly positions?: readonly SolvedPosition[];
  /** Reads the cache above; never starts another solve. */
  readonly onRainfall?: (rainfallMm: number) => void;
  /** Share of the calculation window's ground that was measured, or null. */
  readonly measuredShare?: number | null;
  readonly onAction: (action: Action) => void;
}

export function Result({
  outcome,
  scenario,
  positions = [],
  onRainfall,
  measuredShare = null,
  onAction,
}: ResultProps) {
  const shown = presentationFor(outcome);
  const [howOpen, setHowOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const succeeded = outcome.status === 'successful';
  const noClearChange = succeeded && outcome.band === 'no-clear-change';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space(4),
        padding: `${String(space(5))}px ${String(space(6))}px ${String(space(10))}px`,
      }}
    >
      {succeeded ? (
        <StepBadge>
          <span aria-hidden>✓ </span>Comparison complete
        </StepBadge>
      ) : (
        <span
          style={{
            alignSelf: 'flex-start',
            padding: `${String(space(1))}px ${String(space(3))}px`,
            borderRadius: radius.pill,
            background: alert.fill,
            color: alert.ink,
            font: type(text.micro, { weight: weight.semibold }),
            letterSpacing: tracking.caps,
            textTransform: 'uppercase',
          }}
        >
          {shown.band}
        </span>
      )}

      {/* The band's plain name is the heading: *More water than with a clear drain*, *No clear difference*, or *Insufficient information*. */}
      <h1
        role="status"
        style={{
          margin: 0,
          font: type(text.title, { weight: weight.semibold, leading: 1.25 }),
          letterSpacing: tracking.title,
          color: ink.strong,
        }}
      >
        {succeeded ? shown.band : shown.title}
      </h1>

      {shown.showsDifference && (
        <p
          style={{
            display: 'flex',
            gap: space(2),
            alignItems: 'flex-start',
            margin: 0,
            padding: `${String(space(2))}px ${String(space(3))}px`,
            background: 'rgba(124, 58, 237, 0.10)',
            borderRadius: radius.base,
            font: type(text.small, { leading: 1.5 }),
            color: '#4c1d95',
          }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 14,
              height: 10,
              marginTop: 4,
              background: DIFFERENCE_FILL,
              border: '1px solid #5b21b6',
              borderRadius: 2,
            }}
          />
          Purple on the map: {DIFFERENCE_LEGEND.toLowerCase()}, with the same {TOTAL_RAINFALL.toLowerCase()}.
        </p>
      )}

      <div>
        <p style={{ margin: 0, font: type(text.body, { weight: weight.semibold, leading: 1.45 }), color: ink.strong }}>
          {shown.finding}
        </p>
        <p style={{ margin: `${String(space(1))}px 0 0`, font: type(text.label, { leading: 1.55 }), color: ink.base }}>
          {shown.body}
        </p>
      </div>

      {/*
        AC 3.3.2.h and 3.1.3.f, beside the finding and never folded away.
        The measured reasons can wait behind a toggle; what the answer does
        not mean cannot.
      */}
      {noClearChange && (
        <p
          style={{
            margin: 0,
            padding: `${String(space(2))}px ${String(space(3))}px`,
            background: '#fbf6ea',
            borderLeft: '3px solid #c79a3a',
            borderRadius: radius.small,
            font: type(text.small, { leading: 1.5 }),
            color: '#4a3b17',
          }}
        >
          {NO_CLEAR_CHANGE_MEANS}
        </p>
      )}

      {/*
        A comparison that answers "nothing" and never says why reads as a
        product that did not work. It did work; the measurement is the
        finding, and it belongs beside the finding rather than in a footnote.
      */}
      {noClearChange && (
        <details>
          <summary style={{ cursor: 'pointer', color: brand.ink, font: type(text.small, { weight: weight.medium }) }}>
            Why this is usually the answer here
          </summary>
          <ul style={list}>
            {WHY_NO_CLEAR_CHANGE.map((item) => (
              <li key={item.title} style={{ marginBottom: space(2) }}>
                <strong style={{ color: ink.strong }}>{item.title}</strong>
                <br />
                {item.body}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p style={{ margin: 0, font: type(text.small, { leading: 1.5 }), color: ink.muted }}>{RESULT_DISCLAIMER}</p>

      {/*
        Grouped by where each value came from rather than by what it is about.
        AC 3.3.1.d: the drain is the council's, the settings are the person's,
        and the comparison is ours — and only the first is a fact about the
        world, while the last is a fact about them.
      */}
      <section
        aria-label="Your comparison"
        style={{
          padding: space(3),
          background: surface.sunken,
          border: `1px solid ${line.base}`,
          borderRadius: radius.base,
        }}
      >
        <span
          style={{
            display: 'block',
            marginBottom: space(2),
            font: type(text.micro, { weight: weight.semibold }),
            letterSpacing: tracking.caps,
            textTransform: 'uppercase',
            color: ink.subtle,
          }}
        >
          Your comparison
        </span>
        <dl style={{ display: 'grid', gap: space(1), margin: 0 }}>
          <Row basis="recorded" label="Selected drain" value={scenario.pitId === null ? '—' : `Drain ${scenario.pitId}`} />
          <Row basis="assumption" label="Drain condition" value={blockageTitle(scenario.blockage)} />
          <Row
            basis="assumption"
            label={TOTAL_RAINFALL}
            value={scenario.rainfallMm === null ? '—' : `${String(scenario.rainfallMm)} mm`}
          />
          <Row basis="derived" label="Comparison" value={shown.comparison} />
        </dl>
      </section>

      {positions.length > 1 && onRainfall && scenario.rainfallMm !== null && (
        <RainfallControl positions={positions} selectedMm={scenario.rainfallMm} onSelect={onRainfall} />
      )}

      <div style={{ display: 'grid', gap: space(2), justifyItems: 'start' }}>
        <button
          type="button"
          onClick={() => {
            setHowOpen((open) => !open);
          }}
          aria-expanded={howOpen}
          style={textLink}
        >
          How we calculated this
        </button>
        {howOpen && (
          <div style={{ font: type(text.small, { leading: 1.55 }), color: ink.base }}>
            <ol style={{ ...list, margin: 0 }}>
              {HOW_IT_WAS_PRODUCED.map((step) => (
                <li key={step.title} style={{ marginBottom: space(2) }}>
                  <strong style={{ color: ink.strong }}>{step.title}</strong>
                  <br />
                  {step.body}
                </li>
              ))}
            </ol>
            {/* AC 3.3.3: what is missing or uncertain, and how strongly to read the result. */}
            <p style={{ margin: `${String(space(3))}px 0 ${String(space(1))}px`, fontWeight: weight.semibold, color: ink.strong }}>
              What is missing or uncertain
            </p>
            <ul style={{ ...list, margin: 0 }}>
              {WHAT_IS_UNCERTAIN.map((item) =>
                /ground height/i.test(item.title) ? groundUncertainty(measuredShare) : item,
              ).map((item) => (
                <li key={item.title} style={{ marginBottom: space(2) }}>
                  <strong style={{ color: ink.strong }}>{item.title}</strong>
                  <br />
                  {item.body}
                </li>
              ))}
            </ul>
            <p style={{ margin: `${String(space(2))}px 0 0` }}>
              <strong style={{ color: ink.strong }}>How strongly to read this</strong>
              <br />
              {HOW_STRONGLY_TO_READ_IT}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setLimitsOpen((open) => !open);
          }}
          aria-expanded={limitsOpen}
          style={textLink}
        >
          What this result does not show
        </button>
        {limitsOpen && (
          <ul style={{ ...list, margin: 0, font: type(text.small, { leading: 1.55 }), color: ink.base }}>
            {LIMITATIONS.map((item) => (
              <li key={item} style={{ marginBottom: space(1) }}>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', gap: space(2), flexWrap: 'wrap' }}>
        {shown.actions.map((action, index) => (
          <button
            key={action}
            type="button"
            onClick={() => {
              onAction(action);
            }}
            style={{
              flex: '1 1 130px',
              padding: `${String(space(3))}px ${String(space(4))}px`,
              font: type(text.label, { weight: weight.semibold }),
              color: index === 0 ? ink.inverse : ink.strong,
              background: index === 0 ? brand.base : surface.raised,
              border: index === 0 ? 'none' : `1px solid ${line.strong}`,
              borderRadius: radius.base,
              cursor: 'pointer',
            }}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One value in the summary, with the name of where it came from beside it. */
function Row({
  basis,
  label,
  value,
}: {
  readonly basis: Basis;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: `${String(space(1))}px ${String(space(3))}px`,
        padding: `${String(space(1))}px ${String(space(2))}px`,
        background: surface.raised,
        borderRadius: radius.small,
      }}
    >
      <dt style={{ font: type(text.small), color: ink.muted }}>
        {label}{' '}
        <span
          style={{
            padding: '0 6px',
            borderRadius: radius.pill,
            font: type(text.micro, { weight: weight.medium }),
            ...BASIS_COLOURS[basis],
          }}
        >
          {BASIS_LABELS[basis]}
        </span>
      </dt>
      <dd style={{ margin: 0, font: type(text.label, { weight: weight.semibold }), color: ink.strong }}>{value}</dd>
    </div>
  );
}

/**
 * The total-rainfall control.
 *
 * Every position was solved by the run that produced this screen, so moving
 * this reads a cached answer rather than starting another calculation. That is
 * not only about speed: a control that re-solved could return a different
 * answer for the same input, and AC 3.2.1 requires that it cannot.
 *
 * Buttons rather than a slider, because these are the positions the engine
 * actually solved. A slider would imply a continuum between them that nothing
 * computed.
 */
function RainfallControl({
  positions,
  selectedMm,
  onSelect,
}: {
  readonly positions: readonly SolvedPosition[];
  readonly selectedMm: number;
  readonly onSelect: (rainfallMm: number) => void;
}) {
  return (
    <section aria-label={`Change the ${TOTAL_RAINFALL.toLowerCase()}`}>
      <span style={{ font: type(text.small, { weight: weight.semibold }), color: ink.strong }}>
        Try another {TOTAL_RAINFALL.toLowerCase()} amount
      </span>
      <div style={{ display: 'flex', gap: space(2), margin: `${String(space(2))}px 0` }}>
        {positions.map((position) => {
          const on = position.rainfallMm === selectedMm;
          return (
            <button
              key={position.rainfallMm}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onSelect(position.rainfallMm);
              }}
              style={{
                flex: 1,
                padding: `${String(space(2))}px ${String(space(1))}px`,
                font: type(text.label, { weight: on ? weight.bold : weight.medium }),
                color: on ? brand.ink : ink.strong,
                background: on ? brand.wash : surface.raised,
                border: `${on ? 2 : 1}px solid ${on ? brand.base : line.strong}`,
                borderRadius: radius.base,
                cursor: 'pointer',
              }}
            >
              {position.rainfallMm} mm
            </button>
          );
        })}
      </div>
      <p style={{ margin: 0, font: type(text.small, { leading: 1.5 }), color: ink.muted }}>{RAINFALL_CONTROL_NOTE}</p>
    </section>
  );
}

const list: React.CSSProperties = { margin: `${String(space(2))}px 0 0`, paddingLeft: space(5) };

const textLink: React.CSSProperties = {
  padding: 0,
  background: 'none',
  border: 'none',
  font: type(text.label, { weight: weight.medium }),
  color: brand.ink,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
};
