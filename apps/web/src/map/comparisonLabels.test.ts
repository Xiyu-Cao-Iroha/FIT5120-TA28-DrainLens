import { describe, expect, it } from 'vitest';

import {
  COACH_HEIGHT_PX,
  COACH_WIDTH_PX,
  DISTANCE_LABEL_PX,
  SHORT_CONNECTOR_PX,
  placeStepOneLabels,
} from './comparisonLabels.js';

const overlaps = (x: number, y: number, box: readonly [number, number], w: number, h: number) =>
  x >= box[0] && x <= box[0] + w && y >= box[1] && y <= box[1] + h;

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
    expect(placeStepOneLabels([700, 450], [660, 440], 1280, 680).distance).toEqual({ at: [688, 466], align: 'left' });
  });

  it('keeps the distance on the connector when there is room', () => {
    const placed = placeStepOneLabels([400, 500], [400 + SHORT_CONNECTOR_PX, 500], 1280, 680);
    expect(placed.distance).toEqual({ at: [400 + SHORT_CONNECTOR_PX / 2, 500], align: 'centre' });
  });

  it('mirrors everything when the drain is to the left', () => {
    const placed = placeStepOneLabels([700, 450], [640, 420], 1280, 680);
    expect(placed.coach[0] + COACH_WIDTH_PX).toBeLessThan(640);
    expect(placed.address.alignRight).toBe(false);
    expect(placed.address.at[0]).toBeGreaterThan(700);
  });

  it('flips the coach mark to the other side rather than let it leave the canvas', () => {
    const right = placeStepOneLabels([1100, 450], [1200, 450], 1280, 680);
    expect(right.coach[0] + COACH_WIDTH_PX).toBeLessThanOrEqual(1200);
    const left = placeStepOneLabels([100, 450], [40, 450], 1280, 680);
    expect(left.coach[0]).toBeGreaterThan(40);
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

  it('keeps the distance label on the canvas at either edge', () => {
    const nearLeft = placeStepOneLabels([100, 300], [130, 280], 375, 470);
    expect(nearLeft.distance).toEqual({ at: [8, 316], align: 'left' });
    const nearRight = placeStepOneLabels([300, 300], [270, 280], 375, 470);
    expect(nearRight.distance).toEqual({ at: [367, 316], align: 'right' });
    expect(DISTANCE_LABEL_PX).toBeGreaterThan(200);
  });
});
