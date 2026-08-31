/**
 * The street cross-section, drawn by hand in SVG.
 *
 * The drawing has one job beyond showing the connections: making it obvious
 * which parts of it are recorded and which are drawing. Everything horizontal
 * — which pipe connects, on which side, how wide it is relative to its
 * neighbours — comes from the council record. Everything vertical is invented,
 * because no invert level exists for any pit in this area.
 *
 * So the ground line is drawn as a real surface and the depths below it are
 * drawn deliberately flat and evenly spaced, with the vertical axis labelled
 * as illustrative inside the figure rather than in a footnote. A cross-section
 * whose vertical scale looked plausible would be inventing the one measurement
 * the record does not have.
 */

import {
  type CrossSection as Section,
  DEPTH_IS_ABSENT,
  NO_CAPACITY_CLAIM,
  type SectionOutcome,
  type SectionPipe,
  UNAVAILABLE_TITLE,
  relativeWidth,
  summarise,
} from '../crosssection/section.js';

const RECORDED = '#1f5b4e';
const RECORDED_TINT = '#dcece6';
const DRAWN = '#8593a0';
const SURFACE = '#c7b299';

const LABEL: React.CSSProperties = { fontSize: 12, letterSpacing: 0.6, color: '#8593a0' };

export interface CrossSectionProps {
  readonly outcome: SectionOutcome;
  readonly onClose: () => void;
}

export function CrossSection({ outcome, onClose }: CrossSectionProps) {
  return (
    <section style={{ paddingTop: 12, marginTop: 12, borderTop: '1px solid #e6ebe4' }}>
      <span style={LABEL}>STREET CROSS-SECTION</span>
      {outcome.kind === 'unavailable' ? (
        <Unavailable reasons={outcome.reasons} />
      ) : (
        <Available section={outcome} />
      )}
      <button
        type="button"
        onClick={onClose}
        style={{
          marginTop: 10,
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          color: '#1f6f5c',
          cursor: 'pointer',
        }}
      >
        Close the cross-section
      </button>
    </section>
  );
}

/** AC 1.3.2: say it cannot be drawn, say what is missing, invent nothing. */
function Unavailable({ reasons }: { readonly reasons: readonly string[] }) {
  return (
    <div
      style={{
        margin: '8px 0 0',
        padding: '12px 14px',
        background: '#f7f4ee',
        border: '1px solid #e8dfd0',
        borderRadius: 10,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 6 }}>{UNAVAILABLE_TITLE}</strong>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#4d5f6e', fontSize: 13 }}>
        {reasons.map((reason) => (
          <li key={reason} style={{ marginBottom: 4 }}>
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Available({ section }: { readonly section: Section }) {
  const all = [...section.incoming, ...section.outgoing];

  return (
    <>
      <Figure section={section} all={all} />

      <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: '#3d5265' }}>
        {all.map((pipe) => (
          <li key={`${pipe.direction}-${pipe.ref}`} style={{ marginBottom: 3 }}>
            {summarise(pipe)}
          </li>
        ))}
      </ul>

      <div
        style={{
          margin: '10px 0 0',
          padding: '10px 12px',
          background: '#f6f8f4',
          border: '1px solid #e6ebe4',
          borderRadius: 8,
          fontSize: 12,
          color: '#4d5f6e',
        }}
      >
        <strong style={{ display: 'block', marginBottom: 4, color: '#1e2b36' }}>
          What is missing or uncertain here
        </strong>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {section.missing.map((item) => (
            <li key={item} style={{ marginBottom: 3 }}>
              {item}
            </li>
          ))}
        </ul>
        <p style={{ margin: '8px 0 0' }}>{NO_CAPACITY_CLAIM}</p>
      </div>
    </>
  );
}

/**
 * The figure's accessible description.
 *
 * A screen reader gets the same three facts a sighted reader gets from the
 * drawing: what connects, in which direction, and that the depth is not real.
 */
export function sectionLabel(section: Section): string {
  const count = (n: number) => `${n} ${n === 1 ? 'pipe' : 'pipes'}`;
  return (
    `Cross-section of pit ${section.assetNumber}: ` +
    `${count(section.incoming.length)} arriving, ${count(section.outgoing.length)} leaving. ` +
    'No depth is recorded, so the vertical positions are illustrative.'
  );
}

const WIDTH = 360;
const HEIGHT = 190;
const GROUND_Y = 46;
const PIT_TOP = GROUND_Y;
const PIT_BOTTOM = 150;
const PIT_X = WIDTH / 2 - 26;
const PIT_W = 52;

/** Evenly spaced because the record gives no depth to space them by. */
function depthsFor(count: number): number[] {
  if (count === 0) return [];
  const top = PIT_TOP + 30;
  const span = PIT_BOTTOM - 18 - top;
  if (count === 1) return [top + span / 2];
  return Array.from({ length: count }, (_, i) => top + (span * i) / (count - 1));
}

function Figure({ section, all }: { readonly section: Section; readonly all: readonly SectionPipe[] }) {
  const inY = depthsFor(section.incoming.length);
  const outY = depthsFor(section.outgoing.length);
  const thickness = (pipe: SectionPipe) => 4 + relativeWidth(pipe, all) * 12;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={sectionLabel(section)}
      style={{ width: '100%', height: 'auto', marginTop: 8, display: 'block' }}
    >
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="8" fill="#ffffff" stroke="#e6ebe4" />

      {/* Street surface — recorded in the sense that the street is there. */}
      <rect x="10" y={GROUND_Y - 12} width={WIDTH - 20} height="12" fill="#eef3ea" />
      <line x1="10" y1={GROUND_Y} x2={WIDTH - 10} y2={GROUND_Y} stroke={SURFACE} strokeWidth="3" />
      <text x="14" y={GROUND_Y - 18} fontSize="10" fill={DRAWN} letterSpacing="0.6">
        STREET SURFACE
      </text>

      {/* The vertical axis is the invented one, and says so inside the figure. */}
      <g>
        <line
          x1={WIDTH - 26}
          y1={GROUND_Y + 6}
          x2={WIDTH - 26}
          y2={PIT_BOTTOM}
          stroke={DRAWN}
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <text
          x={WIDTH - 20}
          y={(GROUND_Y + PIT_BOTTOM) / 2}
          fontSize="9"
          fill={DRAWN}
          transform={`rotate(90 ${WIDTH - 20} ${(GROUND_Y + PIT_BOTTOM) / 2})`}
          textAnchor="middle"
        >
          depth not recorded — spacing illustrative
        </text>
      </g>

      {section.incoming.map((pipe, index) => (
        <PipeRun
          key={`in-${pipe.ref}`}
          from={[12, inY[index]!]}
          to={[PIT_X, inY[index]!]}
          width={thickness(pipe)}
          label={pipe.diameterMm === null ? 'not recorded' : `${pipe.diameterMm} mm`}
          arrowAt={[PIT_X - 10, inY[index]!]}
          pointsRight
        />
      ))}

      {section.outgoing.map((pipe, index) => (
        <PipeRun
          key={`out-${pipe.ref}`}
          from={[PIT_X + PIT_W, outY[index]!]}
          to={[WIDTH - 34, outY[index]!]}
          width={thickness(pipe)}
          label={pipe.diameterMm === null ? 'not recorded' : `${pipe.diameterMm} mm`}
          arrowAt={[WIDTH - 44, outY[index]!]}
          pointsRight
        />
      ))}

      {/* The pit. Its depth is drawn, not known. */}
      <rect
        x={PIT_X}
        y={PIT_TOP}
        width={PIT_W}
        height={PIT_BOTTOM - PIT_TOP}
        rx="3"
        fill={RECORDED_TINT}
        stroke={RECORDED}
        strokeWidth="2"
      />
      <text x={WIDTH / 2} y={PIT_BOTTOM + 16} fontSize="10" fill={RECORDED} textAnchor="middle">
        Pit {section.assetNumber}
      </text>

      <text x="14" y={HEIGHT - 8} fontSize="9" fill={DRAWN}>
        Horizontal: recorded · Vertical: illustrative
      </text>
    </svg>
  );
}

function PipeRun({
  from,
  to,
  width,
  label,
  arrowAt,
  pointsRight,
}: {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly width: number;
  readonly label: string;
  readonly arrowAt: readonly [number, number];
  readonly pointsRight: boolean;
}) {
  const [x1, y1] = from;
  const [x2] = to;
  const [ax, ay] = arrowAt;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y1} stroke={RECORDED} strokeWidth={width} strokeLinecap="butt" />
      <polygon
        points={
          pointsRight
            ? `${ax + 8},${ay} ${ax},${ay - 5} ${ax},${ay + 5}`
            : `${ax - 8},${ay} ${ax},${ay - 5} ${ax},${ay + 5}`
        }
        fill={RECORDED}
      />
      <text x={x1 + 4} y={y1 - width / 2 - 4} fontSize="9" fill={RECORDED}>
        {label}
      </text>
    </g>
  );
}
