/**
 * The design system's invariants.
 *
 * A token file looks like data and is easy to treat as untestable, but most of
 * what makes it work is a set of claims that can be checked: that a scale
 * ascends, that a spacing helper stays on its rhythm, and that the three
 * colours carrying provenance never drift into each other. The last one is the
 * only one a person would notice, and it is the one a well-meaning tidy-up is
 * most likely to break.
 */
import { describe, expect, it } from 'vitest';

import { basis, brand, ink, line, radius, space, surface, text, tracking, type, weight } from './theme.js';

const HEX = /^#[0-9a-f]{6}$/;

describe('the spacing rhythm', () => {
  it('is a multiple of four at every step', () => {
    for (let steps = 0; steps <= 12; steps += 1) {
      expect(space(steps) % 4).toBe(0);
    }
  });

  it('grows with its argument', () => {
    expect(space(1)).toBe(4);
    expect(space(6)).toBe(24);
    expect(space(3)).toBeLessThan(space(4));
  });
});

describe('the type scale', () => {
  it('ascends without a repeat', () => {
    const sizes = Object.values(text);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('starts at a size a person can still read', () => {
    // 11px is the smallest thing that ships — provenance chips and map
    // labels. Anything under it is decoration pretending to be information.
    expect(Math.min(...Object.values(text))).toBeGreaterThanOrEqual(11);
  });

  it('builds a font shorthand a browser accepts', () => {
    const shorthand = type(text.body, { weight: weight.semibold, leading: 1.4 });
    expect(shorthand).toBe(
      '600 15px/1.4 "Kensington Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    );
  });

  it('falls back to a regular weight and a comfortable leading', () => {
    expect(type(text.body)).toContain('400 15px/1.5');
  });

  it('names the shipped subset first and a system face after it', () => {
    // The subset is served from this origin; if it fails, the reader still
    // gets text. A stack with no fallback is how a font request becomes a
    // blank screen.
    const stack = type(text.body);
    expect(stack.indexOf('Kensington Sans')).toBeLessThan(stack.indexOf('system-ui'));
  });
});

describe('the palette', () => {
  it('is written as six-digit hex throughout', () => {
    // Mixed `#eee` and `#eeeeee` is how two greys that were meant to be one
    // stop looking like one another in a diff.
    const values = [
      ...Object.values(ink),
      ...Object.values(surface),
      ...Object.values(line),
      ...Object.values(brand),
    ];
    for (const value of values) expect(value).toMatch(HEX);
  });

  it('keeps the three provenance fills distinct', () => {
    // Recorded, derived and assumed are the product's whole argument. They
    // must never be mistaken for one another, which is a stronger requirement
    // than looking good together.
    const fills = Object.values(basis).map((b) => b.fill);
    expect(new Set(fills).size).toBe(fills.length);
    const inks = Object.values(basis).map((b) => b.ink);
    expect(new Set(inks).size).toBe(inks.length);
  });

  it('darkens the brand consistently from base to pressed', () => {
    const luminance = (hex: string): number => {
      const n = Number.parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
    };
    expect(luminance(brand.pressed)).toBeLessThan(luminance(brand.hover));
    expect(luminance(brand.hover)).toBeLessThan(luminance(brand.base));
    // And the tints go the other way, or a "wash" would be darker than a fill.
    expect(luminance(brand.wash)).toBeGreaterThan(luminance(brand.tint));
  });

  it('keeps body text far enough from the page to read', () => {
    // Not a full contrast-ratio implementation — a floor, so a future palette
    // change cannot quietly put grey text on a grey page.
    const channel = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const relative = (hex: string) => {
      const linear = [0, 1, 2].map((i) => {
        const c = channel(hex, i) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    };
    const ratio = (a: string, b: string) =>
      (Math.max(relative(a), relative(b)) + 0.05) / (Math.min(relative(a), relative(b)) + 0.05);

    expect(ratio(ink.base, surface.page)).toBeGreaterThanOrEqual(7);
    expect(ratio(ink.strong, surface.raised)).toBeGreaterThanOrEqual(7);
    // Subtle is for labels and captions, held to the large-text floor.
    expect(ratio(ink.subtle, surface.raised)).toBeGreaterThanOrEqual(3);
    expect(ratio(ink.inverse, brand.base)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('shape', () => {
  it('offers one radius per role and a pill that cannot be mistaken for one', () => {
    expect(radius.small).toBeLessThan(radius.base);
    expect(radius.base).toBeLessThan(radius.large);
    expect(radius.pill).toBeGreaterThan(radius.large * 10);
  });

  it('tracks large type tighter than small type', () => {
    const em = (value: string) => Number.parseFloat(value);
    expect(em(tracking.hero)).toBeLessThan(em(tracking.title));
    expect(em(tracking.title)).toBeLessThan(em(tracking.body));
    // Small capitals need the opposite treatment or they set jammed.
    expect(em(tracking.caps)).toBeGreaterThan(0);
  });
});
