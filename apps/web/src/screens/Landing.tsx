/**
 * The first screen: find an address, or find out that we cannot help with it.
 *
 * Four things here are load-bearing rather than cosmetic.
 *
 * The privacy promise is one the code keeps — the index is local, the search
 * never takes a network, and the address is held in memory for the tab and
 * written nowhere. It used to be restated under the search box as well; the
 * review of 15 September cut that copy as a repeat of what the homepage's
 * *How to use the map* already says before anybody reaches this screen.
 *
 * An address we cannot resolve is never quietly swapped for one we can. The
 * three outcomes stay distinct all the way to the screen.
 *
 * The demonstration address is offered directly, because the address search
 * covers the City of Melbourne only and most people's own address is outside it. Without that
 * offer the honest answer is also a dead end, and a dead end on the first
 * screen is where somebody leaves.
 *
 * And the two lists, folded under *More information*, are why this page is not empty. It briefly
 * carried a rendering of the pilot square kilometre instead, which is worth
 * recording as a mistake: the instrument's palette is tuned to read discrete
 * facts against terrain, so as a picture it is dense, multi-hued and
 * hard-edged — it read as a screenshot pasted beside the writing, because that
 * is exactly what it was. Space on a first screen is better earned by saying
 * what somebody is about to get, and what they are not.
 */

import { type FormEvent, useId, useMemo, useState } from 'react';

import {
  type AddressIndex,
  type IndexedAddress,
  type Match,
  MAX_SUGGESTIONS,
  resolve,
  search,
} from '../address/search.js';
import {
  COMPARE_DEMONSTRATION_LABELS,
  DEMONSTRATION_LABELS,
  demonstrationAddress,
  demonstrationAddresses,
} from '../address/demonstration.js';
import { suburbsOf } from '../address/suburbs.js';
import type { Task } from '../session.js';
import type { SectionId } from '../tutorial/sections.js';
import { CoverageBadge, FixtureNotice } from '../ui/Shell.js';
import { COVERAGE, LAYER } from '../ui/terms.js';
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

/**
 * What the product does, and what it refuses to do, before anybody types.
 *
 * The second list is not a disclaimer bolted on at the end. It is the claim
 * the footer makes on every screen and the result screen makes again in its
 * own words, said once more at the only moment it can still change what
 * somebody expects — which is before they have asked for anything.
 */
const SHOWS: readonly string[] = [
  `${LAYER.paths} and ${LAYER.lowAreas.toLowerCase()} calculated from ground-height data`,
  'Drain pits and pipes in council records, including gaps where the record ends',
  `${LAYER.ground} and areas with limited measured data`,
];

const DOES_NOT: readonly string[] = [
  'It does not predict flooding.',
  'It does not show how deep water would be, or when it would arrive.',
  'It does not cover addresses outside the City of Melbourne.',
];

export interface LandingProps {
  readonly index: AddressIndex;
  /** Present only while the index is a stand-in. */
  readonly fixtureNote?: string | undefined;
  readonly onFound: (address: IndexedAddress) => void;
  readonly onUnsupported: (typed: string) => void;
  /**
   * Leave without giving an address.
   *
   * **This screen had no way out.** It is reached from the chooser, and it was
   * the only screen in the guided path with neither *Back* nor *Home* — so
   * somebody who opened it to look, or who picked the wrong section, could
   * only go on or use the browser's own back button. Every other screen in
   * this flow carries both, and a screen that asks for a home address is the
   * last one that should feel like it will not let go.
   *
   * Both are optional so that the screen still renders in isolation, and so
   * that a future caller with genuinely nowhere to go back to does not have to
   * invent a destination.
   */
  readonly onBack?: (() => void) | undefined;
  readonly onHome?: (() => void) | undefined;
  /**
   * The task waiting for this address, if one is.
   *
   * **The comparison's address screen used to be the explorer's.** Somebody
   * who had just pressed *Check an address* on the blocked-drain
   * comparison was asked to *See how rainwater may move near your address*
   * and offered *Explore this area*, which in the 15 September user test read
   * as having been sent somewhere else. The team's Figma (H2 and H3) gives the
   * comparison its own words; every other way here keeps these.
   */
  readonly task?: Task | null | undefined;
  /**
   * The guide section waiting for this address, if one is: `guideSection` in
   * the session. It names the title, so somebody who pressed the drainage
   * guide is asked to find drains rather than to see where rain moves.
   */
  readonly section?: SectionId | null | undefined;
}

/** The words that change with the task waiting for the address. */
export interface LandingCopy {
  readonly title: string;
  readonly lead: string;
  readonly submit: string;
}

/**
 * The explorer's words, with no section named.
 *
 * **The title says what to do, and the lead says where** (copy audit v2, #16).
 * The lead used to list the layers by their data names, which the chooser's
 * cards had just said in plainer words; now it says what the search covers.
 * Which suburbs that is stays under the input, where it is read while typing.
 */
export const EXPLORE_COPY: LandingCopy = {
  title: 'Enter your address',
  lead: 'Covers the City of Melbourne.',
  submit: 'Explore this area →',
};

/**
 * A title per guide section, so the screen matches the card that was pressed.
 * Terrain has no guide yet and takes the plain title.
 */
export const SECTION_TITLES: Partial<Record<SectionId, string>> = {
  drainage: 'Find drains near your address',
  'water-flow': 'See where rain may flow near your address',
  'low-areas': 'Find low areas near your address',
};

export const COMPARE_COPY: LandingCopy = {
  title: 'Which address do you want to check?',
  lead: 'We’ll find a drain near it you can test for a blocked-drain comparison.',
  submit: 'Find a drain →',
};

export const landingCopyFor = (
  task: Task | null | undefined,
  section: SectionId | null | undefined = null,
): LandingCopy => {
  if (task === 'compare') return COMPARE_COPY;
  const title = section === null || section === undefined ? undefined : SECTION_TITLES[section];
  return title === undefined ? EXPLORE_COPY : { ...EXPLORE_COPY, title };
};

type Problem =
  | { readonly kind: 'outside-pilot'; readonly typed: string }
  | { readonly kind: 'not-an-address'; readonly typed: string }
  | null;

export function Landing({
  index,
  fixtureNote,
  onFound,
  onUnsupported,
  onBack,
  onHome,
  task,
  section,
}: LandingProps) {
  const copy = landingCopyFor(task, section);
  // On the Kensington fallback the search covers less than the lead says.
  const lead = copy === COMPARE_COPY || index.clipped !== true ? copy.lead : COVERAGE.addressesFallback;
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const [focused, setFocused] = useState(false);
  const examplesId = useId();

  const suggestions: Match[] = useMemo(
    () => (typed.trim().length >= 2 ? search(index, typed, MAX_SUGGESTIONS) : []),
    [index, typed],
  );

  // Three to choose from (team feedback, 17 September), the comparison's own
  // where it is waiting: each of those is near a drain that shows a difference.
  const examples = demonstrationAddresses(
    index,
    copy === COMPARE_COPY ? COMPARE_DEMONSTRATION_LABELS : DEMONSTRATION_LABELS,
  );
  const suburbs = suburbsOf(index);

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
      {/*
        The way out, in the same two places every other screen keeps it: Back
        on the left, Home on the right. `justifyContent` puts Home against the
        right edge even when there is no Back beside it.
      */}
      {(onBack ?? onHome) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: onBack ? 'space-between' : 'flex-end',
            gap: space(4),
            marginBottom: space(6),
          }}
        >
          {onBack && (
            <button type="button" onClick={onBack} style={quiet}>
              ← Back
            </button>
          )}
          {onHome && (
            <button type="button" onClick={onHome} style={quiet}>
              Home
            </button>
          )}
        </div>
      )}

      <CoverageBadge />

      <h1
        className="landing__title"
        style={{ margin: `${String(space(5))}px 0 ${String(space(3))}px`, color: ink.strong }}
      >
        {copy.title}
      </h1>
      <p
        className="landing__lead"
        style={{ margin: `0 0 ${String(space(8))}px`, color: ink.muted, maxWidth: 560 }}
      >
        {lead}
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
            aria-describedby={suburbs.length > 0 ? 'address-suburbs' : undefined}
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
            {copy.submit}
          </button>
        </div>

        {/*
          Straight under the box, from the review of 15 September: which
          suburbs the search knows, so somebody in Brunswick finds out before
          typing rather than after. Read off the index -- see `suburbsOf`.
        */}
        {suburbs.length > 0 && (
          <p
            id="address-suburbs"
            style={{
              margin: `${String(space(2))}px 0 0`,
              font: type(text.small, { leading: 1.5 }),
              color: ink.muted,
            }}
          >
            Supported suburbs: {suburbs.join(', ')}
          </p>
        )}

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

        {suggestions.length === 0 && problem === null && examples.length > 0 && (
          <div
            style={{
              margin: `${String(space(3))}px 0 0`,
              font: type(text.label),
              color: ink.subtle,
            }}
          >
            <p id={examplesId} style={{ margin: 0 }}>
              Not sure? Try {examples.length === 1 ? 'this address' : 'one of these'}:
            </p>
            <ul
              aria-labelledby={examplesId}
              style={{
                listStyle: 'none',
                margin: `${String(space(1))}px 0 0`,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: space(1),
              }}
            >
              {examples.map((example) => (
                <li key={example.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onFound(example);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      font: type(text.label, { weight: weight.semibold }),
                      color: brand.ink,
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                      cursor: 'pointer',
                    }}
                  >
                    {example.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {problem !== null && <UnsupportedNotice problem={problem} index={index} />}
        {fixtureNote !== undefined && <FixtureNotice note={fixtureNote} />}
      </form>

      {/*
        Folded, from the review of 15 September: the two lists sat open under
        the search box and made the one thing this screen asks for -- an
        address -- the smallest thing on it. They are still one press away,
        and the summary says what is inside.
      */}
      <details className="landing__more" style={{ marginTop: space(10) }}>
        <summary
          style={{
            cursor: 'pointer',
            font: type(text.label, { weight: weight.semibold }),
            color: ink.strong,
          }}
        >
          More information
        </summary>
        <div
          style={{
            display: 'grid',
            gap: space(8),
            gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))',
            marginTop: space(5),
          }}
        >
          <Claims title="What this shows" items={SHOWS} tone="brand" />
          <Claims title="What it does not" items={DOES_NOT} tone="quiet" />
        </div>
      </details>
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
 * The two cases read differently on purpose. "Outside the address search area" is a
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
  const demonstration = demonstrationAddress(index);
  // A council address on the Kensington fallback is covered, just not by this map.
  const coverage = index.clipped === true ? COVERAGE.addressesFallback : COVERAGE.addresses;
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
          ? 'That address is outside the address search area'
          : 'We have no record of that address'}
      </strong>
      <span style={{ color: advisory.ink }}>
        {problem.kind === 'outside-pilot' && index.clipped === true ? (
          // On the fallback, a known street is most likely a covered address
          // this smaller map cannot show, not a number the record lacks.
          <>
            <em>{problem.typed}</em> is on a street we know, but not in the part of the address
            list this map can show. {coverage}
          </>
        ) : problem.kind === 'outside-pilot' ? (
          <>
            <em>{problem.typed}</em> is on a street we know, but that number is not in the address
            list. {coverage}
          </>
        ) : (
          <>
            Nothing in the address list matches <em>{problem.typed}</em>. {coverage}
          </>
        )}
      </span>
      {demonstration && (
        <span style={{ display: 'block', marginTop: space(2), color: advisory.ink }}>
          Try <strong>{demonstration.label}</strong> to see what the map shows.
        </span>
      )}
    </div>
  );
}

/**
 * The way-out buttons, in the chooser's own style so the two screens read as
 * one flow rather than as two pages that happen to follow each other.
 */
/**
 * Back and Home, shaped as buttons.
 *
 * They were bare words in the corners, and in the review of 15 September
 * nobody read them as controls. The chooser's two controls use the same shape.
 */
const quiet = {
  border: `1px solid ${line.strong}`,
  borderRadius: radius.base,
  background: surface.raised,
  padding: `${String(space(2))}px ${String(space(4))}px`,
  font: type(text.label, { weight: weight.semibold }),
  color: ink.strong,
  cursor: 'pointer',
} as const;
