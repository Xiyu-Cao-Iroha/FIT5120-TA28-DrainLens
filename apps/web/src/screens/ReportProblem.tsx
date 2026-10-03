/**
 * Report a problem: choose what it is, then who it goes to.
 *
 * Epic 6's reporting pathway, built to the team's Figma (file
 * `atD5fleOrhvMjJ5m0pXYGt`, screens B3, B4 and B5). Two steps, because the
 * organisation depends on the problem and naming one before the reader has
 * said what happened would be guessing for them (AC 6.2.3).
 *
 * **The emergency branch is not a sixth screen.** It is the same screen with
 * two telephone numbers in place of the contact and the checklist, as the
 * design draws it: somebody whose house is filling with water is not filling
 * in a checklist, and AC 6.3.4 asks for the numbers first.
 *
 * **Nothing is submitted and nothing is kept.** The two controls at the foot
 * copy the details or print them; both build the page in the browser and
 * neither sends anything (AC 6.3.2, 6.3.3).
 */

import { useState } from 'react';

import { printDocument } from '../prepare/printing.js';
import { type Channel } from '../report/channels.js';
import {
  CHOOSE_ANOTHER,
  CHOOSE_PROBLEM,
  EMERGENCY_CALLS,
  EMERGENCY_SAFETY,
  EMERGENCY_WARNINGS,
  NOT_SENT_YET,
  NOT_SUBMITTED,
  PROBLEM_TYPES,
  type ProblemId,
  WHAT_TO_INCLUDE,
  problemFor,
  whatToInclude,
} from '../report/problems.js';
import { VICEMERGENCY } from '../prepare/actions.js';
import { reportSummary, summaryHtml, summaryText } from '../report/summary.js';
import { brand, ink, line, radius, space, surface, text, type, weight } from '../ui/theme.js';

export function ReportProblem({
  address,
  drain,
  onForgetDrain,
}: {
  /** As the reader chose it, or null where they are reading without one. */
  readonly address: string | null;
  /** A drain the reader selected on the map, or null. Never the nearest one. */
  readonly drain: string | null;
  /** Take the selected drain off the report, which is always allowed. */
  readonly onForgetDrain?: (() => void) | undefined;
}) {
  const [chosen, setChosen] = useState<ProblemId | null>(null);
  const [copied, setCopied] = useState(false);

  if (chosen === null) {
    return (
      <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
        <p style={{ margin: `0 0 ${String(space(2))}px` }}>{CHOOSE_PROBLEM}</p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {PROBLEM_TYPES.map((problem) => (
            <li key={problem.id} style={{ marginBottom: space(2) }}>
              <button
                type="button"
                onClick={() => {
                  setChosen(problem.id);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: space(2),
                  width: '100%',
                  textAlign: 'left',
                  padding: `${String(space(2))}px ${String(space(2))}px`,
                  borderRadius: radius.small,
                  // The emergency reads as one (Figma B3), and is first.
                  border: `1px solid ${problem.urgent ? URGENT_EDGE : line.base}`,
                  background: problem.urgent ? URGENT_WASH : surface.raised,
                  color: problem.urgent ? URGENT_INK : ink.base,
                  font: type(text.small, { weight: problem.urgent ? weight.semibold : weight.regular }),
                  cursor: 'pointer',
                }}
              >
                <span>
                  {problem.urgent && <span aria-hidden>❗ </span>}
                  {problem.label}
                </span>
                <span aria-hidden style={{ color: problem.urgent ? URGENT_INK : ink.subtle }}>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.micro), color: ink.subtle }}>
          {NOT_SENT_YET}
        </p>
      </div>
    );
  }

  const problem = problemFor(chosen);
  const summary = reportSummary(address, problem, drain, new Date());
  const items = whatToInclude(address, drain);

  return (
    <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
      <p style={{ margin: `0 0 ${String(space(2))}px` }}>
        <button
          type="button"
          onClick={() => {
            setChosen(null);
            setCopied(false);
          }}
          style={linkStyle}
        >
          ‹ {CHOOSE_ANOTHER}
        </button>
      </p>

      <p
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.label, { weight: weight.semibold }),
          color: problem.urgent ? URGENT_INK : ink.strong,
        }}
      >
        {problem.label}
      </p>

      {problem.urgent ? (
        <>
          {/* AC 6.3.4: the two numbers before anything else, and nothing to fill in. */}
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {EMERGENCY_CALLS.map((call) => (
              <li key={call.label} style={{ marginBottom: space(2) }}>
                <span
                  style={{
                    display: 'block',
                    padding: space(2),
                    borderRadius: radius.small,
                    background: call.first ? URGENT_INK : ink.strong,
                    color: ink.inverse,
                  }}
                >
                  <span style={{ display: 'block', font: type(text.label, { weight: weight.semibold }) }}>
                    {call.label}
                  </span>
                  <span style={{ display: 'block', font: type(text.micro) }}>{call.when}</span>
                </span>
              </li>
            ))}
          </ul>
          <ul style={{ margin: `${String(space(2))}px 0 0`, paddingLeft: space(3) }}>
            {EMERGENCY_SAFETY.map((sentence) => (
              <li key={sentence} style={{ marginBottom: space(1) }}>
                {sentence}
              </li>
            ))}
          </ul>
          <p style={{ margin: `${String(space(2))}px 0 0` }}>
            <a href={VICEMERGENCY.href} target="_blank" rel="noreferrer" style={{ color: brand.ink }}>
              {EMERGENCY_WARNINGS} ›
            </a>
          </p>
        </>
      ) : (
        <>
          <Heading>Contact</Heading>
          <ul style={{ margin: `0 0 ${String(space(3))}px`, padding: 0, listStyle: 'none' }}>
            {problem.channels.map((channel) => (
              <li key={channel.organisation + channel.action} style={{ marginBottom: space(2) }}>
                <Contact channel={channel} />
              </li>
            ))}
          </ul>
          <p style={{ margin: `0 0 ${String(space(3))}px`, font: type(text.micro), color: ink.subtle }}>
            {problem.because}
          </p>

          <Heading>{WHAT_TO_INCLUDE}</Heading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {items.map((item) => (
              <li key={item.id} style={{ marginBottom: space(2) }}>
                <Include title={item.title} detail={item.detail} />
                {item.id === 'drain' && drain !== null && onForgetDrain !== undefined && (
                  <button
                    type="button"
                    onClick={onForgetDrain}
                    style={{ ...linkStyle, marginLeft: 26, font: type(text.micro) }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          <p
            style={{
              margin: `${String(space(3))}px 0 0`,
              display: 'flex',
              gap: space(2),
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(summaryText(summary)).then(
                  () => {
                    setCopied(true);
                  },
                  () => {
                    // A refused clipboard is not an error worth a dialog: the
                    // printed copy is right beside this button.
                    setCopied(false);
                  },
                );
              }}
              style={filledStyle}
            >
              {copied ? 'Details copied' : 'Copy details'}
            </button>
            <button
              type="button"
              onClick={() => {
                printDocument(summaryHtml(summary));
              }}
              style={outlineStyle}
            >
              Print
            </button>
          </p>

          <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.micro), color: ink.subtle }}>
            {NOT_SUBMITTED}
          </p>
        </>
      )}
    </div>
  );
}

/** One line of *What to include*: a box, the thing, and what to have ready. */
function Include({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <span style={{ display: 'flex', gap: space(2), alignItems: 'flex-start' }}>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 14,
          height: 14,
          marginTop: 3,
          borderRadius: 3,
          border: `1px solid ${line.base}`,
          background: surface.raised,
        }}
      />
      <span>
        <span style={{ display: 'block', font: type(text.small, { weight: weight.semibold }), color: ink.strong }}>
          {title}
        </span>
        <span style={{ display: 'block', font: type(text.micro), color: ink.muted }}>{detail}</span>
      </span>
    </span>
  );
}

function Contact({ channel }: { readonly channel: Channel }) {
  return (
    <span
      style={{
        display: 'block',
        padding: space(2),
        borderRadius: radius.small,
        background: brand.wash,
      }}
    >
      <span
        style={{
          display: 'block',
          font: type(text.small, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        {channel.organisation}
      </span>
      <span style={{ display: 'block' }}>
        {channel.phone === undefined ? channel.action : `${channel.action} on ${channel.phone}`}
      </span>
      {channel.href !== undefined && (
        <a href={channel.href} target="_blank" rel="noreferrer" style={{ color: brand.ink }}>
          Open the page ›
        </a>
      )}
      {/* Only where it is somebody else: the council's own page under the
          council's own name said the same thing twice. */}
      {channel.publisher !== channel.organisation && (
        <span style={{ display: 'block', font: type(text.micro), color: ink.subtle }}>
          {channel.publisher}
        </span>
      )}
    </span>
  );
}

function Heading({ children }: { readonly children: string }) {
  return (
    <p
      style={{
        margin: `0 0 ${String(space(1))}px`,
        font: type(text.micro, { weight: weight.semibold }),
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: ink.subtle,
      }}
    >
      {children}
    </p>
  );
}

/** The emergency's own red, which nothing else on the map uses. */
const URGENT_INK = '#a4262c';
const URGENT_WASH = '#fdf1f1';
const URGENT_EDGE = '#e8c4c6';

const filledStyle = {
  padding: `${String(space(1))}px ${String(space(3))}px`,
  borderRadius: radius.small,
  border: `1px solid ${brand.base}`,
  background: brand.base,
  color: ink.inverse,
  font: type(text.small, { weight: weight.semibold }),
  cursor: 'pointer',
} as const;

const outlineStyle = {
  padding: `${String(space(1))}px ${String(space(3))}px`,
  borderRadius: radius.small,
  border: `1px solid ${line.base}`,
  background: surface.raised,
  color: ink.base,
  font: type(text.small, { weight: weight.semibold }),
  cursor: 'pointer',
} as const;

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: type(text.small),
  color: brand.ink,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
} as const;
