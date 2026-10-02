/**
 * Who can help, and the two things the criteria say it must not become:
 * ownership of a particular asset, and an organisation inferred for a pit.
 */

import { describe, expect, it } from 'vitest';

import {
  DRAINAGE_LEVELS,
  GENERAL_ROLES_ONLY,
  PIT_HAS_NO_OPERATOR,
  operatorLine,
} from './help.js';

describe('the three levels', () => {
  it('names private property, local streets and regional drains', () => {
    expect(DRAINAGE_LEVELS.map((level) => level.id)).toEqual(['private', 'street', 'regional']);
  });

  it('hedges every role, because none of them is about a particular asset', () => {
    for (const level of DRAINAGE_LEVELS) {
      expect(level.role).toMatch(/generally/);
    }
  });

  it('cites a publisher and the date its page was read', () => {
    // AC 6.2.1 asks for the official source behind these general roles.
    for (const level of DRAINAGE_LEVELS) {
      expect(level.source.publisher).toBeTruthy();
      expect(level.source.page).toMatch(/^https:\/\//);
      expect(level.source.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('says outright that a general role is not ownership', () => {
    expect(GENERAL_ROLES_ONLY).toMatch(/do not confirm who legally owns or operates/);
  });
});

describe('what the record says about a pipe’s operator', () => {
  it('names an organisation the record names', () => {
    expect(operatorLine('City of Melbourne')).toBe('City of Melbourne');
  });

  it('says the record holds none where the field is empty', () => {
    expect(operatorLine(undefined)).toBe('Operator not recorded');
    expect(operatorLine('  ')).toBe('Operator not recorded');
  });

  it('calls an unexplained code a code, rather than resolving it', () => {
    // 853 of the council's pipes carry `4`, which the portal does not explain.
    // Reading it as an organisation would send a resident's report to whoever
    // this project guessed.
    expect(operatorLine('4')).toBe('Operator code not yet identified (4)');
  });

  it('gives a pit no operator at all', () => {
    // The pits dataset has no operator field, and AC 6.2.2 forbids taking one
    // from a pipe that joins the pit.
    expect(PIT_HAS_NO_OPERATOR).toMatch(/does not say who operates a pit/);
    expect(PIT_HAS_NO_OPERATOR).not.toMatch(/City of Melbourne operates/);
  });
});

describe('against the published map', () => {
  it('has a sentence for every operator value the council’s pipes carry', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const map = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../../api/data/city-of-melbourne/map.json'), 'utf8'),
    ) as { layers: { pipe: { operator?: string }[] } };
    const said = new Map<string, number>();
    for (const pipe of map.layers.pipe) {
      const line = operatorLine(pipe.operator);
      said.set(line, (said.get(line) ?? 0) + 1);
    }
    expect(said.get('City of Melbourne')).toBe(16_302);
    expect(said.get('Operator code not yet identified (4)')).toBe(853);
    expect(said.get('Operator not recorded')).toBe(87);
    // Three sentences for 17,242 pipes, and no fourth invented on the way.
    expect(said.size).toBe(3);
  }, 30_000);
});
