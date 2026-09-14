/**
 * Steps 2 and 3 of the blocked-drain comparison, and the wait between 3 and
 * the result: the panel beside the map.
 *
 * **Rebuilt on 15 September from the Blockage Flow prototype (C3a–C5).** The
 * screen it replaces was one column of four numbered sections — drain, setting,
 * rainfall, run — with a *Use this drain* confirmation on the first. Somebody
 * reading it was asked four questions at once, and could answer three of them
 * about an address the engine was always going to refuse. The drain is now
 * chosen on the map in step 1, the eligibility check runs before it, and this
 * panel only ever appears with a drain already chosen.
 *
 * Two sentences on this screen are not copy, they are AD13: the blockage
 * setting is not an observation of the drain, and DrainLens does not know
 * whether it is blocked now or how a blockage formed (AC 3.1.2.d). The rainfall
 * is labelled as an input and not a forecast the same way (AC 3.1.2.e). Both
 * start unchosen, because a pre-selected assumption is one the interface made
 * and the person carries without having agreed to it.
 */

import { useEffect, useState } from 'react';

import { type BlockageSetting, VALIDATED_RAINFALL_LEVELS_MM } from '@drainlens/schema';

import {
  COMPARING_STEPS,
  RAINFALL_EXPLAINED,
  REVIEW_DISCLAIMER,
  WHAT_IS_UNCERTAIN,
} from '../scenario/outcome.js';
import { aboutMetres } from '../scenario/eligibility.js';
import type { ScenarioInputs, SupportedAddress } from '../session.js';
import { missingScenarioInput } from '../session.js';
import { SOURCE, TOTAL_RAINFALL } from '../ui/terms.js';
import {
  basis,
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

/**
 * What each setting means, expressed against the clear setting.
 *
 * Not "50% blocked". The model has a capture fraction it assumes and no way to
 * measure a real blockage, so a percentage of blockage would be a physical
 * claim it cannot support. A share of the clear drain's intake is what the
 * calculation actually does.
 *
 * The titles are AC 3.1.2.b's words — *Clear*, *Partly blocked*, *Fully
 * blocked* — rather than the prototype's *Draining normally*, which is a
 * statement about how a real drain behaves and the one reading AC 3.1.2.d
 * rules out.
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
  VALIDATED_RAINFALL_LEVELS_MM.map((mm) => ({ label: `${String(mm)} mm`, mm }));

/** The label for a blockage setting, or a dash for none. */
export const blockageTitle = (setting: BlockageSetting | null): string =>
  setting === null ? '—' : (BLOCKAGE_OPTIONS.find((o) => o.setting === setting)?.title ?? '—');

export interface ChoicesProps {
  readonly scenario: ScenarioInputs;
  /** Metres from the address to the chosen drain, or null when opened from the full map. */
  readonly distanceM: number | null;
  readonly onBlockage: (blockage: BlockageSetting) => void;
  readonly onRainfall: (mm: number) => void;
  readonly onReview: () => void;
}

/** Step 2 of 3: the drain summary, then the condition and the rainfall, and nothing else. */
export function ScenarioChoices({ scenario, distanceM, onBlockage, onRainfall, onReview }: ChoicesProps) {
  const missing = missingScenarioInput(scenario);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const intake = WHAT_IS_UNCERTAIN[0];

  return (
    <div style={panelBody}>
      <StepBadge>Step 2 of 3</StepBadge>
      <h1 style={heading}>Choose what to compare</h1>

      <DrainSelected pitId={scenario.pitId} distanceM={distanceM} />

      <fieldset style={fieldset}>
        <legend style={question}>
          What drain condition do you want to test? <SettingTag />
        </legend>
        <div role="radiogroup" aria-label="Drain condition" style={{ display: 'grid', gap: space(2) }}>
          {BLOCKAGE_OPTIONS.map((option) => {
            const chosen = scenario.blockage === option.setting;
            return (
              <button
                key={option.setting}
                type="button"
                role="radio"
                aria-checked={chosen}
                onClick={() => {
                  onBlockage(option.setting);
                }}
                style={choiceCard(chosen)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: space(2) }}>
                  <Radio on={chosen} />
                  <strong style={{ font: type(text.label, { weight: weight.semibold }), color: ink.strong }}>
                    {option.title}
                  </strong>
                </span>
                <span style={{ display: 'block', marginTop: 2, font: type(text.small), color: ink.muted }}>
                  {option.detail}
                </span>
              </button>
            );
          })}
        </div>
        <p style={note}>{BLOCKAGE_IS_AN_ASSUMPTION}</p>
        {intake !== undefined && (
          <>
            <button
              type="button"
              aria-expanded={intakeOpen}
              onClick={() => {
                setIntakeOpen((open) => !open);
              }}
              style={link}
            >
              How the model estimates drain intake
            </button>
            {intakeOpen && <p style={note}>{intake.body}</p>}
          </>
        )}
      </fieldset>

      <fieldset style={fieldset}>
        <legend style={question}>
          Choose a {TOTAL_RAINFALL.toLowerCase()} amount <SettingTag />
        </legend>
        {/*
          Only once an amount is chosen. Before that this line said *Choose
          one amount to use for both drain settings* over `RAINFALL_EXPLAINED`
          saying the same thing, and the 15 September user test read both.
        */}
        {scenario.rainfallMm !== null && (
          <p style={{ ...note, margin: `0 0 ${String(space(2))}px` }}>
            Selected: {String(scenario.rainfallMm)} mm. Choose another amount to change it.
          </p>
        )}
        {/*
          The three validated levels and nothing else (AC 3.2.3.b). A number
          box sat above them until 13 September and accepted any amount,
          including 500 mm, which the engine then solved as if it had been
          checked.
        */}
        <div role="radiogroup" aria-label={TOTAL_RAINFALL} style={{ display: 'flex', gap: space(2) }}>
          {RAINFALL_PRESETS.map((preset) => {
            const on = scenario.rainfallMm === preset.mm;
            return (
              <button
                key={preset.mm}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  onRainfall(preset.mm);
                }}
                style={{
                  ...choiceCard(on),
                  flex: 1,
                  textAlign: 'center',
                  font: type(text.label, { weight: weight.semibold }),
                  color: on ? brand.ink : ink.strong,
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <p style={note}>{RAINFALL_EXPLAINED}</p>
      </fieldset>

      <button
        type="button"
        onClick={onReview}
        disabled={missing !== null}
        aria-describedby={missing === null ? undefined : 'choices-missing'}
        style={primary(missing === null)}
      >
        Review your choices
      </button>
      {missing !== null && (
        <p id="choices-missing" style={{ ...note, textAlign: 'center' }}>
          {missing === 'blockage' && scenario.rainfallMm === null
            ? 'Choose a drain condition and a rainfall amount to continue.'
            : missing === 'blockage'
              ? 'Choose a drain condition to continue.'
              : 'Choose a rainfall amount to continue.'}
        </p>
      )}
    </div>
  );
}

export interface ReviewProps {
  readonly address: SupportedAddress | null;
  readonly scenario: ScenarioInputs;
  readonly distanceM: number | null;
  readonly onRun: () => void;
  readonly onChange: () => void;
}

/**
 * Step 3 of 3: what will be compared, before it runs (AC 3.1.2.f).
 *
 * Each value carries where it came from, the same three names as the result:
 * the drain is the council's record and the other two are the person's.
 */
export function ScenarioReview({ address, scenario, distanceM, onRun, onChange }: ReviewProps) {
  return (
    <div style={panelBody}>
      <StepBadge>Step 3 of 3</StepBadge>
      <h1 style={heading}>Check your choices</h1>

      <dl style={summaryBox}>
        {address !== null && <SummaryRow label="Your address" value={address.label} />}
        <SummaryRow
          label="Selected drain"
          value={`Drain ${scenario.pitId ?? '—'}${distanceM === null ? '' : ` · about ${String(aboutMetres(distanceM))} m away`}`}
          source={SOURCE.recorded}
        />
        <SummaryRow label="Drain condition" value={blockageTitle(scenario.blockage)} source={SOURCE.setting} />
        <SummaryRow
          label={TOTAL_RAINFALL}
          value={scenario.rainfallMm === null ? '—' : `${String(scenario.rainfallMm)} mm`}
          source={SOURCE.setting}
        />
      </dl>

      <button type="button" onClick={onRun} style={primary(true)}>
        Show the difference
      </button>
      <p style={note}>{REVIEW_DISCLAIMER}</p>
      <button type="button" onClick={onChange} style={link}>
        ← Change my choices
      </button>
    </div>
  );
}

export interface ComparingProps {
  readonly blockage: BlockageSetting | null;
  readonly onCancel: () => void;
}

/**
 * The wait, with a way out.
 *
 * **The steps advance on a clock, and the last one waits for the answer.** The
 * worker does not report progress mid-solve, so the first two ticks are a
 * description of what the run is doing in the order it does it, not a
 * measurement; *Finding the difference* stays in progress until the reply
 * arrives, however long that takes. A bar that reached the end before the
 * answer would be the one false thing on this panel.
 *
 * Cancel returns to the review. The run cannot be stopped inside the worker,
 * so its answer is dropped when it comes (`Session.run`).
 */
export function Comparing({ blockage, onCancel }: ComparingProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((at) => Math.min(at + 1, COMPARING_STEPS.length - 1));
    }, 700);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const condition = blockageTitle(blockage).toLowerCase();

  return (
    <div style={panelBody} aria-busy="true">
      <StepBadge>Step 3 of 3</StepBadge>
      <h1 style={heading} role="status">
        Calculating the difference…
      </h1>
      <p style={{ margin: 0, font: type(text.label, { leading: 1.55 }), color: ink.muted }}>
        We’re running the same rainfall twice: first with every drain clear, then with this drain{' '}
        {condition}.
      </p>
      <div
        role="progressbar"
        aria-label="Comparison progress"
        aria-valuemin={0}
        aria-valuemax={COMPARING_STEPS.length}
        aria-valuenow={tick}
        style={{ height: 6, borderRadius: radius.pill, background: surface.sunken, overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${String(((tick + 0.5) / COMPARING_STEPS.length) * 100)}%`,
            height: '100%',
            background: brand.base,
            transition: 'width 600ms ease',
          }}
        />
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: space(2) }}>
        {COMPARING_STEPS.map((label, index) => (
          <li
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space(2),
              font: type(text.label),
              color: index <= tick ? ink.strong : ink.subtle,
            }}
          >
            <span aria-hidden style={{ width: 14, textAlign: 'center', color: brand.base }}>
              {index < tick ? '✓' : index === tick ? '◐' : '○'}
            </span>
            {label}
            <span style={visuallyHidden}>{index < tick ? ' (done)' : index === tick ? ' (in progress)' : ''}</span>
          </li>
        ))}
      </ol>
      <p style={note}>The result will keep your address, the selected drain and any change the model finds in view.</p>
      <button type="button" onClick={onCancel} style={secondary}>
        Cancel
      </button>
    </div>
  );
}

/** "Drain selected", with how far it is and how to change it. */
function DrainSelected({ pitId, distanceM }: { readonly pitId: string | null; readonly distanceM: number | null }) {
  return (
    <div
      style={{
        padding: `${String(space(3))}px ${String(space(3))}px`,
        background: brand.tint,
        borderRadius: radius.base,
        font: type(text.small, { leading: 1.5 }),
        color: brand.ink,
      }}
    >
      <strong style={{ display: 'block', font: type(text.label, { weight: weight.semibold }), color: brand.ink }}>
        <span aria-hidden>✓ </span>Drain selected
      </strong>
      {distanceM === null ? 'Chosen on the full map' : `About ${String(aboutMetres(distanceM))} m from your address`}
      {pitId === null ? '' : ` · ID ${pitId}`}
      <br />
      Select another drain on the map to change it
    </div>
  );
}

function SummaryRow({ label, value, source }: { readonly label: string; readonly value: string; readonly source?: string }) {
  return (
    <div style={{ padding: `${String(space(2))}px ${String(space(3))}px`, background: surface.raised, borderRadius: radius.small }}>
      <dt
        style={{
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
          color: ink.subtle,
        }}
      >
        {label}
        {source !== undefined && (
          <span style={{ marginLeft: space(2), textTransform: 'none', letterSpacing: 0, fontWeight: weight.regular }}>
            · {source}
          </span>
        )}
      </dt>
      <dd style={{ margin: 0, font: type(text.label, { weight: weight.semibold }), color: ink.strong }}>{value}</dd>
    </div>
  );
}

export function StepBadge({ children }: { readonly children: React.ReactNode }) {
  return (
    <span
      style={{
        alignSelf: 'flex-start',
        padding: `${String(space(1))}px ${String(space(3))}px`,
        borderRadius: radius.pill,
        background: brand.tint,
        color: brand.ink,
        font: type(text.micro, { weight: weight.semibold }),
        letterSpacing: tracking.caps,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

/** "Your setting", beside each question whose answer is an assumption (AC 3.1.2.d, e). */
function SettingTag() {
  return (
    <span
      style={{
        marginLeft: space(1),
        padding: '1px 7px',
        borderRadius: radius.pill,
        background: basis.assumed.fill,
        color: basis.assumed.ink,
        font: type(text.micro, { weight: weight.medium }),
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
      }}
    >
      {SOURCE.setting}
    </span>
  );
}

function Radio({ on }: { readonly on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 12,
        height: 12,
        flexShrink: 0,
        borderRadius: radius.pill,
        border: `2px solid ${on ? brand.base : ink.base}`,
        boxShadow: on ? `inset 0 0 0 2px ${surface.raised}` : 'none',
        background: on ? brand.base : surface.raised,
      }}
    />
  );
}

const panelBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space(4),
  padding: `${String(space(5))}px ${String(space(6))}px ${String(space(10))}px`,
};

const heading: React.CSSProperties = {
  margin: 0,
  font: type(text.title, { weight: weight.semibold, leading: 1.25 }),
  letterSpacing: tracking.title,
  color: ink.strong,
};

const question: React.CSSProperties = {
  padding: 0,
  marginBottom: space(2),
  font: type(text.body, { weight: weight.semibold, leading: 1.35 }),
  color: ink.strong,
};

const fieldset: React.CSSProperties = { margin: 0, padding: 0, border: 'none', minWidth: 0 };

const note: React.CSSProperties = {
  margin: `${String(space(2))}px 0 0`,
  font: type(text.small, { leading: 1.5 }),
  color: ink.muted,
};

const link: React.CSSProperties = {
  alignSelf: 'flex-start',
  marginTop: space(2),
  padding: 0,
  background: 'none',
  border: 'none',
  font: type(text.small, { weight: weight.medium }),
  color: brand.ink,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
};

const choiceCard = (chosen: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  padding: `${String(space(2))}px ${String(space(3))}px`,
  textAlign: 'left',
  background: chosen ? brand.wash : surface.raised,
  border: `${chosen ? 2 : 1}px solid ${chosen ? brand.base : line.strong}`,
  borderRadius: radius.base,
  cursor: 'pointer',
});

const primary = (enabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: `${String(space(3))}px ${String(space(4))}px`,
  font: type(text.body, { weight: weight.semibold }),
  color: ink.inverse,
  background: brand.base,
  border: 'none',
  borderRadius: radius.base,
  opacity: enabled ? 1 : 0.45,
  cursor: enabled ? 'pointer' : 'not-allowed',
});

const secondary: React.CSSProperties = {
  width: '100%',
  padding: `${String(space(3))}px ${String(space(4))}px`,
  font: type(text.body, { weight: weight.semibold }),
  color: ink.strong,
  background: surface.raised,
  border: `1px solid ${line.strong}`,
  borderRadius: radius.base,
  cursor: 'pointer',
};

const summaryBox: React.CSSProperties = {
  display: 'grid',
  gap: space(2),
  margin: 0,
  padding: space(3),
  background: surface.sunken,
  border: `1px solid ${line.base}`,
  borderRadius: radius.base,
};

const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};
