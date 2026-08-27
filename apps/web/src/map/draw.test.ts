import { describe, expect, it } from 'vitest';

import {
  type LabelCandidate,
  boundsOfPath,
  labelAnchor,
  overlaps,
  placeLabels,
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
