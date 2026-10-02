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

import {
  GENERAL_ACTIONS,
  NOT_A_SCORE,
  SAFETY,
  VICEMERGENCY,
  WHO_FOR_A_PLACE,
} from '../prepare/actions.js';
import {
  FOR_EVERY_HOME,
  NO_PLACES,
  NO_PLACES_MEANS,
  PLACES_NEAR_YOU,
  PLACE_ACTION,
  PLACE_IS_THE_STREET,
  PLACE_SOURCE,
  type Place,
  type Relevance,
  WHY_THIS_PLACE,
  applying,
  reminderFor,
  reviewedLine,
  statusOf,
} from '../prepare/places.js';
import { brand, ink, line, radius, space, surface, text, type, weight } from '../ui/theme.js';

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
  const whyId = useId();
  const [whyOpen, setWhyOpen] = useState(false);

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

      <details
        open={whyOpen}
        onToggle={(event) => {
          setWhyOpen((event.currentTarget as HTMLDetailsElement).open);
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
  places,
  relevance,
  onShowOnMap,
  onReset,
}: {
  readonly places: readonly Place[];
  readonly relevance: Readonly<Record<number, Relevance>>;
  readonly onShowOnMap?: ((place: Place) => void) | undefined;
  readonly onReset?: (() => void) | undefined;
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
        <section aria-label={PLACES_NEAR_YOU} style={{ marginBottom: space(3) }}>
          <Heading>
            {PLACES_NEAR_YOU} · {reviewedLine(places, relevance)}
          </Heading>
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
                      {/* AC 5.3.2 and 6.2.3: a place is the reader's own, never an organisation's. */}
                      <span style={{ display: 'block', font: type(text.micro), color: ink.subtle }}>
                        Who can help: {WHO_FOR_A_PLACE}
                      </span>
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

      <section aria-label={FOR_EVERY_HOME}>
        <Heading>{FOR_EVERY_HOME}</Heading>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {GENERAL_ACTIONS.map((action) => (
            <li key={action.id} style={{ marginBottom: space(2) }}>
              {action.text}
              <span style={{ display: 'block', font: type(text.micro), color: ink.subtle }}>
                {action.publisher}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/*
        The boundary, in full and at the foot of the plan (AC 5.3.3).

        Not folded and not shortened: the plan is the one screen a person may
        read with rain coming, and the last two lines are telephone numbers.
      */}
      <section aria-label={SAFETY_HEADING} style={{ marginTop: space(3) }}>
        <Heading>{SAFETY_HEADING}</Heading>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: ink.muted }}>
          {SAFETY.map((sentence) => (
            <li key={sentence} style={{ marginBottom: space(1) }}>
              {sentence}
            </li>
          ))}
        </ul>
        <p style={{ margin: `${String(space(1))}px 0 0` }}>
          <a
            href={VICEMERGENCY.href}
            target="_blank"
            rel="noreferrer"
            style={{ color: brand.ink }}
          >
            {VICEMERGENCY.label} — current warnings ›
          </a>
        </p>
      </section>
    </div>
  );
}

/** The heading over the safety boundary, as the design writes it. */
const SAFETY_HEADING = 'Before you rely on this';

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
