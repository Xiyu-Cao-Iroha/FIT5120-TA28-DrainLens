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
  HOW_IT_WAS_PRODUCED,
  type Outcome,
  RESULT_DISCLAIMER,
  presentationFor,
} from '../scenario/outcome.js';
import { BLOCKAGE_OPTIONS } from './ScenarioSetup.js';
import type { ScenarioInputs } from '../session.js';

export interface ResultProps {
  readonly outcome: Outcome;
  readonly scenario: ScenarioInputs;
  readonly onAction: (action: Action) => void;
}

export function Result({ outcome, scenario, onAction }: ResultProps) {
  const shown = presentationFor(outcome);
  const [howOpen, setHowOpen] = useState(false);

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
      </section>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px 12px',
          margin: '0 0 14px',
          padding: 14,
          background: '#f6f8f4',
          border: '1px solid #e6ebe4',
          borderRadius: 10,
          fontSize: 13,
        }}
      >
        <Pair label="Accumulated rainfall" value={`${scenario.rainfallMm} mm`} />
        <Pair label="Selected drain" value={scenario.pitId === null ? '—' : `Pit ${scenario.pitId}`} />
        <Pair label="Blockage assumption" value={blockage} />
        <Pair label="Comparison" value={shown.comparison} />
      </dl>

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
