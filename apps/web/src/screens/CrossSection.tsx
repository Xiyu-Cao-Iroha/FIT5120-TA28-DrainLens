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
  SURFACE_ENTRY_NOTE,
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

/**
 * Water is a third kind of mark, and the figure says so.
 *
 * Green is what the council recorded and grey is what this drawing invented to
 * fill a gap in the record. Water is neither: it is what a drainage pit *does*,
 * which is general knowledge about drainage rather than a measurement of this
 * pit. Left in either of the other two colours it would read as a recorded
 * flow, or as our estimate of one, and it is neither.
 */
const WATER = '#2f7fb5';
const WATER_TINT = '#cfe4f3';

const LABEL: React.CSSProperties = { fontSize: 12, letterSpacing: 0.6, color: '#8593a0' };

export interface CrossSectionProps {
  readonly outcome: SectionOutcome;
}

/**
 * The drawing, and nothing but the drawing.
 *
 * It used to open from a link below the recorded fields and close itself
 * again. It is the first thing on the pit's card now, on a teammate's report
 * that the structure is what a resident needs before a table of asset numbers
 * means anything to them: a picture of a pit with water running through it
 * answers "what am I looking at", and the fields answer a question you can
 * only ask afterwards.
 *
 * The prose that used to sit under it is in `SectionNotes`, which the card
 * puts behind *View technical details*. Nothing was dropped; it moved.
 */
export function CrossSection({ outcome }: CrossSectionProps) {
  return (
    <section>
      <span style={LABEL}>STREET CROSS-SECTION</span>
      {outcome.kind === 'unavailable' ? (
        <Unavailable reasons={outcome.reasons} />
      ) : (
        <>
          <Figure section={outcome} all={[...outcome.incoming, ...outcome.outgoing]} />
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#4d5f6e' }}>
            {SURFACE_ENTRY_NOTE[outcome.surfaceEntry]}
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Everything the drawing implies and does not say, in the words it was written
 * in.
 *
 * Behind a disclosure on the card, under three plain sentences that summarise
 * it. The summary is what most people need; these are the sentences the
 * criteria are written against, and shortening them into the summary would
 * have lost the distinction between "we do not show depth" and "no depth is
 * recorded for any pit in this area".
 */
export function SectionNotes({ outcome }: { readonly outcome: SectionOutcome }) {
  if (outcome.kind === 'unavailable') return null;
  const all = [...outcome.incoming, ...outcome.outgoing];
  return (
    <>
      <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13, color: '#3d5265' }}>
        {all.map((pipe) => (
          <li key={`${pipe.direction}-${pipe.ref}`} style={{ marginBottom: 3 }}>
            {summarise(pipe)}
          </li>
        ))}
      </ul>

      <div
        style={{
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
          {outcome.missing.map((item) => (
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

/** AC 1.1.7.f: say it cannot be drawn, say what is missing, invent nothing. */
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
    `${SURFACE_ENTRY_NOTE[section.surfaceEntry]} ` +
    'No depth is recorded, so the vertical positions are illustrative.'
  );
}

const WIDTH = 360;
const HEIGHT = 214;
/** Room above the street for the run-off arrow, where there is one to draw. */
const GROUND_Y = 62;
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
  const inlet = section.surfaceEntry === 'recorded-inlet';
  const pitMid = PIT_X + PIT_W / 2;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={sectionLabel(section)}
      style={{ width: '100%', height: 'auto', marginTop: 8, display: 'block' }}
    >
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="8" fill="#ffffff" stroke="#e6ebe4" />

      {/*
        Run-off into the grate, drawn only where the record says there is one.
        126 pits here are recorded as junctions and 41 as system nodes, and an
        arrow of water entering one of those states something the record
        contradicts. The decision is made and tested in surfaceEntryOf.
      */}
      {inlet && (
        <g>
          <line
            x1={pitMid}
            y1={GROUND_Y - 36}
            x2={pitMid}
            y2={GROUND_Y - 10}
            stroke={WATER}
            strokeWidth="2.5"
          />
          <polygon
            points={`${pitMid},${GROUND_Y - 3} ${pitMid - 5},${GROUND_Y - 12} ${pitMid + 5},${GROUND_Y - 12}`}
            fill={WATER}
          />
          <text x={pitMid - 10} y={GROUND_Y - 34} fontSize="10" fill={WATER} textAnchor="end">
            water flows in
          </text>
        </g>
      )}

      {/* Street surface, recorded in the sense that the street is there. */}
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
          depth not recorded, spacing illustrative
        </text>
      </g>

      {section.incoming.map((pipe, index) => (
        <PipeRun
          key={`in-${pipe.ref}`}
          from={[12, inY[index]!]}
          to={[PIT_X, inY[index]!]}
          width={thickness(pipe)}
          label={pipe.diameterMm === null ? 'not recorded' : `${pipe.diameterMm} mm`}
          flow={index === 0 ? 'water in' : null}
          arrowAt={[PIT_X - 10, inY[index]!]}
        />
      ))}

      {section.outgoing.map((pipe, index) => (
        <PipeRun
          key={`out-${pipe.ref}`}
          from={[PIT_X + PIT_W, outY[index]!]}
          to={[WIDTH - 34, outY[index]!]}
          width={thickness(pipe)}
          label={pipe.diameterMm === null ? 'not recorded' : `${pipe.diameterMm} mm`}
          flow={index === 0 ? 'water out' : null}
          arrowAt={[WIDTH - 44, outY[index]!]}
        />
      ))}

      {/* The pit. Its depth is drawn, not known; the water in it is neither. */}
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
      <rect x={PIT_X + 2} y={PIT_BOTTOM - 34} width={PIT_W - 4} height="32" fill={WATER_TINT} />
      <line
        x1={PIT_X + 2}
        y1={PIT_BOTTOM - 34}
        x2={PIT_X + PIT_W - 2}
        y2={PIT_BOTTOM - 34}
        stroke={WATER}
        strokeWidth="1.5"
      />

      <text x={pitMid} y={PIT_BOTTOM + 16} fontSize="10" fill={RECORDED} textAnchor="middle">
        Pit {section.assetNumber}
      </text>
      <text x={pitMid} y={PIT_BOTTOM + 29} fontSize="10" fill={WATER} textAnchor="middle">
        collects and passes water
      </text>

      <text x="14" y={HEIGHT - 8} fontSize="9" fill={DRAWN}>
        Horizontal: recorded · Vertical: illustrative · Blue: what a pit does, not a measurement
      </text>
    </svg>
  );
}

function PipeRun({
  from,
  to,
  width,
  label,
  flow,
  arrowAt,
}: {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly width: number;
  /** The recorded diameter, or that there is none. */
  readonly label: string;
  /**
   * "water in" or "water out", on the first pipe of each side only.
   *
   * On the first only because a pit with four arriving pipes does not need to
   * be told four times which way they run, and four labels inside a hundred
   * pixels of height is a figure nobody can read. The arrowheads carry the
   * rest.
   */
  readonly flow: string | null;
  readonly arrowAt: readonly [number, number];
}) {
  const [x1, y1] = from;
  const [x2] = to;
  const [ax, ay] = arrowAt;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y1} stroke={RECORDED} strokeWidth={width} strokeLinecap="butt" />
      {/* The water inside the pipe, in the third colour, over the pipe itself. */}
      <line
        x1={x1 + 2}
        y1={y1}
        x2={x2 - 2}
        y2={y1}
        stroke={WATER_TINT}
        strokeWidth={Math.max(2, width - 3)}
        strokeLinecap="butt"
      />
      <polygon points={`${ax + 8},${ay} ${ax},${ay - 5} ${ax},${ay + 5}`} fill={RECORDED} />
      <text x={x1 + 4} y={y1 - width / 2 - 4} fontSize="9" fill={RECORDED}>
        {label}
      </text>
      {flow !== null && (
        <text x={x1 + 4} y={y1 + width / 2 + 11} fontSize="9" fill={WATER}>
          {flow}
        </text>
      )}
    </g>
  );
}
