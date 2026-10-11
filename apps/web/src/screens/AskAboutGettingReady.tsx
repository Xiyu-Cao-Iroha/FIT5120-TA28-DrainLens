/**
 * Ask about getting ready — the DrainLens chat panel.
 *
 * Questions are sent to the DrainLens API and answered by the
 * local RAG and Llama service using official flood-preparation guidance.
 *
 * The user's address is not sent with the chat question.
 */

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../data/source.js';
import {
  ANSWERS,
  ASK_NOTE,
  ASK_PLACEHOLDER,
  ASK_PRIVACY,
  BACK_TO_PLAN,
  BASED_ON_YOUR_PLAN,
  FINDING_ANSWER,
  SUGGESTED,
  answerFor,
} from '../ask/answers.js';

import { brand, ink, line, radius, space, surface, text, type, weight } from '../ui/theme.js';

/** One exchange. A `null` result is a question whose answer is still coming. */
interface ChatSource {
  readonly title?: string;
  readonly organisation?: string;
  readonly page?: number;
  readonly url?: string;
}

interface ChatResult {
  readonly answer: string;
  readonly sources: readonly ChatSource[];
}

interface Turn {
  readonly id: number;
  readonly question: string;
  readonly result: ChatResult | null;
  readonly error: string | null;
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
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [typed, setTyped] = useState('');
  const nextTurnId = useRef(0);
  const openingAsked = useRef(false);




  const ask = async (question: string): Promise<void> => {
    const asked = question.trim();
    if (asked === '') return;

    const id = nextTurnId.current;
    nextTurnId.current += 1;

    setTurns((current) => [
      ...current,
      {
        id,
        question: asked,
        result: null,
        error: null,
      },
    ]);

    setTyped('');

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: asked,
        }),
      });

      const raw = await response.text();

      let data: {
        answer?: string;
        sources?: ChatSource[];
        error?: string;
      };

      try {
        data = raw
          ? (JSON.parse(raw) as {
              answer?: string;
              sources?: ChatSource[];
              error?: string;
            })
          : {};
      } catch {
        throw new Error(
          'The chat assistant returned an invalid response. Please try again.',
        );
      }


      if (!response.ok) {
        throw new Error(
          data.error ?? 'The chat assistant could not answer.',
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ?? 'The chat assistant could not answer.',
        );
      }

      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                result: {
                  answer: data.answer ?? 'No answer was returned.',
                  sources: data.sources ?? [],
                },
              }
            : turn,
        ),
      );
    } catch (error) {
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                error:
                  error instanceof Error
                    ? error.message
                    : 'The chat assistant is temporarily unavailable.',
              }
            : turn,
        ),
      );
    }
  };


const normaliseQuestion = (question: string): string =>
  question
    .trim()
    .toLowerCase()
    .replace(/[?.!]+$/, '')
    .replace(/\s+/g, ' ');

const findInstantAnswer = (question: string) => {
  const normalised = normaliseQuestion(question);

  return (
    ANSWERS.find((answer) => {
      const questions = [
        answer.question,
        ...(answer.aliases ?? []),
      ];

      return questions.some(
        (candidate) => normaliseQuestion(candidate) === normalised,
      );
    }) ?? null
  );
};



const askSuggested = (
  answer: ReturnType<typeof answerFor>,
  askedQuestion?: string,
): void => {
  if (answer === null) return;

  const id = nextTurnId.current;
  nextTurnId.current += 1;

  const answerText = [
    answer.intro,
    '',
    ...answer.points.map((point) => `• ${point}`),
  ].join('\n');

  setTurns((current) => [
    ...current,
    {
      id,
      question: askedQuestion ?? answer.question,
      result: {
        answer: answerText,
        sources: Array.from(
          new Map(
            answer.sources.map((source) => [
              source.href,
              {
                organisation: source.publisher,
                title: source.document,
                url: source.href,
              },
            ]),
          ).values(),
        ),
      },
      error: null,
    },
  ]);

  setTyped('');
};

  useEffect(() => {
    if (
      openingAsked.current ||
      opening === undefined ||
      opening.trim() === ''
    ) {
      return;
    }

    openingAsked.current = true;
    void ask(opening);
  }, [opening]);
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
                  askSuggested(answer);
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
            {turn.error !== null ? (
              <Card>
                <p style={{ margin: 0 }}>{turn.error}</p>
              </Card>
            ) : turn.result === null ? (
              <Finding />
            ) : (
              <Card>
                <p
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {turn.result.answer}
                </p>

                {turn.result.sources.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: space(1),
                      marginTop: space(2),
                    }}
                  >
                    {turn.result.sources.map((source, sourceIndex) =>
                      source.url === undefined ? (
                        <span key={sourceIndex}>
                          {source.title ??
                            source.organisation ??
                            `Source ${String(sourceIndex + 1)}`}
                        </span>
                      ) : (
                        <a
                          key={sourceIndex}
                          href={source.url}
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
                          {source.organisation ?? source.title ?? 'Source'} ↗
                        </a>
                      ),
                    )}
                  </div>
                )}
              </Card>
            )}
            </span>
          </li>
        ))}
      </ol>

      <form
        onSubmit={(event) => {
          event.preventDefault();

          const instantAnswer = findInstantAnswer(typed);

          if (instantAnswer !== null) {
            askSuggested(instantAnswer, typed.trim());
          } else {
            void ask(typed);
          }
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
