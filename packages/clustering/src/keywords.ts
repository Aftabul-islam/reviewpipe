import type { ThemeItem } from '@reviewpipe/core';

const MIN_TOKEN_LENGTH = 3;

/** Compact stopword set for cluster labeling — enough to keep filler out of labels. */
const STOPWORDS: ReadonlySet<string> = new Set([
  'the',
  'and',
  'for',
  'are',
  'but',
  'not',
  'you',
  'was',
  'this',
  'that',
  'with',
  'have',
  'from',
  'they',
  'will',
  'would',
  'there',
  'their',
  'what',
  'about',
  'which',
  'when',
  'were',
  'been',
  'more',
  'some',
  'them',
  'then',
  'than',
  'into',
  'just',
  'over',
  'also',
  'only',
  'very',
  'much',
  'such',
  'here',
  'your',
  'again',
  'still',
  'even',
  'because',
  'while',
  'after',
  'before',
  'these',
  'those',
  'its',
  'had',
  'has',
  'get',
  'got',
  'out',
  'off',
  'too',
  'all',
  'any',
  'now',
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) ?? []).filter(
    (token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token),
  );
}

/**
 * Fallback clustering for providers without embeddings: pick the top-`k`
 * corpus keywords (by summed TF-IDF), then assign each review to the keyword it
 * mentions most saliently. Reviews mentioning none of the top keywords are left
 * out rather than forced into a theme.
 */
export function groupByKeywords(items: ThemeItem[], k: number): ThemeItem[][] {
  const docs = items.map((item) => tokenize(item.review.text));
  const idf = documentIdf(docs);

  const globalScore = new Map<string, number>();
  for (const tokens of docs) {
    for (const [term, tf] of termFrequencies(tokens)) {
      globalScore.set(term, (globalScore.get(term) ?? 0) + tf * (idf.get(term) ?? 0));
    }
  }

  const seeds = rank(globalScore)
    .slice(0, k)
    .map(([term]) => term);

  const groups = new Map<string, ThemeItem[]>();
  items.forEach((item, index) => {
    const tf = termFrequencies(docs[index] ?? []);
    let bestSeed: string | undefined;
    let bestScore = 0;
    for (const seed of seeds) {
      const score = (tf.get(seed) ?? 0) * (idf.get(seed) ?? 0);
      if (score > bestScore) {
        bestScore = score;
        bestSeed = seed;
      }
    }
    if (bestSeed !== undefined) {
      const bucket = groups.get(bestSeed) ?? [];
      bucket.push(item);
      groups.set(bestSeed, bucket);
    }
  });

  return [...groups.values()];
}

/**
 * Label each cluster with its most distinctive terms, using TF-IDF where each
 * cluster is one "document" — so terms concentrated in a single cluster
 * outrank terms spread across all of them.
 */
export function labelClusters(clusters: string[][], topN: number): string[][] {
  const clusterTokens = clusters.map((texts) => texts.flatMap(tokenize));
  const n = clusterTokens.length;

  const df = new Map<string, number>();
  for (const tokens of clusterTokens) {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  }

  return clusterTokens.map((tokens) => {
    const score = new Map<string, number>();
    for (const [term, tf] of termFrequencies(tokens)) {
      const idf = Math.log((1 + n) / (1 + (df.get(term) ?? 0))) + 1;
      score.set(term, tf * idf);
    }
    return rank(score)
      .slice(0, topN)
      .map(([term]) => term);
  });
}

function documentIdf(docs: string[][]): Map<string, number> {
  const n = docs.length;
  const df = new Map<string, number>();
  for (const tokens of docs) {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) idf.set(term, Math.log((1 + n) / (1 + count)) + 1);
  return idf;
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function rank(scores: Map<string, number>): [string, number][] {
  return [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
