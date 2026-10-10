/**
 * What a resident is shown when the assistant cannot answer.
 *
 * **The panel reads the body as text and parses it second**, and this file
 * exists because it did the opposite until 10 October. `response.json()` was
 * called before `response.ok` was looked at, so any failure that answered
 * with something other than JSON threw out of the parser and the catch put
 * the parser's own message on screen.
 *
 * It is not hypothetical and it is not rare. On 9 October the deployed API
 * had no `/api/chat` and answered `404 Not Found` as plain text; a resident
 * would have been shown *Unexpected non-whitespace character after JSON at
 * position 4*. The shapes that still produce a non-JSON body are a Cloud Run
 * gateway page, a proxy timeout, and an HTML error from anything in between,
 * and the service is slow enough to meet them: `drainlens-ai` scales to zero
 * and its first answer after an idle period takes over a minute.
 *
 * The panel itself is a React component and this suite runs in node, so what
 * is checked here is the rule the panel follows, written out once and run
 * against the bodies a real failure produces.
 */

import { describe, expect, it } from 'vitest';

import { CHAT_UNAVAILABLE } from './answers.js';

/**
 * The panel's rule, as a function.
 *
 * Kept in step with `AskAboutGettingReady.tsx` by being the same four lines
 * in the same order. A copy is worth it here because the alternative is no
 * check at all: the panel cannot be rendered in this suite, and the failure
 * it guards against is invisible until somebody reads a screenshot.
 */
function shown(status: number, body: string): { ok: true; answer: string } | { ok: false; error: string } {
  let data: { answer?: string; error?: string } = {};
  let readable = true;
  try {
    data = JSON.parse(body) as typeof data;
  } catch {
    readable = false;
  }
  if (status < 200 || status >= 300 || !readable) {
    return { ok: false, error: (readable ? data.error : undefined) ?? CHAT_UNAVAILABLE };
  }
  return { ok: true, answer: data.answer ?? 'No answer was returned.' };
}

/** Anything a parser would complain about rather than return. */
const parserComplaint = /Unexpected|JSON at position|is not valid JSON|SyntaxError/i;

describe('a body that is not JSON', () => {
  it.each([
    ['the 404 the API actually served on 9 October', 404, '404 Not Found'],
    ['a Cloud Run gateway page', 502, '<html><head><title>502</title></head><body>Error</body></html>'],
    ['a proxy timeout', 504, 'upstream request timeout'],
    ['nothing at all', 502, ''],
  ])('shows a sentence, not a parser complaint: %s', (_what, status, body) => {
    const result = shown(status, body);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(CHAT_UNAVAILABLE);
    expect(result.error).not.toMatch(parserComplaint);
  });

  it('does not trust a 200 whose body cannot be read either', () => {
    // A gateway can return 200 with its own HTML. The old code would have
    // thrown the parser error here too, and with `ok` true it would not even
    // have reached the error branch.
    const result = shown(200, '<html>we are having trouble</html>');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(CHAT_UNAVAILABLE);
  });
});

describe('a body that is JSON', () => {
  it('prefers the service’s own sentence where it sent one', () => {
    // The API says `AI chat service is not configured` when `AI_SERVICE_URL`
    // is absent. That is more use than the generic line, so it wins.
    const result = shown(503, JSON.stringify({ error: 'AI chat service is not configured.' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('AI chat service is not configured.');
  });

  it('falls back to the generic line when the failure carries no sentence', () => {
    const result = shown(500, JSON.stringify({ somethingElse: true }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(CHAT_UNAVAILABLE);
  });

  it('passes an answer through', () => {
    const result = shown(200, JSON.stringify({ answer: 'Clear your gutters.', sources: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answer).toBe('Clear your gutters.');
  });

  it('says so rather than showing an empty bubble', () => {
    const result = shown(200, JSON.stringify({ sources: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answer).toBe('No answer was returned.');
  });
});

describe('the sentence itself', () => {
  it('gives no reason, because a reason here is not actionable', () => {
    expect(CHAT_UNAVAILABLE).toBe('The chat assistant is temporarily unavailable.');
    expect(CHAT_UNAVAILABLE).not.toMatch(/\d{3}|JSON|parse|upstream|gateway/i);
  });
});
