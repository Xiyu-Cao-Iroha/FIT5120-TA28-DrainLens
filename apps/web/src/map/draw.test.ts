import { describe, expect, it } from 'vitest';

import {
  type LabelCandidate,
  boundsOfPath,
  labelAnchor,
  overlaps,
  placeLabels,
  PIN_DROP,
  PIN_HEAD_R,
  PIN_TOUCH_PAD_PX,
  pressedThePin,
} from './draw.js';
import type { Local } from './viewport.js';

const label = (
  text: string,
  x: number,
  y: number,
  { widthPx = 60, weight = 1, angle = 0 } = {},
): LabelCandidate => ({ text, x, y, angle, widthPx, weight });

describe('bounding a path', () => {
  it('spans every vertex', () => {
    const path: Local[] = [
      [10, 90],
      [50, 20],
      [30, 70],
    ];
    expect(boundsOfPath(path)).toEqual({ minE: 10, minN: 20, maxE: 50, maxN: 90 });
  });

  it('has nothing to bound when the path is empty', () => {
    expect(boundsOfPath([])).toBeNull();
  });
});

describe('overlap', () => {
  const a = { minE: 0, minN: 0, maxE: 10, maxN: 10 };

  it('is true when the boxes meet', () => {
    expect(overlaps(a, { minE: 5, minN: 5, maxE: 15, maxN: 15 })).toBe(true);
    expect(overlaps(a, { minE: 10, minN: 10, maxE: 20, maxN: 20 })).toBe(true);
  });

  it('is false when they do not', () => {
    // Inverting this comparison culls everything on screen and draws
    // everything off it, which looks exactly like a blank map.
    expect(overlaps(a, { minE: 11, minN: 0, maxE: 20, maxN: 10 })).toBe(false);
    expect(overlaps(a, { minE: 0, minN: 11, maxE: 10, maxN: 20 })).toBe(false);
  });
});

describe('anchoring a street label', () => {
  it('sits at the middle of the longest run', () => {
    const path: Local[] = [
      [0, 0],
      [10, 0],
      [110, 0],
    ];
    const anchor = labelAnchor(path);
    expect(anchor?.at).toEqual([60, 0]);
    expect(anchor?.runM).toBe(100);
  });

  it('follows the direction of the street', () => {
    const anchor = labelAnchor([
      [0, 0],
      [100, 100],
    ]);
    // North-east on the map is up and to the right, so the text rotates the
    // same way — and the drawing code negates it for the canvas.
    expect(anchor?.angle).toBeCloseTo(Math.PI / 4);
  });

  it('never reads upside down', () => {
    // A street name rotated past vertical is a street name nobody reads.
    for (const path of [
      [
        [100, 0],
        [0, 0],
      ],
      [
        [100, 100],
        [0, 0],
      ],
      [
        [0, 100],
        [100, 0],
      ],
    ] as Local[][]) {
      const anchor = labelAnchor(path);
      expect(Math.abs(anchor?.angle ?? 0)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    }
  });

  it('has no anchor without a segment', () => {
    expect(labelAnchor([])).toBeNull();
    expect(labelAnchor([[5, 5]])).toBeNull();
  });
});

describe('placing street labels', () => {
  it('names a street once however many segments it has', () => {
    // The source publishes a name per segment and Kensington's blocks are
    // short, so drawing them all writes the same name six times across four
    // centimetres of screen.
    const placed = placeLabels([
      label('Neale Street', 100, 100, { weight: 5 }),
      label('Neale Street', 300, 100, { weight: 40 }),
      label('Neale Street', 500, 100, { weight: 12 }),
    ]);
    expect(placed).toHaveLength(1);
    expect(placed[0]?.x).toBe(300);
  });

  it('keeps the longest run of a street, where there is room for the name', () => {
    const placed = placeLabels([
      label('Gatehouse Drive', 10, 10, { weight: 3 }),
      label('Gatehouse Drive', 400, 400, { weight: 300 }),
    ]);
    expect(placed[0]?.weight).toBe(300);
  });

  it('drops a label that would sit on top of another', () => {
    // Half-hidden text is a street the person cannot identify, on a map whose
    // job is telling them where water goes near their own address.
    const placed = placeLabels([
      label('Neale Street', 100, 100, { weight: 200 }),
      label('Kirk Street', 110, 102, { weight: 50 }),
    ]);
    expect(placed.map((l) => l.text)).toEqual(['Neale Street']);
  });

  it('keeps both when they clear each other', () => {
    const placed = placeLabels([
      label('Neale Street', 100, 100, { weight: 200 }),
      label('Kirk Street', 400, 300, { weight: 50 }),
    ]);
    expect(placed.map((l) => l.text).sort()).toEqual(['Kirk Street', 'Neale Street']);
  });

  it('gives the space to the street with the most of it', () => {
    const placed = placeLabels([
      label('Short Lane', 100, 100, { weight: 10 }),
      label('Long Road', 105, 100, { weight: 500 }),
    ]);
    expect(placed.map((l) => l.text)).toEqual(['Long Road']);
  });

  it('measures collision by the width of the text, not a fixed box', () => {
    const wide = placeLabels([
      label('A very long street name indeed', 100, 100, { widthPx: 220, weight: 9 }),
      label('Kirk Street', 200, 100, { widthPx: 60, weight: 5 }),
    ]);
    expect(wide).toHaveLength(1);

    const narrow = placeLabels([
      label('Ann St', 100, 100, { widthPx: 30, weight: 9 }),
      label('Kirk Street', 200, 100, { widthPx: 60, weight: 5 }),
    ]);
    expect(narrow).toHaveLength(2);
  });

  it('places nothing when there is nothing to place', () => {
    expect(placeLabels([])).toEqual([]);
  });
});

/**
 * The pin's target, which is not the pin's drawing.
 *
 * A teammate reported the address pin as not clickable, and it was not: the
 * hit test knew about pits and pipes, and the pin is neither — it is the
 * person's own location, drawn from no artefact. These check the target is
 * where the mark is, because the failure that pairs them wrongly is a pin
 * somebody can see and cannot press, which reads as the application ignoring
 * them.
 */
describe('pressing the address pin', () => {
  const tip: readonly [number, number] = [200, 300];

  it('counts a press on the tip, which is the point it marks', () => {
    expect(pressedThePin([200, 300], tip)).toBe(true);
  });

  it('counts a press on the head, which is where the eye goes', () => {
    // The head's centre is PIN_DROP above the tip. It is the biggest part of
    // the shape and the part somebody aims at.
    expect(pressedThePin([200, 300 - PIN_DROP], tip)).toBe(true);
  });

  it('counts a press just outside the shape, because a pin is smaller than a finger', () => {
    expect(pressedThePin([200 + PIN_HEAD_R + PIN_TOUCH_PAD_PX - 1, 300 - PIN_DROP], tip)).toBe(true);
  });

  it('does not reach the ground beside it', () => {
    expect(pressedThePin([200 + PIN_HEAD_R + PIN_TOUCH_PAD_PX + 2, 300 - PIN_DROP], tip)).toBe(false);
  });

  it('does not reach below the tip, where the map continues', () => {
    // Everything under the tip is the street the pin is standing on. A target
    // that reached down there would take presses from the pits drawn on it.
    expect(pressedThePin([200, 300 + PIN_TOUCH_PAD_PX + 2], tip)).toBe(false);
  });

  it('does not reach above the head', () => {
    expect(
      pressedThePin([200, 300 - PIN_DROP - PIN_HEAD_R - PIN_TOUCH_PAD_PX - 2], tip),
    ).toBe(false);
  });

  it('follows the pin when the pin moves', () => {
    // The target is built from the same constants as the drawing, so this is
    // the property that keeps them from drifting apart.
    expect(pressedThePin([200, 300 - PIN_DROP], [500, 700])).toBe(false);
    expect(pressedThePin([500, 700 - PIN_DROP], [500, 700])).toBe(true);
  });
});
