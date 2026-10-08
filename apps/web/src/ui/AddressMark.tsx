/**
 * The chosen address, said once and marked the same way everywhere.
 *
 * It used to be a grey line of text — *Current address: 2 Balmer Street,
 * Kensington  Change* — in two places that had each written their own. The
 * change list of 8 October asks for the design's treatment instead: the pin
 * the map draws at the address, the address itself in the page's own ink, and
 * *Change* where somebody who is in the wrong street will look for it.
 *
 * One component rather than two copies, because the two screens that show it
 * had already drifted apart in label and in weight, and the thing a reader is
 * checking is whether this is their street.
 */

import { brand, ink, line, radius, space, surface, text, type, weight } from './theme.js';

export function AddressMark({
  address,
  onChange,
}: {
  readonly address: string;
  /** *Change*, beside the address it changes. Absent where it cannot be. */
  readonly onChange?: (() => void) | undefined;
}) {
  return (
    <p
      style={{
        display: 'inline-flex',
        gap: space(2),
        alignItems: 'center',
        margin: 0,
        padding: `${String(space(1))}px ${String(space(3))}px`,
        border: `1px solid ${line.base}`,
        borderRadius: radius.pill,
        background: surface.raised,
      }}
    >
      {/* The map's own pin, so the mark on the page and the mark on the map
          are recognisably the same thing. */}
      <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
        <path
          d="M6 0C2.7 0 0 2.7 0 6c0 4.2 5.3 9.5 5.6 9.7a.6.6 0 0 0 .8 0C6.7 15.5 12 10.2 12 6c0-3.3-2.7-6-6-6Zm0 8.4A2.4 2.4 0 1 1 6 3.6a2.4 2.4 0 0 1 0 4.8Z"
          fill={brand.base}
        />
      </svg>
      <span style={{ font: type(text.small, { weight: weight.semibold }), color: ink.strong }}>
        {address}
      </span>
      {onChange !== undefined && (
        <button
          type="button"
          onClick={onChange}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: type(text.small),
            color: brand.ink,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            cursor: 'pointer',
          }}
        >
          Change
        </button>
      )}
    </p>
  );
}
