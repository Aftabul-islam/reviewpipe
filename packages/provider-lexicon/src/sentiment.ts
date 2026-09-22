import type { SentimentResult, SentimentLabel } from '@reviewpipe/core';
import { AFINN } from './afinn.js';

// AFINN valences (-5..5) summed and then squashed into [-1, 1]; alpha controls
// how quickly the score saturates, following the normalization VADER uses.
const NORMALIZATION_ALPHA = 15;
const POSITIVE_THRESHOLD = 0.05;
const NEGATIVE_THRESHOLD = -0.05;
// A negator flips the next sentiment word within this many tokens, so
// "not good" scores negative instead of positive.
const NEGATION_WINDOW = 3;

const NEGATORS: ReadonlySet<string> = new Set([
  'not',
  'no',
  'never',
  'none',
  'nobody',
  'nothing',
  'neither',
  'nor',
  'without',
  'hardly',
  'barely',
  'scarcely',
  'cannot',
  "can't",
  "won't",
  "don't",
  "doesn't",
  "didn't",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "shouldn't",
  "wouldn't",
  "couldn't",
  "ain't",
]);

/**
 * Score a single piece of text using the bundled AFINN lexicon. Handles simple
 * negation but no other grammar. Empty or whitespace-only input — and text
 * with no recognized sentiment words — returns a neutral `0` with `confidence`
 * `0` rather than throwing, so callers can distinguish "no signal" from a
 * genuine neutral verdict.
 */
export function scoreSentiment(text: string): SentimentResult {
  const tokens = tokenize(text);

  let sum = 0;
  let matched = 0;
  for (const [index, token] of tokens.entries()) {
    const valence = AFINN[token];
    if (valence === undefined) continue;
    matched += 1;
    sum += isNegated(tokens, index) ? -valence : valence;
  }

  if (matched === 0) return { score: 0, label: 'neutral', confidence: 0 };

  const score = sum / Math.sqrt(sum * sum + NORMALIZATION_ALPHA);
  return {
    score,
    label: labelFor(score),
    confidence: Math.min(1, Math.abs(score) + 0.15 * matched),
  };
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

function isNegated(tokens: string[], index: number): boolean {
  const start = Math.max(0, index - NEGATION_WINDOW);
  for (let i = start; i < index; i += 1) {
    const token = tokens[i];
    if (token && NEGATORS.has(token)) return true;
  }
  return false;
}

function labelFor(score: number): SentimentLabel {
  if (score >= POSITIVE_THRESHOLD) return 'positive';
  if (score <= NEGATIVE_THRESHOLD) return 'negative';
  return 'neutral';
}
