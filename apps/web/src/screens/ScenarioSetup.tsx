/**
 * Setting up a comparison: a pit, an assumption, an amount of rain.
 *
 * Two sentences on this screen are not copy, they are AD13, and the tests hold
 * them: the blockage setting is an assumption rather than an observation of
 * the pit's condition, and this model does not calculate when or how quickly a
 * blockage forms. The teacher's question about deposit rates is answered here,
 * on the screen, rather than in a document nobody reading the result will open.
 *
 * The blockage starts unchosen. A pre-selected assumption is one the interface
 * made and the person carries without ever having agreed to it, which is why
 * AC 2.1.1 asks for it and why `EMPTY_SCENARIO.blockage` is null.
 */

import type { BlockageSetting } from '@drainlens/schema';

import type { ScenarioInputs, SupportedAddress } from '../session.js';
import { missingScenarioInput } from '../session.js';

/**
 * What each setting means, expressed against the all-clear baseline.
 *
 * Not "50% blocked". The model has a capture fraction it assumes and no way to
 * measure a real blockage, so a percentage of blockage would be a physical
 * claim it cannot support. A share of the baseline capture is what the
 * calculation actually does.
 */
export const BLOCKAGE_OPTIONS: readonly {
  readonly setting: BlockageSetting;
  readonly title: string;
  readonly detail: string;
}[] = [
  { setting: 'clear', title: 'Clear', detail: '100% of the all-clear baseline capture' },
  { setting: 'partly-blocked', title: 'Partly blocked', detail: '50% of the all-clear baseline capture' },
  { setting: 'fully-blocked', title: 'Fully blocked', detail: 'No capture at this pit' },
];

/** AD13, both statements, as the interface must be able to quote them. */
export const BLOCKAGE_IS_AN_ASSUMPTION =
  'These settings are scenario assumptions, not observations of the drainage pit’s current condition. The selected setting stays the same throughout the comparison, and DrainLens does not calculate when or how quickly a blockage forms.';

export const RAINFALL_IS_AN_ASSUMPTION =
  'This is a user-selected comparison amount, not a rainfall observation or forecast.';

export const RAINFALL_PRESETS: readonly { readonly label: string; readonly mm: number }[] = [
  { label: 'Lower comparison amount', mm: 20 },
  { label: 'Middle comparison amount', mm: 40 },
  { label: 'Higher comparison amount', mm: 60 },
];

export interface ScenarioSetupProps {
  readonly address: SupportedAddress;
  readonly scenario: ScenarioInputs;
  readonly suggestedPitId: string | null;
  readonly onUsePit: (pitId: string, suggested: boolean) => void;
  readonly onBlockage: (blockage: BlockageSetting) => void;
  readonly onRainfall: (mm: number) => void;
  readonly onRun: () => void;
  readonly onReset: () => void;
}

export function ScenarioSetup({
  address,
  scenario,
  suggestedPitId,
  onUsePit,
  onBlockage,
  onRainfall,
  onRun,
  onReset,
}: ScenarioSetupProps) {
  const missing = missingScenarioInput(scenario);
  const steps = [
    { n: 1, label: 'Select a drainage pit', done: scenario.pitId !== null },
    { n: 2, label: 'Choose a blockage assumption', done: scenario.blockage !== null },
    { n: 3, label: 'Choose accumulated rainfall', done: true },
    { n: 4, label: 'Run comparison', done: false },
  ];

  return (
    <div style={{ padding: '18px 20px 40px', maxWidth: 420 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>Compare a local drain-blockage scenario</h1>
      <p style={{ margin: '0 0 8px', color: '#4d5f6e', fontSize: 14 }}>
        Choose one nearby drain, a blockage assumption, and an accumulated rainfall amount.
      </p>
      <p style={{ margin: '0 0 18px', color: '#6b7a88', fontSize: 13 }}>
        <span aria-hidden>◎ </span>
        {address.label}
      </p>

      <ol
        style={{
          display: 'flex',
          gap: 10,
          listStyle: 'none',
          margin: '0 0 20px',
          padding: 0,
          fontSize: 11,
          color: '#6b7a88',
        }}
      >
        {steps.map((step) => (
          <li key={step.n} style={{ flex: 1, textAlign: 'center' }}>
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 22,
                height: 22,
                margin: '0 auto 4px',
                borderRadius: '50%',
                background: step.done ? '#1f6f5c' : '#e6ebe4',
                color: step.done ? '#ffffff' : '#6b7a88',
              }}
            >
              {step.done ? '✓' : step.n}
            </span>
            {step.label}
          </li>
        ))}
      </ol>

      <Section n={1} title="Selected drain">
        {scenario.pitId === null ? (
          suggestedPitId === null ? (
            <p style={{ margin: 0, color: '#6b7a88' }}>
              Select a drainage pit on the map to set the scenario drain.
            </p>
          ) : (
            <>
              <strong>Pit {suggestedPitId}</strong>
              <p
                style={{
                  margin: '8px 0 0',
                  padding: '9px 11px',
                  background: '#fdf7e3',
                  border: '1px solid #f0e4bd',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                This is a suggested nearby drain, not your choice yet.
                <button
                  type="button"
                  onClick={() => onUsePit(suggestedPitId, true)}
                  style={primary({ marginTop: 8, display: 'block' })}
                >
                  Use this drain
                </button>
              </p>
            </>
          )
        ) : (
          <>
            <strong>Pit {scenario.pitId}</strong>
            <p style={{ margin: '4px 0 0', color: '#6b7a88', fontSize: 13 }}>
              {scenario.pitWasSuggested
                ? 'Suggested nearby drain, confirmed by you.'
                : 'Selected on the map.'}{' '}
              Select a different pit on the map to change it.
            </p>
          </>
        )}
      </Section>

      <Section n={2} title="Blockage assumption">
        <div style={{ display: 'flex', gap: 8 }}>
          {BLOCKAGE_OPTIONS.map((option) => {
            const chosen = scenario.blockage === option.setting;
            return (
              <button
                key={option.setting}
                type="button"
                aria-pressed={chosen}
                onClick={() => onBlockage(option.setting)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  textAlign: 'left',
                  background: chosen ? '#eaf4f0' : '#ffffff',
                  border: `1px solid ${chosen ? '#1f6f5c' : '#d5ded2'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <strong style={{ display: 'block', fontSize: 13 }}>{option.title}</strong>
                <span style={{ fontSize: 11, color: '#6b7a88' }}>{option.detail}</span>
              </button>
            );
          })}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7a88' }}>
          {BLOCKAGE_IS_AN_ASSUMPTION}
        </p>
      </Section>

      <Section n={3} title="Total accumulated rainfall">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <input
            type="number"
            min={0}
            value={scenario.rainfallMm}
            onChange={(event) => onRainfall(Number(event.target.value))}
            aria-label="Accumulated rainfall in millimetres"
            style={{
              width: 90,
              padding: '9px 11px',
              border: '1px solid #d5ded2',
              borderRadius: 8,
              font: 'inherit',
            }}
          />
          <span style={{ color: '#6b7a88' }}>mm</span>
        </div>
        {RAINFALL_PRESETS.map((preset) => (
          <button
            key={preset.mm}
            type="button"
            onClick={() => onRainfall(preset.mm)}
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              padding: '9px 11px',
              marginBottom: 6,
              background: scenario.rainfallMm === preset.mm ? '#eaf4f0' : '#ffffff',
              border: `1px solid ${scenario.rainfallMm === preset.mm ? '#1f6f5c' : '#e6ebe4'}`,
              borderRadius: 8,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <span>{preset.label}</span>
            <strong>{preset.mm} mm</strong>
          </button>
        ))}
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7a88' }}>
          {RAINFALL_IS_AN_ASSUMPTION}
        </p>
      </Section>

      <section
        style={{
          margin: '20px 0 0',
          padding: 14,
          background: '#f6f8f4',
          border: '1px solid #e6ebe4',
          borderRadius: 10,
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: 0.6, color: '#8593a0' }}>SCENARIO SUMMARY</span>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 12px',
            margin: '8px 0 0',
            fontSize: 13,
          }}
        >
          <Pair label="Drain" value={scenario.pitId === null ? 'Not chosen' : `Pit ${scenario.pitId}`} />
          <Pair
            label="Blockage assumption"
            value={
              scenario.blockage === null
                ? 'Not chosen'
                : (BLOCKAGE_OPTIONS.find((o) => o.setting === scenario.blockage)?.title ?? '')
            }
          />
          <Pair label="Rainfall" value={`${scenario.rainfallMm} mm`} />
          <Pair label="Local area" value="Around selected drain" />
        </dl>
      </section>

      {missing !== null && (
        <p role="status" style={{ margin: '12px 0 0', color: '#a3492f', fontSize: 13 }}>
          <span aria-hidden>⚠ </span>
          {missing === 'pit'
            ? 'Select a drainage pit to compare.'
            : 'Choose a blockage assumption to compare.'}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button type="button" onClick={onRun} disabled={missing !== null} style={primary({ flex: 1, opacity: missing === null ? 1 : 0.5 })}>
          → Run comparison
        </button>
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: '11px 16px',
            background: '#ffffff',
            border: '1px solid #d5ded2',
            borderRadius: 8,
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          Reset choices
        </button>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>
        {n}. {title}
      </h2>
      {children}
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

const primary = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  padding: '11px 18px',
  fontWeight: 600,
  color: '#ffffff',
  background: '#1f6f5c',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  font: 'inherit',
  ...extra,
});
