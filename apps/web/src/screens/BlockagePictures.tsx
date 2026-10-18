/**
 * The ⓘ beside the drain condition, and what it opens.
 *
 * Team request, 4 October: show what 0, 50 and 100 look like. The copy and the
 * reasoning are in `scenario/blockagePicture.ts`; this draws them.
 *
 * Each grate is the same drawing with more of it covered, because the thing
 * being compared is how much of one grate is open. Three different drains
 * would invite reading the difference off the drain rather than off the cover.
 */


import {
  BLOCKAGE_PICTURES,
  type BlockagePicture,
  NOT_THIS_DRAIN,
  SEE_WHAT_IT_LOOKS_LIKE,
  takesLine,
} from '../scenario/blockagePicture.js';
import { brand, ink, line, radius, space, surface, text, type, weight } from '../ui/theme.js';

/**
 * The circled i, beside the question it is about, and its panel, which is
 * **not** beside it.
 *
 * They were one component and it rendered both, which put the panel inside
 * the `<legend>` the ⓘ sits in. A `<legend>` takes phrasing content; a
 * `<div>` holding a grid of drawings is flow content, and the fieldset's
 * box is the one place in CSS where the browser reserves room for a child
 * it lays out specially. A 475 px disclosure in there makes the fieldset's
 * height depend on that reserved box, which is the shape of the blank
 * space the team reported on 12 October after opening the ⓘ and closing
 * it again.
 *
 * So the button stays in the legend, where it belongs and where it is
 * valid, and the panel is rendered by the caller as the fieldset's first
 * child. It lands in the same place on screen: directly under the question
 * and above the three options, which is where it was.
 */
export function BlockageInfoButton({
  open,
  panelId,
  onToggle,
}: {
  readonly open: boolean;
  /** The panel this controls, which the caller renders. */
  readonly panelId: string;
  readonly onToggle: () => void;
}) {
  return (
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        title={SEE_WHAT_IT_LOOKS_LIKE}
        style={{
          width: 20,
          height: 20,
          marginLeft: space(1),
          borderRadius: '50%',
          border: `1px solid ${brand.tint}`,
          background: brand.wash,
          color: brand.ink,
          font: type(text.micro, { weight: weight.semibold }),
          cursor: 'pointer',
          verticalAlign: 'middle',
        }}
      >
        i
      </button>
  );
}

/** What it opens: the three settings, drawn. */
export function BlockagePictures({ id }: { readonly id: string }) {
  return (
        <div
          id={id}
          style={{
            marginTop: space(3),
            padding: space(3),
            borderRadius: radius.base,
            border: `1px solid ${line.base}`,
            background: surface.raised,
          }}
        >
          <p
            style={{
              margin: `0 0 ${String(space(3))}px`,
              font: type(text.small, { weight: weight.semibold }),
              color: ink.strong,
            }}
          >
            {SEE_WHAT_IT_LOOKS_LIKE}
          </p>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'grid',
              gap: space(3),
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            }}
          >
            {BLOCKAGE_PICTURES.map((picture) => (
              <li key={picture.setting}>
                <Grate picture={picture} />
                <span
                  style={{
                    display: 'block',
                    marginTop: space(1),
                    font: type(text.small, { weight: weight.semibold }),
                    color: ink.strong,
                  }}
                >
                  {picture.title}
                </span>
                <span style={{ display: 'block', font: type(text.micro), color: brand.ink }}>
                  {takesLine(picture)}
                </span>
                <span
                  style={{ display: 'block', font: type(text.micro, { leading: 1.45 }), color: ink.muted }}
                >
                  {picture.looksLike}
                </span>
                <span
                  style={{ display: 'block', font: type(text.micro, { leading: 1.45 }), color: ink.subtle }}
                >
                  {picture.modelDoes}
                </span>
              </li>
            ))}
          </ul>
          <p
            style={{
              margin: `${String(space(3))}px 0 0`,
              font: type(text.micro, { leading: 1.45 }),
              color: ink.subtle,
            }}
          >
            {NOT_THIS_DRAIN}
          </p>
        </div>
  );
}

/**
 * One grate, with as much of it covered as the setting says.
 *
 * The cover is drawn over the bars rather than instead of them, so the same
 * grate is visible in all three and the difference is what is on it.
 */
function Grate({ picture }: { readonly picture: BlockagePicture }) {
  const covered = 1 - picture.takesPercent / 100;

  return (
    <svg
      viewBox="0 0 120 80"
      width="100%"
      height="80"
      role="img"
      aria-label={`${picture.title}: ${picture.looksLike}`}
      style={{ display: 'block', borderRadius: radius.small, background: '#eef1ef' }}
    >
      {/* The kerb and the road, so the grate is somewhere rather than floating. */}
      <rect x="0" y="54" width="120" height="26" fill="#e3e8e4" />
      <rect x="0" y="50" width="120" height="5" fill="#cfd6d1" />
      {/* The frame. */}
      <rect x="22" y="18" width="76" height="34" rx="3" fill="#b9c2bc" />
      <rect x="26" y="22" width="68" height="26" rx="2" fill="#5d6a63" />
      {/* The bars. */}
      {[0, 1, 2, 3, 4].map((bar) => (
        <rect
          key={bar}
          x={30 + bar * 13}
          y="24"
          width="7"
          height="22"
          rx="1.5"
          fill="#b9c2bc"
        />
      ))}
      {/* What is on it. Half the width for half the intake, all of it for none. */}
      {covered > 0 && (
        <rect
          x="26"
          y="22"
          width={68 * covered}
          height="26"
          rx="2"
          fill="#7a6a3f"
          opacity="0.92"
        />
      )}
      {covered > 0 && (
        <path
          d={`M28 ${covered === 1 ? 26 : 28} q10 -8 20 0 q10 -8 20 0`}
          fill="none"
          stroke="#564a2c"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
      )}
      {/* Water standing on a covered grate. */}
      {covered === 1 && <rect x="22" y="14" width="76" height="6" rx="3" fill="#6f8fb0" opacity="0.75" />}
    </svg>
  );
}
