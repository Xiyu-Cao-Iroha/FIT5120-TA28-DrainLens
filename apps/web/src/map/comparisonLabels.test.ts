import { describe, expect, it } from 'vitest';

import {
  type Box,
  COACH_HEIGHT_PX,
  COACH_WIDTH_PX,
  DISTANCE_LABEL_PX,
  type Point,
  SELECTED_LABEL_HEIGHT_PX,
  SELECTED_LABEL_PX,
  SHORT_CONNECTOR_PX,
  coachBox,
  distanceBox,
  nameBox,
  placeSelectedLabel,
  placeStepOneLabels,
  reasonOnScreen,
} from './comparisonLabels.js';
import { COMPARISON_MARK_R, PIN_DROP, PIN_HEAD_R, SUGGESTED_HALO_R } from './draw.js';

const overlaps = (x: number, y: number, box: readonly [number, number], w: number, h: number) =>
  x >= box[0] && x <= box[0] + w && y >= box[1] && y <= box[1] + h;

/*
 * The marks as drawn, measured independently of the boxes the placement uses:
 * the ripple as a circle, and the pin from its tip to the top of its head.
 */
const coversCircle = (box: Box, centre: Point, radius: number): boolean => {
  const nearestX = Math.max(box.left, Math.min(centre[0], box.right));
  const nearestY = Math.max(box.top, Math.min(centre[1], box.bottom));
  return Math.hypot(centre[0] - nearestX, centre[1] - nearestY) < radius;
};
const coversPin = (box: Box, address: Point): boolean =>
  box.left < address[0] + PIN_HEAD_R &&
  box.right > address[0] - PIN_HEAD_R &&
  box.top < address[1] &&
  box.bottom > address[1] - PIN_DROP - PIN_HEAD_R;
const onCanvas = (box: Box, width: number, height: number) =>
  box.left >= 7.5 && box.top >= 7.5 && box.right <= width - 7.5 && box.bottom <= height - 7.5;

const boxesMeet = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** About as wide as "46 Gatehouse Drive, Kensington" sets, with room over. */
const NAME_PX = 210;

/** Everything step 1 must keep clear, for one placement. */
function clashes(address: Point, drain: Point, width: number, height: number): string[] {
  const placed = placeStepOneLabels(address, drain, width, height, NAME_PX);
  const coach = coachBox(placed.coach);
  const distance = distanceBox(placed.distance);
  const name = nameBox(placed.address, NAME_PX);
  const found: string[] = [];
  for (const [label, box] of [
    ['coach', coach],
    ['distance', distance],
  ] as const) {
    if (coversCircle(box, drain, SUGGESTED_HALO_R)) found.push(`${label} covers the drain`);
    if (coversPin(box, address)) found.push(`${label} covers the pin`);
    if (boxesMeet(box, name)) found.push(`${label} covers the address name`);
    if (!onCanvas(box, width, height)) found.push(`${label} leaves the canvas`);
  }
  if (
    coach.left < distance.right &&
    coach.right > distance.left &&
    coach.top < distance.bottom &&
    coach.bottom > distance.top
  ) {
    found.push('coach and distance overlap');
  }
  return found;
}

describe('step 1’s labels around a close address and drain', () => {
  it('puts the coach mark and the address name on opposite sides', () => {
    // The demonstration address: the drain up and to the right, sixty pixels away.
    const placed = placeStepOneLabels([700, 450], [740, 405], 1280, 680);
    expect(placed.coach[0]).toBeGreaterThan(740);
    expect(placed.address.alignRight).toBe(true);
    expect(placed.address.at[0]).toBeLessThan(700);
  });

  it('moves the distance beside the pin when the connector is too short to carry it', () => {
    const placed = placeStepOneLabels([700, 450], [740, 405], 1280, 680);
    // Right-aligned: it ends beside the pin and runs away from the coach mark.
    expect(placed.distance).toEqual({ at: [712, 466], align: 'right' });
  });

  it('keeps the distance on the connector when there is room', () => {
    const placed = placeStepOneLabels([300, 500], [700, 500], 1280, 680);
    expect(placed.distance).toEqual({ at: [500, 500], align: 'centre' });
    expect(SHORT_CONNECTOR_PX).toBeLessThan(400);
  });

  it('takes the distance off a connector too short for it, rather than cover either end', () => {
    // Long enough to be "long", too short for 270 pixels of writing between
    // a pin and a ripple on one row.
    const address: Point = [400, 500];
    const drain: Point = [400 + SHORT_CONNECTOR_PX, 500];
    expect(placeStepOneLabels(address, drain, 1280, 680).distance.align).not.toBe('centre');
    expect(clashes(address, drain, 1280, 680)).toEqual([]);
  });

  it('mirrors everything when the drain is to the left', () => {
    const placed = placeStepOneLabels([700, 450], [640, 420], 1280, 680);
    expect(placed.coach[0] + COACH_WIDTH_PX).toBeLessThan(640);
    expect(placed.address.alignRight).toBe(false);
    expect(placed.address.at[0]).toBeGreaterThan(700);
  });

  it('moves the coach mark rather than let it leave the canvas or cover the pin', () => {
    // At the right edge, with the pin level with the drain on its left: the
    // left side would sit on the pin, so it goes above.
    const right = placeStepOneLabels([1100, 450], [1200, 450], 1280, 680);
    expect(right.coach[1] + COACH_HEIGHT_PX).toBeLessThanOrEqual(450 - SUGGESTED_HALO_R);
    expect(clashes([1100, 450], [1200, 450], 1280, 680)).toEqual([]);
    expect(clashes([100, 450], [40, 450], 1280, 680)).toEqual([]);
    // With the pin out of the way, the other side is still the first choice.
    const flipped = placeStepOneLabels([1100, 300], [1200, 450], 1280, 680);
    expect(flipped.coach[0] + COACH_WIDTH_PX).toBeLessThanOrEqual(1200 - SUGGESTED_HALO_R);
  });
});

describe('a drain about 10 m from the address', () => {
  /*
   * The user test of 15 September at 200 Bourke Street. At the fitted zoom,
   * about three pixels a metre, 10 m is thirty pixels: the distance label
   * hung from beside the pin straight across the drain's icon, and the coach
   * mark, thirty pixels from the drain's centre, sat on its ripple.
   */
  const address: Point = [700, 300];

  it('reproduces the old placement’s fault, so the test below means something', () => {
    // Thirty pixels from the centre is inside a ripple of radius 31.2.
    expect(SUGGESTED_HALO_R).toBeGreaterThan(30);
    // The old distance label: right-aligned 12 px right of the pin, 16 px down,
    // 250 wide — across a drain 30 px away down and to the right.
    const old: Box = { left: 712 - 250, top: 316, right: 712, bottom: 342 };
    expect(coversCircle(old, [721, 321], COMPARISON_MARK_R)).toBe(true);
  });

  it('keeps both labels off the drain’s ripple and the pin in every direction', () => {
    for (let degrees = 0; degrees < 360; degrees += 15) {
      const radians = (degrees * Math.PI) / 180;
      const drain: Point = [address[0] + 30 * Math.cos(radians), address[1] + 30 * Math.sin(radians)];
      expect(clashes(address, drain, 1280, 603), `drain at ${String(degrees)}°`).toEqual([]);
    }
  });

  it('still does when the two are under 15 m apart, down to the same point', () => {
    for (const px of [0, 3, 9, 15, 24, 45]) {
      for (let degrees = 0; degrees < 360; degrees += 45) {
        const radians = (degrees * Math.PI) / 180;
        const drain: Point = [address[0] + px * Math.cos(radians), address[1] + px * Math.sin(radians)];
        expect(clashes(address, drain, 1280, 603), `${String(px)} px at ${String(degrees)}°`).toEqual([]);
      }
    }
  });
});

describe('across the fitted step-1 view', () => {
  /*
   * Every place the fit can put an address on a laptop map (clear of the
   * 320-pixel panel strip on the left and 80 pixels on the other sides), with
   * the drain anywhere from on top of it to beyond the short-connector limit.
   * Not a sample: the whole range, on a grid.
   */
  it('never covers the drain, the pin or each other, and never leaves the canvas', () => {
    const [width, height] = [1280, 603];
    const failures: string[] = [];
    let checked = 0;
    for (let x = 320; x <= width - 80; x += 40) {
      for (let y = 80; y <= height - 80; y += 40) {
        for (const px of [0, 10, 30, 60, 120, 200, 320]) {
          for (let degrees = 0; degrees < 360; degrees += 30) {
            const radians = (degrees * Math.PI) / 180;
            const drain: Point = [x + px * Math.cos(radians), y + px * Math.sin(radians)];
            if (drain[0] < 320 || drain[0] > width - 80 || drain[1] < 80 || drain[1] > height - 80) continue;
            checked += 1;
            const found = clashes([x, y], drain, width, height);
            if (found.length > 0) failures.push(`${String(x)},${String(y)} → ${String(px)} px @${String(degrees)}°: ${found.join('; ')}`);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5_000);
    expect(failures.length, failures.slice(0, 12).join('\n')).toBe(0);
  });
});

describe('on a phone, where neither side of the drain has room', () => {
  it('puts the coach mark above the drain, away from an address below it, and never over the drain', () => {
    const drain = [190, 260] as const;
    const placed = placeStepOneLabels([170, 300], drain, 375, 470);
    expect(placed.coach[1] + COACH_HEIGHT_PX).toBeLessThan(drain[1]);
    expect(overlaps(drain[0], drain[1], placed.coach, COACH_WIDTH_PX, COACH_HEIGHT_PX)).toBe(false);
    expect(placed.coach[0]).toBeGreaterThanOrEqual(8);
    expect(placed.coach[0] + COACH_WIDTH_PX).toBeLessThanOrEqual(375 - 8);
    expect(coversCircle(coachBox(placed.coach), drain, SUGGESTED_HALO_R)).toBe(false);
  });

  it('puts it below when the address is above the drain, or when above would leave the canvas', () => {
    const drain = [190, 200] as const;
    expect(placeStepOneLabels([170, 150], drain, 375, 470).coach[1]).toBeGreaterThan(drain[1]);
    expect(placeStepOneLabels([170, 90], [190, 60], 375, 470).coach[1]).toBeGreaterThan(60);
    // Below would run off the bottom, so above after all.
    expect(placeStepOneLabels([170, 380], [190, 430], 375, 470).coach[1] + COACH_HEIGHT_PX).toBeLessThan(430);
    // Neither fits: pinned to the top edge rather than past it.
    expect(placeStepOneLabels([170, 50], [190, 100], 375, 150).coach[1]).toBe(8);
  });

  it('keeps the distance label on the canvas at either edge, and off the drain', () => {
    const nearLeft = placeStepOneLabels([100, 300], [130, 280], 375, 470);
    expect(nearLeft.distance.at[0]).toBe(8);
    expect(nearLeft.distance.align).toBe('left');
    expect(coversCircle(distanceBox(nearLeft.distance), [130, 280], SUGGESTED_HALO_R)).toBe(false);
    const nearRight = placeStepOneLabels([300, 300], [270, 280], 375, 470);
    expect(nearRight.distance.at[0]).toBe(367);
    expect(nearRight.distance.align).toBe('right');
    expect(coversCircle(distanceBox(nearRight.distance), [270, 280], SUGGESTED_HALO_R)).toBe(false);
    expect(DISTANCE_LABEL_PX).toBeGreaterThan(250);
  });
});

describe('the reason on a grey pit', () => {
  const pit = { id: 'grey' };
  const hovered = { pit, reason: 'Can’t be tested: not recorded as a surface inlet', step: 'drain' };

  it('is shown on the step it was raised on', () => {
    expect(reasonOnScreen(hovered, null, 'drain')).toBe(hovered);
    expect(reasonOnScreen(null, hovered, 'drain')).toBe(hovered);
  });

  it('never survives onto another step, the result included', () => {
    // The user test: raised on step 1, still on screen at step 2, step 3 and
    // the result, over the Selected drain label.
    for (const step of ['scenario', 'review', 'result']) {
      expect(reasonOnScreen(hovered, hovered, step)).toBeNull();
    }
  });

  it('prefers what is under the pointer to an older press', () => {
    const pressed = { ...hovered, pit: { id: 'other' } };
    expect(reasonOnScreen(hovered, pressed, 'drain')).toBe(hovered);
    expect(reasonOnScreen({ ...hovered, step: 'drain' }, { ...pressed, step: 'scenario' }, 'scenario')?.pit).toEqual({
      id: 'other',
    });
  });
});

describe('the Selected drain label on steps 2 and 3', () => {
  const W = SELECTED_LABEL_PX;
  const H = SELECTED_LABEL_HEIGHT_PX;
  const clear = (drain: Point, address: Point, width: number, height: number): string[] => {
    const name = nameBox(placeStepOneLabels(address, drain, width, height).address, 210);
    const [left, top] = placeSelectedLabel(drain, address, name, width, height);
    const box: Box = { left, top, right: left + W, bottom: top + H };
    const found: string[] = [];
    if (coversCircle(box, drain, COMPARISON_MARK_R + 1.5)) found.push('covers the drain');
    if (coversPin(box, address)) found.push('covers the pin');
    if (box.left < name.right && box.right > name.left && box.top < name.bottom && box.bottom > name.top) {
      found.push('covers the address name');
    }
    if (!onCanvas(box, width, height)) found.push('leaves the canvas');
    return found;
  };

  it('stays off the pin and the name at 73 Bayswater Road, the drain 10 m to the left', () => {
    // Found in the browser: to the right of the drain was "free" on the
    // canvas, and was exactly where the pin and the address name were.
    const address: Point = [520, 300];
    const drain: Point = [494, 318];
    expect(clear(drain, address, 960, 603)).toEqual([]);
  });

  it('keeps clear across the step-2 map, drain from on the pin to well away', () => {
    const [width, height] = [960, 603];
    const failures: string[] = [];
    let checked = 0;
    for (let x = 80; x <= width - 80; x += 40) {
      for (let y = 80; y <= height - 80; y += 40) {
        for (const px of [0, 10, 30, 60, 120, 200]) {
          for (let degrees = 0; degrees < 360; degrees += 30) {
            const radians = (degrees * Math.PI) / 180;
            const drain: Point = [x + px * Math.cos(radians), y + px * Math.sin(radians)];
            if (drain[0] < 80 || drain[0] > width - 80 || drain[1] < 80 || drain[1] > height - 80) continue;
            checked += 1;
            const found = clear(drain, [x, y], width, height);
            if (found.length > 0) failures.push(`${String(x)},${String(y)} → ${String(px)} px @${String(degrees)}°: ${found.join('; ')}`);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5_000);
    expect(failures.length, failures.slice(0, 12).join('\n')).toBe(0);
  });

  it('goes beside the drain when nothing is in the way, as before', () => {
    expect(placeSelectedLabel([400, 300], null, null, 960, 603)).toEqual([400 + COMPARISON_MARK_R + 1.5 + 6 + 2, 300 - H / 2]);
  });
});
