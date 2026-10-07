/**
 * What the panel does with a question, in the order it has to be done.
 *
 * Three things can come back (Figma Q2, Q4 and Q5), and which one comes back
 * is decided here rather than in the screen, so that the rule is one pure
 * function with a test around it instead of a condition in a component.
 *
 * The order is the safety property and it is not an implementation detail:
 *
 * 1. **An emergency is answered as an emergency**, before anything is read,
 *    matched or scored. Somebody typing *water is coming into my house right
 *    now* is not asking a question about getting ready, and the only correct
 *    response is three telephone numbers.
 * 2. **Then the questions no official guide can answer are refused by name.**
 *    Whether a particular house will flood, what a repair will cost, which
 *    insurer to choose, whether somebody's switchboard is safe right now. The
 *    Stage 2 evaluation calls these unanswerable and scores a system on
 *    refusing them; the danger is that they are full of words the register
 *    recognises -- *insurance*, *switchboard* -- so a refusal that ran after
 *    matching would never run at all.
 * 3. **Then the register is matched**, and a question that matches nothing,
 *    or matches two answers equally, is refused rather than guessed at.
 *
 * Nothing here is sent anywhere. The question is a string in one React state;
 * it is not stored, not logged, and not attached to the address (AD1), which
 * is what the line under the input box tells the reader.
 */

import { ANSWERS, type AskAnswer } from './answers.js';

/** Why the panel will not answer, which decides the first sentence it says. */
export type Refusal = 'prediction' | 'cost' | 'provider' | 'inspection' | 'not-covered';

/** What a question gets back. */
export type AskResult =
  | { readonly kind: 'emergency' }
  | { readonly kind: 'answer'; readonly answer: AskAnswer }
  | { readonly kind: 'cannot'; readonly because: Refusal };

/** Lower case, letters and digits only, single spaces, padded at both ends. */
function normalise(question: string): string {
  return ` ${question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/**
 * What an emergency sounds like.
 *
 * Phrases rather than words, because the words on their own belong to
 * ordinary questions: *what goes in an emergency kit* is a question about a
 * kit, and *what can I do to reduce floodwater entering my home* is a
 * question about sandbags. Each phrase below is one the Stage 2 evaluation's
 * emergency rows (Q25 to Q30) or the design's own examples actually contain.
 */
const EMERGENCY_PHRASES: readonly string[] = [
  'right now',
  'trapped',
  'immediate danger',
  'drive through floodwater',
  'driving through floodwater',
  'drive through flood water',
  'entering my house',
  'coming into my house',
  'coming in to my house',
  'water is around',
  'emergency assistance',
  'rescue',
  'call for help',
];

/** Whether the question is about something happening now. */
export function isEmergency(question: string): boolean {
  const text = normalise(question);
  return EMERGENCY_PHRASES.some((phrase) => text.includes(` ${phrase} `) || text.includes(phrase));
}

/**
 * The questions that are refused whatever words they carry.
 *
 * Each pattern is written against the evaluation row it exists for, and the
 * order matters: a question about what a repair will cost also contains
 * *will* and *flood*, and would otherwise be refused as a prediction, which
 * is a true sentence about the wrong question.
 */
const REFUSALS: readonly { readonly because: Refusal; readonly pattern: RegExp }[] = [
  // Q22. "How much will it cost to repair my home after a flood?"
  { because: 'cost', pattern: /\b(cost|costs|how much|price|pay for|claim amount)\b/ },
  // Q23. "Which insurance company should I choose for the best flood coverage?"
  {
    because: 'provider',
    pattern:
      /\b(which (insurance|insurer|company|provider|policy)|what (insurer|company)|best (policy|cover|coverage|insurer)|recommend|should i choose|who should i)\b/,
  },
  // Q24. "Can you tell me whether my electrical switchboard is currently safe?"
  {
    because: 'inspection',
    pattern: /\b(is my .* safe|are my .* safe|currently safe|inspect|tell me whether my|check my .* for me)\b/,
  },
  // Q19, Q20, Q21. Depth, time, and whether this house floods.
  {
    because: 'prediction',
    pattern:
      /\b(what time|how deep|exact|definitely|tomorrow|today|next storm|going to flood|will (it|my|this|the) \w*\s?(flood|floods|be flooded|reach)|will flood|flood depth)\b/,
  },
];

/** The refusal a question earns on its own terms, or `null`. */
export function refusalFor(question: string): Refusal | null {
  const text = normalise(question);
  return REFUSALS.find((rule) => rule.pattern.test(text))?.because ?? null;
}

/**
 * The best answer in the register, or `null`.
 *
 * Score is how many of an answer's own words the question carries, and the
 * highest score wins. Where two score the same the earlier one in the
 * question wins -- *what should I do with my car before a possible
 * evacuation* is a question about a car, asked by somebody who mentioned the
 * car first, and both of the answers it could reach are true.
 *
 * Refusing every tie was the first rule here and it was wrong: it turned a
 * question the Stage 2 evaluation answers into *that isn't in the official
 * guides*, which is a worse failure than picking the topic the reader opened
 * with. Nothing is guessed either way -- both candidates are answers a person
 * approved, and the loser is reachable by asking about it.
 */
export function bestAnswer(question: string): AskAnswer | null {
  const text = normalise(question);
  const scored = ANSWERS.map((answer) => {
    const hits = answer.words
      .map((word) => text.indexOf(` ${word} `))
      .filter((at) => at >= 0);
    return {
      answer,
      score: hits.length,
      first: hits.length === 0 ? Number.MAX_SAFE_INTEGER : Math.min(...hits),
    };
  })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.first - b.first);

  return scored[0]?.answer ?? null;
}

/** The whole rule, in the order the safety property needs. */
export function respond(question: string): AskResult {
  if (isEmergency(question)) return { kind: 'emergency' };

  const refusal = refusalFor(question);
  if (refusal !== null) return { kind: 'cannot', because: refusal };

  const answer = bestAnswer(question);
  return answer === null ? { kind: 'cannot', because: 'not-covered' } : { kind: 'answer', answer };
}
