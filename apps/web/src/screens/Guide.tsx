/**
 * The guide: the real map, with somebody talking beside it.
 *
 * **It is the map, not a picture of one.** The design was mocked with
 * screenshots, and building it that way would have been quicker and wrong: the
 * reader would learn a control that does not exist, and AC 1.1.2's *open the
 * local map* would stop being met the moment a card led here instead. What
 * they press is `MapView`, with its own chips, its own canvas and its own pit
 * card — narrowed to the two layers this section is about.
 *
 * **The guide reads the map; it never drives it.** `onMapNow` reports what is
 * on and what is selected, and the step is derived from that. Nothing here
 * calls back into the map to turn a layer on, because a guide that can satisfy
 * its own instructions is a guide that teaches nothing — and because the first
 * time somebody switches Pits back off, the words beside the map have to
 * follow them back rather than carry on describing a map that is not there.
 */

import { useCallback, useMemo, useState } from 'react';

import type { AddressIndex } from '../address/search.js';
import type { MapArtefact } from '../map/artefact.js';
import type { DerivedArtefact } from '../map/derived.js';
import { NOTHING_ON } from '../map/modes.js';
import type { SupportedAddress } from '../session.js';
import type { TraceArtefact } from '../trace/graph.js';
import { chooseTeachingPit } from '../tutorial/pit.js';
import {
  type Finished,
  type Lesson,
  type MapNow,
  NOTHING_ON_MAP,
  type Step,
  finished,
  stepIndex,
} from '../tutorial/lesson.js';
import { lessonFor } from '../tutorial/lessons.js';
import { SECTIONS, type SectionId } from '../tutorial/sections.js';
import {
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
}

export function Guide({ map, derived, trace, index, address, section, onFinish }: GuideProps) {
  const [now, setNow] = useState<MapNow>(NOTHING_ON_MAP);
  /** How many `read` steps have been pressed past. See `stepIndex`. */
  const [acknowledged, setAcknowledged] = useState(0);

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

    Three things moved, none of which is "open somewhere other than the
    address":

    - `locked` below takes the zoom and recentre buttons away, because the
      guide never asks for either. The corner is the pit's again.
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

  // Stable, so `MapView`'s effect does not fire on every render of this one.
  const report = useCallback((next: MapNow) => {
    setNow(next);
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

  const steps = lesson.steps;
  const index0 = stepIndex(steps, now, teachingId, acknowledged);
  const step = steps[index0];
  const done = finished(steps, now, teachingId, acknowledged);

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
          width: 'min(560px, 100%)',
          height: 'min(480px, 70vh)',
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
          layersButton={false}
          // 260 pixels of the top right, over the number badge on the very pit
          // the guide is asking for -- and repeating the sentence the step
          // beside the map is already saying.
          legend={false}
          /*
            The view is held where it opened.

            Every step says press *this* — a chip, the ringed pit, the button
            on its card — and a reader who has dragged the map somewhere else
            is being asked for something no longer on screen, with nothing
            saying why. It also gives the corner back: the zoom and recentre
            buttons stack in the bottom right, which is exactly where an
            address near the edge of the extent puts its pit, and they were
            covering the thing being pointed at.
          */
          locked
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
          highlightPit={teaching?.pit.asset_number ?? null}
          onMapNow={report}
        />
      </div>

      <Coach
        address={address}
        finishedCopy={lesson.finished}
        step={step}
        stepNumber={index0}
        total={steps.length}
        done={done}
        teaching={teaching === null ? null : { id: teachingId ?? '', metres: teaching.distanceM }}
        onNext={() => {
          setAcknowledged(index0 + 1);
        }}
        onFinish={onFinish}
      />
    </div>
  );
}

function Coach({
  address,
  finishedCopy,
  step,
  stepNumber,
  total,
  done,
  teaching,
  onNext,
  onFinish,
}: {
  readonly address: SupportedAddress;
  readonly finishedCopy: Finished;
  readonly step: Step | undefined;
  readonly stepNumber: number;
  readonly total: number;
  readonly done: boolean;
  readonly teaching: { readonly id: string; readonly metres: number } | null;
  readonly onNext: () => void;
  readonly onFinish: () => void;
}) {
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

      <Progress done={done ? total : stepNumber} total={total} />

      {done ? (
        <Done copy={finishedCopy} onFinish={onFinish} />
      ) : (
        step !== undefined && (
          <>
            <p
              style={{
                margin: 0,
                font: type(text.display, { weight: weight.semibold, leading: 1.25 }),
                color: ink.strong,
              }}
            >
              {step.prompt}
            </p>

            {step.kind === 'do' && step.hint !== undefined && (
              <p style={{ margin: 0, font: type(text.body, { leading: 1.5 }), color: ink.muted }}>
                {step.hint}
              </p>
            )}

            {step.kind === 'do' && step.requires === 'pit-selected' && teaching !== null && (
              <p style={{ margin: 0, font: type(text.label), color: ink.muted }}>
                It is the ringed one, about {String(Math.round(teaching.metres / 10) * 10)} m from
                your address. Pit {teaching.id}.
              </p>
            )}

            {step.kind === 'read' ? (
              <button type="button" onClick={onNext} style={primary}>
                Next →
              </button>
            ) : (
              /*
                Not a disabled button. There is nothing here to press: the step
                is finished by working the map, and a greyed-out Next beside
                that reads as the way forward being broken rather than as the
                way forward being somewhere else.
              */
              <p
                aria-live="polite"
                style={{ margin: 0, font: type(text.label), color: ink.subtle }}
              >
                Waiting for you to try it.
              </p>
            )}
          </>
        )
      )}
    </aside>
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
      <p style={{ margin: 0, font: type(text.body, { leading: 1.5 }), color: ink.base }}>
        {copy.body}
      </p>
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
        Back to the four →
      </button>
    </div>
  );
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
        This part of the guide is not written yet. Nothing has been unlocked, and nothing about the
        map has changed.
      </p>
      <button type="button" onClick={onFinish} style={primary}>
        Back to the four →
      </button>
    </div>
  );
}
