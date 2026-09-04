/**
 * The controls over the map, and the legend that says what each mark is.
 *
 * One module because they are one fact seen twice. The chips along the top
 * turn a mode on and off; the legend at the bottom says what its marks mean
 * and where they came from. Kept apart, the two drift — a layer renamed in the
 * control and not in the legend is a map that disagrees with its own key.
 *
 * **One level: a chip is a layer.** Pits, Pipes, Water flow and Low areas are
 * the chips; Terrain and the data-quality hatching are switches behind the
 * Layers button. `modes.ts` holds the split and the note on why it departs
 * from AC 1.1.4 and 1.1.5; this file only draws it.
 *
 * **The chips are multi-select.** All four can be on at once, and every layer
 * has a switch of its own — which is the substance those criteria protect,
 * whichever control happens to sit where.
 */
import { useState } from 'react';

import {
  CHIP_KEYS,
  type LayerKey,
  type LayerState,
  PANEL_KEYS,
} from './modes.js';
import { RAMP_HIGH_HEX, RAMP_LOW_HEX } from './terrain.js';
import { basis, brand, ink, line, radius, shadow, space, surface, text, tracking, type, weight } from '../ui/theme.js';

/** How a layer marks the map, drawn from the same colours the canvas uses. */
type Swatch = 'dot' | 'line' | 'flow' | 'blob' | 'ramp' | 'hatch';

export interface LayerSpec {
  readonly key: LayerKey;
  /** The short name on a chip. */
  readonly chip: string;
  /** The full name in the legend, which has room for it. */
  readonly label: string;
  readonly basis: 'Official recorded data' | 'System-derived result';
  readonly swatch: Swatch;
}

/**
 * The six layers, in the order the map stacks them.
 *
 * Pits and pipes were one entry until the criterion was read closely. They are
 * named separately in AC 1.1.5, and they answer different questions: the pipes
 * are where water goes, the pits are where it can get in.
 *
 * This table is what a layer *looks like* and where it came from. Which
 * control governs it is `modes.ts`.
 */
export const LAYERS: readonly LayerSpec[] = [
  { key: 'terrain', chip: 'Terrain', label: 'Ground surface', basis: 'System-derived result', swatch: 'ramp' },
  { key: 'pipe', chip: 'Pipes', label: 'Drainage pipes', basis: 'Official recorded data', swatch: 'line' },
  { key: 'pit', chip: 'Pits', label: 'Drainage pits', basis: 'Official recorded data', swatch: 'dot' },
  { key: 'channel', chip: 'Water flow', label: 'Likely surface water paths', basis: 'System-derived result', swatch: 'flow' },
  { key: 'lowPoint', chip: 'Low areas', label: 'Low points and depressions', basis: 'System-derived result', swatch: 'blob' },
  { key: 'unavailable', chip: 'No ground data', label: 'Not enough ground measured', basis: 'System-derived result', swatch: 'hatch' },
];

/** The look-up the controls and the legend both go through. */
function specOf(key: LayerKey): LayerSpec {
  const spec = LAYERS.find((l) => l.key === key);
  if (!spec) throw new Error(`No layer spec for ${key}`);
  return spec;
}

function SwatchMark({ kind }: { readonly kind: Swatch }) {
  // `flexShrink` is a CSS property, not an SVG attribute: spreading it onto
  // the element makes React warn and does nothing. It belongs in `style`.
  const box = { width: 18, height: 18, style: { flexShrink: 0 } } as const;
  switch (kind) {
    case 'dot':
      // The marker the map draws, artwork and all. A legend showing something
      // simpler than the map is a key to a different map, which is why both
      // live in this module.
      return (
        <svg {...box} viewBox="0 0 32 32" aria-hidden focusable="false">
          <circle cx="16" cy="16" r="15" fill="#ffffff" stroke="#2f6f62" strokeWidth="2" />
          <g transform="translate(16 16) scale(0.1752) translate(-84 -47)">
            <rect
              x="10.75"
              y="8.75"
              width="146.5"
              height="76.5"
              rx="9"
              fill="#ffffff"
              stroke="#2f6f62"
              strokeWidth="5.5"
            />
            <g stroke="#2f6f62" strokeWidth="11" strokeLinecap="round">
              <path d="M36.5 24.5v13M63 24.5v13M89.5 24.5v13M116 24.5v13M142.5 24.5v13" />
              <path d="M36.5 56.5v13M63 56.5v13M89.5 56.5v13M116 56.5v13M142.5 56.5v13" />
            </g>
          </g>
        </svg>
      );
    case 'line':
      return (
        <svg {...box} viewBox="0 0 20 12" aria-hidden focusable="false">
          <path d="M1 6h18" stroke="#31435a" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'flow':
      return (
        <svg {...box} viewBox="0 0 20 12" aria-hidden focusable="false">
          <path d="M1 6h12" stroke="#2f7fb8" strokeWidth="2" strokeDasharray="3 2.5" strokeLinecap="round" />
          <path d="m13 3 5 3-5 3z" fill="#2f7fb8" />
        </svg>
      );
    case 'blob':
      return (
        <svg {...box} viewBox="0 0 20 12" aria-hidden focusable="false">
          <ellipse cx="10" cy="6" rx="7" ry="4.5" fill="#5aa0cd" opacity="0.45" stroke="#5aa0cd" />
        </svg>
      );
    case 'ramp':
      return (
        <svg {...box} viewBox="0 0 20 12" aria-hidden focusable="false">
          <defs>
            <linearGradient id="dl-ramp" x1="0" x2="1">
              <stop offset="0" stopColor={RAMP_LOW_HEX} />
              <stop offset="1" stopColor={RAMP_HIGH_HEX} />
            </linearGradient>
          </defs>
          <rect x="1" y="2" width="18" height="8" rx="2" fill="url(#dl-ramp)" />
        </svg>
      );
    case 'hatch':
      return (
        <svg {...box} viewBox="0 0 20 12" aria-hidden focusable="false">
          <defs>
            <pattern id="dl-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke="#7c8a72" strokeWidth="1.4" />
            </pattern>
          </defs>
          <rect x="1" y="2" width="18" height="8" rx="2" fill="url(#dl-hatch)" stroke="#7c8a72" />
        </svg>
      );
  }
}

function Chip({
  label,
  swatch,
  on,
  disabled,
  title,
  tour,
  onToggle,
}: {
  readonly label: string;
  readonly swatch: Swatch;
  readonly on: boolean;
  readonly disabled: boolean;
  readonly title: string;
  /** The tour's name for this chip, so the overlay can find it. */
  readonly tour: string;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-tour={tour}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space(2),
        padding: `${String(space(2))}px ${String(space(3))}px`,
        border: `1px solid ${on ? brand.base : line.base}`,
        borderRadius: radius.base,
        background: on ? brand.base : surface.raised,
        color: on ? ink.inverse : disabled ? ink.subtle : ink.base,
        font: type(text.label, { weight: on ? weight.semibold : weight.medium, leading: 1.2 }),
        opacity: disabled ? 0.55 : 1,
        transition: 'background-color 120ms ease, border-color 120ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          // The swatch keeps its own colours when the chip fills, so a person
          // can still match a chip to a mark on the map.
          background: on ? surface.raised : 'transparent',
          borderRadius: 4,
          padding: on ? '1px 2px' : 0,
        }}
      >
        <SwatchMark kind={swatch} />
      </span>
      {label}
    </button>
  );
}

export interface LayerChipsProps {
  readonly state: LayerState;
  readonly onToggle: (key: LayerKey) => void;
  /** Keys that cannot be turned on yet — the terrain raster is still loading. */
  readonly unavailableKeys?: readonly LayerKey[];
}

/**
 * The four chips, and the Layers button that opens the rest.
 *
 * The button belongs in this row rather than beside it: the chips and the
 * panel are one decision seen at two depths, and a person looking for a layer
 * that is not a chip should find the place it lives without hunting.
 */
export function LayerChips({ state, onToggle, unavailableKeys = [] }: LayerChipsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      // Named for the tour, which points at this row as a whole for its second
      // step and at four of its chips individually after that.
      data-tour="chips"
      style={{ display: 'flex', alignItems: 'center', gap: space(2), flexWrap: 'wrap' }}
    >
      {CHIP_KEYS.map((key) => {
        const spec = specOf(key);
        const disabled = unavailableKeys.includes(key);
        return (
          <Chip
            key={key}
            label={spec.chip}
            swatch={spec.swatch}
            on={state[key]}
            disabled={disabled}
            title={disabled ? `${spec.label} is still loading` : spec.label}
            tour={`chip-${key}`}
            onToggle={() => {
              onToggle(key);
            }}
          />
        );
      })}

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          data-tour="layers"
          onClick={() => {
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: space(2),
            padding: `${String(space(2))}px ${String(space(3))}px`,
            border: `1px solid ${line.base}`,
            borderRadius: radius.base,
            background: surface.raised,
            color: ink.base,
            font: type(text.label, { weight: weight.medium, leading: 1.2 }),
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
            <path
              d="m8 2 6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          Layers
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 6px)',
              zIndex: 5,
              width: 288,
              padding: space(4),
              background: surface.raised,
              border: `1px solid ${line.base}`,
              borderRadius: radius.large,
              boxShadow: shadow.lifted,
            }}
          >
            <p
              style={{
                margin: `0 0 ${String(space(3))}px`,
                font: type(text.micro, { weight: weight.semibold }),
                letterSpacing: tracking.caps,
                textTransform: 'uppercase',
                color: ink.subtle,
              }}
            >
              Other map layers
            </p>
            {PANEL_KEYS.map((key) => {
              const spec = specOf(key);
              const disabled = unavailableKeys.includes(key);
              return (
                <label
                  key={key}
                  title={disabled ? `${spec.label} is still loading` : spec.label}
                  style={{
                    display: 'flex',
                    gap: space(3),
                    alignItems: 'flex-start',
                    marginBottom: space(3),
                    font: type(text.label, { leading: 1.5 }),
                    color: disabled ? ink.subtle : ink.base,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={state[key]}
                    disabled={disabled}
                    onChange={() => {
                      onToggle(key);
                    }}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: 'block' }}>{spec.label}</span>
                    <BasisTag basis={spec.basis} />
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BasisTag({ basis: which }: { readonly basis: LayerSpec['basis'] }) {
  const tone = which === 'Official recorded data' ? basis.recorded : basis.derived;
  return (
    <span
      style={{
        display: 'inline-block',
        marginTop: space(1),
        padding: `1px ${String(space(2))}px`,
        borderRadius: radius.pill,
        font: type(text.micro, { leading: 1.5 }),
        background: tone.fill,
        color: tone.ink,
      }}
    >
      {which}
    </span>
  );
}

/**
 * The legend, and where "distinguish official recorded data from system-derived
 * information" is met — AC 1.1.4, and AC 1.3.1 for the terrain in particular.
 *
 * The criterion asks that every layer carry *Official recorded data* or
 * *System-derived result*. It used to sit under each checkbox in the panel;
 * with the controls compressed into chips there is no room for it there, and a
 * tooltip is not something a layer *carries*. So it lives here, on screen
 * beside the mark it describes, for every layer that is currently drawn.
 *
 * **It folds, and folds to its own name rather than to nothing.** The map is
 * the thing somebody came for and this sits over a corner of it; on a laptop
 * that is a real amount of map. Collapsed it keeps the words *Map legend* and
 * the control, because a legend that vanishes completely is one nobody can
 * find again — and the criterion it serves is about the key being *available*,
 * which a fold does not break and a disappearance would.
 *
 * **It does not place itself.** It used to be absolutely positioned at the
 * bottom left; it now sits at the top right, in the same row as the search box
 * and the chips, laid out by flexbox rather than by two corners that know
 * nothing about each other. That is what stops it colliding when the chips
 * wrap on a narrow window — pinned to a corner it would simply be underneath
 * them — and it is why the caller owns the position now.
 */
export function MapLegend({ state }: { readonly state: LayerState }) {
  const [open, setOpen] = useState(true);
  const shown = LAYERS.filter((l) => state[l.key]);
  if (shown.length === 0) return null;

  return (
    <div
      style={{
        pointerEvents: 'auto',
        marginLeft: 'auto',
        width: 260,
        maxWidth: '100%',
        padding: `${String(space(3))}px ${String(space(4))}px`,
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(6px)',
        border: `1px solid ${line.base}`,
        borderRadius: radius.base,
        boxShadow: shadow.floating,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: space(3) }}>
        <p
          style={{
            margin: 0,
            font: type(text.micro, { weight: weight.semibold }),
            letterSpacing: tracking.caps,
            textTransform: 'uppercase',
            color: ink.subtle,
          }}
        >
          Map legend
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            padding: 0,
            font: type(text.micro, { weight: weight.medium }),
            color: ink.muted,
            whiteSpace: 'nowrap',
          }}
        >
          {open ? '\u2039 Hide' : '\u203a Show'}
        </button>
      </div>

      {open && (
        <>
          {shown.map((spec) =>
            spec.swatch === 'ramp' ? (
              <TerrainScale key={spec.key} spec={spec} />
            ) : (
              <div
                key={spec.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space(2),
                  marginTop: space(2),
                }}
              >
                <SwatchMark kind={spec.swatch} />
                <span style={{ font: type(text.small, { leading: 1.35 }), color: ink.base }}>
                  {spec.label}
                </span>
                <span style={{ marginLeft: 'auto' }}>
                  <BasisDot basis={spec.basis} />
                </span>
              </div>
            ),
          )}
          <p
            style={{
              margin: `${String(space(3))}px 0 0`,
              paddingTop: space(2),
              borderTop: `1px solid ${line.hair}`,
              font: type(text.micro, { leading: 1.45 }),
              color: ink.subtle,
            }}
          >
            <BasisDot basis="Official recorded data" /> recorded by the council
            <br />
            <BasisDot basis="System-derived result" /> calculated by DrainLens
          </p>
        </>
      )}
    </div>
  );
}

/**
 * The ground surface, as a scale rather than a colour chip.
 *
 * An 18-pixel gradient square says "this layer is a gradient" and nothing
 * else: a reader looking at tan and blue-grey ground has no way to learn which
 * is uphill. The bar is the full width of the legend with both ends named, so
 * the key answers the question the layer raises.
 *
 * **Named, not numbered, and the reason is in `terrain.ts`.** The ramp is
 * fitted between the 2nd and 98th percentiles of the ground in *this* extent,
 * so a colour means "low for around here" rather than a height. The surface's
 * own accuracy is about 25 cm, which would not support a scale in metres even
 * if the ramp were absolute — and a metric axis would invite exactly the
 * reading the layer cannot carry. Hence "Lower"/"Higher" and a line saying
 * what they are relative to.
 */
function TerrainScale({ spec }: { readonly spec: LayerSpec }) {
  return (
    <div style={{ marginTop: space(3) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space(2) }}>
        <span style={{ font: type(text.small, { leading: 1.35 }), color: ink.base }}>
          {spec.label}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <BasisDot basis={spec.basis} />
        </span>
      </div>
      <div
        aria-hidden
        style={{
          height: 10,
          marginTop: space(1),
          borderRadius: radius.small,
          border: `1px solid ${line.hair}`,
          background: `linear-gradient(to right, ${RAMP_LOW_HEX}, ${RAMP_HIGH_HEX})`,
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 2,
          font: type(text.micro, { leading: 1.4 }),
          color: ink.subtle,
        }}
      >
        <span>Lower</span>
        <span>Higher</span>
      </div>
      <p style={{ margin: 0, font: type(text.micro, { leading: 1.4 }), color: ink.subtle }}>
        Relative to this area, not to sea level.
      </p>
    </div>
  );
}

function BasisDot({ basis: which }: { readonly basis: LayerSpec['basis'] }) {
  const recorded = which === 'Official recorded data';
  const tone = recorded ? basis.recorded : basis.derived;
  return (
    <span
      aria-label={which}
      title={which}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        marginRight: 4,
        borderRadius: recorded ? radius.pill : 2,
        background: tone.ink,
        verticalAlign: 'baseline',
      }}
    />
  );
}
