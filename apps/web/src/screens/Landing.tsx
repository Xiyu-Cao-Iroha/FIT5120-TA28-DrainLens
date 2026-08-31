/**
 * The first screen: find an address, or find out that we cannot help with it.
 *
 * Two things here are load-bearing rather than cosmetic.
 *
 * The privacy line is a promise the code keeps — the index is local, the
 * search never takes a network, and the address is held in memory for the tab
 * and written nowhere. It is stated on the screen because a person deciding
 * whether to type their own address deserves to know before they type it, not
 * in a policy they will not open.
 *
 * And an address we cannot resolve is never quietly swapped for one we can.
 * The three outcomes stay distinct all the way to the screen.
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
import { FixtureNotice, PILOT_BADGE } from '../ui/Shell.js';

export const PRIVACY_LINE =
  'No account is required. Your address stays in this browser tab: it is not sent anywhere, and nothing is kept when you close it.';

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

export function Landing({ index, fixtureNote, onFound, onUnsupported }: LandingProps) {
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<Problem>(null);

  const suggestions: Match[] = useMemo(
    () => (typed.trim().length >= 2 ? search(index, typed, MAX_SUGGESTIONS) : []),
    [index, typed],
  );

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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 64px' }}>
      <span
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: 999,
          background: '#e2efe9',
          color: '#2c5f52',
          fontSize: 13,
        }}
      >
        {PILOT_BADGE}
      </span>

      <h1 style={{ margin: '18px 0 10px', fontSize: 34, lineHeight: 1.15, letterSpacing: -0.5 }}>
        See how rainwater may move near your address
      </h1>
      <p style={{ margin: '0 0 26px', fontSize: 17, color: '#4d5f6e', maxWidth: 560 }}>
        Explore local surface water paths, public drainage connections and a simplified
        drain-blockage scenario.
      </p>

      <form
        onSubmit={submit}
        style={{
          padding: 18,
          background: '#ffffff',
          border: '1px solid #e6ebe4',
          borderRadius: 12,
        }}
      >
        <label htmlFor="address" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
          Enter an address
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            id="address"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setProblem(null);
            }}
            placeholder="Start typing an address"
            autoComplete="off"
            style={{
              flex: '1 1 260px',
              minWidth: 0,
              padding: '11px 13px',
              fontSize: 15,
              border: '1px solid #d5ded2',
              borderRadius: 8,
              font: 'inherit',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '11px 20px',
              fontSize: 15,
              fontWeight: 600,
              color: '#ffffff',
              background: '#1f6f5c',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Explore this area →
          </button>
        </div>

        {suggestions.length > 0 && (
          <ul
            aria-label="Matching addresses"
            style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}
          >
            {suggestions.map((match) => (
              <li key={match.address.id}>
                <button
                  type="button"
                  onClick={() => onFound(match.address)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 12px',
                    background: '#f6f8f4',
                    border: '1px solid #e6ebe4',
                    borderRadius: 8,
                    marginBottom: 6,
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  {match.address.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6b7a88' }}>
          <span aria-hidden>◇ </span>
          {PRIVACY_LINE}
        </p>

        {problem !== null && <UnsupportedNotice problem={problem} index={index} />}
        {fixtureNote !== undefined && <FixtureNotice note={fixtureNote} />}
      </form>
    </div>
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
        margin: '14px 0 0',
        padding: '12px 14px',
        background: '#fdf7e3',
        border: '1px solid #f0e4bd',
        borderRadius: 8,
        fontSize: 14,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>
        {problem.kind === 'outside-pilot'
          ? 'That address is outside the area this pilot covers'
          : 'We have no record of that address'}
      </strong>
      <span style={{ color: '#6b5b28' }}>
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
        <span style={{ display: 'block', marginTop: 8 }}>
          Try <strong>{demonstration.label}</strong> to see what the pilot area shows.
        </span>
      )}
    </div>
  );
}
