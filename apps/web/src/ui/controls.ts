/**
 * The shape a control has, so that a control looks like one.
 *
 * **Reported on 9 October: *every button must look like a button*.** The map
 * and its cards had grown a second kind of control — a word with an underline
 * and nothing else — and it was being used for things that are not links at
 * all: *Close*, *Back to my plan*, *Next place*, *Reset my answers*, *Cancel*.
 * An underline is the browser's promise that something will be fetched. These
 * change what is on the screen, so they are drawn as what they are.
 *
 * **The guidance home page is excepted, by the same reasoning.** Its cards end
 * in *Choose a guide →* and *Open the flood history →*, which do go somewhere,
 * and a page of buttons would read as a form.
 *
 * Two weights, and no third:
 *
 * | | For |
 * |---|---|
 * | `quietButton` | the ordinary case: an outline, a surface, and room to press |
 * | `plainButton` | inside a card that is already outlined, where a second border is a box in a box |
 *
 * Anything that must stand out is the filled button the card already has;
 * these are the ones beside it.
 */

import { brand, ink, line, radius, space, surface, text, type, weight } from './theme.js';

/** An outlined control: the default shape for anything that is not a link. */
export const quietButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: space(1),
  padding: `${String(space(1))}px ${String(space(3))}px`,
  border: `1px solid ${line.base}`,
  borderRadius: radius.base,
  background: surface.raised,
  color: ink.strong,
  font: type(text.small, { weight: weight.semibold, leading: 1.4 }),
  whiteSpace: 'nowrap',
  cursor: 'pointer',
} as const;

/** The same control in the project's green, where it is the way on. */
export const quietBrandButton = {
  ...quietButton,
  borderColor: brand.tint,
  background: brand.wash,
  color: brand.ink,
} as const;

/**
 * No border, for a control inside something already outlined.
 *
 * Still not an underline: it keeps the padding and the weight, so it reads as
 * something to press rather than as a word in a sentence.
 */
export const plainButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: space(1),
  padding: `${String(space(1))}px ${String(space(2))}px`,
  border: 'none',
  borderRadius: radius.small,
  background: 'none',
  color: brand.ink,
  font: type(text.small, { weight: weight.semibold, leading: 1.4 }),
  cursor: 'pointer',
} as const;
