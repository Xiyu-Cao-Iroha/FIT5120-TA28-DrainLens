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
import { type LayerKey, NOTHING_ON } from '../map/modes.js';
import type { SupportedAddress } from '../session.js';
import type { TraceArtefact } from '../trace/graph.js';
import { chooseTeachingPit } from '../tutorial/pit.js';
import {
  DRAINAGE_DONE,
  DRAINAGE_STEPS,
  type MapNow,
  finished,
  stepIndex,
} from '../tutorial/drainage.js';
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

/**
 * Which chips are on offer at each step, and no more.
 *
 * **The section already narrowed the map to two layers; this narrows it to the
 * one being taught.** Step one says *press Pits* with Pipes sitting beside it,
 * which is an invitation to press the wrong thing and then read an instruction
 * about a map you have already gone past. Everything on screen during a step
 * should be something the step is about.
 *
 * A layer that is *on* keeps its chip whatever the step says. Turning Pits off
 * during the pipes step puts the guide back on step one, and a chip that
 * vanished at the same moment would leave Pipes drawn with no way to turn it
 * off — a map holding something the reader cannot take back.
 */
export function chipsFor(index: number, now: MapNow): readonly LayerKey[] {
  const keys: LayerKey[] = ['pit'];
  // 2 is `pipes-on`, the step that asks for it.
  if (index >= 2 || now.pipes) keys.push('pipe');
  return keys;
}

const NOTHING_ON_MAP: MapNow = {
  pits: false,
  pipes: false,
  selectedPit: null,
  followingPit: null,
};

export interface GuideProps {
  readonly map: MapArtefact;
  readonly derived: DerivedArtefact;
  readonly trace: TraceArtefact;
  readonly index: AddressIndex;
  /** Chosen before the guide starts. The guide has nothing to point at without one. */
  readonly address: SupportedAddress;
  readonly onFinish: () => void;
}

export function Guide({ map, derived, trace, index, address, onFinish }: GuideProps) {
  const [now, setNow] = useState<MapNow>(NOTHING_ON_MAP);
  /** How many `read` steps have been pressed past. See `stepIndex`. */
  const [acknowledged, setAcknowledged] = useState(0);

  /*
    Recomputed only when the address moves. The choice walks every inlet in the
    extent and traces each one, which is a few hundred graph walks -- cheap
    once, and not something to do on every pan.
  */
  const teaching = useMemo(
    () => chooseTeachingPit([address.eastingM, address.northingM], map.layers.pit ?? [], trace),
    [address.eastingM, address.northingM, map.layers.pit, trace],
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

  const index0 = stepIndex(DRAINAGE_STEPS, now, teachingId, acknowledged);
  const step = DRAINAGE_STEPS[index0];
  const done = finished(DRAINAGE_STEPS, now, teachingId, acknowledged);

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
          // Nothing on. The first instruction is "press Pits", and the guided
          // preset had already pressed it -- see `openWith` in MapView.
          openWith={NOTHING_ON}
          chipKeys={chipsFor(index0, now)}
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
        step={step}
        stepNumber={index0}
        total={DRAINAGE_STEPS.length}
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
  step,
  stepNumber,
  total,
  done,
  teaching,
  onNext,
  onFinish,
}: {
  readonly address: SupportedAddress;
  readonly step: (typeof DRAINAGE_STEPS)[number] | undefined;
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
        <Finished onFinish={onFinish} />
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

function Finished({ onFinish }: { readonly onFinish: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space(4) }}>
      <h2 style={{ margin: 0, font: type(text.title), color: ink.strong }}>
        {DRAINAGE_DONE.headline}
      </h2>
      <p style={{ margin: 0, font: type(text.body, { leading: 1.5 }), color: ink.base }}>
        {DRAINAGE_DONE.body}
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
        {DRAINAGE_DONE.unlocked}
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
