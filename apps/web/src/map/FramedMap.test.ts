/**
 * The homepage preview names one pit, and the card beside it says *Show
 * connected pipe*.
 *
 * That sentence is a claim about the artefact, not decoration: a pit with no
 * recorded pipe leaving it would be a preview promising something the product
 * would not do for the person who came in and looked for it. The rule is
 * small, so it is asserted rather than trusted.
 */

import { describe, expect, it } from 'vitest';

import type { MapArtefact } from './artefact.js';
import { previewPit } from './FramedMap.js';

const artefact = (layers: MapArtefact['layers']): MapArtefact => ({
  artefact: 'map-geometry',
  version: 1,
  extent: { name: 'kensington', min_e: 0, min_n: 0, width_m: 1000, height_m: 1000 },
  coordinates: 'metres from the corner',
  crs: 'EPSG:28355',
  sources: [
    {
      layer: 'pit',
      dataset_id: 'stormwater-pits',
      title: 'Stormwater drainage pits',
      publisher: 'City of Melbourne',
      licence: 'CC BY 4.0',
      retrieved: '2026-08-20',
    },
  ],
  layers,
});

const pit = (asset: number, e: number, n: number) =>
  ({ g: 'point', c: [e, n], asset_number: asset }) as const;

const pipe = (from: number) =>
  ({
    g: 'line',
    c: [
      [0, 0],
      [10, 10],
    ],
    upstr_pit: from,
  }) as const;

describe('the pit the homepage preview names', () => {
  it('is one with a pipe recorded leaving it', () => {
    // 7 is nearer the middle, and has nothing leaving it. Choosing by
    // distance alone would pick it and the card would be wrong.
    const map = artefact({
      pit: [pit(7, 500, 500), pit(9, 400, 400)],
      pipe: [pipe(9)],
    });
    expect(previewPit(map)?.asset_number).toBe(9);
  });

  it('is the connected pit nearest the middle of the extent', () => {
    const map = artefact({
      pit: [pit(1, 100, 100), pit(2, 520, 470), pit(3, 900, 900)],
      pipe: [pipe(1), pipe(2), pipe(3)],
    });
    expect(previewPit(map)?.asset_number).toBe(2);
  });

  it('breaks a tie towards the earlier pit, so the choice is stable', () => {
    // Two pits equidistant from the centre. Rebuilding the artefact without
    // moving anything must not move the card.
    const map = artefact({
      pit: [pit(4, 400, 500), pit(5, 600, 500)],
      pipe: [pipe(4), pipe(5)],
    });
    expect(previewPit(map)?.asset_number).toBe(4);
  });

  it('names nobody rather than somebody wrong', () => {
    // No pipes at all, no pit that any pipe names, and no pits: three ways to
    // have no answer, and none of them is a reason to point at a pit anyway.
    expect(previewPit(artefact({ pit: [pit(1, 500, 500)], pipe: [] }))).toBeNull();
    expect(previewPit(artefact({ pit: [pit(1, 500, 500)], pipe: [pipe(99)] }))).toBeNull();
    expect(previewPit(artefact({ pit: [], pipe: [pipe(1)] }))).toBeNull();
    expect(previewPit(artefact({}))).toBeNull();
  });

  it('ignores a pit the record gives no asset number', () => {
    // It could not be drawn as selected or named on the card, and a card with
    // a blank where the identifier goes is worse than no card.
    const nameless = { g: 'point', c: [500, 500] } as const;
    const map = artefact({ pit: [nameless, pit(8, 300, 300)], pipe: [pipe(8)] });
    expect(previewPit(map)?.asset_number).toBe(8);
  });
});
