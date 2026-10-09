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

import { plainButton } from '../ui/controls.js';
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
  RECOMMENDED_INFORMATION,
  problemFor,
  whatToInclude,
} from '../report/problems.js';
import { VICEMERGENCY } from '../prepare/actions.js';
import {
  CHANGE_PLACE,
  COPIED_WITH_LINK,
  PICK_ON_MAP,
  type ReportPlace,
  placeNotice,
  pinnedLink,
} from '../report/place.js';
import { reportSummary, summaryHtml, summaryText } from '../report/summary.js';
import { brand, ink, line, radius, space, surface, text, type, weight } from '../ui/theme.js';

export function ReportProblem({
  address,
  place,
  chosen,
  onChoose,
  pulse = false,
  onPick,
  onForgetPlace,
}: {
  /*
    The chosen problem is held by the map, not here.

    Handing the map over to pick a drain unmounts this card -- the map takes
    the whole screen for it -- and a reader who came back to *What is the
    problem?* after answering it would reasonably think the press had failed.
  */
  readonly chosen: ProblemId | null;
  readonly onChoose: (problem: ProblemId | null) => void;
  /**
   * Outlined while the guide's fourth step waits on a choice (Figma D4).
   *
   * The whole list, not one option: the step names *Blocked or flooded
   * street drain* because the frame does, and any of the five answers it.
   */
  readonly pulse?: boolean | undefined;
  /** As the reader chose it, or null where they are reading without one. */
  readonly address: string | null;
  /** A drain they tapped or a point they pinned. Never the nearest one. */
  readonly place: ReportPlace;
  /** Hand the map over so they can tap a drain or put a pin (Figma R1). */
  readonly onPick?: (() => void) | undefined;
  /** Take it off the report again, which is always allowed. */
  readonly onForgetPlace?: (() => void) | undefined;
}) {
  const [copied, setCopied] = useState(false);

  if (chosen === null) {
    return (
      <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
        <p style={{ margin: `0 0 ${String(space(2))}px` }}>{CHOOSE_PROBLEM}</p>
        <ul
          style={{
            margin: 0,
            listStyle: 'none',
            // The outline goes round the list rather than round one option,
            // because any of the five satisfies the step.
            padding: pulse ? space(2) : 0,
            borderRadius: radius.base,
            border: pulse ? `2px solid ${brand.base}` : '2px solid transparent',
            background: pulse ? brand.wash : 'transparent',
          }}
        >
          {PROBLEM_TYPES.map((problem) => (
            <li key={problem.id} style={{ marginBottom: space(2) }}>
              <button
                type="button"
                onClick={() => {
                  onChoose(problem.id);
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
  const summary = reportSummary(address, problem, place, new Date());
  const items = whatToInclude(address, place);
  const notice = placeNotice(place);

  return (
    <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
      <p style={{ margin: `0 0 ${String(space(2))}px` }}>
        <button
          type="button"
          onClick={() => {
            onChoose(null);
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

      {/* What the reader just did on the map, said once (Figma B4c, B4d). */}
      {!problem.urgent && notice !== null && (
        <p
          style={{
            margin: `0 0 ${String(space(2))}px`,
            padding: space(2),
            borderRadius: radius.small,
            background: NOTICE_WASH,
            font: type(text.micro),
            color: ink.base,
          }}
        >
          {notice}
        </p>
      )}

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

          <Heading>{RECOMMENDED_INFORMATION}</Heading>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {items.map((item) => (
              <li key={item.id} style={{ marginBottom: space(2) }}>
                <Include title={item.title} detail={item.detail} />
                {item.id === 'drain' && (
                  <span style={{ display: 'block', marginLeft: 26 }}>
                    {place === null
                      ? onPick !== undefined && (
                          <button type="button" onClick={onPick} style={{ ...linkStyle, font: type(text.micro) }}>
                            {PICK_ON_MAP} ›
                          </button>
                        )
                      : onForgetPlace !== undefined && (
                          <button
                            type="button"
                            onClick={onForgetPlace}
                            style={{ ...linkStyle, font: type(text.micro) }}
                          >
                            {CHANGE_PLACE}
                          </button>
                        )}
                  </span>
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

          {pinnedLink(place) !== null && (
            <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.micro), color: ink.subtle }}>
              {COPIED_WITH_LINK}
            </p>
          )}
          <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.micro), color: ink.subtle }}>
            {NOT_SUBMITTED}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * One line of the recommended information: a dot, the thing, and what to
 * have ready.
 *
 * **A dot rather than a box.** An empty square is a control, and four of them
 * over two buttons read as a form to complete before the buttons would work.
 * Nothing here is ticked, nothing is submitted, and the list is the same four
 * things whatever the reader does. A bullet says *read this*, which is what
 * it is for.
 */
function Include({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <span style={{ display: 'flex', gap: space(2), alignItems: 'flex-start' }}>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 6,
          height: 6,
          margin: '7px 4px 0',
          borderRadius: '50%',
          background: ink.muted,
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

/** The quiet tint behind *Location pinned on the map.* */
const NOTICE_WASH = '#fdf6e8';

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

/** Was an underline; is a control (9 October). */
const linkStyle = plainButton;
