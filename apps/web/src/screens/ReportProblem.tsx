/**
 * Report a drainage problem: choose what it is, then who it goes to.
 *
 * Epic 6's reporting pathway (AC 6.3.1 to 6.3.4). Two steps, because the
 * organisation depends on the problem and naming one before the reader has
 * said what happened would be guessing for them (AC 6.2.3).
 *
 * **The emergency branch is not a sixth screen.** It is the same screen with
 * the two telephone numbers above everything else and the checklist moved
 * below a line saying it is for once everyone is safe (AC 6.3.4). Keeping it
 * here rather than elsewhere means a reader who picks it by mistake, or who
 * realises halfway through that it is worse than they thought, is one press
 * from the numbers.
 *
 * **Nothing is submitted and nothing is kept.** The two controls at the foot
 * copy the summary or print it; both build it in the browser and neither
 * sends anything (AC 6.3.2, 6.3.3).
 */

import { useState } from 'react';

import { printDocument } from '../prepare/printing.js';
import { type Channel } from '../report/channels.js';
import {
  CHOOSE_PROBLEM,
  EMERGENCY_CHECKLIST_LATER,
  EMERGENCY_FIRST,
  EMERGENCY_SAFETY,
  NOT_SUBMITTED,
  NO_DRAIN_NEEDED,
  PREPARE,
  PROBLEM_TYPES,
  type ProblemId,
  SELECTED_DRAIN,
  problemFor,
} from '../report/problems.js';
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
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: space(2),
                  borderRadius: radius.small,
                  border: `1px solid ${line.base}`,
                  background: surface.raised,
                  cursor: 'pointer',
                  font: type(text.small, { leading: 1.5 }),
                  color: ink.base,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    font: type(text.small, { weight: weight.semibold }),
                    color: ink.strong,
                  }}
                >
                  {problem.label}
                </span>
                <span style={{ display: 'block', color: ink.muted }}>{problem.describes}</span>
              </button>
            </li>
          ))}
        </ul>
        <p style={{ margin: `${String(space(2))}px 0 0`, color: ink.muted }}>{NOT_SUBMITTED}</p>
      </div>
    );
  }

  const problem = problemFor(chosen);
  const summary = reportSummary(address, problem, drain, new Date());

  return (
    <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
      <p
        style={{
          margin: `0 0 ${String(space(1))}px`,
          font: type(text.small, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        {problem.label}
      </p>

      {/* AC 6.3.4: the numbers come before the problem is even described. */}
      {problem.urgent && (
        <div
          style={{
            margin: `0 0 ${String(space(2))}px`,
            padding: space(2),
            borderRadius: radius.small,
            background: brand.wash,
            border: `1px solid ${brand.tint}`,
            color: brand.ink,
          }}
        >
          <p style={{ margin: 0, font: type(text.small, { weight: weight.semibold }) }}>
            {EMERGENCY_FIRST}
          </p>
          <p style={{ margin: `${String(space(1))}px 0 0` }}>{EMERGENCY_SAFETY}</p>
        </div>
      )}

      <p style={{ margin: `0 0 ${String(space(2))}px`, color: ink.muted }}>{problem.because}</p>

      <Heading>Who to contact</Heading>
      <ul style={{ margin: `0 0 ${String(space(3))}px`, padding: 0, listStyle: 'none' }}>
        {problem.channels.map((channel) => (
          <li key={channel.organisation + channel.action} style={{ marginBottom: space(2) }}>
            <Contact channel={channel} />
          </li>
        ))}
      </ul>

      {problem.urgent && (
        <p style={{ margin: `0 0 ${String(space(2))}px`, color: ink.muted }}>
          {EMERGENCY_CHECKLIST_LATER}
        </p>
      )}

      <Heading>What to have ready</Heading>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {PREPARE.map((item) => (
          <li key={item} style={{ marginBottom: space(1) }}>
            {item}
          </li>
        ))}
        {/* AC 6.3.2: only where the reader selected one, and labelled as theirs. */}
        {drain !== null && (
          <li style={{ marginBottom: space(1) }}>
            {SELECTED_DRAIN}: {drain}
            {onForgetDrain !== undefined && (
              <>
                {' '}
                <button type="button" onClick={onForgetDrain} style={linkStyle}>
                  Remove
                </button>
              </>
            )}
          </li>
        )}
      </ul>
      {drain === null && (
        <p style={{ margin: `${String(space(1))}px 0 0`, color: ink.muted }}>{NO_DRAIN_NEEDED}</p>
      )}

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
          style={pillStyle}
        >
          {copied ? 'Summary copied' : 'Copy summary'}
        </button>
        <button
          type="button"
          onClick={() => {
            printDocument(summaryHtml(summary));
          }}
          style={pillStyle}
        >
          Print summary
        </button>
      </p>

      <p style={{ margin: `${String(space(2))}px 0 0`, color: ink.muted }}>{NOT_SUBMITTED}</p>

      <p style={{ margin: `${String(space(2))}px 0 0` }}>
        <button
          type="button"
          onClick={() => {
            setChosen(null);
            setCopied(false);
          }}
          style={linkStyle}
        >
          Choose a different problem
        </button>
      </p>
    </div>
  );
}

function Contact({ channel }: { readonly channel: Channel }) {
  return (
    <span style={{ display: 'block' }}>
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
          Open the page
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

const pillStyle = {
  padding: `${String(space(1))}px ${String(space(3))}px`,
  borderRadius: radius.pill,
  border: `1px solid ${brand.tint}`,
  background: brand.wash,
  color: brand.ink,
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
