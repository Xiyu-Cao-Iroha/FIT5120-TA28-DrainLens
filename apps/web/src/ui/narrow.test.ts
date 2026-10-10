import { describe, expect, it } from 'vitest';

import { NARROW_FRAME_PX } from '../map/fitBounds.js';
import { NARROW_PX, NARROW_QUERY, isNarrow, narrowNow } from './narrow.js';

describe('the phone breakpoint', () => {
  it('is the one the map already had, not a second one', () => {
    // 560 is `fitBounds`'s NARROW_FRAME_PX, the width below which the map
    // stops reserving room for a panel beside it. Two breakpoints a hundred
    // pixels apart would be two rules nobody can hold in their head.
    expect(NARROW_PX).toBe(NARROW_FRAME_PX);
    expect(NARROW_PX).toBe(560);
  });

  it('spells the query the way base.css does, from the same number', () => {
    // `base.css` writes `@media (max-width: 560px)`. If one of the two is
    // ever changed by hand, this fails rather than leaving a layout that is
    // a phone to the stylesheet and a desktop to the components.
    expect(NARROW_QUERY).toBe('(max-width: 560px)');
  });

  it('counts the breakpoint itself as narrow, because max-width does', () => {
    // A boundary that belongs to the phone in CSS and to the desktop here
    // is a disagreement that shows up on one device and is never reproduced.
    expect(isNarrow(560)).toBe(true);
    expect(isNarrow(561)).toBe(false);
  });

  it('calls a phone a phone and a laptop a laptop', () => {
    expect(isNarrow(375)).toBe(true); // iPhone SE, 9:16, the target
    expect(isNarrow(390)).toBe(true); // iPhone 14
    expect(isNarrow(768)).toBe(false); // tablet
    expect(isNarrow(1280)).toBe(false);
  });
});

describe('reading the window', () => {
  it('reads the width it is given', () => {
    expect(narrowNow({ innerWidth: 375 })).toBe(true);
    expect(narrowNow({ innerWidth: 1280 })).toBe(false);
  });

  it('says no rather than throwing where there is no window', () => {
    // Server rendering, and the unit suite, which runs in node. A component
    // asking this at mount must get an answer, and the wide layout is the
    // one that degrades gracefully: everything is reachable, just roomier.
    expect(narrowNow(undefined)).toBe(false);
  });
});
