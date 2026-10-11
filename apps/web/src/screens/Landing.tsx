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
  search,
} from '@drainlens/address';
import {
  COMPARE_DEMONSTRATION_LABELS,
  DEMONSTRATION_LABELS,
  demonstrationAddress,
  demonstrationAddresses,
} from '../address/demonstration.js';
import { lookupAddress } from '../address/lookup.js';
import { RECENT_LABEL, recall } from '../address/recent.js';
import { suburbsOf } from '../address/suburbs.js';
import type { SupportedAddress, Task } from '../session.js';
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
  /**
   * The addresses looked up in this tab, newest first.
   *
   * Optional so the screen still renders in isolation, and defaulted to the
   * empty list rather than to undefined so that nothing downstream has to ask
   * which kind of nothing it got.
   */
  readonly recent?: readonly SupportedAddress[] | undefined;
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
  // Figma T0. One title for every way in, and the lead says what happens
  // next instead; see `landingCopyFor`.
  title: 'Start with your address',
  lead: 'Enter it once. Every guide and the full map will use it.',
  submit: 'Continue →',
};

/**
 * What comes after the address, said on the screen that asks for it.
 *
 * Figma draws one of these per entry point (T0g, T0d, T0m) and the generic
 * T0 for everything else. It replaced a title per section, which named the
 * guide in the heading and left the line underneath saying only which
 * council the map covers.
 */
export const NEXT_AFTER_ADDRESS: Partial<Record<SectionId, string>> = {
  'heavy-rain': 'Enter it once. The Get ready for heavy rain guide starts next.',
  'drainage-area': 'Enter it once. The drainage problem guide starts next.',
};

/** T0m, for the way in that opens the map rather than a guide. */
export const FULL_MAP_LEAD = 'Enter it once. The full map opens next.';

/**
 * T0's line under the suburbs, which the product did not say anywhere.
 *
 * **Rewritten on 11 October, three weeks after it stopped being true.** It
 * read *Your address stays in this browser only. You can change it at any
 * time.* The first clause went false on 9 October, when a submitted search
 * moved to `POST /api/addresses/search`. `DECISIONS-PENDING.md` §14
 * records that decision as withdrawing the on-screen promise in the same
 * change, and the privacy panel in `ui/sources.ts` was rewritten that day --
 * this line was missed, which is how the product spent three weeks making a
 * promise its own documents said it had withdrawn.
 *
 * **It is replaced rather than cut**, for the reason the panel gives: a line
 * that quietly drops a sentence it can no longer keep is worse than one that
 * never made it, and going silent here would leave *stays in this browser* as
 * the last thing a resident read about their address. So it still says where
 * the address goes and what becomes of it. The second clause is untouched; it
 * was never in question.
 *
 * It is the panel's claim in fewer words, because this sits under a search
 * field rather than in a panel: *no account, no record of the search, and
 * nothing written to our logs* is the whole of it, one press away under *Data
 * sources and limits*. The name stays `ADDRESS_STAYS_HERE` because the rule
 * it was named for is unchanged -- nothing about the address is written down,
 * here or at the other end. See *The address is never written down* in
 * `apps/web/README.md`.
 */
export const ADDRESS_STAYS_HERE =
  'Your address is searched by DrainLens and is not kept. You can change it at any time.';



/**
 * What the button says while a search is out.
 *
 * It replaces the task's own word rather than sitting beside it, because the
 * row is already two controls wide on a phone and a third thing appearing
 * mid-press moves the one being pressed. Both tasks share it: what is
 * happening is the same either way.
 */
export const SEARCHING = 'Searching…';

export const COMPARE_COPY: LandingCopy = {
  title: 'Which address do you want to check?',
  /*
    *Compare*, not *test*.

    This is the first screen of the comparison and it said *a drain near it
    you can test*, which is the claim the plain-English audit's first
    finding is about: the product never looks at a drain. The four labels
    inside the flow were changed and this one, which sets the reader's
    expectation before any of them, was missed.
  */
  lead: 'We’ll find a drain near it to compare clear against blocked.',
  submit: 'Find a drain →',
};

export const landingCopyFor = (
  task: Task | null | undefined,
  section: SectionId | null | undefined = null,
): LandingCopy => {
  if (task === 'compare') return COMPARE_COPY;
  if (task === 'full-map') return { ...EXPLORE_COPY, lead: FULL_MAP_LEAD };
  const lead = section === null || section === undefined ? undefined : NEXT_AFTER_ADDRESS[section];
  return lead === undefined ? EXPLORE_COPY : { ...EXPLORE_COPY, lead };
};

type Problem =
  | { readonly kind: 'outside-pilot'; readonly typed: string }
  | { readonly kind: 'not-an-address'; readonly typed: string }
  | null;

export function Landing({
  index,
  fixtureNote,
  recent = [],
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
  /*
    A search is out.

    The API's measured p95 is 85 ms and its cold start is 0.74 s, so this is
    usually off before anybody could see it -- but `--min-instances=0` means
    the first search after an idle period waits, and a button that looks
    unpressed while a request is in flight gets pressed again.
  */
  const [asking, setAsking] = useState(false);
  const examplesId = useId();
  const recentId = useId();

  const suggestions: Match[] = useMemo(
    () => (typed.trim().length >= 2 ? search(index, typed, MAX_SUGGESTIONS) : []),
    [index, typed],
  );

  /*
    What was searched for earlier in this tab, as rows this screen can offer.

    Resolved against the index rather than carried in the session, for the
    reason `recent.ts` gives -- and memoised on the list itself, which only
    changes when an address is chosen, so the pass over the index happens once
    per search rather than once per keystroke.
  */
  const recalled = useMemo(() => recall(index, recent), [index, recent]);

  /*
    **The recent list replaces the examples rather than stacking above them.**
    *Not sure? Try one of these* is for somebody who does not know what to
    type; somebody with their own addresses to go back to is not that person,
    and two lists of addresses under one field is a choice nobody asked for.
  */
  const showingRecent = typed.trim() === '' && problem === null && recalled.length > 0;

  // Three to choose from (team feedback, 17 September), the comparison's own
  // where it is waiting: each of those is near a drain that shows a difference.
  const examples = demonstrationAddresses(
    index,
    copy === COMPARE_COPY ? COMPARE_DEMONSTRATION_LABELS : DEMONSTRATION_LABELS,
  );
  const suburbs = suburbsOf(index);

  /*
    Submitted to the API, and answered from the index in memory when it
    cannot be reached.

    **This is the only request a search makes.** The suggestions above come
    from the index on every keystroke, which is where they stayed on
    9 October when the rest of this moved: a request per character would send
    a home address to a server one letter at a time to be told what the same
    function over the same rows has already said here. Pressing the button is
    one question, asked once.

    `lookupAddress` cannot throw and always answers, so there is no error
    branch -- a database that is down is a search that is answered by the
    bundled index, which is the same four verdicts by a different route.
  */
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (asking) return;
    setAsking(true);
    const { answer } = await lookupAddress({
      index,
      typed,
      onFallback: (reason) => {
        // To a console, not to the screen. Which of the two answered is not a
        // thing to put in front of somebody looking for their street, and the
        // answer is the same either way.
        console.warn(`the address search fell back to the bundled index: ${reason}`);
      },
    });
    setAsking(false);

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
    /*
      The street behind it, and the column on top.

      Two elements rather than one: the photograph has to fill the window
      and the content has to stay in its 720 px column, and a single element
      cannot do both. `.landing__street` carries the picture and the white
      veil that keeps the text readable; see `base.css` for the measured
      contrast.
    */
    <div className="landing__street">
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          /* Less room under the column than the other screens keep: the
             street below it closes the page, so a second block of empty
             space would only push it off the bottom. */
          padding: `${String(space(12))}px ${String(space(6))}px ${String(space(8))}px`,
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
      {/*
        `ink.base`, not `ink.muted`. This is the one line of text on the
        screen with the photograph behind it rather than a card: over the
        picture's darkest pixel under the wash, muted reaches 3.9:1 and base
        7.1:1, against the 4.5:1 AA asks for. See `.landing__street`.
      */}
      <p
        className="landing__lead"
        style={{ margin: `0 0 ${String(space(8))}px`, color: ink.base, maxWidth: 560 }}
      >
        {lead}
      </p>

      <form
        onSubmit={(event) => {
          void submit(event);
        }}
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
            disabled={asking}
            style={{
              padding: `${String(space(3))}px ${String(space(5))}px`,
              font: type(text.body, { weight: weight.semibold }),
              color: ink.inverse,
              background: asking ? brand.hover : brand.base,
              border: 'none',
              borderRadius: radius.base,
              transition: 'background-color 120ms ease',
            }}
            onMouseEnter={(event) => {
              if (!asking) event.currentTarget.style.background = brand.hover;
            }}
            onMouseLeave={(event) => {
              if (!asking) event.currentTarget.style.background = brand.base;
            }}
          >
            {asking ? SEARCHING : copy.submit}
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

        {/*
          T0's last line. What becomes of the address is said on the page that
          asks for it, rather than only in About the data. It used to say the
          address never leaves the tab; since 9 October a submitted search is
          answered by our own API, so what is promised here is the narrower
          thing the privacy panel promises -- see `ADDRESS_STAYS_HERE`.
        */}
        <p
          style={{
            margin: `${String(space(2))}px 0 0`,
            font: type(text.small, { leading: 1.5 }),
            color: ink.muted,
          }}
        >
          {ADDRESS_STAYS_HERE}
        </p>

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

        {showingRecent && (
          <div style={{ margin: `${String(space(3))}px 0 0` }}>
            <p
              id={recentId}
              style={{ margin: 0, font: type(text.label), color: ink.subtle }}
            >
              {RECENT_LABEL}
            </p>
            <ul
              aria-labelledby={recentId}
              style={{ listStyle: 'none', margin: `${String(space(2))}px 0 0`, padding: 0 }}
            >
              {recalled.map((address) => (
                <li key={address.id}>
                  <SuggestionButton
                    label={address.label}
                    onPick={() => {
                      onFound(address);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {!showingRecent && suggestions.length === 0 && problem === null && examples.length > 0 && (
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
