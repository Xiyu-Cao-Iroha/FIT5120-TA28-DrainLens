import { describe, expect, it } from 'vitest';

import {
  SUGGESTED,
  answerFor,
  questionForAction,
} from './answers.js';

describe('ask answers register', () => {
  it('contains the four expected suggested questions', () => {
    expect(SUGGESTED).toEqual([
      'gutters',
      'kit',
      'car',
      'warnings',
    ]);
  });

  it.each(SUGGESTED)('resolves suggested answer id "%s"', (id) => {
    const answer = answerFor(id);

    expect(answer).not.toBeNull();
    expect(answer?.id).toBe(id);
    expect(answer?.question.trim()).not.toBe('');
  });

  it('returns null for an unknown answer id', () => {
    expect(answerFor('does-not-exist')).toBeNull();
  });

  it('returns null for an unknown action id', () => {
    expect(questionForAction('does-not-exist')).toBeNull();
  });
});