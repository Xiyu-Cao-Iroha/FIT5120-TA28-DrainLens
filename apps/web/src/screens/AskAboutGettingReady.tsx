/**
 * *Ask about getting ready* — the panel, and only the panel.
 *
 * Epic 5's assistant, from the team's Figma (file `atD5fleOrhvMjJ5m0pXYGt`,
 * *Epic 5 · AI: Ask about getting ready*, Q0 to Q5). Everything it is allowed
 * to say is in `ask/answers.ts` and everything it decides is in
 * `ask/respond.ts`; this file puts those on the screen and holds the
 * conversation in one piece of React state that nothing reads but the screen.
 *
 * **Nothing leaves the browser.** No request is made, no key is written, and
 * the address is not attached to anything here — which is what the line under
 * the input box tells the reader, and it is true rather than reassuring.
 *
 * **Three states, and the order they are decided in is not this file's.** An
 * emergency comes back as three telephone numbers, a question no official
 * guide can answer comes back as a refusal that says which kind it is, and
 * everything else comes back as an answer with the pages it was written from.
 *
 * Two departures from the mock-up, both because the mock-up draws a 460-pixel
 * panel and the product has a 300-pixel card:
 *
 * - The design puts a checkbox beside *In your plan: Keep an emergency kit
 *   ready*. There is nothing for it to tick — the plan's general actions are
 *   a register, not a checklist — so the line is the link without the box. A
 *   checkbox that remembers nothing is worse than no checkbox.
 * - The suggested questions stay visible after the first question, as the
 *   design shows them, and the card scrolls.
 */

import { type ReactNode, useEffect, useState } from 'react';

import {
  ASK_NOTE,
  ASK_PLACEHOLDER,
  ASK_PRIVACY,
  type AskAnswer,
  BACK_TO_PLAN,
  BASED_ON_YOUR_PLAN,
  CANNOT_SAY,
  EMERGENCY_ROWS,
  EMERGENCY_TITLE,
  FINDING_ANSWER,
  IN_YOUR_PLAN,
  SUGGESTED,
  WHAT_YOU_CAN_DO,
  answerFor,
} from '../ask/answers.js';
import { type AskResult, respond } from '../ask/respond.js';
import { GENERAL_ACTIONS, VICEMERGENCY } from '../prepare/actions.js';
import { alert, brand, ink, line, radius, space, surface, text, type, weight } from '../ui/theme.js';

/** One exchange. A `null` result is a question whose answer is still coming. */
interface Turn {
  readonly question: string;
  readonly result: AskResult | null;
}

/**
 * How long the *finding an answer* line stays up.
 *
 * Nothing is being fetched and nothing is being generated — the answer is
 * already in the bundle and the lookup is a few string comparisons. The pause
 * is so that the question lands on the screen before its answer does, because
 * an answer that appears in the same frame as the question reads as something
 * that was already there. It is presentation, not work, and the comment is
 * here so that nobody later mistakes it for a network call.
 */
const SETTLE_MS = 280;

export function AskAboutGettingReady({
  onBackToPlan,
  onReviewPlaces,
  opening,
}: {
  readonly onBackToPlan: () => void;
  /** Back to the plan, at the step that lists the places (Figma Q4). */
  readonly onReviewPlaces?: (() => void) | undefined;
  /**
   * A question to arrive with, asked as though the reader had typed it.
   *
   * Set when the panel was opened from a plan action's *Ask a question about
   * this*: the reader said what they wanted to know by pressing it, and
   * showing them an empty box would be asking them to say it again.
   */
  readonly opening?: string | undefined;
}) {
  const [turns, setTurns] = useState<readonly Turn[]>(
    opening === undefined || opening.trim() === '' ? [] : [{ question: opening, result: null }],
  );
  const [typed, setTyped] = useState('');

  const pending = turns.some((turn) => turn.result === null);

  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(() => {
      setTurns((current) =>
        current.map((turn) =>
          turn.result === null ? { ...turn, result: respond(turn.question) } : turn,
        ),
      );
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [pending]);

  const ask = (question: string): void => {
    const asked = question.trim();
    if (asked === '') return;
    setTurns((current) => [...current, { question: asked, result: null }]);
    setTyped('');
  };

  return (
    <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
      <p style={{ margin: `0 0 ${String(space(2))}px` }}>
        <button type="button" onClick={onBackToPlan} style={linkStyle}>
          ‹ {BACK_TO_PLAN}
        </button>
      </p>

      {/* What this is, before anything it says (AC 5.3.3). */}
      <p
        style={{
          margin: `0 0 ${String(space(3))}px`,
          padding: space(2),
          background: surface.sunken,
          borderRadius: radius.small,
          font: type(text.micro, { leading: 1.5 }),
          color: ink.muted,
        }}
      >
        {ASK_NOTE}
      </p>

      <section aria-label="Suggested questions" style={{ marginBottom: space(3) }}>
        <p
          style={{
            margin: `0 0 ${String(space(1))}px`,
            font: type(text.micro, { weight: weight.semibold }),
            letterSpacing: '0.06em',
            color: brand.ink,
          }}
        >
          {BASED_ON_YOUR_PLAN}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space(1) }}>
          {SUGGESTED.map((id) => {
            const answer = answerFor(id);
            if (answer === null) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  ask(answer.question);
                }}
                style={{
                  padding: `${String(space(1))}px ${String(space(2))}px`,
                  borderRadius: radius.pill,
                  border: `1px solid ${line.strong}`,
                  background: surface.raised,
                  color: ink.strong,
                  font: type(text.micro),
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {answer.question}
              </button>
            );
          })}
        </div>
      </section>

      <ol aria-live="polite" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {turns.map((turn, at) => (
          <li key={`${String(at)}-${turn.question}`} style={{ marginBottom: space(3) }}>
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <span
                style={{
                  maxWidth: '85%',
                  padding: `${String(space(2))}px ${String(space(3))}px`,
                  borderRadius: `${String(radius.large)}px ${String(radius.small)}px ${String(radius.large)}px ${String(radius.large)}px`,
                  background: brand.base,
                  color: ink.inverse,
                }}
              >
                {turn.question}
              </span>
            </span>
            <span style={{ display: 'block', marginTop: space(2) }}>
              {turn.result === null ? (
                <Finding />
              ) : (
                <Response
                  result={turn.result}
                  {...(onReviewPlaces === undefined ? {} : { onReviewPlaces })}
                  onPlanAction={onBackToPlan}
                />
              )}
            </span>
          </li>
        ))}
      </ol>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(typed);
        }}
        style={{ marginTop: space(3) }}
      >
        <label style={{ display: 'flex', gap: space(1), alignItems: 'center' }}>
          <span className="visually-hidden" style={hiddenLabel}>
            {ASK_PLACEHOLDER}
          </span>
          <input
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            placeholder={ASK_PLACEHOLDER}
            style={{
              flex: '1 0 0',
              minWidth: 0,
              padding: `${String(space(2))}px ${String(space(2))}px`,
              borderRadius: radius.small,
              border: `1px solid ${line.base}`,
              background: surface.sunken,
              font: type(text.small),
              color: ink.strong,
            }}
          />
          <button
            type="submit"
            aria-label="Ask"
            disabled={typed.trim() === ''}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: radius.pill,
              border: 'none',
              background: typed.trim() === '' ? line.base : brand.base,
              color: ink.inverse,
              font: type(text.label, { weight: weight.semibold }),
              cursor: typed.trim() === '' ? 'default' : 'pointer',
            }}
          >
            ↑
          </button>
        </label>
        <p style={{ margin: `${String(space(1))}px 0 0`, font: type(text.micro), color: ink.subtle }}>
          {ASK_PRIVACY}
        </p>
      </form>
    </div>
  );
}

/** While the answer is being looked up (Figma Q1). */
function Finding() {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: `${String(space(1))}px ${String(space(2))}px`,
        borderRadius: radius.small,
        background: surface.sunken,
        font: type(text.micro),
        color: ink.muted,
      }}
    >
      {FINDING_ANSWER}
    </span>
  );
}

/** Whichever of the three a question earned. */
function Response({
  result,
  onReviewPlaces,
  onPlanAction,
}: {
  readonly result: AskResult;
  readonly onReviewPlaces?: (() => void) | undefined;
  readonly onPlanAction: () => void;
}) {
  if (result.kind === 'emergency') return <Emergency />;
  if (result.kind === 'cannot') {
    return (
      <Cannot
        because={result.because}
        {...(onReviewPlaces === undefined ? {} : { onReviewPlaces })}
      />
    );
  }
  return <Answered answer={result.answer} onPlanAction={onPlanAction} />;
}

/** An answer, with the pages it was written from (Figma Q2). */
function Answered({
  answer,
  onPlanAction,
}: {
  readonly answer: AskAnswer;
  readonly onPlanAction: () => void;
}) {
  const action =
    answer.planAction === null
      ? null
      : (GENERAL_ACTIONS.find((candidate) => candidate.id === answer.planAction) ?? null);

  /*
    One chip per page, not one per sentence. Several bullets in an answer can
    come from the same page, and a reader looking at four chips that say the
    same thing learns less than one that says it once.
  */
  const pages = answer.sources.filter(
    (source, at) => answer.sources.findIndex((other) => other.href === source.href) === at,
  );

  return (
    <Card>
      <p style={{ margin: `0 0 ${String(space(2))}px` }}>{answer.intro}</p>
      <ul style={{ margin: `0 0 ${String(space(2))}px`, paddingLeft: space(4) }}>
        {answer.points.map((point) => (
          <li key={point} style={{ marginBottom: space(1) }}>
            {point}
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space(1) }}>
        {pages.map((source) => (
          <a
            key={source.href}
            href={source.href}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: `2px ${String(space(2))}px`,
              borderRadius: radius.small,
              border: `1px solid ${line.base}`,
              background: surface.raised,
              font: type(text.micro),
              color: brand.ink,
              textDecoration: 'none',
            }}
          >
            {source.publisher} · {source.document} ↗
          </a>
        ))}
      </div>
      {action !== null && (
        <p
          style={{
            margin: `${String(space(2))}px 0 0`,
            paddingTop: space(2),
            borderTop: `1px solid ${line.hair}`,
          }}
        >
          <span style={{ color: ink.muted }}>{IN_YOUR_PLAN} </span>
          <button type="button" onClick={onPlanAction} style={linkStyle}>
            {action.text} ›
          </button>
        </p>
      )}
    </Card>
  );
}

/** A question no official guide answers (Figma Q4). */
function Cannot({
  because,
  onReviewPlaces,
}: {
  readonly because: string;
  readonly onReviewPlaces?: (() => void) | undefined;
}) {
  return (
    <Card>
      <p style={{ margin: 0 }}>{CANNOT_SAY[because] ?? CANNOT_SAY['not-covered']}</p>
      <p
        style={{
          margin: `${String(space(2))}px 0 ${String(space(1))}px`,
          font: type(text.small, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        {WHAT_YOU_CAN_DO}
      </p>
      <ul style={{ margin: 0, paddingLeft: space(4) }}>
        <li style={{ marginBottom: space(1) }}>
          Check current warnings on{' '}
          <a href={VICEMERGENCY.href} target="_blank" rel="noreferrer" style={{ color: brand.ink }}>
            {VICEMERGENCY.label} ↗
          </a>
        </li>
        {onReviewPlaces !== undefined && (
          <li>
            <button type="button" onClick={onReviewPlaces} style={linkStyle}>
              Review the places near you ›
            </button>
          </li>
        )}
      </ul>
    </Card>
  );
}

/** Three telephone numbers, and nothing else (Figma Q5). */
function Emergency() {
  return (
    <div
      style={{
        padding: space(3),
        borderRadius: radius.base,
        background: alert.fill,
        border: `1px solid ${alert.line}`,
      }}
    >
      <p
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.label, { weight: weight.semibold }),
          color: alert.ink,
        }}
      >
        {EMERGENCY_TITLE}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {EMERGENCY_ROWS.map((row) => (
          <li
            key={row.what}
            style={{
              display: 'flex',
              gap: space(2),
              alignItems: 'baseline',
              justifyContent: 'space-between',
              padding: space(2),
              marginBottom: space(1),
              background: surface.raised,
              borderRadius: radius.small,
            }}
          >
            <span>
              <span style={{ display: 'block', font: type(text.small, { weight: weight.semibold }), color: ink.strong }}>
                {row.what}
              </span>
              <span style={{ display: 'block', font: type(text.micro), color: ink.muted }}>
                {row.who}
              </span>
            </span>
            {row.number === null ? (
              <a
                href={VICEMERGENCY.href}
                target="_blank"
                rel="noreferrer"
                style={{ font: type(text.small, { weight: weight.semibold }), color: brand.ink }}
              >
                Open ↗
              </a>
            ) : (
              <span style={{ font: type(text.label, { weight: weight.bold }), color: ink.strong }}>
                {row.number}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ children }: { readonly children: ReactNode }) {
  return (
    <div
      style={{
        padding: space(3),
        borderRadius: radius.base,
        background: surface.sunken,
        border: `1px solid ${line.hair}`,
      }}
    >
      {children}
    </div>
  );
}

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: type(text.small),
  color: brand.ink,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
  textAlign: 'left',
} as const;

const hiddenLabel = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
