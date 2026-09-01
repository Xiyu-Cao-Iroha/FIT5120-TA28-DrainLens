/**
 * The one place a colour, a size or a spacing is decided.
 *
 * Before this file the interface held **62 distinct colour values across 217
 * inline literals** — nine near-identical greys at inconsistent hues, four
 * greens a shade apart, and borders that were `#e6ebe4` in one component and
 * `#eee` in the next. None of it was wrong on its own. Together it was the
 * reason the product looked assembled rather than designed: nothing lined up
 * because nothing was measured against anything.
 *
 * **What is not decided here.** The map's own palette lives in `map/draw.ts`
 * and the difference layer's in `map/difference.ts`, because those colours
 * carry meaning — a pit, a suggestion, a selection, a place where two runs
 * disagree — and were chosen against the terrain they sit on and measured
 * afterwards. Moving them here would invite a future tidy-up to harmonise a
 * palette whose whole job is to stay distinguishable.
 */

/**
 * Neutrals: one hue, one ramp.
 *
 * A cool slate rather than pure grey, because everything it frames is a map
 * of ground and water and a neutral with no temperature reads as dirty beside
 * it. Each step is a decision about *rank*, so they are named for the job
 * rather than the value — `ink.subtle` will still mean "third-level text"
 * after somebody changes what it is.
 */
export const ink = {
  /** Headings and anything that must be read first. */
  strong: '#17242e',
  /** Body copy. */
  base: '#33475a',
  /** Secondary text: descriptions, helper lines, the sentence under a field. */
  muted: '#5b6e7e',
  /** Labels, captions, units — present, deliberately quiet. */
  subtle: '#7d8f9d',
  /** On a dark or brand-filled surface. */
  inverse: '#ffffff',
} as const;

export const surface = {
  /** Cards, panels, the header. */
  raised: '#ffffff',
  /** The page behind them. */
  page: '#f5f8f7',
  /** A block that needs to sit back from the card it is in. */
  sunken: '#eef4f2',
} as const;

export const line = {
  /** A real edge: card borders, the header rule. */
  base: '#dbe4e4',
  /** A separator inside a component, where a full border would be loud. */
  hair: '#e9efee',
  /** The edge of something focused or hovered. */
  strong: '#c3d1cf',
} as const;

/**
 * The brand green, kept.
 *
 * `#1f6f5c` was already the most-used colour in the interface and it was a
 * good choice: desaturated enough to sit under a map without competing, warm
 * enough not to read as a system dialog. What it lacked was a family — hover
 * and pressed states were being invented per component.
 */
export const brand = {
  base: '#1f6f5c',
  hover: '#1a5d4d',
  pressed: '#14493d',
  /** A filled tint: the pilot badge, a highlighted block. */
  tint: '#dcece6',
  /** The quietest fill that still reads as brand rather than as grey. */
  wash: '#eef6f3',
  /** Text or an icon in brand colour on a light surface. */
  ink: '#1a5d4d',
} as const;

/**
 * The advisory band that never scrolls away.
 *
 * Warm and low-contrast on purpose. It has to be permanent, and a permanent
 * warning drawn at alarm strength stops being read within a minute — which
 * would defeat the one line on screen that must survive being skimmed.
 */
export const advisory = {
  fill: '#fdf8ea',
  line: '#eadfc0',
  ink: '#6b5a2b',
} as const;

/** A genuine problem with what the person just did, not a standing caution. */
export const alert = {
  fill: '#fff5f2',
  line: '#f2d6cf',
  ink: '#8a4b3d',
} as const;

/**
 * Provenance, which is the product's whole argument.
 *
 * Recorded, derived and assumed must never be mistaken for one another, so
 * these three are the one place in the interface where distinctness matters
 * more than harmony. `outcome.test.ts` asserts their backgrounds are unequal.
 */
export const basis = {
  recorded: { fill: '#e7f0e6', ink: '#33562f' },
  derived: { fill: '#e4eef5', ink: '#2f4f66' },
  assumed: { fill: '#f6ecdd', ink: '#6b5028' },
} as const;

/**
 * A modular type scale, and the reason there is one.
 *
 * Sizes were previously picked per component: 22 here, 21 there, 13 in one
 * label and 12 in the next with no difference intended. A scale means two
 * things at the same rank *look* the same rank, which is most of what makes
 * a dense interface feel deliberate.
 */
export const text = {
  /** Units, provenance chips, map labels. The smallest thing that ships. */
  micro: 11,
  /** Captions, helper text, the footer. */
  small: 12.5,
  /** Labels and dense UI. */
  label: 13.5,
  /** Body copy. */
  body: 15,
  /** A lead paragraph or a card title. */
  lead: 17,
  /** Section headings. */
  title: 21,
  /** The one heading on a screen that names it. */
  display: 30,
  /** The landing page, and nowhere else. */
  hero: 42,
} as const;

/** Weights, on the variable axis this site ships. */
export const weight = {
  regular: 400,
  medium: 520,
  semibold: 600,
  bold: 680,
} as const;

/**
 * Letter-spacing, which is what actually separates set type from typed type.
 *
 * Large sizes need it negative or they read loose; small capitals need it
 * positive or they read jammed. Both are proportional to size, so they are
 * expressed in em.
 */
export const tracking = {
  hero: '-0.022em',
  display: '-0.018em',
  title: '-0.011em',
  body: '0',
  caps: '0.075em',
} as const;

/** A 4px rhythm. Every margin and padding in the interface is a multiple. */
export const space = (steps: number): number => steps * 4;

export const radius = {
  small: 6,
  base: 10,
  large: 14,
  pill: 999,
} as const;

/**
 * Elevation, used sparingly.
 *
 * Two layers of shadow rather than one: a tight dark line that reads as a
 * contact edge, and a wide soft one that reads as distance. A single blur at
 * one opacity is what makes a floating panel look pasted on, which is exactly
 * how the map's panel looked.
 */
export const shadow = {
  /** A card resting on the page. */
  resting: '0 1px 2px rgba(23, 36, 46, 0.06), 0 1px 8px rgba(23, 36, 46, 0.04)',
  /** A panel floating over the map. */
  floating: '0 1px 3px rgba(23, 36, 46, 0.10), 0 8px 28px rgba(23, 36, 46, 0.10)',
  /** Something the person is actively holding open. */
  lifted: '0 2px 6px rgba(23, 36, 46, 0.12), 0 18px 44px rgba(23, 36, 46, 0.14)',
} as const;

/**
 * The font stack.
 *
 * `Kensington Sans` is a 17.6 KB subset of Source Sans 3, served from this
 * origin — see `public/fonts/README.md` for why it is not loaded from a CDN
 * and why it does not carry the name "Source". The fallbacks are the reader's
 * own system faces, so a failed font request costs the design and never the
 * content.
 */
export const font = {
  sans: '"Kensington Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  /** Asset numbers, coordinates, anything meant to be compared down a column. */
  numeric: '"Kensington Sans", system-ui, sans-serif',
} as const;

/** `font` shorthand, so a component sets size, weight and leading in one place. */
export const type = (
  size: number,
  options: { weight?: number; leading?: number } = {},
): string => `${String(options.weight ?? weight.regular)} ${String(size)}px/${String(options.leading ?? 1.5)} ${font.sans}`;
