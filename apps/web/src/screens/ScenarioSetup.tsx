/**
 * Setting up a comparison: a pit, a drain setting, an amount of rain.
 *
 * Two sentences on this screen are not copy, they are AD13: the blockage
 * setting is not an observation of the drain, and DrainLens does not know
 * whether it is blocked now or how a blockage formed. The teacher's question about deposit rates is answered here,
 * on the screen, rather than in a document nobody reading the result will open.
 *
 * The blockage starts unchosen. A pre-selected assumption is one the interface
 * made and the person carries without ever having agreed to it, which is why
 * AC 2.1.1 (Aug-27 set) asks for it and why `EMPTY_SCENARIO.blockage` is null.
 */

import { type BlockageSetting, VALIDATED_RAINFALL_LEVELS_MM } from '@drainlens/schema';

import { RAINFALL_EXPLAINED } from '../scenario/outcome.js';
import { SUPPORT_LEGEND } from '../scenario/support.js';
import type { ScenarioInputs, SupportedAddress } from '../session.js';
import { missingScenarioInput } from '../session.js';
import { TOTAL_RAINFALL } from '../ui/terms.js';

/**
 * What each setting means, expressed against the clear setting.
 *
 * Not "50% blocked". The model has a capture fraction it assumes and no way to
 * measure a real blockage, so a percentage of blockage would be a physical
 * claim it cannot support. A share of the clear drain's intake is what the
 * calculation actually does.
 */
export const BLOCKAGE_OPTIONS: readonly {
  readonly setting: BlockageSetting;
  readonly title: string;
  readonly detail: string;
}[] = [
  { setting: 'clear', title: 'Clear', detail: 'Uses the model’s normal drain setting' },
  { setting: 'partly-blocked', title: 'Partly blocked', detail: 'Takes half as much water as the clear setting' },
  { setting: 'fully-blocked', title: 'Fully blocked', detail: 'Takes no surface water at this pit' },
];

/** AD13, both statements, as the interface must be able to quote them. */
export const BLOCKAGE_IS_AN_ASSUMPTION =
  'These are settings for the comparison, not observations of the drain. DrainLens does not know whether the drain is blocked now or how a blockage formed.';

/**
 * The validated levels, labelled. The amounts come from the schema so the
 * buttons and the check the session applies cannot drift apart.
 */
export const RAINFALL_PRESETS: readonly { readonly label: string; readonly mm: number }[] =
  VALIDATED_RAINFALL_LEVELS_MM.map((mm) => ({
    label: `${String(mm)} mm ${TOTAL_RAINFALL.toLowerCase()}`,
    mm,
  }));

export interface ScenarioSetupProps {
  /** Null when the comparison was opened on a drain from the map. */
  readonly address: SupportedAddress | null;
  /** Why the drain last tapped on the map cannot be compared, or null. */
  readonly refusal?: string | null;
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
  refusal = null,
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
    { n: 2, label: 'Choose how blocked it is', done: scenario.blockage !== null },
    { n: 3, label: 'Choose total rainfall', done: true },
    { n: 4, label: 'Run comparison', done: false },
  ];

  return (
    <div style={{ padding: '18px 20px 40px', maxWidth: 420 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>What changes if a drain is blocked</h1>
      <p style={{ margin: '0 0 8px', color: '#4d5f6e', fontSize: 14 }}>
        Choose a nearby drain, how blocked it is, and a total rainfall amount.
      </p>
      <p style={{ margin: '0 0 18px', color: '#6b7a88', fontSize: 13 }}>
        <span aria-hidden>◎ </span>
        {address === null ? 'A drain chosen on the map' : address.label}
      </p>

      {/* AC 3.1.1.a, d and e: which drains can be compared, before choosing. */}
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#5b6e7e' }}>
        <span aria-hidden style={{ color: '#0f8b8d' }}>◯ </span>
        {SUPPORT_LEGEND}
      </p>
      {refusal !== null && (
        <p role="status" style={{ margin: '0 0 14px', padding: '8px 10px', background: '#f4f6f2', borderRadius: 6, fontSize: 12, color: '#4d5f6e' }}>
          {refusal}
        </p>
      )}

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

      <Section n={1} title="Drain">
        {scenario.pitId === null ? (
          suggestedPitId === null ? (
            <p style={{ margin: 0, color: '#6b7a88' }}>
              Select a drainage pit on the map to choose the drain.
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

      <Section n={2} title="Drain setting">
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

      <Section n={3} title={TOTAL_RAINFALL}>
        {/*
          The three validated levels and nothing else (AC 3.2.3.b). A number
          box sat above them until 13 September and accepted any amount,
          including 500 mm, which the engine then solved as if it had been
          checked.
        */}
        {RAINFALL_PRESETS.map((preset) => (
          <button
            key={preset.mm}
            type="button"
            onClick={() => onRainfall(preset.mm)}
            style={{
              display: 'flex',
              width: '100%',
              padding: '9px 11px',
              marginBottom: 6,
              background: scenario.rainfallMm === preset.mm ? '#eaf4f0' : '#ffffff',
              border: `1px solid ${scenario.rainfallMm === preset.mm ? '#1f6f5c' : '#e6ebe4'}`,
              borderRadius: 8,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            {preset.label}
          </button>
        ))}
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7a88' }}>{RAINFALL_EXPLAINED}</p>
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
        <span style={{ fontSize: 12, fontWeight: 600, color: '#5b6e7e' }}>Comparison summary</span>
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
            label="Drain setting"
            value={
              scenario.blockage === null
                ? 'Not chosen'
                : (BLOCKAGE_OPTIONS.find((o) => o.setting === scenario.blockage)?.title ?? '')
            }
          />
          <Pair label={TOTAL_RAINFALL} value={`${scenario.rainfallMm} mm`} />
          <Pair label="Area compared" value="Around the chosen drain" />
        </dl>
      </section>

      {missing !== null && (
        <p role="status" style={{ margin: '12px 0 0', color: '#a3492f', fontSize: 13 }}>
          <span aria-hidden>⚠ </span>
          {missing === 'pit'
            ? 'Select a drainage pit to compare.'
            : 'Choose how blocked the drain is to compare.'}
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
      <dt style={{ fontSize: 12, color: '#6b7a88', margin: 0 }}>{label}</dt>
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
