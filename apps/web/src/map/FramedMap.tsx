/**
 * The homepage figure: the product drawn, in the product's own colours.
 *
 * **It used to render the real map onto a canvas**, and the argument for that
 * was that a drawing of a product is not the product. The argument against it
 * won: at the zoom the hero needs, one square kilometre of council drainage is
 * a dense mesh with no legible feature in it, and the thing this figure has to
 * do is show somebody who has never seen the map what a pit, a pipe, a water
 * path and the card that opens on a pit *look like*. A real render at that size
 * showed all four and made none of them readable.
 *
 * So the geometry is illustrative and says so — the badge under the hero has
 * said *illustrative prototype geometry* since before this file changed. What
 * is **not** illustrative is the palette: every colour here is imported from
 * `draw.ts` and `derived.ts` rather than retyped, so the figure cannot come to
 * show a green the map does not use, and the marks a person learns here are
 * the marks they meet when they press the button beside it.
 *
 * **The card is inside the SVG, not layered over it.** Drawn as HTML on top,
 * the card is positioned in percentages while the drawing scales with
 * `preserveAspectRatio`, and the two come apart at any width where those
 * disagree — the tail ends up pointing at empty ground. One coordinate system
 * means the card is attached to the pit the way a label is attached to a map,
 * which is what it is. The text is hand-broken for the same reason: SVG does
 * not wrap, and this is four lines of fixed copy rather than content.
 */
import { DERIVED_DAY } from './derived.js';
import { DAY } from './draw.js';
import {
  basis,
  brand,
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
import { font } from '../ui/theme.js';

/** Sage blocks between the streets. Not a layer — the ground the network sits in. */
const BLOCK = 'rgba(139, 163, 133, 0.20)';

export function FramedMap() {
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
      {/* The product's own chrome, so the card reads as the application. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space(2),
          padding: `${String(space(2))}px ${String(space(3))}px`,
          borderBottom: `1px solid ${line.hair}`,
          background: surface.raised,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" focusable="false">
          <circle cx="7" cy="7" r="4.6" fill="none" stroke={ink.subtle} strokeWidth="1.5" />
          <path d="m10.6 10.6 3.4 3.4" stroke={ink.subtle} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span style={{ font: type(text.small), color: ink.subtle }}>
          32 Altona Street, Kensington
        </span>
        <span
          style={{
            marginLeft: 'auto',
            padding: `2px ${String(space(2))}px`,
            borderRadius: radius.small,
            background: DAY.selected,
            color: surface.raised,
            font: type(text.micro, { weight: weight.semibold, leading: 1.6 }),
          }}
        >
          Drainage
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 260, display: 'flex' }}>
        <Illustration />
      </div>
    </div>
  );
}

/**
 * The drawing, at a fixed 660×430 with the frame cropping it.
 *
 * `slice` rather than `meet`: the figure fills whatever shape the hero gives
 * it and loses a little from the edges, which is what a map does. Everything
 * that has to stay visible — the three unselected pits, the selected one and
 * its card — is inside the middle, away from the crop.
 */
function Illustration() {
  return (
    <svg
      viewBox="0 0 660 430"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <rect width="660" height="430" fill={DAY.ground} />

      {/* The blocks first: streets are drawn over them, not between them. */}
      <g fill={BLOCK}>
        <rect x="26" y="52" width="150" height="86" rx="12" />
        <rect x="26" y="266" width="120" height="92" rx="12" />
        <rect x="486" y="286" width="152" height="96" rx="12" />
        <rect x="512" y="42" width="126" height="70" rx="12" />
        <rect x="236" y="330" width="112" height="80" rx="12" />
      </g>

      {/* Wide, soft-ended streets, running off every edge. */}
      <g
        stroke={DAY.road}
        strokeWidth="26"
        strokeLinecap="round"
        fill="none"
        opacity="0.96"
      >
        <path d="M-20 232 700 116" />
        <path d="M212 -20 268 450" />
        <path d="M-20 372 700 196" />
        <path d="M430 -20 700 300" />
      </g>

      {/* A likely surface-water path: dashed, exactly as the map draws it. */}
      <path
        d="M96 424q118 -78 246 -60t308 -22"
        fill="none"
        stroke={DERIVED_DAY.channel}
        strokeWidth="3.5"
        strokeDasharray="12 9"
        strokeLinecap="round"
      />

      {/* The recorded pipe running down to the selected pit. */}
      <path
        d="M258 6 372 214"
        fill="none"
        stroke={DAY.pipe}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Three pits the record holds, and the one the card is about. */}
      <Pit x="138" y="140" />
      <Pit x="232" y="250" />
      <Pit x="346" y="374" />
      <Pit x="372" y="222" selected />

      <Callout />
    </svg>
  );
}

function Pit({ x, y, selected = false }: { readonly x: string; readonly y: string; readonly selected?: boolean }) {
  const colour = selected ? DAY.selected : DAY.pit;
  return (
    <g>
      <circle cx={x} cy={y} r={selected ? 11 : 9} fill={DAY.pitEdge} />
      <circle
        cx={x}
        cy={y}
        r={selected ? 11 : 9}
        fill="none"
        stroke={colour}
        strokeWidth={selected ? 3.5 : 3}
      />
      <circle cx={x} cy={y} r={selected ? 4.5 : 3.5} fill={colour} />
    </g>
  );
}

/**
 * The card the map opens on a pit, drawn at the pit it belongs to.
 *
 * The words are the map's own: the badge is the *Official recorded data* the
 * pit layer carries everywhere else, and the sentence claims nothing about
 * depth, capacity or blockage — the three things `What the data doesn't show`
 * says the record does not hold.
 */
function Callout() {
  const x = 398;
  const y = 150;
  const w = 236;
  const h = 172;

  return (
    <g fontFamily={font.sans}>
      {/* The tail, meeting the selected pit at 372,222. */}
      <path d={`M${String(x)} 206 384 222 ${String(x)} 238Z`} fill={surface.raised} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="14"
        fill={surface.raised}
        stroke={line.base}
        strokeWidth="1"
      />

      {/* The grate glyph, in the pit layer's own colour. */}
      <circle cx={x + 32} cy={y + 32} r="17" fill={basis.recorded.fill} />
      <g stroke={DAY.pit} strokeWidth="1.6" strokeLinecap="round">
        <path d={`M${String(x + 24)} ${String(y + 26)}h16`} />
        <path d={`M${String(x + 24)} ${String(y + 32)}h16`} />
        <path d={`M${String(x + 24)} ${String(y + 38)}h16`} />
      </g>

      <text
        x={x + 60}
        y={y + 30}
        fontSize="16"
        fontWeight={weight.semibold}
        fill={ink.strong}
      >
        Drainage pit
      </text>

      <rect
        x={x + 60}
        y={y + 40}
        width="118"
        height="18"
        rx="9"
        fill={basis.recorded.fill}
      />
      <text x={x + 70} y={y + 53} fontSize="10.5" fontWeight={weight.medium} fill={basis.recorded.ink}>
        Official recorded data
      </text>

      <g fontSize="12.5" fill={ink.muted}>
        <text x={x + 20} y={y + 86}>This pit collects surface water from</text>
        <text x={x + 20} y={y + 104}>the street and connects it to the</text>
        <text x={x + 20} y={y + 122}>recorded drainage network.</text>
      </g>

      <path
        d={`M${String(x + 20)} ${String(y + 138)}h${String(w - 40)}`}
        stroke={line.hair}
        strokeWidth="1"
      />
      <text x={x + 20} y={y + 158} fontSize="12.5" fontWeight={weight.semibold} fill={brand.ink}>
        Show connected pipe →
      </text>
    </g>
  );
}
