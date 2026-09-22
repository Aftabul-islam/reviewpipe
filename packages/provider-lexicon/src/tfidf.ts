import { STOPWORDS } from './stopwords.js';

const DEFAULT_TOP_N = 10;
const MIN_TOKEN_LENGTH = 3;

/** A keyword and the summed TF-IDF weight that ranked it. */
export interface Keyword {
  term: string;
  score: number;
}

/**
 * Extract the most distinctive keywords across a set of documents using TF-IDF
 * with smoothed inverse document frequency (`ln((1 + N) / (1 + df)) + 1`). The
 * smoothing keeps weights positive, so a single-document corpus still ranks by
 * term frequency instead of collapsing to zero.
 *
 * Stopwords and tokens shorter than three characters are dropped. Empty input
 * yields an empty array. Results are sorted by descending score, ties broken
 * alphabetically for determinism.
 */
export function extractKeywords(
  documents: string[],
  options: { topN?: number } = {},
): Keyword[] {
  const topN = options.topN ?? DEFAULT_TOP_N;
  const tokenized = documents.map(tokenize);
  const documentCount = tokenized.length;
  if (documentCount === 0) return [];

  const documentFrequency = new Map<string, number>();
  for (const tokens of tokenized) {
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const weights = new Map<string, number>();
  for (const tokens of tokenized) {
    for (const [term, frequency] of termFrequencies(tokens)) {
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log((1 + documentCount) / (1 + df)) + 1;
      weights.set(term, (weights.get(term) ?? 0) + frequency * idf);
    }
  }

  return [...weights.entries()]
    .map(([term, score]) => ({ term, score }))
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
    .slice(0, topN);
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) ?? []).filter(
    (token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token),
  );
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}
