/**
 * The first screen: find an address, or find out that we cannot help with it.
 *
 * Four things here are load-bearing rather than cosmetic.
 *
 * The privacy line is a promise the code keeps — the index is local, the
 * search never takes a network, and the address is held in memory for the tab
 * and written nowhere. It is stated on the screen because a person deciding
 * whether to type their own address deserves to know before they type it, not
 * in a policy they will not open.
 *
 * An address we cannot resolve is never quietly swapped for one we can. The
 * three outcomes stay distinct all the way to the screen.
 *
 * The demonstration address is offered directly, because the pilot is one
 * square kilometre and most people's own address is outside it. Without that
 * offer the honest answer is also a dead end, and a dead end on the first
 * screen is where somebody leaves.
 *
 * And the two lists at the bottom are why this page is not empty. It briefly
 * carried a rendering of the pilot square kilometre instead, which is worth
 * recording as a mistake: the instrument's palette is tuned to read discrete
 * facts against terrain, so as a picture it is dense, multi-hued and
 * hard-edged — it read as a screenshot pasted beside the writing, because that
 * is exactly what it was. Space on a first screen is better earned by saying
 * what somebody is about to get, and what they are not.
 */

import { type FormEvent, useMemo, useState } from 'react';

import {
  type AddressIndex,
  type IndexedAddress,
  type Match,
  MAX_SUGGESTIONS,
  resolve,
  search,
} from '../address/search.js';
import { FixtureNotice, PilotBadge } from '../ui/Shell.js';
import {
  advisory,
  brand,
  ink,
  line,
  radius,
  shadow,
  space,
  surface,
  text,
  tracking,
  type,
  weight,
} from '../ui/theme.js';

export const PRIVACY_LINE =
  'No account is required. Your address stays in this browser tab: it is not sent anywhere, and nothing is kept when you close it.';

/**
 * What the product does, and what it refuses to do, before anybody types.
 *
 * The second list is not a disclaimer bolted on at the end. It is the claim
 * the banner makes on every screen and the result screen makes again in its
 * own words, said once more at the only moment it can still change what
 * somebody expects — which is before they have asked for anything.
 */
const SHOWS: readonly string[] = [
  'Surface-water paths and low points, calculated from a measured ground surface',
  "The council's recorded drainage pits and pipes, and where a path stops because the record does",
  'One blocked drain compared against the same rainfall with every drain clear',
];

const DOES_NOT: readonly string[] = [
  'It is not a flood map and not a prediction',
  'It does not show how deep water would be, or when it would arrive',
  'It covers one square kilometre of Kensington, so most Melbourne addresses are outside it',
];

export interface LandingProps {
  readonly index: AddressIndex;
  /** Present only while the index is a stand-in. */
  readonly fixtureNote?: string | undefined;
  readonly onFound: (address: IndexedAddress) => void;
  readonly onUnsupported: (typed: string) => void;
}

type Problem =
  | { readonly kind: 'outside-pilot'; readonly typed: string }
  | { readonly kind: 'not-an-address'; readonly typed: string }
  | null;

/** The privacy line's mark, drawn because the shipped subset has no shield. */
function ShieldMark() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
      style={{ flexShrink: 0, marginTop: 2 }}
    >
      <path
        d="M8 1.6 13.2 3.4v4.3c0 3.2-2.1 5.7-5.2 6.7-3.1-1-5.2-3.5-5.2-6.7V3.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="m5.7 8.1 1.6 1.6 3-3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Landing({ index, fixtureNote, onFound, onUnsupported }: LandingProps) {
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const [focused, setFocused] = useState(false);

  const suggestions: Match[] = useMemo(
    () => (typed.trim().length >= 2 ? search(index, typed, MAX_SUGGESTIONS) : []),
    [index, typed],
  );

  const demonstration = index.addresses[0];

  function submit(event: FormEvent) {
    event.preventDefault();
    const answer = resolve(index, typed);

    if (answer.kind === 'found') {
      onFound(answer.address);
      return;
    }
    if (answer.kind === 'ambiguous') {
      // Not an error and not a guess. The list is already on screen; asking
      // them to pick is the honest move when several addresses fit.
      setProblem(null);
      return;
    }
    setProblem({ kind: answer.kind, typed: answer.typed });
    onUnsupported(answer.typed);
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: `${String(space(12))}px ${String(space(6))}px ${String(space(16))}px`,
      }}
    >
      <PilotBadge />

      <h1
        className="landing__title"
        style={{ margin: `${String(space(5))}px 0 ${String(space(3))}px`, color: ink.strong }}
      >
        See how rainwater may move near your address
      </h1>
      <p
        className="landing__lead"
        style={{ margin: `0 0 ${String(space(8))}px`, color: ink.muted, maxWidth: 560 }}
      >
        Explore local surface water paths, public drainage connections and a simplified
        drain-blockage scenario.
      </p>

      <form
        onSubmit={submit}
        style={{
          padding: space(5),
          background: surface.raised,
          border: `1px solid ${line.base}`,
          borderRadius: radius.large,
          boxShadow: shadow.resting,
        }}
      >
        <label
          htmlFor="address"
          style={{
            display: 'block',
            font: type(text.label, { weight: weight.semibold }),
            color: ink.strong,
            marginBottom: space(2),
          }}
        >
          Enter an address
        </label>
        <div style={{ display: 'flex', gap: space(2), flexWrap: 'wrap' }}>
          <input
            id="address"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setProblem(null);
            }}
            onFocus={() => {
              setFocused(true);
            }}
            onBlur={() => {
              setFocused(false);
            }}
            placeholder="Start typing an address"
            autoComplete="off"
            style={{
              flex: '1 1 260px',
              minWidth: 0,
              padding: space(3),
              font: type(text.body),
              color: ink.strong,
              background: surface.raised,
              border: `1px solid ${focused ? brand.base : line.strong}`,
              borderRadius: radius.base,
              outline: 'none',
              transition: 'border-color 120ms ease',
            }}
          />
          <button
            type="submit"
            style={{
              padding: `${String(space(3))}px ${String(space(5))}px`,
              font: type(text.body, { weight: weight.semibold }),
              color: ink.inverse,
              background: brand.base,
              border: 'none',
              borderRadius: radius.base,
              transition: 'background-color 120ms ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = brand.hover;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = brand.base;
            }}
          >
            Explore this area →
          </button>
        </div>

        {suggestions.length > 0 && (
          <ul
            aria-label="Matching addresses"
            style={{ listStyle: 'none', margin: `${String(space(3))}px 0 0`, padding: 0 }}
          >
            {suggestions.map((match) => (
              <li key={match.address.id}>
                <SuggestionButton
                  label={match.address.label}
                  onPick={() => {
                    onFound(match.address);
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {suggestions.length === 0 && problem === null && demonstration && (
          <p
            style={{
              margin: `${String(space(3))}px 0 0`,
              font: type(text.label),
              color: ink.subtle,
            }}
          >
            Not sure?{' '}
            <button
              type="button"
              onClick={() => {
                onFound(demonstration);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: type(text.label, { weight: weight.semibold }),
                color: brand.ink,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Try {demonstration.label}
            </button>
          </p>
        )}

        <p
          style={{
            display: 'flex',
            gap: space(2),
            alignItems: 'flex-start',
            margin: `${String(space(4))}px 0 0`,
            paddingTop: space(4),
            borderTop: `1px solid ${line.hair}`,
            font: type(text.small, { leading: 1.5 }),
            color: ink.subtle,
          }}
        >
          <ShieldMark />
          <span>{PRIVACY_LINE}</span>
        </p>

        {problem !== null && <UnsupportedNotice problem={problem} index={index} />}
        {fixtureNote !== undefined && <FixtureNotice note={fixtureNote} />}
      </form>

      <div
        style={{
          display: 'grid',
          gap: space(8),
          gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))',
          marginTop: space(12),
        }}
      >
        <Claims title="What this shows" items={SHOWS} tone="brand" />
        <Claims title="What it does not" items={DOES_NOT} tone="quiet" />
      </div>
    </div>
  );
}

/**
 * One of the two lists.
 *
 * The markers are a short rule for what the product does and a dot for what it
 * does not. Deliberately not a tick and a cross: those read as good news and
 * bad news, and the second list is not bad news — it is the boundary of a
 * careful claim, which is the most valuable thing on the page.
 */
function Claims({
  title,
  items,
  tone,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly tone: 'brand' | 'quiet';
}) {
  return (
    <section>
      <h2
        style={{
          margin: `0 0 ${String(space(4))}px`,
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
          color: ink.subtle,
        }}
      >
        {title}
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li
            key={item}
            style={{
              display: 'flex',
              gap: space(3),
              alignItems: 'flex-start',
              marginBottom: space(4),
              font: type(text.label, { leading: 1.65 }),
              color: ink.muted,
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: tone === 'brand' ? 14 : 5,
                height: 5,
                borderRadius: radius.pill,
                background: tone === 'brand' ? brand.base : line.strong,
                marginTop: 9,
              }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One suggestion, which is a button rather than a link because it sets state. */
function SuggestionButton({
  label,
  onPick,
}: {
  readonly label: string;
  readonly onPick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onPick}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: `${String(space(2))}px ${String(space(3))}px`,
        font: type(text.body),
        color: ink.base,
        background: hovered ? brand.wash : surface.page,
        border: `1px solid ${hovered ? brand.tint : line.hair}`,
        borderRadius: radius.small,
        marginBottom: space(1),
        transition: 'background-color 120ms ease, border-color 120ms ease',
      }}
    >
      {label}
    </button>
  );
}

/**
 * What we say when we cannot help.
 *
 * The two cases read differently on purpose. "Outside the pilot area" is a
 * statement about us; "we hold no record of that street" is a statement about
 * the query. Collapsing them into one message would tell somebody in Carlton
 * that their address does not exist.
 */
function UnsupportedNotice({
  problem,
  index,
}: {
  readonly problem: NonNullable<Problem>;
  readonly index: AddressIndex;
}) {
  const demonstration = index.addresses[0];
  return (
    <div
      role="alert"
      style={{
        margin: `${String(space(4))}px 0 0`,
        padding: `${String(space(3))}px ${String(space(4))}px`,
        background: advisory.fill,
        border: `1px solid ${advisory.line}`,
        borderRadius: radius.base,
        font: type(text.label, { leading: 1.55 }),
      }}
    >
      <strong
        style={{
          display: 'block',
          marginBottom: space(1),
          font: type(text.label, { weight: weight.semibold }),
          color: ink.strong,
        }}
      >
        {problem.kind === 'outside-pilot'
          ? 'That address is outside the area this pilot covers'
          : 'We have no record of that address'}
      </strong>
      <span style={{ color: advisory.ink }}>
        {problem.kind === 'outside-pilot' ? (
          <>
            <em>{problem.typed}</em> is on a street the pilot reaches, but this demonstration
            covers one square kilometre of Kensington and that address is not inside it. We are
            not able to say anything about drainage there.
          </>
        ) : (
          <>
            Nothing in the pilot area matches <em>{problem.typed}</em>. This demonstration covers
            one square kilometre of Kensington, so most Melbourne addresses will not be found.
          </>
        )}
      </span>
      {demonstration && (
        <span style={{ display: 'block', marginTop: space(2), color: advisory.ink }}>
          Try <strong>{demonstration.label}</strong> to see what the pilot area shows.
        </span>
      )}
    </div>
  );
}
