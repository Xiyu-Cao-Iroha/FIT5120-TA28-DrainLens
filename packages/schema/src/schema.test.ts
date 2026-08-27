import { describe, expect, it } from 'vitest';

import * as schema from './index.js';
import {
  BLOCKAGE_SETTINGS,
  COMPARISON_BANDS,
  INSUFFICIENCY_REASONS,
  RESULT_STATUSES,
  isComparisonBand,
  isInsufficiencyReason,
  DEBRIS_TYPES,
  VISIBLE_CONDITIONS,
  isBlockageSetting,
  isDebrisType,
  isVisibleCondition,
} from './vocabulary.js';
import {
  ProvenanceError,
  assumed,
  assumptionId,
  dataVersionId,
  derivationId,
  derived,
  inferred,
  isProvenanced,
  labelOf,
  sourceProvided,
} from './provenance.js';
import {
  RAINFALL_RANGE_MM,
  ScenarioError,
  assetNumber,
  buildRunProvenance,
  isSupportedRainfall,
  stationId,
  type PositionResult,
  type ScenarioInputs,
} from './scenario.js';
import {
  DRAIN_CHECK_KEYS,
  RAINFALL_REQUEST_KEYS,
  WirePayloadError,
  assertSendable,
  containsForbiddenKey,
  type DrainCheckSubmission,
} from './wire.js';

const V1 = dataVersionId('drainpipes@2023-02-26');
const V2 = dataVersionId('stormwater-pits@2023-02-26');

describe('vocabulary', () => {
  it('separates no clear change from insufficient information', () => {
    // A calculation that ran and found nothing is a band. A calculation that
    // could not be made is a status. Merging them would let the two print the
    // same words on the map.
    expect(COMPARISON_BANDS).toEqual(['no-clear-change', 'higher-than-baseline']);
    expect(COMPARISON_BANDS).not.toContain('insufficient-data');
    expect(RESULT_STATUSES).toEqual(['successful', 'insufficient-information']);
    expect(INSUFFICIENCY_REASONS).toEqual([
      'terrain_unavailable',
      'invalid_inlet',
      'scenario_calculation_failed',
      'comparison_not_comparable',
    ]);
    expect(isComparisonBand('no-clear-change')).toBe(true);
    expect(isComparisonBand('insufficient-data')).toBe(false);
    expect(isInsufficiencyReason('invalid_inlet')).toBe(true);
    expect(isInsufficiencyReason('nope')).toBe(false);
  });

  it('carries the three blockage settings AC 2.1 requires, in order', () => {
    expect(BLOCKAGE_SETTINGS).toEqual(['clear', 'partly-blocked', 'fully-blocked']);
  });

  it('describes visible condition in surface terms, and offers a cannot-determine option', () => {
    expect(VISIBLE_CONDITIONS).toEqual([
      'no-visible-obstruction',
      'some-visible-obstruction',
      'extensive-visible-obstruction',
      'cannot-determine',
    ]);
    expect(VISIBLE_CONDITIONS.every((v) => !/blocked/.test(v))).toBe(true);
  });

  it('shares no member between the visible and hydraulic vocabularies', () => {
    const overlap = (VISIBLE_CONDITIONS as readonly string[]).filter((v) =>
      (BLOCKAGE_SETTINGS as readonly string[]).includes(v),
    );
    expect(overlap).toEqual([]);
  });

  it('exports no function mapping a visible condition to a blockage setting', () => {
    // Guards the decision recorded in vocabulary.ts: a photograph cannot
    // establish that a drain is hydraulically blocked, so no such conversion
    // may exist in this package. If someone adds one, this fails.
    const bag = schema as unknown as Record<string, unknown>;
    const suspects = Object.keys(bag).filter(
      (k) =>
        typeof bag[k] === 'function' &&
        /visible/i.test(k) &&
        /(blockage|toBlock|asBlock)/i.test(k),
    );
    expect(suspects).toEqual([]);
    // The sentinel itself is a constant recording the decision, not a converter.
    expect(schema.visibleConditionIsNotABlockageSetting).toBe(true);
  });

  it('recognises its own members and rejects strangers', () => {
    expect(isBlockageSetting('partly-blocked')).toBe(true);
    expect(isBlockageSetting('mostly-blocked')).toBe(false);
    expect(isBlockageSetting(3)).toBe(false);
    expect(isVisibleCondition('cannot-determine')).toBe(true);
    expect(isVisibleCondition('clear')).toBe(false);
    expect(isDebrisType('sediment')).toBe(true);
    expect(isDebrisType(null)).toBe(false);
    expect(DEBRIS_TYPES).toContain('other');
  });
});

describe('provenance', () => {
  it('labels a source-provided value with the version it came from', () => {
    const p = sourceProvided(450, 'mm', V1);
    expect(labelOf(p)).toBe('source-provided');
    expect(p.basis).toEqual({ label: 'source-provided', dataVersionId: V1 });
  });

  it('records every version behind a derived value', () => {
    const p = derived(450, 'mm', [V1, V2], derivationId('nominal-size@1'));
    expect(labelOf(p)).toBe('derived');
    if (p.basis.label !== 'derived') throw new Error('unreachable');
    expect(p.basis.dataVersionIds).toEqual([V1, V2]);
  });

  it('refuses a derived value that names no source', () => {
    expect(() => derived(1, 'mm', [], derivationId('d'))).toThrow(ProvenanceError);
  });

  it('points an assumed value at the assumption register', () => {
    const p = assumed(0.6, 'fraction', assumptionId('capture-fraction@2'));
    expect(labelOf(p)).toBe('assumed');
  });

  it('requires a model version and a confidence within range for an inferred value', () => {
    const p = inferred('some-visible-obstruction', 'category', 'inlet-v0.3', 0.82);
    expect(labelOf(p)).toBe('inferred');
    expect(() => inferred(1, 'mm', 'm', 1.4)).toThrow(ProvenanceError);
    expect(() => inferred(1, 'mm', 'm', Number.NaN)).toThrow(ProvenanceError);
    expect(() => inferred(1, 'mm', '  ', 0.5)).toThrow(ProvenanceError);
  });

  it('accepts every well-formed basis at runtime', () => {
    expect(isProvenanced(sourceProvided(1, 'mm', V1))).toBe(true);
    expect(isProvenanced(derived(1, 'mm', [V1], derivationId('d')))).toBe(true);
    expect(isProvenanced(assumed(1, 'mm', assumptionId('a')))).toBe(true);
    expect(isProvenanced(inferred(1, 'mm', 'm', 0))).toBe(true);
  });

  it('rejects a value that cannot account for itself', () => {
    expect(isProvenanced(null)).toBe(false);
    expect(isProvenanced(42)).toBe(false);
    expect(isProvenanced({ value: 1, unit: 'mm' })).toBe(false);
    expect(isProvenanced({ value: 1, unit: 'mm', basis: null })).toBe(false);
    expect(isProvenanced({ value: 1, unit: 1, basis: { label: 'assumed', assumptionId: 'a' } })).toBe(
      false,
    );
    expect(isProvenanced({ value: 1, unit: 'mm', basis: { label: 'guessed' } })).toBe(false);
    expect(isProvenanced({ value: 1, unit: 'mm', basis: { label: 'source-provided' } })).toBe(false);
    expect(
      isProvenanced({ value: 1, unit: 'mm', basis: { label: 'derived', dataVersionIds: [] } }),
    ).toBe(false);
    expect(isProvenanced({ value: 1, unit: 'mm', basis: { label: 'assumed' } })).toBe(false);
    expect(
      isProvenanced({
        value: 1,
        unit: 'mm',
        basis: { label: 'inferred', modelVersion: 'm', confidence: 2 },
      }),
    ).toBe(false);
  });
});

const inputs = (over: Partial<ScenarioInputs> = {}): ScenarioInputs => ({
  pitAssetNumber: assetNumber('P-1001'),
  blockage: 'fully-blocked',
  accumulatedRainfallMm: 40,
  rainfallSource: { kind: 'manual' },
  ...over,
});

const positions: readonly PositionResult[] = [
  { accumulatedRainfallMm: 10, band: 'no-clear-change' },
  { accumulatedRainfallMm: 25, band: 'higher-than-baseline' },
  { accumulatedRainfallMm: 40, band: 'higher-than-baseline' },
];

const parts = (over: Record<string, unknown> = {}) => ({
  inputs: inputs(),
  window: { metresSquare: 500 },
  dataVersionIds: [V1, V2],
  engineVersion: 'engine@0.1.0',
  assumptionSetVersion: 'assumptions@1',
  positions,
  resultStatus: 'successful' as const,
  ...over,
});

describe('scenario', () => {
  it('accepts rainfall inside the supported range only', () => {
    expect(isSupportedRainfall(RAINFALL_RANGE_MM.min)).toBe(true);
    expect(isSupportedRainfall(RAINFALL_RANGE_MM.max)).toBe(true);
    expect(isSupportedRainfall(RAINFALL_RANGE_MM.max + 0.1)).toBe(false);
    expect(isSupportedRainfall(-1)).toBe(false);
    expect(isSupportedRainfall(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('builds a run that records its inputs, versions and positions', () => {
    const run = buildRunProvenance(parts());
    expect(run.dataVersionIds).toEqual([V1, V2]);
    expect(run.positions).toHaveLength(3);
    expect(run.inputs.rainfallSource.kind).toBe('manual');
    expect(run.resultStatus).toBe('successful');
    expect(run.insufficiencyReason).toBeNull();
    expect(run.networkLimitations).toEqual([]);
  });

  it('carries the station and its distance when the value came from an observation', () => {
    const run = buildRunProvenance(
      parts({
        inputs: inputs({
          rainfallSource: {
            kind: 'observation',
            stationId: stationId('95936'),
            stationName: 'Melbourne (Olympic Park)',
            observedFrom: '2026-08-26T09:00:00+10:00',
            observedTo: '2026-08-26T15:00:00+10:00',
            upstreamUpdatedAt: '2026-08-26T15:11:00+10:00',
            distanceFromAddressM: 2400,
          },
        }),
      }),
    );
    if (run.inputs.rainfallSource.kind !== 'observation') throw new Error('unreachable');
    // One gauge describes one point; the distance must survive into the record.
    expect(run.inputs.rainfallSource.distanceFromAddressM).toBe(2400);
  });

  it('refuses a run that cannot be explained or reproduced', () => {
    expect(() =>
      buildRunProvenance(parts({ inputs: inputs({ accumulatedRainfallMm: 999 }) })),
    ).toThrow(ScenarioError);
    expect(() => buildRunProvenance(parts({ dataVersionIds: [] }))).toThrow(ScenarioError);
    expect(() => buildRunProvenance(parts({ positions: [] }))).toThrow(
      /successful run must record at least one position/,
    );
  });

  it('refuses positions that are not strictly ascending in rainfall', () => {
    const wrong: PositionResult[] = [
      { accumulatedRainfallMm: 25, band: 'no-clear-change' },
      { accumulatedRainfallMm: 10, band: 'no-clear-change' },
    ];
    expect(() => buildRunProvenance(parts({ positions: wrong }))).toThrow(ScenarioError);
  });

  it('copies its inputs so a caller cannot mutate a recorded run', () => {
    const versions = [V1];
    const run = buildRunProvenance(parts({ dataVersionIds: versions }));
    versions.push(V2);
    expect(run.dataVersionIds).toEqual([V1]);
  });
});

describe('a run that could not be compared', () => {
  const unavailable = (over: Record<string, unknown> = {}) =>
    parts({
      resultStatus: 'insufficient-information' as const,
      insufficiencyReason: 'terrain_unavailable' as const,
      positions: [],
      ...over,
    });

  it('records the reason instead of a result', () => {
    const run = buildRunProvenance(unavailable());
    expect(run.resultStatus).toBe('insufficient-information');
    expect(run.insufficiencyReason).toBe('terrain_unavailable');
    expect(run.positions).toEqual([]);
  });

  it('still records the inputs and data versions, because it has to explain itself', () => {
    const run = buildRunProvenance(unavailable());
    expect(run.dataVersionIds).toEqual([V1, V2]);
    expect(run.inputs.pitAssetNumber).toBe(assetNumber('P-1001'));
  });

  it('refuses to be insufficient without naming a reason', () => {
    expect(() => buildRunProvenance(unavailable({ insufficiencyReason: null }))).toThrow(
      /must name the reason/,
    );
  });

  it('refuses to carry positions as well as an insufficiency', () => {
    expect(() => buildRunProvenance(unavailable({ positions }))).toThrow(
      /cannot also carry comparison positions/,
    );
  });

  it('refuses a successful result that also carries a reason', () => {
    expect(() =>
      buildRunProvenance(parts({ insufficiencyReason: 'invalid_inlet' as const })),
    ).toThrow(/cannot carry an insufficiency reason/);
  });

  it('keeps a network limitation with a successful result rather than instead of one', () => {
    // Where a pipe leads has no bearing on the surface comparison.
    const run = buildRunProvenance(
      parts({ networkLimitations: ['missing_downstream_connection'] as const }),
    );
    expect(run.resultStatus).toBe('successful');
    expect(run.networkLimitations).toEqual(['missing_downstream_connection']);
  });
});

describe('wire payloads', () => {
  const check: DrainCheckSubmission = {
    assetNumber: assetNumber('P-1001'),
    visibleCondition: 'some-visible-obstruction',
    debrisType: 'leaf-litter',
    checkedAt: '2026-08-26T15:00:00+10:00',
    wasModelProposed: true,
  };

  it('sends exactly the agreed keys for a drain check', () => {
    expect(Object.keys(check).sort()).toEqual([...DRAIN_CHECK_KEYS].sort());
  });

  it('asks for rainfall by station identifier and nothing else', () => {
    expect(RAINFALL_REQUEST_KEYS).toEqual(['stationId']);
  });

  it('lets a clean payload through', () => {
    expect(assertSendable(check)).toBe(check);
    expect(containsForbiddenKey(check)).toBeNull();
    expect(containsForbiddenKey(null)).toBeNull();
    expect(containsForbiddenKey('a string')).toBeNull();
  });

  it('stops a payload that would carry the photograph, the address or a coordinate', () => {
    expect(containsForbiddenKey({ ...check, photo: 'data:image/jpeg;base64,...' })).toBe('photo');
    expect(containsForbiddenKey({ ...check, address: '1 Swanston St' })).toBe('address');
    expect(containsForbiddenKey({ ...check, Latitude: -37.81 })).toBe('latitude');
    expect(() => assertSendable({ ...check, lon: 144.96 })).toThrow(WirePayloadError);
    expect(() => assertSendable({ ...check, sessionId: 'abc' })).toThrow(/never leave the device/);
  });
});
