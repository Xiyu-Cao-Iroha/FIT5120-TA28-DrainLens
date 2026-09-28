/**
 * The blocked-drain comparison, drawn: the homepage's feature picture and the
 * chooser's thumbnail.
 *
 * **Illustrative geometry, the product's own colours** — the same bargain
 * `FramedMap` makes and for the same reason. A real result at this size is a
 * handful of violet cells on a mesh of pipes with nothing legible in it, and
 * what the picture has to teach is what the marks look like: a drain the
 * comparison treats as blocked, water moving towards it, and the violet patch
 * where the blocked setting leaves more surface water than the clear one. The
 * palette is imported rather than retyped, so the violet here is the violet
 * the result map draws.
 *
 * **The blocked mark is in the assumption colour, not an alarm colour.** The
 * blockage is something the person sets, not something recorded about a real
 * drain, and `basis.assumed` is the colour this product already uses for a
 * choice the person made. A red cross on a drain would read as a fault report.
 *
 * **The rain is drizzle, not a storm.** The comparison is run at one of three
 * published total rainfall amounts; a picture of a downpour would suggest
 * the answer is about extreme weather.
 *
 * Both are in one file so the thumbnail cannot come to show a different mark
 * from the figure it stands for.
 */

import { DERIVED_DAY } from '../map/derived.js';
import { DIFFERENCE_FILL } from '../map/difference.js';
import { DAY } from '../map/draw.js';
import {
  basis,
  font,
  ink,
  line,
  radius,
  shadow,
  space,
  surface,
  text,
  type,
  weight,
} from '../ui/theme.js';

/** Sage blocks between the streets, as in `FramedMap`. */
const BLOCK = 'rgba(139, 163, 133, 0.20)';

/**
 * The card's accent strip on the chooser, where the four guides use the colour
 * their layer is drawn in. The comparison's layer is the difference, so this
 * is the difference's violet.
 */
export const COMPARE_ACCENT = DIFFERENCE_FILL;

/** The words for the comparison's way in, shared by the homepage and the chooser. */
export const COMPARE_CARD = {
  title: 'What happens if a drain is blocked?',
  body: 'Pick a nearby drain and compare it clear and blocked under the same rainfall.',
  caption: 'Blocked drain comparison',
} as const;

/** The difference's cells in the figure, as [x, y], upstream of the blocked drain. */
const CELL = 14;
const CELLS: readonly (readonly [number, number])[] = [
  ...[210, 224, 238, 252, 266, 280, 294, 308, 322, 336, 350, 364, 378, 392].map((x) => [x, 262] as const),
  ...[252, 266, 280, 294, 308, 322, 336, 350, 364, 378, 392].map((x) => [x, 248] as const),
  ...[308, 322, 336, 350, 364, 378].map((x) => [x, 234] as const),
  ...[336, 350, 364].map((x) => [x, 220] as const),
];

/** The same, at thumbnail size: cells of 8 in a 200 by 104 picture. */
const THUMB_CELLS: readonly (readonly [number, number])[] = [
  ...[40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120].map((x) => [x, 64] as const),
  ...[64, 72, 80, 88, 96, 104, 112].map((x) => [x, 56] as const),
  ...[88, 96, 104].map((x) => [x, 48] as const),
];

/** Rain streaks, as [x, y]. Sparse and short on purpose — see the file note. */
const RAIN: readonly (readonly [number, number])[] = [
  [150, 112], [214, 150], [300, 106], [388, 132], [452, 104], [540, 140], [578, 110],
  [170, 322], [256, 362], [352, 330], [430, 376], [520, 318], [572, 370],
];

export function BlockedDrainFigure() {
  return (
    <div
      aria-hidden
      className="home__preview"
      style={{
        background: surface.raised,
        border: `1px solid ${line.base}`,
        borderRadius: radius.large,
        boxShadow: shadow.lifted,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* The comparison's two settings, the blocked one showing. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space(2),
          padding: `${String(space(2))}px ${String(space(3))}px`,
          borderBottom: `1px solid ${line.hair}`,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            padding: 2,
            borderRadius: radius.small,
            background: surface.sunken,
            font: type(text.micro, { weight: weight.semibold, leading: 1.6 }),
          }}
        >
          <span style={{ padding: `1px ${String(space(2))}px`, color: ink.subtle }}>Clear</span>
          <span
            style={{
              padding: `1px ${String(space(2))}px`,
              borderRadius: radius.small - 2,
              background: basis.assumed.fill,
              color: basis.assumed.ink,
            }}
          >
            Blocked
          </span>
        </span>
        <span style={{ marginLeft: 'auto', font: type(text.small), color: ink.subtle }}>
          Same rainfall, two settings
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 240, display: 'flex' }}>
        <svg
          // A crop of a 660 by 430 drawing, so the drain and the cells beside
          // it are large enough to read at the width of half a column.
          viewBox="120 96 470 306"
          preserveAspectRatio="xMidYMid slice"
          role="presentation"
          style={{ display: 'block', width: '100%', height: '100%' }}
        >
          <rect width="660" height="430" fill={DAY.ground} />

          <g fill={BLOCK}>
            <rect x="24" y="40" width="160" height="120" rx="12" />
            <rect x="262" y="36" width="196" height="116" rx="12" />
            <rect x="524" y="30" width="126" height="120" rx="12" />
            <rect x="24" y="300" width="160" height="110" rx="12" />
            <rect x="262" y="312" width="200" height="100" rx="12" />
            <rect x="524" y="300" width="126" height="110" rx="12" />
          </g>

          {/* One long street and two crossing it, each with its kerb. */}
          <g fill="none" strokeLinecap="butt">
            <path d="M-20 232H680" stroke={DAY.roadEdge} strokeWidth="96" />
            <path d="M-20 232H680" stroke={DAY.road} strokeWidth="88" />
            <path d="M223 -20V450M491 -20V450" stroke={DAY.roadEdge} strokeWidth="56" />
            <path d="M223 -20V450M491 -20V450" stroke={DAY.road} strokeWidth="48" />
          </g>

          {/*
            Where the blocked setting leaves more surface water: square cells,
            because the result map draws the difference as the calculation's
            grid cells and not as a smooth pool. Spread upstream of the drain
            along the gutter, which is the way the arrows say the water was going.
          */}
          <g fill={DIFFERENCE_FILL}>
            {CELLS.map(([x, y]) => (
              <rect key={`${String(x)}-${String(y)}`} x={x} y={y} width={CELL - 1} height={CELL - 1} />
            ))}
          </g>

          {/* The recorded pipe under the street, joining the pits. */}
          <path d="M150 260H560" stroke={DAY.pipe} strokeWidth="3.5" strokeLinecap="round" />

          {/* Water moving along the gutter towards the drain. */}
          {[136, 196, 262].map((x) => (
            <g key={x}>
              <path
                d={`M${String(x)} 274h46`}
                stroke={DERIVED_DAY.channel}
                strokeWidth="3"
                strokeDasharray="10 7"
                strokeLinecap="round"
              />
              <path
                d={`M${String(x + 58)} 274l-10 -6v12z`}
                fill={DERIVED_DAY.channel}
              />
            </g>
          ))}

          {/* Rain, drawn over everything but the marks that matter. */}
          <g stroke={DERIVED_DAY.channel} strokeWidth="2" strokeLinecap="round" opacity="0.45">
            {RAIN.map(([x, y]) => (
              <path key={`${String(x)}-${String(y)}`} d={`M${String(x)} ${String(y)}l-6 16`} />
            ))}
          </g>

          <Pit x={150} y={260} />
          <Pit x={560} y={260} />
          <BlockedPit x={402} y={260} />

          {/* The assumption, named at the drain it is about. */}
          <g fontFamily={font.sans}>
            <path d="M402 226v-22" stroke={basis.assumed.ink} strokeWidth="1.5" />
            <rect x="330" y="170" width="144" height="34" rx="17" fill={basis.assumed.fill} stroke={basis.assumed.ink} strokeOpacity="0.35" />
            <text x="402" y="192" textAnchor="middle" fontSize="14" fontWeight={weight.semibold} fill={basis.assumed.ink}>
              Blocked (assumed)
            </text>
          </g>
        </svg>
      </div>

      {/* The one line a person needs to read the violet. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space(2),
          padding: `${String(space(2))}px ${String(space(3))}px`,
          borderTop: `1px solid ${line.hair}`,
          font: type(text.small, { leading: 1.4 }),
          color: ink.muted,
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 14,
            height: 14,
            borderRadius: 3,
            background: DIFFERENCE_FILL,
          }}
        />
        More surface water in the blocked setting than the clear one
      </div>
    </div>
  );
}

function Pit({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="10" fill={DAY.pitEdge} stroke={DAY.pit} strokeWidth="3" />
      <circle cx={x} cy={y} r="3.8" fill={DAY.pit} />
    </g>
  );
}

/** A pit with a bar across it, in the assumption colour. */
function BlockedPit({ x, y, scale = 1 }: { readonly x: number; readonly y: number; readonly scale?: number }) {
  const r = 13 * scale;
  const d = r * 0.62;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={DAY.pitEdge} stroke={basis.assumed.ink} strokeWidth={3.5 * scale} />
      <path
        d={`M${String(x - d)} ${String(y - d)}L${String(x + d)} ${String(y + d)}M${String(x + d)} ${String(y - d)}L${String(x - d)} ${String(y + d)}`}
        stroke={basis.assumed.ink}
        strokeWidth={3 * scale}
        strokeLinecap="round"
      />
    </g>
  );
}

/** The chooser's thumbnail: the same marks at the size of `PathThumb`. */
export function CompareThumb() {
  return (
    <svg
      viewBox="0 0 200 104"
      role="presentation"
      style={{ width: '100%', height: 104, display: 'block' }}
    >
      <rect width="200" height="104" fill={DAY.ground} />
      <path d="M-8 56h216" stroke={DAY.road} strokeWidth="30" fill="none" />
      <path d="M150 -8v120" stroke={DAY.road} strokeWidth="14" fill="none" />
      <g fill={DIFFERENCE_FILL}>
        {THUMB_CELLS.map(([x, y]) => (
          <rect key={`${String(x)}-${String(y)}`} x={x} y={y} width="7.4" height="7.4" />
        ))}
      </g>
      {[18, 60].map((x) => (
        <g key={x}>
          <path
            d={`M${String(x)} 66h24`}
            stroke={DERIVED_DAY.channel}
            strokeWidth="2"
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
          <path d={`M${String(x + 31)} 66l-6 -3.5v7z`} fill={DERIVED_DAY.channel} />
        </g>
      ))}
      <BlockedPit x={122} y={66} scale={0.6} />
    </svg>
  );
}
