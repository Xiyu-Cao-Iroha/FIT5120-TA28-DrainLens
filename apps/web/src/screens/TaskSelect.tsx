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

import type { Task } from '../session.js';
import type { SupportedAddress } from '../session.js';

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
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ color: '#4d5f6e' }}>
          <span aria-hidden>◎ </span>
          {address.label}
        </span>
        <button
          type="button"
          onClick={onChangeAddress}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: '#1f6f5c',
            cursor: 'pointer',
            font: 'inherit',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Change address
        </button>
      </div>

      <h1 style={{ margin: '16px 0 8px', fontSize: 28 }}>What would you like to understand?</h1>
      <p style={{ margin: '0 0 24px', color: '#4d5f6e' }}>
        Choose a task to see the most relevant information first. You can change tasks or open
        other map layers at any time.
      </p>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {GUIDED.map((option) => (
          <section
            key={option.task}
            style={{
              padding: 18,
              background: '#ffffff',
              border: '1px solid #e6ebe4',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: 17 }}>{option.title}</h2>
            <p style={{ margin: '0 0 18px', color: '#4d5f6e', fontSize: 14, flex: 1 }}>
              {option.body}
            </p>
            <button
              type="button"
              onClick={() => onChoose(option.task)}
              style={{
                padding: '10px 16px',
                fontWeight: 600,
                color: '#ffffff',
                background: '#1f6f5c',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              → {option.action}
            </button>
          </section>
        ))}
      </div>

      <p
        style={{
          margin: '28px 0 10px',
          fontSize: 12,
          letterSpacing: 0.8,
          color: '#8593a0',
          textTransform: 'uppercase',
        }}
      >
        Or explore on your own
      </p>
      <section
        style={{
          padding: 18,
          background: '#ffffff',
          border: '1px solid #e6ebe4',
          borderRadius: 12,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ flex: '1 1 260px' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 17 }}>
            Explore the full map{' '}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                padding: '2px 8px',
                borderRadius: 999,
                background: '#eef1ec',
                color: '#6b7a88',
                verticalAlign: 'middle',
              }}
            >
              No guided steps
            </span>
          </h2>
          <span style={{ color: '#4d5f6e', fontSize: 14 }}>
            View all available terrain, surface-water and drainage information at once, without a
            guided task.
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChoose('full-map')}
          style={{
            padding: '10px 16px',
            fontWeight: 600,
            color: '#1f6f5c',
            background: '#ffffff',
            border: '1px solid #bcd3c9',
            borderRadius: 8,
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          → Open full map
        </button>
      </section>
    </div>
  );
}
