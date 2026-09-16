/**
 * The guide: the real map, with somebody talking beside it.
 *
 * **It is the map, not a picture of one.** The design was mocked with
 * screenshots, and building it that way would have been quicker and wrong: the
 * reader would learn a control that does not exist, and AC 1.1.2's *open the
 * local map* would stop being met the moment a card led here instead. What
 * they press is `MapView`, with its own chips, its own canvas and its own pit
 * card — narrowed to the layers the section is about, and then to the one the
 * step is about. Which layers those are belongs to the lesson, not here.
 *
 * **The guide reads the map; it never drives it.** `onMapNow` reports what is
 * on and what is selected, and the step is derived from that. Nothing here
 * calls back into the map to turn a layer on, because a guide that can satisfy
 * its own instructions is a guide that teaches nothing — and because the first
 * time somebody switches Pits back off, the words beside the map have to
 * follow them back rather than carry on describing a map that is not there.
 *
 * **The ground height guide added four things here** (Figma Terrain Tutorial,
 * 16 September), each switched on by its lesson rather than by its name: an
 * entry screen (`intro`), questions (`quiz` steps), Previous (`previous`),
 * and marks drawn over the map at real spot heights and a real contour near
 * the address (`withGround`, chosen by `tutorial/terrainPoints.ts`). The three
 * older lessons set none of them and render as they did.
 */

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import type { AddressIndex } from '../address/search.js';
import type { MapArtefact } from '../map/artefact.js';
import type { DerivedArtefact } from '../map/derived.js';
import { NOTHING_ON } from '../map/modes.js';
import type { GuideOverlay } from '../map/guideMarks.js';
import { RAMP_GRADIENT } from '../map/terrain.js';
import type { Viewport } from '../map/viewport.js';
import type { SupportedAddress } from '../session.js';
import type { TraceArtefact } from '../trace/graph.js';
import { chooseTeachingPit } from '../tutorial/pit.js';
import {
  type Finished,
  type Lesson,
  type LessonIntro,
  type MapNow,
  NOTHING_ON_MAP,
  type Step,
  type StepCard,
  chipFor,
  finished,
  highlightFor,
  latch,
  satisfied,
  stepBack,
  stepForward,
  stepIndex,
} from '../tutorial/lesson.js';
import { lessonFor } from '../tutorial/lessons.js';
import { SECTIONS, type SectionId } from '../tutorial/sections.js';
import { marksFor } from '../tutorial/terrain.js';
import {
  MARK_MARGIN_PX,
  type GroundMarks,
  chooseTerrainPoints,
  guideKeepOut,
  loadGroundMarks,
  viewTest,
} from '../tutorial/terrainPoints.js';
import {
  advisory,
  alert,
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
import { LAYER } from '../ui/terms.js';
import { MapView } from './MapView.js';

export interface GuideProps {
  readonly map: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly trace: TraceArtefact;
  readonly index: AddressIndex;
  /** Chosen before the guide starts. The guide has nothing to point at without one. */
  readonly address: SupportedAddress;
  /** Which section is being taught. Its lesson decides everything below. */
  readonly section: SectionId;
  readonly onFinish: () => void;
  /**
   * Back to the guidance page without finishing: *Skip for now* on a
   * lesson's entry screen. Absent, the entry screen has no skip.
   */
  readonly onLeave?: () => void;
}

export function Guide({ map, derived, trace, index, address, section, onFinish, onLeave }: GuideProps) {
  const [now, setNow] = useState<MapNow>(NOTHING_ON_MAP);
  /** How many `read` steps have been pressed past. See `stepIndex`. */
  const [acknowledged, setAcknowledged] = useState(0);
  /** Past the entry screen, for a lesson that has one. */
  const [started, setStarted] = useState(false);
  /**
   * The step Previous is showing, or null for the step the map is on.
   * See `stepBack` and `stepForward`.
   */
  const [cursor, setCursor] = useState<number | null>(null);
  /** The option last chosen on each question, by step id. */
  const [answers, setAnswers] = useState<Readonly<Record<string, number>>>({});
  /** The view the map opened on, which markers are chosen inside. */
  const [opening, setOpening] = useState<Viewport | null>(null);
  /** The ground near the address: undefined while loading, null if it could not be. */
  const [ground, setGround] = useState<GroundMarks | null | undefined>(undefined);

  const lesson = lessonFor(section);

  /*
    Recomputed only when the address moves, and only for a lesson that needs
    it. The choice walks every inlet in the extent and traces each one, which
    is a few hundred graph walks -- cheap once, and pointless for a lesson that
    asks for a layer rather than for a feature.
  */
  const wantsPit = lesson?.teachingPit ?? false;
  const teaching = useMemo(
    () =>
      wantsPit
        ? chooseTeachingPit([address.eastingM, address.northingM], map.layers.pit ?? [], trace)
        : null,
    [wantsPit, address.eastingM, address.northingM, map.layers.pit, trace],
  );
  const teachingId = teaching === null ? null : String(teaching.pit.asset_number);

  /*
    An address near the edge of the extent puts its pit near the edge of the
    canvas, and the bottom-right corner is where the map keeps its controls.

    32 Altona Street sits at (985.9, 25.7) of a 1000 m square -- fifteen metres
    from two boundaries -- and its teaching pit rendered at (1068, 751) of a
    1080x775 canvas, behind the zoom pair. The map clamps its view to the
    extent and cannot centre an address that is already in the corner, which is
    recorded behaviour rather than a bug. What was a bug was the guide asking
    somebody to press a thing it had a button sitting on top of.

    Two things moved, none of which is "open somewhere other than the
    address", and the map can now be dragged, so a pit under the zoom pair is
    one drag from being pressable:

    - The homepage's example address is 46 Gatehouse Drive, 307 m from the
      nearest boundary, whose teaching pit is 24 m away with 22 pipes below it.
      32 Altona Street was the worst address in the index for this and was the
      one being demonstrated.
    - When the API answers, the map is the whole council and Kensington is in
      the middle of it, so the clamp never bites at all.

    The edge itself stays: somebody may still type a corner address, and the
    pit is then visible and pressable at the frame's edge rather than under
    something.
  */

  /*
    The spot heights and contours near the address, for a lesson that names
    them. Only `marks.json` for the tiles around the address: the map fetches
    its own images. A failure is the same as no data -- the steps keep their
    general wording -- rather than a broken guide.
  */
  const wantsGround = lesson?.withGround !== undefined;
  const { min_e: mapMinE, min_n: mapMinN } = map.extent;
  useEffect(() => {
    if (!wantsGround) return undefined;
    let live = true;
    setGround(undefined);
    loadGroundMarks(
      '/data/terrain-tiles',
      [address.eastingM, address.northingM],
      { min_e: mapMinE, min_n: mapMinN },
      async (url) => (await fetch(url)).json() as Promise<unknown>,
    )
      .then((marks) => {
        if (live) setGround(marks);
      })
      .catch(() => {
        if (live) setGround(null);
      });
    return () => {
      live = false;
    };
  }, [wantsGround, address.eastingM, address.northingM, mapMinE, mapMinN]);

  // The first view the canvas reports, kept: points are chosen once, inside
  // the view the guide opens on, and do not move when the map is dragged.
  const seeView = useCallback((viewport: Viewport | null) => {
    if (viewport !== null) setOpening((held) => held ?? viewport);
  }, []);

  const points = useMemo(
    () =>
      ground === undefined || ground === null || opening === null
        ? null
        : chooseTerrainPoints(
            ground,
            [address.eastingM, address.northingM],
            viewTest(opening, MARK_MARGIN_PX, guideKeepOut(opening)),
            address.id,
          ),
    [ground, opening, address.eastingM, address.northingM, address.id],
  );

  // Stable, so `MapView`'s effect does not fire on every render of this one.
  // Latched: see `latch` for why a closed panel does not undo step one.
  const report = useCallback((next: MapNow) => {
    setNow((before) => latch(before, next));
  }, []);

  /*
    A section with no lesson written cannot be started, and the chooser will
    not offer it -- `GUIDED_SECTIONS` is derived from the lessons that exist.
    This is the guard for the path that does not go through the chooser, and
    it says what is missing rather than rendering a guide with no steps in it.
  */
  if (lesson === undefined) {
    return <NotWritten section={section} onFinish={onFinish} />;
  }

  const steps = lesson.withGround === undefined ? lesson.steps : lesson.withGround(points);
  const index0 = stepIndex(steps, now, teachingId, acknowledged);
  const done = finished(steps, now, teachingId, acknowledged);
  const intro = lesson.intro !== undefined && !started ? lesson.intro : null;
  /*
    What is on screen: the step the map is on, or an earlier one Previous went
    back to. The map is not rewound -- Previous is for reading, and a guide
    that switched layers off to match a step looked back at would be driving
    the map, which it never does.
  */
  const shown = cursor ?? index0;
  const lookingBack = cursor !== null;
  const step = steps[shown];
  const stepDone =
    step?.kind === 'do' && (lookingBack || satisfied(step.requires, now, teachingId));

  /*
    The ringed pit appears on the step that asks for it, not before.

    It was ringed from the first step, so the step explaining what the symbols
    are was read beside one of them already marked with a council ID -- an
    answer on screen before the question (review of 15 September, item 14).
    The ring no longer carries the council ID either, and the coach no longer
    names it (copy audit v2, #23, #28): the step says *the drain with the
    orange ring*, and an internal number is nothing a resident can use.
    And on that step the view is fitted to the address and the pit together:
    the pit is the nearest one that leads somewhere, which is not always
    inside the 300 m the guide opens on.
  */
  const pitStep = steps.findIndex((s) => s.kind === 'do' && s.requires === 'pit-selected');
  const pitAsked = teaching !== null && pitStep >= 0 && (done || index0 >= pitStep);

  /*
    The chip the current step is waiting on, outlined on the map.

    It replaced *Waiting for you to try it* under every `do` step (copy audit
    v2, #21): the line read like a system log, and the reader's question at
    that moment is where to press, which an outline answers and a sentence
    beside the map does not.
  */
  const waiting = intro === null && !lookingBack && !done && step !== undefined && !stepDone;
  const pulseChip = waiting && step.kind === 'do' ? chipFor(step.requires) : null;
  const highlight =
    intro === null && step !== undefined && (step.kind !== 'do' || waiting) ? highlightFor(step, now) : null;

  /*
    The marks for the step on screen. The step-7 drawing is an illustration
    and is built here; the rest are places, from `marksFor`.
  */
  const mark = intro === null ? step?.mark : undefined;
  const overlay: GuideOverlay | null =
    mark === 'slope-example' ? { node: <SlopeExample /> } : marksFor(mark, points);
  const chrome = lesson.mapChrome;

  return (
    /*
      A framed map on the left and the question on the right, as the design
      draws it.

      The map is a box rather than the whole screen because this is a lesson
      about it, not a session in it: a full-bleed map puts the instruction in a
      corner of the thing it is describing, and the reader's eye has nowhere to
      rest between reading and doing. It is still the *real* map, with its own
      chips and its own pit card -- the frame changes its size, not what it is.
    */
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        gap: space(8),
        alignItems: 'center',
        justifyContent: 'center',
        padding: space(8),
        flexWrap: 'wrap',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          position: 'relative',
          // Wider for a lesson that shows the legend, which is 260 pixels of
          // the top right and covered half of the 560-pixel frame.
          width: chrome?.wide === true ? 'min(760px, 100%)' : 'min(560px, 100%)',
          height: chrome?.wide === true ? 'min(540px, 72vh)' : 'min(480px, 70vh)',
          flexShrink: 0,
          border: `1px solid ${line.base}`,
          borderRadius: radius.large,
          boxShadow: shadow.lifted,
          overflow: 'hidden',
          background: surface.raised,
        }}
      >
        <MapView
          map={map}
          derived={derived}
          trace={trace}
          index={index}
          address={address}
          task="follow"
          // Nothing on. Every lesson opens with an empty map and the first
          // instruction turns something on -- and the guided preset had
          // already pressed it. See `openWith` in MapView.
          openWith={NOTHING_ON}
          chipKeys={lesson.chips(index0, now)}
          pulseChip={pulseChip}
          highlight={highlight}
          overlay={overlay}
          onViewport={seeView}
          // Off unless the lesson's layer lives behind it, which only ground
          // height's does.
          layersButton={chrome?.layersButton ?? false}
          // 260 pixels of the top right, over the number badge on the very pit
          // the guide is asking for -- and repeating the sentence the step
          // beside the map is already saying. The ground height guide keeps it,
          // because two of its steps are about the scale in it.
          legend={chrome?.legend ?? false}
          /*
            The view moves: drag, wheel, and the zoom pair in the corner.

            It used to be held where it opened, on the reasoning that a reader
            who dragged away would be asked for something no longer on screen.
            The review of 14 September found the opposite problem: a small map
            that cannot be moved reads as a picture of a map, and people tried
            to drag it and zoom it and concluded it was broken. The way back is
            the recentre button over the zoom pair, which returns to the
            address and so to the ringed pit beside it.
          */
          // The compass card is bigger than this frame can carry; the pin stays.
          addressCard={false}
          /*
            300 m across, not the map's usual 3 px/m.

            In a 560-pixel frame the default opens 187 metres wide, and for an
            address in the corner of the extent -- where the view is clamped
            and cannot centre -- that was one street and a pin, with the pit
            being asked for off in a corner. This is the fix that was deferred
            when the frame was full-screen and the tightness was cosmetic.
          */
          openAcrossM={300}
          highlightPit={pitAsked ? (teaching.pit.asset_number ?? null) : null}
          fit={
            pitAsked
              ? {
                  key: `teaching:${teachingId ?? ''}`,
                  points: [[address.eastingM, address.northingM], teaching.pit.c],
                  reservePanel: false,
                }
              : null
          }
          onMapNow={report}
        />
      </div>

      <Coach
        address={address}
        lesson={lesson}
        intro={intro}
        step={step}
        stepNumber={shown}
        total={steps.length}
        done={done && !lookingBack}
        lookingBack={lookingBack}
        stepDone={stepDone}
        groundOff={lesson.withGround !== undefined && !now.terrain}
        answer={step === undefined ? undefined : answers[step.id]}
        onAnswer={(option) => {
          if (step !== undefined) setAnswers((held) => ({ ...held, [step.id]: option }));
        }}
        onStart={() => {
          setStarted(true);
        }}
        {...(onLeave === undefined ? {} : { onLeave })}
        onNext={() => {
          if (lookingBack) setCursor(stepForward(shown, index0));
          else setAcknowledged(shown + 1);
        }}
        onPrevious={() => {
          setCursor(stepBack(shown));
        }}
        onFinish={onFinish}
      />
    </div>
  );
}

function Coach({
  address,
  lesson,
  intro,
  step,
  stepNumber,
  total,
  done,
  lookingBack,
  stepDone,
  groundOff,
  answer,
  onAnswer,
  onStart,
  onLeave,
  onNext,
  onPrevious,
  onFinish,
}: {
  readonly address: SupportedAddress;
  readonly lesson: Lesson;
  /** The entry screen's copy, while it is showing. */
  readonly intro: LessonIntro | null;
  readonly step: Step | undefined;
  readonly stepNumber: number;
  readonly total: number;
  readonly done: boolean;
  /** Showing a step Previous went back to. */
  readonly lookingBack: boolean;
  /** A `do` step whose action is done, or looked back at. */
  readonly stepDone: boolean;
  /** The ground height guide, with Ground height switched off. */
  readonly groundOff: boolean;
  readonly answer: number | undefined;
  readonly onAnswer: (option: number) => void;
  readonly onStart: () => void;
  readonly onLeave?: () => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onFinish: () => void;
}) {
  const previous = lesson.previous === true;
  const [moreOpen, setMoreOpen] = useState(false);
  // A new step starts with its extra card folded.
  const stepId = step?.id;
  useEffect(() => {
    setMoreOpen(false);
  }, [stepId]);

  /*
    The option shown as chosen. Looking back at a question that was passed,
    it is the right one, whatever was pressed first.
  */
  const chosen =
    step?.kind === 'quiz' && lookingBack ? step.options.findIndex((o) => o.correct) : answer;
  const right = step?.kind === 'quiz' && chosen !== undefined && step.options[chosen]?.correct === true;

  /*
    Next, when there is one.

    A `read` step always has it. A question has it once it is answered right.
    A `do` step has none, and not a disabled one either: the step is finished
    by working the map, and a greyed-out Next beside that reads as the way
    forward being broken (copy audit v2, #21) -- except a step that holds for
    its `done` line, once done. Looking back, Next always moves forward again.
  */
  const hasNext =
    step !== undefined &&
    (lookingBack ||
      step.kind === 'read' ||
      (step.kind === 'quiz' && right) ||
      (step.kind === 'do' && step.confirm === true && stepDone));

  return (
    <aside
      aria-label="Guide"
      style={{
        width: 'min(460px, 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: space(5),
      }}
    >
      <div>
        <div
          style={{
            font: type(text.small, { weight: weight.medium }),
            letterSpacing: tracking.caps,
            textTransform: 'uppercase',
            color: ink.subtle,
          }}
        >
          Current address
        </div>
        <div style={{ font: type(text.body, { weight: weight.medium }), color: ink.strong }}>
          {address.label}
        </div>
      </div>

      {intro !== null ? (
        <Intro intro={intro} onStart={onStart} {...(onLeave === undefined ? {} : { onLeave })} />
      ) : (
        <>
          <Progress done={done ? total : stepNumber} total={total} />

          {done ? (
            lesson.finished.badge === undefined ? (
              <Done copy={lesson.finished} onFinish={onFinish} />
            ) : (
              <Complete copy={lesson.finished} onPrevious={onPrevious} onFinish={onFinish} />
            )
          ) : (
            step !== undefined && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: space(2) }}>
                  <p
                    style={{
                      margin: 0,
                      font: type(text.display, { weight: weight.semibold, leading: 1.25 }),
                      color: ink.strong,
                    }}
                  >
                    {step.prompt}
                  </p>

                  {step.body !== undefined && (
                    <p style={{ margin: 0, font: type(text.lead, { leading: 1.5 }), color: ink.muted }}>
                      {step.body}
                    </p>
                  )}
                </div>

                {step.kind === 'do' && step.hint !== undefined && (
                  <p style={{ margin: 0, font: type(text.body, { leading: 1.5 }), color: ink.muted }}>
                    {step.hint}
                  </p>
                )}

                {/*
                  Small print under the heading, for the one caveat a step keeps
                  (copy audit v2, #36, #50).
                */}
                {step.kind === 'read' && step.note !== undefined && (
                  <p style={{ margin: 0, font: type(text.label, { leading: 1.5 }), color: ink.muted }}>
                    {step.note}
                  </p>
                )}

                {step.card !== undefined && <Card card={step.card} />}

                {/*
                  Said rather than left to be noticed: every step from here to
                  the last is about a layer the reader has switched back off.
                */}
                {groundOff && step.kind !== 'do' && (
                  <p style={{ margin: 0, font: type(text.label, { leading: 1.5 }), color: alert.ink }}>
                    {LAYER.ground} is off, so its colours are hidden. Turn it on in Layers to see them.
                  </p>
                )}

                {step.kind === 'quiz' && (step.question !== undefined || step.questionHint !== undefined) && (
                  <div
                    style={{
                      padding: `${String(space(3))}px ${String(space(4))}px`,
                      borderRadius: radius.base,
                      background: brand.wash,
                    }}
                  >
                    {step.question !== undefined && (
                      <p style={{ margin: 0, font: type(text.body, { weight: weight.semibold }), color: ink.strong }}>
                        {step.question}
                      </p>
                    )}
                    {step.questionHint !== undefined && (
                      <p style={{ margin: `${String(space(2))}px 0 0`, font: type(text.label), color: ink.base }}>
                        {step.questionHint}
                      </p>
                    )}
                  </div>
                )}

                {step.kind === 'quiz' && (
                  <div role="group" aria-label="Answers" style={{ display: 'flex', gap: space(3), flexWrap: 'wrap' }}>
                    {step.options.map((option, at) => (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={chosen === at}
                        // Nothing to change once the right answer is in.
                        disabled={right}
                        onClick={() => {
                          onAnswer(at);
                        }}
                        style={optionStyle(chosen === at, option.correct)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}

                {step.kind === 'do' && stepDone && step.done !== undefined && (
                  <div
                    role="status"
                    style={{
                      padding: `${String(space(3))}px ${String(space(4))}px`,
                      borderRadius: radius.base,
                      background: brand.wash,
                      font: type(text.body, { weight: weight.semibold, leading: 1.45 }),
                      color: brand.ink,
                    }}
                  >
                    {step.done}
                  </div>
                )}

                {(hasNext || (previous && stepNumber > 0) || step.kind === 'quiz') && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: space(3), flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: space(1) }}>
                      {step.kind === 'quiz' && chosen !== undefined && (
                        <p
                          role="status"
                          style={{
                            margin: 0,
                            font: type(text.label, { weight: weight.semibold, leading: 1.4 }),
                            color: right ? brand.ink : alert.ink,
                          }}
                        >
                          {right ? step.right : step.wrong}
                        </p>
                      )}
                      {step.kind === 'quiz' && step.more !== undefined && (
                        <button
                          type="button"
                          aria-expanded={moreOpen}
                          onClick={() => {
                            setMoreOpen((open) => !open);
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            font: type(text.label, { weight: weight.semibold }),
                            color: brand.ink,
                            cursor: 'pointer',
                          }}
                        >
                          {moreOpen ? 'Close information \u25b4' : 'More information \u25be'}
                        </button>
                      )}
                    </div>
                    {previous && stepNumber > 0 && (
                      <button type="button" onClick={onPrevious} style={secondary}>
                        ← Previous
                      </button>
                    )}
                    {hasNext && (
                      <button type="button" onClick={onNext} style={{ ...primary, alignSelf: 'auto' }}>
                        Next →
                      </button>
                    )}
                  </div>
                )}

                {step.kind === 'quiz' && step.more !== undefined && moreOpen && (
                  <div
                    style={{
                      padding: space(4),
                      borderRadius: radius.base,
                      border: `1px solid ${line.base}`,
                      background: surface.raised,
                      boxShadow: shadow.floating,
                    }}
                  >
                    <p style={{ margin: `0 0 ${String(space(2))}px`, font: type(text.body, { weight: weight.semibold }), color: ink.strong }}>
                      {step.more.title}
                    </p>
                    {step.more.items.map((item) => (
                      <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: space(3), marginTop: space(2) }}>
                        <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
                          <path d="M1 4h26" stroke={brand.base} strokeWidth={item.sample === 'bold' ? 3 : 1} strokeLinecap="round" />
                        </svg>
                        <span style={{ font: type(text.label, { leading: 1.45 }), color: ink.base }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          )}
        </>
      )}
    </aside>
  );
}

/** The entry screen, Figma Terrain Tutorial frame 00. */
function Intro({
  intro,
  onStart,
  onLeave,
}: {
  readonly intro: LessonIntro;
  readonly onStart: () => void;
  readonly onLeave?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space(4) }}>
      <span style={{ ...pill, background: brand.wash, color: brand.ink }}>{intro.duration}</span>
      <h2
        style={{
          margin: 0,
          font: type(text.display, { weight: weight.semibold, leading: 1.25 }),
          letterSpacing: tracking.display,
          color: ink.strong,
        }}
      >
        {intro.heading}
      </h2>
      <p style={{ margin: 0, font: type(text.lead, { leading: 1.5 }), color: ink.muted }}>{intro.body}</p>
      <div style={{ display: 'flex', gap: space(3), flexWrap: 'wrap', marginTop: space(2) }}>
        <button type="button" onClick={onStart} style={{ ...primary, alignSelf: 'auto' }}>
          Start guide →
        </button>
        {onLeave !== undefined && (
          <button type="button" onClick={onLeave} style={secondary}>
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

/** A box under a step's heading. */
function Card({ card }: { readonly card: StepCard }): ReactNode {
  switch (card.kind) {
    case 'ramp':
      // The layer's own ramp, not a brighter picture of it.
      return (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: type(text.small, { weight: weight.semibold }),
              letterSpacing: tracking.caps,
              textTransform: 'uppercase',
              color: ink.subtle,
            }}
          >
            <span>Lower ground</span>
            <span>Higher ground</span>
          </div>
          <div
            aria-hidden
            style={{
              height: 12,
              marginTop: space(1),
              borderRadius: radius.pill,
              border: `1px solid ${line.hair}`,
              background: RAMP_GRADIENT,
            }}
          />
        </div>
      );
    case 'height':
      return (
        <div style={{ ...box, background: brand.wash, display: 'flex', alignItems: 'center', gap: space(4), flexWrap: 'wrap' }}>
          <span style={{ font: type(text.title, { weight: weight.bold, leading: 1.2 }), color: brand.ink, whiteSpace: 'nowrap' }}>
            {card.value}
          </span>
          <span style={{ flex: '1 1 160px', font: type(text.body, { weight: weight.semibold, leading: 1.4 }), color: ink.strong }}>
            {card.text}
          </span>
        </div>
      );
    case 'reading':
      return (
        <div style={{ ...box, background: advisory.fill, border: `1px solid ${advisory.line}` }}>
          <div style={{ font: type(text.title, { weight: weight.bold, leading: 1.2 }), color: ink.strong }}>{card.value}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: space(4), flexWrap: 'wrap', marginTop: space(2) }}>
            <span style={{ font: type(text.label, { weight: weight.semibold }), color: WARM_INK }}>{card.note}</span>
            {card.compare !== null && (
              <span style={{ font: type(text.label, { weight: weight.semibold }), color: ink.base }}>{card.compare}</span>
            )}
          </div>
        </div>
      );
    case 'warning':
      return (
        <div role="note" style={{ ...box, background: advisory.fill, border: `1px solid ${advisory.line}` }}>
          <div style={{ font: type(text.lead, { weight: weight.semibold, leading: 1.35 }), color: WARM_INK }}>{card.title}</div>
          <div style={{ marginTop: space(1), font: type(text.label, { leading: 1.45 }), color: ink.base }}>{card.text}</div>
        </div>
      );
  }
}

/**
 * Figma Terrain Tutorial frame 07: two drawings over the map, one of lines far
 * apart and one of lines close together. An illustration of the idea rather
 * than a place, and captioned as one.
 */
function SlopeExample() {
  const drawing = (radii: readonly (readonly [number, number])[]) => (
    <svg viewBox="0 0 160 90" aria-hidden focusable="false" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 120 }}>
      {radii.map(([rx, ry]) => (
        <ellipse key={rx} cx="80" cy="45" rx={rx} ry={ry} fill="none" stroke={brand.base} strokeWidth="2" />
      ))}
    </svg>
  );
  const card = (letter: string, title: string, colour: string, art: ReactNode) => (
    <div
      style={{
        flex: '1 1 0',
        maxWidth: 300,
        padding: space(4),
        borderRadius: radius.large,
        background: 'rgba(255, 255, 255, 0.95)',
        boxShadow: shadow.lifted,
      }}
    >
      <div style={{ display: 'flex', gap: space(3), alignItems: 'baseline', marginBottom: space(3) }}>
        <span style={{ font: type(text.title, { weight: weight.bold, leading: 1 }), color: colour }}>{letter}</span>
        <span style={{ font: type(text.lead, { weight: weight.semibold, leading: 1.2 }), color: ink.strong }}>{title}</span>
      </div>
      {art}
    </div>
  );
  return (
    <div
      style={{
        position: 'absolute',
        left: space(6),
        // Clear of the scale bar and zoom buttons in the bottom right.
        right: space(26),
        bottom: space(14),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: space(2),
      }}
    >
      <div style={{ display: 'flex', gap: space(4), justifyContent: 'center', width: '100%' }}>
        {card('A', 'Lines far apart', brand.base, drawing([[70, 38], [46, 25], [22, 12]]))}
        {card('B', 'Lines close together', WARM_INK, drawing([[70, 38], [60, 32], [50, 27], [40, 21], [30, 16], [20, 10]]))}
      </div>
      <span style={{ ...pill, background: 'rgba(255, 255, 255, 0.95)', color: ink.muted, boxShadow: shadow.floating }}>
        Example drawing, not this map
      </span>
    </div>
  );
}

/** Where you are, without a percentage. Six steps is a number people can hold. */
function Progress({ done, total }: { readonly done: number; readonly total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space(2) }}>
      {Array.from({ length: total }, (_, at) => (
        <span
          key={at}
          aria-hidden
          style={{
            height: 4,
            flex: 1,
            borderRadius: 2,
            background: at < done ? '#1f6f5c' : line.base,
          }}
        />
      ))}
      <span style={{ font: type(text.small), color: ink.subtle, whiteSpace: 'nowrap' }}>
        {String(Math.min(done + (done < total ? 1 : 0), total))} of {String(total)}
      </span>
    </div>
  );
}

function Done({ copy, onFinish }: { readonly copy: Finished; readonly onFinish: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space(4) }}>
      <h2 style={{ margin: 0, font: type(text.title), color: ink.strong }}>
        {copy.headline}
      </h2>
      {copy.body !== undefined && (
        <p style={{ margin: 0, font: type(text.body, { leading: 1.5 }), color: ink.base }}>
          {copy.body}
        </p>
      )}
      <div
        style={{
          padding: space(4),
          borderRadius: radius.base,
          background: '#eef6f3',
          border: `1px solid ${line.base}`,
          font: type(text.label, { leading: 1.5 }),
          color: '#1a5d4d',
          boxShadow: shadow.floating,
        }}
      >
        {copy.unlocked}
      </div>
      <button type="button" onClick={onFinish} style={primary}>
        Back to guidance page →
      </button>
    </div>
  );
}

/** The finish page with a way back, Figma Terrain Tutorial frame 10. */
function Complete({
  copy,
  onPrevious,
  onFinish,
}: {
  readonly copy: Finished;
  readonly onPrevious: () => void;
  readonly onFinish: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space(4) }}>
      <span
        style={{
          ...pill,
          background: brand.tint,
          color: brand.ink,
          font: type(text.small, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
        }}
      >
        {copy.badge}
      </span>
      <h2
        style={{
          margin: 0,
          font: type(text.display, { weight: weight.semibold, leading: 1.25 }),
          letterSpacing: tracking.display,
          color: ink.strong,
        }}
      >
        {copy.headline}
      </h2>
      <p style={{ margin: 0, font: type(text.lead, { leading: 1.5 }), color: ink.muted }}>{copy.unlocked}</p>
      <div style={{ display: 'flex', gap: space(3), justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: space(4) }}>
        <button type="button" onClick={onPrevious} style={secondary}>
          ← Previous
        </button>
        <button type="button" onClick={onFinish} style={{ ...primary, alignSelf: 'auto' }}>
          Return to Guidance Page →
        </button>
      </div>
    </div>
  );
}

/** The design's orange for words, dark enough to read on the warm card: 5.2:1. */
const WARM_INK = '#a4520f';

const box: CSSProperties = {
  padding: `${String(space(4))}px ${String(space(5))}px`,
  borderRadius: radius.base,
};

const pill: CSSProperties = {
  alignSelf: 'flex-start',
  padding: `${String(space(1))}px ${String(space(3))}px`,
  borderRadius: radius.pill,
  font: type(text.label, { weight: weight.semibold }),
};

const secondary = {
  padding: `${String(space(3))}px ${String(space(5))}px`,
  border: `1px solid ${line.strong}`,
  borderRadius: radius.base,
  background: surface.raised,
  color: brand.ink,
  font: type(text.label, { weight: weight.medium }),
  cursor: 'pointer',
} as const;

/** An answer button: plain, chosen and right, or chosen and wrong. */
function optionStyle(chosen: boolean, correct: boolean): CSSProperties {
  const tone = !chosen
    ? { background: brand.wash, color: brand.ink, border: `1px solid ${brand.tint}` }
    : correct
      ? { background: brand.base, color: ink.inverse, border: `1px solid ${brand.base}` }
      : { background: alert.fill, color: alert.ink, border: `1px solid ${alert.line}` };
  return {
    ...tone,
    minWidth: 96,
    padding: `${String(space(3))}px ${String(space(5))}px`,
    borderRadius: radius.base,
    font: type(text.label, { weight: weight.semibold }),
    cursor: 'pointer',
  };
}

const primary = {
  alignSelf: 'flex-start',
  padding: `${String(space(3))}px ${String(space(5))}px`,
  border: 'none',
  borderRadius: radius.base,
  background: '#1f6f5c',
  color: ink.inverse,
  font: type(text.label, { weight: weight.medium }),
  cursor: 'pointer',
} as const;

/**
 * A section whose lesson has not been written.
 *
 * Not reachable from the chooser, which offers `GUIDED_SECTIONS` and derives
 * that from the lessons that exist. It is here because `session.guideSection`
 * is a `SectionId` and the type admits all four — and a screen that rendered a
 * guide with no steps would show "1 of 0" and wait forever for an instruction
 * nobody had written.
 */
function NotWritten({
  section,
  onFinish,
}: {
  readonly section: SectionId;
  readonly onFinish: () => void;
}) {
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: space(10) }}>
      <h2 style={{ margin: `0 0 ${String(space(3))}px`, font: type(text.title), color: ink.strong }}>
        {SECTIONS[section].label}
      </h2>
      <p style={{ margin: `0 0 ${String(space(5))}px`, font: type(text.body, { leading: 1.5 }), color: ink.muted }}>
        Terrain guide coming soon.
      </p>
      <button type="button" onClick={onFinish} style={primary}>
        Back to guidance page →
      </button>
    </div>
  );
}
