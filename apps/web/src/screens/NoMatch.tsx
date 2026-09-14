/**
 * The comparison's three states before step 1: finding drains, could not find
 * them, and found none near this address.
 *
 * **The last is the team's request in its own words: there is no match, try
 * another address.** It replaces the prototype's C8, which said the
 * comparison was only available in the Kensington pilot. That stopped being
 * true on 13 September, when the comparison went council-wide; what can still
 * be true is that no drain near *this* address can be compared, and the
 * sentence says that and nothing larger.
 *
 * It is a stop, not a result. Nothing here offers a drain, a condition or a
 * rainfall amount, so `terrain_unavailable` — which is what the old flow
 * produced for such an address, after asking all three — cannot be reached.
 */

import { COMPARISON_RADIUS_M } from '../scenario/eligibility.js';
import { Spinner } from '../ui/Spinner.js';
import { brand, ink, line, radius, shadow, space, surface, text, tracking, type, weight } from '../ui/theme.js';
import { FULL_MAP } from '../ui/terms.js';

export interface NoMatchProps {
  readonly addressLabel: string | null;
  readonly onAnotherAddress: () => void;
  /** Absent when the example address is the one that found nothing. */
  readonly onExample?: (() => void) | undefined;
  readonly onFullMap: () => void;
}

export function NoMatch({ addressLabel, onAnotherAddress, onExample, onFullMap }: NoMatchProps) {
  return (
    <Stage>
      <span
        style={{
          alignSelf: 'flex-start',
          padding: `${String(space(1))}px ${String(space(3))}px`,
          borderRadius: radius.pill,
          background: surface.sunken,
          color: ink.muted,
          font: type(text.micro, { weight: weight.semibold }),
          letterSpacing: tracking.caps,
          textTransform: 'uppercase',
        }}
      >
        No match
      </span>
      <h1
        role="status"
        style={{ margin: 0, font: type(text.title, { weight: weight.semibold, leading: 1.25 }), color: ink.strong }}
      >
        No drain near this address can be compared
      </h1>
      {addressLabel !== null && (
        <p style={{ margin: 0, font: type(text.label, { weight: weight.semibold }), color: ink.muted }}>
          <span aria-hidden>◎ </span>
          {addressLabel}
        </p>
      )}
      <p style={{ margin: 0, font: type(text.body, { leading: 1.55 }), color: ink.base }}>
        We couldn’t find a drain within {COMPARISON_RADIUS_M} m of this address that the comparison can use. Try
        another address.
      </p>
      <p style={{ margin: 0, font: type(text.small, { leading: 1.5 }), color: ink.muted }}>
        This is about the data the comparison needs, not about the drains near you. It does not show whether they
        work or whether the area may flood.
      </p>
      <div style={{ display: 'grid', gap: space(2), marginTop: space(2) }}>
        <button type="button" onClick={onAnotherAddress} style={primary}>
          Try another address
        </button>
        {onExample !== undefined && (
          <button type="button" onClick={onExample} style={secondary}>
            Try an example address
          </button>
        )}
        <button type="button" onClick={onFullMap} style={secondary}>
          Open the {FULL_MAP.toLowerCase()}
        </button>
      </div>
    </Stage>
  );
}

/** "Finding drains you can test near this address…", while the worker loads its list. */
export function FindingDrains({ nearAddress }: { readonly nearAddress: boolean }) {
  return (
    <Stage>
      <Spinner label={nearAddress ? 'Finding drains you can test near this address…' : 'Finding drains you can test…'} />
    </Stage>
  );
}

/**
 * The list of comparable drains could not be loaded.
 *
 * Said as a failure of ours, with the same ways on as the no-match state
 * minus the example — which would fail the same way.
 */
export function DrainsUnavailable({
  onRetry,
  onFullMap,
}: {
  readonly onRetry: () => void;
  readonly onFullMap: () => void;
}) {
  return (
    <Stage>
      <h1
        role="alert"
        style={{ margin: 0, font: type(text.title, { weight: weight.semibold, leading: 1.25 }), color: ink.strong }}
      >
        We couldn’t load the drains the comparison can use
      </h1>
      <p style={{ margin: 0, font: type(text.body, { leading: 1.55 }), color: ink.base }}>
        This is a problem on our side, not with your address. Try again in a moment, or open the full map in the
        meantime.
      </p>
      <div style={{ display: 'grid', gap: space(2), marginTop: space(2) }}>
        <button type="button" onClick={onRetry} style={primary}>
          Try again
        </button>
        <button type="button" onClick={onFullMap} style={secondary}>
          Open the {FULL_MAP.toLowerCase()}
        </button>
      </div>
    </Stage>
  );
}

function Stage({ children }: { readonly children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: `${String(space(8))}px ${String(space(4))}px` }}>
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: space(3),
          width: '100%',
          maxWidth: 520,
          padding: space(6),
          background: surface.raised,
          border: `1px solid ${line.base}`,
          borderRadius: radius.large,
          boxShadow: shadow.lifted,
        }}
      >
        {children}
      </section>
    </div>
  );
}

const primary: React.CSSProperties = {
  padding: `${String(space(3))}px ${String(space(4))}px`,
  font: type(text.body, { weight: weight.semibold }),
  color: ink.inverse,
  background: brand.base,
  border: 'none',
  borderRadius: radius.base,
  cursor: 'pointer',
};

const secondary: React.CSSProperties = {
  padding: `${String(space(3))}px ${String(space(4))}px`,
  font: type(text.body, { weight: weight.semibold }),
  color: ink.strong,
  background: surface.raised,
  border: `1px solid ${line.strong}`,
  borderRadius: radius.base,
  cursor: 'pointer',
};
