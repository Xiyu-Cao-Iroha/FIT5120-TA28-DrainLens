/**
 * What crosses the wire.
 *
 * This module is the single definition of every payload the browser sends to the
 * backend. It is deliberately small, and the test suite asserts the exact key set
 * of each payload — so adding a photograph, an address, or a coordinate here
 * fails a test rather than quietly shipping.
 *
 * Never present, anywhere in this file: the photograph, the searched address,
 * client coordinates, or anything identifying a person (AD1, AD10).
 */

import type { AssetNumber, StationId } from './scenario.js';
import type { DebrisType, VisibleCondition } from './vocabulary.js';

/** Epic 4 · Catchment Warden. Submitted only after the resident confirms. */
export interface DrainCheckSubmission {
  readonly assetNumber: AssetNumber;
  readonly visibleCondition: VisibleCondition;
  readonly debrisType: DebrisType | null;
  readonly checkedAt: string;
  /** Whether the confirmed category began as a model suggestion (AD10). */
  readonly wasModelProposed: boolean;
}

export const DRAIN_CHECK_KEYS = [
  'assetNumber',
  'visibleCondition',
  'debrisType',
  'checkedAt',
  'wasModelProposed',
] as const;

/**
 * Request for a cached rainfall observation (AD12, conditional).
 *
 * By station identifier only. The browser resolves the nearest station against a
 * shipped index, so no endpoint ever receives a coordinate.
 */
export interface RainfallObservationRequest {
  readonly stationId: StationId;
}

export const RAINFALL_REQUEST_KEYS = ['stationId'] as const;

export interface RainfallObservationResponse {
  readonly stationId: StationId;
  readonly stationName: string;
  readonly observedFrom: string;
  readonly observedTo: string;
  readonly rainfallMm: number;
  readonly upstreamUpdatedAt: string;
  readonly fetchedAt: string;
}

/** Fields no request or response in this package may ever carry. */
export const FORBIDDEN_WIRE_KEYS = [
  'photo',
  'photograph',
  'image',
  'imageData',
  'address',
  'streetAddress',
  'lat',
  'lon',
  'latitude',
  'longitude',
  'coordinates',
  'geom',
  'email',
  'userId',
  'sessionId',
  'ipAddress',
] as const;

export type ForbiddenWireKey = (typeof FORBIDDEN_WIRE_KEYS)[number];

/**
 * Structural guard for anything about to be sent. Cheap enough to call on every
 * submission, and it catches the case the type system cannot: an object widened
 * to `unknown` somewhere between the form and the fetch.
 */
export function containsForbiddenKey(payload: unknown): ForbiddenWireKey | null {
  if (typeof payload !== 'object' || payload === null) return null;
  for (const key of Object.keys(payload as Record<string, unknown>)) {
    const hit = FORBIDDEN_WIRE_KEYS.find((f) => f.toLowerCase() === key.toLowerCase());
    if (hit !== undefined) return hit;
  }
  return null;
}

export class WirePayloadError extends Error {}

export function assertSendable<T>(payload: T): T {
  const forbidden = containsForbiddenKey(payload);
  if (forbidden !== null) {
    throw new WirePayloadError(
      `payload carries "${forbidden}", which must never leave the device (AD1 / AD10)`,
    );
  }
  return payload;
}
