/**
 * The guide's markers and highlighted line, drawn over the map canvas.
 *
 * Placement is `guideMarks.ts`; this only draws. Nothing here takes a press:
 * the marks point at the map, and the map underneath stays the thing that is
 * dragged and pressed.
 *
 * **The markers are dark, not coloured.** The design drew step 3's A green and
 * B orange, which would answer the question it asks: *which is on higher
 * ground* is read from the ground colour under each marker, so the marker
 * itself carries no colour of the ramp, and a ring rather than a filled disc
 * sits on the point so the ground at it stays visible.
 */

import { ink, text, type, weight } from '../ui/theme.js';
import { type GuideOverlay, linePath, placeMarker } from './guideMarks.js';
import type { Viewport } from './viewport.js';

const MARK = '#17242e';
/** The design's contour green, the brand green, strong enough over the ramp. */
export const GUIDE_LINE = '#1f6f5c';
const EDGE_INSET_PX = 18;

export function GuideMarks({ overlay, viewport }: { readonly overlay: GuideOverlay; readonly viewport: Viewport }) {
  const { widthPx: w, heightPx: h } = viewport;
  const line = overlay.line;
  const label = line === undefined ? null : placeMarker(viewport, line.labelAt, EDGE_INSET_PX);
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }}>
      {overlay.node}
      <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
        {line !== undefined && (
          <>
            {/* A white casing first, so the line reads over any colour of the ramp. */}
            <path d={linePath(viewport, line.points)} fill="none" stroke="#ffffff" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
            <path d={linePath(viewport, line.points)} fill="none" stroke={GUIDE_LINE} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {(overlay.markers ?? []).map((marker) => {
          const at = placeMarker(viewport, marker.at, EDGE_INSET_PX);
          if (!at.inside) {
            // An edge pin: a small disc with the letter, and a notch towards the point.
            const nx = Math.cos(at.towards) * 13;
            const ny = Math.sin(at.towards) * 13;
            return (
              <g key={marker.id} opacity={0.85}>
                <line x1={at.x} y1={at.y} x2={at.x + nx} y2={at.y + ny} stroke={MARK} strokeWidth={2} />
                <circle cx={at.x} cy={at.y} r={9} fill={MARK} stroke="#ffffff" strokeWidth={1.5} />
                <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fill="#ffffff" style={{ font: type(text.micro, { weight: weight.bold, leading: 1 }) }}>
                  {marker.label}
                </text>
              </g>
            );
          }
          return (
            <g key={marker.id}>
              <circle cx={at.x} cy={at.y} r={9} fill="none" stroke="#ffffff" strokeWidth={5} />
              <circle cx={at.x} cy={at.y} r={9} fill="none" stroke={MARK} strokeWidth={2.5} />
              <circle cx={at.x} cy={at.y} r={2} fill={MARK} />
              {marker.label !== '' && (
                <>
                  <line x1={at.x} y1={at.y - 11} x2={at.x} y2={at.y - 18} stroke={MARK} strokeWidth={2} />
                  <circle cx={at.x} cy={at.y - 30} r={13} fill={MARK} stroke="#ffffff" strokeWidth={2} />
                  <text x={at.x} y={at.y - 30} textAnchor="middle" dominantBaseline="central" fill="#ffffff" style={{ font: type(text.label, { weight: weight.bold, leading: 1 }) }}>
                    {marker.label}
                  </text>
                </>
              )}
              {marker.caption !== undefined && (
                <text
                  x={at.x + 15}
                  y={at.y}
                  dominantBaseline="central"
                  fill={ink.strong}
                  stroke="#ffffff"
                  strokeWidth={4}
                  paintOrder="stroke"
                  style={{ font: type(text.label, { weight: weight.bold, leading: 1 }) }}
                >
                  {marker.caption}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {line !== undefined && label !== null && label.inside && (
        <span
          style={{
            position: 'absolute',
            left: label.x,
            top: label.y,
            transform: 'translate(-50%, calc(-100% - 8px))',
            padding: '1px 8px',
            borderRadius: 999,
            background: GUIDE_LINE,
            color: '#ffffff',
            font: type(text.label, { weight: weight.bold, leading: 1.4 }),
            whiteSpace: 'nowrap',
          }}
        >
          {line.label}
        </span>
      )}
    </div>
  );
}
