/**
 * Before-rain checks: one place's card, and the plan the answers build.
 *
 * Epic 5's screens, from the team's Figma (file `atD5fleOrhvMjJ5m0pXYGt`,
 * *Get ready for heavy rain*, G1 to G5). Two pieces:
 *
 * - `PlaceCard` — one numbered place, the conditional action, the two answers,
 *   and *Why this place?* folded under them.
 * - `PreparePlan` — the places with their status, the reminders the answers
 *   earned, and the general actions every home gets.
 *
 * **The conditional action is the same at every place, and the plan says it
 * once per place rather than inventing a second kind of advice** (AC 5.2.2).
 * A place is a public street near the address; the only thing a resident is
 * asked to do about one is move a car or bins, and only if they leave them
 * there.
 *
 * **Nothing here is a score.** The count is places reviewed, both answers
 * count, and `NOT_A_SCORE` says what it is not (AC 5.4.1). *Done* and
 * *Completed* do not appear: the action is conditional and in the future, and
 * a tick against it would claim something about a storm that has not happened.
 */

import { type ReactNode, useId, useState } from 'react';

import { ASK_LINK, ASK_PROMPT } from '../ask/answers.js';

import {
  GENERAL_ACTIONS,
  type GeneralAction,
  NOT_A_SCORE,
  REPORT_PATHWAY,
  SAFETY,
  VICEMERGENCY,
} from '../prepare/actions.js';

import {
  FOR_EVERY_HOME,
  NO_PLACES,
  NO_PLACES_MEANS,
  PLACES_NEAR_YOU,
  PLACE_ACTION,
  PLACE_IS_THE_STREET,
  PLACE_RADIUS_M,
  PLACE_SOURCE,
  type Place,
  type Relevance,
  WHY_THIS_PLACE,
  applying,
  reminderFor,
  reviewedLine,
  statusOf,
} from '../prepare/places.js';
import { PRINT_PLAN, planHtml, printedPlan } from '../prepare/printable.js';
import { printDocument } from '../prepare/printing.js';
import { advisory, alert, brand, ink, line, radius, space, surface, text, type, weight } from '../ui/theme.js';

/** One numbered place, as the map's card shows it (Figma G2). */
export function PlaceCard({
  place,
  relevance,
  onReview,
  onNext,
}: {
  readonly place: Place;
  readonly relevance: Relevance;
  /** The reader's answer. Changing it is allowed and expected (AC 5.4.1). */
  readonly onReview: (relevance: Relevance) => void;
  /** Only where another numbered place is waiting (AC 5.1.2). */
  readonly onNext?: (() => void) | undefined;
}) {
  return (
    <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
      {/*
        No title here: the card this sits in carries `placeTitle` already, and
        a second copy of it was the first thing a reader saw twice.
      */}
      {/* The action before its explanation, as AC 5.1.2 asks. */}
      <p style={{ margin: `0 0 ${String(space(2))}px` }}>{PLACE_ACTION}</p>

      <div style={{ display: 'flex', gap: space(2), flexWrap: 'wrap', marginBottom: space(2) }}>
        <Answer
          label="Applies to me"
          chosen={relevance === 'applies'}
          onPress={() => {
            onReview('applies');
          }}
        />
        <Answer
          label="Doesn't apply to me"
          chosen={relevance === 'does-not-apply'}
          onPress={() => {
            onReview('does-not-apply');
          }}
        />
      </div>

      <WhyThisPlace />

      {onNext !== undefined && (
        <p style={{ margin: `${String(space(2))}px 0 0` }}>
          <button type="button" onClick={onNext} style={linkStyle}>
            Next place ›
          </button>
        </p>
      )}
    </div>
  );
}

/** The plan: the places, their reminders, and what every home can do (Figma G3). */
export function PreparePlan({
  address,
  places,
  relevance,
  onShowOnMap,
  onReset,
  onReport,
  onWhyOpen,
  onAsk,
  onCheckDrains,
}: {
  /** As the reader chose it. It is on the printed page and nowhere else. */
  readonly address: string;
  readonly places: readonly Place[];
  readonly relevance: Readonly<Record<number, Relevance>>;
  readonly onShowOnMap?: ((place: Place) => void) | undefined;
  readonly onReset?: (() => void) | undefined;
  /** The way into the reporting pathway, which is its own thing (AC 5.2.3). */
  readonly onReport?: (() => void) | undefined;
  /** A reminder's *Why this place?* opened, which the guide's step 4 waits on. */
  readonly onWhyOpen?: (() => void) | undefined;
  readonly onAsk?: ((actionId?: string) => void) | undefined;
  /** Step 3's first button: show the recorded drains near the address. */
  readonly onCheckDrains?: (() => void) | undefined;
}) {
  const reminders = applying(places, relevance);

  return (
    <div style={{ font: type(text.small, { leading: 1.5 }), color: ink.base }}>
      {/* `PREPARE_HEADING` belongs to the card around this, for the same
          reason the place card's title does. */}
      {places.length === 0 ? (
        /*
          AC 5.1.3, and the majority of addresses: no section for places at
          all, the reason said plainly, and no suggestion that an absence of
          marks is a safer address.
        */
        <div style={{ marginBottom: space(3) }}>
          <p style={{ margin: 0 }}>{NO_PLACES}</p>
          <p style={{ margin: `${String(space(1))}px 0 0`, color: ink.muted }}>{NO_PLACES_MEANS}</p>
        </div>
      ) : (
        <section aria-label={PLACES_NEAR_YOU} style={{ marginBottom: space(4) }}>
          <StepHeading step={1} label={PLACES_NEAR_YOU} aside={reviewedLine(places, relevance)} />
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {places.map((place) => {
              const answer = relevance[place.number] ?? null;
              return (
                <li key={place.number} style={{ marginBottom: space(2) }}>
                  <span style={{ display: 'flex', gap: space(2), alignItems: 'baseline' }}>
                    <Badge>{place.number}</Badge>
                    <span>
                      Place {place.number} · {statusOf(answer)}
                    </span>
                  </span>
                  {answer === 'applies' && (
                    <span
                      style={{
                        display: 'block',
                        margin: `${String(space(1))}px 0 0`,
                        marginLeft: 28,
                        padding: space(2),
                        background: brand.wash,
                        borderRadius: radius.small,
                      }}
                    >
                      <span style={{ display: 'block', font: type(text.micro), color: brand.ink }}>
                        When heavy rain is forecast
                      </span>
                      {reminderFor(place)}
                      {/*
                        No *Who can help* line here. AC 5.2.3 and 5.3.2 both
                        forbid one against a nearby place, and the reason the
                        line was there -- AC 6.2.3, that a preparation action
                        is the reader's own and never an organisation's -- is
                        met by naming nobody at all.
                      */}
                      {/*
                        Why this place?, under the reminder it is about (Figma
                        G3 and G4). It is also on the place's own card; a
                        reader who answered and moved on has the plan, and the
                        design puts the explanation where the reminder is.
                      */}
                      <WhyThisPlace {...(onWhyOpen === undefined ? {} : { onOpen: onWhyOpen })} />
                    </span>
                  )}
                  {onShowOnMap !== undefined && (
                    <span style={{ display: 'block', marginLeft: 28 }}>
                      <button
                        type="button"
                        onClick={() => {
                          onShowOnMap(place);
                        }}
                        style={linkStyle}
                      >
                        Show on map
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {reminders.length === 0 && (
            <p style={{ margin: 0, color: ink.muted }}>
              No reminders yet. A place you mark as applying to you adds one here.
            </p>
          )}
          <p style={{ margin: `${String(space(1))}px 0 0`, font: type(text.micro), color: ink.subtle }}>
            {NOT_A_SCORE}
          </p>
          {onReset !== undefined && (
            <button
              type="button"
              onClick={onReset}
              style={{ ...linkStyle, marginTop: space(1) }}
            >
              Reset my answers
            </button>
          )}
        </section>
      )}

      <section aria-label={FOR_EVERY_HOME} style={{ marginBottom: space(4) }}>
        <StepHeading step={2} label={FOR_EVERY_HOME} />
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {GENERAL_ACTIONS.map((action) => (
            <GeneralActionRow
              key={action.id}
              action={action}
              {...(onAsk === undefined
                ? {}
                : {
                    onAsk: () => {
                      onAsk(action.id);
                    },
                  })}
            />
          ))}
        </ul>
      </section>

      {/*
        Step 3 (Figma P1): the two things this plan hands off to, as the two
        buttons the design gives them rather than as links in a paragraph.

        Reporting is named and kept apart from the actions above it (AC 5.2.3,
        5.3.2). Preparing for rain is something the reader does; reporting is
        something they ask somebody else to do, and running the two together
        is how a plan starts reading as a list of chores from the council.
      */}
      {(onCheckDrains !== undefined || onReport !== undefined) && (
        <section aria-label={STREET_DRAINS_NEAR_YOU} style={{ marginBottom: space(4) }}>
          <StepHeading step={3} label={STREET_DRAINS_NEAR_YOU} />
          {onCheckDrains !== undefined && (
            <button type="button" onClick={onCheckDrains} style={primaryButton}>
              Check the street drains near you ›
            </button>
          )}
          {onReport !== undefined && (
            <button type="button" onClick={onReport} style={warningButton}>
              ⚠ {REPORT_PATHWAY} ›
            </button>
          )}
        </section>
      )}


        {onAsk !== undefined && (
          <p
            style={{
              display: 'flex',
              gap: space(2),
              alignItems: 'baseline',
              justifyContent: 'space-between',
              margin: `${String(space(3))}px 0 0`,
              padding: space(2),
              border: `1px solid ${brand.tint}`,
              borderRadius: radius.base,
              background: brand.wash,
            }}
          >
            <span style={{ color: brand.ink }}>{ASK_PROMPT}</span>

            <button
              type="button"
              onClick={() => {
                onAsk();
              }}
              style={{
                ...linkStyle,
                font: type(text.small, { weight: weight.semibold }),
              }}
            >
              {ASK_LINK} ›
            </button>
          </p>
      )}
      {/*
        The boundary, in full and above the telephone numbers (AC 5.3.3).

        The design shows only the pink line of numbers. The four sentences
        above it are not optional and are not folded: the plan is the one
        screen a person may read with rain coming, and *this does not tell you
        whether your property will flood* is the sentence that stops it being
        read as something it is not.
      */}
      <section aria-label={SAFETY_HEADING} style={{ marginBottom: space(3) }}>
        <Heading>{SAFETY_HEADING}</Heading>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: ink.muted }}>
          {SAFETY.slice(0, -2).map((sentence) => (
            <li key={sentence} style={{ marginBottom: space(1) }}>
              {sentence}
            </li>
          ))}
        </ul>
      </section>

      {/*
        The two telephone numbers, as the design's own band (Figma P1).

        They are the last two sentences of `SAFETY` and nothing else: lifted
        out of the list above rather than written again here, so there is one
        place they can be got wrong.
      */}
      <p
        style={{
          margin: `0 0 ${String(space(3))}px`,
          padding: space(2),
          borderRadius: radius.small,
          background: alert.fill,
          border: `1px solid ${alert.line}`,
          color: alert.ink,
          font: type(text.small, { leading: 1.5 }),
        }}
      >
        {SAFETY.slice(-2).join(' ')}
      </p>

      {/*
        Print or save (AC 5.4.3), outside the places section because an
        address with none still has a page worth keeping: the general actions
        and the numbers at the foot of it.
      */}
      <p
        style={{
          display: 'flex',
          gap: space(2),
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          margin: 0,
        }}
      >
        <button
          type="button"
          onClick={() => {
            printDocument(planHtml(printedPlan(address, places, relevance, new Date())));
          }}
          style={{
            padding: `${String(space(1))}px ${String(space(3))}px`,
            borderRadius: radius.pill,
            border: `1px solid ${brand.tint}`,
            background: brand.wash,
            color: brand.ink,
            font: type(text.small, { weight: weight.semibold }),
            cursor: 'pointer',
          }}
        >
          {PRINT_PLAN}
        </button>
        <a href={VICEMERGENCY.href} target="_blank" rel="noreferrer" style={{ color: brand.ink }}>
          {VICEMERGENCY.label} — current warnings ›
        </a>
      </p>

      <details style={{ marginTop: space(3) }}>
        <summary style={{ cursor: 'pointer', color: brand.ink }}>How this plan works</summary>
        <div style={{ marginTop: space(2), color: ink.muted }}>
          <p style={{ margin: `0 0 ${String(space(1))}px` }}>
            The numbered places are the nearest low areas DrainLens estimates near your address,
            within {PLACE_RADIUS_M} m. {PLACE_IS_THE_STREET}
          </p>
          <p style={{ margin: `0 0 ${String(space(1))}px` }}>
            What every home can do is taken from official guidance, and each line carries the
            publisher it came from.
          </p>
          <p style={{ margin: 0 }}>
            Your preparation answers stay in this browser. Chat questions are sent to the
          DrainLens assistant so it can answer them. Nothing here is saved as part of
          your preparation plan, and the printed page is made on your own device.
          </p>
        </div>
      </details>
    </div>
  );
}

/**
 * One general action, with its source folded under it (Figma P1, step 2).
 *
 * The design shows a photograph and two sentences of advice in the expanded
 * card. The advice is already here and it is better than a paraphrase: every
 * action carries **the sentence it was taken from**, with the publisher and
 * the date the page was read, so the thing that opens is the evidence rather
 * than a second helping of the same instruction. There is no photograph, for
 * the reason the blockage pictures are drawings: an unlicensed image of
 * somebody's gutter is one unrecorded licence more than this project has.
 *
 * The tick is for this visit only. It is not stored, not counted and not
 * printed, because a plan that remembers what you said you had done is
 * making a claim about a house it has never seen.
 */
function GeneralActionRow({
  action,
  onAsk,
}: {
  readonly action: GeneralAction;
  readonly onAsk?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState(false);
  const tipId = useId();

  return (
    <li style={{ marginBottom: space(2) }}>
      <span style={{ display: 'flex', gap: space(2), alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          checked={ticked}
          onChange={(event) => {
            setTicked(event.target.checked);
          }}
          aria-label={action.text}
          style={{ marginTop: 3, flexShrink: 0, accentColor: brand.base }}
        />
        <span style={{ flex: '1 0 0', minWidth: 0 }}>{action.text}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={tipId}
          aria-label={open ? `Hide the source for ${action.text}` : `Show the source for ${action.text}`}
          onClick={() => {
            setOpen((was) => !was);
          }}
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: radius.pill,
            border: `1px solid ${line.base}`,
            background: surface.raised,
            color: ink.muted,
            font: type(text.small),
            cursor: 'pointer',
          }}
        >
          {open ? '−' : '+'}
        </button>
      </span>

      {open && (
        <span
          id={tipId}
          style={{
            display: 'block',
            margin: `${String(space(1))}px 0 0 28px`,
            padding: space(2),
            background: surface.sunken,
            borderRadius: radius.small,
          }}
        >
          <span style={{ display: 'block', color: ink.muted }}>“{action.quote}”</span>
          <a
            href={action.page}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', marginTop: space(1), font: type(text.micro), color: brand.ink }}
          >
            {action.publisher}, read {action.checked} ↗
          </a>
          {onAsk !== undefined && (
            <button
              type="button"
              onClick={onAsk}
              style={{
                ...linkStyle,
                marginTop: space(1),
                font: type(text.small, { weight: weight.semibold }),
              }}
            >
              Ask a question about this ›
            </button>
          )}
        </span>
      )}
    </li>
  );
}

/** A numbered step heading, with its count on the right (Figma P1). */
function StepHeading({
  step,
  label,
  aside,
}: {
  readonly step: number;
  readonly label: string;
  readonly aside?: string | undefined;
}) {
  return (
    <p
      style={{
        display: 'flex',
        gap: space(2),
        alignItems: 'baseline',
        justifyContent: 'space-between',
        margin: `0 0 ${String(space(2))}px`,
        font: type(text.micro, { weight: weight.semibold }),
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: brand.ink,
      }}
    >
      <span>
        Step {step} · {label}
      </span>
      {aside !== undefined && <span style={{ color: ink.subtle }}>{aside}</span>}
    </p>
  );
}

/** The heading over the safety boundary, as the design writes it. */
const SAFETY_HEADING = 'Before you rely on this';

/**
 * *Why this place?*, folded, wherever a place is explained (AC 5.3.1).
 *
 * On the place's card and again under the reminder in the plan, because the
 * design puts it in both and a reader who has moved on to the plan has no way
 * back to the card. `onOpen` is how the guide's fourth step knows it happened.
 */
function WhyThisPlace({ onOpen }: { readonly onOpen?: (() => void) | undefined }) {
  const whyId = useId();
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(event) => {
        const nowOpen = (event.currentTarget as HTMLDetailsElement).open;
        setOpen(nowOpen);
        if (nowOpen) onOpen?.();
      }}
    >
      <summary aria-controls={whyId} style={{ cursor: 'pointer', color: brand.ink }}>
        Why this place?
      </summary>
      <div id={whyId} style={{ marginTop: space(1) }}>
        <p style={{ margin: 0 }}>{WHY_THIS_PLACE}</p>
        <p style={{ margin: `${String(space(1))}px 0 0`, font: type(text.micro), color: ink.subtle }}>
          {PLACE_SOURCE}
        </p>
        <p style={{ margin: `${String(space(1))}px 0 0`, color: ink.muted }}>{PLACE_IS_THE_STREET}</p>
      </div>
    </details>
  );
}

function Heading({ children }: { readonly children: ReactNode }) {
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

function Badge({ children }: { readonly children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: radius.pill,
        background: brand.base,
        color: ink.inverse,
        font: type(text.micro, { weight: weight.semibold }),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </span>
  );
}

function Answer({
  label,
  chosen,
  onPress,
}: {
  readonly label: string;
  readonly chosen: boolean;
  readonly onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onPress}
      style={{
        padding: `${String(space(1))}px ${String(space(3))}px`,
        borderRadius: radius.pill,
        border: `1px solid ${chosen ? brand.tint : line.base}`,
        background: chosen ? brand.wash : surface.raised,
        color: chosen ? brand.ink : ink.base,
        font: type(text.small, { weight: chosen ? weight.semibold : weight.regular }),
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/** Step 3's heading, as the design names it. */
const STREET_DRAINS_NEAR_YOU = 'Street drains near you';

/** The two full-width buttons of step 3 (Figma P1). */
const stepButton = {
  display: 'block',
  width: '100%',
  marginBottom: space(2),
  padding: `${String(space(3))}px ${String(space(3))}px`,
  borderRadius: radius.base,
  font: type(text.label, { weight: weight.semibold }),
  textAlign: 'center',
  cursor: 'pointer',
} as const;

const primaryButton = {
  ...stepButton,
  border: `1px solid ${brand.base}`,
  background: brand.base,
  color: ink.inverse,
} as const;

/*
  Amber, not green, and not red.

  Reporting is the one action on this plan that asks somebody else to do
  something, and the design colours it as a caution rather than as the thing
  to do next. Red is kept for the telephone numbers.
*/
const warningButton = {
  ...stepButton,
  border: `1px solid ${advisory.line}`,
  background: advisory.fill,
  color: advisory.ink,
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
