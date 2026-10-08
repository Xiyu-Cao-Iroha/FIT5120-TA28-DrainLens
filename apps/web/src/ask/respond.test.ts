/**
 * The panel is held against the evaluation the team already ran.
 *
 * `assistant/evaluation_results.csv` is thirty questions in three categories,
 * scored by hand in Stage 2: *Normal*, *Unanswerable* and *Emergency*. It is
 * the only independent statement this project has about what a question of
 * each kind should get back, so the tests read it rather than restating it --
 * a question added to the evaluation is a question this has to survive, and
 * one quietly edited there fails here instead of passing everywhere.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { EMERGENCY_CALLS } from '../report/problems.js';
import { ANSWERS, CANNOT_SAY, EMERGENCY_ROWS, SUGGESTED, answerFor } from './answers.js';
import { bestAnswer, isEmergency, refusalFor, respond } from './respond.js';

interface EvaluationRow {
  readonly id: string;
  readonly question: string;
  readonly category: string;
  readonly pass: boolean;
}

/**
 * The evaluation, read as rows.
 *
 * Written by hand rather than with a parser: the file has quoted fields
 * holding commas, and the four columns this needs are the first three and
 * `pass_fail`, so a parser small enough to read is better here than a
 * dependency that would have to be explained.
 */
function evaluation(): readonly EvaluationRow[] {
  const file = path.resolve(__dirname, '../../../../assistant/evaluation_results.csv');
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const header = split(lines[0] ?? '');
  const columns = {
    id: header.indexOf('id'),
    question: header.indexOf('question'),
    category: header.indexOf('category'),
    pass: header.indexOf('pass_fail'),
  };
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return {
      id: cells[columns.id] ?? '',
      question: cells[columns.question] ?? '',
      category: cells[columns.category] ?? '',
      pass: (cells[columns.pass] ?? '').toLowerCase() === 'pass',
    };
  });
}

/** One CSV line into cells, honouring `""` quoting and nothing else. */
function split(line: string): readonly string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let at = 0; at < line.length; at += 1) {
    const ch = line[at];
    if (ch === '"') {
      if (quoted && line[at + 1] === '"') {
        cell += '"';
        at += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

const ROWS = evaluation();

describe('the evaluation is what it was when these tests were written', () => {
  it('has thirty rows in three categories', () => {
    expect(ROWS).toHaveLength(30);
    expect(new Set(ROWS.map((row) => row.category))).toEqual(
      new Set(['Normal', 'Unanswerable', 'Emergency']),
    );
  });
});

describe('an emergency is answered as an emergency', () => {
  for (const row of ROWS.filter((candidate) => candidate.category === 'Emergency')) {
    it(`${row.id}: ${row.question}`, () => {
      expect(respond(row.question)).toEqual({ kind: 'emergency' });
    });
  }

  it('is decided before anything is matched or refused', () => {
    // The phrase is what decides it, so a question carrying both an
    // emergency phrase and a register word still gets the numbers.
    const both = 'water is coming into my house right now, should I move my furniture?';
    expect(isEmergency(both)).toBe(true);
    expect(respond(both)).toEqual({ kind: 'emergency' });
  });

  it('does not fire on the ordinary questions that carry the same words', () => {
    expect(isEmergency('What goes in an emergency kit?')).toBe(false);
    expect(isEmergency('What can I do to reduce floodwater entering my home?')).toBe(false);
    expect(isEmergency('How can I make sure I receive emergency warnings?')).toBe(false);
  });
});

describe('what no official guide can answer is refused', () => {
  for (const row of ROWS.filter((candidate) => candidate.category === 'Unanswerable')) {
    it(`${row.id}: ${row.question}`, () => {
      const result = respond(row.question);
      expect(result.kind).toBe('cannot');
    });
  }

  it('refuses by name, before the register is matched', () => {
    // Both of these carry a word the register recognises. The refusal has to
    // win, or the panel answers a question about choosing an insurer with
    // advice about reading the policy somebody already has.
    expect(refusalFor('Which insurance company should I choose?')).toBe('provider');
    expect(bestAnswer('Which insurance company should I choose?')?.id).toBe('insurance');
    expect(respond('Which insurance company should I choose?')).toEqual({
      kind: 'cannot',
      because: 'provider',
    });

    expect(respond('Can you tell me whether my electrical switchboard is currently safe?')).toEqual({
      kind: 'cannot',
      because: 'inspection',
    });
  });

  it("refuses the design's own example as a prediction", () => {
    expect(respond('Will my house flood in the next storm?')).toEqual({
      kind: 'cannot',
      because: 'prediction',
    });
  });

  it('has a first sentence for every refusal it can give', () => {
    const reasons = new Set(
      ROWS.filter((row) => row.category === 'Unanswerable')
        .map((row) => respond(row.question))
        .map((result) => (result.kind === 'cannot' ? result.because : 'answered')),
    );
    reasons.add('not-covered');
    for (const reason of reasons) {
      expect(CANNOT_SAY[reason], reason).toBeTypeOf('string');
    }
  });
});

describe('an ordinary question is never answered as an emergency', () => {
  for (const row of ROWS.filter((candidate) => candidate.category === 'Normal')) {
    it(`${row.id}: ${row.question}`, () => {
      expect(respond(row.question).kind).not.toBe('emergency');
    });
  }

  it('answers the ones the register was built for', () => {
    const covered = new Set(ANSWERS.flatMap((answer) => answer.evaluated));
    const rows = ROWS.filter((row) => covered.has(row.id));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(respond(row.question), row.question).toMatchObject({ kind: 'answer' });
    }
  });
});

describe('the register', () => {
  it('ships only answers the evaluation found answerable', () => {
    const byId = new Map(ROWS.map((row) => [row.id, row]));
    for (const answer of ANSWERS) {
      expect(answer.evaluated.length, answer.id).toBeGreaterThan(0);
      for (const id of answer.evaluated) {
        const row = byId.get(id);
        expect(row, `${answer.id} cites ${id}`).toBeDefined();
        expect(row?.category, `${answer.id} cites ${id}`).toBe('Normal');
        expect(row?.pass, `${answer.id} cites ${id}`).toBe(true);
      }
    }
  });

  it('gives every answer a source with a quotation and a date', () => {
    for (const answer of ANSWERS) {
      expect(answer.sources.length, answer.id).toBeGreaterThan(0);
      for (const source of answer.sources) {
        expect(source.href, answer.id).toMatch(/^https:\/\//);
        expect(source.quote.length, `${answer.id} · ${source.document}`).toBeGreaterThan(10);
        expect(source.checked, answer.id).toMatch(/^20\d\d-\d\d-\d\d$/);
      }
    }
  });

  it('keeps every answer to a handful of points', () => {
    for (const answer of ANSWERS) {
      expect(answer.points.length, answer.id).toBeGreaterThan(0);
      expect(answer.points.length, answer.id).toBeLessThanOrEqual(4);
    }
  });

  it('never links an answer to a plan action the plan does not have', async () => {
    const { GENERAL_ACTIONS } = await import('../prepare/actions.js');
    const ids = new Set(GENERAL_ACTIONS.map((action) => action.id));
    for (const answer of ANSWERS) {
      if (answer.planAction !== null) expect(ids, answer.id).toContain(answer.planAction);
    }
  });
});

describe('the vocabulary that selects an answer', () => {
  it('is disjoint: no word belongs to two answers', () => {
    const seen = new Map<string, string>();
    for (const answer of ANSWERS) {
      for (const word of answer.words) {
        const already = seen.get(word);
        expect(already, `"${word}" is in both ${String(already)} and ${answer.id}`).toBeUndefined();
        seen.set(word, answer.id);
      }
    }
  });

  it('holds no word that every flooding question carries', () => {
    const tooCommon = ['flood', 'floods', 'flooding', 'floodwater', 'water', 'house', 'home', 'rain', 'storm', 'my', 'do'];
    for (const answer of ANSWERS) {
      for (const word of answer.words) {
        expect(tooCommon, `${answer.id} · ${word}`).not.toContain(word);
      }
    }
  });

  it('settles a tie on the topic the reader opened with', () => {
    // Q12 reaches `car` and `leaving` with one word each. The car is what the
    // question is about, and it is what the reader said first.
    expect(bestAnswer('What should I do with my car before a possible evacuation?')?.id).toBe('car');
    expect(bestAnswer('What should I do before an evacuation, about my car?')?.id).toBe('leaving');
  });

  it('answers nothing where nothing matches', () => {
    expect(bestAnswer('who paints the lines on the road')).toBeNull();
    expect(respond('who paints the lines on the road')).toEqual({
      kind: 'cannot',
      because: 'not-covered',
    });
  });
});

describe('the suggested questions', () => {
  it('each name an answer the register holds', () => {
    for (const id of SUGGESTED) {
      expect(answerFor(id), id).not.toBeNull();
    }
  });

  it('each come back with the answer they were taken from', () => {
    for (const id of SUGGESTED) {
      const answer = answerFor(id);
      expect(answer, id).not.toBeNull();
      if (answer === null) continue;
      expect(respond(answer.question), answer.question).toEqual({ kind: 'answer', answer });
    }
  });
});

describe('the emergency card', () => {
  it('shows the same numbers the reporting pathway does', () => {
    const published = EMERGENCY_CALLS.map((call) => call.label).join(' ');
    for (const row of EMERGENCY_ROWS) {
      if (row.number !== null) expect(published, row.what).toContain(row.number);
    }
  });

  it('puts life in danger first', () => {
    expect(EMERGENCY_ROWS[0]?.number).toBe('000');
  });
});
