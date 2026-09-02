/**
 * The layers, their controls, and the legend that says what each one is.
 *
 * One module because they are one fact seen twice. The chips along the top
 * turn a layer on and off; the legend at the bottom says what its marks mean
 * and where it came from. Kept apart, the two drift — a layer renamed in the
 * control and not in the legend is a map that disagrees with its own key.
 *
 * **The chips are toggles, not a mode switch.** They can all be on at once,
 * which matters: AC 1.1.3.b names five controls and AC 1.1.3.c requires each
 * to turn its layer off and on *individually*. A segmented control in the
 * usual sense — one of four, the others off — would fail both, and it would
 * also be wrong for the product, because the questions overlap. Where water
 * runs is a question about the ground it runs over.
 */
import { useState } from 'react';

import type { DerivedVisibility } from './derived.js';
import { basis, brand, ink, line, radius, shadow, space, surface, text, tracking, type, weight } from '../ui/theme.js';

export type LayerKey = 'pit' | 'pipe' | 'terrain' | 'channel' | 'lowPoint' | 'unavailable';

export type LayerState = Record<LayerKey, boolean>;

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
 * named separately in AC 1.1.3.b, and they answer different questions: the
 * pipes are where water goes, the pits are where it can get in.
 */
export const LAYERS: readonly LayerSpec[] = [
  { key: 'terrain', chip: 'Terrain', label: 'Ground surface', basis: 'System-derived result', swatch: 'ramp' },
  { key: 'pipe', chip: 'Pipes', label: 'Drainage pipes', basis: 'Official recorded data', swatch: 'line' },
  { key: 'pit', chip: 'Pits', label: 'Drainage pits', basis: 'Official recorded data', swatch: 'dot' },
  { key: 'channel', chip: 'Water flow', label: 'Likely surface water paths', basis: 'System-derived result', swatch: 'flow' },
  { key: 'lowPoint', chip: 'Low areas', label: 'Low points and depressions', basis: 'System-derived result', swatch: 'blob' },
  { key: 'unavailable', chip: 'No ground data', label: 'Not enough ground measured', basis: 'System-derived result', swatch: 'hatch' },
];

/**
 * The layers that get a chip of their own.
 *
 * The other two sit behind the Layers button, and neither is a lesser layer.
 * "Not enough ground measured" answers a question about the *data* rather than
 * about the ground. The ground surface is there because it is background: it
 * is on by default, it is what everything else is drawn over, and it is not
 * something a person reaches for while reading a particular street. Both are
 * still individually switchable, which is what AC 1.1.3.b and 1.1.3.c ask —
 * the criteria require a control per layer, not a control in a chip row.
 */
export const PRIMARY_KEYS: readonly LayerKey[] = ['pit', 'pipe', 'channel', 'lowPoint'];

export function visibilityOf(state: LayerState): DerivedVisibility {
  return { channel: state.channel, lowPoint: state.lowPoint, unavailable: state.unavailable };
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
              <stop offset="0" stopColor="#6c8c9e" />
              <stop offset="1" stopColor="#e2d4b2" />
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
  spec,
  on,
  disabled,
  onToggle,
}: {
  readonly spec: LayerSpec;
  readonly on: boolean;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      title={disabled ? `${spec.label} is still loading` : spec.label}
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
        <SwatchMark kind={spec.swatch} />
      </span>
      {spec.chip}
    </button>
  );
}

export interface LayerChipsProps {
  readonly state: LayerState;
  readonly onToggle: (key: LayerKey) => void;
  /** Keys that cannot be turned on yet — the terrain raster is still loading. */
  readonly unavailableKeys?: readonly LayerKey[];
}

export function LayerChips({ state, onToggle, unavailableKeys = [] }: LayerChipsProps) {
  const [open, setOpen] = useState(false);
  const extra = LAYERS.filter((l) => !PRIMARY_KEYS.includes(l.key));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space(2), flexWrap: 'wrap' }}>
      {PRIMARY_KEYS.map((key) => {
        const spec = LAYERS.find((l) => l.key === key)!;
        return (
          <Chip
            key={key}
            spec={spec}
            on={state[key]}
            disabled={unavailableKeys.includes(key)}
            onToggle={() => {
              onToggle(key);
            }}
          />
        );
      })}

      <div style={{ position: 'relative' }}>
        <button
          type="button"
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
              width: 280,
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
            {extra.map((spec) => (
              <label
                key={spec.key}
                style={{
                  display: 'flex',
                  gap: space(3),
                  alignItems: 'flex-start',
                  font: type(text.label, { leading: 1.5 }),
                  color: ink.base,
                }}
              >
                <input
                  type="checkbox"
                  checked={state[spec.key]}
                  onChange={() => {
                    onToggle(spec.key);
                  }}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ display: 'block' }}>{spec.label}</span>
                  <BasisTag basis={spec.basis} />
                </span>
              </label>
            ))}
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
 * The legend, and where AC 1.1.3.d is met.
 *
 * The criterion asks that every layer carry *Official recorded data* or
 * *System-derived result*. It used to sit under each checkbox in the panel;
 * with the controls compressed into chips there is no room for it there, and a
 * tooltip is not something a layer *carries*. So it lives here, on screen
 * beside the mark it describes, for every layer that is currently drawn.
 */
export function MapLegend({ state }: { readonly state: LayerState }) {
  const shown = LAYERS.filter((l) => state[l.key]);
  if (shown.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: space(4),
        bottom: space(4),
        zIndex: 3,
        maxWidth: 260,
        padding: `${String(space(3))}px ${String(space(4))}px`,
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(6px)',
        border: `1px solid ${line.base}`,
        borderRadius: radius.base,
        boxShadow: shadow.floating,
      }}
    >
      <p
        style={{
          margin: `0 0 ${String(space(2))}px`,
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
          color: ink.subtle,
        }}
      >
        Map legend
      </p>
      {shown.map((spec) => (
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
      ))}
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
    </div>
  );
}

/** The compact form of the basis label, where a full pill will not fit. */
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
