/**
 * The map the blocked-drain comparison is chosen and read on.
 *
 * **Step 1 has no panel at all.** The Blockage Flow prototype's annotation is
 * that the first screen carries one instruction instead of four sections: a
 * small coach mark welded to the highlighted drain, a line on the dashed
 * connector saying how far it is, a key, and a link along the bottom for
 * anybody not using a pointer. Everything else the old setup screen said is
 * either on the next step or on the map as a mark.
 *
 * The marks are drawn by the canvas (`ComparisonMarks` in `map/draw.ts`); this
 * file puts the words and the controls over them, at the positions the
 * canvas reports through `onViewport`. There is no second transform here —
 * `toScreen` with the canvas's own viewport is the only way a label finds its
 * drain.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MapArtefact, Pit } from '../map/artefact.js';
import { DIFFERENCE_FILL, type DifferenceArea } from '../map/difference.js';
import {
  COACH_WIDTH_PX,
  type HeldReason,
  SELECTED_LABEL_PX,
  nameBox,
  placeSelectedLabel,
  placeStepOneLabels,
  reasonOnScreen,
} from '../map/comparisonLabels.js';
import { DAY } from '../map/draw.js';
import type { Hit } from '../map/hit.js';
import { MapCanvas } from '../map/MapCanvas.js';
import { type Local, type Viewport, toScreen } from '../map/viewport.js';
import { type Eligibility, aboutMetres, offeredDrains } from '../scenario/eligibility.js';
import { DIFFERENCE_LEGEND, DIFFERENCE_LEGEND_NOTE } from '../scenario/outcome.js';
import { MAP_KEY, TOO_FAR_SHORT, UNSUPPORTED_SHORT, supportOf } from '../scenario/support.js';
import type { Trace } from '../trace/graph.js';
import { brand, ink, line, radius, shadow, space, surface, text, tracking, type, weight } from '../ui/theme.js';

export type ComparisonStep = 'drain' | 'scenario' | 'review' | 'result';

export interface ComparisonMapProps {
  readonly map: MapArtefact;
  readonly step: ComparisonStep;
  /** The searched address in local metres, or null when opened from the full map. */
  readonly address: Local | null;
  readonly addressLabel: string | null;
  /** The eligibility check's answer, or null when there is no address to check. */
  readonly eligibility: Eligibility | null;
  readonly supported: ReadonlySet<string>;
  readonly withoutGround: ReadonlySet<string>;
  readonly selectedPitId: string | null;
  readonly trace: Trace | null;
  readonly difference: DifferenceArea | null;
  /** When `key` changes the view is fitted to `points` again. See `MapCanvas`'s `fit`. */
  readonly fitKey: string;
  readonly fitPoints: readonly Local[];
  /** A comparable drain was chosen, by click, by tooltip, by keyboard or by the bottom link. */
  readonly onChoose: (pitId: string, suggested: boolean) => void;
  /** Nothing may be chosen while a run is in progress. */
  readonly locked: boolean;
}

/** Focus ring on the drain targets: a colour no layer on this map uses. */
export const DRAIN_FOCUS_COLOUR = '#db2777';

export function ComparisonMap({
  map,
  step,
  address,
  addressLabel,
  eligibility,
  supported,
  withoutGround,
  selectedPitId,
  trace,
  difference,
  fitKey,
  fitPoints,
  onChoose,
  locked,
}: ComparisonMapProps) {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  // What is under the pointer, held with the step it was found on. See
  // `reasonOnScreen`: a hover from one step is never shown on another.
  const [hover, setHover] = useState<{ readonly hit: Hit; readonly step: ComparisonStep } | null>(null);
  // Why the last grey drain pressed cannot be tested. A press is the only way
  // a touch screen, which has no hover, can ask.
  const [refused, setRefused] = useState<HeldReason<Pit> | null>(null);
  const nearest = eligibility?.nearest ?? null;
  const choosing = step === 'drain';

  const pits = map.layers.pit ?? [];
  const selectedPit = useMemo(
    () => (selectedPitId === null ? null : (pits.find((p) => String(p.asset_number ?? '') === selectedPitId) ?? null)),
    [pits, selectedPitId],
  );

  /*
    What the map offers. After a search, only the comparable drains near that
    address -- see `offeredDrains`. Opened from the full map there is no
    address to be near, and every comparable drain is offered as before.
  */
  const offeredList = useMemo(
    () => (address !== null && eligibility !== null ? offeredDrains(eligibility) : null),
    [address, eligibility],
  );
  const offered = useMemo(
    () => (offeredList === null ? supported : new Set(offeredList.map((drain) => drain.assetNumber))),
    [offeredList, supported],
  );

  const reasonFor = useCallback(
    (pit: Pit): string | null => {
      const asset = String(pit.asset_number ?? '');
      const support = supportOf({ supported, withoutGround }, asset);
      if (support !== 'supported') return UNSUPPORTED_SHORT[support];
      return offered.has(asset) ? null : TOO_FAR_SHORT;
    },
    [supported, withoutGround, offered],
  );

  // A new step starts with nothing under the pointer and nothing refused.
  // The render below would hide a stale one anyway; this lets it go.
  useEffect(() => {
    setHover(null);
    setRefused(null);
  }, [step]);

  const onSelect = (hit: Hit | null) => {
    setHover(null);
    if (hit?.kind !== 'pit' || locked) {
      setRefused(null);
      return;
    }
    const reason = reasonFor(hit.feature);
    if (reason !== null) {
      // Not clickable, and saying so: a map that ignores a press in silence
      // reads as broken (AC 3.1.1.d).
      setRefused({ pit: hit.feature, reason, step });
      return;
    }
    setRefused(null);
    const asset = String(hit.feature.asset_number ?? '');
    onChoose(asset, nearest !== null && asset === nearest.assetNumber);
  };

  // Memoised, because the canvas repaints whenever this object changes and
  // the pointer moving over the map re-renders this component.
  const suggestedMark = choosing && nearest !== null ? Number(nearest.assetNumber) : null;
  const selectedMark = !choosing && selectedPitId !== null ? Number(selectedPitId) : null;
  const marks = useMemo(
    () => ({ comparable: offered, suggested: suggestedMark, selected: selectedMark }),
    [offered, suggestedMark, selectedMark],
  );
  // Only a different pit is news; the same pit under a moving pointer is not.
  // The canvas reports null on a press, a drag, a zoom and on leaving it.
  const onHover = useCallback(
    (hit: Hit | null) => {
      setHover((held) =>
        held !== null && held.step === step && held.hit.feature === hit?.feature
          ? held
          : hit === null
            ? null
            : { hit, step },
      );
    },
    [step],
  );

  const hovered = hover !== null && hover.step === step && hover.hit.kind === 'pit' ? hover.hit.feature : null;
  const hoveredReason = hovered === null ? null : reasonFor(hovered);
  const hoverComparable = hovered !== null && hoveredReason === null;
  const reasonShown = reasonOnScreen(
    hovered !== null && hoveredReason !== null ? { pit: hovered, reason: hoveredReason, step } : null,
    refused,
    step,
  );

  const on = (at: Local): readonly [number, number] | null => {
    if (viewport === null) return null;
    const [x, y] = toScreen(viewport, at);
    return x < -40 || y < -40 || x > viewport.widthPx + 40 || y > viewport.heightPx + 40 ? null : [x, y];
  };

  // Keyboard order: the highlighted drain first, then the others by distance,
  // and only the ones on screen — a focus target off the canvas would scroll
  // a container that is not meant to scroll.
  const targets = choosing && offeredList !== null && nearest !== null ? offeredList : [];

  const drainAt = choosing ? nearest?.at ?? null : (selectedPit?.c ?? null);
  const addressScreen = address === null ? null : on(address);
  const drainScreen = drainAt === null ? null : on(drainAt);
  const distanceM =
    address !== null && drainAt !== null ? Math.hypot(drainAt[0] - address[0], drainAt[1] - address[1]) : null;
  const differenceShown = difference !== null && difference.cells.length > 0;
  const placed =
    addressScreen !== null && drainScreen !== null && viewport !== null
      ? placeStepOneLabels(
          addressScreen,
          drainScreen,
          viewport.widthPx,
          viewport.heightPx,
          addressLabel === null ? 0 : nameWidthPx(addressLabel),
        )
      : null;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* First in the DOM, so Tab reaches the drains before the zoom controls. */}
      {viewport !== null &&
        targets.map((drain, index) => {
          const at = on(drain.at);
          if (at === null) return null;
          const suggested = index === 0;
          return (
            <button
              key={drain.assetNumber}
              type="button"
              className="comparison__drain"
              aria-label={`${suggested ? 'Highlighted drain, the nearest you can test' : 'Drain you can test'}: ID ${drain.assetNumber}, about ${String(aboutMetres(drain.distanceM))} m from your address`}
              onClick={() => {
                onChoose(drain.assetNumber, suggested);
              }}
              /*
                Enter selects, said outright. A button with no pointer events
                was not activated by Enter in every browser this was tried in,
                and the keyboard is the whole reason this target exists.
              */
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onChoose(drain.assetNumber, suggested);
              }}
              style={{
                position: 'absolute',
                left: at[0] - 16,
                top: at[1] - 16,
                width: 32,
                height: 32,
                zIndex: 3,
                padding: 0,
                background: 'transparent',
                border: 'none',
                borderRadius: radius.pill,
                // Presses go through to the canvas, which already knows what
                // is under them; this target exists for the keyboard.
                pointerEvents: 'none',
              }}
            />
          );
        })}

      <MapCanvas
        artefact={map}
        /*
          No calculated layers at all: no likely water paths, low areas,
          limited-ground hatching or warning signs. The 15 September user test
          found the drain step drawn over every one of them, and the drain the
          screen asks for was hard to find in it. This map is for the drains,
          the address and, on the result, the difference.
        */
        derived={null}
        comparison={marks}
        address={address}
        openAt={address === null && selectedPit !== null ? selectedPit.c : null}
        trace={trace}
        difference={difference}
        fit={{ key: fitKey, points: fitPoints, reservePanel: step === 'drain' }}
        onViewport={setViewport}
        onHover={onHover}
        cursor={hoverComparable && !locked ? 'pointer' : 'grab'}
        onSelect={onSelect}
      />

      {viewport !== null && (
        <svg
          aria-hidden
          width={viewport.widthPx}
          height={viewport.heightPx}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
        >
          {addressScreen !== null && drainScreen !== null && step !== 'result' && (
            <line
              x1={addressScreen[0]}
              y1={addressScreen[1]}
              x2={drainScreen[0]}
              y2={drainScreen[1]}
              stroke={ink.muted}
              strokeWidth={1.5}
              strokeDasharray="5 5"
            />
          )}
        </svg>
      )}

      {addressScreen !== null && addressLabel !== null && (
        <span
          style={{
            ...floatingLabel,
            left: placed?.address.at[0] ?? addressScreen[0] + 14,
            top: placed?.address.at[1] ?? addressScreen[1] - 20,
            transform: `translate(${placed?.address.alignRight === true ? '-100%' : '0'}, -50%)`,
            // Never past the canvas edge: on a phone the name is cut short, not cut off.
            maxWidth: Math.max(
              60,
              placed?.address.alignRight === true
                ? placed.address.at[0] - 8
                : (viewport?.widthPx ?? 0) - (placed?.address.at[0] ?? addressScreen[0] + 14) - 8,
            ),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {addressLabel}
        </span>
      )}

      {/* The connector's line: how far the nearest drain is. */}
      {choosing && placed !== null && distanceM !== null && (
        <span
          style={{
            ...floatingLabel,
            left: placed.distance.at[0],
            top: placed.distance.at[1],
            transform: `translate(${{ centre: '-50%', right: '-100%', left: '0' }[placed.distance.align]}, ${placed.distance.align === 'centre' ? '-50%' : '0'})`,
            padding: `${String(space(1))}px ${String(space(2))}px`,
            background: surface.raised,
            border: `1px solid ${line.base}`,
            borderRadius: radius.small,
          }}
        >
          Nearest drain you can test · about {aboutMetres(distanceM)} m away
        </span>
      )}

      {/* The coach mark: step 1's only instruction, and it can be pressed. */}
      {choosing && nearest !== null && placed !== null && (
        <CoachMark
          at={placed.coach}
          onPress={() => {
            onChoose(nearest.assetNumber, true);
          }}
        />
      )}

      {/* The chosen drain's compact label, while its choices are made. */}
      {(step === 'scenario' || step === 'review') && selectedPit !== null && drainScreen !== null && viewport !== null && (
        <span
          style={{
            ...floatingLabel,
            // Beside the drain where that is free, and never over the tick it
            // labels, the pin or the address name. See `placeSelectedLabel`.
            ...(() => {
              const [left, top] = placeSelectedLabel(
                drainScreen,
                addressScreen,
                placed !== null && addressLabel !== null ? nameBox(placed.address, nameWidthPx(addressLabel)) : null,
                viewport.widthPx,
                viewport.heightPx,
              );
              return { left, top };
            })(),
            width: SELECTED_LABEL_PX,
            boxSizing: 'border-box',
            padding: `${String(space(1))}px ${String(space(3))}px`,
            background: surface.raised,
            border: `1px solid ${line.base}`,
            borderRadius: radius.base,
            boxShadow: shadow.resting,
            whiteSpace: 'nowrap',
          }}
        >
          <strong style={{ display: 'block', color: ink.strong }}>Selected drain</strong>
          <span style={{ color: ink.muted }}>Council record · ID {selectedPitId}</span>
        </span>
      )}

      {/* The one-line reason on a drain that cannot be tested. */}
      {viewport !== null &&
        reasonShown !== null &&
        (() => {
          const { pit, reason } = reasonShown;
          const at = on(pit.c);
          if (at === null) return null;
          return (
            <span
              role="status"
              style={{
                ...floatingLabel,
                left: Math.max(8, Math.min(at[0] - 140, viewport.widthPx - 288)),
                top: at[1] + 14,
                width: 280,
                whiteSpace: 'normal',
                padding: `${String(space(1))}px ${String(space(2))}px`,
                background: ink.strong,
                color: ink.inverse,
                borderRadius: radius.small,
                zIndex: 4,
              }}
            >
              {reason}
            </span>
          );
        })()}

      <div className={`comparison__key${step === 'scenario' || step === 'review' ? ' comparison__key--later' : ''}`} style={keyCard}>
        {step === 'result' && differenceShown ? (
          <>
            <KeyTitle />
            <KeyLine swatch={<span style={{ ...swatch, background: DIFFERENCE_FILL, borderRadius: 2, border: '1px solid #5b21b6' }} />}>
              {DIFFERENCE_LEGEND}
            </KeyLine>
            <p style={{ margin: `${String(space(1))}px 0 0`, font: type(text.micro, { leading: 1.45 }), color: ink.muted }}>
              {DIFFERENCE_LEGEND_NOTE}
            </p>
          </>
        ) : (
          <>
            <KeyTitle />
            {address !== null && (
              <KeyLine swatch={<span style={{ ...swatch, background: DAY.address }} />}>{MAP_KEY.address}</KeyLine>
            )}
            <KeyLine swatch={<span style={{ ...swatch, background: surface.raised, border: `2px solid ${DAY.comparable}` }} />}>
              {MAP_KEY.comparable}
            </KeyLine>
            <KeyLine swatch={<span style={{ ...swatch, width: 8, height: 8, margin: 2, background: DAY.unavailable }} />}>
              {MAP_KEY.other}
            </KeyLine>
          </>
        )}
      </div>

      {/* The pointer-free way through step 1: the same state as pressing the drain. */}
      {choosing && nearest !== null && (
        <button
          type="button"
          className="comparison__maplink"
          onClick={() => {
            onChoose(nearest.assetNumber, true);
          }}
          style={{
            padding: `${String(space(2))}px ${String(space(4))}px`,
            background: surface.raised,
            border: `1px solid ${line.strong}`,
            borderRadius: radius.pill,
            boxShadow: shadow.resting,
            font: type(text.label, { weight: weight.medium }),
            color: brand.ink,
            cursor: 'pointer',
          }}
        >
          Or choose the highlighted drain here
        </button>
      )}
    </div>
  );
}

/**
 * "Step 1 of 3 · Choose this nearby drain", beside the drain it means.
 *
 * On the drain's far side from the address, placed by `placeStepOneLabels`.
 * A button, because pressing the instruction does what it says; out of the
 * tab order, because the drain's own target is already first in it.
 */
function CoachMark({ at, onPress }: { readonly at: readonly [number, number]; readonly onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      tabIndex={-1}
      style={{
        position: 'absolute',
        zIndex: 2,
        left: at[0],
        top: at[1],
        width: COACH_WIDTH_PX,
        padding: `${String(space(2))}px ${String(space(3))}px`,
        textAlign: 'left',
        background: ink.strong,
        color: ink.inverse,
        border: 'none',
        borderRadius: radius.base,
        boxShadow: shadow.floating,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          display: 'block',
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
          color: '#7fd1bd',
        }}
      >
        Step 1 of 3
      </span>
      <span style={{ display: 'block', font: type(text.label, { weight: weight.semibold }) }}>Choose this nearby drain</span>
      <span style={{ display: 'block', font: type(text.small), color: '#c9d4dc' }}>
        Select the highlighted drain to continue
      </span>
    </button>
  );
}

function KeyTitle() {
  return (
    <span
      style={{
        display: 'block',
        marginBottom: space(1),
        font: type(text.micro, { weight: weight.semibold }),
        letterSpacing: tracking.caps,
        textTransform: 'uppercase',
        color: ink.subtle,
      }}
    >
      Map key
    </span>
  );
}

function KeyLine({ swatch: mark, children }: { readonly swatch: React.ReactNode; readonly children: React.ReactNode }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: space(2), font: type(text.small, { leading: 1.45 }), color: ink.base }}>
      {mark}
      <span>{children}</span>
    </span>
  );
}

/**
 * About how wide the address name sets, for keeping other labels off it.
 * Generous, at 7 px a character of 12.5 px medium type, plus the halo.
 */
const nameWidthPx = (label: string): number => Math.min(320, label.length * 7 + 6);

const swatch: React.CSSProperties = {
  display: 'inline-block',
  flexShrink: 0,
  width: 12,
  height: 12,
  borderRadius: radius.pill,
  boxSizing: 'border-box',
};

const keyCard: React.CSSProperties = {
  padding: `${String(space(2))}px ${String(space(3))}px`,
  background: 'rgba(255, 255, 255, 0.95)',
  border: `1px solid ${line.base}`,
  borderRadius: radius.base,
  boxShadow: shadow.resting,
  display: 'grid',
  gap: 2,
};

const floatingLabel: React.CSSProperties = {
  position: 'absolute',
  zIndex: 2,
  pointerEvents: 'none',
  font: type(text.small, { weight: weight.medium, leading: 1.35 }),
  color: ink.strong,
  whiteSpace: 'nowrap',
  textShadow: '0 0 3px #ffffff, 0 0 3px #ffffff',
};
