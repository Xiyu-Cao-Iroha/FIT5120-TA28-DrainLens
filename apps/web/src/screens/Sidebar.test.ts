/**
 * How wide the sidebar is allowed to be, and when there is no room at all.
 *
 * The number matters outside the panel: the canvas is drawn narrower by
 * exactly this much and the zoom controls are moved by it, so a width that
 * disagreed with either would leave the map under the panel or the controls
 * floating over it.
 */

import { describe, expect, it } from 'vitest';

import { SIDEBAR_NARROW, SIDEBAR_WIDTH, sidebarWidth } from './Sidebar.js';

describe('sidebarWidth', () => {
  it('gives the full width where the map can spare it', () => {
    expect(sidebarWidth(1508)).toBe(SIDEBAR_WIDTH);
    expect(sidebarWidth(900)).toBe(SIDEBAR_WIDTH);
  });

  it('narrows before it gives up', () => {
    expect(sidebarWidth(899)).toBe(SIDEBAR_NARROW);
    expect(sidebarWidth(620)).toBe(SIDEBAR_NARROW);
  });

  it('is zero where a sidebar would leave no map', () => {
    expect(sidebarWidth(619)).toBe(0);
    expect(sidebarWidth(375)).toBe(0);
  });

  it('always leaves more map than panel', () => {
    for (const mapWidth of [620, 760, 899, 900, 1100, 1508, 2560]) {
      const panel = sidebarWidth(mapWidth);
      expect(mapWidth - panel, `at ${String(mapWidth)}`).toBeGreaterThan(panel);
    }
  });
});
