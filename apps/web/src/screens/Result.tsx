/**
 * The result: one map, one finding, and what it is not.
 *
 * AD7. There is no all-clear view and no blockage view to switch between —
 * only the difference between them. Two of the three views would be absolute
 * water depths, which this model does not compute and must not appear to.
 *
 * The insufficient states share this shell rather than living somewhere else,
 * because they are results too: the person asked a question and this is the
 * answer. What differs is that the summary says the comparison was not made,
 * the map draws no difference, and the way out is the one that can help.
 */

import { useState } from 'react';

import {
  ACTION_LABELS,
  type Action,
  BASIS_COLOURS,
  BASIS_LABELS,
  type Basis,
  HOW_IT_WAS_PRODUCED,
  type Outcome,
  RAINFALL_CONTROL_NOTE,
  RESULT_DISCLAIMER,
  WHAT_IS_UNCERTAIN,
  WHY_NO_CLEAR_CHANGE,
  presentationFor,
} from '../scenario/outcome.js';
import type { SolvedPosition } from '../scenario/worker.js';
import { BLOCKAGE_OPTIONS } from './ScenarioSetup.js';
import type { ScenarioInputs } from '../session.js';

export interface ResultProps {
  readonly outcome: Outcome;
  readonly scenario: ScenarioInputs;
  /** Positions this run already solved. Empty when there was no comparison. */
  readonly positions?: readonly SolvedPosition[];
  /** Reads the cache above; never starts another solve. */
  readonly onRainfall?: (rainfallMm: number) => void;
  readonly onAction: (action: Action) => void;
}

export function Result({
  outcome,
  scenario,
  positions = [],
  onRainfall,
  onAction,
}: ResultProps) {
  const shown = presentationFor(outcome);
  const [howOpen, setHowOpen] = useState(false);
  const [uncertainOpen, setUncertainOpen] = useState(false);

  const blockage =
    scenario.blockage === null
      ? '—'
      : (BLOCKAGE_OPTIONS.find((o) => o.setting === scenario.blockage)?.title ?? '—');

  return (
    <div style={{ padding: '18px 20px 40px', maxWidth: 420 }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>{shown.title}</h1>

      <p
        style={{
          margin: '0 0 14px',
          padding: '10px 12px',
          background: shown.showsDifference ? '#eaf1f7' : '#f4f6f2',
          borderRadius: 8,
          fontSize: 13,
          color: '#3d5265',
        }}
      >
        {shown.showsDifference
          ? 'Highlighted areas show where the selected blockage assumption leaves more surface water than the all-clear baseline, at the same accumulated rainfall.'
          : 'No difference is drawn on the map for this result.'}
      </p>

      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7a88' }}>{RESULT_DISCLAIMER}</p>

      <section
        style={{
          padding: 14,
          border: '1px solid #e6ebe4',
          borderRadius: 10,
          background: '#ffffff',
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: 0.6, color: '#8593a0' }}>{shown.band}</span>
        <h2 style={{ margin: '4px 0 8px', fontSize: 17 }}>{shown.finding}</h2>
        <p style={{ margin: 0, color: '#4d5f6e', fontSize: 14 }}>{shown.body}</p>

        {/*
          A comparison that answers "nothing" and never says why reads as a
          product that did not work. It did work; the measurement is the
          finding, and it belongs beside the finding rather than in a footnote.
        */}
        {outcome.status === 'successful' && outcome.band === 'no-clear-change' && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', color: '#1f6f5c', fontSize: 13 }}>
              Why this is usually the answer here
            </summary>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: '#4d5f6e' }}>
              {WHY_NO_CLEAR_CHANGE.map((item) => (
                <li key={item.title} style={{ marginBottom: 6 }}>
                  <strong style={{ color: '#1e2b36' }}>{item.title}</strong>
                  <br />
                  {item.body}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/*
        Grouped by where each value came from rather than by what it is about.
        AC 2.3.1.c (Aug-27 set): the drain is the council's, the settings are the person's,
        and the comparison is ours — and only the first is a fact about the
        world, while the last is a fact about them.
      */}
      <Group basis="recorded">
        <Pair label="Selected drain" value={scenario.pitId === null ? '—' : `Pit ${scenario.pitId}`} />
      </Group>
      <Group basis="assumption">
        <Pair label="Blockage assumption" value={blockage} />
        <Pair label="Accumulated rainfall" value={`${scenario.rainfallMm} mm`} />
      </Group>
      <Group basis="derived">
        <Pair label="Comparison" value={shown.comparison} />
      </Group>

      {positions.length > 1 && onRainfall && (
        <RainfallControl
          positions={positions}
          selectedMm={scenario.rainfallMm}
          onSelect={onRainfall}
        />
      )}

      <button
        type="button"
        onClick={() => setHowOpen((open) => !open)}
        aria-expanded={howOpen}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          color: '#1f6f5c',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        How this result was produced
      </button>

      {howOpen && (
        <ol style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 13, color: '#4d5f6e' }}>
          {HOW_IT_WAS_PRODUCED.map((step) => (
            <li key={step.title} style={{ marginBottom: 8 }}>
              <strong style={{ color: '#1e2b36' }}>{step.title}</strong>
              <br />
              {step.body}
            </li>
          ))}
        </ol>
      )}

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={() => setUncertainOpen((open) => !open)}
          aria-expanded={uncertainOpen}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            color: '#1f6f5c',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          What is missing or uncertain
        </button>

        {uncertainOpen && (
          <ul style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 13, color: '#4d5f6e' }}>
            {WHAT_IS_UNCERTAIN.map((item) => (
              <li key={item.title} style={{ marginBottom: 8 }}>
                <strong style={{ color: '#1e2b36' }}>{item.title}</strong>
                <br />
                {item.body}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p
        style={{
          margin: '18px 0 8px',
          fontSize: 11,
          letterSpacing: 0.6,
          color: '#8593a0',
        }}
      >
        WHAT WOULD YOU LIKE TO DO NEXT?
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {shown.actions.map((action, index) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            style={{
              flex: '1 1 140px',
              padding: '11px 16px',
              fontWeight: 600,
              color: index === 0 ? '#ffffff' : '#1f6f5c',
              background: index === 0 ? '#1f6f5c' : '#ffffff',
              border: index === 0 ? 'none' : '1px solid #bcd3c9',
              borderRadius: 8,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A block of values that share one basis.
 *
 * The badge is the point. Grouping is what lets one badge speak for several
 * values instead of repeating itself beside each of them, and a value that
 * cannot say where it came from has nowhere to sit on this screen at all.
 */
function Group({ basis, children }: { readonly basis: Basis; readonly children: React.ReactNode }) {
  return (
    <section
      style={{
        margin: '0 0 10px',
        padding: 14,
        background: '#f6f8f4',
        border: '1px solid #e6ebe4',
        borderRadius: 10,
        fontSize: 13,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          marginBottom: 10,
          padding: '1px 7px',
          borderRadius: 999,
          fontSize: 11,
          ...BASIS_COLOURS[basis],
        }}
      >
        {BASIS_LABELS[basis]}
      </span>
      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', margin: 0 }}>
        {children}
      </dl>
    </section>
  );
}

/**
 * The accumulated-rainfall control.
 *
 * Every position was solved by the run that produced this screen, so moving
 * this reads a cached answer rather than starting another calculation. That is
 * not only about speed: a control that re-solved could return a different
 * answer for the same input, and AC 2.2 requires that it cannot.
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
    <section
      style={{
        margin: '0 0 14px',
        padding: 14,
        border: '1px solid #e6ebe4',
        borderRadius: 10,
        background: '#ffffff',
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: 0.6, color: '#8593a0' }}>
        ACCUMULATED RAINFALL
      </span>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
        {positions.map((position) => {
          const on = position.rainfallMm === selectedMm;
          return (
            <button
              key={position.rainfallMm}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(position.rainfallMm)}
              style={{
                flex: 1,
                padding: '9px 6px',
                fontWeight: on ? 700 : 500,
                color: on ? '#ffffff' : '#1f6f5c',
                background: on ? '#1f6f5c' : '#ffffff',
                border: on ? 'none' : '1px solid #bcd3c9',
                borderRadius: 8,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {position.rainfallMm} mm
            </button>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#6b7a88' }}>{RAINFALL_CONTROL_NOTE}</p>
    </section>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <dt style={{ fontSize: 11, letterSpacing: 0.4, color: '#8593a0', margin: 0 }}>
        {label.toUpperCase()}
      </dt>
      <dd style={{ margin: 0, fontWeight: 600 }}>{value}</dd>
    </span>
  );
}
